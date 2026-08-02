import { Card, CardContent } from "@gid/ui";
import {
  Archive,
  ArrowRight,
  Bell,
  CalendarClock,
  UserRound,
} from "lucide-react";
import Link from "next/link";

const destinations = [
  {
    href: "/app/servicios",
    label: "Servicios",
    description: "Obligaciones y fechas recurrentes",
    icon: CalendarClock,
  },
  {
    href: "/app/avisos",
    label: "Avisos",
    description: "Notificaciones que requieren atención",
    icon: Bell,
  },
  {
    href: "/app/archivo",
    label: "Archivo",
    description: "Recursos archivados anteriormente",
    icon: Archive,
  },
  {
    href: "/app/cuenta",
    label: "Cuenta",
    description: "Perfil, familia y sesión",
    icon: UserRound,
  },
];

// ============================================================================
// Navegación secundaria móvil
// ============================================================================

export default function MorePage() {
  // ===== Renderizado de destinos secundarios =====

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-[-0.04em]">Más</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Servicios, avisos y configuración de tu espacio.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {destinations.map((destination) => {
          const Icon = destination.icon;

          return (
            <Link href={destination.href} key={destination.href}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]">
                <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                    <Icon aria-hidden size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{destination.label}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {destination.description}
                    </p>
                  </div>
                  <ArrowRight
                    aria-hidden
                    className="text-[var(--color-text-disabled)]"
                    size={18}
                  />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
