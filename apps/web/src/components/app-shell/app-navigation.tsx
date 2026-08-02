"use client";

import {
  Bell,
  CalendarClock,
  CarFront,
  Home,
  House,
  ListTodo,
  MoreHorizontal,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@gid/ui";

const desktopItems = [
  { href: "/app", label: "Inicio", icon: Home },
  { href: "/app/viviendas", label: "Viviendas", icon: House },
  { href: "/app/vehiculos", label: "Vehículos", icon: CarFront },
  { href: "/app/servicios", label: "Servicios", icon: CalendarClock },
  { href: "/app/pendientes", label: "Pendientes", icon: ListTodo },
  { href: "/app/avisos", label: "Avisos", icon: Bell },
];

const mobileItems = [
  { href: "/app", label: "Inicio", icon: Home },
  { href: "/app/viviendas", label: "Viviendas", icon: House },
  { href: "/app/vehiculos", label: "Vehículos", icon: CarFront },
  { href: "/app/pendientes", label: "Pendientes", icon: ListTodo },
  {
    href: "/app/mas",
    label: "Más",
    icon: MoreHorizontal,
    activePrefixes: [
      "/app/mas",
      "/app/servicios",
      "/app/avisos",
      "/app/archivo",
      "/app/cuenta",
    ],
  },
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
        {desktopItems.map((item) => (
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
        {mobileItems.map((item) => (
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
  activePrefixes,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  pathname: string;
  desktop?: boolean;
  activePrefixes?: string[];
}) {
  // ===== Identificación del destino activo =====

  const matchesDirectPath =
    href === "/app" ? pathname === href : pathname.startsWith(href);
  const matchesSecondaryPath = activePrefixes?.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const active = matchesDirectPath || Boolean(matchesSecondaryPath);

  // ===== Renderizado del enlace =====

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex min-h-12 items-center rounded-xl text-sm font-medium transition-[transform,background-color,color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 active:scale-[0.97] active:duration-100 motion-reduce:transition-none motion-reduce:active:transform-none",
        desktop ? "gap-3 px-3" : "flex-col justify-center gap-1 text-xs",
        active
          ? "bg-[var(--color-brand-100)] text-[var(--color-brand-900)] shadow-[var(--shadow-control)] hover:-translate-y-0.5 hover:bg-[var(--color-brand-100)] active:translate-y-px"
          : "text-[var(--color-text-secondary)] hover:-translate-y-0.5 hover:bg-[var(--color-surface-alt)] hover:shadow-[var(--shadow-control)] active:translate-y-px",
      )}
      href={href}
    >
      <Icon
        aria-hidden
        className="transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none"
        size={desktop ? 19 : 20}
        strokeWidth={active ? 2.3 : 1.9}
      />
      {label}
    </Link>
  );
}
