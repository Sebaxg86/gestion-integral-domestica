import { Badge, Button, buttonVariants, Card, CardContent } from "@gid/ui";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Pencil,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/features/documents/expiration";
import {
  cancelScheduledServiceAction,
  resolveScheduledServiceOccurrenceAction,
} from "@/features/scheduled-services/actions";
import {
  scheduledServiceCategoryLabels,
  scheduledServiceOccurrenceLabels,
  scheduledServiceRecurrenceLabels,
} from "@/features/scheduled-services/config";
import { createClient } from "@/lib/supabase/server";

type OccurrenceRow = {
  id: string;
  due_date: string;
  status: string;
  version: number;
};

// ============================================================================
// Detalle de un servicio programado
// ============================================================================

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function ScheduledServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  // ===== Consulta del servicio y su historial =====

  const { serviceId } = await params;
  const supabase = await createClient();
  const [{ data: service }, { data: occurrenceRows }] = await Promise.all([
    supabase
      .from("scheduled_services")
      .select(
        "id, name, category, provider, recurrence, custom_interval_days, lead_days, notes, status, version, property:properties(name)",
      )
      .eq("id", serviceId)
      .single(),
    supabase
      .from("scheduled_service_occurrences")
      .select("id, due_date, status, version")
      .eq("scheduled_service_id", serviceId)
      .order("sequence", { ascending: false })
      .limit(12),
  ]);

  if (!service) notFound();

  const occurrences = (occurrenceRows ?? []) as OccurrenceRow[];
  const pendingOccurrence = occurrences.find(
    (occurrence) => occurrence.status === "pending",
  );
  const property = service.property as unknown as { name: string } | null;
  const recurrence =
    service.recurrence === "custom_days"
      ? `Cada ${service.custom_interval_days} días`
      : (scheduledServiceRecurrenceLabels[service.recurrence] ??
        service.recurrence);

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/servicios"
      >
        <ArrowLeft aria-hidden size={18} /> Servicios
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              {service.name}
            </h1>
            <Badge
              status={service.status === "active" ? "upcoming" : "neutral"}
            >
              {service.status === "active"
                ? "Activo"
                : service.status === "completed"
                  ? "Completado"
                  : "Cancelado"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {scheduledServiceCategoryLabels[service.category] ??
              service.category}
          </p>
        </div>
        {service.status === "active" ? (
          <Link
            className={buttonVariants({ variant: "secondary", size: "icon" })}
            href={`/app/servicios/${service.id}/editar`}
            aria-label="Editar servicio"
          >
            <Pencil aria-hidden size={17} />
          </Link>
        ) : null}
      </div>

      {/* ===== Información operativa ===== */}

      <Card className="mt-8">
        <CardContent className="p-5 sm:p-7">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Data label="Frecuencia" value={recurrence} />
            <Data
              label="Vivienda"
              value={property?.name ?? "Sin vivienda específica"}
            />
            <Data label="Proveedor" value={service.provider || "No indicado"} />
            <Data
              label="Aviso"
              value={
                service.lead_days === 0
                  ? "El mismo día"
                  : `${service.lead_days} días antes`
              }
            />
          </dl>
          {service.notes ? (
            <p className="mt-7 whitespace-pre-wrap border-t pt-6 text-sm">
              {service.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ===== Próxima fecha y resolución ===== */}

      {pendingOccurrence ? (
        <Card className="mt-4 bg-[var(--color-surface-alt)] shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <CalendarClock
                className="mt-0.5 text-[var(--color-brand-800)]"
                size={21}
              />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                  Próxima fecha
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatDate(pendingOccurrence.due_date)}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <form action={resolveScheduledServiceOccurrenceAction}>
                <input type="hidden" name="serviceId" value={service.id} />
                <input
                  type="hidden"
                  name="occurrenceId"
                  value={pendingOccurrence.id}
                />
                <input
                  type="hidden"
                  name="version"
                  value={pendingOccurrence.version}
                />
                <input type="hidden" name="status" value="attended" />
                <Button fullWidth type="submit">
                  <Check aria-hidden size={18} /> Marcar atendido
                </Button>
              </form>
              <form action={resolveScheduledServiceOccurrenceAction}>
                <input type="hidden" name="serviceId" value={service.id} />
                <input
                  type="hidden"
                  name="occurrenceId"
                  value={pendingOccurrence.id}
                />
                <input
                  type="hidden"
                  name="version"
                  value={pendingOccurrence.version}
                />
                <input type="hidden" name="status" value="skipped" />
                <Button fullWidth type="submit" variant="secondary">
                  <SkipForward aria-hidden size={18} /> Omitir esta fecha
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ===== Historial compacto ===== */}

      <section className="mt-9">
        <h2 className="text-lg font-semibold">Historial</h2>
        <div className="mt-3 grid gap-2">
          {occurrences.map((occurrence) => (
            <div
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-control)]"
              key={occurrence.id}
            >
              <span className="text-sm font-medium">
                {formatDate(occurrence.due_date)}
              </span>
              <Badge
                status={
                  occurrence.status === "attended"
                    ? "success"
                    : occurrence.status === "pending"
                      ? "upcoming"
                      : "neutral"
                }
              >
                {scheduledServiceOccurrenceLabels[occurrence.status] ??
                  occurrence.status}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      {service.status === "active" ? (
        <form
          action={cancelScheduledServiceAction}
          className="mt-8 border-t pt-6"
        >
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="version" value={service.version} />
          <Button type="submit" variant="tertiary">
            Cancelar programación
          </Button>
        </form>
      ) : null}
    </div>
  );
}
