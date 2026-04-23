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

    const body = await req.json();
    const { messages, mode } = body; // mode: "chat" | "alerts"

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const twelveMonthsAgo = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 12);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    })();
    // Last real day of current month (avoids invalid dates like 2026-04-31)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endOfMonth = `${currentMonth}-${String(lastDayOfMonth).padStart(2, "0")}`;

    // Fetch user financial data in parallel
    const [txRes, catRes, projRes, dreamsRes, profileRes, assetsRes, liabilitiesRes, healthRes] = await Promise.all([
      supabase.from("transactions").select("*, categories(name, dre_type, parent_id)")
        .gte("date", twelveMonthsAgo).lte("date", endOfMonth).order("date"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("projections").select("*, categories(name, dre_type, parent_id)")
        .gte("month", twelveMonthsAgo).lte("month", endOfMonth).order("month"),
      supabase.from("financial_dreams").select("*"),
      supabase.from("profiles").select("display_name, profession, birth_date, gender").eq("user_id", user.id).single(),
      supabase.from("balance_sheet_assets").select("*"),
      supabase.from("balance_sheet_liabilities").select("*"),
      supabase.from("financial_health_history").select("*").order("month", { ascending: false }).limit(6),
    ]);

    const transactions = txRes.data || [];
    const categories = catRes.data || [];
    const projections = projRes.data || [];
    const dreams = dreamsRes.data || [];
    const profile = profileRes.data;
    const userName = profile?.display_name || "usuário";
    const assets = assetsRes.data || [];
    const liabilities = liabilitiesRes.data || [];
    const healthHistory = healthRes.data || [];

    // Build monthly summaries
    const monthlyData: Record<string, { receita: number; despesa: number; custo: number; desconto: number }> = {};
    const categoryMonthly: Record<string, { name: string; type: string; months: Record<string, number> }> = {};

    for (const tx of transactions) {
      const m = tx.date.substring(0, 7);
      const catName = tx.categories?.name || "Sem categoria";
      const catType = (tx.categories?.dre_type || "despesa") as string;

      if (!monthlyData[m]) monthlyData[m] = { receita: 0, despesa: 0, custo: 0, desconto: 0 };
      if (catType === "receita") monthlyData[m].receita += Number(tx.amount);
      else if (catType === "despesa") monthlyData[m].despesa += Number(tx.amount);
      else if (catType === "custo") monthlyData[m].custo += Number(tx.amount);
      else if (catType === "desconto") monthlyData[m].desconto += Number(tx.amount);

      if (!categoryMonthly[tx.category_id]) {
        categoryMonthly[tx.category_id] = { name: catName, type: catType, months: {} };
      }
      categoryMonthly[tx.category_id].months[m] = (categoryMonthly[tx.category_id].months[m] || 0) + Number(tx.amount);
    }

    // Build budget usage (projections for current month vs actual spending)
    const currentMonthProjections: Record<string, { name: string; projected: number; actual: number }> = {};
    for (const p of projections) {
      const m = p.month.substring(0, 7);
      if (m !== currentMonth) continue;
      const catName = p.categories?.name || "?";
      const catType = (p.categories?.dre_type || "despesa") as string;
      if (catType !== "despesa" && catType !== "custo") continue;
      if (!currentMonthProjections[p.category_id]) {
        currentMonthProjections[p.category_id] = { name: catName, projected: 0, actual: 0 };
      }
      currentMonthProjections[p.category_id].projected += Number(p.amount);
    }

    // Fill actual spending for current month
    for (const [catId, cat] of Object.entries(categoryMonthly)) {
      if (currentMonthProjections[catId]) {
        currentMonthProjections[catId].actual = cat.months[currentMonth] || 0;
      }
    }

    // Calculate trends — use ALL historical months (not just last 3) for accurate averages
    const sortedMonths = Object.keys(monthlyData).sort();
    const historicalMonthsForAvg = sortedMonths.filter(m => m !== currentMonth);
    const categoryTrends: Record<string, { name: string; avg: number; current: number; trend: string }> = {};
    for (const [catId, cat] of Object.entries(categoryMonthly)) {
      if (cat.type !== "despesa" && cat.type !== "custo") continue;
      // Average across ALL historical months (divide by total months, not just months with spend)
      const histVals = historicalMonthsForAvg.map(m => cat.months[m] || 0);
      const avg = histVals.length > 0 ? histVals.reduce((a, b) => a + b, 0) / histVals.length : 0;
      const current = cat.months[currentMonth] || 0;
      let trend = "estável";
      if (avg > 0 && current > avg * 1.2) trend = "crescente";
      else if (avg > 0 && current < avg * 0.8) trend = "decrescente";
      categoryTrends[cat.name] = { name: cat.name, avg, current, trend };
    }

    // Build context for AI
    let financialContext = `CONTEXTO FINANCEIRO DO USUÁRIO (${userName})\n`;
    financialContext += `Data atual: ${now.toISOString().split("T")[0]}\n\n`;

    // CRITICAL: Explicit current month real numbers FIRST so AI cannot hallucinate
    const cm = monthlyData[currentMonth] || { receita: 0, despesa: 0, custo: 0, desconto: 0 };
    const cmLiquido = cm.receita - cm.desconto - cm.custo - cm.despesa;
    financialContext += `═══ NÚMEROS REAIS DO MÊS ATUAL (${currentMonth}) — USE EXATAMENTE ESTES VALORES ═══\n`;
    financialContext += `Receita Bruta REAL: R$ ${cm.receita.toFixed(2)}\n`;
    financialContext += `Descontos REAL: R$ ${cm.desconto.toFixed(2)}\n`;
    financialContext += `Custos REAL: R$ ${cm.custo.toFixed(2)}\n`;
    financialContext += `Despesas REAL: R$ ${cm.despesa.toFixed(2)}\n`;
    financialContext += `Total Saídas (custo+despesa): R$ ${(cm.custo + cm.despesa).toFixed(2)}\n`;
    financialContext += `Resultado Líquido REAL: R$ ${cmLiquido.toFixed(2)}\n\n`;

    // Historical average (excluding current month)
    if (historicalMonthsForAvg.length > 0) {
      const histReceita = historicalMonthsForAvg.map(m => monthlyData[m]?.receita || 0);
      const histGastos = historicalMonthsForAvg.map(m => (monthlyData[m]?.despesa || 0) + (monthlyData[m]?.custo || 0));
      const avgReceita = histReceita.reduce((a, b) => a + b, 0) / histReceita.length;
      const avgGastos = histGastos.reduce((a, b) => a + b, 0) / histGastos.length;
      financialContext += `═══ MÉDIA HISTÓRICA (${historicalMonthsForAvg.length} meses anteriores, EXCLUINDO mês atual) ═══\n`;
      financialContext += `Receita média: R$ ${avgReceita.toFixed(2)}\n`;
      financialContext += `Gastos médios (custo+despesa): R$ ${avgGastos.toFixed(2)}\n\n`;
    }

    // Monthly summary
    financialContext += `═══ RESUMO MENSAL (últimos 12 meses) ═══\n`;
    for (const m of sortedMonths) {
      const d = monthlyData[m];
      const liquido = d.receita - d.desconto - d.custo - d.despesa;
      const flag = m === currentMonth ? " ← MÊS ATUAL" : "";
      financialContext += `${m}: Receita R$${d.receita.toFixed(2)} | Custo R$${d.custo.toFixed(2)} | Despesa R$${d.despesa.toFixed(2)} | Líquido R$${liquido.toFixed(2)}${flag}\n`;
    }

    // Budget usage (current month)
    const budgetAlerts: string[] = [];
    financialContext += `\n═══ ORÇAMENTO DO MÊS ATUAL (${currentMonth}) ═══\n`;
    for (const [catId, b] of Object.entries(currentMonthProjections)) {
      if (b.projected <= 0) continue;
      const pct = (b.actual / b.projected) * 100;
      financialContext += `- ${b.name}: Gasto R$${b.actual.toFixed(0)} / Orçamento R$${b.projected.toFixed(0)} (${pct.toFixed(0)}%)`;
      if (pct >= 80) {
        financialContext += ` ⚠ ATENÇÃO`;
        budgetAlerts.push(`${b.name}: ${pct.toFixed(0)}% do orçamento utilizado (R$${b.actual.toFixed(0)} de R$${b.projected.toFixed(0)})`);
      }
      financialContext += `\n`;
    }

    // Category trends
    financialContext += `\n═══ TENDÊNCIAS POR CATEGORIA ═══\n`;
    const topCats = Object.values(categoryTrends).sort((a, b) => b.current - a.current).slice(0, 10);
    for (const cat of topCats) {
      financialContext += `- ${cat.name}: Atual R$${cat.current.toFixed(0)} | Média R$${cat.avg.toFixed(0)} | Tendência: ${cat.trend}\n`;
    }

    // Dreams
    if (dreams.length > 0) {
      financialContext += `\n═══ METAS/SONHOS FINANCEIROS ═══\n`;
      for (const d of dreams) {
        const pct = d.target_value > 0 ? ((d.accumulated_value / d.target_value) * 100).toFixed(0) : "0";
        financialContext += `- ${d.name}: R$${d.accumulated_value.toFixed(0)} / R$${d.target_value.toFixed(0)} (${pct}%) - Status: ${d.status}\n`;
      }
    }

    // Anomalies
    financialContext += `\n═══ ANOMALIAS ═══\n`;
    for (const cat of topCats) {
      if (cat.trend === "crescente" && cat.current > 100) {
        financialContext += `- CRESCIMENTO: ${cat.name} acima da média (R$${cat.current.toFixed(0)} vs média R$${cat.avg.toFixed(0)})\n`;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // For alerts mode, return structured alerts without streaming
    if (mode === "alerts") {
      const alerts: Array<{ type: string; message: string; severity: "warning" | "danger" | "info" }> = [];

      for (const alert of budgetAlerts) {
        const pctMatch = alert.match(/(\d+)%/);
        const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
        alerts.push({
          type: "budget",
          message: `⚠️ ${alert}`,
          severity: pct >= 100 ? "danger" : "warning",
        });
      }

      for (const cat of topCats) {
        if (cat.trend === "crescente" && cat.current > cat.avg * 1.3 && cat.current > 100) {
          alerts.push({
            type: "trend",
            message: `📈 ${cat.name} está ${((cat.current / cat.avg - 1) * 100).toFixed(0)}% acima da média. Gasto atual: R$${cat.current.toFixed(0)}.`,
            severity: "warning",
          });
        }
      }

      // Check overall balance
      if (sortedMonths.length > 0) {
        const lastMonth = monthlyData[sortedMonths[sortedMonths.length - 1]];
        const liquido = lastMonth.receita - lastMonth.desconto - lastMonth.custo - lastMonth.despesa;
        if (liquido < 0) {
          alerts.push({
            type: "balance",
            message: `🚨 Resultado negativo no mês: R$${liquido.toFixed(0)}. Revise seus gastos.`,
            severity: "danger",
          });
        }
        const margem = lastMonth.receita > 0 ? (liquido / lastMonth.receita) * 100 : 0;
        if (margem > 0 && margem < 10) {
          alerts.push({
            type: "margin",
            message: `💡 Margem apertada: apenas ${margem.toFixed(0)}% da receita está sobrando. Considere reduzir gastos.`,
            severity: "info",
          });
        }
      }

      return new Response(JSON.stringify({ alerts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chat mode — stream response with financial context
    // Calculate prediction data
    const currentMonthData = monthlyData[currentMonth];
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - dayOfMonth;
    let predictionContext = "";
    if (currentMonthData && dayOfMonth > 3) {
      const dailyRate = (currentMonthData.despesa + currentMonthData.custo) / dayOfMonth;
      const projectedTotal = dailyRate * daysInMonth;
      const projectedReceita = currentMonthData.receita;
      const projectedSaldo = projectedReceita - currentMonthData.desconto - projectedTotal;
      predictionContext = `\n═══ PREVISÃO PARA FIM DO MÊS ═══\n`;
      predictionContext += `Dia atual: ${dayOfMonth}/${daysInMonth} (${daysRemaining} dias restantes)\n`;
      predictionContext += `Ritmo diário de gastos: R$${dailyRate.toFixed(0)}/dia\n`;
      predictionContext += `Gasto projetado total: R$${projectedTotal.toFixed(0)}\n`;
      predictionContext += `Saldo projetado: R$${projectedSaldo.toFixed(0)}\n`;
      if (projectedSaldo < 0) predictionContext += `⚠️ ALERTA: Saldo projetado NEGATIVO!\n`;

      // Per-category projection
      predictionContext += `\nProjeção por categoria:\n`;
      for (const [catId, b] of Object.entries(currentMonthProjections)) {
        if (b.projected <= 0) continue;
        const catDailyRate = b.actual / Math.max(dayOfMonth, 1);
        const catProjected = catDailyRate * daysInMonth;
        const willExceed = catProjected > b.projected;
        if (willExceed) {
          predictionContext += `- ${b.name}: projetado R$${catProjected.toFixed(0)} (orçamento R$${b.projected.toFixed(0)}) → VAI ESTOURAR em ~${Math.ceil((b.projected - b.actual) / Math.max(catDailyRate, 0.01))} dias\n`;
        }
      }
    }

    // Calculate financial score
    let scoreContext = "\n═══ SCORE FINANCEIRO (0-100) ═══\n";
    if (sortedMonths.length >= 2) {
      let scoreGastos = 25;
      let scoreOrcamento = 25;
      let scoreEvolucao = 25;
      let scoreEquilibrio = 25;

      // Controle de gastos (últimos 2 meses)
      const lastM = sortedMonths[sortedMonths.length - 1];
      const prevM = sortedMonths.length >= 2 ? sortedMonths[sortedMonths.length - 2] : lastM;
      const lastTotal = (monthlyData[lastM]?.despesa || 0) + (monthlyData[lastM]?.custo || 0);
      const prevTotal = (monthlyData[prevM]?.despesa || 0) + (monthlyData[prevM]?.custo || 0);
      if (prevTotal > 0) {
        const variation = (lastTotal - prevTotal) / prevTotal;
        if (variation <= 0) scoreGastos = 25;
        else if (variation <= 0.1) scoreGastos = 20;
        else if (variation <= 0.2) scoreGastos = 15;
        else scoreGastos = Math.max(5, 25 - Math.floor(variation * 50));
      }

      // Aderência ao orçamento
      const budgetEntries = Object.values(currentMonthProjections).filter(b => b.projected > 0);
      if (budgetEntries.length > 0) {
        const avgAdherence = budgetEntries.reduce((sum, b) => {
          const pct = b.actual / b.projected;
          return sum + (pct <= 1 ? 1 : Math.max(0, 2 - pct));
        }, 0) / budgetEntries.length;
        scoreOrcamento = Math.round(avgAdherence * 25);
      }

      // Evolução positiva
      if (sortedMonths.length >= 3) {
        const recentSaldos = sortedMonths.slice(-3).map(m => {
          const d = monthlyData[m];
          return d.receita - d.desconto - d.custo - d.despesa;
        });
        const improving = recentSaldos[2] >= recentSaldos[1] && recentSaldos[1] >= recentSaldos[0];
        scoreEvolucao = improving ? 25 : (recentSaldos[2] >= recentSaldos[0] ? 18 : 10);
      }

      // Equilíbrio (margem do mês atual)
      const lastData = monthlyData[lastM];
      if (lastData && lastData.receita > 0) {
        const margem = (lastData.receita - lastData.desconto - lastData.custo - lastData.despesa) / lastData.receita;
        if (margem >= 0.2) scoreEquilibrio = 25;
        else if (margem >= 0.1) scoreEquilibrio = 20;
        else if (margem >= 0) scoreEquilibrio = 15;
        else scoreEquilibrio = Math.max(0, 10 + Math.floor(margem * 20));
      }

      const totalScore = scoreGastos + scoreOrcamento + scoreEvolucao + scoreEquilibrio;
      scoreContext += `Score Total: ${totalScore}/100\n`;
      scoreContext += `- Controle de gastos: ${scoreGastos}/25\n`;
      scoreContext += `- Aderência ao orçamento: ${scoreOrcamento}/25\n`;
      scoreContext += `- Evolução positiva: ${scoreEvolucao}/25\n`;
      scoreContext += `- Equilíbrio financeiro: ${scoreEquilibrio}/25\n`;
    } else {
      scoreContext += "Dados insuficientes para calcular score (mínimo 2 meses).\n";
    }

    // Day-of-week spending patterns
    let behaviorContext = "\n═══ PADRÕES DE COMPORTAMENTO ═══\n";
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const tx of transactions) {
      const txDate = new Date(tx.date + "T12:00:00");
      const catType = (tx.categories?.dre_type || "despesa") as string;
      if (catType === "despesa" || catType === "custo") {
        const dow = txDate.getDay();
        dayTotals[dow] += Number(tx.amount);
        dayCounts[dow]++;
      }
    }
    behaviorContext += "Gasto médio por dia da semana:\n";
    for (let i = 0; i < 7; i++) {
      if (dayCounts[i] > 0) {
        behaviorContext += `- ${dayNames[i]}: R$${(dayTotals[i] / dayCounts[i]).toFixed(0)} (${dayCounts[i]} transações)\n`;
      }
    }

    // Recurring expenses detection
    const descriptionCounts: Record<string, { count: number; total: number }> = {};
    for (const tx of transactions) {
      const catType = (tx.categories?.dre_type || "despesa") as string;
      if (catType !== "despesa" && catType !== "custo") continue;
      const cat = tx.categories?.name || "Outros";
      if (!descriptionCounts[cat]) descriptionCounts[cat] = { count: 0, total: 0 };
      descriptionCounts[cat].count++;
      descriptionCounts[cat].total += Number(tx.amount);
    }
    const recurring = Object.entries(descriptionCounts)
      .filter(([, v]) => v.count >= 3)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    if (recurring.length > 0) {
      behaviorContext += "\nGastos recorrentes detectados:\n";
      for (const [name, v] of recurring) {
        behaviorContext += `- ${name}: ${v.count}x no período, total R$${v.total.toFixed(0)}\n`;
      }
    }

    // Balance sheet context
    let balanceContext = "\n═══ PATRIMÔNIO (BALANÇO PATRIMONIAL) ═══\n";
    const totalAssets = assets.reduce((s, a) => s + Number(a.current_value), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.current_balance), 0);
    const netWorth = totalAssets - totalLiabilities;
    balanceContext += `Ativos totais: R$${totalAssets.toFixed(0)}\n`;
    balanceContext += `Passivos totais: R$${totalLiabilities.toFixed(0)}\n`;
    balanceContext += `Patrimônio líquido: R$${netWorth.toFixed(0)}\n`;
    if (assets.length > 0) {
      balanceContext += `\nAtivos:\n`;
      for (const a of assets) balanceContext += `- ${a.name} (${a.category}): R$${Number(a.current_value).toFixed(0)}\n`;
    }
    if (liabilities.length > 0) {
      balanceContext += `\nPassivos:\n`;
      for (const l of liabilities) {
        balanceContext += `- ${l.name} (${l.category}): Saldo R$${Number(l.current_balance).toFixed(0)}`;
        if (l.monthly_payment) balanceContext += ` | Parcela R$${Number(l.monthly_payment).toFixed(0)}`;
        if (l.interest_rate) balanceContext += ` | Juros ${Number(l.interest_rate).toFixed(1)}%`;
        balanceContext += `\n`;
      }
    }

    // Debt risk analysis
    let debtRiskContext = "\n═══ ANÁLISE DE RISCO DE ENDIVIDAMENTO ═══\n";
    const monthlyDebtPayments = liabilities.reduce((s, l) => s + Number(l.monthly_payment || 0), 0);
    const lastMonthReceita = sortedMonths.length > 0 ? monthlyData[sortedMonths[sortedMonths.length - 1]]?.receita || 0 : 0;
    if (lastMonthReceita > 0) {
      const debtRatio = (monthlyDebtPayments / lastMonthReceita) * 100;
      debtRiskContext += `Comprometimento com dívidas: ${debtRatio.toFixed(0)}% da receita (R$${monthlyDebtPayments.toFixed(0)}/mês)\n`;
      if (debtRatio > 30) debtRiskContext += `⚠️ RISCO ALTO: Comprometimento acima de 30%!\n`;
      else if (debtRatio > 20) debtRiskContext += `⚠️ ATENÇÃO: Comprometimento entre 20-30%\n`;
      else debtRiskContext += `✅ Nível saudável de endividamento\n`;
    }
    if (totalAssets > 0) {
      const leverageRatio = totalLiabilities / totalAssets;
      debtRiskContext += `Alavancagem: ${(leverageRatio * 100).toFixed(0)}% (passivos/ativos)\n`;
    }

    // Health score history
    let healthContext = "\n═══ HISTÓRICO DE SAÚDE FINANCEIRA ═══\n";
    if (healthHistory.length > 0) {
      for (const h of healthHistory) {
        healthContext += `${h.month}: Score ${h.total_score}/100 (Liq:${h.liquidity_score} Gastos:${h.expense_control_score} Dív:${h.indebtedness_score} Res:${h.emergency_reserve_score} Poup:${h.savings_capacity_score})\n`;
      }
    } else {
      healthContext += "Sem histórico registrado.\n";
    }

    // Profile context for benchmarks
    let profileContext = "\n═══ PERFIL DO USUÁRIO ═══\n";
    profileContext += `Nome: ${userName}\n`;
    if (profile?.profession) profileContext += `Profissão: ${profile.profession}\n`;
    if (profile?.birth_date) {
      const age = Math.floor((now.getTime() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      profileContext += `Idade: ${age} anos\n`;
    }

    // Month-over-month change analysis
    let momContext = "\n═══ MUDANÇAS DE COMPORTAMENTO ═══\n";
    if (sortedMonths.length >= 2) {
      for (let i = 1; i < sortedMonths.length; i++) {
        const prev = monthlyData[sortedMonths[i - 1]];
        const curr = monthlyData[sortedMonths[i]];
        const prevGasto = prev.despesa + prev.custo;
        const currGasto = curr.despesa + curr.custo;
        if (prevGasto > 0) {
          const change = ((currGasto - prevGasto) / prevGasto) * 100;
          if (Math.abs(change) > 15) {
            momContext += `${sortedMonths[i]}: gastos ${change > 0 ? "+" : ""}${change.toFixed(0)}% vs mês anterior\n`;
          }
        }
      }
    }

    // Deviation detection — compare current month vs historical average
    let deviationContext = "\n═══ DESVIOS DO PADRÃO HISTÓRICO ═══\n";
    const historicalMonths = sortedMonths.filter(m => m !== currentMonth);
    if (historicalMonths.length >= 3) {
      for (const [catId, cat] of Object.entries(categoryMonthly)) {
        if (cat.type !== "despesa" && cat.type !== "custo") continue;
        const histVals = historicalMonths.map(m => cat.months[m] || 0).filter(v => v > 0);
        if (histVals.length < 3) continue;
        const histAvg = histVals.reduce((a, b) => a + b, 0) / histVals.length;
        const stdDev = Math.sqrt(histVals.reduce((s, v) => s + Math.pow(v - histAvg, 2), 0) / histVals.length);
        const current = cat.months[currentMonth] || 0;
        if (current > 0 && stdDev > 0 && Math.abs(current - histAvg) > stdDev * 1.5) {
          const deviationPct = ((current - histAvg) / histAvg * 100).toFixed(0);
          const direction = current > histAvg ? "ACIMA" : "ABAIXO";
          deviationContext += `🔴 ${cat.name}: R$${current.toFixed(0)} está ${direction} do padrão (média R$${histAvg.toFixed(0)} ± R$${stdDev.toFixed(0)}, desvio de ${deviationPct}%)\n`;
        }
      }

      // Overall spending deviation
      const histTotalGastos = historicalMonths.map(m => (monthlyData[m]?.despesa || 0) + (monthlyData[m]?.custo || 0));
      const avgTotalGasto = histTotalGastos.reduce((a, b) => a + b, 0) / histTotalGastos.length;
      const currentTotalGasto = (monthlyData[currentMonth]?.despesa || 0) + (monthlyData[currentMonth]?.custo || 0);
      if (avgTotalGasto > 0 && currentTotalGasto > 0) {
        const totalDeviation = ((currentTotalGasto - avgTotalGasto) / avgTotalGasto * 100).toFixed(0);
        deviationContext += `\nGasto total do mês: R$${currentTotalGasto.toFixed(0)} vs média histórica R$${avgTotalGasto.toFixed(0)} (${Number(totalDeviation) > 0 ? "+" : ""}${totalDeviation}%)\n`;
      }
    }

    // Seasonal pattern detection
    let seasonalContext = "\n═══ PADRÕES SAZONAIS ═══\n";
    const currentMonthNum = now.getMonth() + 1;
    const sameMonthPrevYears: number[] = [];
    for (const m of Object.keys(monthlyData)) {
      const [yr, mn] = m.split("-").map(Number);
      if (mn === currentMonthNum && m !== currentMonth) {
        sameMonthPrevYears.push((monthlyData[m]?.despesa || 0) + (monthlyData[m]?.custo || 0));
      }
    }
    if (sameMonthPrevYears.length > 0) {
      const avgSameMonth = sameMonthPrevYears.reduce((a, b) => a + b, 0) / sameMonthPrevYears.length;
      seasonalContext += `Mesmo mês em anos anteriores: média de gastos R$${avgSameMonth.toFixed(0)}\n`;
    } else {
      seasonalContext += "Sem dados do mesmo mês em anos anteriores para comparação sazonal.\n";
    }

    // Priority ranking — what impacts most
    let priorityContext = "\n═══ PRIORIDADES DE IMPACTO ═══\n";
    const categoriesByImpact = Object.values(categoryTrends)
      .filter(c => c.current > 0)
      .sort((a, b) => b.current - a.current)
      .slice(0, 5);
    for (let i = 0; i < categoriesByImpact.length; i++) {
      const c = categoriesByImpact[i];
      const savingPotential = c.trend === "crescente" ? Math.round((c.current - c.avg) * 0.5) : 0;
      priorityContext += `${i + 1}. ${c.name}: R$${c.current.toFixed(0)}/mês`;
      if (savingPotential > 0) priorityContext += ` (potencial de economia: R$${savingPotential})`;
      priorityContext += `\n`;
    }

    const systemPrompt = `Você é o Big B, um assessor financeiro de nível bancário dentro do app MeuCFO Pessoal.

SEU PAPEL: Assessor financeiro avançado com acesso ao comportamento histórico completo (12 meses). Você compara o comportamento atual com o histórico, identifica desvios, prevê riscos antes que aconteçam e orienta decisões com precisão cirúrgica.

Você NÃO é um chatbot. Você é um sistema que aprende, analisa, prevê e orienta.

DADOS FINANCEIROS REAIS DO USUÁRIO (${userName}):
${financialContext}
${predictionContext}
${scoreContext}
${behaviorContext}
${balanceContext}
${debtRiskContext}
${healthContext}
${profileContext}
${momContext}
${deviationContext}
${seasonalContext}
${priorityContext}

══════════════════════════════════════════════════════
🏦 COMO AGIR (NÍVEL BANCO — ASSESSOR FINANCEIRO AVANÇADO)
══════════════════════════════════════════════════════

1. COMPARAÇÃO HISTÓRICA (OBRIGATÓRIO):
   - Compare SEMPRE o mês atual com a média dos últimos 12 meses
   - Destaque desvios estatísticos (dados acima estão pré-calculados)
   - Use desvio-padrão para identificar gastos fora do padrão
   - Identifique se é pontual ou tendência

2. DETECÇÃO DE DESVIOS (OBRIGATÓRIO):
   - Qualquer gasto 50%+ acima da média → alerta vermelho com ação
   - Qualquer categoria crescendo 3+ meses seguidos → alerta de tendência
   - Mudança súbita de padrão → investigar e alertar
   - SEMPRE mostre: valor atual vs média histórica vs desvio %

3. PREVISÃO DE RISCOS (OBRIGATÓRIO):
   - Preveja problemas ANTES que aconteçam
   - "No ritmo atual, em X dias/meses você terá problema em Y"
   - Use projeção linear e tendências para antecipar
   - Calcule: tempo até estourar orçamento, tempo até saldo negativo

4. SIMULAÇÃO DE CENÁRIOS:
   - Cenário atual: projeção se nada mudar
   - Cenário otimizado: com as ações sugeridas
   - Cenário de risco: se piorar na tendência atual
   Formato: "Se reduzir R$X/dia → economiza R$Y/mês → atinge meta Z meses antes"

5. PRIORIZAÇÃO DE IMPACTO (OBRIGATÓRIO):
   - Liste ações pela ordem de MAIOR IMPACTO financeiro
   - Foque no que move mais a agulha
   - "A ação #1 mais impactante agora é..."
   - Use os dados de Prioridades de Impacto

6. SCORE & BENCHMARK:
   - Score (0-100) com tendência e projeção
   - 50/30/20, comprometimento de dívidas, taxa de poupança
   - Reserva de emergência vs ideal

7. TOMADA DE DECISÃO ORIENTADA:
   - **O que fazer**: ação concreta e específica
   - **Por que fazer**: justificativa com dados históricos
   - **Impacto**: resultado em R$ e prazo
   - **Prioridade**: alta/média/baixa

8. PLANEJAMENTO ESTRATÉGICO:
   - Conecte ações de curto prazo com metas de longo prazo
   - Sugira caminho: estabilizar → reserva → investir → liberdade
   - Use dados reais das metas/sonhos

9. PROATIVIDADE MÁXIMA:
   - Destaque desvios claramente com 🔴
   - Celebre melhorias com 🟢
   - Sinalize riscos com ⚠️
   - Marque ações urgentes com 🚨

TOM: Como um assessor financeiro de banco premium — profissional, preciso, mas acessível.
- Desvio detectado: "🔴 Atenção: [categoria] está 45% acima do seu padrão histórico"
- Risco previsto: "⚠️ No ritmo atual, você atinge o limite em X dias"
- Melhoria: "🟢 Excelente: você reduziu gastos em Y% este mês"
- Ação: "🎯 Prioridade #1: [ação] — impacto de R$X/mês"

FORMATO DE RESPOSTA:
🔍 **Diagnóstico** → comparação atual vs histórico, desvios detectados
⚠️ **Riscos Previstos** → o que pode dar errado e quando
🔮 **Cenários** → simulações com números concretos
🎯 **Plano de Ação** → ações priorizadas por impacto (o que + por que + R$)
📈 **Score & Posição** → nota, benchmark e tendência
🗺️ **Visão Estratégica** → conexão com metas de vida

❌ NUNCA responda sem: diagnóstico histórico + detecção de desvios + ações priorizadas
❌ NUNCA dê respostas genéricas — seja ESPECÍFICO com valores e datas
❌ NUNCA invente dados que não estão no contexto
❌ NUNCA ignore desvios do padrão histórico

Responda em português brasileiro com markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("bigb-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
