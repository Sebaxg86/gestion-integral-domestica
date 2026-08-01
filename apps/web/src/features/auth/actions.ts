"use server";

import {
  emailSchema,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from "@gid/validation";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  message?: string;
  errors?: Record<string, string[]>;
};

const oauthProviders = ["google", "apple"] as const;
type OAuthProvider = (typeof oauthProviders)[number];

function isOAuthProvider(value: FormDataEntryValue | null): value is OAuthProvider {
  return oauthProviders.includes(value as OAuthProvider);
}

function isOAuthReturnPath(value: FormDataEntryValue | null) {
  return value === "/login" || value === "/registro";
}

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
  } catch {
    return { message: "Supabase todavía no está configurado en este entorno." };
  }

  redirect("/app");
}

export async function signInWithOAuthAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const provider = formData.get("provider");
  const requestedReturnPath = formData.get("returnTo");

  if (!isOAuthProvider(provider)) {
    return { message: "El proveedor de acceso no es válido." };
  }

  const returnPath = isOAuthReturnPath(requestedReturnPath)
    ? requestedReturnPath
    : "/login";
  let authorizationUrl: string | undefined;

  try {
    const supabase = await createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const callbackUrl = new URL("/auth/callback", appUrl);
    callbackUrl.searchParams.set("next", "/app");
    callbackUrl.searchParams.set("returnTo", returnPath);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      return {
        message: `No pudimos conectar con ${provider === "google" ? "Google" : "Apple"}. Intenta nuevamente.`,
      };
    }

    authorizationUrl = data.url;
  } catch {
    return { message: "Supabase todavía no está configurado en este entorno." };
  }

  redirect(authorizationUrl);
}

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

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
