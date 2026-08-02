"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import { updateDocumentAction } from "./actions";

const categories = [
  ["deed", "Escritura"],
  ["contract", "Contrato"],
  ["insurance_policy", "Póliza de seguro"],
  ["property_tax_receipt", "Recibo de predial"],
  ["appraisal", "Avalúo"],
  ["plan", "Plano"],
  ["warranty", "Garantía"],
  ["invoice", "Factura"],
  ["permit", "Permiso"],
  ["registration_card", "Tarjeta de circulación"],
  ["inspection", "Verificación"],
  ["financing", "Financiamiento"],
  ["manual", "Manual"],
  ["other", "Otro"],
] as const;

export function EditDocumentForm({
  document,
}: {
  document: {
    id: string;
    name: string;
    category: string;
    issue_date: string | null;
    expiration_date: string | null;
    issuer: string | null;
    document_number: string | null;
    notes: string | null;
    version: number;
  };
}) {
  const [state, action, pending] = useActionState(
    updateDocumentAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="documentId" value={document.id} />
      <input type="hidden" name="version" value={document.version} />
      {state.message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <Field>
        <FieldLabel htmlFor="name">Nombre</FieldLabel>
        <Input
          id="name"
          name="name"
          defaultValue={document.name}
          invalid={Boolean(state.errors?.name)}
        />
        <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
      </Field>
      <Field>
        <FieldLabel htmlFor="category">Categoría</FieldLabel>
        <select
          className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
          id="category"
          name="category"
          defaultValue={document.category}
        >
          {categories.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="issueDate">Emisión</FieldLabel>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            defaultValue={document.issue_date ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="expirationDate">Vencimiento</FieldLabel>
          <Input
            id="expirationDate"
            name="expirationDate"
            type="date"
            defaultValue={document.expiration_date ?? ""}
            invalid={Boolean(state.errors?.expirationDate)}
          />
          <FieldMessage error>{state.errors?.expirationDate?.[0]}</FieldMessage>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="issuer">Institución</FieldLabel>
        <Input id="issuer" name="issuer" defaultValue={document.issuer ?? ""} />
      </Field>
      <Field>
        <FieldLabel htmlFor="documentNumber">Número</FieldLabel>
        <Input
          id="documentNumber"
          name="documentNumber"
          defaultValue={document.document_number ?? ""}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="notes">Notas</FieldLabel>
        <textarea
          className="min-h-28 rounded-[var(--radius-md)] border bg-white p-3.5"
          id="notes"
          name="notes"
          defaultValue={document.notes ?? ""}
        />
      </Field>
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
