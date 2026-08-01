import { createClient } from "npm:@supabase/supabase-js@2";

import {
  detectMimeType,
  MAX_FILE_SIZE,
  normalizeFilename,
  toHex,
  UUID_PATTERN,
} from "../_shared/files.ts";

type ReplaceFileInput = {
  uploadId: string;
  documentId: string;
  fileId: string;
  expectedVersion: number;
  originalFilename: string;
};

function allowedOrigin(origin: string | null) {
  const appUrl = Deno.env.get("APP_URL");
  const allowed = new Set([
    appUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  return origin && allowed.has(origin)
    ? origin
    : (appUrl ?? "http://localhost:3000");
}

function jsonResponse(body: unknown, status: number, origin: string | null) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": allowedOrigin(origin),
      "access-control-allow-headers":
        "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      vary: "Origin",
    },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return jsonResponse({}, 204, origin);
  if (request.method !== "POST")
    return jsonResponse({ code: "METHOD_NOT_ALLOWED" }, 405, origin);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(
      { code: "UNAUTHORIZED", message: "Inicia sesión para continuar." },
      401,
      origin,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return jsonResponse({ code: "SERVER_CONFIGURATION" }, 500, origin);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user)
    return jsonResponse({ code: "UNAUTHORIZED" }, 401, origin);

  let input: ReplaceFileInput;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(
      { code: "INVALID_BODY", message: "Los datos enviados no son válidos." },
      422,
      origin,
    );
  }

  if (
    !UUID_PATTERN.test(input.uploadId) ||
    !UUID_PATTERN.test(input.documentId) ||
    !UUID_PATTERN.test(input.fileId) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    typeof input.originalFilename !== "string"
  )
    return jsonResponse(
      { code: "INVALID_BODY", message: "Revisa los datos enviados." },
      422,
      origin,
    );

  const { data: document } = await userClient
    .from("documents")
    .select("id, family_id, version")
    .eq("id", input.documentId)
    .eq("status", "active")
    .maybeSingle();
  if (!document)
    return jsonResponse(
      { code: "NOT_FOUND", message: "El documento no existe." },
      404,
      origin,
    );

  const { data: currentFile } = await userClient
    .from("document_files")
    .select("id, storage_key")
    .eq("document_id", document.id)
    .eq("status", "active")
    .maybeSingle();

  const stagedPath = `staging/${userData.user.id}/${input.uploadId}`;
  const finalPath = `families/${document.family_id}/documents/${document.id}/files/${input.fileId}`;
  const storage = adminClient.storage.from("documents");
  const { data: stagedFile, error: downloadError } =
    await storage.download(stagedPath);

  if (downloadError || !stagedFile) {
    const { data: existingFile } = await userClient
      .from("document_files")
      .select("id")
      .eq("id", input.fileId)
      .eq("status", "active")
      .maybeSingle();
    if (existingFile)
      return jsonResponse({ documentId: document.id }, 200, origin);
    return jsonResponse(
      {
        code: "UPLOAD_NOT_FOUND",
        message: "La carga expiró. Selecciona el archivo de nuevo.",
      },
      404,
      origin,
    );
  }

  if (stagedFile.size < 1 || stagedFile.size > MAX_FILE_SIZE) {
    await storage.remove([stagedPath]);
    return jsonResponse(
      {
        code: "INVALID_FILE_SIZE",
        message: "El archivo debe pesar como máximo 10 MiB.",
      },
      422,
      origin,
    );
  }

  const fileBuffer = await stagedFile.arrayBuffer();
  const detectedMimeType = detectMimeType(new Uint8Array(fileBuffer));
  const originalFilename = normalizeFilename(input.originalFilename);
  if (!detectedMimeType || !originalFilename) {
    await storage.remove([stagedPath]);
    return jsonResponse(
      {
        code: "INVALID_FILE",
        message: "Usa un archivo PDF, JPEG o PNG válido.",
      },
      422,
      origin,
    );
  }

  const sha256 = toHex(await crypto.subtle.digest("SHA-256", fileBuffer));
  const { error: moveError } = await storage.move(stagedPath, finalPath);
  if (moveError)
    return jsonResponse(
      { code: "FILE_MOVE_FAILED", message: "No pudimos preparar el archivo." },
      500,
      origin,
    );

  const { data: updatedDocument, error: replaceError } = await adminClient.rpc(
    "replace_document_file",
    {
      actor_user_id: userData.user.id,
      target_document_id: document.id,
      new_file_id: input.fileId,
      new_storage_key: finalPath,
      new_original_filename: originalFilename,
      new_detected_mime_type: detectedMimeType,
      new_size_bytes: stagedFile.size,
      new_sha256: sha256,
      expected_version: input.expectedVersion,
    },
  );

  if (replaceError || !updatedDocument) {
    await storage.move(finalPath, stagedPath);
    return jsonResponse(
      {
        code: "REPLACE_FAILED",
        message: "El documento cambió o el archivo no pudo sustituirse.",
      },
      409,
      origin,
    );
  }

  if (currentFile) {
    const { error: removeError } = await storage.remove([
      currentFile.storage_key,
    ]);
    if (!removeError) {
      await adminClient
        .from("document_files")
        .update({ status: "deleted", deleted_at: new Date().toISOString() })
        .eq("id", currentFile.id)
        .eq("status", "replaced");
    }
  }

  return jsonResponse({ document: updatedDocument }, 200, origin);
});
