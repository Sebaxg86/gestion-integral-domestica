import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import { ArrowRight, CheckCircle2, ListTodo, Plus } from "lucide-react";
import Link from "next/link";

import {
  classifyExpiration,
  formatDate,
  getLocalDate,
} from "@/features/documents/expiration";
import {
  taskCategoryLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/features/tasks/config";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type TaskRow = {
  id: string;
  title: string;
  category: string;
  priority: string;
  due_date: string | null;
  status: string;
  updated_at: string;
};

const dateStatusLabels = {
  expired: "Vencido",
  today: "Hoy",
  upcoming: "Próximo",
  later: "Programado",
} as const;

function getTaskBadgeStatus(task: TaskRow, dateStatus: string | null) {
  // ===== Priorización visual de vencimientos y urgencia =====

  if (dateStatus === "expired") {
    return "expired" as const;
  }

  if (task.priority === "high" || dateStatus === "today") {
    return "today" as const;
  }

  if (dateStatus === "upcoming") {
    return "upcoming" as const;
  }

  return "neutral" as const;
}

// ============================================================================
// Listado de pendientes
// ============================================================================

function TaskCard({ task, localDate }: { task: TaskRow; localDate: string }) {
  // ===== Preparación del estado visual =====

  const dateStatus = task.due_date
    ? classifyExpiration(task.due_date, localDate)
    : null;
  const badgeStatus = getTaskBadgeStatus(task, dateStatus);

  // ===== Renderizado de la tarjeta =====

  return (
    <Link href={`/app/pendientes/${task.id}`}>
      <Card className="transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]">
        <CardContent className="flex items-center gap-4 p-4 sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
            <ListTodo aria-hidden size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{task.title}</p>
            <p className="mt-1 truncate text-sm text-[var(--color-text-secondary)]">
              {taskCategoryLabels[task.category] ?? task.category}
              {` · ${taskPriorityLabels[task.priority] ?? task.priority}`}
              {task.due_date ? ` · ${formatDate(task.due_date)}` : ""}
            </p>
          </div>
          <Badge status={badgeStatus}>
            {dateStatus
              ? dateStatusLabels[dateStatus]
              : (taskStatusLabels[task.status] ?? task.status)}
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
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // ===== Consulta de pendientes activos e historial =====

  const context = await getSessionContext();
  const family = context!.family!;
  const supabase = await createClient();
  const [{ data: activeRows }, { data: completedRows }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, category, priority, due_date, status, updated_at")
      .eq("family_id", family.id)
      .in("status", ["pending", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, category, priority, due_date, status, updated_at")
      .eq("family_id", family.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10),
  ]);
  const activeTasks = (activeRows ?? []) as TaskRow[];
  const completedTasks = (completedRows ?? []) as TaskRow[];
  const localDate = getLocalDate(family.timezone);
  const { error } = await searchParams;

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            Pendientes
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Acciones concretas que requieren seguimiento.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "primary" })}
          href="/app/pendientes/nuevo"
        >
          <Plus aria-hidden size={18} /> Agregar pendiente
        </Link>
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

      {/* ===== Pendientes activos ===== */}

      <div className="mt-7 grid gap-3">
        {activeTasks.length ? (
          activeTasks.map((task) => (
            <TaskCard key={task.id} task={task} localDate={localDate} />
          ))
        ) : (
          <Card className="bg-[var(--color-surface-alt)] shadow-none">
            <CardContent className="p-8 text-center">
              <p className="font-semibold">No tienes pendientes activos</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Agrega una tarea cuando necesites darle seguimiento.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== Historial completado ===== */}

      {completedTasks.length ? (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <CheckCircle2
              aria-hidden
              className="text-[var(--color-success-700)]"
              size={19}
            />
            <h2 className="text-lg font-semibold">Completados recientemente</h2>
          </div>
          <div className="mt-3 grid gap-2">
            {completedTasks.map((task) => (
              <Link
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-[var(--shadow-control)]"
                href={`/app/pendientes/${task.id}`}
                key={task.id}
              >
                <span className="truncate text-sm font-medium">
                  {task.title}
                </span>
                <Badge status="success">Completado</Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
