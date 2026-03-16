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

    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Always fetch broad historical data for pattern recognition (last 12 months of actuals)
    const histStart = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 12);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    })();

    const filterStart = periodStart || histStart;
    const filterEnd = periodEnd || (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return `${d.getFullYear()}-12-31`;
    })();

    const [txRes, catRes, projRes] = await Promise.all([
      supabase.from("transactions").select("*, categories(name, dre_type, parent_id)").gte("date", histStart).lte("date", filterEnd).order("date"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("projections").select("*, categories(name, dre_type, parent_id)").gte("month", histStart).lte("month", filterEnd).order("month"),
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

    // Separate past transactions from future projections
    const pastTransactions = transactions.filter(tx => tx.date.substring(0, 7) <= nowStr);
    const futureProjections = projections.filter(p => p.month.substring(0, 7) > nowStr);
    const pastProjections = projections.filter(p => p.month.substring(0, 7) <= nowStr);

    // Build monthly spending patterns from REAL data
    const monthlyTotals: Record<string, { receita: number; despesa: number; custo: number; desconto: number }> = {};
    const categorySpending: Record<string, { name: string; type: string; total: number; count: number; months: Record<string, number> }> = {};

    for (const tx of pastTransactions) {
      const m = tx.date.substring(0, 7);
      const catName = tx.categories?.name || "Sem categoria";
      const catType = tx.categories?.dre_type || "despesa";

      if (!monthlyTotals[m]) monthlyTotals[m] = { receita: 0, despesa: 0, custo: 0, desconto: 0 };
      const type = catType as string;
      if (type === "receita") monthlyTotals[m].receita += Number(tx.amount);
      else if (type === "despesa") monthlyTotals[m].despesa += Number(tx.amount);
      else if (type === "custo") monthlyTotals[m].custo += Number(tx.amount);
      else if (type === "desconto") monthlyTotals[m].desconto += Number(tx.amount);

      if (!categorySpending[tx.category_id]) {
        categorySpending[tx.category_id] = { name: catName, type: catType, total: 0, count: 0, months: {} };
      }
      categorySpending[tx.category_id].total += Number(tx.amount);
      categorySpending[tx.category_id].count++;
      categorySpending[tx.category_id].months[m] = (categorySpending[tx.category_id].months[m] || 0) + Number(tx.amount);
    }

    const sortedMonths = Object.keys(monthlyTotals).sort();
    const last3Months = sortedMonths.slice(-3);
    const last6Months = sortedMonths.slice(-6);

    // Build future projected totals
    const futureProjectedByCategory: Record<string, Record<string, number>> = {};
    const futureMonthlyTotals: Record<string, { receita: number; despesa: number; custo: number; desconto: number }> = {};
    for (const p of futureProjections) {
      const m = p.month.substring(0, 7);
      const catName = p.categories?.name || "?";
      const catType = p.categories?.dre_type as string;
      if (!futureProjectedByCategory[catName]) futureProjectedByCategory[catName] = {};
      futureProjectedByCategory[catName][m] = (futureProjectedByCategory[catName][m] || 0) + Number(p.amount);
      if (!futureMonthlyTotals[m]) futureMonthlyTotals[m] = { receita: 0, despesa: 0, custo: 0, desconto: 0 };
      if (catType === "receita") futureMonthlyTotals[m].receita += Number(p.amount);
      else if (catType === "despesa") futureMonthlyTotals[m].despesa += Number(p.amount);
      else if (catType === "custo") futureMonthlyTotals[m].custo += Number(p.amount);
      else if (catType === "desconto") futureMonthlyTotals[m].desconto += Number(p.amount);
    }

    // Detect spending patterns and trends
    const categoryTrends: Record<string, { avg3m: number; avg6m: number; trend: string }> = {};
    for (const [catId, cat] of Object.entries(categorySpending)) {
      if (cat.type !== "despesa" && cat.type !== "custo") continue;
      const vals3 = last3Months.map(m => cat.months[m] || 0);
      const vals6 = last6Months.map(m => cat.months[m] || 0);
      const avg3 = vals3.reduce((a, b) => a + b, 0) / Math.max(vals3.filter(v => v > 0).length, 1);
      const avg6 = vals6.reduce((a, b) => a + b, 0) / Math.max(vals6.filter(v => v > 0).length, 1);
      let trend = "estável";
      if (avg6 > 0 && avg3 > avg6 * 1.15) trend = "crescente";
      else if (avg6 > 0 && avg3 < avg6 * 0.85) trend = "decrescente";
      categoryTrends[cat.name] = { avg3m: avg3, avg6m: avg6, trend };
    }

    // Build comprehensive summary
    let summaryText = `ANÁLISE FINANCEIRA COMPLETA DO USUÁRIO\n`;
    summaryText += `Data atual: ${now.toISOString().split("T")[0]}\n`;
    summaryText += `Período analisado: ${periodStart || histStart} a ${periodEnd || filterEnd}\n\n`;

    // Section 1: Historical patterns
    summaryText += `═══ PADRÕES HISTÓRICOS (dados reais) ═══\n`;
    summaryText += `Meses com dados: ${sortedMonths.length}\n\n`;
    for (const m of sortedMonths) {
      const t = monthlyTotals[m];
      const liquido = t.receita - t.desconto - t.custo - t.despesa;
      summaryText += `${m}: Receita R$${t.receita.toFixed(0)} | Desp+Custos R$${(t.despesa + t.custo).toFixed(0)} | Líquido R$${liquido.toFixed(0)}\n`;
    }

    // Section 2: Category behavior patterns
    summaryText += `\n═══ COMPORTAMENTO POR CATEGORIA (padrões aprendidos) ═══\n`;
    const topCats = Object.values(categorySpending)
      .filter(c => c.type === "despesa" || c.type === "custo")
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    for (const cat of topCats) {
      const trend = categoryTrends[cat.name];
      const avgStr = trend ? `Média 3m: R$${trend.avg3m.toFixed(0)} | Média 6m: R$${trend.avg6m.toFixed(0)} | Tendência: ${trend.trend}` : `Total: R$${cat.total.toFixed(0)}`;
      summaryText += `- ${cat.name}: ${avgStr}\n`;
    }

    // Section 3: Future projections analysis (KEY FOCUS)
    summaryText += `\n═══ ANÁLISE DE PROJEÇÕES FUTURAS (Planejador) ═══\n`;
    const futureMonthsSorted = Object.keys(futureMonthlyTotals).sort();
    if (futureMonthsSorted.length > 0) {
      for (const m of futureMonthsSorted.slice(0, 12)) {
        const p = futureMonthlyTotals[m];
        const liquido = p.receita - p.desconto - p.custo - p.despesa;
        summaryText += `${m}: Receita Proj R$${p.receita.toFixed(0)} | Desp Proj R$${(p.despesa + p.custo).toFixed(0)} | Líquido R$${liquido.toFixed(0)}${liquido < 0 ? ' ⚠ NEGATIVO' : ''}\n`;
      }

      // Compare future projections with learned behavior
      summaryText += `\n═══ DESVIOS: PROJEÇÕES FUTURAS vs COMPORTAMENTO REAL ═══\n`;
      for (const [catName, futureMonths] of Object.entries(futureProjectedByCategory)) {
        const trend = categoryTrends[catName];
        if (!trend || trend.avg3m === 0) continue;
        for (const [m, projVal] of Object.entries(futureMonths)) {
          const deviation = ((projVal - trend.avg3m) / trend.avg3m) * 100;
          if (Math.abs(deviation) > 20) {
            summaryText += `- ${catName} em ${m}: Projetado R$${projVal.toFixed(0)} vs Média real R$${trend.avg3m.toFixed(0)} (${deviation > 0 ? '+' : ''}${deviation.toFixed(0)}%)`;
            if (deviation < -20) summaryText += ` → PROJEÇÃO SUBESTIMADA`;
            if (deviation > 20) summaryText += ` → PROJEÇÃO SUPERESTIMADA`;
            summaryText += `\n`;
          }
        }
      }

      // Check for categories with real spending but NO future projection
      summaryText += `\n═══ CATEGORIAS SEM PROJEÇÃO FUTURA ═══\n`;
      for (const cat of topCats) {
        if (!futureProjectedByCategory[cat.name] && cat.total > 0) {
          const trend = categoryTrends[cat.name];
          if (trend && trend.avg3m > 50) {
            summaryText += `- ${cat.name}: gasto médio R$${trend.avg3m.toFixed(0)}/mês mas SEM projeção futura. Risco de planejamento.\n`;
          }
        }
      }
    } else {
      summaryText += `Nenhuma projeção futura cadastrada no Planejador.\n`;
    }

    // Section 4: Anomaly detection
    summaryText += `\n═══ ANOMALIAS DETECTADAS ═══\n`;
    for (const cat of topCats) {
      const trend = categoryTrends[cat.name];
      if (!trend) continue;
      // Check for unusual spikes in last month vs avg
      const lastMonth = sortedMonths[sortedMonths.length - 1];
      const lastVal = cat.months[lastMonth] || 0;
      if (lastVal > trend.avg6m * 1.5 && lastVal > 100) {
        summaryText += `- PICO em ${cat.name}: R$${lastVal.toFixed(0)} no último mês vs média R$${trend.avg6m.toFixed(0)}\n`;
      }
      // Trend alerts
      if (trend.trend === "crescente" && trend.avg3m > 200) {
        summaryText += `- TENDÊNCIA CRESCENTE: ${cat.name} aumentando (3m: R$${trend.avg3m.toFixed(0)} vs 6m: R$${trend.avg6m.toFixed(0)})\n`;
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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um CFO pessoal digital com inteligência avançada em finanças pessoais. Você utiliza:
- Reconhecimento de padrões comportamentais (detectar hábitos recorrentes de gasto)
- Inteligência preditiva (antecipar desvios antes que aconteçam)
- Personalização profunda (cada análise é única para este usuário)
- Inteligência contextual (considerar sazonalidade, ciclos de vida, contexto brasileiro)

REGRAS DE ANÁLISE:

1. FOCO PRINCIPAL: Analise as PROJEÇÕES FUTURAS do Planejador comparando com os padrões REAIS aprendidos.
   - Se uma projeção futura está muito abaixo do gasto real médio, ALERTE que o planejamento está otimista demais.
   - Se uma projeção futura está muito acima, sugira que pode ser oportunidade de economia.
   - NÃO compare meses passados projetados vs realizados um a um — isso é irrelevante. Foque no FUTURO.

2. ALERTAS PREDITIVOS: Identifique problemas ANTES que aconteçam:
   - Meses futuros com resultado líquido negativo
   - Categorias com tendência crescente que comprometem o orçamento
   - Categorias com gasto real mas sem projeção (buracos no planejamento)

3. APRENDIZADO DE PADRÕES:
   - Identifique sazonalidades (ex: gastos maiores em dezembro, IPVA em janeiro)
   - Reconheça ciclos (ex: despesas crescendo mês a mês)
   - Detecte anomalias (picos incomuns vs comportamento habitual)

4. SUGESTÕES ACIONÁVEIS E PERSONALIZADAS:
   - Baseie sugestões nos dados REAIS do usuário, não em conselhos genéricos
   - Se o usuário gasta X em uma categoria, sugira redução para Y com base no padrão
   - Dê sugestões de ajuste do Planejador quando as projeções não refletem a realidade

5. NÃO faça comparações retroativas detalhadas entre projetado e realizado de meses que já passaram.

Responda APENAS com JSON válido, sem markdown:
{
  "insights": ["3-5 análises profundas sobre padrões, tendências e comportamento financeiro"],
  "alerts": ["1-5 alertas preditivos focando em riscos futuros e desvios no planejamento"],
  "suggestions": ["3-5 sugestões personalizadas e acionáveis baseadas nos padrões do usuário"],
  "forecast": {
    "summary": "previsão contextualizada para os próximos meses",
    "projected_savings": 0,
    "trend": "positiva|negativa|estável",
    "details": ["detalhes da previsão"]
  }
}

Use R$ e percentuais. Seja específico com nomes de categorias e valores. Tom profissional mas motivador.`,
          },
          { role: "user", content: summaryText },
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
        return new Response(JSON.stringify({ error: "Créditos insuficientes para análise de IA." }), {
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
