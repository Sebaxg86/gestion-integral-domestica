import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import {
  Archive,
  ArrowLeft,
  CarFront,
  FileText,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getLocalDate } from "@/features/documents/expiration";
import { getMileageAttention } from "@/features/vehicle-mileage/attention";
import { VehicleMileageSection } from "@/features/vehicle-mileage/mileage-section";
import { setVehicleArchivedAction } from "@/features/vehicles/actions";
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

const fuelLabels: Record<string, string> = {
  gasoline: "Gasolina",
  diesel: "Diésel",
  hybrid: "Híbrido",
  electric: "Eléctrico",
  other: "Otro",
};

const serviceStatusLabels: Record<string, string> = {
  planned: "Programado",
  in_progress: "En proceso",
  completed: "Completado",
  cancelled: "Cancelado",
};

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function getServiceSummary(
  service: {
    service_date: string | null;
    next_due_date: string | null;
    next_due_mileage: number | null;
  },
  currentMileage: number | null,
) {
  // ===== Prioridad del próximo mantenimiento =====

  const mileageAttention = getMileageAttention(
    service.next_due_mileage,
    currentMileage,
  );

  if (mileageAttention?.due) {
    return "Requiere atención por kilometraje";
  }

  if (mileageAttention?.upcoming) {
    return `Faltan ${mileageAttention.remainingMileage.toLocaleString("es-MX")} km`;
  }

  if (service.next_due_date) {
    return `Próximo: ${service.next_due_date}`;
  }

  if (service.next_due_mileage !== null) {
    return `Próximo a los ${service.next_due_mileage.toLocaleString("es-MX")} km`;
  }

  return service.service_date || "Sin fecha";
}

// ============================================================================
// Detalle de vehículo
// ============================================================================

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  // ===== Consulta del vehículo =====

  const { vehicleId } = await params;
  const context = await getSessionContext();
  const supabase = await createClient();
  const [
    { data: vehicle },
    { data: documents },
    { data: services },
    { data: mileageReadings },
    { data: mileageReminder },
  ] = await Promise.all([
      supabase
        .from("vehicles")
        .select(
          "id, name, type, make, model, model_year, trim, color, vin, license_plate, mileage, fuel_type, notes, status, version",
        )
        .eq("id", vehicleId)
        .single(),
      supabase
        .from("documents")
        .select("id, name, category, expiration_date")
        .eq("vehicle_id", vehicleId)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("vehicle_services")
        .select(
          "id, title, type, status, service_date, next_due_date, next_due_mileage",
        )
        .eq("vehicle_id", vehicleId)
        .order("service_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicle_mileage_readings")
        .select("id, mileage, recorded_on, source, notes")
        .eq("vehicle_id", vehicleId)
        .order("recorded_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("reminders")
        .select("repeat_interval_days")
        .eq("vehicle_id", vehicleId)
        .in("status", ["scheduled", "notified"])
        .maybeSingle(),
    ]);

  if (!vehicle) {
    notFound();
  }

  // ===== Preparación de datos visibles =====

  const identity = [vehicle.model_year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" · ");
  const currentDate = getLocalDate(context!.family!.timezone);

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={vehicle.status === "active" ? "/app/vehiculos" : "/app/archivo"}
      >
        <ArrowLeft aria-hidden size={18} />
        {vehicle.status === "active" ? "Vehículos" : "Archivo"}
      </Link>

      {/* ===== Encabezado y acciones ===== */}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
            <CarFront aria-hidden size={23} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                {vehicle.name}
              </h1>
              {vehicle.status === "archived" ? <Badge>Archivado</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {identity || typeLabels[vehicle.type] || vehicle.type}
            </p>
          </div>
        </div>

        {vehicle.status === "active" ? (
          <Link
            className={buttonVariants({ variant: "secondary", size: "icon" })}
            href={`/app/vehiculos/${vehicle.id}/editar`}
            aria-label="Editar vehículo"
          >
            <Pencil aria-hidden size={17} />
          </Link>
        ) : null}
      </div>

      {/* ===== Seguimiento del kilometraje ===== */}

      <VehicleMileageSection
        vehicleId={vehicle.id}
        currentMileage={vehicle.mileage}
        currentDate={currentDate}
        readings={mileageReadings ?? []}
        reminderIntervalDays={mileageReminder?.repeat_interval_days ?? null}
        active={vehicle.status === "active"}
      />

      {/* ===== Información registrada ===== */}

      <Card className="mt-4">
        <CardContent className="p-5 sm:p-7">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Data
              label="Tipo"
              value={typeLabels[vehicle.type] ?? vehicle.type}
            />
            <Data label="Versión" value={vehicle.trim || "No indicada"} />
            <Data label="Color" value={vehicle.color || "No indicado"} />
            <Data
              label="Placas"
              value={vehicle.license_plate || "No indicadas"}
            />
            <Data label="VIN" value={vehicle.vin || "No indicado"} />
            <Data
              label="Combustible"
              value={
                vehicle.fuel_type
                  ? fuelLabels[vehicle.fuel_type] || vehicle.fuel_type
                  : "No indicado"
              }
            />
          </dl>

          {vehicle.notes ? (
            <div className="mt-7 border-t pt-6">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                Notas
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {vehicle.notes}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ===== Documentos vehiculares ===== */}

      <section className="mt-9">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Documentos</h2>
          {vehicle.status === "active" ? (
            <Link
              className={buttonVariants({ variant: "primary" })}
              href={`/app/vehiculos/${vehicle.id}/documentos/nuevo`}
            >
              <Plus aria-hidden size={18} /> Agregar documento
            </Link>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3">
          {documents?.length ? (
            documents.map((document) => (
              <Link href={`/app/documentos/${document.id}`} key={document.id}>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <FileText aria-hidden size={19} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{document.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        {document.expiration_date
                          ? `Vence ${document.expiration_date}`
                          : "Sin vencimiento"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card className="bg-[var(--color-surface-alt)] shadow-none">
              <CardContent className="p-8 text-center">
                <p className="font-semibold">Todavía no hay documentos</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Agrega tarjeta de circulación, póliza o verificación.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ===== Bitácora de mantenimiento ===== */}

      <section className="mt-9">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Mantenimiento</h2>
          {vehicle.status === "active" ? (
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href={`/app/vehiculos/${vehicle.id}/mantenimientos/nuevo`}
            >
              <Plus aria-hidden size={18} /> Registrar servicio
            </Link>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3">
          {services?.length ? (
            services.map((service) => (
              <Link
                href={`/app/vehiculos/${vehicle.id}/mantenimientos/${service.id}`}
                key={service.id}
              >
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <Wrench aria-hidden size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{service.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        {getServiceSummary(service, vehicle.mileage)}
                      </p>
                    </div>
                    <Badge>
                      {serviceStatusLabels[service.status] ?? service.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card className="bg-[var(--color-surface-alt)] shadow-none">
              <CardContent className="p-8 text-center">
                <p className="font-semibold">Sin servicios registrados</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Registra el mantenimiento más reciente o el próximo.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* ===== Archivado ===== */}

      {vehicle.status === "active" ? (
        <form action={setVehicleArchivedAction} className="mt-9 border-t pt-6">
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <input type="hidden" name="version" value={vehicle.version} />
          <input type="hidden" name="archive" value="true" />
          <button
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-danger-700)]"
            type="submit"
          >
            <Archive aria-hidden size={17} /> Archivar vehículo
          </button>
        </form>
      ) : null}
    </div>
  );
}
