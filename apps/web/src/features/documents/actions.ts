"use server";

import { documentSchema } from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { createClient } from "@/lib/supabase/server";

export async function setDocumentArchivedAction(formData: FormData) {
  const documentId = String(formData.get("documentId"));
  const propertyId = String(formData.get("propertyId"));
  const version = Number(formData.get("version"));
  const archive = formData.get("archive") === "true";
  if (!documentId || !Number.isSafeInteger(version)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_archived", {
    target_document_id: documentId,
    archive,
    expected_version: version,
  });
  if (error) return;

  revalidatePath(`/app/viviendas/${propertyId}`);
  redirect(
    archive ? `/app/viviendas/${propertyId}` : `/app/documentos/${documentId}`,
  );
}

export async function attendReminderAction(formData: FormData) {
  const reminderId = String(formData.get("reminderId"));
  const documentId = String(formData.get("documentId"));
  const version = Number(formData.get("version"));
  if (!reminderId || !Number.isSafeInteger(version)) return;

  const supabase = await createClient();
  await supabase.rpc("attend_reminder", {
    target_reminder_id: reminderId,
    expected_version: version,
  });
  revalidatePath(`/app/documentos/${documentId}`);
  revalidatePath("/app");
}

export async function createReminderAction(formData: FormData) {
  const documentId = String(formData.get("documentId"));
  const leadDays = Number(formData.get("leadDays"));
  const repeatValue = String(formData.get("repeatIntervalDays") ?? "");
  const repeatIntervalDays = repeatValue ? Number(repeatValue) : null;
  if (
    !documentId ||
    ![0, 1, 3, 7, 15, 30].includes(leadDays) ||
    (repeatIntervalDays !== null && ![1, 7].includes(repeatIntervalDays))
  )
    return;

  const supabase = await createClient();
  await supabase.rpc("create_reminder", {
    reminder_id: crypto.randomUUID(),
    target_document_id: documentId,
    reminder_lead_days: leadDays,
    reminder_repeat_interval_days: repeatIntervalDays,
  });
  revalidatePath(`/app/documentos/${documentId}`);
}

export async function updateDocumentAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = documentSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    issueDate: String(formData.get("issueDate") ?? "") || undefined,
    expirationDate: String(formData.get("expirationDate") ?? "") || undefined,
    issuer: String(formData.get("issuer") ?? "") || undefined,
    documentNumber: String(formData.get("documentNumber") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  if (!result.success) return { errors: getFieldErrors(result.error) };

  const documentId = String(formData.get("documentId"));
  const version = Number(formData.get("version"));
  if (!documentId || !Number.isSafeInteger(version))
    return { message: "Los datos del documento no son válidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_document", {
    target_document_id: documentId,
    document_name: result.data.name,
    document_category: result.data.category,
    document_issue_date: result.data.issueDate || null,
    document_expiration_date: result.data.expirationDate || null,
    document_issuer: result.data.issuer || null,
    document_number_value: result.data.documentNumber || null,
    document_notes: result.data.notes || null,
    expected_version: version,
  });
  if (error)
    return {
      message: "El documento cambió o no pudo guardarse. Actualiza la página.",
    };
  revalidatePath(`/app/documentos/${documentId}`);
  redirect(`/app/documentos/${documentId}`);
}

export async function cancelReminderAction(formData: FormData) {
  const reminderId = String(formData.get("reminderId"));
  const documentId = String(formData.get("documentId"));
  const version = Number(formData.get("version"));
  if (!reminderId || !Number.isSafeInteger(version)) return;
  const supabase = await createClient();
  await supabase.rpc("cancel_reminder", {
    target_reminder_id: reminderId,
    expected_version: version,
  });
  revalidatePath(`/app/documentos/${documentId}`);
}

export async function updateReminderAction(formData: FormData) {
  const reminderId = String(formData.get("reminderId"));
  const documentId = String(formData.get("documentId"));
  const version = Number(formData.get("version"));
  const leadDays = Number(formData.get("leadDays"));
  const repeatValue = String(formData.get("repeatIntervalDays") ?? "");
  const repeatIntervalDays = repeatValue ? Number(repeatValue) : null;
  if (
    !reminderId ||
    !Number.isSafeInteger(version) ||
    ![0, 1, 3, 7, 15, 30].includes(leadDays) ||
    (repeatIntervalDays !== null && ![1, 7].includes(repeatIntervalDays))
  )
    return;
  const supabase = await createClient();
  await supabase.rpc("update_reminder", {
    target_reminder_id: reminderId,
    reminder_lead_days: leadDays,
    expected_version: version,
    reminder_repeat_interval_days: repeatIntervalDays,
  });
  revalidatePath(`/app/documentos/${documentId}`);
}
