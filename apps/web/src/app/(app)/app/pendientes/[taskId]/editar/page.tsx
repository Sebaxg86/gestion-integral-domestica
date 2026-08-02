import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getTaskFormOptions } from "@/features/tasks/data";
import { TaskForm } from "@/features/tasks/task-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  // ===== Consulta del pendiente editable =====

  const { taskId } = await params;
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, family_id, property_id, vehicle_id, scheduled_service_id, title, description, category, priority, due_date, reminder_lead_days, reminder_repeat_interval_days, version",
    )
    .eq("id", taskId)
    .in("status", ["pending", "in_progress"])
    .single();

  if (!task) {
    notFound();
  }

  const options = await getTaskFormOptions(task.family_id);

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/pendientes/${taskId}`}
      >
        <ArrowLeft aria-hidden size={18} /> Pendiente
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Editar pendiente
      </h1>

      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <TaskForm options={options} task={task} />
        </CardContent>
      </Card>
    </div>
  );
}
