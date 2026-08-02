"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import {
  createVehicleServiceAction,
  updateVehicleServiceAction,
} from "./actions";

const serviceTypes = [
  ["preventive", "Mantenimiento preventivo"],
  ["corrective", "Mantenimiento correctivo"],
  ["repair", "Reparación"],
  ["diagnostic", "Diagnóstico"],
  ["inspection", "Inspección"],
  ["general", "Servicio general"],
  ["other", "Otro"],
] as const;

const serviceStatuses = [
  ["planned", "Programado"],
  ["in_progress", "En proceso"],
  ["completed", "Completado"],
  ["cancelled", "Cancelado"],
] as const;

type ServiceValue = {
  id: string;
  vehicle_id: string;
  title: string;
  type: string;
  status: string;
  service_date: string | null;
  mileage: number | null;
  provider: string | null;
  cost: number | null;
  notes: string | null;
  next_due_date: string | null;
  next_due_mileage: number | null;
  version: number;
  reminder?: {
    lead_days: number;
    repeat_interval_days: number | null;
  } | null;
};

// ============================================================================
// Formulario de mantenimiento vehicular
// ============================================================================

export function ServiceForm({
  vehicleId,
  service,
}: {
  vehicleId: string;
  service?: ServiceValue;
}) {
  // ===== Estado y acción del formulario =====

  const action = service
    ? updateVehicleServiceAction
    : createVehicleServiceAction;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  let submitLabel = service ? "Guardar cambios" : "Guardar servicio";

  if (pending) {
    submitLabel = "Guardando…";
  }

  // ===== Renderizado principal =====

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {service ? (
        <>
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="version" value={service.version} />
        </>
      ) : null}

      {state.message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      {/* ===== Información principal ===== */}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="title">Título</FieldLabel>
          <Input
            id="title"
            name="title"
            placeholder="Ej. Cambio de aceite"
            defaultValue={service?.title}
            invalid={Boolean(state.errors?.title)}
          />
          <FieldMessage error>{state.errors?.title?.[0]}</FieldMessage>
        </Field>
        <Field>
          <FieldLabel htmlFor="type">Tipo</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="type"
            name="type"
            defaultValue={service?.type ?? "preventive"}
          >
            {serviceTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="status">Estado</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="status"
            name="status"
            defaultValue={service?.status ?? "completed"}
          >
            {serviceStatuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="serviceDate">Fecha</FieldLabel>
          <Input
            id="serviceDate"
            name="serviceDate"
            type="date"
            defaultValue={service?.service_date ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="mileage">Kilometraje</FieldLabel>
          <Input
            id="mileage"
            name="mileage"
            type="number"
            inputMode="numeric"
            min="0"
            defaultValue={service?.mileage ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="provider">Taller o proveedor</FieldLabel>
          <Input
            id="provider"
            name="provider"
            defaultValue={service?.provider ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cost">Costo</FieldLabel>
          <Input
            id="cost"
            name="cost"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={service?.cost ?? ""}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="notes">Notas y trabajos realizados</FieldLabel>
          <textarea
            className="min-h-32 rounded-[var(--radius-md)] border bg-white p-3.5"
            id="notes"
            name="notes"
            defaultValue={service?.notes ?? ""}
          />
        </Field>
      </div>

      {/* ===== Próxima atención ===== */}

      <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="nextDueDate">Próxima fecha</FieldLabel>
          <Input
            id="nextDueDate"
            name="nextDueDate"
            type="date"
            defaultValue={service?.next_due_date ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="nextDueMileage">Próximo kilometraje</FieldLabel>
          <Input
            id="nextDueMileage"
            name="nextDueMileage"
            type="number"
            inputMode="numeric"
            min="0"
            defaultValue={service?.next_due_mileage ?? ""}
            invalid={Boolean(state.errors?.nextDueMileage)}
          />
          <FieldMessage error>{state.errors?.nextDueMileage?.[0]}</FieldMessage>
        </Field>
        <Field>
          <FieldLabel htmlFor="leadDays">Avisarme antes</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="leadDays"
            name="leadDays"
            defaultValue={String(service?.reminder?.lead_days ?? 7)}
          >
            <option value="30">30 días antes</option>
            <option value="15">15 días antes</option>
            <option value="7">7 días antes</option>
            <option value="3">3 días antes</option>
            <option value="1">1 día antes</option>
            <option value="0">El mismo día</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="repeatIntervalDays">Repetición</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="repeatIntervalDays"
            name="repeatIntervalDays"
            defaultValue={String(service?.reminder?.repeat_interval_days ?? "")}
          >
            <option value="">No repetir</option>
            <option value="1">Cada día hasta atenderlo</option>
            <option value="7">Cada semana hasta atenderlo</option>
          </select>
        </Field>
      </div>

      {/* ===== Acción principal ===== */}

      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
