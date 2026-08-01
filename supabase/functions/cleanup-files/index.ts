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
  if (request.method !== "POST")
    return jsonResponse({ code: "METHOD_NOT_ALLOWED" }, 405);
  const cleanupSecret = Deno.env.get("FILE_CLEANUP_SECRET");
  if (
    !cleanupSecret ||
    request.headers.get("authorization") !== `Bearer ${cleanupSecret}`
  ) {
    return jsonResponse({ code: "UNAUTHORIZED" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return jsonResponse({ code: "SERVER_CONFIGURATION" }, 500);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = adminClient.storage.from("documents");
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: replacedFiles, error: queryError } = await adminClient
    .from("document_files")
    .select("id, storage_key")
    .eq("status", "replaced")
    .lte("replaced_at", cutoff)
    .limit(100);
  if (queryError) return jsonResponse({ code: "CLEANUP_QUERY_FAILED" }, 500);

  let removedReplacements = 0;
  if (replacedFiles?.length) {
    const { error: removeError } = await storage.remove(
      replacedFiles.map((file) => file.storage_key),
    );
    if (!removeError) {
      const ids = replacedFiles.map((file) => file.id);
      const { error: updateError } = await adminClient
        .from("document_files")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .in("id", ids)
        .eq("status", "replaced");
      if (!updateError) removedReplacements = ids.length;
    }
  }

  let removedStaged = 0;
  const { data: userFolders } = await storage.list("staging", { limit: 100 });
  for (const folder of userFolders ?? []) {
    if (folder.id !== null) continue;
    const { data: stagedFiles } = await storage.list(`staging/${folder.name}`, {
      limit: 100,
    });
    const expiredPaths = (stagedFiles ?? [])
      .filter((file) => file.created_at && file.created_at <= cutoff)
      .map((file) => `staging/${folder.name}/${file.name}`);
    if (expiredPaths.length) {
      const { error } = await storage.remove(expiredPaths);
      if (!error) removedStaged += expiredPaths.length;
    }
  }

  return jsonResponse({ removedReplacements, removedStaged }, 200);
});
