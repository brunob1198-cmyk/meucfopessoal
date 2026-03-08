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

    // Accept optional period filter from request body
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    try {
      const body = await req.json();
      periodStart = body.periodStart || null;
      periodEnd = body.periodEnd || null;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Default to last 12 months if no period specified
    const startDate = periodStart || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 12);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    })();

    const endDate = periodEnd || (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return `${d.getFullYear()}-12-31`;
    })();

    const [txRes, catRes, projRes] = await Promise.all([
      supabase.from("transactions").select("*, categories(name, dre_type, parent_id)").gte("date", startDate).lte("date", endDate).order("date"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("projections").select("*, categories(name, dre_type, parent_id)").gte("month", startDate).lte("month", endDate).order("month"),
    ]);

    if (txRes.error) throw txRes.error;
    if (catRes.error) throw catRes.error;
    if (projRes.error) throw projRes.error;

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const projections = projRes.data || [];

    if (transactions.length === 0 && projections.length === 0) {
      const emptyResult = {
        insights: ["Ainda não há lançamentos suficientes para gerar análises. Comece adicionando seus lançamentos financeiros."],
        alerts: [],
        suggestions: ["Cadastre seus lançamentos de receitas e despesas para que a IA possa analisar seus dados."],
        forecast: null,
      };

      // Save to history
      await supabase.from("analysis_history").insert({
        user_id: user.id,
        period_start: periodStart,
        period_end: periodEnd,
        result: emptyResult,
      });

      return new Response(JSON.stringify(emptyResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a financial summary for the AI
    const now = new Date();
    const monthlyData: Record<string, Record<string, number>> = {};
    const categorySpending: Record<string, { name: string; type: string; total: number; months: Record<string, number> }> = {};

    for (const tx of transactions) {
      const m = tx.date.substring(0, 7);
      const catName = tx.categories?.name || "Sem categoria";
      const catType = tx.categories?.dre_type || "despesa";

      if (!monthlyData[m]) monthlyData[m] = {};
      monthlyData[m][catName] = (monthlyData[m][catName] || 0) + Number(tx.amount);

      if (!categorySpending[tx.category_id]) {
        categorySpending[tx.category_id] = { name: catName, type: catType, total: 0, months: {} };
      }
      categorySpending[tx.category_id].total += Number(tx.amount);
      categorySpending[tx.category_id].months[m] = (categorySpending[tx.category_id].months[m] || 0) + Number(tx.amount);
    }

    const monthlyTotals: Record<string, { receita: number; despesa: number; custo: number; desconto: number }> = {};
    for (const tx of transactions) {
      const m = tx.date.substring(0, 7);
      if (!monthlyTotals[m]) monthlyTotals[m] = { receita: 0, despesa: 0, custo: 0, desconto: 0 };
      const type = tx.categories?.dre_type as string;
      if (type === "receita") monthlyTotals[m].receita += Number(tx.amount);
      else if (type === "despesa") monthlyTotals[m].despesa += Number(tx.amount);
      else if (type === "custo") monthlyTotals[m].custo += Number(tx.amount);
      else if (type === "desconto") monthlyTotals[m].desconto += Number(tx.amount);
    }

    const sortedMonths = Object.keys(monthlyTotals).sort();

    let summaryText = `DADOS FINANCEIROS DO USUÁRIO:\n\n`;
    summaryText += `Data atual: ${now.toISOString().split("T")[0]}\n`;
    if (periodStart || periodEnd) {
      summaryText += `Período analisado: ${periodStart || "início"} a ${periodEnd || "fim"}\n`;
    }
    summaryText += `\nRESUMO MENSAL:\n`;
    for (const m of sortedMonths) {
      const t = monthlyTotals[m];
      const liquido = t.receita - t.desconto - t.custo - t.despesa;
      summaryText += `${m}: Receita R$${t.receita.toFixed(2)} | Despesas R$${t.despesa.toFixed(2)} | Custos R$${t.custo.toFixed(2)} | Resultado R$${liquido.toFixed(2)}\n`;
    }

    summaryText += `\nDETALHE POR CATEGORIA (subcategorias):\n`;
    const topCats = Object.values(categorySpending)
      .filter((c) => c.type === "despesa")
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    for (const cat of topCats) {
      summaryText += `- ${cat.name}: Total R$${cat.total.toFixed(2)}`;
      const monthKeys = Object.keys(cat.months).sort().slice(-3);
      if (monthKeys.length > 1) {
        summaryText += ` (últimos meses: ${monthKeys.map((m) => `${m}=R$${cat.months[m].toFixed(2)}`).join(", ")})`;
      }
      summaryText += `\n`;
    }

    if (projections.length > 0) {
      summaryText += `\nPROJEÇÕES FUTURAS:\n`;
      for (const p of projections.slice(0, 30)) {
        const m = p.month.substring(0, 7);
        summaryText += `- ${p.categories?.name || "?"} em ${m}: R$${Number(p.amount).toFixed(2)} (planejado)\n`;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um CFO pessoal digital especialista em finanças pessoais. Analise os dados financeiros do usuário e retorne uma análise completa.

IMPORTANTE: Responda APENAS com o JSON válido no formato especificado, sem markdown, sem backticks, sem texto adicional.

Formato de resposta (JSON puro):
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "alerts": ["alerta 1", "alerta 2", "alerta 3"],
  "suggestions": ["sugestão 1", "sugestão 2", "sugestão 3", "sugestão 4"],
  "forecast": {
    "summary": "resumo da previsão financeira para os próximos 3 meses",
    "projected_savings": 0,
    "trend": "positiva|negativa|estável",
    "details": ["detalhe 1", "detalhe 2", "detalhe 3"]
  }
}

Regras:
- insights: 3-5 análises sobre tendências, categorias que mais crescem, variações mensais, padrões de consumo. Inclua números e percentuais.
- alerts: 1-3 alertas sobre gastos acima da média, categorias fora do padrão, redução de receita. Só inclua se realmente relevante.
- suggestions: 3-4 sugestões acionáveis de redução de despesas, melhor distribuição, melhoria do fluxo.
- forecast: previsão baseada em tendências dos últimos meses. projected_savings é a economia estimada se seguir as sugestões.
- Use valores em reais (R$) e percentuais quando relevante.
- Seja específico com nomes de categorias e valores.
- Tom profissional mas acessível.`,
          },
          { role: "user", content: summaryText },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para análise de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        insights: ["Análise gerada com base nos seus dados financeiros recentes."],
        alerts: [],
        suggestions: ["Continue registrando seus lançamentos para análises mais precisas."],
        forecast: { summary: "Dados insuficientes para previsão detalhada.", projected_savings: 0, trend: "estável", details: [] },
      };
    }

    // Save to history
    await supabase.from("analysis_history").insert({
      user_id: user.id,
      period_start: periodStart,
      period_end: periodEnd,
      result,
    });

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
