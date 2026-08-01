import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PropertyForm } from "@/features/properties/property-form";

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/viviendas"
      >
        <ArrowLeft aria-hidden size={18} /> Viviendas
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Nueva vivienda
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Usa un nombre que reconozcas rápido. La dirección es opcional.
      </p>
      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <PropertyForm />
        </CardContent>
      </Card>
    </div>
  );
}
