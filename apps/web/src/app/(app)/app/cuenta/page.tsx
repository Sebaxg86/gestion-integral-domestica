import { Button, Card, CardContent } from "@gid/ui";
import { LogOut, ShieldCheck } from "lucide-react";

import { signOutAction } from "@/features/auth/actions";
import { FamilyForm, ProfileForm } from "@/features/account/account-forms";
import { PushSettings } from "@/features/notifications/push-settings";
import { getSessionContext } from "@/lib/auth/session";

export default async function AccountPage() {
  const context = await getSessionContext();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-[-0.04em]">Cuenta</h1>
      <div className="mt-7 grid gap-4">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">Perfil</h2>
            <ProfileForm
              fullName={context!.profile.full_name}
              version={context!.profile.version}
            />
            <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
              Correo: {context!.profile.email}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-3 font-semibold">Notificaciones</h2>
            <PushSettings userId={context!.userId} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">Familia</h2>
            <FamilyForm family={context!.family!} />
          </CardContent>
        </Card>
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-brand-100)] p-4 text-sm text-[var(--color-brand-900)]">
          <ShieldCheck aria-hidden className="mt-0.5 shrink-0" size={19} />
          <p>
            Tu espacio utiliza aislamiento por familia y almacenamiento privado.
            Los enlaces de archivo expiran después de cinco minutos.
          </p>
        </div>
      </div>
      <form action={signOutAction} className="mt-8">
        <Button variant="secondary" type="submit">
          <LogOut aria-hidden size={17} /> Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
