import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function fetchBCBHistory(code: number, count: number) {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${count}?formato=json`;
    const res = await fetch(url);
    const data = await res.json();
    return data.map((d: any) => ({ valor: Number(d.valor), data: d.data }));
  } catch {
    return [];
  }
}

async function fetchYahoo(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.quoteResponse?.result?.[0]?.regularMarketPrice || null;
  } catch {
    return null;
  }
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let economicData: any;

    // --------------------
    // CACHE (24h)
    // --------------------
    const { data: cached } = await supabase
      .from("economic_snapshots")
      .select("*")
      .gte("created_at", last24h.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      economicData = cached.data;
      console.log("[radar] Using cached economic data");
    } else {
      console.log("[radar] Fetching fresh economic data from BCB...");

      const [ipcaRaw, ipcaHistory, selicRaw, selicHistory, dolarRaw, igpmRaw, focusRaw, oil] = await Promise.all([
        fetchBCB(433),       // IPCA mensal
        fetchBCBHistory(433, 6), // IPCA últimos 6 meses
        fetchBCB(1178),      // Selic meta
        fetchBCBHistory(1178, 6), // Selic últimos 6 meses
        fetchBCB(1),         // Dólar PTAX
        fetchBCB(189),       // IGP-M
        fetchBCB(13522),     // Focus IPCA expectativa
        fetchYahoo("CL=F"),  // Petróleo WTI
      ]);

      // Compute IPCA acumulado 12m
      const ipcaAcumulado = ipcaHistory.length >= 12
        ? ipcaHistory.slice(-12).reduce((acc: number, v: any) => acc + v.valor, 0)
        : null;

      economicData = {
        ipca: ipcaRaw.valor,
        ipca_date: ipcaRaw.data,
        ipca_acumulado_12m: ipcaAcumulado,
        ipca_history: ipcaHistory.map((h: any) => `${h.data}: ${h.valor}%`).join(", "),

        selic: selicRaw.valor,
        selic_history: selicHistory.map((h: any) => `${h.data}: ${h.valor}%`).join(", "),

        dolar: dolarRaw.valor,
        igpm: igpmRaw.valor,
        focusInflation: focusRaw.valor,

        oil,
        fuelTrend: oil ? (oil > 80 ? "alta" : oil < 70 ? "queda" : "estável") : "indefinido",

        updated_at: now.toISOString(),
      };

      await supabase.from("economic_snapshots").insert({
        user_id: user.id,
        data: economicData,
        created_at: now.toISOString(),
      });
    }

    console.log("[radar] Economic data:", JSON.stringify(economicData).substring(0, 500));

    // --------------------
    // USER FINANCIAL CONTEXT
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
      if (type === "despesa" || type === "custo") {
        totalExpenses += Number(tx.amount);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(tx.amount);
      }
    }

    const monthCount = monthsSet.size || 1;
    const avgMonthlyExpenses = totalExpenses / monthCount;
    const avgMonthlyIncome = totalIncome / monthCount;

    const categoryContext = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, val]) => `${cat}: R$ ${(val / monthCount).toFixed(0)}/mês`)
      .join("\n");

    // --------------------
    // HISTÓRICO RADAR
    // --------------------
    const { data: history } = await supabase
      .from("economic_snapshots")
      .select("data, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const historyContext = history
      ?.map((h: any) => `- ${h.created_at}: Selic ${h.data.selic}%, IPCA ${h.data.ipca}%, Dólar R$${h.data.dolar}`)
      .join("\n") || "Sem histórico anterior";

    // --------------------
    // AI - TOOL CALLING FOR STRUCTURED OUTPUT
    // --------------------
    const systemPrompt = `Você é um analista macroeconômico especializado em impacto financeiro pessoal no Brasil.

OBJETIVO:
Gerar um Radar Econômico personalizado, baseado EXCLUSIVAMENTE nos dados econômicos fornecidos no contexto e no comportamento financeiro do usuário.

CONTEXTO DOS DADOS:
Os dados econômicos fornecidos são atualizados automaticamente a cada 24 horas (cache inteligente).
Data de referência: ${now.toISOString().split("T")[0]}.
Considere esses dados como os mais recentes disponíveis.

REGRAS CRÍTICAS:
- Use SOMENTE os dados fornecidos no contexto
- NÃO use conhecimento antigo ou genérico do seu treinamento
- NÃO invente números ou cenários
- Se algum dado estiver ausente, assuma como "não disponível"
- Sempre priorize os dados recebidos no prompt

ANÁLISE OBRIGATÓRIA:
1. Inflação (IPCA e expectativa Focus)
2. Juros (Selic)
3. Combustível (com base no petróleo + tendência)
4. Câmbio (dólar)
5. Pressão em alimentos (inferir com base em inflação)
6. Tendência macroeconômica geral

INTERPRETAÇÃO INTELIGENTE:
- Compare com histórico recente fornecido
- Identifique tendência: subindo, caindo ou estável
- Traduza tudo para impacto PRÁTICO no bolso do usuário

FOCO PRINCIPAL:
Transformar dados econômicos em:
- impacto financeiro direto
- antecipação de problemas
- oportunidades de economia

DIRETRIZES DE QUALIDADE:
- Seja específico e numérico sempre que possível
- Conecte economia → comportamento → impacto financeiro
- Evite linguagem genérica
- Pense como um app tipo Nubank ou XP
- Gere valor prático, não apenas informação
- Gere pelo menos 3 recomendações estratégicas acionáveis
- O resumo deve ser claro e direto em 2-3 frases`;

    const userPrompt = `DADOS ECONÔMICOS ATUAIS:
- IPCA mensal: ${economicData.ipca}%
- IPCA acumulado 12 meses: ${economicData.ipca_acumulado_12m || "não disponível"}%
- Histórico IPCA (últimos meses): ${economicData.ipca_history || "não disponível"}
- Selic meta: ${economicData.selic}%
- Histórico Selic: ${economicData.selic_history || "não disponível"}
- Dólar (PTAX): R$ ${economicData.dolar}
- IGP-M: ${economicData.igpm}%
- Focus (expectativa IPCA): ${economicData.focusInflation || "não disponível"}%
- Petróleo WTI: US$ ${economicData.oil || "não disponível"}
- Tendência combustível: ${economicData.fuelTrend}

HISTÓRICO DE SNAPSHOTS:
${historyContext}

PERFIL FINANCEIRO DO USUÁRIO:
Renda média mensal: R$ ${avgMonthlyIncome.toFixed(0)}
Despesa média mensal: R$ ${avgMonthlyExpenses.toFixed(0)}
Margem mensal: R$ ${(avgMonthlyIncome - avgMonthlyExpenses).toFixed(0)}

Gastos médios por categoria:
${categoryContext}

Analise esses dados e gere o radar econômico completo usando a função generate_radar.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_radar",
              description: "Gera o radar econômico completo com cenário, impacto pessoal, tendências, recomendações e resumo.",
              parameters: {
                type: "object",
                properties: {
                  cenario: {
                    type: "object",
                    properties: {
                      inflacao: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["alta", "estável", "baixa"] },
                          valor: { type: "string" },
                          tendencia: { type: "string", enum: ["subindo", "estável", "caindo"] },
                          detalhe: { type: "string" },
                        },
                        required: ["status", "valor", "tendencia", "detalhe"],
                      },
                      juros: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["altos", "estáveis", "baixos"] },
                          valor: { type: "string" },
                          tendencia: { type: "string", enum: ["subindo", "estável", "caindo"] },
                          detalhe: { type: "string" },
                        },
                        required: ["status", "valor", "tendencia", "detalhe"],
                      },
                      combustivel: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["alto", "estável", "baixo"] },
                          tendencia: { type: "string", enum: ["subindo", "estável", "caindo"] },
                          detalhe: { type: "string" },
                        },
                        required: ["status", "tendencia", "detalhe"],
                      },
                      alimentos: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["pressão alta", "estável", "deflação"] },
                          tendencia: { type: "string", enum: ["subindo", "estável", "caindo"] },
                          detalhe: { type: "string" },
                        },
                        required: ["status", "tendencia", "detalhe"],
                      },
                      dolar: {
                        type: "object",
                        properties: {
                          status: { type: "string", enum: ["alto", "estável", "baixo"] },
                          valor: { type: "string" },
                          tendencia: { type: "string", enum: ["subindo", "estável", "caindo"] },
                          detalhe: { type: "string" },
                        },
                        required: ["status", "valor", "tendencia", "detalhe"],
                      },
                    },
                    required: ["inflacao", "juros", "combustivel", "alimentos", "dolar"],
                  },
                  impacto_pessoal: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        categoria: { type: "string" },
                        impacto_estimado: { type: "string" },
                        explicacao: { type: "string" },
                      },
                      required: ["categoria", "impacto_estimado", "explicacao"],
                    },
                  },
                  tendencias: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titulo: { type: "string" },
                        descricao: { type: "string" },
                        impacto_usuario: { type: "string" },
                        severidade: { type: "string", enum: ["alta", "média", "baixa"] },
                      },
                      required: ["titulo", "descricao", "impacto_usuario", "severidade"],
                    },
                  },
                  recomendacoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titulo: { type: "string" },
                        descricao: { type: "string" },
                        economia_potencial: { type: "string" },
                      },
                      required: ["titulo", "descricao", "economia_potencial"],
                    },
                  },
                  resumo: { type: "string" },
                },
                required: ["cenario", "impacto_pessoal", "tendencias", "recomendacoes", "resumo"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_radar" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[radar] AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro na IA: " + aiResponse.status);
    }

    const aiResult = await aiResponse.json();
    console.log("[radar] AI response received");

    // Extract from tool call
    let parsed: any;
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      try {
        parsed = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch (e) {
        console.error("[radar] Failed to parse tool call arguments:", e);
        parsed = null;
      }
    }

    // Fallback: try content if tool call failed
    if (!parsed) {
      const content = aiResult.choices?.[0]?.message?.content || "";
      try {
        parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
      } catch {
        console.error("[radar] Failed to parse content as JSON");
        parsed = {};
      }
    }

    // Ensure all required fields exist
    if (!parsed.cenario) {
      parsed.cenario = {};
    }
    if (!parsed.impacto_pessoal) {
      parsed.impacto_pessoal = [];
    }
    if (!parsed.tendencias) {
      parsed.tendencias = [];
    }
    if (!parsed.recomendacoes || parsed.recomendacoes.length === 0) {
      parsed.recomendacoes = [
        { titulo: "Revisar gastos", descricao: "Analise suas despesas para encontrar oportunidades de economia.", economia_potencial: "Variável" },
        { titulo: "Reserva de emergência", descricao: "Mantenha pelo menos 6 meses de despesas guardados.", economia_potencial: "Segurança financeira" },
        { titulo: "Acompanhe indicadores", descricao: "Monitore regularmente as mudanças econômicas para antecipar impactos.", economia_potencial: "Prevenção" },
      ];
    }
    if (!parsed.resumo) {
      parsed.resumo = "Análise econômica gerada com dados mais recentes disponíveis.";
    }

    // --------------------
    // SAVE REPORT
    // --------------------
    await supabase.from("economic_radar_reports").insert({
      user_id: user.id,
      report: parsed,
      created_at: now.toISOString(),
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[radar] ERROR:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
