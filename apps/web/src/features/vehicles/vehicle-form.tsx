"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import { createVehicleAction, updateVehicleAction } from "./actions";

const vehicleTypes = [
  ["car", "Automóvil"],
  ["truck", "Camioneta"],
  ["motorcycle", "Motocicleta"],
  ["trailer", "Remolque"],
  ["recreational", "Vehículo recreativo"],
  ["other", "Otro"],
] as const;

const fuelTypes = [
  ["", "No indicado"],
  ["gasoline", "Gasolina"],
  ["diesel", "Diésel"],
  ["hybrid", "Híbrido"],
  ["electric", "Eléctrico"],
  ["other", "Otro"],
] as const;

type VehicleFormValue = {
  id: string;
  name: string;
  type: string;
  make: string | null;
  model: string | null;
  model_year: number | null;
  trim: string | null;
  color: string | null;
  vin: string | null;
  license_plate: string | null;
  mileage: number | null;
  fuel_type: string | null;
  notes: string | null;
  version: number;
};

// ============================================================================
// Formulario de vehículos
// ============================================================================

export function VehicleForm({ vehicle }: { vehicle?: VehicleFormValue }) {
  // ===== Estado del formulario =====

  const action = vehicle ? updateVehicleAction : createVehicleAction;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  let submitLabel = vehicle ? "Guardar cambios" : "Guardar vehículo";

  if (pending) {
    submitLabel = "Guardando…";
  }

  // ===== Renderizado del formulario =====

  return (
    <form action={formAction} className="grid gap-6">
      {vehicle ? (
        <>
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <input type="hidden" name="version" value={vehicle.version} />
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

      {/* ===== Identificación principal ===== */}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="name">Nombre o alias</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="Ej. Civic gris"
            defaultValue={vehicle?.name}
            invalid={Boolean(state.errors?.name)}
            autoFocus={!vehicle}
          />
          <FieldMessage error>{state.errors?.name?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="type">Tipo</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="type"
            name="type"
            defaultValue={vehicle?.type ?? "car"}
          >
            {vehicleTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="modelYear">Año</FieldLabel>
          <Input
            id="modelYear"
            name="modelYear"
            type="number"
            inputMode="numeric"
            min="1886"
            max={new Date().getFullYear() + 1}
            defaultValue={vehicle?.model_year ?? ""}
            invalid={Boolean(state.errors?.modelYear)}
          />
          <FieldMessage error>{state.errors?.modelYear?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="make">Marca</FieldLabel>
          <Input id="make" name="make" defaultValue={vehicle?.make ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="model">Modelo</FieldLabel>
          <Input id="model" name="model" defaultValue={vehicle?.model ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="trim">Versión</FieldLabel>
          <Input id="trim" name="trim" defaultValue={vehicle?.trim ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="color">Color</FieldLabel>
          <Input id="color" name="color" defaultValue={vehicle?.color ?? ""} />
        </Field>
      </div>

      {/* ===== Información administrativa ===== */}

      <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="vin">Número de serie o VIN</FieldLabel>
          <Input
            id="vin"
            name="vin"
            autoCapitalize="characters"
            defaultValue={vehicle?.vin ?? ""}
            invalid={Boolean(state.errors?.vin)}
          />
          <FieldMessage error>{state.errors?.vin?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="licensePlate">Placas actuales</FieldLabel>
          <Input
            id="licensePlate"
            name="licensePlate"
            autoCapitalize="characters"
            defaultValue={vehicle?.license_plate ?? ""}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="mileage">Kilometraje actual</FieldLabel>
          <Input
            id="mileage"
            name="mileage"
            type="number"
            inputMode="numeric"
            min="0"
            defaultValue={vehicle?.mileage ?? ""}
            invalid={Boolean(state.errors?.mileage)}
          />
          <FieldMessage error>{state.errors?.mileage?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="fuelType">Combustible</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="fuelType"
            name="fuelType"
            defaultValue={vehicle?.fuel_type ?? ""}
          >
            {fuelTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="notes">Notas</FieldLabel>
          <textarea
            className="min-h-28 rounded-[var(--radius-md)] border bg-white px-3.5 py-3"
            id="notes"
            name="notes"
            defaultValue={vehicle?.notes ?? ""}
          />
        </Field>
      </div>

      {/* ===== Acción principal ===== */}

      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
