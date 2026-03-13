import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getPluggyToken(): Promise<string> {
  const res = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: Deno.env.get("PLUGGY_CLIENT_ID"),
      clientSecret: Deno.env.get("PLUGGY_CLIENT_SECRET"),
    }),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status}`);
  const data = await res.json();
  return data.apiKey;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const pluggyToken = await getPluggyToken();

    // Action: create connect token (for Pluggy Connect widget)
    if (action === "connect-token") {
      const res = await fetch("https://api.pluggy.ai/connect_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": pluggyToken,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Connect token failed: ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify({ accessToken: data.accessToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch item details + accounts after user connects
    if (action === "fetch-item") {
      const { itemId } = await req.json();
      if (!itemId) throw new Error("itemId required");

      // Get item info
      const itemRes = await fetch(`https://api.pluggy.ai/items/${itemId}`, {
        headers: { "X-API-KEY": pluggyToken },
      });
      if (!itemRes.ok) throw new Error(`Item fetch failed: ${itemRes.status}`);
      const item = await itemRes.json();

      // Get accounts
      const accountsRes = await fetch(
        `https://api.pluggy.ai/accounts?itemId=${itemId}`,
        { headers: { "X-API-KEY": pluggyToken } }
      );
      if (!accountsRes.ok) throw new Error(`Accounts fetch failed: ${accountsRes.status}`);
      const accountsData = await accountsRes.json();

      return new Response(
        JSON.stringify({ item, accounts: accountsData.results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: sync transactions for a connected account
    if (action === "sync-transactions") {
      const { itemId, accountId, connectedAccountId } = await req.json();
      const userId = claimsData.claims.sub;

      // Fetch transactions from Pluggy
      const txRes = await fetch(
        `https://api.pluggy.ai/transactions?accountId=${accountId}&pageSize=500`,
        { headers: { "X-API-KEY": pluggyToken } }
      );
      if (!txRes.ok) throw new Error(`Transactions fetch failed: ${txRes.status}`);
      const txData = await txRes.json();

      // Get user category rules for auto-categorization
      const { data: rules } = await supabase
        .from("category_rules")
        .select("keyword, category_id")
        .eq("user_id", userId);

      const { data: categories } = await supabase
        .from("categories")
        .select("id, name, dre_type")
        .eq("user_id", userId);

      // Default keyword mappings
      const defaultKeywords: Record<string, string> = {
        ifood: "Alimentação",
        uber: "Transporte",
        "99": "Transporte",
        netflix: "Assinaturas",
        spotify: "Assinaturas",
        amazon: "Compras de itens",
        posto: "Combustível",
        shell: "Combustível",
        supermercado: "Supermercado",
        farmacia: "Farmácia",
        farmácia: "Farmácia",
        restaurante: "Restaurantes",
        padaria: "Alimentação",
      };

      function suggestCategory(description: string) {
        const desc = (description || "").toLowerCase();

        // Level 1: user custom rules
        if (rules) {
          for (const rule of rules) {
            if (desc.includes(rule.keyword.toLowerCase())) {
              return rule.category_id;
            }
          }
        }

        // Level 2: default keyword rules
        for (const [keyword, catName] of Object.entries(defaultKeywords)) {
          if (desc.includes(keyword)) {
            const cat = categories?.find(
              (c) => c.name.toLowerCase() === catName.toLowerCase()
            );
            if (cat) return cat.id;
          }
        }

        return null;
      }

      // Prepare rows for upsert
      const rows = txData.results.map((tx: any) => ({
        user_id: userId,
        connected_account_id: connectedAccountId,
        external_id: tx.id,
        date: tx.date.split("T")[0],
        amount: Math.abs(tx.amount),
        description: tx.description || tx.descriptionRaw || "",
        transaction_type: tx.amount < 0 ? "debit" : "credit",
        suggested_category_id: suggestCategory(
          tx.description || tx.descriptionRaw || ""
        ),
        status: "pending",
      }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from("imported_transactions")
          .upsert(rows, { onConflict: "user_id,external_id", ignoreDuplicates: true });
        if (error) throw error;
      }

      // Update account balance
      const accRes = await fetch(
        `https://api.pluggy.ai/accounts/${accountId}`,
        { headers: { "X-API-KEY": pluggyToken } }
      );
      if (accRes.ok) {
        const acc = await accRes.json();
        await supabase
          .from("connected_accounts")
          .update({
            balance: acc.balance,
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", connectedAccountId);
      }

      return new Response(
        JSON.stringify({ imported: rows.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: delete item from Pluggy
    if (action === "delete-item") {
      const { itemId } = await req.json();
      await fetch(`https://api.pluggy.ai/items/${itemId}`, {
        method: "DELETE",
        headers: { "X-API-KEY": pluggyToken },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("pluggy-connect error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
