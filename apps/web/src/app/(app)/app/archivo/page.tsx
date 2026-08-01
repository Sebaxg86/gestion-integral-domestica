import { Badge, Card, CardContent } from "@gid/ui";
import { ArchiveRestore, FileText, House } from "lucide-react";
import Link from "next/link";

import { setDocumentArchivedAction } from "@/features/documents/actions";
import { setPropertyArchivedAction } from "@/features/properties/actions";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ArchivePage() {
  const context = await getSessionContext();
  const supabase = await createClient();
  const [{ data: properties }, { data: documents }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, version")
      .eq("family_id", context!.family!.id)
      .eq("status", "archived")
      .order("updated_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, property_id, name, version")
      .eq("family_id", context!.family!.id)
      .eq("status", "archived")
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-[-0.04em]">Archivo</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Elementos conservados fuera de las vistas principales.
      </p>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Viviendas</h2>
        <div className="mt-3 grid gap-3">
          {properties?.length ? (
            properties.map((property) => (
              <Card key={property.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <House
                    aria-hidden
                    className="text-[var(--color-brand-800)]"
                    size={20}
                  />
                  <Link
                    className="min-w-0 flex-1 truncate font-semibold"
                    href={`/app/viviendas/${property.id}`}
                  >
                    {property.name}
                  </Link>
                  <Badge>Archivada</Badge>
                  <form action={setPropertyArchivedAction}>
                    <input
                      type="hidden"
                      name="propertyId"
                      value={property.id}
                    />
                    <input
                      type="hidden"
                      name="version"
                      value={property.version}
                    />
                    <input type="hidden" name="archive" value="false" />
                    <button
                      className="grid size-11 place-items-center text-[var(--color-brand-800)]"
                      aria-label={`Restaurar ${property.name}`}
                    >
                      <ArchiveRestore aria-hidden size={18} />
                    </button>
                  </form>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No hay viviendas archivadas.
            </p>
          )}
        </div>
      </section>
      <section className="mt-9">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <div className="mt-3 grid gap-3">
          {documents?.length ? (
            documents.map((document) => (
              <Card key={document.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <FileText
                    aria-hidden
                    className="text-[var(--color-brand-800)]"
                    size={20}
                  />
                  <Link
                    className="min-w-0 flex-1 truncate font-semibold"
                    href={`/app/documentos/${document.id}`}
                  >
                    {document.name}
                  </Link>
                  <Badge>Archivado</Badge>
                  <form action={setDocumentArchivedAction}>
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />
                    <input
                      type="hidden"
                      name="propertyId"
                      value={document.property_id}
                    />
                    <input
                      type="hidden"
                      name="version"
                      value={document.version}
                    />
                    <input type="hidden" name="archive" value="false" />
                    <button
                      className="grid size-11 place-items-center text-[var(--color-brand-800)]"
                      aria-label={`Restaurar ${document.name}`}
                    >
                      <ArchiveRestore aria-hidden size={18} />
                    </button>
                  </form>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No hay documentos archivados.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
