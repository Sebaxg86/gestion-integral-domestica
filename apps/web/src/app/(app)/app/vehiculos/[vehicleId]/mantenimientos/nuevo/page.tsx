import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ServiceForm } from "@/features/vehicle-services/service-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewVehicleServicePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  // ===== Consulta del vehículo =====

  const { vehicleId } = await params;
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, name")
    .eq("id", vehicleId)
    .eq("status", "active")
    .single();
  if (!vehicle) notFound();

  // ===== Captura del servicio =====

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/vehiculos/${vehicle.id}`}
      >
        <ArrowLeft aria-hidden size={18} /> {vehicle.name}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Registrar servicio
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Guarda lo realizado y programa la siguiente atención.
      </p>
      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <ServiceForm vehicleId={vehicle.id} />
        </CardContent>
      </Card>
    </div>
  );
}
