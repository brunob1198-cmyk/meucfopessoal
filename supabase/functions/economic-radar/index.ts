import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Fetch user's real spending data (last 6 months)
    const sixMonthsAgo = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    })();

    const [txRes, catRes] = await Promise.all([
      supabase.from("transactions").select("*, categories(name, dre_type)").gte("date", sixMonthsAgo).order("date"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);

    const transactions = txRes.data || [];

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
DADOS FINANCEIROS DO USUÁRIO (últimos ${months} meses):
- Renda média mensal: R$ ${avgMonthlyIncome.toFixed(0)}
- Despesa média mensal: R$ ${avgMonthlyExpenses.toFixed(0)}
- Margem mensal: R$ ${(avgMonthlyIncome - avgMonthlyExpenses).toFixed(0)}

Maiores gastos mensais médios:
${topCategories.map(c => `- ${c}`).join("\n")}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista macroeconômico especializado em traduzir cenários econômicos para impacto no bolso de pessoas físicas no Brasil.

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
          },
          { role: "user", content: userContext },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para análise." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let result;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      result = {
        cenario: {},
        impacto_pessoal: [],
        tendencias: [],
        recomendacoes: [],
        resumo: "Não foi possível gerar a análise econômica no momento.",
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
