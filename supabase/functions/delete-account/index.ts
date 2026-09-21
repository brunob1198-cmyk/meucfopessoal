import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tabelas com dado pessoal do usuário, chaveadas por user_id. profiles/categories/
// transactions/projections já têm ON DELETE CASCADE a partir de auth.users, mas
// apagamos aqui também para não depender disso — as tabelas mais novas não têm
// essa FK e ficariam órfãs se só a exclusão do usuário no Auth fosse chamada.
const USER_TABLES = [
  "imported_transactions",
  "connected_accounts",
  "category_rules",
  "transactions",
  "projections",
  "analysis_history",
  "economic_snapshots",
  "economic_radar_reports",
  "financial_health_score_history",
  "net_worth_history",
  "financial_dreams",
  "balance_sheet_liabilities",
  "balance_sheet_assets",
  "user_plans",
];

const AVATAR_BUCKETS = ["avatars", "logos"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Confirma quem está pedindo a exclusão a partir do próprio token do usuário.
    const callerSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    // Cliente com service role: ignora RLS para conseguir apagar tudo do usuário.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    for (const table of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) console.error(`[delete-account] Falha ao limpar ${table}:`, error.message);
    }

    const { error: sharedError } = await admin
      .from("shared_access")
      .delete()
      .or(`owner_id.eq.${userId},shared_with_id.eq.${userId}`);
    if (sharedError) console.error("[delete-account] Falha ao limpar shared_access:", sharedError.message);

    const { error: catError } = await admin.from("categories").delete().eq("user_id", userId);
    if (catError) console.error("[delete-account] Falha ao limpar categories:", catError.message);

    const { error: profileError } = await admin.from("profiles").delete().eq("user_id", userId);
    if (profileError) console.error("[delete-account] Falha ao limpar profiles:", profileError.message);

    for (const bucket of AVATAR_BUCKETS) {
      const { data: files } = await admin.storage.from(bucket).list(userId);
      if (files && files.length > 0) {
        await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      }
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error("[delete-account] Falha ao remover usuário do Auth:", authDeleteError.message);
      return new Response(
        JSON.stringify({
          error: "Seus dados foram apagados, mas houve uma falha ao remover o login. Contate o suporte.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[delete-account] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
