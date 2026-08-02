"use client";

import { Button, Field, FieldLabel } from "@gid/ui";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";

import {
  getDocumentNameFromFilename,
  getFileError,
  getFunctionErrorMessage,
} from "@/features/documents/file-upload";
import { createClient } from "@/lib/supabase/browser";

const MAX_FILES_PER_UPLOAD = 5;

// ============================================================================
// Carga privada de comprobantes de mantenimiento
// ============================================================================

function getAttachmentTitle(filename: string, index: number) {
  // ===== Derivación de un título legible =====

  const title = getDocumentNameFromFilename(filename);

  if (title.length >= 2) {
    return title;
  }

  return `Archivo ${index + 1}`;
}

export function ServiceAttachmentForm({
  familyId,
  vehicleId,
  serviceId,
}: {
  familyId: string;
  vehicleId: string;
  serviceId: string;
}) {
  // ===== Estado de selección y carga =====

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string>();
  const [message, setMessage] = useState<string>();

  let selectedFilesLabel = "Seleccionar archivos";

  if (files.length === 1) {
    selectedFilesLabel = "1 archivo seleccionado";
  }

  if (files.length > 1) {
    selectedFilesLabel = `${files.length} archivos seleccionados`;
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    // ===== Validación temprana de la selección =====

    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length > MAX_FILES_PER_UPLOAD) {
      setFiles([]);
      setMessage("Puedes cargar hasta 5 archivos a la vez.");
      return;
    }

    const invalidFile = selectedFiles.find((file) => getFileError(file));

    if (invalidFile) {
      setFiles([]);
      setMessage(getFileError(invalidFile));
      return;
    }

    setFiles(selectedFiles);
    setMessage(undefined);
  }

  async function submitAttachments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // ===== Validación final antes de iniciar la carga =====

    if (!files.length) {
      setMessage("Selecciona al menos un archivo.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const kind = String(formData.get("kind") ?? "other");
    setPending(true);
    setMessage(undefined);

    try {
      // ===== Validación de la sesión actual =====

      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();

      if (userError || !userData.user || !sessionData.session) {
        setMessage("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }

      // ===== Carga y finalización secuencial =====

      for (const [index, file] of files.entries()) {
        const uploadId = crypto.randomUUID();
        const attachmentId = crypto.randomUUID();
        const stagedPath = `staging/${userData.user.id}/${uploadId}`;
        setStatus(`Subiendo archivo ${index + 1} de ${files.length}…`);

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(stagedPath, file, {
            cacheControl: "no-cache",
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          throw new Error("UPLOAD_FAILED");
        }

        setStatus(`Validando archivo ${index + 1} de ${files.length}…`);

        const { error: finalizeError } = await supabase.functions.invoke(
          "finalize-service-attachment",
          {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: {
              uploadId,
              attachmentId,
              familyId,
              serviceId,
              kind,
              title: getAttachmentTitle(file.name, index),
              originalFilename: file.name,
            },
          },
        );

        if (finalizeError) {
          setMessage(
            await getFunctionErrorMessage(
              finalizeError,
              "No pudimos validar y guardar uno de los archivos.",
            ),
          );
          return;
        }
      }

      // ===== Limpieza y actualización de la vista =====

      setFiles([]);
      setStatus(undefined);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.push(
        `/app/vehiculos/${vehicleId}/mantenimientos/${serviceId}`,
      );
      router.refresh();
    } catch {
      setMessage(
        "No pudimos cargar los archivos. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setPending(false);
      setStatus(undefined);
    }
  }

  // ===== Renderizado del formulario =====

  return (
    <form className="grid gap-4" noValidate onSubmit={submitAttachments}>
      {message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {message}
        </p>
      ) : null}
      {status ? (
        <div
          className="rounded-xl bg-[var(--color-brand-100)] p-3 text-sm text-[var(--color-brand-900)]"
          role="status"
          aria-live="polite"
        >
          <p>{status}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-brand-700)_20%,transparent)]">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-[var(--color-brand-700)]" />
          </div>
        </div>
      ) : null}

      {/* ===== Clasificación del archivo ===== */}

      <Field>
        <FieldLabel htmlFor="attachment-kind">Tipo</FieldLabel>
        <select
          className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
          id="attachment-kind"
          name="kind"
          defaultValue="receipt"
        >
          <option value="invoice">Factura</option>
          <option value="receipt">Recibo o comprobante</option>
          <option value="photo">Fotografía</option>
          <option value="warranty">Garantía</option>
          <option value="other">Otro</option>
        </select>
      </Field>

      {/* ===== Selección de archivos privados ===== */}

      <Field>
        <FieldLabel htmlFor="service-attachments">Archivos</FieldLabel>
        <label
          className="grid min-h-28 cursor-pointer place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-alt)] p-5 text-center"
          htmlFor="service-attachments"
        >
          <span>
            <FileUp
              aria-hidden
              className="mx-auto text-[var(--color-brand-800)]"
              size={23}
            />
            <span className="mt-2 block text-sm font-semibold">
              {selectedFilesLabel}
            </span>
            <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
              PDF, JPEG o PNG · hasta 5 archivos de 10 MiB
            </span>
          </span>
        </label>
        <input
          ref={fileInputRef}
          className="sr-only"
          id="service-attachments"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          onChange={selectFiles}
        />
      </Field>

      {/* ===== Acción principal ===== */}

      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Guardando archivos…" : "Guardar archivos"}
      </Button>
    </form>
  );
}
