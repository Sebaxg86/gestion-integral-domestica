import { buttonVariants, Card, CardContent } from "@gid/ui";
import { Archive, ArrowRight, CarFront, Plus } from "lucide-react";
import Link from "next/link";

import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const typeLabels: Record<string, string> = {
  car: "Automóvil",
  truck: "Camioneta",
  motorcycle: "Motocicleta",
  trailer: "Remolque",
  recreational: "Vehículo recreativo",
  other: "Otro",
};

// ============================================================================
// Listado de vehículos
// ============================================================================

export default async function VehiclesPage() {
  // ===== Consulta de vehículos activos =====

  const context = await getSessionContext();
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, name, type, make, model, model_year, license_plate, updated_at")
    .eq("family_id", context!.family!.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-4xl">
      {/* ===== Encabezado y acción principal ===== */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            Vehículos
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Datos esenciales de los vehículos que utilizas.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "primary" })}
          href="/app/vehiculos/nuevo"
        >
          <Plus aria-hidden size={18} /> Agregar vehículo
        </Link>
      </div>

      {/* ===== Vehículos disponibles ===== */}

      <div className="mt-7 grid gap-3">
        {vehicles?.length ? (
          vehicles.map((vehicle) => {
            const description = [
              vehicle.model_year,
              vehicle.make,
              vehicle.model,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <Link href={`/app/vehiculos/${vehicle.id}`} key={vehicle.id}>
                <Card className="transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]">
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <span className="grid size-11 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <CarFront aria-hidden size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{vehicle.name}</p>
                      <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                        {description || typeLabels[vehicle.type] || vehicle.type}
                        {vehicle.license_plate
                          ? ` · ${vehicle.license_plate}`
                          : ""}
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
          })
        ) : (
          <Card className="bg-[var(--color-surface-alt)] shadow-none">
            <CardContent className="p-8 text-center">
              <p className="font-semibold">Aún no hay vehículos activos</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Agrega el primero para comenzar a organizar sus datos.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== Acceso al archivo ===== */}

      <Link
        className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/archivo"
      >
        <Archive aria-hidden size={17} /> Ver archivo
      </Link>
    </div>
  );
}
