"use server";

import {
  emailSchema,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from "@gid/validation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  activityCookieOptions,
  policyCookieOptions,
  SESSION_ACTIVITY_COOKIE,
  SESSION_POLICY_COOKIE,
  SESSION_POLICY_VERSION,
} from "@/lib/supabase/cookie-options";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  message?: string;
  errors?: Record<string, string[]>;
};

// ============================================================================
// Gestión de autenticación
// ============================================================================

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const entries = Object.entries(error.flatten().fieldErrors).filter(
    (entry): entry is [string, string[]] => Boolean(entry[1]),
  );
  return Object.fromEntries(entries);
}

export async function signUpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // ===== Validación de datos =====

  const result = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) return { errors: fieldErrors(result.error) };

  // ===== Registro de la cuenta =====

  try {
    const supabase = await createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        data: { full_name: result.data.fullName },
        emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      return {
        message:
          "No pudimos completar el registro. Revisa los datos o intenta iniciar sesión.",
      };
    }
  } catch {
    return { message: "Supabase todavía no está configurado en este entorno." };
  }

  redirect("/verifica-tu-correo");
}

export async function signInAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // ===== Validación de credenciales =====

  const result = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) return { errors: fieldErrors(result.error) };

  // ===== Autenticación y política de actividad =====

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(result.data);
    if (error)
      return { message: "El correo o la contraseña no son correctos." };
    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_ACTIVITY_COOKIE,
      String(Math.floor(Date.now() / 1000)),
      activityCookieOptions,
    );
    cookieStore.set(
      SESSION_POLICY_COOKIE,
      SESSION_POLICY_VERSION,
      policyCookieOptions,
    );
  } catch {
    return { message: "Supabase todavía no está configurado en este entorno." };
  }

  redirect("/app");
}

export async function requestPasswordResetAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // ===== Validación del correo =====

  const result = emailSchema.safeParse(formData.get("email"));
  if (!result.success)
    return { errors: { email: [result.error.issues[0].message] } };

  // ===== Envío del enlace de recuperación =====

  try {
    const supabase = await createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await supabase.auth.resetPasswordForEmail(result.data, {
      redirectTo: `${appUrl}/auth/callback?next=/restablecer-contrasena`,
    });
  } catch {
    return { message: "Supabase todavía no está configurado en este entorno." };
  }

  return {
    message:
      "Si existe una cuenta con ese correo, recibirás un enlace para restablecerla.",
  };
}

export async function updatePasswordAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // ===== Validación de la nueva contraseña =====

  const result = passwordSchema.safeParse(formData.get("password"));
  if (!result.success) {
    return {
      errors: { password: result.error.issues.map((issue) => issue.message) },
    };
  }

  // ===== Persistencia de la contraseña =====

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: result.data });
  if (error) return { message: "El enlace expiró. Solicita uno nuevo." };

  redirect("/app");
}

export async function resendVerificationAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // ===== Validación del correo =====

  const result = emailSchema.safeParse(formData.get("email"));
  if (!result.success)
    return { errors: { email: [result.error.issues[0].message] } };

  // ===== Reenvío seguro del enlace =====

  try {
    const supabase = await createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await supabase.auth.resend({
      type: "signup",
      email: result.data,
      options: { emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding` },
    });
  } catch {
    return { message: "Supabase todavía no está configurado en este entorno." };
  }
  return {
    message: "Si la cuenta está pendiente, enviaremos un nuevo enlace.",
  };
}

export async function signOutAction() {
  // ===== Invalidación de la sesión =====

  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_ACTIVITY_COOKIE);
  cookieStore.delete(SESSION_POLICY_COOKIE);
  redirect("/login");
}
