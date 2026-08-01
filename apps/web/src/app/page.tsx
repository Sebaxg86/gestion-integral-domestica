import { buttonVariants, Card, CardContent } from "@gid/ui";
import { BellRing, FileCheck2, Home, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const benefits = [
  {
    icon: FileCheck2,
    title: "Documentos en orden",
    description:
      "Guarda la información importante de cada vivienda junto con su archivo privado.",
  },
  {
    icon: BellRing,
    title: "Vencimientos claros",
    description:
      "Identifica qué venció, qué vence hoy y qué necesita atención durante los próximos 30 días.",
  },
  {
    icon: LockKeyhole,
    title: "Privado por diseño",
    description:
      "Cada familia está aislada y los archivos nunca se publican mediante enlaces permanentes.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <Link
            className={buttonVariants({ variant: "tertiary" })}
            href="/login"
          >
            Entrar
          </Link>
          <Link
            className={buttonVariants({ variant: "primary" })}
            href="/registro"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-100)] px-3 py-1.5 text-sm font-semibold text-[var(--color-brand-900)]">
            <Home aria-hidden size={15} /> Tu hogar, bajo control
          </p>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Lo importante de casa, ordenado y a tiempo.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--color-text-secondary)]">
            GID reúne documentos, viviendas y vencimientos en una experiencia
            tranquila, privada y fácil de consultar.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className={buttonVariants({ variant: "primary", size: "mobile" })}
              href="/registro"
            >
              Organizar mi hogar
            </Link>
            <Link
              className={buttonVariants({
                variant: "secondary",
                size: "mobile",
              })}
              href="#como-funciona"
            >
              Ver cómo funciona
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:mr-0">
          <div className="absolute -inset-20 -z-10 rounded-full bg-[radial-gradient(circle,var(--color-brand-100),transparent_68%)] opacity-80" />
          <Card className="rotate-[1.5deg] p-3 shadow-[0_30px_80px_-35px_rgb(15_23_42/35%)]">
            <CardContent className="rounded-[var(--radius-lg)] bg-[var(--color-surface-alt)] p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Viernes, 31 de julio
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                    Buenos días
                  </p>
                </div>
                <span className="grid size-11 place-items-center rounded-full bg-white font-semibold shadow-[var(--shadow-control)]">
                  SC
                </span>
              </div>
              <div className="mt-7 grid gap-3">
                <PreviewRow
                  label="Póliza de la casa"
                  detail="Vence en 7 días"
                  tone="brand"
                />
                <PreviewRow label="Recibo predial" detail="Vence en 24 días" />
                <PreviewRow label="Escritura" detail="Sin vencimiento" muted />
              </div>
              <div className="mt-6 rounded-xl bg-white p-4 shadow-[var(--shadow-control)]">
                <p className="text-sm font-semibold">
                  Todo lo urgente está visible
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  Sin ruido visual y sin perder el contexto de cada vivienda.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        className="border-t border-[var(--color-border)] bg-white"
        id="como-funciona"
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[var(--color-brand-800)]">
              Un primer flujo enfocado
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
              Menos administración. Más tranquilidad.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }) => (
              <Card
                className="bg-[var(--color-surface-alt)] shadow-none"
                key={title}
              >
                <CardContent className="p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-white text-[var(--color-brand-800)] shadow-[var(--shadow-control)]">
                    <Icon aria-hidden size={21} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function PreviewRow({
  label,
  detail,
  tone,
  muted,
}: {
  label: string;
  detail: string;
  tone?: "brand";
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-[var(--shadow-control)]">
      <span
        className={`size-2.5 rounded-full ${tone ? "bg-[var(--color-brand-700)]" : muted ? "bg-slate-300" : "bg-slate-400"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          {detail}
        </p>
      </div>
    </div>
  );
}
