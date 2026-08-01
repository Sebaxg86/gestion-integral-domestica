import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNavigation } from "@/components/app-shell/app-navigation";
import { Logo } from "@/components/brand/logo";
import { getSessionContext } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (!context.profile.email_verified_at) redirect("/verifica-tu-correo");
  if (!context.family) redirect("/onboarding");

  const initials = context.profile.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-app-background)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo href="/app" />
          <Link
            aria-label="Abrir cuenta"
            className="grid size-10 place-items-center rounded-full bg-white text-sm font-semibold shadow-[var(--shadow-control)]"
            href="/app/cuenta"
          >
            {initials}
          </Link>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-5 py-6 pb-24 sm:px-8 lg:py-8 lg:pb-8">
        <AppNavigation />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
