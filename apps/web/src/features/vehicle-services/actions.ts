"use server";

import {
  vehicleServiceItemSchema,
  vehicleServicePartSchema,
  vehicleServiceSchema,
} from "@gid/validation";
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

// ============================================================================
// Gestión del detalle de mantenimiento
// ============================================================================

function optionalFormValue(formData: FormData, name: string) {
  // ===== Normalización de campos opcionales =====

  const value = String(formData.get(name) ?? "").trim();

  if (!value) {
    return undefined;
  }

  return value;
}

function getServicePath(formData: FormData) {
  // ===== Validación de la ruta propietaria =====

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");

  if (!vehicleId || !serviceId) {
    return null;
  }

  return {
    vehicleId,
    serviceId,
    path: `/app/vehiculos/${vehicleId}/mantenimientos/${serviceId}`,
  };
}

export async function createServiceItemAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos y destino =====

  const result = vehicleServiceItemSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    status: formData.get("status"),
    notes: optionalFormValue(formData, "notes"),
    warrantyUntil: optionalFormValue(formData, "warrantyUntil"),
  });
  const serviceRoute = getServicePath(formData);

  if (!result.success) {
    return { errors: getFieldErrors(result.error) };
  }

  if (!serviceRoute) {
    return { message: "El servicio no es válido." };
  }

  // ===== Persistencia del trabajo =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_vehicle_service_item", {
    target_service_id: serviceRoute.serviceId,
    item_category: result.data.category,
    item_description: result.data.description,
    item_status: result.data.status,
    item_notes: result.data.notes ?? "",
    item_warranty_until: result.data.warrantyUntil ?? null,
  });

  if (error) {
    return { message: "No pudimos agregar el trabajo. Intenta de nuevo." };
  }

  // ===== Actualización de las vistas relacionadas =====

  revalidatePath(`/app/vehiculos/${serviceRoute.vehicleId}`);
  revalidatePath(serviceRoute.path);
  redirect(serviceRoute.path);
}

export async function setServiceItemStatusAction(formData: FormData) {
  // ===== Validación de la operación =====

  const serviceRoute = getServicePath(formData);
  const itemId = String(formData.get("itemId") ?? "");
  const status = String(formData.get("status") ?? "");
  const version = Number(formData.get("version"));
  const validStatuses = new Set(["reviewed", "completed", "pending"]);

  if (
    !serviceRoute ||
    !itemId ||
    !validStatuses.has(status) ||
    !Number.isSafeInteger(version)
  ) {
    return;
  }

  // ===== Persistencia y actualización de la vista =====

  const supabase = await createClient();
  await supabase.rpc("set_vehicle_service_item_status", {
    target_item_id: itemId,
    item_status: status,
    expected_version: version,
  });
  revalidatePath(serviceRoute.path);
}

export async function archiveServiceItemAction(formData: FormData) {
  // ===== Validación de la operación =====

  const serviceRoute = getServicePath(formData);
  const itemId = String(formData.get("itemId") ?? "");
  const version = Number(formData.get("version"));

  if (!serviceRoute || !itemId || !Number.isSafeInteger(version)) {
    return;
  }

  // ===== Archivado y actualización de la vista =====

  const supabase = await createClient();
  await supabase.rpc("archive_vehicle_service_item", {
    target_item_id: itemId,
    expected_version: version,
  });
  revalidatePath(serviceRoute.path);
}

export async function createServicePartAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos y destino =====

  const result = vehicleServicePartSchema.safeParse({
    serviceItemId: optionalFormValue(formData, "serviceItemId"),
    name: formData.get("name"),
    brand: optionalFormValue(formData, "brand"),
    partNumber: optionalFormValue(formData, "partNumber"),
    quantity: formData.get("quantity"),
    unitCost: optionalFormValue(formData, "unitCost"),
    warrantyUntil: optionalFormValue(formData, "warrantyUntil"),
    notes: optionalFormValue(formData, "notes"),
  });
  const serviceRoute = getServicePath(formData);

  if (!result.success) {
    return { errors: getFieldErrors(result.error) };
  }

  if (!serviceRoute) {
    return { message: "El servicio no es válido." };
  }

  // ===== Persistencia de la refacción =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_vehicle_service_part", {
    target_service_id: serviceRoute.serviceId,
    target_item_id: result.data.serviceItemId ?? null,
    part_name: result.data.name,
    part_brand: result.data.brand ?? "",
    part_number_value: result.data.partNumber ?? "",
    part_quantity: result.data.quantity,
    part_unit_cost: result.data.unitCost ?? null,
    part_warranty_until: result.data.warrantyUntil ?? null,
    part_notes: result.data.notes ?? "",
  });

  if (error) {
    return { message: "No pudimos agregar la refacción. Intenta de nuevo." };
  }

  // ===== Actualización de las vistas relacionadas =====

  revalidatePath(serviceRoute.path);
  redirect(serviceRoute.path);
}

export async function archiveServicePartAction(formData: FormData) {
  // ===== Validación de la operación =====

  const serviceRoute = getServicePath(formData);
  const partId = String(formData.get("partId") ?? "");
  const version = Number(formData.get("version"));

  if (!serviceRoute || !partId || !Number.isSafeInteger(version)) {
    return;
  }

  // ===== Archivado y actualización de la vista =====

  const supabase = await createClient();
  await supabase.rpc("archive_vehicle_service_part", {
    target_part_id: partId,
    expected_version: version,
  });
  revalidatePath(serviceRoute.path);
}

export async function archiveServiceAttachmentAction(formData: FormData) {
  // ===== Validación de la operación =====

  const serviceRoute = getServicePath(formData);
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const version = Number(formData.get("version"));

  if (!serviceRoute || !attachmentId || !Number.isSafeInteger(version)) {
    return;
  }

  // ===== Archivado y actualización de la vista =====

  const supabase = await createClient();
  await supabase.rpc("archive_vehicle_service_attachment", {
    target_attachment_id: attachmentId,
    expected_version: version,
  });
  revalidatePath(serviceRoute.path);
}
