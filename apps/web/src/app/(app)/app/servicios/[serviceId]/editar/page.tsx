import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ScheduledServiceForm } from "@/features/scheduled-services/scheduled-service-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditScheduledServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  // ===== Consulta de la programación editable =====

  const { serviceId } = await params;
  const supabase = await createClient();
  const [{ data: service }, { data: occurrence }] = await Promise.all([
    supabase
      .from("scheduled_services")
      .select(
        "id, family_id, property_id, name, category, provider, recurrence, custom_interval_days, lead_days, repeat_interval_days, notes, status, version",
      )
      .eq("id", serviceId)
      .eq("status", "active")
      .single(),
    supabase
      .from("scheduled_service_occurrences")
      .select("id, due_date")
      .eq("scheduled_service_id", serviceId)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (!service || !occurrence) notFound();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name")
    .eq("family_id", service.family_id)
    .eq("status", "active")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/servicios/${serviceId}`}
      >
        <ArrowLeft aria-hidden size={18} /> Servicio
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Editar servicio
      </h1>

      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <ScheduledServiceForm
            properties={properties ?? []}
            defaultDueDate={occurrence.due_date}
            service={{
              ...service,
              due_date: occurrence.due_date,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
