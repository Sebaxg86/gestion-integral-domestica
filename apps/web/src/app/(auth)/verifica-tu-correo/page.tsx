import { MailCheck } from "lucide-react";
import Link from "next/link";

import { ResendVerificationForm } from "@/features/auth/auth-form";

export default function VerifyEmailPage() {
  return (
    <div className="grid gap-5 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-brand-100)] text-[var(--color-brand-800)]">
        <MailCheck aria-hidden size={26} />
      </span>
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Revisa tu correo
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          Enviamos un enlace de verificación. Ábrelo para continuar con la
          creación de tu espacio privado.
        </p>
      </div>
      <div className="mt-2 text-left">
        <ResendVerificationForm />
      </div>
      <Link
        className="font-semibold text-[var(--color-brand-800)]"
        href="/login"
      >
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
