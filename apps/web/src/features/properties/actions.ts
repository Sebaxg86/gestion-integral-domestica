"use server";

import { propertySchema } from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createPropertyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = propertySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    address: formData.get("address") ?? "",
  });
  if (!result.success) return { errors: getFieldErrors(result.error) };

  const context = await getSessionContext();
  if (!context?.family) return { message: "Tu sesión ya no es válida." };

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
  const propertyId = String(formData.get("propertyId"));
  const version = Number(formData.get("version"));
  const archive = formData.get("archive") === "true";
  if (!propertyId || !Number.isSafeInteger(version)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_property_archived", {
    target_property_id: propertyId,
    archive,
    expected_version: version,
  });
  if (error) return;

  revalidatePath("/app/viviendas");
  redirect(archive ? "/app/viviendas" : `/app/viviendas/${propertyId}`);
}

export async function updatePropertyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = propertySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    address: formData.get("address") ?? "",
  });
  if (!result.success) return { errors: getFieldErrors(result.error) };

  const propertyId = String(formData.get("propertyId"));
  const version = Number(formData.get("version"));
  if (!propertyId || !Number.isSafeInteger(version))
    return { message: "Los datos de la vivienda no son válidos." };

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
  revalidatePath(`/app/viviendas/${propertyId}`);
  redirect(`/app/viviendas/${propertyId}`);
}
