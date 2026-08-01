"use server";

import { vehicleSchema } from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Gestión de vehículos
// ============================================================================

function parseVehicleForm(formData: FormData) {
  // ===== Normalización de campos opcionales =====

  return vehicleSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    make: String(formData.get("make") ?? "") || undefined,
    model: String(formData.get("model") ?? "") || undefined,
    modelYear: String(formData.get("modelYear") ?? "") || undefined,
    trim: String(formData.get("trim") ?? "") || undefined,
    color: String(formData.get("color") ?? "") || undefined,
    vin: String(formData.get("vin") ?? "") || undefined,
    licensePlate: String(formData.get("licensePlate") ?? "") || undefined,
    mileage: String(formData.get("mileage") ?? "") || undefined,
    fuelType: String(formData.get("fuelType") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
}

function vehicleRpcInput(data: ReturnType<typeof vehicleSchema.parse>) {
  // ===== Adaptación al contrato de base de datos =====

  return {
    vehicle_name: data.name,
    vehicle_type: data.type,
    vehicle_make: data.make ?? "",
    vehicle_model: data.model ?? "",
    vehicle_model_year: data.modelYear ?? null,
    vehicle_trim: data.trim ?? "",
    vehicle_color: data.color ?? "",
    vehicle_vin: data.vin ?? "",
    vehicle_license_plate: data.licensePlate ?? "",
    vehicle_mileage: data.mileage ?? null,
    vehicle_fuel_type: data.fuelType ?? "",
    vehicle_notes: data.notes ?? "",
  };
}

export async function createVehicleAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos =====

  const result = parseVehicleForm(formData);
  if (!result.success) return { errors: getFieldErrors(result.error) };

  // ===== Consulta del contexto familiar =====

  const context = await getSessionContext();
  if (!context?.family) return { message: "Tu sesión ya no es válida." };

  // ===== Creación del vehículo =====

  const vehicleId = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_vehicle", {
    vehicle_id: vehicleId,
    target_family_id: context.family.id,
    ...vehicleRpcInput(result.data),
  });

  if (error) {
    return { message: "No pudimos guardar el vehículo. Revisa los datos." };
  }

  redirect(`/app/vehiculos/${vehicleId}`);
}

export async function updateVehicleAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos editables =====

  const result = parseVehicleForm(formData);
  if (!result.success) return { errors: getFieldErrors(result.error) };

  // ===== Validación de identidad y versión =====

  const vehicleId = String(formData.get("vehicleId"));
  const version = Number(formData.get("version"));

  if (!vehicleId || !Number.isSafeInteger(version)) {
    return { message: "Los datos del vehículo no son válidos." };
  }

  // ===== Persistencia de cambios =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_vehicle", {
    target_vehicle_id: vehicleId,
    expected_version: version,
    ...vehicleRpcInput(result.data),
  });

  if (error) {
    return {
      message: "El vehículo cambió o no pudo guardarse. Actualiza la página.",
    };
  }

  revalidatePath(`/app/vehiculos/${vehicleId}`);
  redirect(`/app/vehiculos/${vehicleId}`);
}

export async function setVehicleArchivedAction(formData: FormData) {
  // ===== Extracción y validación de datos =====

  const vehicleId = String(formData.get("vehicleId"));
  const version = Number(formData.get("version"));
  const archive = formData.get("archive") === "true";

  if (!vehicleId || !Number.isSafeInteger(version)) return;

  // ===== Persistencia y actualización de la interfaz =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_archived", {
    target_vehicle_id: vehicleId,
    archive,
    expected_version: version,
  });

  if (error) return;

  revalidatePath("/app/vehiculos");
  revalidatePath("/app/archivo");
  redirect(archive ? "/app/vehiculos" : `/app/vehiculos/${vehicleId}`);
}
