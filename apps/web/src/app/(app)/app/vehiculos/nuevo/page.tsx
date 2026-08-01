import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { VehicleForm } from "@/features/vehicles/vehicle-form";

export default function NewVehiclePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/vehiculos"
      >
        <ArrowLeft aria-hidden size={18} /> Vehículos
      </Link>

      {/* ===== Introducción ===== */}

      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Nuevo vehículo
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Empieza con un alias reconocible. Los demás datos pueden completarse
        después.
      </p>

      {/* ===== Captura de información ===== */}

      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <VehicleForm />
        </CardContent>
      </Card>
    </div>
  );
}
