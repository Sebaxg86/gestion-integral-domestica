import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// Limpieza diferida de archivos privados
// ============================================================================

function jsonResponse(body: unknown, status: number) {
  // ===== Construcción de la respuesta técnica =====

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

Deno.serve(async (request) => {
  // ===== Validación del proceso programado =====

  if (request.method !== "POST") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const cleanupSecret = Deno.env.get("FILE_CLEANUP_SECRET");
  const authorization = request.headers.get("authorization");

  if (!cleanupSecret || authorization !== `Bearer ${cleanupSecret}`) {
    return jsonResponse({ code: "UNAUTHORIZED" }, 401);
  }

  // ===== Validación de configuración =====

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ code: "SERVER_CONFIGURATION" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = adminClient.storage.from("documents");
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ===== Eliminación de versiones sustituidas =====

  const { data: replacedFiles, error: replacedQueryError } = await adminClient
    .from("document_files")
    .select("id, storage_key")
    .eq("status", "replaced")
    .lte("replaced_at", cutoff)
    .limit(100);

  if (replacedQueryError) {
    return jsonResponse({ code: "CLEANUP_QUERY_FAILED" }, 500);
  }

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

      if (!updateError) {
        removedReplacements = ids.length;
      }
    }
  }

  // ===== Eliminación de adjuntos archivados =====

  const { data: archivedAttachments, error: attachmentsQueryError } =
    await adminClient
      .from("vehicle_service_attachments")
      .select("id, storage_key")
      .eq("status", "archived")
      .lte("archived_at", cutoff)
      .limit(100);

  if (attachmentsQueryError) {
    return jsonResponse({ code: "ATTACHMENTS_QUERY_FAILED" }, 500);
  }

  let removedAttachments = 0;

  if (archivedAttachments?.length) {
    const { error: removeError } = await storage.remove(
      archivedAttachments.map((attachment) => attachment.storage_key),
    );

    if (!removeError) {
      const ids = archivedAttachments.map((attachment) => attachment.id);
      const { error: updateError } = await adminClient
        .from("vehicle_service_attachments")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .in("id", ids)
        .eq("status", "archived");

      if (!updateError) {
        removedAttachments = ids.length;
      }
    }
  }

  // ===== Eliminación de cargas temporales vencidas =====

  let removedStaged = 0;
  const { data: userFolders } = await storage.list("staging", { limit: 100 });

  for (const folder of userFolders ?? []) {
    // ------- Las carpetas no tienen identificador de objeto -------

    if (folder.id !== null) {
      continue;
    }

    const { data: stagedFiles } = await storage.list(
      `staging/${folder.name}`,
      { limit: 100 },
    );
    const expiredPaths = (stagedFiles ?? [])
      .filter((file) => file.created_at && file.created_at <= cutoff)
      .map((file) => `staging/${folder.name}/${file.name}`);

    if (!expiredPaths.length) {
      continue;
    }

    const { error } = await storage.remove(expiredPaths);

    if (!error) {
      removedStaged += expiredPaths.length;
    }
  }

  // ===== Retorno de métricas de la ejecución =====

  return jsonResponse(
    { removedReplacements, removedAttachments, removedStaged },
    200,
  );
});
