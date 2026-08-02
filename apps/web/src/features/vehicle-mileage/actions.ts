"use server";

import {
  vehicleMileageReadingSchema,
  vehicleMileageReminderSchema,
} from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Gestión del kilometraje vehicular
// ============================================================================

function getVehicleId(formData: FormData) {
  // ===== Normalización del recurso propietario =====

  return String(formData.get("vehicleId") ?? "").trim();
}

export async function recordVehicleMileageAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de los datos capturados =====

  const notes = String(formData.get("notes") ?? "").trim();
  const result = vehicleMileageReadingSchema.safeParse({
    mileage: formData.get("mileage"),
    recordedOn: formData.get("recordedOn"),
    notes: notes || undefined,
  });
  const vehicleId = getVehicleId(formData);

  if (!result.success) {
    return { errors: getFieldErrors(result.error) };
  }

  if (!vehicleId) {
    return { message: "El vehículo no es válido." };
  }

  // ===== Persistencia de la lectura =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_vehicle_mileage", {
    reading_id: crypto.randomUUID(),
    target_vehicle_id: vehicleId,
    reading_mileage: result.data.mileage,
    reading_recorded_on: result.data.recordedOn,
    reading_notes: result.data.notes ?? "",
  });

  if (error) {
    return {
      message:
        "No pudimos guardar la lectura. Usa un kilometraje igual o mayor al actual.",
    };
  }

  // ===== Actualización de las vistas relacionadas =====

  revalidatePath("/app");
  revalidatePath(`/app/vehiculos/${vehicleId}`);
  redirect(`/app/vehiculos/${vehicleId}`);
}

export async function configureMileageReminderAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de frecuencia y vehículo =====

  const result = vehicleMileageReminderSchema.safeParse({
    intervalDays: formData.get("intervalDays"),
  });
  const vehicleId = getVehicleId(formData);

  if (!result.success || !vehicleId) {
    return { message: "La configuración seleccionada no es válida." };
  }

  const intervalDays =
    result.data.intervalDays === "off"
      ? null
      : Number(result.data.intervalDays);

  // ===== Persistencia de la configuración =====

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "configure_vehicle_mileage_reminder",
    {
      target_vehicle_id: vehicleId,
      interval_days: intervalDays,
    },
  );

  if (error) {
    return { message: "No pudimos actualizar el recordatorio." };
  }

  // ===== Actualización de la interfaz =====

  revalidatePath(`/app/vehiculos/${vehicleId}`);

  return { message: "Recordatorio actualizado." };
}
