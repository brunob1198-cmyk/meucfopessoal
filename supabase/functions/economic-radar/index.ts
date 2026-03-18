import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --------------------
// FETCH HELPERS
// --------------------
async function fetchBCB(code: number) {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;
    const res = await fetch(url);
    const data = await res.json();
    return Number(data[0]?.valor) || null;
  } catch {
    return null;
  }
}

async function fetchYahoo(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.quoteResponse.result[0]?.regularMarketPrice || null;
  } catch {
    return null;
  }
}

// --------------------
// MAIN
// --------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // --------------------
    // 🧠 CACHE 24H
    // --------------------
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let economicData;

    const { data: cached } = await supabase
      .from("economic_snapshots")
      .select("*")
      .gte("created_at", last24h.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      economicData = cached.data;
    } else {
      const [ipca, selic, dolar, igpm, focusInflation, oil, gold, sp500, dxy] = await Promise.all([
        fetchBCB(433),
        fetchBCB(1178),
        fetchBCB(1),
        fetchBCB(189),
        fetchBCB(13522),
        fetchYahoo("CL=F"),
        fetchYahoo("GC=F"),
        fetchYahoo("^GSPC"),
        fetchYahoo("DX-Y.NYB"),
      ]);

      const fuelTrend = oil ? (oil > 80 ? "alta" : oil < 70 ? "queda" : "estável") : "indefinido";

      economicData = {
        ipca,
        selic,
        dolar,
        igpm,
        focusInflation,
        oil,
        gold,
        sp500,
        dxy,
        fuelTrend,
        updated_at: now.toISOString(),
      };

      await supabase.from("economic_snapshots").insert({
        user_id: user.id,
        data: economicData,
        created_at: now.toISOString(),
      });
    }

    // --------------------
    // USER DATA
    // --------------------
    const sixMonthsAgo = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    })();

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*, categories(name, dre_type)")
      .gte("date", sixMonthsAgo);

    let totalExpenses = 0;
    let totalIncome = 0;
    const monthsSet = new Set<string>();

    for (const tx of transactions || []) {
      const m = tx.date.substring(0, 7);
      monthsSet.add(m);

      const type = tx.categories?.dre_type;

      if (type === "receita") totalIncome += Number(tx.amount);
      if (type === "despesa") totalExpenses += Number(tx.amount);
    }

    const monthCount = monthsSet.size || 1;

    const avgMonthlyExpenses = totalExpenses / monthCount;
    const avgMonthlyIncome = totalIncome / monthCount;

    const userContext = `
Renda média: R$ ${avgMonthlyIncome.toFixed(0)}
Despesa média: R$ ${avgMonthlyExpenses.toFixed(0)}
Margem: R$ ${(avgMonthlyIncome - avgMonthlyExpenses).toFixed(0)}
`;

    // --------------------
    // HISTÓRICO
    // --------------------
    const { data: history } = await supabase
      .from("economic_snapshots")
      .select("data, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const historyContext = history
      ?.map((h) => `- ${h.created_at}: Selic ${h.data.selic}, IPCA ${h.data.ipca}`)
      .join("\n");

    // --------------------
    // 🧠 AI
    // --------------------
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista macroeconômico especializado em impacto financeiro pessoal no Brasil.

OBJETIVO:
Gerar um Radar Econômico personalizado, baseado EXCLUSIVAMENTE nos dados econômicos fornecidos.

REGRAS:
- Use SOMENTE os dados fornecidos
- NÃO use conhecimento antigo
- NÃO invente dados

Responda em JSON válido.`,
          },
          {
            role: "user",
            content: `
${userContext}

DADOS ECONÔMICOS (últimas 24h):
IPCA: ${economicData.ipca}%
Selic: ${economicData.selic}%
Dólar: ${economicData.dolar}
IGPM: ${economicData.igpm}
Expectativa inflação: ${economicData.focusInflation}%
Petróleo: ${economicData.oil}
Combustível tendência: ${economicData.fuelTrend}

Histórico:
${historyContext}
            `,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI ERROR:", errText);
      throw new Error("Erro na IA");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { erro: "Falha ao interpretar resposta da IA" };
    }

    // --------------------
    // 💾 SAVE RADAR
    // --------------------
    await supabase.from("economic_radar_reports").insert({
      user_id: user.id,
      report: parsed,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
