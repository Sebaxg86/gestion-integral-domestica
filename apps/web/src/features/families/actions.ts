"use server";

import { familySchema } from "@gid/validation";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { type FormState, getFieldErrors } from "@/features/shared/form-state";

export async function createFamilyAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = familySchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });

  if (!result.success) return { errors: getFieldErrors(result.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_family", {
    family_id: crypto.randomUUID(),
    family_name: result.data.name,
    family_timezone: result.data.timezone,
  });

  if (error) {
    return { message: error.message || "No pudimos crear tu familia." };
  }

  redirect("/app");
}
