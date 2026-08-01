import { Card, CardContent } from "@gid/ui";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-dvh grid-rows-[auto_1fr] px-5 py-5 sm:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Logo />
        <Link
          className="text-sm font-medium text-[var(--color-text-secondary)]"
          href="/"
        >
          Volver al inicio
        </Link>
      </header>
      <div className="grid place-items-center py-10">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 sm:p-8">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
