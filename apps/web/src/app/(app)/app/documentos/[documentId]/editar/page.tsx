import { Card, CardContent } from "@gid/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditDocumentForm } from "@/features/documents/edit-document-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("documents")
    .select(
      "id, name, category, issue_date, expiration_date, issuer, document_number, notes, version",
    )
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
        Editar documento
      </h1>
      <Card className="mt-7">
        <CardContent className="p-5 sm:p-7">
          <EditDocumentForm document={document} />
        </CardContent>
      </Card>
    </div>
  );
}
