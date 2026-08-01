import { buttonVariants, Card, CardContent } from "@gid/ui";
import { Archive, ArrowLeft, FileText, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { setPropertyArchivedAction } from "@/features/properties/actions";
import { createClient } from "@/lib/supabase/server";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const supabase = await createClient();
  const [{ data: property }, { data: documents }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, type, address, status, version")
      .eq("id", propertyId)
      .single(),
    supabase
      .from("documents")
      .select("id, name, category, expiration_date")
      .eq("property_id", propertyId)
      .eq("status", "active")
      .order("name"),
  ]);
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href="/app/viviendas"
      >
        <ArrowLeft aria-hidden size={18} /> Viviendas
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">
            {property.name}
          </h1>
          {property.address ? (
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {property.address}
            </p>
          ) : null}
        </div>
        {property.status === "active" ? (
          <div className="flex gap-2">
            <Link
              className={buttonVariants({ variant: "secondary", size: "icon" })}
              href={`/app/viviendas/${property.id}/editar`}
              aria-label="Editar vivienda"
            >
              <Pencil aria-hidden size={17} />
            </Link>
            <Link
              className={buttonVariants({ variant: "primary" })}
              href={`/app/viviendas/${property.id}/documentos/nuevo`}
            >
              <Plus aria-hidden size={18} /> Agregar documento
            </Link>
          </div>
        ) : null}
      </div>

      <section className="mt-9">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <div className="mt-3 grid gap-3">
          {documents?.length ? (
            documents.map((document) => (
              <Link href={`/app/documentos/${document.id}`} key={document.id}>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <FileText aria-hidden size={19} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{document.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        {document.expiration_date
                          ? `Vence ${document.expiration_date}`
                          : "Sin vencimiento"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <Card className="bg-[var(--color-surface-alt)] shadow-none">
              <CardContent className="p-8 text-center">
                <p className="font-semibold">Todavía no hay documentos</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Agrega el primero para organizar su archivo y vencimiento.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {property.status === "active" ? (
        <form action={setPropertyArchivedAction} className="mt-9 border-t pt-6">
          <input type="hidden" name="propertyId" value={property.id} />
          <input type="hidden" name="version" value={property.version} />
          <input type="hidden" name="archive" value="true" />
          <button
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-danger-700)]"
            type="submit"
          >
            <Archive aria-hidden size={17} /> Archivar vivienda
          </button>
        </form>
      ) : null}
    </div>
  );
}
