"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState, useState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import { createFamilyAction } from "./actions";

const suggestedTimezones = [
  "America/Monterrey",
  "America/Mexico_City",
  "America/Cancun",
  "America/Tijuana",
  "America/Chihuahua",
  "America/Mazatlan",
];

export function OnboardingForm() {
  const [state, action, pending] = useActionState(
    createFamilyAction,
    initialFormState,
  );
  const [timezone, setTimezone] = useState("America/Monterrey");

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
        <FieldLabel htmlFor="name">Nombre de tu familia</FieldLabel>
        <Input
          id="name"
          name="name"
          placeholder="Ej. Familia Chairez"
          autoComplete="organization"
          invalid={Boolean(state.errors?.name)}
        />
        <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
      </Field>
      <Field>
        <FieldLabel htmlFor="timezone">Zona horaria</FieldLabel>
        <Input
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          list="timezone-options"
          invalid={Boolean(state.errors?.timezone)}
        />
        <datalist id="timezone-options">
          {suggestedTimezones.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <FieldMessage error={Boolean(state.errors?.timezone)}>
          {state.errors?.timezone?.[0] ??
            "La usamos para programar avisos a las 09:00 de tu localidad."}
        </FieldMessage>
      </Field>
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Creando espacio…" : "Crear mi espacio privado"}
      </Button>
    </form>
  );
}
