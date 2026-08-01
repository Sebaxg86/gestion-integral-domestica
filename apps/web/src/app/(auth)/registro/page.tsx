import Link from "next/link";

import {
  OAuthButtons,
  OAuthErrorNotice,
  SignUpForm,
} from "@/features/auth/auth-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="grid gap-7">
      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--color-brand-800)]">
          Empieza con calma
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Crea tu cuenta
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Primero crearemos tu espacio privado. Después agregarás tu primera
          vivienda.
        </p>
      </div>
      {error === "oauth_failed" ? (
        <OAuthErrorNotice context="registro" />
      ) : null}
      <OAuthButtons returnTo="/registro" />
      <SignUpForm />
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        ¿Ya tienes cuenta?{" "}
        <Link
          className="font-semibold text-[var(--color-brand-800)]"
          href="/login"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
