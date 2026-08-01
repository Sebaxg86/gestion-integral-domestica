import Link from "next/link";

import { SignInForm } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="grid gap-7">
      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--color-brand-800)]">
          Bienvenido de vuelta
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Inicia sesión
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Tus documentos y vencimientos, en un solo lugar privado.
        </p>
      </div>
      <SignInForm />
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        ¿Aún no tienes cuenta?{" "}
        <Link
          className="font-semibold text-[var(--color-brand-800)]"
          href="/registro"
        >
          Créala aquí
        </Link>
      </p>
    </div>
  );
}
