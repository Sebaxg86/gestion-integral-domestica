import { buttonVariants, Card, CardContent } from "@gid/ui";
import { ArrowRight, Archive, House, Plus } from "lucide-react";
import Link from "next/link";

import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const typeLabels: Record<string, string> = {
  house: "Casa",
  apartment: "Departamento",
  land: "Terreno",
  commercial: "Local comercial",
  other: "Otro",
};

export default async function PropertiesPage() {
  // ===== Consulta de viviendas activas =====

  const context = await getSessionContext();
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, type, address, updated_at")
    .eq("family_id", context!.family!.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            Viviendas
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            El contexto de tus documentos domésticos.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "primary" })}
          href="/app/viviendas/nueva"
        >
          <Plus aria-hidden size={18} /> Agregar vivienda
        </Link>
      </div>

      {/* ===== Viviendas disponibles ===== */}

      <div className="mt-7 grid min-w-0 gap-3">
        {properties?.length ? (
          properties.map((property) => {
            // ------- Limitar la tarjeta al ancho disponible del dispositivo -------

            return (
              <Link
                className="block min-w-0 max-w-full"
                href={`/app/viviendas/${property.id}`}
                key={property.id}
              >
                <Card className="min-w-0 max-w-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]">
                  <CardContent className="flex min-w-0 items-center gap-4 p-4 sm:p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <House aria-hidden size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{property.name}</p>
                      <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                        {typeLabels[property.type] ?? property.type}
                        {property.address ? ` · ${property.address}` : ""}
                      </p>
                    </div>
                    <ArrowRight
                      aria-hidden
                      className="shrink-0 text-[var(--color-text-disabled)]"
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
              <p className="font-semibold">Aún no hay viviendas activas</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Agrega una para comenzar a organizar documentos.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <Link
        className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/archivo"
      >
        <Archive aria-hidden size={17} /> Ver archivo
      </Link>
    </div>
  );
}
