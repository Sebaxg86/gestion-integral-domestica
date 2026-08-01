import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VehicleForm } from "@/features/vehicles/vehicle-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  // ===== Consulta del vehículo editable =====

  const { vehicleId } = await params;
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select(
      "id, name, type, make, model, model_year, trim, color, vin, license_plate, mileage, fuel_type, notes, version",
    )
    .eq("id", vehicleId)
    .eq("status", "active")
    .single();

  if (!vehicle) notFound();

  // ===== Renderizado del formulario =====

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/vehiculos/${vehicle.id}`}
      >
        <ArrowLeft aria-hidden size={18} /> {vehicle.name}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Editar vehículo
      </h1>
      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <VehicleForm vehicle={vehicle} />
        </CardContent>
      </Card>
    </div>
  );
}
