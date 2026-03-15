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

    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    try {
      const body = await req.json();
      periodStart = body.periodStart || null;
      periodEnd = body.periodEnd || null;
    } catch {}

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

    // Build financial summary
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

    // Build projected vs actual comparison by category
    const projectedByCategory: Record<string, Record<string, number>> = {};
    for (const p of projections) {
      const m = p.month.substring(0, 7);
      const catName = p.categories?.name || "?";
      if (!projectedByCategory[catName]) projectedByCategory[catName] = {};
      projectedByCategory[catName][m] = (projectedByCategory[catName][m] || 0) + Number(p.amount);
    }

    // Build monthly projected totals for DRE line items
    const monthlyProjectedTotals: Record<string, { receita: number; despesa: number; custo: number; desconto: number }> = {};
    for (const p of projections) {
      const m = p.month.substring(0, 7);
      if (!monthlyProjectedTotals[m]) monthlyProjectedTotals[m] = { receita: 0, despesa: 0, custo: 0, desconto: 0 };
      const type = p.categories?.dre_type as string;
      if (type === "receita") monthlyProjectedTotals[m].receita += Number(p.amount);
      else if (type === "despesa") monthlyProjectedTotals[m].despesa += Number(p.amount);
      else if (type === "custo") monthlyProjectedTotals[m].custo += Number(p.amount);
      else if (type === "desconto") monthlyProjectedTotals[m].desconto += Number(p.amount);
    }

    let summaryText = `DADOS FINANCEIROS DO USUÁRIO:\n\n`;
    summaryText += `Data atual: ${now.toISOString().split("T")[0]}\n`;
    if (periodStart || periodEnd) {
      summaryText += `Período analisado: ${periodStart || "início"} a ${periodEnd || "fim"}\n`;
    }
    summaryText += `\nRESUMO MENSAL (REALIZADO):\n`;
    for (const m of sortedMonths) {
      const t = monthlyTotals[m];
      const liquido = t.receita - t.desconto - t.custo - t.despesa;
      summaryText += `${m}: Receita R$${t.receita.toFixed(2)} | Despesas R$${t.despesa.toFixed(2)} | Custos R$${t.custo.toFixed(2)} | Resultado Líquido R$${liquido.toFixed(2)}\n`;
    }

    // Add projected vs actual comparison
    summaryText += `\nCOMPARATIVO PROJETADO x REALIZADO POR MÊS:\n`;
    const allMonths = new Set([...Object.keys(monthlyTotals), ...Object.keys(monthlyProjectedTotals)]);
    const sortedAllMonths = [...allMonths].sort();
    for (const m of sortedAllMonths) {
      const real = monthlyTotals[m];
      const proj = monthlyProjectedTotals[m];
      if (real && proj) {
        const realTotal = real.despesa + real.custo;
        const projTotal = proj.despesa + proj.custo;
        const realLiquido = real.receita - real.desconto - real.custo - real.despesa;
        const projLiquido = proj.receita - proj.desconto - proj.custo - proj.despesa;
        summaryText += `${m}: Real(Desp R$${realTotal.toFixed(2)}, Líquido R$${realLiquido.toFixed(2)}) | Projetado(Desp R$${projTotal.toFixed(2)}, Líquido R$${projLiquido.toFixed(2)}) | Desvio Desp ${((realTotal - projTotal) / (projTotal || 1) * 100).toFixed(1)}%\n`;
      }
    }

    summaryText += `\nDETALHE POR CATEGORIA - PROJETADO x REALIZADO (últimos 3 meses):\n`;
    const last3Months = sortedMonths.slice(-3);
    const topCats = Object.values(categorySpending)
      .filter((c) => c.type === "despesa" || c.type === "custo")
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    for (const cat of topCats) {
      const projected = projectedByCategory[cat.name];
      let line = `- ${cat.name}: `;
      const details: string[] = [];
      for (const m of last3Months) {
        const realVal = cat.months[m] || 0;
        const projVal = projected?.[m] || 0;
        if (realVal > 0 || projVal > 0) {
          details.push(`${m}: Real R$${realVal.toFixed(2)} vs Proj R$${projVal.toFixed(2)}`);
        }
      }
      if (details.length > 0) {
        line += details.join(" | ");
        // Calculate average deviation
        const avgReal = last3Months.reduce((s, m) => s + (cat.months[m] || 0), 0) / last3Months.length;
        const avgProj = last3Months.reduce((s, m) => s + (projected?.[m] || 0), 0) / last3Months.length;
        if (avgProj > 0 && avgReal > avgProj * 1.1) {
          line += ` ⚠ MÉDIA REAL (R$${avgReal.toFixed(0)}) EXCEDE PROJETADO (R$${avgProj.toFixed(0)}) em ${((avgReal/avgProj - 1)*100).toFixed(0)}%`;
        }
      } else {
        line += `Total R$${cat.total.toFixed(2)}`;
      }
      summaryText += line + `\n`;
    }

    // Add projected future months with liquido analysis
    if (projections.length > 0) {
      summaryText += `\nPROJEÇÕES FUTURAS (meses sem lançamentos reais):\n`;
      const futureMonths = Object.keys(monthlyProjectedTotals).filter(m => !monthlyTotals[m]).sort();
      for (const m of futureMonths.slice(0, 12)) {
        const p = monthlyProjectedTotals[m];
        if (p) {
          const liquido = p.receita - p.desconto - p.custo - p.despesa;
          summaryText += `${m}: Receita Proj R$${p.receita.toFixed(2)} | Despesas Proj R$${p.despesa.toFixed(2)} | Líquido Proj R$${liquido.toFixed(2)}${liquido < 0 ? ' ⚠ RESULTADO NEGATIVO' : ''}\n`;
        }
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
- alerts: 1-5 alertas. OBRIGATÓRIO incluir:
  * Comparação PROJETADO vs REALIZADO: se alguma categoria teve gasto real superior ao projetado nos últimos 3 meses, ALERTE com valores específicos e sugira atualizar o planejador. Exemplo: "Combustível: média real R$700/mês nos últimos 3 meses, porém projetado apenas R$600. Atualize o Planejador para refletir a realidade."
  * Se o Resultado Líquido PROJETADO de algum mês futuro for negativo, ALERTE informando o mês e o valor, e sugira cortes.
  * Alertas sobre gastos acima da média, categorias fora do padrão, redução de receita.
- suggestions: 3-5 sugestões acionáveis. OBRIGATÓRIO incluir:
  * Sugestões baseadas nos desvios entre projetado e realizado (ajustar projeções ou reduzir gastos).
  * Se houver meses futuros com resultado negativo, sugerir categorias específicas para cortar.
  * Sugestões personalizadas baseadas nos padrões do usuário - aprenda com os dados e identifique oportunidades únicas para este perfil.
- forecast: previsão baseada em tendências dos últimos meses E nos dados projetados. projected_savings é a economia estimada se seguir as sugestões.
- Use valores em reais (R$) e percentuais quando relevante.
- Seja específico com nomes de categorias e valores.
- Tom profissional mas acessível.
- Personalize ao máximo: identifique padrões únicos do usuário e faça sugestões que só fazem sentido para ele.`,
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
