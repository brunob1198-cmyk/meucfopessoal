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
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[sync] Force update failed: ${res.status} - ${txt}`);
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

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  console.warn(`[sync] Timeout waiting for item ${itemId} to finish updating`);
  return "TIMEOUT";
}

/** Map Pluggy account type to our account_type */
function mapAccountType(pluggyType: string): string {
  const t = (pluggyType || "").toUpperCase();
  if (t === "CREDIT" || t === "CREDIT_CARD") return "credit_card";
  if (t === "SAVINGS") return "savings";
  return "checking";
}

/** Fetch all Pluggy accounts for an item */
async function fetchPluggyAccounts(itemId: string, pluggyToken: string): Promise<any[]> {
  const res = await fetch(
    `https://api.pluggy.ai/accounts?itemId=${itemId}`,
    { headers: { "X-API-KEY": pluggyToken } }
  );
  if (!res.ok) throw new Error(`Accounts fetch failed: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

/** Sync a single Pluggy account's transactions into a connected_account */
async function syncPluggyAccount(
  pluggyAccount: any,
  connectedAccountId: string,
  userId: string,
  pluggyToken: string,
  supabaseClient: any
) {
  const pluggyAccountId = pluggyAccount.id;
  const accountType = mapAccountType(pluggyAccount.type);

  // Fetch ALL transactions
  const allTransactions = await fetchAllTransactions(pluggyAccountId, pluggyToken);

  // Category matching
  const { data: rules } = await supabaseClient
    .from("category_rules")
    .select("keyword, category_id")
    .eq("user_id", userId);

  const { data: categories } = await supabaseClient
    .from("categories")
    .select("id, name, dre_type")
    .eq("user_id", userId);

  // Prepare rows
  const rows = allTransactions
    .filter((tx: any) => tx.id)
    .map((tx: any) => ({
      user_id: userId,
      connected_account_id: connectedAccountId,
      external_id: tx.id,
      date: tx.date.split("T")[0],
      amount: Math.abs(tx.amount),
      description: tx.description || tx.descriptionRaw || "",
      transaction_type: tx.amount < 0 ? "debit" : "credit",
      suggested_category_id: suggestCategoryFromRules(
        tx.description || tx.descriptionRaw || "",
        rules,
        categories
      ),
      status: "pending",
    }));

  // Batch upsert
  const BATCH_SIZE = 200;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseClient
      .from("imported_transactions")
      .upsert(batch, { onConflict: "user_id,external_id", ignoreDuplicates: true });
    if (error) {
      console.error(`[sync] Batch upsert error at offset ${i}:`, error.message);
    }
  }

  // Build update payload with credit card specifics
  const updatePayload: any = {
    balance: pluggyAccount.balance ?? 0,
    last_sync_at: new Date().toISOString(),
    status: "active",
    pluggy_account_id: pluggyAccountId,
    account_type: accountType,
  };

  if (accountType === "credit_card") {
    // Pluggy credit accounts have creditData with availableCreditLimit, balanceCloseDate, balanceDueDate
    const creditData = pluggyAccount.creditData || pluggyAccount.creditCardData || {};
    updatePayload.credit_limit = creditData.creditLimit ?? creditData.availableCreditLimit ?? 0;
    // For credit cards, balance is typically the current bill amount (negative = owed)
    updatePayload.credit_bill_amount = Math.abs(pluggyAccount.balance ?? 0);
    updatePayload.balance = creditData.availableCreditLimit ?? creditData.creditLimit ?? 0;
    console.log(`[sync] Credit card data: limit=${updatePayload.credit_limit}, bill=${updatePayload.credit_bill_amount}`);
  }

  await supabaseClient
    .from("connected_accounts")
    .update(updatePayload)
    .eq("id", connectedAccountId);

  console.log(`[sync] Synced ${rows.length} transactions for ${accountType} account ${connectedAccountId}`);
  return { imported: rows.length, accountType };
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

      const pluggyAccounts = await fetchPluggyAccounts(itemId, pluggyToken);

      return new Response(
        JSON.stringify({ item, accounts: pluggyAccounts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- sync-transactions: sync ALL accounts for an item ----
    if (action === "sync-transactions") {
      const { itemId } = body;
      const userId = user.id;

      // Get all connected_accounts for this item
      const { data: connectedAccounts } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("pluggy_item_id", itemId);

      if (!connectedAccounts?.length) {
        return new Response(
          JSON.stringify({ error: "No connected accounts found for this item" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark all as syncing
      for (const ca of connectedAccounts) {
        await supabase
          .from("connected_accounts")
          .update({ status: "syncing" })
          .eq("id", ca.id);
      }

      try {
        // 1) Force Pluggy to refresh
        await forceItemUpdate(itemId, pluggyToken);

        // 2) Wait for ready
        const itemStatus = await waitForItemReady(itemId, pluggyToken, 60000);
        console.log(`[sync] Item final status: ${itemStatus}`);

        // 3) Fetch ALL Pluggy accounts for this item
        const pluggyAccounts = await fetchPluggyAccounts(itemId, pluggyToken);
        console.log(`[sync] Found ${pluggyAccounts.length} Pluggy accounts for item ${itemId}: ${pluggyAccounts.map((a: any) => `${a.type}(${a.id})`).join(", ")}`);

        let totalImported = 0;

        // 4) Match each Pluggy account to the correct connected_account
        for (const pa of pluggyAccounts) {
          const paType = mapAccountType(pa.type);

          // Find matching connected_account by pluggy_account_id first, then by type
          let matchedCA = connectedAccounts.find(
            (ca: any) => ca.pluggy_account_id === pa.id
          );
          if (!matchedCA) {
            matchedCA = connectedAccounts.find(
              (ca: any) => ca.account_type === paType && !ca.pluggy_account_id
            );
          }

          if (!matchedCA) {
            // No existing connected_account for this type — create one
            console.log(`[sync] Creating new connected_account for ${paType} (${pa.name || pa.number || pa.id})`);

            // Get item info for connector details
            const existingCA = connectedAccounts[0];
            const { data: newCA, error: insertError } = await supabase
              .from("connected_accounts")
              .insert({
                user_id: userId,
                pluggy_item_id: itemId,
                pluggy_account_id: pa.id,
                connector_name: existingCA.connector_name,
                connector_logo: existingCA.connector_logo,
                account_type: paType,
                account_name: pa.name || pa.number || (paType === "credit_card" ? "Cartão de Crédito" : "Conta"),
                balance: pa.balance || 0,
                status: "syncing",
              })
              .select()
              .single();

            if (insertError) {
              console.error(`[sync] Failed to create connected_account:`, insertError.message);
              continue;
            }
            matchedCA = newCA;
          }

          // Sync transactions for this account
          const result = await syncPluggyAccount(pa, matchedCA.id, userId, pluggyToken, supabase);
          totalImported += result.imported;
        }

        return new Response(
          JSON.stringify({
            imported: totalImported,
            accountsSynced: pluggyAccounts.length,
            itemStatus,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (syncError) {
        // Reset status on error
        for (const ca of connectedAccounts) {
          await supabase
            .from("connected_accounts")
            .update({ status: "error" })
            .eq("id", ca.id);
        }
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

// ---- Webhook handler ----
async function handleWebhook(body: any) {
  console.log("[webhook] Received:", JSON.stringify(body));

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
    const pluggyAccounts = await fetchPluggyAccounts(itemId, pluggyToken);

    for (const pa of pluggyAccounts) {
      const paType = mapAccountType(pa.type);

      // Match to connected_account
      let matchedCA = accounts.find((ca: any) => ca.pluggy_account_id === pa.id);
      if (!matchedCA) {
        matchedCA = accounts.find((ca: any) => ca.account_type === paType);
      }
      if (!matchedCA) continue;

      await syncPluggyAccount(pa, matchedCA.id, matchedCA.user_id, pluggyToken, serviceSupabase);
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
      await forceItemUpdate(itemId, pluggyToken);
      await waitForItemReady(itemId, pluggyToken, 45000);

      const pluggyAccounts = await fetchPluggyAccounts(itemId, pluggyToken);

      for (const pa of pluggyAccounts) {
        const paType = mapAccountType(pa.type);

        // Match to connected_account
        let matchedCA = itemAccounts.find((ca: any) => ca.pluggy_account_id === pa.id);
        if (!matchedCA) {
          matchedCA = itemAccounts.find((ca: any) => ca.account_type === paType);
        }
        if (!matchedCA) {
          console.log(`[cron] No connected_account for ${paType} on item ${itemId}, skipping`);
          continue;
        }

        await syncPluggyAccount(pa, matchedCA.id, matchedCA.user_id, pluggyToken, serviceSupabase);
        syncedCount++;
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
