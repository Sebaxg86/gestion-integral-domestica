"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import { updateFamilyAction, updateProfileAction } from "./actions";

export function ProfileForm({
  fullName,
  version,
}: {
  fullName: string;
  version: number;
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="version" value={version} />
      <Field>
        <FieldLabel htmlFor="fullName">Nombre</FieldLabel>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          invalid={Boolean(state.errors?.fullName)}
        />
        <FieldMessage error>{state.errors?.fullName?.[0]}</FieldMessage>
      </Field>
      <FormMessage message={state.message} />
      <Button disabled={pending} variant="secondary" type="submit">
        {pending ? "Guardando…" : "Guardar perfil"}
      </Button>
    </form>
  );
}

export function FamilyForm({
  family,
}: {
  family: { id: string; name: string; timezone: string; version: number };
}) {
  const [state, action, pending] = useActionState(
    updateFamilyAction,
    initialFormState,
  );
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="familyId" value={family.id} />
      <input type="hidden" name="version" value={family.version} />
      <Field>
        <FieldLabel htmlFor="familyName">Nombre del espacio</FieldLabel>
        <Input
          id="familyName"
          name="name"
          defaultValue={family.name}
          invalid={Boolean(state.errors?.name)}
        />
        <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
      </Field>
      <Field>
        <FieldLabel htmlFor="familyTimezone">Zona horaria</FieldLabel>
        <Input
          id="familyTimezone"
          name="timezone"
          defaultValue={family.timezone}
          invalid={Boolean(state.errors?.timezone)}
        />
        <FieldMessage error={Boolean(state.errors?.timezone)}>
          {state.errors?.timezone?.[0] ??
            "Cambiarla recalcula los recordatorios programados."}
        </FieldMessage>
      </Field>
      <FormMessage message={state.message} />
      <Button disabled={pending} variant="secondary" type="submit">
        {pending ? "Guardando…" : "Guardar familia"}
      </Button>
    </form>
  );
}

function FormMessage({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-[var(--color-text-secondary)]" role="status">
      {message}
    </p>
  ) : null;
}
