"use server";

import { vehicleServiceSchema } from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Gestión de servicios vehiculares
// ============================================================================

function parseServiceForm(formData: FormData) {
  // ===== Normalización de campos opcionales =====

  const optional = (name: string) =>
    String(formData.get(name) ?? "") || undefined;

  return vehicleServiceSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    status: formData.get("status"),
    serviceDate: optional("serviceDate"),
    mileage: optional("mileage"),
    provider: optional("provider"),
    cost: optional("cost"),
    notes: optional("notes"),
    nextDueDate: optional("nextDueDate"),
    nextDueMileage: optional("nextDueMileage"),
    leadDays: optional("leadDays"),
    repeatIntervalDays: optional("repeatIntervalDays"),
  });
}

function serviceRpcInput(data: ReturnType<typeof vehicleServiceSchema.parse>) {
  // ===== Adaptación al contrato de base de datos =====

  return {
    service_title: data.title,
    service_type: data.type,
    service_status: data.status,
    service_date_value: data.serviceDate ?? null,
    service_mileage: data.mileage ?? null,
    service_provider: data.provider ?? "",
    service_cost: data.cost ?? null,
    service_notes: data.notes ?? "",
    service_next_due_date: data.nextDueDate ?? null,
    service_next_due_mileage: data.nextDueMileage ?? null,
    reminder_lead_days:
      data.nextDueDate && data.leadDays !== undefined ? data.leadDays : null,
    reminder_repeat_interval_days: data.repeatIntervalDays ?? null,
  };
}

export async function createVehicleServiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos =====

  const result = parseServiceForm(formData);
  if (!result.success) return { errors: getFieldErrors(result.error) };

  const vehicleId = String(formData.get("vehicleId"));
  if (!vehicleId) return { message: "El vehículo no es válido." };

  // ===== Persistencia del servicio =====

  const serviceId = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_vehicle_service", {
    service_id: serviceId,
    target_vehicle_id: vehicleId,
    ...serviceRpcInput(result.data),
  });

  if (error) {
    return { message: "No pudimos guardar el servicio. Revisa los datos." };
  }

  redirect(`/app/vehiculos/${vehicleId}/mantenimientos/${serviceId}`);
}

export async function updateVehicleServiceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos =====

  const result = parseServiceForm(formData);
  if (!result.success) return { errors: getFieldErrors(result.error) };

  const vehicleId = String(formData.get("vehicleId"));
  const serviceId = String(formData.get("serviceId"));
  const version = Number(formData.get("version"));

  if (!vehicleId || !serviceId || !Number.isSafeInteger(version)) {
    return { message: "Los datos del servicio no son válidos." };
  }

  // ===== Persistencia y actualización de la interfaz =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_vehicle_service", {
    target_service_id: serviceId,
    expected_version: version,
    ...serviceRpcInput(result.data),
  });

  if (error) {
    return { message: "El servicio cambió o no pudo guardarse." };
  }

  revalidatePath(`/app/vehiculos/${vehicleId}`);
  redirect(`/app/vehiculos/${vehicleId}/mantenimientos/${serviceId}`);
}

export async function attendServiceReminderAction(formData: FormData) {
  // ===== Validación del recordatorio =====

  const reminderId = String(formData.get("reminderId"));
  const vehicleId = String(formData.get("vehicleId"));
  const serviceId = String(formData.get("serviceId"));
  const version = Number(formData.get("version"));

  if (
    !reminderId ||
    !vehicleId ||
    !serviceId ||
    !Number.isSafeInteger(version)
  ) {
    return;
  }

  // ===== Persistencia y actualización de la interfaz =====

  const supabase = await createClient();
  await supabase.rpc("attend_reminder", {
    target_reminder_id: reminderId,
    expected_version: version,
  });
  revalidatePath(`/app/vehiculos/${vehicleId}/mantenimientos/${serviceId}`);
  revalidatePath("/app/avisos");
}
