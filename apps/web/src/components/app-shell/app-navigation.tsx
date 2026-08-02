"use client";

import {
  Bell,
  CalendarClock,
  CarFront,
  Home,
  House,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@gid/ui";

const items = [
  { href: "/app", label: "Inicio", icon: Home },
  { href: "/app/viviendas", label: "Viviendas", icon: House },
  { href: "/app/vehiculos", label: "Vehículos", icon: CarFront },
  { href: "/app/servicios", label: "Servicios", icon: CalendarClock },
  { href: "/app/avisos", label: "Avisos", icon: Bell },
];

// ============================================================================
// Navegación principal
// ============================================================================

export function AppNavigation() {
  // ===== Ruta activa =====

  const pathname = usePathname();

  // ===== Navegación adaptable =====

  return (
    <>
      {/* ===== Navegación para escritorio ===== */}

      <nav
        aria-label="Navegación principal"
        className="hidden w-60 flex-col gap-1 lg:flex"
      >
        {items.map((item) => (
          <NavLink desktop key={item.href} pathname={pathname} {...item} />
        ))}
        <NavLink
          desktop
          href="/app/cuenta"
          label="Cuenta"
          icon={UserRound}
          pathname={pathname}
        />
      </nav>

      {/* ===== Navegación inferior para móvil ===== */}

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--color-border)] bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden"
      >
        {items.map((item) => (
          <NavLink key={item.href} pathname={pathname} {...item} />
        ))}
      </nav>
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  desktop,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  pathname: string;
  desktop?: boolean;
}) {
  // ===== Identificación del destino activo =====

  const active =
    href === "/app" ? pathname === href : pathname.startsWith(href);

  // ===== Renderizado del enlace =====

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center rounded-xl text-sm font-medium transition",
        desktop ? "gap-3 px-3" : "flex-col justify-center gap-1 text-xs",
        active
          ? "bg-[var(--color-brand-100)] text-[var(--color-brand-900)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]",
      )}
      href={href}
    >
      <Icon
        aria-hidden
        size={desktop ? 19 : 20}
        strokeWidth={active ? 2.3 : 1.9}
      />
      {label}
    </Link>
  );
}
