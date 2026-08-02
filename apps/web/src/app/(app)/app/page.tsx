import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CarFront,
  FileText,
  House,
  ListTodo,
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
import { getMileageAttention } from "@/features/vehicle-mileage/attention";
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

type DashboardScheduledService = {
  id: string;
  due_date: string;
  scheduled_service: { id: string; name: string; status: string };
};

type DashboardTask = {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
};

const statusCopy = {
  expired: "Vencido",
  today: "Vence hoy",
  upcoming: "Próximo",
} as const;

function getServiceAttentionSummary(service: DashboardService) {
  // ===== Prioridad del vencimiento por kilometraje =====

  const mileageAttention = getMileageAttention(
    service.next_due_mileage,
    service.vehicle.mileage,
  );

  if (mileageAttention?.due) {
    return "Kilometraje alcanzado";
  }

  if (mileageAttention?.upcoming) {
    return `Faltan ${mileageAttention.remainingMileage.toLocaleString("es-MX")} km`;
  }

  // ===== Respaldo para vencimientos por fecha =====

  if (service.next_due_date) {
    return formatDate(service.next_due_date);
  }

  return "Revisar mantenimiento";
}

function getTaskAttentionBadge(
  task: DashboardTask,
  dateStatus: ReturnType<typeof classifyExpiration> | null,
) {
  // ===== Priorización de la señal más importante =====

  if (dateStatus === "expired") {
    return { status: "expired" as const, label: "Vencido" };
  }

  if (task.priority === "high") {
    return { status: "today" as const, label: "Prioridad alta" };
  }

  if (dateStatus === "today") {
    return { status: "today" as const, label: "Vence hoy" };
  }

  return { status: "upcoming" as const, label: "Próximo" };
}

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
    { data: scheduledServiceRows },
    { data: taskRows },
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
      .from("scheduled_service_occurrences")
      .select(
        "id, due_date, scheduled_service:scheduled_services!inner(id, name, status)",
      )
      .eq("family_id", family.id)
      .eq("status", "pending")
      .eq("scheduled_service.status", "active")
      .order("due_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, priority, due_date, status")
      .eq("family_id", family.id)
      .in("status", ["pending", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false }),
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
    const mileageAttention = getMileageAttention(
      service.next_due_mileage,
      service.vehicle.mileage,
    );
    const dueByMileage = mileageAttention?.upcoming ?? false;

    return dueByDate || dueByMileage;
  });
  const scheduledServices = (scheduledServiceRows ??
    []) as unknown as DashboardScheduledService[];
  const attentionScheduledServices = scheduledServices.filter(
    (service) => classifyExpiration(service.due_date, localDate) !== "later",
  );
  const tasks = (taskRows ?? []) as DashboardTask[];
  const attentionTasks = tasks.filter(
    (task) =>
      task.priority === "high" ||
      (task.due_date !== null &&
        classifyExpiration(task.due_date, localDate) !== "later"),
  );

  // ===== Estado inicial sin recursos =====

  if (
    !propertyRows?.length &&
    !vehicleRows?.length &&
    !scheduledServices.length &&
    !tasks.length
  ) {
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
        <div className="flex gap-2">
          <Link
            className={buttonVariants({ variant: "secondary", size: "icon" })}
            href="/app/pendientes/nuevo"
            aria-label="Agregar pendiente"
          >
            <Plus aria-hidden size={19} />
          </Link>
          <Link
            className={buttonVariants({ variant: "secondary", size: "icon" })}
            href="/app/avisos"
            aria-label={`${unreadCount ?? 0} avisos sin leer`}
          >
            <Bell aria-hidden size={19} />
          </Link>
        </div>
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

      {/* ===== Pendientes prioritarios ===== */}

      {attentionTasks.length ? (
        <section className="mt-9">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Pendientes</h2>
            <Link
              className="text-sm font-semibold text-[var(--color-brand-800)]"
              href="/app/pendientes"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-3 grid gap-3">
            {attentionTasks.map((task) => {
              const dateStatus = task.due_date
                ? classifyExpiration(task.due_date, localDate)
                : null;
              const badge = getTaskAttentionBadge(task, dateStatus);

              return (
                <Link href={`/app/pendientes/${task.id}`} key={task.id}>
                  <Card>
                    <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                        <ListTodo aria-hidden size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{task.title}</p>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {task.due_date
                            ? formatDate(task.due_date)
                            : "Sin fecha límite"}
                        </p>
                      </div>
                      <Badge status={badge.status}>{badge.label}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

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
                        {service.vehicle.name} ·{" "}
                        {getServiceAttentionSummary(service)}
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

      {/* ===== Servicios programados próximos ===== */}

      {attentionScheduledServices.length ? (
        <section className="mt-9">
          <h2 className="text-lg font-semibold">Servicios programados</h2>
          <div className="mt-3 grid gap-3">
            {attentionScheduledServices.map((occurrence) => {
              const dateStatus = classifyExpiration(
                occurrence.due_date,
                localDate,
              );

              return (
                <Link
                  href={`/app/servicios/${occurrence.scheduled_service.id}`}
                  key={occurrence.id}
                >
                  <Card>
                    <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                        <CalendarClock aria-hidden size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {occurrence.scheduled_service.name}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {formatDate(occurrence.due_date)}
                        </p>
                      </div>
                      <Badge
                        status={dateStatus === "later" ? "neutral" : dateStatus}
                      >
                        {dateStatus === "later"
                          ? "Programado"
                          : statusCopy[dateStatus]}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
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
