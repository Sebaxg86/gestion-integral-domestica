"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { documentSchema } from "@gid/validation";
import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

import {
  getDocumentNameFromFilename,
  getFileError,
  getFunctionErrorMessage,
} from "./file-upload";

const propertyCategories = [
  ["deed", "Escritura"],
  ["contract", "Contrato"],
  ["insurance_policy", "Póliza de seguro"],
  ["property_tax_receipt", "Recibo de predial"],
  ["appraisal", "Avalúo"],
  ["plan", "Plano"],
  ["warranty", "Garantía"],
  ["invoice", "Factura"],
  ["permit", "Permiso"],
  ["other", "Otro"],
] as const;

const vehicleCategories = [
  ["registration_card", "Tarjeta de circulación"],
  ["invoice", "Factura"],
  ["insurance_policy", "Póliza de seguro"],
  ["inspection", "Verificación"],
  ["warranty", "Garantía"],
  ["financing", "Financiamiento"],
  ["manual", "Manual"],
  ["other", "Otro"],
] as const;

export function DocumentForm({
  familyId,
  propertyId,
  vehicleId,
  parentName,
}: {
  familyId: string;
  propertyId?: string;
  vehicleId?: string;
  parentName: string;
}) {
  // ===== Configuración del recurso propietario =====

  const isVehicleDocument = Boolean(vehicleId);
  const categories = isVehicleDocument ? vehicleCategories : propertyCategories;
  const parentLabel = isVehicleDocument ? "Vehículo" : "Vivienda";

  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function continueToDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = documentSchema.safeParse({
      name: formData.get("name"),
      category: formData.get("category"),
    });
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors as Record<string, string[]>);
      setMessage("Revisa los datos marcados para continuar.");
      return;
    }
    const fileError = getFileError(file);
    if (fileError) {
      setMessage(fileError);
      return;
    }
    setErrors({});
    setMessage(undefined);
    setStep(2);
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFile = file;
    const fileError = getFileError(selectedFile);
    if (fileError) {
      setMessage(fileError);
      return;
    }
    if (!selectedFile) return;
    setPending(true);
    setMessage(undefined);
    setUploadStatus("Preparando la carga segura…");

    try {
      const formData = new FormData(event.currentTarget);
      const result = documentSchema.safeParse({
        name: formData.get("name"),
        category: formData.get("category"),
        issueDate: String(formData.get("issueDate") ?? "") || undefined,
        expirationDate: String(formData.get("expirationDate") ?? "") || undefined,
        issuer: String(formData.get("issuer") ?? "") || undefined,
        documentNumber: String(formData.get("documentNumber") ?? "") || undefined,
        notes: String(formData.get("notes") ?? "") || undefined,
        leadDays: formData.get("leadDays")
          ? formData.get("leadDays")
          : undefined,
        repeatIntervalDays: formData.get("repeatIntervalDays")
          ? formData.get("repeatIntervalDays")
          : undefined,
      });

      if (!result.success) {
        setErrors(result.error.flatten().fieldErrors as Record<string, string[]>);
        setMessage("Revisa los datos marcados antes de guardar.");
        return;
      }

      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setMessage("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setMessage("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }

      const uploadId = crypto.randomUUID();
      const documentId = crypto.randomUUID();
      const fileId = crypto.randomUUID();
      const stagedPath = `staging/${userData.user.id}/${uploadId}`;
      setUploadStatus("Subiendo el archivo…");
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(stagedPath, selectedFile, {
          cacheControl: "no-cache",
          contentType: selectedFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        setMessage("No pudimos cargar el archivo. Revisa tu conexión e intenta de nuevo.");
        return;
      }

      setUploadStatus("Validando y guardando el documento…");
      const { error: finalizeError } = await supabase.functions.invoke(
        "finalize-document",
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: {
            uploadId,
            documentId,
            fileId,
            familyId,
            propertyId: propertyId ?? null,
            vehicleId: vehicleId ?? null,
            name: result.data.name,
            category: result.data.category,
            issueDate: result.data.issueDate || null,
            expirationDate: result.data.expirationDate || null,
            issuer: result.data.issuer || null,
            documentNumber: result.data.documentNumber || null,
            notes: result.data.notes || null,
            originalFilename: selectedFile.name,
          },
        },
      );

      if (finalizeError) {
        setMessage(
          await getFunctionErrorMessage(
            finalizeError,
            "No pudimos validar y guardar el documento. Intenta de nuevo.",
          ),
        );
        return;
      }

      if (result.data.expirationDate && result.data.leadDays !== undefined) {
        const { error: reminderError } = await supabase.rpc("create_reminder", {
          reminder_id: crypto.randomUUID(),
          target_document_id: documentId,
          reminder_lead_days: result.data.leadDays,
          reminder_repeat_interval_days:
            result.data.repeatIntervalDays ?? null,
        });
        if (reminderError) {
          setMessage(
            "El documento se guardó, pero el aviso no pudo crearse. Puedes configurarlo desde su detalle.",
          );
        }
      }

      router.push(`/app/documentos/${documentId}`);
      router.refresh();
    } catch {
      setMessage(
        "Ocurrió un problema al guardar el documento. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setPending(false);
      setUploadStatus(undefined);
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setMessage(getFileError(selectedFile));
    setErrors({});

    if (selectedFile && !name.trim()) {
      setName(getDocumentNameFromFilename(selectedFile.name));
    }
  }

  return (
    <form
      noValidate
      onSubmit={step === 1 ? continueToDates : submitDocument}
      className="grid gap-5"
    >
      <p className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-sm">
        <span className="text-[var(--color-text-secondary)]">{parentLabel}:</span>{" "}
        <strong>{parentName}</strong>
      </p>
      {message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {message}
        </p>
      ) : null}
      {uploadStatus ? (
        <div
          className="rounded-xl bg-[var(--color-brand-100)] p-3 text-sm text-[var(--color-brand-900)]"
          role="status"
          aria-live="polite"
        >
          <p>{uploadStatus}</p>
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-brand-700)_20%,transparent)]"
            role="progressbar"
            aria-label="Carga del documento en curso"
            aria-valuetext={uploadStatus}
          >
            <div className="h-full w-2/5 animate-pulse rounded-full bg-[var(--color-brand-700)]" />
          </div>
        </div>
      ) : null}

      <div
        className={step === 1 ? "grid gap-5" : "hidden"}
        aria-hidden={step !== 1}
      >
        <Field>
          <FieldLabel htmlFor="name">Nombre del documento</FieldLabel>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            invalid={Boolean(errors.name)}
          />
          <FieldMessage error>{errors.name?.[0]}</FieldMessage>
        </Field>
        <Field>
          <FieldLabel htmlFor="category">Categoría</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="category"
            name="category"
            defaultValue="insurance_policy"
          >
            {categories.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="file">Archivo</FieldLabel>
          <label
            className="grid min-h-32 cursor-pointer place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-alt)] p-5 text-center hover:bg-[var(--color-brand-100)]"
            htmlFor="file"
          >
            <span>
              <FileUp
                aria-hidden
                className="mx-auto text-[var(--color-brand-800)]"
                size={24}
              />
              <span className="mt-2 block text-sm font-semibold">
                {file ? file.name : "Seleccionar archivo"}
              </span>
              <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                PDF, JPEG o PNG · máximo 10 MiB
              </span>
            </span>
          </label>
          <input
            className="sr-only"
            id="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={selectFile}
          />
        </Field>
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Más detalles
          </summary>
          <div className="mt-4 grid gap-4">
            <Field>
              <FieldLabel htmlFor="issuer">Institución emisora</FieldLabel>
              <Input id="issuer" name="issuer" />
            </Field>
            <Field>
              <FieldLabel htmlFor="documentNumber">
                Número de documento
              </FieldLabel>
              <Input id="documentNumber" name="documentNumber" />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <textarea
                className="min-h-24 rounded-[var(--radius-md)] border bg-white p-3.5"
                id="notes"
                name="notes"
              />
            </Field>
          </div>
        </details>
        <Button fullWidth size="mobile" type="submit">
          Continuar
        </Button>
      </div>

      <div
        className={step === 2 ? "grid gap-5" : "hidden"}
        aria-hidden={step !== 2}
      >
        <div className="flex items-center gap-3 rounded-xl bg-[var(--color-brand-100)] p-4 text-sm text-[var(--color-brand-900)]">
          <ShieldCheck aria-hidden size={20} />
          <p>El archivo se validará por contenido antes de quedar asociado.</p>
        </div>
        <Field>
          <FieldLabel htmlFor="issueDate">
            Fecha de emisión{" "}
            <span className="font-normal text-[var(--color-text-secondary)]">
              (opcional)
            </span>
          </FieldLabel>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            invalid={Boolean(errors.issueDate)}
          />
          <FieldMessage error>{errors.issueDate?.[0]}</FieldMessage>
        </Field>
        <Field>
          <FieldLabel htmlFor="expirationDate">
            Fecha de vencimiento{" "}
            <span className="font-normal text-[var(--color-text-secondary)]">
              (opcional)
            </span>
          </FieldLabel>
          <Input
            id="expirationDate"
            name="expirationDate"
            type="date"
            invalid={Boolean(errors.expirationDate)}
          />
          <FieldMessage error>{errors.expirationDate?.[0]}</FieldMessage>
        </Field>
        <Field>
          <FieldLabel htmlFor="leadDays">Avisarme antes</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="leadDays"
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
          <FieldMessage>
            Se creará solamente si agregas vencimiento.
          </FieldMessage>
        </Field>
        <Field>
          <FieldLabel htmlFor="repeatIntervalDays">Después del primer aviso</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="repeatIntervalDays"
            name="repeatIntervalDays"
            defaultValue=""
          >
            <option value="">No repetir</option>
            <option value="1">Recordarme cada día</option>
            <option value="7">Recordarme cada semana</option>
          </select>
          <FieldMessage>Se detendrá cuando lo marques como atendido.</FieldMessage>
        </Field>
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button
            variant="secondary"
            size="mobile"
            type="button"
            onClick={() => setStep(1)}
            aria-label="Volver al paso anterior"
          >
            <ArrowLeft aria-hidden size={18} />
          </Button>
          <Button disabled={pending} fullWidth size="mobile" type="submit">
            {pending ? "Validando y guardando…" : "Guardar documento"}
          </Button>
        </div>
      </div>
    </form>
  );
}
