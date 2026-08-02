import { Badge, Button, buttonVariants, Card, CardContent } from "@gid/ui";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CirclePlay,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/features/documents/expiration";
import { setTaskStatusAction } from "@/features/tasks/actions";
import {
  taskCategoryLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/features/tasks/config";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Detalle de un pendiente
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

function StatusForm({
  taskId,
  version,
  status,
  children,
}: {
  taskId: string;
  version: number;
  status: string;
  children: React.ReactNode;
}) {
  // ===== Formulario reutilizable de transición =====

  return (
    <form action={setTaskStatusAction}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="status" value={status} />
      {children}
    </form>
  );
}

function getTaskBadgeStatus(status: string, priority: string) {
  // ===== Selección del énfasis visual =====

  if (status === "completed") {
    return "success" as const;
  }

  if (priority === "high") {
    return "today" as const;
  }

  return "neutral" as const;
}

function getReminderLabel(leadDays: number | null) {
  // ===== Descripción legible de la anticipación =====

  if (leadDays === null) {
    return "Sin aviso";
  }

  if (leadDays === 0) {
    return "El mismo día";
  }

  return `${leadDays} días antes`;
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  // ===== Consulta del pendiente y sus relaciones =====

  const { taskId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, title, description, category, priority, due_date, reminder_lead_days, reminder_repeat_interval_days, status, completed_at, cancelled_at, created_at, version, property:properties(name), vehicle:vehicles(name), scheduled_service:scheduled_services(name)",
    )
    .eq("id", taskId)
    .single();

  if (!task) {
    notFound();
  }

  // ===== Preparación de textos relacionados =====

  const property = task.property as unknown as { name: string } | null;
  const vehicle = task.vehicle as unknown as { name: string } | null;
  const service = task.scheduled_service as unknown as { name: string } | null;
  const targetName =
    property?.name ?? vehicle?.name ?? service?.name ?? "Familia en general";
  const active = ["pending", "in_progress"].includes(task.status);

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/pendientes"
      >
        <ArrowLeft aria-hidden size={18} /> Pendientes
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              {task.title}
            </h1>
            <Badge status={getTaskBadgeStatus(task.status, task.priority)}>
              {taskStatusLabels[task.status] ?? task.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {taskCategoryLabels[task.category] ?? task.category}
          </p>
        </div>
        {active ? (
          <Link
            className={buttonVariants({ variant: "secondary", size: "icon" })}
            href={`/app/pendientes/${task.id}/editar`}
            aria-label="Editar pendiente"
          >
            <Pencil aria-hidden size={17} />
          </Link>
        ) : null}
      </div>

      {error ? (
        <p
          className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          No pudimos cambiar el estado. Actualiza la página e inténtalo de
          nuevo.
        </p>
      ) : null}

      {/* ===== Información principal ===== */}

      <Card className="mt-8">
        <CardContent className="p-5 sm:p-7">
          <dl className="grid gap-6 sm:grid-cols-2">
            <Data label="Relacionado con" value={targetName} />
            <Data
              label="Prioridad"
              value={taskPriorityLabels[task.priority] ?? task.priority}
            />
            <Data
              label="Fecha límite"
              value={task.due_date ? formatDate(task.due_date) : "Sin fecha"}
            />
            <Data
              label="Recordatorio"
              value={getReminderLabel(task.reminder_lead_days)}
            />
          </dl>
          {task.description ? (
            <p className="mt-7 whitespace-pre-wrap border-t pt-6 text-sm leading-6">
              {task.description}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ===== Acciones de estado ===== */}

      <div className="mt-5 flex flex-wrap gap-2">
        {task.status === "pending" ? (
          <StatusForm
            taskId={task.id}
            version={task.version}
            status="in_progress"
          >
            <Button type="submit" variant="secondary">
              <CirclePlay aria-hidden size={18} /> Iniciar
            </Button>
          </StatusForm>
        ) : null}

        {task.status === "in_progress" ? (
          <StatusForm taskId={task.id} version={task.version} status="pending">
            <Button type="submit" variant="secondary">
              Volver a pendiente
            </Button>
          </StatusForm>
        ) : null}

        {active ? (
          <>
            <StatusForm
              taskId={task.id}
              version={task.version}
              status="completed"
            >
              <Button type="submit">
                <Check aria-hidden size={18} /> Completar
              </Button>
            </StatusForm>
            <StatusForm
              taskId={task.id}
              version={task.version}
              status="cancelled"
            >
              <Button type="submit" variant="tertiary">
                <X aria-hidden size={18} /> Cancelar
              </Button>
            </StatusForm>
          </>
        ) : (
          <StatusForm taskId={task.id} version={task.version} status="pending">
            <Button type="submit" variant="secondary">
              <RotateCcw aria-hidden size={18} /> Reabrir
            </Button>
          </StatusForm>
        )}
      </div>

      {/* ===== Datos de historial ===== */}

      <div className="mt-9 flex items-center gap-3 border-t pt-6 text-sm text-[var(--color-text-secondary)]">
        <CalendarDays aria-hidden size={18} />
        Creado el {formatDate(task.created_at.slice(0, 10))}
      </div>
    </div>
  );
}
