import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { getTaskFormOptions } from "@/features/tasks/data";
import { TaskForm } from "@/features/tasks/task-form";
import { getSessionContext } from "@/lib/auth/session";

export default async function NewTaskPage() {
  // ===== Consulta de relaciones disponibles =====

  const context = await getSessionContext();
  const options = await getTaskFormOptions(context!.family!.id);

  // ===== Renderizado principal =====

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/pendientes"
      >
        <ArrowLeft aria-hidden size={18} /> Pendientes
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Nuevo pendiente
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Captura solo lo necesario; la fecha y el recordatorio son opcionales.
      </p>

      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <TaskForm options={options} />
        </CardContent>
      </Card>
    </div>
  );
}
