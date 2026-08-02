import { createClient } from "npm:@supabase/supabase-js@2";

import {
  detectMimeType,
  MAX_FILE_SIZE,
  normalizeFilename,
  toHex,
  UUID_PATTERN,
} from "../_shared/files.ts";

type FinalizeServiceAttachmentInput = {
  uploadId: string;
  attachmentId: string;
  familyId: string;
  serviceId: string;
  kind: string;
  title: string;
  originalFilename: string;
};

const allowedKinds = new Set([
  "invoice",
  "receipt",
  "photo",
  "warranty",
  "other",
]);

// ============================================================================
// Finalización segura de adjuntos de mantenimiento
// ============================================================================

function allowedOrigin(origin: string | null) {
  // ===== Definición de orígenes confiables =====

  const appUrl = Deno.env.get("APP_URL");
  const allowedOrigins = new Set([
    appUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  if (origin && allowedOrigins.has(origin)) {
    return origin;
  }

  return appUrl ?? "http://localhost:3000";
}

function jsonResponse(body: unknown, status: number, origin: string | null) {
  // ===== Construcción de una respuesta sin caché =====

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

function isValidInput(input: FinalizeServiceAttachmentInput) {
  // ===== Validación estructural previa al acceso de datos =====

  const validIds = [
    input.uploadId,
    input.attachmentId,
    input.familyId,
    input.serviceId,
  ].every((value) => UUID_PATTERN.test(value));

  const validTitle =
    typeof input.title === "string" &&
    input.title.trim().length >= 2 &&
    input.title.trim().length <= 150;

  return (
    validIds &&
    validTitle &&
    allowedKinds.has(input.kind) &&
    typeof input.originalFilename === "string"
  );
}

Deno.serve(async (request) => {
  // ===== Validación del método y autorización =====

  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return jsonResponse({}, 204, origin);
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { code: "METHOD_NOT_ALLOWED", message: "Método no permitido." },
      405,
      origin,
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(
      { code: "UNAUTHORIZED", message: "Inicia sesión para continuar." },
      401,
      origin,
    );
  }

  const accessToken = authorization.slice("Bearer ".length);

  // ===== Validación de configuración y sesión =====

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return jsonResponse(
      {
        code: "SERVER_CONFIGURATION",
        message: "El servicio no está configurado.",
      },
      500,
      origin,
    );
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } =
    await adminClient.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return jsonResponse(
      { code: "UNAUTHORIZED", message: "La sesión ya no es válida." },
      401,
      origin,
    );
  }

  // ===== Lectura y validación de la solicitud =====

  let input: FinalizeServiceAttachmentInput;

  try {
    input = await request.json();
  } catch {
    return jsonResponse(
      { code: "INVALID_BODY", message: "Los datos enviados no son válidos." },
      422,
      origin,
    );
  }

  if (!isValidInput(input)) {
    return jsonResponse(
      { code: "INVALID_BODY", message: "Revisa los datos del archivo." },
      422,
      origin,
    );
  }

  // ===== Descarga y validación del archivo temporal =====

  const stagedPath = `staging/${userData.user.id}/${input.uploadId}`;
  const finalPath =
    `families/${input.familyId}/vehicle-services/${input.serviceId}` +
    `/attachments/${input.attachmentId}`;
  const storage = adminClient.storage.from("documents");
  const { data: stagedFile, error: downloadError } =
    await storage.download(stagedPath);

  if (downloadError || !stagedFile) {
    // ------- Responder de forma idempotente si la operación ya terminó -------

    const { data: existingAttachment } = await userClient
      .from("vehicle_service_attachments")
      .select("id")
      .eq("id", input.attachmentId)
      .maybeSingle();

    if (existingAttachment) {
      return jsonResponse({ attachmentId: existingAttachment.id }, 200, origin);
    }

    return jsonResponse(
      {
        code: "UPLOAD_NOT_FOUND",
        message: "La carga expiró. Vuelve a seleccionar el archivo.",
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
        message: "Cada archivo debe pesar como máximo 10 MiB.",
      },
      422,
      origin,
    );
  }

  const fileBuffer = await stagedFile.arrayBuffer();
  const bytes = new Uint8Array(fileBuffer);
  const detectedMimeType = detectMimeType(bytes);

  if (!detectedMimeType) {
    await storage.remove([stagedPath]);

    return jsonResponse(
      {
        code: "INVALID_FILE_TYPE",
        message: "Usa un archivo PDF, JPEG o PNG válido.",
      },
      422,
      origin,
    );
  }

  const originalFilename = normalizeFilename(input.originalFilename);

  if (!originalFilename) {
    await storage.remove([stagedPath]);

    return jsonResponse(
      {
        code: "INVALID_FILENAME",
        message: "El nombre del archivo no es válido.",
      },
      422,
      origin,
    );
  }

  // ===== Movimiento y registro definitivo =====

  const sha256 = toHex(await crypto.subtle.digest("SHA-256", fileBuffer));
  const { error: moveError } = await storage.move(stagedPath, finalPath);

  if (moveError) {
    return jsonResponse(
      {
        code: "FILE_MOVE_FAILED",
        message: "No pudimos preparar el archivo. Intenta de nuevo.",
      },
      500,
      origin,
    );
  }

  const { data: attachment, error: finalizeError } = await adminClient.rpc(
    "finalize_vehicle_service_attachment",
    {
      attachment_id: input.attachmentId,
      target_family_id: input.familyId,
      target_service_id: input.serviceId,
      actor_user_id: userData.user.id,
      attachment_kind: input.kind,
      attachment_title: input.title.trim(),
      file_original_filename: originalFilename,
      file_storage_key: finalPath,
      file_detected_mime_type: detectedMimeType,
      file_size_bytes: stagedFile.size,
      file_sha256: sha256,
    },
  );

  if (finalizeError || !attachment) {
    // ------- Devolver el archivo a staging para permitir un nuevo intento -------

    await storage.move(finalPath, stagedPath);

    return jsonResponse(
      {
        code: "ATTACHMENT_CREATE_FAILED",
        message: "No pudimos guardar el archivo. Intenta de nuevo.",
      },
      422,
      origin,
    );
  }

  return jsonResponse({ attachment }, 201, origin);
});
