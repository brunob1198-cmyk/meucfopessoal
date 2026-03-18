import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --------------------
// HELPERS - BCB API (Banco Central do Brasil)
// --------------------
async function fetchBCB(code: number, ultimos = 1): Promise<{ valor: number | null; data: string | null }> {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${ultimos}?formato=json`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      console.error(`BCB ${code} returned ${res.status}`);
      return { valor: null, data: null };
    }
    const data = await res.json();
    const last = data[data.length - 1];
    return {
      valor: last?.valor ? Number(last.valor) : null,
      data: last?.data || null,
    };
  } catch (e) {
    console.error(`BCB fetch error for code ${code}:`, e);
    return { valor: null, data: null };
  }
}

// Fetch BCB series with multiple recent values for trend analysis
async function fetchBCBSeries(code: number, count = 12): Promise<Array<{ valor: number; data: string }>> {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${count}?formato=json`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({ valor: Number(d.valor), data: d.data }));
  } catch {
    return [];
  }
}

// PTAX (official BRL/USD exchange rate from BCB)
async function fetchPTAX(): Promise<number | null> {
  try {
    const today = new Date();
    // Try last 5 business days
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dateStr}'&$format=json`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.value && data.value.length > 0) {
          return data.value[data.value.length - 1].cotacaoVenda;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("PTAX error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const now = new Date();

    // --------------------
    // 🔎 CACHE: only use if < 12h old
    // --------------------
    const cacheLimit = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const { data: cached } = await supabase
      .from("economic_snapshots")
      .select("*")
      .gte("created_at", cacheLimit.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let economicData: any;

    if (cached?.data) {
      console.log("Using cached economic data from", cached.created_at);
      economicData = cached.data;
    } else {
      console.log("Fetching fresh economic data...");

      // --------------------
      // 🔥 FETCH ALL DATA IN PARALLEL
      // --------------------
      const [
        ipcaRaw,           // IPCA mensal (433)
        selicRaw,          // Selic meta (432)
        igpmRaw,           // IGP-M (189)
        focusIpcaRaw,      // Focus IPCA expectativa (13522)
        focusSelicRaw,     // Focus Selic expectativa (13521)
        cdiRaw,            // CDI (12)
        dolarPtax,         // Dólar PTAX oficial
        ipcaSeries,        // IPCA últimos 12 meses
        selicSeries,       // Selic últimos 12 meses
      ] = await Promise.all([
        fetchBCB(433),
        fetchBCB(432),
        fetchBCB(189),
        fetchBCB(13522),
        fetchBCB(13521),
        fetchBCB(12),
        fetchPTAX(),
        fetchBCBSeries(433, 12),
        fetchBCBSeries(432, 12),
      ]);

      // Calculate IPCA accumulated 12 months
      const ipca12m = ipcaSeries.length > 0
        ? ipcaSeries.reduce((acc, item) => acc * (1 + item.valor / 100), 1) * 100 - 100
        : null;

      // Determine trends
      const ipcaTrend = ipcaSeries.length >= 3
        ? (ipcaSeries[ipcaSeries.length - 1].valor > ipcaSeries[ipcaSeries.length - 3].valor ? "alta" : "queda")
        : "indefinido";

      const selicTrend = selicSeries.length >= 3
        ? (selicSeries[selicSeries.length - 1].valor > selicSeries[selicSeries.length - 3].valor ? "alta" :
           selicSeries[selicSeries.length - 1].valor === selicSeries[selicSeries.length - 3].valor ? "estável" : "queda")
        : "indefinido";

      economicData = {
        ipca_mensal: ipcaRaw.valor,
        ipca_date: ipcaRaw.data,
        ipca_acumulado_12m: ipca12m ? Number(ipca12m.toFixed(2)) : null,
        ipca_trend: ipcaTrend,

        selic: selicRaw.valor,
        selic_date: selicRaw.data,
        selic_trend: selicTrend,

        cdi: cdiRaw.valor,
        igpm: igpmRaw.valor,

        dolar: dolarPtax,

        focus_ipca: focusIpcaRaw.valor,
        focus_selic: focusSelicRaw.valor,

        ipca_historico: ipcaSeries.slice(-6).map(s => ({ mes: s.data, valor: s.valor })),
        selic_historico: selicSeries.slice(-6).map(s => ({ mes: s.data, valor: s.valor })),

        updated_at: now.toISOString(),
        data_source: "Banco Central do Brasil (BCB/SGS + PTAX)",
      };

      console.log("Economic data fetched:", JSON.stringify(economicData));

      // Save snapshot
      await supabase.from("economic_snapshots").insert({
        user_id: user.id,
        data: economicData,
        created_at: now.toISOString(),
      });
    }

    // --------------------
    // USER DATA - last 6 months
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
    const categoryTotals: Record<string, number> = {};
    const monthsSet = new Set<string>();

    for (const tx of transactions || []) {
      const m = tx.date.substring(0, 7);
      monthsSet.add(m);
      const type = tx.categories?.dre_type;
      const catName = tx.categories?.name || "Outros";

      if (type === "receita" || type === "outras_receitas") {
        totalIncome += Number(tx.amount);
      } else if (type === "despesa" || type === "custo") {
        totalExpenses += Number(tx.amount);
        categoryTotals[catName] = (categoryTotals[catName] || 0) + Number(tx.amount);
      }
    }

    const monthCount = monthsSet.size || 1;
    const avgMonthlyExpenses = totalExpenses / monthCount;
    const avgMonthlyIncome = totalIncome / monthCount;

    // Top expense categories
    const topCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, total]) => `${name}: R$ ${(total / monthCount).toFixed(0)}/mês`)
      .join("\n");

    const userContext = `
PERFIL FINANCEIRO DO USUÁRIO (média mensal últimos ${monthCount} meses):
- Renda média: R$ ${avgMonthlyIncome.toFixed(0)}
- Despesa média: R$ ${avgMonthlyExpenses.toFixed(0)}
- Margem líquida: R$ ${(avgMonthlyIncome - avgMonthlyExpenses).toFixed(0)}
- Taxa de poupança: ${avgMonthlyIncome > 0 ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome * 100).toFixed(1) : 0}%

PRINCIPAIS CATEGORIAS DE GASTO (média/mês):
${topCategories}
`;

    // --------------------
    // IA ANALYSIS
    // --------------------
    const currentDate = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

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
            content: `Você é um analista macroeconômico especializado no cenário brasileiro ATUAL (${currentDate}).

REGRAS:
1. Use SOMENTE os dados fornecidos abaixo para números específicos.
2. A data de HOJE é ${currentDate}. Todos os dados são do período mais recente disponível.
3. Responda em JSON válido com a estrutura exata especificada.
4. Traduza o impacto macroeconômico para o bolso do usuário com valores em R$.
5. Seja específico e prático nas recomendações.
6. Considere o cenário econômico brasileiro atual de ${now.getFullYear()}.`,
          },
          {
            role: "user",
            content: `
DATA DE HOJE: ${currentDate}

DADOS MACROECONÔMICOS ATUAIS (fonte: Banco Central do Brasil):
- IPCA mensal: ${economicData.ipca_mensal}% (referência: ${economicData.ipca_date})
- IPCA acumulado 12 meses: ${economicData.ipca_acumulado_12m}%
- Tendência IPCA: ${economicData.ipca_trend}
- Selic meta: ${economicData.selic}% a.a. (referência: ${economicData.selic_date})
- Tendência Selic: ${economicData.selic_trend}
- CDI: ${economicData.cdi}%
- IGP-M: ${economicData.igpm}%
- Dólar (PTAX): R$ ${economicData.dolar ? economicData.dolar.toFixed(2) : "N/A"}
- Expectativa IPCA (Focus): ${economicData.focus_ipca}%
- Expectativa Selic (Focus): ${economicData.focus_selic}%

Histórico IPCA (últimos meses): ${JSON.stringify(economicData.ipca_historico)}
Histórico Selic (últimos meses): ${JSON.stringify(economicData.selic_historico)}

${userContext}

Responda com este JSON exato:
{
  "cenario_atual": {
    "inflacao": { "valor": "X.XX%", "tendencia": "alta|queda|estável", "detalhe": "explicação curta" },
    "juros": { "valor": "XX.XX%", "tendencia": "alta|queda|estável", "detalhe": "explicação curta" },
    "dolar": { "valor": "R$ X.XX", "tendencia": "alta|queda|estável", "detalhe": "explicação curta" },
    "combustivel": { "tendencia": "alta|queda|estável", "detalhe": "explicação baseada no dólar e petróleo" },
    "alimentos": { "tendencia": "alta|queda|estável", "detalhe": "explicação baseada em IGP-M e câmbio" }
  },
  "impacto_pessoal": [
    { "categoria": "nome", "impacto_mensal": "+/- R$ XX", "explicacao": "por quê" }
  ],
  "tendencias": [
    { "titulo": "título curto", "descricao": "impacto no usuário", "valor_medio_atual": "R$ X", "estimativa_proximos_meses": "R$ X a R$ Y" }
  ],
  "recomendacoes": [
    { "acao": "o que fazer", "motivo": "por quê", "economia_estimada": "R$ X/mês" }
  ],
  "resumo": "Parágrafo resumindo o cenário e o que o usuário deve fazer",
  "data_referencia": "${currentDate}"
}`,
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = { erro: "Falha ao processar resposta da IA", raw: content };
    }

    // Add raw economic data to response
    parsed.dados_economicos = {
      ipca_mensal: economicData.ipca_mensal,
      ipca_acumulado_12m: economicData.ipca_acumulado_12m,
      selic: economicData.selic,
      cdi: economicData.cdi,
      igpm: economicData.igpm,
      dolar: economicData.dolar,
      focus_ipca: economicData.focus_ipca,
      focus_selic: economicData.focus_selic,
      updated_at: economicData.updated_at,
      fonte: economicData.data_source,
    };

    // Save report
    await supabase.from("economic_radar_reports").insert({
      user_id: user.id,
      report: parsed,
      created_at: now.toISOString(),
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
