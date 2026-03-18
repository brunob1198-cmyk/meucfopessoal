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

/** Fetch ALL transactions with pagination */
async function fetchAllTransactions(accountId: string, pluggyToken: string): Promise<any[]> {
  const PAGE_SIZE = 500;
  let page = 1;
  let allResults: any[] = [];
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await fetch(
      `https://api.pluggy.ai/transactions?accountId=${accountId}&pageSize=${PAGE_SIZE}&page=${page}`,
      { headers: { "X-API-KEY": pluggyToken } }
    );
    if (!res.ok) throw new Error(`Transactions fetch failed: ${res.status} on page ${page}`);
    const data = await res.json();

    allResults = allResults.concat(data.results || []);
    totalPages = data.totalPages || 1;
    page++;
  }

  console.log(`[sync] Fetched ${allResults.length} transactions total (${totalPages} pages) for account ${accountId}`);
  return allResults;
}

/** Force Pluggy to refresh item data from the bank */
async function forceItemUpdate(itemId: string, pluggyToken: string): Promise<any> {
  console.log(`[sync] Forcing update for item ${itemId}`);
  const res = await fetch(`https://api.pluggy.ai/items/${itemId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": pluggyToken,
    },
    body: JSON.stringify({}), // empty body triggers a refresh
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[sync] Force update failed: ${res.status} - ${txt}`);
    // Don't throw - continue with existing data
    return null;
  }
  return await res.json();
}

/** Wait for item to finish updating */
async function waitForItemReady(itemId: string, pluggyToken: string, maxWaitMs = 60000): Promise<string> {
  const start = Date.now();
  const POLL_INTERVAL = 3000;

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`https://api.pluggy.ai/items/${itemId}`, {
      headers: { "X-API-KEY": pluggyToken },
    });
    if (!res.ok) throw new Error(`Item status check failed: ${res.status}`);
    const item = await res.json();

    console.log(`[sync] Item ${itemId} status: ${item.status}`);

    if (item.status === "UPDATED" || item.status === "LOGIN_ERROR" || item.status === "OUTDATED") {
      return item.status;
    }
    if (item.status === "UPDATE_NEEDED") {
      return item.status;
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  console.warn(`[sync] Timeout waiting for item ${itemId} to finish updating`);
  return "TIMEOUT";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action");

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON
    }

    if (!action && body?.action) {
      action = body.action;
    }

    // ---- WEBHOOK (no auth needed) ----
    if (action === "webhook") {
      return await handleWebhook(body);
    }

    // ---- CRON sync-all (service role, no user auth) ----
    if (action === "sync-all") {
      return await handleSyncAll();
    }

    // ---- Auth required from here ----
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pluggyToken = await getPluggyToken();

    // ---- connect-token ----
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

    // ---- fetch-item ----
    if (action === "fetch-item") {
      const itemId = body?.itemId;
      if (!itemId) throw new Error("itemId required");

      const itemRes = await fetch(`https://api.pluggy.ai/items/${itemId}`, {
        headers: { "X-API-KEY": pluggyToken },
      });
      if (!itemRes.ok) throw new Error(`Item fetch failed: ${itemRes.status}`);
      const item = await itemRes.json();

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

    // ---- sync-transactions (with force update + pagination) ----
    if (action === "sync-transactions") {
      const { itemId, accountId, connectedAccountId } = body;
      const userId = user.id;

      // Update sync status to syncing
      await supabase
        .from("connected_accounts")
        .update({ status: "syncing" })
        .eq("id", connectedAccountId);

      try {
        // 1) Force Pluggy to refresh data from the bank
        await forceItemUpdate(itemId, pluggyToken);

        // 2) Wait for the item to finish updating (up to 60s)
        const itemStatus = await waitForItemReady(itemId, pluggyToken, 60000);
        console.log(`[sync] Item final status: ${itemStatus}`);

        // 3) Get the Pluggy account ID (may differ from itemId)
        let pluggyAccountId = accountId;
        if (accountId === itemId) {
          // If accountId was passed as itemId, fetch actual accounts
          const accountsRes = await fetch(
            `https://api.pluggy.ai/accounts?itemId=${itemId}`,
            { headers: { "X-API-KEY": pluggyToken } }
          );
          if (accountsRes.ok) {
            const accData = await accountsRes.json();
            if (accData.results?.length > 0) {
              pluggyAccountId = accData.results[0].id;
              console.log(`[sync] Resolved account ID: ${pluggyAccountId}`);
            }
          }
        }

        // 4) Fetch ALL transactions with pagination
        const allTransactions = await fetchAllTransactions(pluggyAccountId, pluggyToken);

        // 5) Category matching
        const { data: rules } = await supabase
          .from("category_rules")
          .select("keyword, category_id")
          .eq("user_id", userId);

        const { data: categories } = await supabase
          .from("categories")
          .select("id, name, dre_type")
          .eq("user_id", userId);

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
          if (rules) {
            for (const rule of rules) {
              if (desc.includes(rule.keyword.toLowerCase())) {
                return rule.category_id;
              }
            }
          }
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

        // 6) Prepare rows - filter out transactions without external_id
        const rows = allTransactions
          .filter((tx: any) => tx.id) // must have an ID
          .map((tx: any) => ({
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

        // 7) Upsert in batches to avoid timeouts
        let imported = 0;
        let skipped = 0;
        const BATCH_SIZE = 200;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const { error, count } = await supabase
            .from("imported_transactions")
            .upsert(batch, { onConflict: "user_id,external_id", ignoreDuplicates: true });

          if (error) {
            console.error(`[sync] Batch upsert error at offset ${i}:`, error.message);
            // Continue with other batches
          } else {
            imported += batch.length;
          }
        }

        // Check how many already existed
        const { count: existingCount } = await supabase
          .from("imported_transactions")
          .select("*", { count: "exact", head: true })
          .eq("connected_account_id", connectedAccountId);

        console.log(`[sync] Total rows processed: ${rows.length}, existing in DB: ${existingCount}`);

        // 8) Update account balance and sync status
        const accRes = await fetch(
          `https://api.pluggy.ai/accounts/${pluggyAccountId}`,
          { headers: { "X-API-KEY": pluggyToken } }
        );
        if (accRes.ok) {
          const acc = await accRes.json();
          await supabase
            .from("connected_accounts")
            .update({
              balance: acc.balance,
              last_sync_at: new Date().toISOString(),
              status: "active",
            })
            .eq("id", connectedAccountId);
        } else {
          await supabase
            .from("connected_accounts")
            .update({
              last_sync_at: new Date().toISOString(),
              status: "active",
            })
            .eq("id", connectedAccountId);
        }

        return new Response(
          JSON.stringify({
            imported: rows.length,
            totalFromPluggy: allTransactions.length,
            itemStatus,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (syncError) {
        // Reset status on error
        await supabase
          .from("connected_accounts")
          .update({ status: "error" })
          .eq("id", connectedAccountId);
        throw syncError;
      }
    }

    // ---- delete-item ----
    if (action === "delete-item") {
      const itemId = body?.itemId;
      await fetch(`https://api.pluggy.ai/items/${itemId}`, {
        method: "DELETE",
        headers: { "X-API-KEY": pluggyToken },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- register-webhook ----
    if (action === "register-webhook") {
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pluggy-connect?action=webhook`;
      const res = await fetch("https://api.pluggy.ai/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": pluggyToken,
        },
        body: JSON.stringify({
          event: "item/updated",
          url: webhookUrl,
        }),
      });
      const webhookData = await res.json();
      console.log("[webhook] Registered:", JSON.stringify(webhookData));
      return new Response(JSON.stringify({ webhook: webhookData }), {
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

// ---- Webhook handler (called by Pluggy when an item is updated) ----
async function handleWebhook(body: any) {
  console.log("[webhook] Received:", JSON.stringify(body));

  const event = body?.event;
  const itemId = body?.itemId || body?.id || body?.data?.itemId;

  if (!itemId) {
    return new Response(JSON.stringify({ ok: true, message: "No itemId" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find connected accounts with this item
    const { data: accounts } = await serviceSupabase
      .from("connected_accounts")
      .select("*")
      .eq("pluggy_item_id", itemId);

    if (!accounts?.length) {
      console.log(`[webhook] No accounts found for item ${itemId}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pluggyToken = await getPluggyToken();

    for (const account of accounts) {
      console.log(`[webhook] Syncing account ${account.id} for user ${account.user_id}`);

      // Get actual pluggy account ID
      const accountsRes = await fetch(
        `https://api.pluggy.ai/accounts?itemId=${itemId}`,
        { headers: { "X-API-KEY": pluggyToken } }
      );
      if (!accountsRes.ok) continue;
      const accData = await accountsRes.json();
      const pluggyAccount = accData.results?.[0];
      if (!pluggyAccount) continue;

      // Fetch all transactions
      const allTx = await fetchAllTransactions(pluggyAccount.id, pluggyToken);

      // Get user's category rules
      const { data: rules } = await serviceSupabase
        .from("category_rules")
        .select("keyword, category_id")
        .eq("user_id", account.user_id);

      const { data: categories } = await serviceSupabase
        .from("categories")
        .select("id, name, dre_type")
        .eq("user_id", account.user_id);

      const rows = allTx
        .filter((tx: any) => tx.id)
        .map((tx: any) => ({
          user_id: account.user_id,
          connected_account_id: account.id,
          external_id: tx.id,
          date: tx.date.split("T")[0],
          amount: Math.abs(tx.amount),
          description: tx.description || tx.descriptionRaw || "",
          transaction_type: tx.amount < 0 ? "debit" : "credit",
          suggested_category_id: suggestCategoryFromRules(tx.description || tx.descriptionRaw || "", rules, categories),
          status: "pending",
        }));

      // Batch upsert
      const BATCH_SIZE = 200;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await serviceSupabase
          .from("imported_transactions")
          .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "user_id,external_id", ignoreDuplicates: true });
      }

      // Update balance
      await serviceSupabase
        .from("connected_accounts")
        .update({
          balance: pluggyAccount.balance || account.balance,
          last_sync_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", account.id);

      console.log(`[webhook] Synced ${rows.length} transactions for account ${account.id}`);
    }
  } catch (err) {
    console.error("[webhook] Error:", err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Cron sync-all handler ----
async function handleSyncAll() {
  console.log("[cron] Starting sync-all");

  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: accounts } = await serviceSupabase
    .from("connected_accounts")
    .select("*")
    .eq("status", "active");

  if (!accounts?.length) {
    console.log("[cron] No active accounts to sync");
    return new Response(JSON.stringify({ synced: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pluggyToken = await getPluggyToken();
  let syncedCount = 0;

  // Group by item to avoid duplicate force-updates
  const itemMap = new Map<string, typeof accounts>();
  for (const acc of accounts) {
    const list = itemMap.get(acc.pluggy_item_id) || [];
    list.push(acc);
    itemMap.set(acc.pluggy_item_id, list);
  }

  for (const [itemId, itemAccounts] of itemMap) {
    try {
      // Force refresh
      await forceItemUpdate(itemId, pluggyToken);
      await waitForItemReady(itemId, pluggyToken, 45000);

      // Get pluggy accounts
      const accountsRes = await fetch(
        `https://api.pluggy.ai/accounts?itemId=${itemId}`,
        { headers: { "X-API-KEY": pluggyToken } }
      );
      if (!accountsRes.ok) continue;
      const accData = await accountsRes.json();

      for (const account of itemAccounts) {
        const pluggyAccount = accData.results?.[0];
        if (!pluggyAccount) continue;

        const allTx = await fetchAllTransactions(pluggyAccount.id, pluggyToken);

        const { data: rules } = await serviceSupabase
          .from("category_rules")
          .select("keyword, category_id")
          .eq("user_id", account.user_id);

        const { data: categories } = await serviceSupabase
          .from("categories")
          .select("id, name, dre_type")
          .eq("user_id", account.user_id);

        const rows = allTx
          .filter((tx: any) => tx.id)
          .map((tx: any) => ({
            user_id: account.user_id,
            connected_account_id: account.id,
            external_id: tx.id,
            date: tx.date.split("T")[0],
            amount: Math.abs(tx.amount),
            description: tx.description || tx.descriptionRaw || "",
            transaction_type: tx.amount < 0 ? "debit" : "credit",
            suggested_category_id: suggestCategoryFromRules(tx.description || tx.descriptionRaw || "", rules, categories),
            status: "pending",
          }));

        const BATCH_SIZE = 200;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          await serviceSupabase
            .from("imported_transactions")
            .upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: "user_id,external_id", ignoreDuplicates: true });
        }

        await serviceSupabase
          .from("connected_accounts")
          .update({
            balance: pluggyAccount.balance || account.balance,
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", account.id);

        syncedCount++;
        console.log(`[cron] Synced account ${account.id}: ${rows.length} transactions`);
      }
    } catch (err) {
      console.error(`[cron] Error syncing item ${itemId}:`, err);
    }
  }

  console.log(`[cron] Sync-all complete. Synced ${syncedCount} accounts.`);
  return new Response(JSON.stringify({ synced: syncedCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Shared category suggestion helper
function suggestCategoryFromRules(description: string, rules: any[] | null, categories: any[] | null): string | null {
  const desc = (description || "").toLowerCase();

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

  if (rules) {
    for (const rule of rules) {
      if (desc.includes(rule.keyword.toLowerCase())) {
        return rule.category_id;
      }
    }
  }
  for (const [keyword, catName] of Object.entries(defaultKeywords)) {
    if (desc.includes(keyword)) {
      const cat = categories?.find(
        (c: any) => c.name.toLowerCase() === catName.toLowerCase()
      );
      if (cat) return cat.id;
    }
  }
  return null;
}
