import { Card, CardContent } from "@gid/ui";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/features/families/onboarding-form";
import { getSessionContext } from "@/lib/auth/session";

export default async function OnboardingPage() {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (!context.profile.email_verified_at) redirect("/verifica-tu-correo");
  if (context.family) redirect("/app");

  return (
    <main className="min-h-dvh px-5 py-5 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Logo />
      </div>
      <div className="mx-auto grid min-h-[calc(100dvh-80px)] max-w-lg place-items-center py-10">
        <Card className="w-full">
          <CardContent className="p-6 sm:p-8">
            <p className="text-sm font-semibold text-[var(--color-brand-800)]">
              Configuración inicial
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
              Crea tu familia
            </h1>
            <p className="mb-7 mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              Tu familia es el espacio privado donde vivirán tus viviendas,
              documentos y avisos.
            </p>
            <OnboardingForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
