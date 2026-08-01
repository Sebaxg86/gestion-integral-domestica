import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentForm } from "@/features/documents/document-form";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function NewDocumentPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const context = await getSessionContext();
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("properties")
    .select("id, name, status")
    .eq("id", propertyId)
    .eq("status", "active")
    .single();
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/viviendas/${property.id}`}
      >
        <ArrowLeft aria-hidden size={18} /> {property.name}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Nuevo documento
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Primero el archivo y sus datos; después las fechas y el aviso.
      </p>
      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <DocumentForm
            familyId={context!.family!.id}
            propertyId={property.id}
            propertyName={property.name}
          />
        </CardContent>
      </Card>
    </div>
  );
}
