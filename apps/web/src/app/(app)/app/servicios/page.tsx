import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import { ArrowRight, CalendarClock, Plus } from "lucide-react";
import Link from "next/link";

import {
  classifyExpiration,
  formatDate,
  getLocalDate,
} from "@/features/documents/expiration";
import { scheduledServiceCategoryLabels } from "@/features/scheduled-services/config";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type ScheduledServiceRow = {
  id: string;
  name: string;
  category: string;
  property: { name: string } | null;
  occurrences: Array<{ due_date: string }>;
};

const dateStatusLabels = {
  expired: "Vencido",
  today: "Hoy",
  upcoming: "Próximo",
  later: "Programado",
} as const;

// ============================================================================
// Listado de servicios programados
// ============================================================================

export default async function ScheduledServicesPage() {
  // ===== Consulta de programaciones activas =====

  const context = await getSessionContext();
  const family = context!.family!;
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_services")
    .select(
      "id, name, category, property:properties(name), occurrences:scheduled_service_occurrences!inner(due_date)",
    )
    .eq("family_id", family.id)
    .eq("status", "active")
    .eq("occurrences.status", "pending")
    .order("updated_at", { ascending: false });
  const services = (data ?? []) as unknown as ScheduledServiceRow[];
  const localDate = getLocalDate(family.timezone);

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            Servicios
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Obligaciones y tareas recurrentes que no quieres olvidar.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "primary" })}
          href="/app/servicios/nuevo"
        >
          <Plus aria-hidden size={18} /> Programar servicio
        </Link>
      </div>

      {/* ===== Programaciones disponibles ===== */}

      <div className="mt-7 grid gap-3">
        {services.length ? (
          services.map((service) => {
            const dueDate = service.occurrences[0]!.due_date;
            const dateStatus = classifyExpiration(dueDate, localDate);

            return (
              <Link href={`/app/servicios/${service.id}`} key={service.id}>
                <Card className="transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]">
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <CalendarClock aria-hidden size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{service.name}</p>
                      <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
                        {scheduledServiceCategoryLabels[service.category] ??
                          service.category}
                        {service.property?.name
                          ? ` · ${service.property.name}`
                          : ""}
                        {` · ${formatDate(dueDate)}`}
                      </p>
                    </div>
                    <Badge
                      status={dateStatus === "later" ? "neutral" : dateStatus}
                    >
                      {dateStatusLabels[dateStatus]}
                    </Badge>
                    <ArrowRight
                      aria-hidden
                      className="hidden text-[var(--color-text-disabled)] sm:block"
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
              <p className="font-semibold">Aún no hay servicios programados</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Registra una obligación y GID te avisará cuando se acerque.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
