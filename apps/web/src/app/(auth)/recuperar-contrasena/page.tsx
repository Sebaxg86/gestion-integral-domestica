import { PasswordResetRequestForm } from "@/features/auth/auth-form";

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-7">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Recupera tu acceso
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Te enviaremos un enlace seguro si encontramos una cuenta asociada.
        </p>
      </div>
      <PasswordResetRequestForm />
    </div>
  );
}
