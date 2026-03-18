import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
// MAIN FUNCTION
// --------------------
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

    const categorySpending: any = {};
    let totalExpenses = 0;
    let totalIncome = 0;
    const months = new Set<string>();

    for (const tx of transactions || []) {
      const m = tx.date.substring(0, 7);
      months.add(m);

      const type = tx.categories?.dre_type;

      if (type === "receita") totalIncome += Number(tx.amount);
      if (type === "despesa") {
        totalExpenses += Number(tx.amount);
        const name = tx.categories?.name || "Outros";
        if (!categorySpending[name]) categorySpending[name] = 0;
        categorySpending[name] += Number(tx.amount);
      }
    }

    const monthCount = months.size || 1;
// Build spending summary by category
    const categorySpending: Record<string, { name: string; total: number; count: number }> = {};
    let totalExpenses = 0;
    let totalIncome = 0;
    const monthCount = new Set<string>();

    for (const tx of transactions) {
      const m = tx.date.substring(0, 7);
      monthCount.add(m);
      const catName = tx.categories?.name || "Sem categoria";
      const catType = tx.categories?.dre_type || "despesa";

      if (catType === "receita" || catType === "outras_receitas") {
        totalIncome += Number(tx.amount);
      } else if (catType === "despesa" || catType === "custo") {
        totalExpenses += Number(tx.amount);
        if (!categorySpending[catName]) categorySpending[catName] = { name: catName, total: 0, count: 0 };
        categorySpending[catName].total += Number(tx.amount);
        categorySpending[catName].count++;
      }
    }

    const months = monthCount.size || 1;
    const avgMonthlyExpenses = totalExpenses / months;
    const avgMonthlyIncome = totalIncome / months;

    // Top spending categories
    const topCategories = Object.values(categorySpending)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(c => `${c.name}: R$ ${(c.total / months).toFixed(0)}/mês`);

    const userContext = `
- Renda média: R$ ${(totalIncome / monthCount).toFixed(0)}
- Despesa média: R$ ${(totalExpenses / monthCount).toFixed(0)}
- Margem mensal: R$ ${(avgMonthlyIncome - avgMonthlyExpenses).toFixed(0)}
`;

    // --------------------
    // 🔥 ECONOMIC DATA
    // --------------------
    const [
      ipca,
      selic,
      dolar,
      igpm,
      focusInflation,
      oil,
      gold,
      sp500,
      dxy
    ] = await Promise.all([
      fetchBCB(433),
      fetchBCB(1178),
      fetchBCB(1),
      fetchBCB(189),
      fetchBCB(13522), // expectativa inflação
      fetchYahoo("CL=F"),
      fetchYahoo("GC=F"),
      fetchYahoo("^GSPC"),
      fetchYahoo("DX-Y.NYB"),
    ]);

    // 🔥 Proxy combustível
    const fuelTrend = oil
      ? oil > 80 ? "alta" : oil < 70 ? "queda" : "estável"
      : "indefinido";

    const economicData = {
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
      updated_at: new Date().toISOString(),
    };

    // --------------------
    // 💾 INTELIGÊNCIA CONTÍNUA
    // --------------------
    await supabase.from("economic_snapshots").insert({
      user_id: user.id,
      data: economicData,
      created_at: new Date().toISOString(),
    });

    // pegar histórico recente
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
            content: `
Você é um analista macroeconômico especializado em traduzir cenários econômicos para impacto no bolso de pessoas físicas no Brasil.

Sua tarefa é gerar um Radar Econômico personalizado para o usuário, com base no cenário econômico ATUAL do Brasil e nos dados financeiros do usuário.

Use seu conhecimento atualizado sobre a economia brasileira para analisar:
- Taxa Selic atual e tendência
- Inflação (IPCA) atual e projeções
- Preço dos combustíveis (gasolina, etanol)
- Índice de preços de alimentos
- Câmbio (dólar)
- Mercado de trabalho

IMPORTANTE: Baseie-se em dados econômicos reais e atuais do Brasil. Considere dados do Banco Central, IBGE, FGV e outras fontes oficiais.

Responda APENAS com JSON válido, sem markdown:
{
  "cenario": {
    "inflacao": { "status": "alta|estável|baixa", "valor": "X.X%", "tendencia": "subindo|estável|caindo", "detalhe": "breve explicação" },
    "juros": { "status": "altos|estáveis|baixos", "valor": "X.X%", "tendencia": "subindo|estável|caindo", "detalhe": "breve explicação" },
    "combustivel": { "status": "alto|estável|baixo", "tendencia": "subindo|estável|caindo", "detalhe": "breve explicação" },
    "alimentos": { "status": "pressão alta|estável|deflação", "tendencia": "subindo|estável|caindo", "detalhe": "breve explicação" },
    "dolar": { "status": "alto|estável|baixo", "valor": "R$ X.XX", "tendencia": "subindo|estável|caindo", "detalhe": "breve explicação" }
  },
  "impacto_pessoal": [
    { "categoria": "nome da categoria afetada", "impacto_estimado": "+R$ XX/mês ou -R$ XX/mês ou estável", "explicacao": "por que e como isso afeta o usuário" }
  ],
  "tendencias": [
    { "titulo": "título da tendência", "descricao": "explicação da tendência", "impacto_usuario": "como afeta especificamente este usuário com base nos gastos dele", "severidade": "alta|média|baixa" }
  ],
  "recomendacoes": [
    { "titulo": "título curto", "descricao": "recomendação detalhada e acionável", "economia_potencial": "R$ XX/mês estimado" }
  ],
  "resumo": "Resumo executivo em 2-3 frases do cenário econômico e impacto no usuário"
}

Seja específico, use os valores reais dos gastos do usuário para calcular impactos. Tom profissional e acessível.`,	

REGRAS:
DADOS PRIORITÁRIOS
Você DEVE usar obrigatoriamente os dados econômicos fornecidos no contexto da mensagem do usuário.

NUNCA use conhecimento antigo ou genérico.
Se houver conflito, priorize os dados fornecidos.

Considere que esses dados são os mais atualizados disponíveis no momento.

Responda em JSON válido.
            `,
          },
          {
            role: "user",
            content: `
${userContext}

DADOS ECONÔMICOS:
IPCA: ${ipca}%
Selic: ${selic}%
Dólar: ${dolar}
IGPM: ${igpm}
Expectativa inflação: ${focusInflation}%
Petróleo: ${oil}
Combustível tendência: ${fuelTrend}

Histórico recente:
${historyContext}
            `,
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    return new Response(content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
