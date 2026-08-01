import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReplaceFileForm } from "@/features/documents/replace-file-form";
import { createClient } from "@/lib/supabase/server";

export default async function ReplaceFilePage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id, name, version")
    .eq("id", documentId)
    .eq("status", "active")
    .single();
  if (!document) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/documentos/${document.id}`}
      >
        <ArrowLeft aria-hidden size={18} /> {document.name}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        Sustituir archivo
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        El actual continuará activo si la carga o validación del nuevo falla.
      </p>
      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <ReplaceFileForm
            documentId={document.id}
            version={document.version}
          />
        </CardContent>
      </Card>
    </div>
  );
}
