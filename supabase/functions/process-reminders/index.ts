import { createClient } from "npm:@supabase/supabase-js@2";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return jsonResponse({ code: "UNAUTHORIZED" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ code: "SERVER_CONFIGURATION" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc("process_due_reminders", {
    batch_size: 100,
  });

  if (error) {
    return jsonResponse({ code: "REMINDER_PROCESS_FAILED" }, 500);
  }

  return jsonResponse({ processed: data }, 200);
});
