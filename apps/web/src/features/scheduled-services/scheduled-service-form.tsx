"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState, useState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import {
  createScheduledServiceAction,
  updateScheduledServiceAction,
} from "./actions";
import {
  scheduledServiceCategories,
  scheduledServiceRecurrences,
} from "./config";

type PropertyOption = {
  id: string;
  name: string;
};

type ScheduledServiceValue = {
  id: string;
  property_id: string | null;
  name: string;
  category: string;
  provider: string | null;
  recurrence: string;
  custom_interval_days: number | null;
  lead_days: number;
  repeat_interval_days: number | null;
  notes: string | null;
  version: number;
  due_date: string;
};

// ============================================================================
// Formulario de servicios programados
// ============================================================================

export function ScheduledServiceForm({
  properties,
  defaultDueDate,
  service,
}: {
  properties: PropertyOption[];
  defaultDueDate: string;
  service?: ScheduledServiceValue;
}) {
  // ===== Estado del formulario =====

  const action = service
    ? updateScheduledServiceAction
    : createScheduledServiceAction;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [recurrence, setRecurrence] = useState(
    service?.recurrence ?? "monthly",
  );

  // ===== Renderizado de la captura =====

  return (
    <form action={formAction} className="grid gap-6">
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

      {/* ===== Identificación ===== */}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="Ej. Recibo de electricidad"
            defaultValue={service?.name}
            invalid={Boolean(state.errors?.name)}
            autoFocus={!service}
          />
          <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="category">Categoría</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="category"
            name="category"
            defaultValue={service?.category ?? "electricity"}
          >
            {scheduledServiceCategories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="propertyId">Vivienda</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="propertyId"
            name="propertyId"
            defaultValue={service?.property_id ?? ""}
          >
            <option value="">Sin vivienda específica</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="provider">Proveedor (opcional)</FieldLabel>
          <Input
            id="provider"
            name="provider"
            placeholder="Ej. CFE"
            defaultValue={service?.provider ?? ""}
          />
        </Field>
      </div>

      {/* ===== Fecha y recurrencia ===== */}

      <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="dueDate">Próxima fecha</FieldLabel>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={service?.due_date ?? defaultDueDate}
            invalid={Boolean(state.errors?.dueDate)}
          />
          <FieldMessage error>{state.errors?.dueDate?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="recurrence">Se repite</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="recurrence"
            name="recurrence"
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value)}
          >
            {scheduledServiceRecurrences.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {recurrence === "custom_days" ? (
          <Field>
            <FieldLabel htmlFor="customIntervalDays">
              Cada cuántos días
            </FieldLabel>
            <Input
              id="customIntervalDays"
              name="customIntervalDays"
              type="number"
              inputMode="numeric"
              min="1"
              max="3650"
              defaultValue={service?.custom_interval_days ?? 30}
              invalid={Boolean(state.errors?.customIntervalDays)}
            />
            <FieldMessage error>
              {state.errors?.customIntervalDays?.[0]}
            </FieldMessage>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="leadDays">Avisarme antes</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="leadDays"
            name="leadDays"
            defaultValue={String(service?.lead_days ?? 7)}
          >
            <option value="0">El mismo día</option>
            <option value="1">1 día antes</option>
            <option value="3">3 días antes</option>
            <option value="7">7 días antes</option>
            <option value="15">15 días antes</option>
            <option value="30">30 días antes</option>
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="repeatIntervalDays">
            Si sigue pendiente
          </FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="repeatIntervalDays"
            name="repeatIntervalDays"
            defaultValue={String(service?.repeat_interval_days ?? "off")}
          >
            <option value="off">No repetir el aviso</option>
            <option value="1">Recordar cada día</option>
            <option value="7">Recordar cada semana</option>
          </select>
        </Field>
      </div>

      {/* ===== Notas y acción principal ===== */}

      <Field className="border-t pt-6">
        <FieldLabel htmlFor="notes">Notas</FieldLabel>
        <textarea
          className="min-h-28 rounded-[var(--radius-md)] border bg-white px-3.5 py-3"
          id="notes"
          name="notes"
          defaultValue={service?.notes ?? ""}
        />
      </Field>

      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending
          ? "Guardando…"
          : service
            ? "Guardar cambios"
            : "Programar servicio"}
      </Button>
    </form>
  );
}
