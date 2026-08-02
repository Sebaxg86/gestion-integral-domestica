import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ServiceForm } from "@/features/vehicle-services/service-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditVehicleServicePage({
  params,
}: {
  params: Promise<{ vehicleId: string; serviceId: string }>;
}) {
  // ===== Consulta del servicio y recordatorio =====

  const { vehicleId, serviceId } = await params;
  const supabase = await createClient();
  const [{ data: service }, { data: reminder }] = await Promise.all([
    supabase
      .from("vehicle_services")
      .select(
        "id, vehicle_id, title, type, status, service_date, mileage, provider, cost, notes, next_due_date, next_due_mileage, version",
      )
      .eq("id", serviceId)
      .eq("vehicle_id", vehicleId)
      .single(),
    supabase
      .from("reminders")
      .select("lead_days, repeat_interval_days")
      .eq("vehicle_service_id", serviceId)
      .in("status", ["scheduled", "notified"])
      .maybeSingle(),
  ]);
  if (!service) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/vehiculos/${vehicleId}/mantenimientos/${service.id}`}
      >
        <ArrowLeft aria-hidden size={18} /> {service.title}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Editar servicio
      </h1>
      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <ServiceForm
            vehicleId={vehicleId}
            service={{ ...service, reminder }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
