import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import { ArrowLeft, Gauge, Pencil, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/features/documents/expiration";
import { attendServiceReminderAction } from "@/features/vehicle-services/actions";
import {
  ServiceAttachmentsSection,
  ServiceItemsSection,
  ServicePartsSection,
} from "@/features/vehicle-services/service-detail-sections";
import { createClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = {
  planned: "Programado",
  in_progress: "En proceso",
  completed: "Completado",
  cancelled: "Cancelado",
};

const typeLabels: Record<string, string> = {
  preventive: "Mantenimiento preventivo",
  corrective: "Mantenimiento correctivo",
  repair: "Reparación",
  diagnostic: "Diagnóstico",
  inspection: "Inspección",
  general: "Servicio general",
  other: "Otro",
};

// ============================================================================
// Detalle del servicio vehicular
// ============================================================================

function Data({ label, value }: { label: string; value: string }) {
  // ===== Presentación de un dato operativo =====

  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function VehicleServiceDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string; serviceId: string }>;
}) {
  // ===== Consulta del servicio y sus recursos relacionados =====

  const { vehicleId, serviceId } = await params;
  const supabase = await createClient();
  const [
    { data: service },
    { data: reminder },
    { data: items },
    { data: parts },
    { data: attachments },
  ] = await Promise.all([
    supabase
      .from("vehicle_services")
      .select(
        "id, family_id, vehicle_id, title, type, status, service_date, mileage, provider, cost, notes, next_due_date, next_due_mileage, version",
      )
      .eq("id", serviceId)
      .eq("vehicle_id", vehicleId)
      .single(),
    supabase
      .from("reminders")
      .select("id, status, version, repeat_interval_days")
      .eq("vehicle_service_id", serviceId)
      .in("status", ["scheduled", "notified"])
      .maybeSingle(),
    supabase
      .from("vehicle_service_items")
      .select(
        "id, category, description, status, notes, warranty_until, version",
      )
      .eq("vehicle_service_id", serviceId)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("vehicle_service_parts")
      .select(
        "id, vehicle_service_item_id, name, brand, part_number, quantity, unit_cost, warranty_until, notes, version",
      )
      .eq("vehicle_service_id", serviceId)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("vehicle_service_attachments")
      .select(
        "id, kind, title, original_filename, storage_key, size_bytes, version",
      )
      .eq("vehicle_service_id", serviceId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);

  // ------- Impedir mostrar recursos inexistentes o ajenos -------

  if (!service) {
    notFound();
  }

  // ===== Preparación de enlaces temporales =====

  const attachmentsWithUrls = await Promise.all(
    (attachments ?? []).map(async (attachment) => {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(attachment.storage_key, 300);

      return {
        ...attachment,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );

  // ===== Renderizado del resumen del servicio =====

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/vehiculos/${vehicleId}`}
      >
        <ArrowLeft aria-hidden size={18} /> Vehículo
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              {service.title}
            </h1>
            <Badge>{statusLabels[service.status] ?? service.status}</Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {typeLabels[service.type] ?? service.type}
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "secondary", size: "icon" })}
          href={`/app/vehiculos/${vehicleId}/mantenimientos/${service.id}/editar`}
          aria-label="Editar servicio"
        >
          <Pencil aria-hidden size={17} />
        </Link>
      </div>

      {/* ===== Información principal ===== */}

      <Card className="mt-8">
        <CardContent className="p-5 sm:p-7">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Data
              label="Fecha"
              value={
                service.service_date
                  ? formatDate(service.service_date)
                  : "No indicada"
              }
            />
            <Data
              label="Kilometraje"
              value={
                service.mileage === null
                  ? "No indicado"
                  : `${service.mileage.toLocaleString("es-MX")} km`
              }
            />
            <Data label="Taller" value={service.provider || "No indicado"} />
            <Data
              label="Costo"
              value={
                service.cost === null
                  ? "No indicado"
                  : new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: "MXN",
                    }).format(service.cost)
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

      {/* ===== Próxima atención ===== */}

      <Card className="mt-4 bg-[var(--color-surface-alt)] shadow-none">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="flex gap-3">
            <Wrench className="text-[var(--color-brand-800)]" size={20} />
            <Data
              label="Próxima fecha"
              value={
                service.next_due_date
                  ? formatDate(service.next_due_date)
                  : "No programada"
              }
            />
          </div>
          <div className="flex gap-3">
            <Gauge className="text-[var(--color-brand-800)]" size={20} />
            <Data
              label="Próximo kilometraje"
              value={
                service.next_due_mileage === null
                  ? "No programado"
                  : `${service.next_due_mileage.toLocaleString("es-MX")} km`
              }
            />
          </div>
        </CardContent>
      </Card>

      {reminder?.status === "notified" ? (
        <form action={attendServiceReminderAction} className="mt-5">
          <input type="hidden" name="reminderId" value={reminder.id} />
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="version" value={reminder.version} />
          <button
            className="min-h-11 text-sm font-semibold text-[var(--color-brand-800)]"
            type="submit"
          >
            Marcar recordatorio atendido
          </button>
        </form>
      ) : null}

      {/* ===== Detalle operativo ===== */}

      <ServiceItemsSection
        vehicleId={vehicleId}
        serviceId={service.id}
        items={items ?? []}
      />
      <ServicePartsSection
        vehicleId={vehicleId}
        serviceId={service.id}
        items={items ?? []}
        parts={parts ?? []}
      />
      <ServiceAttachmentsSection
        familyId={service.family_id}
        vehicleId={vehicleId}
        serviceId={service.id}
        attachments={attachmentsWithUrls}
      />
    </div>
  );
}
