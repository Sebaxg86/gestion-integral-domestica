import { Badge, Card, CardContent } from "@gid/ui";
import { Bell } from "lucide-react";
import Link from "next/link";

import { markNotificationReadAction } from "@/features/notifications/actions";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  status: "unread" | "read";
  created_at: string;
  reminder: {
    document_id: string | null;
    vehicle_id: string | null;
    vehicle_service: { id: string; vehicle_id: string } | null;
    scheduled_service_occurrence: {
      scheduled_service: { id: string };
    } | null;
    task: { id: string } | null;
  };
};

function getNotificationPath(notification: NotificationRow) {
  // ===== Selección del recurso que originó el aviso =====

  if (notification.reminder.document_id) {
    return `/app/documentos/${notification.reminder.document_id}`;
  }

  const service = notification.reminder.vehicle_service;

  if (service) {
    return `/app/vehiculos/${service.vehicle_id}/mantenimientos/${service.id}`;
  }

  if (notification.reminder.vehicle_id) {
    return `/app/vehiculos/${notification.reminder.vehicle_id}`;
  }

  const scheduledService =
    notification.reminder.scheduled_service_occurrence?.scheduled_service;

  if (scheduledService) {
    return `/app/servicios/${scheduledService.id}`;
  }

  if (notification.reminder.task) {
    return `/app/pendientes/${notification.reminder.task.id}`;
  }

  return "/app/avisos";
}

export default async function NotificationsPage() {
  const context = await getSessionContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select(
      "id, title, message, status, created_at, reminder:reminders(document_id, vehicle_id, vehicle_service:vehicle_services(id, vehicle_id), scheduled_service_occurrence:scheduled_service_occurrences(scheduled_service:scheduled_services(id)), task:tasks(id))",
    )
    .eq("family_id", context!.family!.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const notifications = (data ?? []) as unknown as NotificationRow[];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-[-0.04em]">Avisos</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Señales persistentes sobre vencimientos que requieren atención.
      </p>
      <div className="mt-7 grid gap-3">
        {notifications.length ? (
          notifications.map((notification) => (
            <Card
              className={
                notification.status === "unread"
                  ? "ring-1 ring-[var(--color-brand-100)]"
                  : ""
              }
              key={notification.id}
            >
              <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                  <Bell aria-hidden size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="font-semibold hover:underline"
                      href={getNotificationPath(notification)}
                    >
                      {notification.title}
                    </Link>
                    {notification.status === "unread" ? (
                      <Badge status="upcoming">Nuevo</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-disabled)]">
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(notification.created_at))}
                  </p>
                </div>
                {notification.status === "unread" ? (
                  <form action={markNotificationReadAction}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <button
                      className="min-h-11 whitespace-nowrap text-xs font-semibold text-[var(--color-brand-800)]"
                      type="submit"
                    >
                      Marcar leído
                    </button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="bg-[var(--color-surface-alt)] shadow-none">
            <CardContent className="p-10 text-center">
              <Bell
                aria-hidden
                className="mx-auto text-[var(--color-text-disabled)]"
                size={26}
              />
              <p className="mt-3 font-semibold">No tienes avisos</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Aquí aparecerán cuando un recordatorio llegue a su fecha.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
