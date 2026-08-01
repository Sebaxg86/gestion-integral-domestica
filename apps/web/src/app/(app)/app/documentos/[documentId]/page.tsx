import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import {
  Archive,
  ArrowLeft,
  BellRing,
  Download,
  FileText,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  attendReminderAction,
  cancelReminderAction,
  createReminderAction,
  setDocumentArchivedAction,
  updateReminderAction,
} from "@/features/documents/actions";
import { formatDate } from "@/features/documents/expiration";
import { createClient } from "@/lib/supabase/server";

const categoryLabels: Record<string, string> = {
  deed: "Escritura",
  contract: "Contrato",
  insurance_policy: "Póliza de seguro",
  property_tax_receipt: "Recibo de predial",
  appraisal: "Avalúo",
  plan: "Plano",
  warranty: "Garantía",
  invoice: "Factura",
  permit: "Permiso",
  other: "Otro",
};

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const supabase = await createClient();
  const [{ data: document }, { data: file }, { data: reminder }] =
    await Promise.all([
      supabase
        .from("documents")
        .select(
          "id, property_id, name, category, issue_date, expiration_date, issuer, document_number, notes, status, version",
        )
        .eq("id", documentId)
        .single(),
      supabase
        .from("document_files")
        .select(
          "id, storage_key, original_filename, detected_mime_type, size_bytes",
        )
        .eq("document_id", documentId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("reminders")
        .select("id, lead_days, repeat_interval_days, scheduled_for, status, version")
        .eq("document_id", documentId)
        .in("status", ["scheduled", "notified"])
        .maybeSingle(),
    ]);
  if (!document) notFound();

  const signedFile = file
    ? await supabase.storage
        .from("documents")
        .createSignedUrl(file.storage_key, 300, {
          download: file.original_filename,
        })
    : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)]"
        href={`/app/viviendas/${document.property_id}`}
      >
        <ArrowLeft aria-hidden size={18} /> Volver a la vivienda
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              {document.name}
            </h1>
            {document.status === "archived" ? <Badge>Archivado</Badge> : null}
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {categoryLabels[document.category] ?? document.category}
          </p>
        </div>
        <div className="flex gap-2">
          {document.status === "active" ? (
            <Link
              className={buttonVariants({ variant: "secondary", size: "icon" })}
              href={`/app/documentos/${document.id}/editar`}
              aria-label="Editar documento"
            >
              <Pencil aria-hidden size={17} />
            </Link>
          ) : null}
          {signedFile?.data?.signedUrl ? (
            <a
              className={buttonVariants({ variant: "primary" })}
              href={signedFile.data.signedUrl}
            >
              <Download aria-hidden size={18} /> Descargar archivo
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                <FileText aria-hidden size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">Archivo</h2>
                <p className="truncate text-sm text-[var(--color-text-secondary)]">
                  {file?.original_filename ?? "No disponible"}
                </p>
              </div>
            </div>
            {file ? (
              <>
                <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
                  {file.detected_mime_type} ·{" "}
                  {(file.size_bytes / 1024 / 1024).toFixed(2)} MiB · enlace
                  válido 5 minutos
                </p>
                {document.status === "active" ? (
                  <Link
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-brand-800)]"
                    href={`/app/documentos/${document.id}/reemplazar`}
                  >
                    Sustituir archivo
                  </Link>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface-alt)] shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <BellRing
                aria-hidden
                className="text-[var(--color-brand-800)]"
                size={21}
              />
              <h2 className="font-semibold">Recordatorio</h2>
            </div>
            {reminder ? (
              <div className="mt-3">
                {reminder.status === "scheduled" ? (
                  <form action={updateReminderAction} className="grid gap-2">
                    <input
                      type="hidden"
                      name="reminderId"
                      value={reminder.id}
                    />
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />
                    <input
                      type="hidden"
                      name="version"
                      value={reminder.version}
                    />
                    <select
                      className="min-h-11 rounded-lg border bg-white px-3 text-sm"
                      name="leadDays"
                      defaultValue={String(reminder.lead_days)}
                    >
                      <option value="30">30 días antes</option>
                      <option value="15">15 días antes</option>
                      <option value="7">7 días antes</option>
                      <option value="3">3 días antes</option>
                      <option value="1">1 día antes</option>
                      <option value="0">El mismo día</option>
                    </select>
                    <select
                      className="min-h-11 rounded-lg border bg-white px-3 text-sm"
                      name="repeatIntervalDays"
                      defaultValue={String(reminder.repeat_interval_days ?? "")}
                    >
                      <option value="">No repetir</option>
                      <option value="1">Repetir cada día</option>
                      <option value="7">Repetir cada semana</option>
                    </select>
                    <button
                      className="min-h-11 text-left text-sm font-semibold text-[var(--color-brand-800)]"
                      type="submit"
                    >
                      Actualizar recordatorio
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Necesita atención
                    {reminder.repeat_interval_days === 1
                      ? ". Te avisaremos cada día hasta que lo atiendas."
                      : reminder.repeat_interval_days === 7
                        ? ". Te avisaremos cada semana hasta que lo atiendas."
                        : "."}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3">
                  {reminder.status === "notified" ? (
                    <form action={attendReminderAction}>
                      <input
                        type="hidden"
                        name="reminderId"
                        value={reminder.id}
                      />
                      <input
                        type="hidden"
                        name="documentId"
                        value={document.id}
                      />
                      <input
                        type="hidden"
                        name="version"
                        value={reminder.version}
                      />
                      <button
                        className="min-h-11 text-sm font-semibold text-[var(--color-brand-800)]"
                        type="submit"
                      >
                        Marcar atendido
                      </button>
                    </form>
                  ) : null}
                  <form action={cancelReminderAction}>
                    <input
                      type="hidden"
                      name="reminderId"
                      value={reminder.id}
                    />
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />
                    <input
                      type="hidden"
                      name="version"
                      value={reminder.version}
                    />
                    <button
                      className="min-h-11 text-sm font-semibold text-[var(--color-text-secondary)]"
                      type="submit"
                    >
                      Cancelar
                    </button>
                  </form>
                </div>
              </div>
            ) : document.expiration_date && document.status === "active" ? (
              <form action={createReminderAction} className="mt-3 grid gap-3">
                <input type="hidden" name="documentId" value={document.id} />
                <select
                  className="min-h-11 rounded-lg border bg-white px-3 text-sm"
                  name="leadDays"
                  defaultValue="7"
                >
                  <option value="30">30 días antes</option>
                  <option value="15">15 días antes</option>
                  <option value="7">7 días antes</option>
                  <option value="3">3 días antes</option>
                  <option value="1">1 día antes</option>
                  <option value="0">El mismo día</option>
                </select>
                <select
                  className="min-h-11 rounded-lg border bg-white px-3 text-sm"
                  name="repeatIntervalDays"
                  defaultValue=""
                >
                  <option value="">No repetir</option>
                  <option value="1">Repetir cada día hasta atenderlo</option>
                  <option value="7">Repetir cada semana hasta atenderlo</option>
                </select>
                <button
                  className="min-h-11 text-left text-sm font-semibold text-[var(--color-brand-800)]"
                  type="submit"
                >
                  Crear recordatorio
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                Agrega un vencimiento para configurar un aviso.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Data
            label="Emisión"
            value={
              document.issue_date
                ? formatDate(document.issue_date)
                : "No indicada"
            }
          />
          <Data
            label="Vencimiento"
            value={
              document.expiration_date
                ? formatDate(document.expiration_date)
                : "Sin vencimiento"
            }
          />
          <Data label="Institución" value={document.issuer || "No indicada"} />
          <Data
            label="Número"
            value={document.document_number || "No indicado"}
          />
          {document.notes ? (
            <div className="sm:col-span-2">
              <Data label="Notas" value={document.notes} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {document.status === "active" ? (
        <form action={setDocumentArchivedAction} className="mt-8 border-t pt-6">
          <input type="hidden" name="documentId" value={document.id} />
          <input type="hidden" name="propertyId" value={document.property_id} />
          <input type="hidden" name="version" value={document.version} />
          <input type="hidden" name="archive" value="true" />
          <button
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-danger-700)]"
            type="submit"
          >
            <Archive aria-hidden size={17} /> Archivar documento
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-disabled)]">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm">{value}</dd>
    </div>
  );
}
