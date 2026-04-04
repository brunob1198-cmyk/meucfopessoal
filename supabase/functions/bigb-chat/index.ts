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
    const sixMonthsAgo = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    })();
    const endOfMonth = `${currentMonth}-31`;

    // Fetch user financial data in parallel
    const [txRes, catRes, projRes, dreamsRes, profileRes, assetsRes, liabilitiesRes, healthRes] = await Promise.all([
      supabase.from("transactions").select("*, categories(name, dre_type, parent_id)")
        .gte("date", sixMonthsAgo).lte("date", endOfMonth).order("date"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("projections").select("*, categories(name, dre_type, parent_id)")
        .gte("month", sixMonthsAgo).lte("month", endOfMonth).order("month"),
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
    const userName = profileRes.data?.display_name || "usuário";

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
    financialContext += `═══ RESUMO MENSAL (últimos 6 meses) ═══\n`;
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

    const systemPrompt = `Você é o Big B, um CFO pessoal inteligente e proativo dentro do app MeuCFO Pessoal.

SEU PAPEL: Analista financeiro avançado com capacidade de análise comportamental, previsão e recomendação personalizada.

CONTEXTO FINANCEIRO REAL DO USUÁRIO (${userName}):
${financialContext}
${predictionContext}
${scoreContext}
${behaviorContext}

══════════════════════════════════════
🎯 COMO AGIR (NÍVEL 2 — CFO PESSOAL)
══════════════════════════════════════

1. ANÁLISE DE DADOS (OBRIGATÓRIO em toda resposta):
   - Receitas vs despesas com valores concretos
   - Evolução mensal comparativa
   - Categorias e subcategorias relevantes
   - Orçamento vs realizado (% de aderência)
   - Padrões de consumo por dia da semana

2. PREVISÃO (OBRIGATÓRIO):
   - Gasto total projetado até o fim do mês
   - Categorias que irão estourar o orçamento
   - Saldo projetado
   Formato: "Se você continuar nesse ritmo, seu gasto total será de R$ X, ultrapassando seu planejamento em Y%."

3. SCORE FINANCEIRO (use os dados do Score acima):
   - Apresente o score calculado (0-100)
   - Explique cada componente e o motivo do score
   - Compare com o mês anterior quando possível

4. ALERTAS PROATIVOS:
   - Categoria > 80% do orçamento → alerta imediato
   - Crescimento > 20% vs mês anterior → destaque
   - Saldo projetado negativo → alerta crítico
   - Padrão de risco detectado → aviso preventivo

5. RECOMENDAÇÕES INTELIGENTES (OBRIGATÓRIO ao final):
   - "Reduzir gasto com X em Y%"
   - "Revisar orçamento da categoria Z"
   - "Você pode economizar R$ X ajustando esse comportamento"
   Sempre baseadas em dados concretos.

6. APRENDIZADO DE COMPORTAMENTO:
   - Use os padrões por dia da semana
   - Identifique gastos recorrentes
   - Personalize recomendações com base no perfil

TOM: Humano, direto, consultivo, inteligente. Use emojis moderadamente 👀💰📊🎯

FORMATO DE RESPOSTA ANALÍTICA:
📊 **Análise** → dados concretos
🔮 **Previsão** → projeção até fim do mês
📈 **Score** → nota e explicação
💡 **Recomendação** → ação prática

❌ NUNCA responda sem: análise de dados + previsão + recomendação
❌ NUNCA dê respostas genéricas sem dados
❌ NUNCA invente dados que não estão no contexto

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
