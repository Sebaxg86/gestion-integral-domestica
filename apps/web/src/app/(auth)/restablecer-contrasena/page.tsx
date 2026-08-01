import { UpdatePasswordForm } from "@/features/auth/auth-form";

export default function ResetPasswordPage() {
  return (
    <div className="grid gap-7">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">
          Nueva contraseña
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Elige una contraseña nueva para proteger tu cuenta.
        </p>
      </div>
      <UpdatePasswordForm />
    </div>
  );
}
