"use server";

import { scheduledServiceSchema } from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Gestión de servicios programados
// ============================================================================

function optionalFormValue(formData: FormData, name: string) {
  // ===== Normalización de campos opcionales =====

  return String(formData.get(name) ?? "").trim() || undefined;
}

function parseScheduledServiceForm(formData: FormData) {
  // ===== Validación compartida del formulario =====

  return scheduledServiceSchema.safeParse({
    name: formData.get("name"),
    propertyId: optionalFormValue(formData, "propertyId"),
    category: formData.get("category"),
    provider: optionalFormValue(formData, "provider"),
    recurrence: formData.get("recurrence"),
    customIntervalDays: optionalFormValue(formData, "customIntervalDays"),
    dueDate: formData.get("dueDate"),
    leadDays: formData.get("leadDays"),
    repeatIntervalDays: formData.get("repeatIntervalDays"),
    notes: optionalFormValue(formData, "notes"),
  });
}

function scheduledServiceRpcInput(
  data: ReturnType<typeof scheduledServiceSchema.parse>,
) {
  // ===== Adaptación al contrato de base de datos =====

  return {
    target_property_id: data.propertyId ?? null,
    service_name: data.name,
    service_category: data.category,
    service_provider: data.provider ?? "",
    recurrence_value: data.recurrence,
    custom_days:
      data.recurrence === "custom_days"
        ? (data.customIntervalDays ?? null)
        : null,
    next_due_date: data.dueDate,
    reminder_lead_days: data.leadDays,
    reminder_repeat_interval_days:
      data.repeatIntervalDays === "off"
        ? null
        : Number(data.repeatIntervalDays),
    service_notes: data.notes ?? "",
  };
}

export async function createScheduledServiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos y familia =====

  const result = parseScheduledServiceForm(formData);
  if (!result.success) return { errors: getFieldErrors(result.error) };

  const context = await getSessionContext();
  if (!context?.family) return { message: "Tu sesión ya no es válida." };

  // ===== Creación atómica de la programación =====

  const serviceId = crypto.randomUUID();
  const supabase = await createClient();
  const input = scheduledServiceRpcInput(result.data);
  const { next_due_date: firstDueDate, ...serviceInput } = input;
  const { error } = await supabase.rpc("create_scheduled_service", {
    service_id: serviceId,
    occurrence_id: crypto.randomUUID(),
    target_family_id: context.family.id,
    ...serviceInput,
    first_due_date: firstDueDate,
  });

  if (error) {
    return { message: "No pudimos programar el servicio. Revisa los datos." };
  }

  redirect(`/app/servicios/${serviceId}`);
}

export async function updateScheduledServiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos e identidad =====

  const result = parseScheduledServiceForm(formData);
  if (!result.success) return { errors: getFieldErrors(result.error) };

  const serviceId = String(formData.get("serviceId") ?? "");
  const version = Number(formData.get("version"));
  if (!serviceId || !Number.isSafeInteger(version)) {
    return { message: "Los datos del servicio no son válidos." };
  }

  // ===== Persistencia y actualización de la interfaz =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_scheduled_service", {
    target_service_id: serviceId,
    expected_version: version,
    ...scheduledServiceRpcInput(result.data),
  });

  if (error) {
    return { message: "El servicio cambió o no pudo guardarse." };
  }

  revalidatePath("/app");
  revalidatePath("/app/servicios");
  revalidatePath("/app/avisos");
  redirect(`/app/servicios/${serviceId}`);
}

export async function resolveScheduledServiceOccurrenceAction(
  formData: FormData,
) {
  // ===== Validación de la resolución solicitada =====

  const serviceId = String(formData.get("serviceId") ?? "");
  const occurrenceId = String(formData.get("occurrenceId") ?? "");
  const status = String(formData.get("status") ?? "");
  const version = Number(formData.get("version"));

  if (
    !serviceId ||
    !occurrenceId ||
    !["attended", "skipped"].includes(status) ||
    !Number.isSafeInteger(version)
  ) {
    return;
  }

  // ===== Resolución y generación automática de la siguiente fecha =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_scheduled_service_occurrence", {
    target_occurrence_id: occurrenceId,
    resolution_status: status,
    expected_version: version,
  });

  if (error) return;

  revalidatePath("/app");
  revalidatePath("/app/servicios");
  revalidatePath(`/app/servicios/${serviceId}`);
  revalidatePath("/app/avisos");
}

export async function cancelScheduledServiceAction(formData: FormData) {
  // ===== Validación del servicio activo =====

  const serviceId = String(formData.get("serviceId") ?? "");
  const version = Number(formData.get("version"));
  if (!serviceId || !Number.isSafeInteger(version)) return;

  // ===== Cancelación de la programación pendiente =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_scheduled_service", {
    target_service_id: serviceId,
    expected_version: version,
  });

  if (error) return;

  revalidatePath("/app");
  revalidatePath("/app/servicios");
  revalidatePath("/app/avisos");
  redirect("/app/servicios");
}
