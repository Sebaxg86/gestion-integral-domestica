import { createClient } from "npm:@supabase/supabase-js@2";

import {
  detectMimeType,
  MAX_FILE_SIZE,
  normalizeFilename,
  toHex,
  UUID_PATTERN,
} from "../_shared/files.ts";

type FinalizeDocumentInput = {
  uploadId: string;
  documentId: string;
  fileId: string;
  familyId: string;
  propertyId?: string | null;
  vehicleId?: string | null;
  name: string;
  category: string;
  issueDate?: string | null;
  expirationDate?: string | null;
  issuer?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  originalFilename: string;
};

// ============================================================================
// Finalización segura de documentos
// ============================================================================

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

function allowedOrigin(origin: string | null) {
  const appUrl = Deno.env.get("APP_URL");
  const allowedOrigins = new Set([
    appUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  return origin && allowedOrigins.has(origin)
    ? origin
    : (appUrl ?? "http://localhost:3000");
}

function isValidInput(input: FinalizeDocumentInput) {
  const hasValidProperty =
    typeof input.propertyId === "string" && UUID_PATTERN.test(input.propertyId);
  const hasValidVehicle =
    typeof input.vehicleId === "string" && UUID_PATTERN.test(input.vehicleId);

  return (
    [input.uploadId, input.documentId, input.fileId, input.familyId].every(
      (value) => UUID_PATTERN.test(value),
    ) &&
    hasValidProperty !== hasValidVehicle &&
    typeof input.name === "string" &&
    typeof input.category === "string" &&
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

  let input: FinalizeDocumentInput;
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
      { code: "INVALID_BODY", message: "Revisa los datos del documento." },
      422,
      origin,
    );
  }

  // ===== Descarga y validación del archivo temporal =====

  const stagedPath = `staging/${userData.user.id}/${input.uploadId}`;
  const finalPath = `families/${input.familyId}/documents/${input.documentId}/files/${input.fileId}`;
  const storage = adminClient.storage.from("documents");
  const { data: stagedFile, error: downloadError } =
    await storage.download(stagedPath);

  if (downloadError || !stagedFile) {
    const { data: existingDocument } = await userClient
      .from("documents")
      .select("id")
      .eq("id", input.documentId)
      .maybeSingle();

    if (existingDocument) {
      return jsonResponse({ documentId: existingDocument.id }, 200, origin);
    }

    return jsonResponse(
      {
        code: "UPLOAD_NOT_FOUND",
        message:
          "La carga expiró o no existe. Vuelve a seleccionar el archivo.",
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

  // ===== Persistencia del archivo y documento =====

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

  // ===== Enrutamiento según el recurso propietario =====

  const documentInput = {
    actor_user_id: userData.user.id,
    document_id: input.documentId,
    file_id: input.fileId,
    target_family_id: input.familyId,
    document_name: input.name,
    document_category: input.category,
    document_issue_date: input.issueDate ?? null,
    document_expiration_date: input.expirationDate ?? null,
    document_issuer: input.issuer ?? null,
    document_number_value: input.documentNumber ?? null,
    document_notes: input.notes ?? null,
    file_storage_key: finalPath,
    file_original_filename: originalFilename,
    file_detected_mime_type: detectedMimeType,
    file_size_bytes: stagedFile.size,
    file_sha256: sha256,
  };

  const finalizeResult = input.vehicleId
    ? await adminClient.rpc("finalize_vehicle_document_upload", {
        ...documentInput,
        target_vehicle_id: input.vehicleId,
      })
    : await adminClient.rpc("finalize_document_upload", {
        ...documentInput,
        target_property_id: input.propertyId,
      });
  const { data: document, error: finalizeError } = finalizeResult;

  if (finalizeError || !document) {
    await storage.move(finalPath, stagedPath);
    return jsonResponse(
      {
        code: "DOCUMENT_CREATE_FAILED",
        message:
          "No pudimos guardar el documento. Revisa los datos e intenta de nuevo.",
      },
      422,
      origin,
    );
  }

  return jsonResponse({ document }, 201, origin);
});
