"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import { createPropertyAction, updatePropertyAction } from "./actions";

const propertyTypes = [
  ["house", "Casa"],
  ["apartment", "Departamento"],
  ["land", "Terreno"],
  ["commercial", "Local comercial"],
  ["other", "Otro"],
] as const;

export function PropertyForm() {
  const [state, action, pending] = useActionState(
    createPropertyAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-5">
      {state.message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <Field>
        <FieldLabel htmlFor="name">Nombre o alias</FieldLabel>
        <Input
          id="name"
          name="name"
          placeholder="Ej. Casa principal"
          invalid={Boolean(state.errors?.name)}
          autoFocus
        />
        <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
      </Field>
      <Field>
        <FieldLabel htmlFor="type">Tipo</FieldLabel>
        <select
          className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5 outline-none focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-focus)_20%,transparent)]"
          id="type"
          name="type"
          defaultValue="house"
        >
          {propertyTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldMessage error>{state.errors?.type?.[0]}</FieldMessage>
      </Field>
      <Field>
        <FieldLabel htmlFor="address">
          Dirección{" "}
          <span className="font-normal text-[var(--color-text-secondary)]">
            (opcional)
          </span>
        </FieldLabel>
        <Input
          id="address"
          name="address"
          autoComplete="street-address"
          invalid={Boolean(state.errors?.address)}
        />
        <FieldMessage error>{state.errors?.address?.[0]}</FieldMessage>
      </Field>
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Guardando…" : "Guardar vivienda"}
      </Button>
    </form>
  );
}

export function EditPropertyForm({
  property,
}: {
  property: {
    id: string;
    name: string;
    type: string;
    address: string | null;
    version: number;
  };
}) {
  const [state, action, pending] = useActionState(
    updatePropertyAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="propertyId" value={property.id} />
      <input type="hidden" name="version" value={property.version} />
      {state.message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <Field>
        <FieldLabel htmlFor="name">Nombre o alias</FieldLabel>
        <Input
          id="name"
          name="name"
          defaultValue={property.name}
          invalid={Boolean(state.errors?.name)}
        />
        <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
      </Field>
      <Field>
        <FieldLabel htmlFor="type">Tipo</FieldLabel>
        <select
          className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
          id="type"
          name="type"
          defaultValue={property.type}
        >
          {propertyTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor="address">
          Dirección{" "}
          <span className="font-normal text-[var(--color-text-secondary)]">
            (opcional)
          </span>
        </FieldLabel>
        <Input
          id="address"
          name="address"
          defaultValue={property.address ?? ""}
          invalid={Boolean(state.errors?.address)}
        />
        <FieldMessage error>{state.errors?.address?.[0]}</FieldMessage>
      </Field>
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
