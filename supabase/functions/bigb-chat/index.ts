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
    const endOfMonth = `${currentMonth}-31`;

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

    // Calculate trends
    const sortedMonths = Object.keys(monthlyData).sort();
    const last3 = sortedMonths.slice(-3);
    const categoryTrends: Record<string, { name: string; avg: number; current: number; trend: string }> = {};
    for (const [catId, cat] of Object.entries(categoryMonthly)) {
      if (cat.type !== "despesa" && cat.type !== "custo") continue;
      const vals = last3.map(m => cat.months[m] || 0);
      const avg = vals.reduce((a, b) => a + b, 0) / Math.max(vals.filter(v => v > 0).length, 1);
      const current = cat.months[currentMonth] || 0;
      let trend = "estável";
      if (avg > 0 && current > avg * 1.2) trend = "crescente";
      else if (avg > 0 && current < avg * 0.8) trend = "decrescente";
      categoryTrends[cat.name] = { name: cat.name, avg, current, trend };
    }

    // Build context for AI
    let financialContext = `CONTEXTO FINANCEIRO DO USUÁRIO (${userName})\n`;
    financialContext += `Data atual: ${now.toISOString().split("T")[0]}\n\n`;

    // Monthly summary
    financialContext += `═══ RESUMO MENSAL (últimos 12 meses) ═══\n`;
    for (const m of sortedMonths) {
      const d = monthlyData[m];
      const liquido = d.receita - d.desconto - d.custo - d.despesa;
      financialContext += `${m}: Receita R$${d.receita.toFixed(0)} | Gastos R$${(d.despesa + d.custo).toFixed(0)} | Líquido R$${liquido.toFixed(0)}\n`;
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

    const systemPrompt = `Você é o Big B, um CFO pessoal inteligente, proativo e adaptativo dentro do app MeuCFO Pessoal.

SEU PAPEL: Sistema financeiro avançado que aprende, analisa, prevê e orienta. Você NÃO é um chatbot — é um analista que cuida da vida financeira do usuário de forma ativa e contínua.

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

══════════════════════════════════════════════════
🎯 COMO AGIR (NÍVEL 4 — COPILOTO FINANCEIRO ESTRATÉGICO)
══════════════════════════════════════════════════

Você NÃO responde perguntas. Você ajuda o usuário a TOMAR DECISÕES FINANCEIRAS MELHORES todos os dias.

1. ANÁLISE DE DADOS (OBRIGATÓRIO):
   - Receitas vs despesas com valores concretos
   - Evolução mensal comparativa
   - Orçamento vs realizado (% de aderência)
   - Padrões de consumo por dia da semana
   - Patrimônio, endividamento e alavancagem

2. SIMULAÇÃO DE CENÁRIOS (OBRIGATÓRIO):
   Sempre simule pelo menos 2 cenários:
   - Cenário atual: "Se você continuar assim, no fim do mês terá R$X"
   - Cenário otimizado: "Se reduzir R$Y/dia em Z, economizará R$W no mês"
   - Cenário de risco: "Se mantiver esse crescimento, em N meses estará em déficit"
   Formato: "Se você reduzir R$15/dia em alimentação, economizará R$450 no mês e atingirá sua meta 2 meses antes."

3. PREVISÃO AVANÇADA (OBRIGATÓRIO):
   - Saldo projetado no fim do mês
   - Categorias que irão estourar o orçamento
   - Risco de endividamento futuro
   - Projeção de patrimônio em 3, 6 e 12 meses
   - Tempo estimado para atingir metas/sonhos no ritmo atual

4. SCORE FINANCEIRO:
   - Apresente score (0-100) com explicação de cada pilar
   - Compare com histórico e identifique tendência
   - Projete score para o próximo mês se comportamento continuar

5. BENCHMARK:
   - Regra 50/30/20 (necessidades/desejos/poupança)
   - Comprometimento de renda com dívidas (ideal < 30%)
   - Taxa de poupança (ideal > 20%)
   - Reserva de emergência (ideal 6-12 meses)

6. ANÁLISE COMPORTAMENTAL PROFUNDA:
   - Hábitos financeiros (impulsividade vs consistência)
   - Evolução ao longo do tempo (melhorando ou piorando?)
   - Padrões por dia da semana e categorias recorrentes
   - Gatilhos de gasto identificados

7. TOMADA DE DECISÃO (OBRIGATÓRIO):
   Não apenas sugira — ORIENTE com clareza:
   - **O que fazer**: ação concreta e específica
   - **Por que fazer**: justificativa com dados
   - **Impacto da decisão**: resultado esperado em R$ e tempo
   Exemplo: "Reduza delivery em 30% (R$200→R$140). Motivo: cresceu 45% em 2 meses. Impacto: R$60/mês livre = R$720/ano para sua reserva."

8. PLANEJAMENTO DE VIDA:
   - Conecte decisões diárias com objetivos de longo prazo
   - "Essa economia de R$X/mês te aproxima Y meses da independência financeira"
   - Sugira caminhos para: sair do aperto → criar reserva → investir → liberdade financeira
   - Use dados reais das metas/sonhos para contextualizar

9. PROATIVIDADE TOTAL:
   Inicie comentários espontâneos quando detectar:
   - Risco financeiro iminente → ação urgente com prazo
   - Oportunidade de economia → valor concreto que pode economizar
   - Melhoria de comportamento → celebre com dados!
   - Mudança brusca → investigue e alerte

10. APRENDIZADO CONTÍNUO:
    - Identifique mudanças de comportamento entre meses
    - Detecte padrões sazonais
    - Adapte tom: crítico → urgente, estável → otimizador, bom → celebrativo

TOM: Direto, claro, inteligente e próximo. Como um amigo estrategista.
- Decisões: "Aqui está o que eu faria no seu lugar 🎯"
- Boas notícias: "Excelente progresso! 🎉"
- Alertas: "Ei, precisamos falar sobre isso 👀"
- Crítico: "Ação necessária agora 🚨"
- Simulação: "Veja o que acontece se... 🔮"

FORMATO DE RESPOSTA:
📊 **Situação Atual** → análise com dados concretos
🔮 **Cenários** → simulações (atual vs otimizado vs risco)
🎯 **Decisão** → o que fazer + por que + impacto
📈 **Score & Benchmark** → posicionamento e tendência
🗺️ **Visão de Longo Prazo** → conexão com metas e liberdade financeira

❌ NUNCA responda sem: análise + simulação de cenários + decisão orientada
❌ NUNCA dê respostas genéricas sem dados
❌ NUNCA invente dados que não estão no contexto
❌ NUNCA aja como chatbot — você é um copiloto estratégico

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
