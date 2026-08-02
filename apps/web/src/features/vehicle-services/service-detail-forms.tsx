"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import {
  createServiceItemAction,
  createServicePartAction,
} from "./actions";

const itemCategories = [
  ["oil", "Aceite y lubricación"],
  ["brakes", "Frenos"],
  ["suspension", "Suspensión"],
  ["battery", "Batería"],
  ["tires", "Llantas"],
  ["fluids", "Fluidos"],
  ["filters", "Filtros"],
  ["engine", "Motor"],
  ["transmission", "Transmisión"],
  ["electrical", "Sistema eléctrico"],
  ["body", "Carrocería"],
  ["inspection", "Inspección"],
  ["other", "Otro"],
] as const;

const itemStatuses = [
  ["completed", "Realizado"],
  ["reviewed", "Revisado"],
  ["pending", "Pendiente"],
] as const;

type ServiceIdentity = {
  vehicleId: string;
  serviceId: string;
};

type ItemOption = {
  id: string;
  description: string;
};

// ============================================================================
// Formularios del detalle de mantenimiento
// ============================================================================

function HiddenServiceIdentity({ vehicleId, serviceId }: ServiceIdentity) {
  // ===== Conservación del recurso propietario =====

  return (
    <>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="serviceId" value={serviceId} />
    </>
  );
}

export function ServiceItemForm({ vehicleId, serviceId }: ServiceIdentity) {
  // ===== Estado de envío =====

  const [state, action, pending] = useActionState(
    createServiceItemAction,
    initialFormState,
  );

  // ===== Renderizado del formulario =====

  return (
    <form action={action} className="grid gap-4">
      <HiddenServiceIdentity vehicleId={vehicleId} serviceId={serviceId} />

      {state.message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      {/* ===== Clasificación y resultado ===== */}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="item-category">Categoría</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="item-category"
            name="category"
            defaultValue="other"
          >
            {itemCategories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="item-status">Resultado</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="item-status"
            name="status"
            defaultValue="completed"
          >
            {itemStatuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* ===== Descripción y garantía ===== */}

      <Field>
        <FieldLabel htmlFor="item-description">Trabajo o revisión</FieldLabel>
        <Input
          id="item-description"
          name="description"
          placeholder="Ej. Cambio de balatas delanteras"
          invalid={Boolean(state.errors?.description)}
        />
        <FieldMessage error>{state.errors?.description?.[0]}</FieldMessage>
      </Field>
      <Field>
        <FieldLabel htmlFor="item-warranty">Garantía hasta</FieldLabel>
        <Input id="item-warranty" name="warrantyUntil" type="date" />
      </Field>
      <Field>
        <FieldLabel htmlFor="item-notes">Notas</FieldLabel>
        <textarea
          className="min-h-24 rounded-[var(--radius-md)] border bg-white p-3.5"
          id="item-notes"
          name="notes"
          placeholder="Detalles del diagnóstico o trabajo realizado"
        />
      </Field>

      {/* ===== Acción principal ===== */}

      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Agregando…" : "Agregar trabajo"}
      </Button>
    </form>
  );
}

export function ServicePartForm({
  vehicleId,
  serviceId,
  items,
}: ServiceIdentity & { items: ItemOption[] }) {
  // ===== Estado de envío =====

  const [state, action, pending] = useActionState(
    createServicePartAction,
    initialFormState,
  );

  // ===== Renderizado del formulario =====

  return (
    <form action={action} className="grid gap-4">
      <HiddenServiceIdentity vehicleId={vehicleId} serviceId={serviceId} />

      {state.message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      {/* ===== Identificación de la refacción ===== */}

      <Field>
        <FieldLabel htmlFor="part-name">Refacción</FieldLabel>
        <Input
          id="part-name"
          name="name"
          placeholder="Ej. Filtro de aceite"
          invalid={Boolean(state.errors?.name)}
        />
        <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="part-brand">Marca</FieldLabel>
          <Input id="part-brand" name="brand" />
        </Field>
        <Field>
          <FieldLabel htmlFor="part-number">Número de parte</FieldLabel>
          <Input id="part-number" name="partNumber" />
        </Field>
      </div>

      {/* ===== Cantidad, costo y relación ===== */}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="part-quantity">Cantidad</FieldLabel>
          <Input
            id="part-quantity"
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            defaultValue="1"
            invalid={Boolean(state.errors?.quantity)}
          />
          <FieldMessage error>{state.errors?.quantity?.[0]}</FieldMessage>
        </Field>
        <Field>
          <FieldLabel htmlFor="part-unit-cost">Costo unitario</FieldLabel>
          <Input
            id="part-unit-cost"
            name="unitCost"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
          />
        </Field>
      </div>
      {items.length ? (
        <Field>
          <FieldLabel htmlFor="part-item">Trabajo relacionado</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="part-item"
            name="serviceItemId"
            defaultValue=""
          >
            <option value="">Sin relación específica</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.description}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor="part-warranty">Garantía hasta</FieldLabel>
        <Input id="part-warranty" name="warrantyUntil" type="date" />
      </Field>
      <Field>
        <FieldLabel htmlFor="part-notes">Notas</FieldLabel>
        <textarea
          className="min-h-20 rounded-[var(--radius-md)] border bg-white p-3.5"
          id="part-notes"
          name="notes"
        />
      </Field>

      {/* ===== Acción principal ===== */}

      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Agregando…" : "Agregar refacción"}
      </Button>
    </form>
  );
}
