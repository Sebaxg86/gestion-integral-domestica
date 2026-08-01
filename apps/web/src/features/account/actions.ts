"use server";

import { familySchema, fullNameSchema } from "@gid/validation";
import { revalidatePath } from "next/cache";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = fullNameSchema.safeParse(formData.get("fullName"));
  if (!result.success)
    return {
      errors: { fullName: result.error.issues.map((issue) => issue.message) },
    };
  const version = Number(formData.get("version"));
  if (!Number.isSafeInteger(version))
    return { message: "La versión del perfil no es válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_profile", {
    profile_full_name: result.data,
    expected_version: version,
  });
  if (error)
    return {
      message: "El perfil cambió o no pudo guardarse. Actualiza la página.",
    };
  revalidatePath("/app/cuenta");
  return { message: "Perfil actualizado." };
}

export async function updateFamilyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = familySchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });
  if (!result.success) return { errors: getFieldErrors(result.error) };
  const version = Number(formData.get("version"));
  const familyId = String(formData.get("familyId"));
  if (!familyId || !Number.isSafeInteger(version))
    return { message: "Los datos de la familia no son válidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_family", {
    target_family_id: familyId,
    family_name: result.data.name,
    family_timezone: result.data.timezone,
    expected_version: version,
  });
  if (error)
    return {
      message: "La familia cambió o no pudo guardarse. Actualiza la página.",
    };
  revalidatePath("/app/cuenta");
  revalidatePath("/app");
  return { message: "Configuración familiar actualizada." };
}
