import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import {
  ArrowRight,
  Bell,
  CarFront,
  FileText,
  House,
  Plus,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import {
  classifyExpiration,
  daysUntil,
  formatDate,
  getLocalDate,
} from "@/features/documents/expiration";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type DashboardDocument = {
  id: string;
  name: string;
  expiration_date: string;
  property: { name: string; status: string } | null;
  vehicle: { name: string; status: string } | null;
};

type DashboardService = {
  id: string;
  vehicle_id: string;
  title: string;
  next_due_date: string | null;
  next_due_mileage: number | null;
  vehicle: { name: string; mileage: number | null; status: string };
};

const statusCopy = {
  expired: "Vencido",
  today: "Vence hoy",
  upcoming: "Próximo",
} as const;

export default async function DashboardPage() {
  // ===== Contexto y fecha familiar =====

  const context = await getSessionContext();
  const supabase = await createClient();
  const family = context!.family!;
  const localDate = getLocalDate(family.timezone);

  const [
    { data: propertyRows },
    { data: vehicleRows },
    { data: documentRows },
    { data: serviceRows },
    { count: unreadCount },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id")
      .eq("family_id", family.id)
      .eq("status", "active"),
    supabase
      .from("vehicles")
      .select("id")
      .eq("family_id", family.id)
      .eq("status", "active"),
    supabase
      .from("documents")
      .select(
        "id, name, expiration_date, property:properties(name, status), vehicle:vehicles(name, status)",
      )
      .eq("family_id", family.id)
      .eq("status", "active")
      .not("expiration_date", "is", null)
      .order("expiration_date", { ascending: true }),
    supabase
      .from("vehicle_services")
      .select(
        "id, vehicle_id, title, next_due_date, next_due_mileage, vehicle:vehicles!inner(name, mileage, status)",
      )
      .eq("family_id", family.id)
      .neq("status", "cancelled")
      .eq("vehicles.status", "active")
      .or("next_due_date.not.is.null,next_due_mileage.not.is.null"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("status", "unread"),
  ]);

  const documents = (documentRows ?? []) as unknown as DashboardDocument[];
  const attentionDocuments = documents.filter((document) => {
    const hasActiveParent =
      document.property?.status === "active" ||
      document.vehicle?.status === "active";

    return (
      hasActiveParent &&
      classifyExpiration(document.expiration_date, localDate) !== "later"
    );
  });
  const services = (serviceRows ?? []) as unknown as DashboardService[];
  const attentionServices = services.filter((service) => {
    const dueByDate = service.next_due_date
      ? classifyExpiration(service.next_due_date, localDate) !== "later"
      : false;
    const dueByMileage =
      service.next_due_mileage !== null &&
      service.vehicle.mileage !== null &&
      service.vehicle.mileage >= service.next_due_mileage;

    return dueByDate || dueByMileage;
  });

  // ===== Estado inicial sin recursos =====

  if (!propertyRows?.length && !vehicleRows?.length) {
    return (
      <section className="mx-auto max-w-3xl py-8 sm:py-16">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-[var(--color-brand-800)]">
            Tu espacio está listo
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Agrega tu primera vivienda o vehículo.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
            Será el contexto para guardar documentos y organizar vencimientos.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              className={buttonVariants({ variant: "primary", size: "mobile" })}
              href="/app/viviendas/nueva"
            >
              <Plus aria-hidden size={18} /> Agregar vivienda
            </Link>
            <Link
              className={buttonVariants({
                variant: "secondary",
                size: "mobile",
              })}
              href="/app/vehiculos/nuevo"
            >
              <CarFront aria-hidden size={18} /> Agregar vehículo
            </Link>
          </div>
        </div>
        <Card className="mt-10 bg-[var(--color-surface-alt)] shadow-none">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-3">
            <EmptyStep icon={House} number="1" text="Registra una vivienda" />
            <EmptyStep icon={CarFront} number="2" text="O agrega un vehículo" />
            <EmptyStep icon={Bell} number="3" text="Configura sus avisos" />
          </CardContent>
        </Card>
      </section>
    );
  }

  // ===== Panel de próximos vencimientos =====

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {family.name}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
            Lo que requiere atención
          </h1>
        </div>
        <Link
          className={buttonVariants({ variant: "secondary", size: "icon" })}
          href="/app/avisos"
          aria-label={`${unreadCount ?? 0} avisos sin leer`}
        >
          <Bell aria-hidden size={19} />
        </Link>
      </div>

      <div className="mt-8 grid gap-3">
        {attentionDocuments.length ? (
          attentionDocuments.map((document) => {
            const status = classifyExpiration(
              document.expiration_date,
              localDate,
            );
            const difference = daysUntil(document.expiration_date, localDate);
            if (status === "later") return null;
            const parentName =
              document.vehicle?.name ??
              document.property?.name ??
              "Sin contexto";

            return (
              <Link href={`/app/documentos/${document.id}`} key={document.id}>
                <Card className="transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]">
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <FileText aria-hidden size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">
                          {document.name}
                        </p>
                        <Badge status={status}>{statusCopy[status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {parentName} · {formatDate(document.expiration_date)}
                        {status === "upcoming" ? ` · ${difference} días` : ""}
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
            <CardContent className="p-7 text-center">
              <p className="font-semibold">Nada urgente por ahora</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Los próximos 30 días están despejados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== Mantenimientos próximos ===== */}

      {attentionServices.length ? (
        <section className="mt-9">
          <h2 className="text-lg font-semibold">Mantenimiento vehicular</h2>
          <div className="mt-3 grid gap-3">
            {attentionServices.map((service) => (
              <Link
                href={`/app/vehiculos/${service.vehicle_id}/mantenimientos/${service.id}`}
                key={service.id}
              >
                <Card>
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <span className="grid size-11 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <Wrench aria-hidden size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{service.title}</p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {service.vehicle.name}
                        {service.next_due_date
                          ? ` · ${formatDate(service.next_due_date)}`
                          : " · Atención por kilometraje"}
                      </p>
                    </div>
                    <Badge status="upcoming">Revisar</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EmptyStep({
  icon: Icon,
  number,
  text,
}: {
  icon: typeof House;
  number: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:block">
      <span className="grid size-10 place-items-center rounded-xl bg-white text-[var(--color-brand-800)] shadow-[var(--shadow-control)]">
        <Icon aria-hidden size={19} />
      </span>
      <p className="mt-0 text-sm font-medium sm:mt-3">
        <span className="text-[var(--color-text-disabled)]">{number}.</span>{" "}
        {text}
      </p>
    </div>
  );
}
