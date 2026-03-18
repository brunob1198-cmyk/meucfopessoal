import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --------------------
// HELPERS
// --------------------
async function fetchBCB(code: number) {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;
    const res = await fetch(url);
    const data = await res.json();

    return {
      valor: Number(data[0]?.valor) || null,
      data: data[0]?.data || null,
    };
  } catch {
    return { valor: null, data: null };
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

function isCurrentMonth(dateStr: string | null) {
  if (!dateStr) return false;

  const [day, month, year] = dateStr.split("/");
  const now = new Date();

  return Number(month) === now.getMonth() + 1 && Number(year) === now.getFullYear();
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

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let economicData;

    // --------------------
    // 🔎 CACHE INTELIGENTE
    // --------------------
    const { data: cached } = await supabase
      .from("economic_snapshots")
      .select("*")
      .gte("created_at", last24h.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let usarCache = false;

    if (cached) {
      const dataCache = new Date(cached.created_at);
      const horas = (now.getTime() - dataCache.getTime()) / (1000 * 60 * 60);

      // Só usa cache se:
      // - menor que 24h
      // - E IPCA já é do mês atual
      if (horas < 24 && cached.data?.ipca_atualizado) {
        usarCache = true;
      }
    }

    if (usarCache) {
      economicData = cached.data;
    } else {
      // --------------------
      // 🔥 FETCH REAL
      // --------------------
      const [ipcaRaw, selicRaw, dolarRaw, igpmRaw, focusRaw, oil, gold, sp500, dxy] = await Promise.all([
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
        ipca: ipcaRaw.valor,
        ipca_date: ipcaRaw.data,
        ipca_atualizado: isCurrentMonth(ipcaRaw.data),

        selic: selicRaw.valor,
        dolar: dolarRaw.valor,
        igpm: igpmRaw.valor,
        focusInflation: focusRaw.valor,

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

    console.log("ECONOMIC DATA:", economicData);

    // --------------------
    // USER + CATEGORIES
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
    const categoryTotals: Record<string, number> = {};

    for (const tx of transactions || []) {
      if (!tx.date) continue;

      const m = tx.date.substring(0, 7);
      monthsSet.add(m);

      const type = tx.categories?.dre_type;
      const cat = tx.categories?.name || "Outros";

      if (type === "receita") {
        totalIncome += Number(tx.amount);
      }

      if (type === "despesa") {
        totalExpenses += Number(tx.amount);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(tx.amount);
      }
    }

    const monthCount = monthsSet.size || 1;

    const avgMonthlyExpenses = totalExpenses / monthCount;
    const avgMonthlyIncome = totalIncome / monthCount;

    const categoryContext = Object.entries(categoryTotals)
      .map(([cat, val]) => `${cat}: R$ ${(val / monthCount).toFixed(0)}/mês`)
      .join("\n");

    const userContext = `
Renda média: R$ ${avgMonthlyIncome.toFixed(0)}
Despesa média: R$ ${avgMonthlyExpenses.toFixed(0)}
Margem: R$ ${(avgMonthlyIncome - avgMonthlyExpenses).toFixed(0)}

Categorias:
${categoryContext}
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
    // IA
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
Gerar um Radar Econômico personalizado, baseado EXCLUSIVAMENTE nos dados econômicos fornecidos no contexto e no comportamento financeiro do usuário.

CONTEXTO DOS DADOS:
Os dados econômicos fornecidos são atualizados automaticamente a cada 24 horas (cache inteligente).
Considere esses dados como os mais recentes disponíveis, mesmo que não sejam em tempo real minuto a minuto.

REGRAS CRÍTICAS:
- Use SOMENTE os dados fornecidos no contexto
- NÃO use conhecimento antigo ou genérico do seu treinamento
- NÃO invente números ou cenários
- Se algum dado estiver ausente, assuma como "não disponível"
- Sempre priorize os dados recebidos no prompt

ANÁLISE OBRIGATÓRIA:
Você deve interpretar e gerar insights sobre:

1. Inflação (IPCA e expectativa Focus)
2. Juros (Selic)
3. Combustível (com base no petróleo + tendência)
4. Câmbio (dólar)
5. Pressão em alimentos (inferir com base em inflação)
6. Tendência macroeconômica geral

INTERPRETAÇÃO INTELIGENTE:
- Compare com histórico recente (se fornecido)
- Identifique tendência: subindo, caindo ou estável
- Traduza tudo para impacto PRÁTICO no bolso do usuário

FOCO PRINCIPAL:
Transformar dados econômicos em:
- impacto financeiro direto
- antecipação de problemas
- oportunidades de economia

FORMATO DE RESPOSTA (OBRIGATÓRIO - JSON VÁLIDO):

{
  "cenario": {
    "inflacao": {
      "status": "alta|estável|baixa",
      "valor": "X.X%",
      "tendencia": "subindo|estável|caindo",
      "detalhe": "explicação objetiva baseada nos dados"
    },
    "juros": {
      "status": "altos|estáveis|baixos",
      "valor": "X.X%",
      "tendencia": "subindo|estável|caindo",
      "detalhe": "impacto no crédito e consumo"
    },
    "combustivel": {
      "status": "alto|estável|baixo",
      "tendencia": "subindo|estável|caindo",
      "detalhe": "explicação baseada no petróleo"
    },
    "alimentos": {
      "status": "pressão alta|estável|deflação",
      "tendencia": "subindo|estável|caindo",
      "detalhe": "baseado na inflação"
    },
    "dolar": {
      "status": "alto|estável|baixo",
      "valor": "R$ X.XX",
      "tendencia": "subindo|estável|caindo",
      "detalhe": "impacto em produtos e serviços"
    }
  },

  "impacto_pessoal": [
    {
      "categoria": "categoria de gasto do usuário",
      "impacto_estimado": "+R$ XX/mês ou -R$ XX/mês",
      "explicacao": "como o cenário impacta diretamente essa categoria"
    }
  ],

  "tendencias": [
    {
      "titulo": "nome da tendência",
      "descricao": "explicação clara do movimento econômico",
      "impacto_usuario": "como isso afeta o usuário com base nos gastos dele",
      "severidade": "alta|média|baixa"
    }
  ],

  "recomendacoes": [
    {
      "titulo": "ação recomendada",
      "descricao": "ação prática e direta",
      "economia_potencial": "R$ XX/mês estimado"
    }
  ],

  "resumo": "Resumo executivo claro e direto do cenário e impacto no usuário (2-3 frases)"
}

DIRETRIZES DE QUALIDADE:
- Seja específico e numérico sempre que possível
- Conecte economia → comportamento → impacto financeiro
- Evite linguagem genérica
- Pense como um app tipo Nubank ou XP
- Gere valor prático, não apenas informação`,
          },
          {
            role: "user",
            content: `
${userContext}

IPCA: ${economicData.ipca} (${economicData.ipca_date})
Selic: ${economicData.selic}
Dólar: ${economicData.dolar}
IGPM: ${economicData.igpm}
Expectativa inflação: ${economicData.focusInflation}
Petróleo: ${economicData.oil}
Tendência combustível: ${economicData.fuelTrend}

Histórico:
${historyContext}
`,
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { erro: "IA inválida" };
    }

    // --------------------
    // SAVE
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
