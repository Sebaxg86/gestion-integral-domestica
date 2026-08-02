import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { getLocalDate } from "@/features/documents/expiration";
import { ScheduledServiceForm } from "@/features/scheduled-services/scheduled-service-form";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function NewScheduledServicePage() {
  // ===== Consulta del contexto opcional =====

  const context = await getSessionContext();
  const family = context!.family!;
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name")
    .eq("family_id", family.id)
    .eq("status", "active")
    .order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/servicios"
      >
        <ArrowLeft aria-hidden size={18} /> Servicios
      </Link>

      {/* ===== Introducción ===== */}

      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Nuevo servicio programado
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Registra la próxima fecha y decide cómo quieres recibir el recordatorio.
      </p>

      {/* ===== Captura de información ===== */}

      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <ScheduledServiceForm
            properties={properties ?? []}
            defaultDueDate={getLocalDate(family.timezone)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
