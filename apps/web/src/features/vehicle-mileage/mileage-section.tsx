"use client";

import {
  Button,
  Card,
  CardContent,
  Field,
  FieldLabel,
  FieldMessage,
  Input,
} from "@gid/ui";
import { BellRing, Gauge, History } from "lucide-react";
import { useActionState } from "react";

import { formatDate } from "@/features/documents/expiration";
import { initialFormState } from "@/features/shared/form-state";

import {
  configureMileageReminderAction,
  recordVehicleMileageAction,
} from "./actions";

type MileageReading = {
  id: string;
  mileage: number;
  recorded_on: string;
  source: string;
  notes: string | null;
};

const sourceLabels: Record<string, string> = {
  initial: "Lectura inicial",
  manual: "Registro manual",
  automatic: "Actualización automática",
};

const numberFormatter = new Intl.NumberFormat("es-MX");

// ============================================================================
// Seguimiento visual del kilometraje
// ============================================================================

export function VehicleMileageSection({
  vehicleId,
  currentMileage,
  currentDate,
  readings,
  reminderIntervalDays,
  active,
}: {
  vehicleId: string;
  currentMileage: number | null;
  currentDate: string;
  readings: MileageReading[];
  reminderIntervalDays: number | null;
  active: boolean;
}) {
  // ===== Estado de los formularios =====

  const [readingState, readingAction, readingPending] = useActionState(
    recordVehicleMileageAction,
    initialFormState,
  );
  const [reminderState, reminderAction, reminderPending] = useActionState(
    configureMileageReminderAction,
    initialFormState,
  );
  const currentMileageLabel =
    currentMileage === null
      ? "No indicado"
      : `${numberFormatter.format(currentMileage)} km`;

  // ===== Renderizado principal =====

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
          <Gauge aria-hidden size={20} />
        </span>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Kilometraje actual
          </p>
          <p className="font-semibold">{currentMileageLabel}</p>
        </div>
      </div>

      {/* ===== Registro rápido y aviso periódico ===== */}

      {active ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold">Registrar lectura</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Mantiene actualizados los próximos servicios.
              </p>
              <form action={readingAction} className="mt-5 grid gap-4">
                <input type="hidden" name="vehicleId" value={vehicleId} />
                {readingState.message ? (
                  <p
                    className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
                    role="alert"
                  >
                    {readingState.message}
                  </p>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="mileage-reading">
                      Kilometraje
                    </FieldLabel>
                    <Input
                      id="mileage-reading"
                      name="mileage"
                      type="number"
                      inputMode="numeric"
                      min={currentMileage ?? 0}
                      defaultValue={currentMileage ?? ""}
                      invalid={Boolean(readingState.errors?.mileage)}
                    />
                    <FieldMessage error>
                      {readingState.errors?.mileage?.[0]}
                    </FieldMessage>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="mileage-date">Fecha</FieldLabel>
                    <Input
                      id="mileage-date"
                      name="recordedOn"
                      type="date"
                      max={currentDate}
                      defaultValue={currentDate}
                      invalid={Boolean(readingState.errors?.recordedOn)}
                    />
                    <FieldMessage error>
                      {readingState.errors?.recordedOn?.[0]}
                    </FieldMessage>
                  </Field>
                </div>
                <details className="rounded-xl border bg-white p-3.5">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Agregar nota
                  </summary>
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-[var(--radius-md)] border bg-white p-3"
                    name="notes"
                    placeholder="Ej. Lectura antes de salir a carretera"
                  />
                </details>
                <Button disabled={readingPending} fullWidth type="submit">
                  {readingPending ? "Guardando…" : "Guardar lectura"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-[var(--color-surface-alt)] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <BellRing
                  aria-hidden
                  className="text-[var(--color-brand-800)]"
                  size={19}
                />
                <h2 className="font-semibold">Recordarme actualizar</h2>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Recibirás un aviso periódico en este dispositivo.
              </p>
              <form action={reminderAction} className="mt-5 grid gap-3">
                <input type="hidden" name="vehicleId" value={vehicleId} />
                {reminderState.message ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {reminderState.message}
                  </p>
                ) : null}
                <select
                  className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
                  name="intervalDays"
                  defaultValue={String(reminderIntervalDays ?? "off")}
                >
                  <option value="off">Sin recordatorio</option>
                  <option value="30">Cada 30 días</option>
                  <option value="60">Cada 60 días</option>
                  <option value="90">Cada 90 días</option>
                </select>
                <Button
                  disabled={reminderPending}
                  fullWidth
                  variant="secondary"
                  type="submit"
                >
                  {reminderPending ? "Actualizando…" : "Guardar frecuencia"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ===== Historial inmutable ===== */}

      <div className="mt-7 flex items-center gap-2">
        <History
          aria-hidden
          className="text-[var(--color-text-secondary)]"
          size={18}
        />
        <h2 className="text-lg font-semibold">Historial de kilometraje</h2>
      </div>
      <div className="mt-3 grid gap-2">
        {readings.map((reading, index) => {
          const previousReading = readings[index + 1];
          const difference = previousReading
            ? reading.mileage - previousReading.mileage
            : null;

          return (
            <div
              className="rounded-2xl border bg-white px-4 py-3.5"
              key={reading.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {numberFormatter.format(reading.mileage)} km
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                    {formatDate(reading.recorded_on)} ·{" "}
                    {sourceLabels[reading.source] ?? reading.source}
                  </p>
                </div>
                {difference !== null && difference > 0 ? (
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    +{numberFormatter.format(difference)} km
                  </span>
                ) : null}
              </div>
              {reading.notes ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                  {reading.notes}
                </p>
              ) : null}
            </div>
          );
        })}
        {!readings.length ? (
          <p className="rounded-2xl bg-[var(--color-surface-alt)] p-5 text-sm text-[var(--color-text-secondary)]">
            Registra la primera lectura para comenzar el historial.
          </p>
        ) : null}
      </div>
    </section>
  );
}
