"use server";

import { propertySchema } from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Gestión de viviendas
// ============================================================================

export async function createPropertyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos =====

  const result = propertySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    address: formData.get("address") ?? "",
  });
  if (!result.success) return { errors: getFieldErrors(result.error) };

  // ===== Consulta del contexto familiar =====

  const context = await getSessionContext();
  if (!context?.family) return { message: "Tu sesión ya no es válida." };

  // ===== Creación de la vivienda =====

  const propertyId = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_property", {
    property_id: propertyId,
    target_family_id: context.family.id,
    property_name: result.data.name,
    property_type: result.data.type,
    property_address: result.data.address,
  });
  if (error)
    return { message: "No pudimos guardar la vivienda. Revisa los datos." };

  redirect(`/app/viviendas/${propertyId}`);
}

export async function setPropertyArchivedAction(formData: FormData) {
  // ===== Extracción y validación de datos =====

  const propertyId = String(formData.get("propertyId"));
  const version = Number(formData.get("version"));
  const archive = formData.get("archive") === "true";
  if (!propertyId || !Number.isSafeInteger(version)) return;

  // ===== Persistencia del estado =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_property_archived", {
    target_property_id: propertyId,
    archive,
    expected_version: version,
  });
  if (error) return;

  // ===== Actualización de la interfaz =====

  revalidatePath("/app/viviendas");
  redirect(archive ? "/app/viviendas" : `/app/viviendas/${propertyId}`);
}

export async function updatePropertyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos editables =====

  const result = propertySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    address: formData.get("address") ?? "",
  });
  if (!result.success) return { errors: getFieldErrors(result.error) };

  // ===== Validación de identidad y versión =====

  const propertyId = String(formData.get("propertyId"));
  const version = Number(formData.get("version"));
  if (!propertyId || !Number.isSafeInteger(version))
    return { message: "Los datos de la vivienda no son válidos." };

  // ===== Persistencia de cambios =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_property", {
    target_property_id: propertyId,
    property_name: result.data.name,
    property_type: result.data.type,
    property_address: result.data.address,
    expected_version: version,
  });
  if (error)
    return {
      message: "La vivienda cambió o no pudo guardarse. Actualiza la página.",
    };

  // ===== Actualización de la interfaz =====

  revalidatePath(`/app/viviendas/${propertyId}`);
  redirect(`/app/viviendas/${propertyId}`);
}
