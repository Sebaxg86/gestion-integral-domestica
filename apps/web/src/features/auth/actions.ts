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

// ============== Gestión de autenticación ==============

// ==== Convertir errores de validación ====

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const entries = Object.entries(error.flatten().fieldErrors).filter(
    (entry): entry is [string, string[]] => Boolean(entry[1]),
  );
  return Object.fromEntries(entries);
}

// ==== Registrar cuenta ====

export async function signUpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) return { errors: fieldErrors(result.error) };

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

// ==== Iniciar sesión ====

export async function signInAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) return { errors: fieldErrors(result.error) };

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

// ==== Solicitar recuperación de contraseña ====

export async function requestPasswordResetAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = emailSchema.safeParse(formData.get("email"));
  if (!result.success)
    return { errors: { email: [result.error.issues[0].message] } };

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

// ==== Actualizar contraseña ====

export async function updatePasswordAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = passwordSchema.safeParse(formData.get("password"));
  if (!result.success) {
    return {
      errors: { password: result.error.issues.map((issue) => issue.message) },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: result.data });
  if (error) return { message: "El enlace expiró. Solicita uno nuevo." };

  redirect("/app");
}

// ==== Reenviar verificación ====

export async function resendVerificationAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const result = emailSchema.safeParse(formData.get("email"));
  if (!result.success)
    return { errors: { email: [result.error.issues[0].message] } };
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

// ==== Cerrar sesión ====

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_ACTIVITY_COOKIE);
  cookieStore.delete(SESSION_POLICY_COOKIE);
  redirect("/login");
}

// ===================================================
