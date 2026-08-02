"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { useActionState, useState } from "react";

import { initialFormState } from "@/features/shared/form-state";

import { createTaskAction, updateTaskAction } from "./actions";
import { taskCategories, taskPriorities } from "./config";

type TaskTargetOption = {
  id: string;
  name: string;
};

export type TaskFormOptions = {
  properties: TaskTargetOption[];
  vehicles: TaskTargetOption[];
  services: TaskTargetOption[];
};

type TaskValue = {
  id: string;
  property_id: string | null;
  vehicle_id: string | null;
  scheduled_service_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  due_date: string | null;
  reminder_lead_days: number | null;
  reminder_repeat_interval_days: number | null;
  version: number;
};

// ============================================================================
// Formulario de pendientes
// ============================================================================

function getInitialTarget(task?: TaskValue) {
  // ===== Reconstrucción de la relación guardada =====

  if (task?.property_id) {
    return { type: "property", id: task.property_id };
  }

  if (task?.vehicle_id) {
    return { type: "vehicle", id: task.vehicle_id };
  }

  if (task?.scheduled_service_id) {
    return { type: "service", id: task.scheduled_service_id };
  }

  return { type: "family", id: "" };
}

function getTargetOptions(
  targetType: string,
  options: TaskFormOptions,
): TaskTargetOption[] {
  // ===== Selección de opciones según el tipo relacionado =====

  if (targetType === "property") {
    return options.properties;
  }

  if (targetType === "vehicle") {
    return options.vehicles;
  }

  return options.services;
}

function getSubmitLabel(hasTask: boolean, pending: boolean) {
  // ===== Comunicación del estado de guardado =====

  if (pending) {
    return "Guardando…";
  }

  return hasTask ? "Guardar cambios" : "Guardar pendiente";
}

export function TaskForm({
  options,
  task,
}: {
  options: TaskFormOptions;
  task?: TaskValue;
}) {
  // ===== Estado del formulario =====

  const action = task ? updateTaskAction : createTaskAction;
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const initialTarget = getInitialTarget(task);
  const [targetType, setTargetType] = useState(initialTarget.type);
  const [targetId, setTargetId] = useState(initialTarget.id);
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [reminderLeadDays, setReminderLeadDays] = useState(
    task?.reminder_lead_days === null || task?.reminder_lead_days === undefined
      ? "off"
      : String(task.reminder_lead_days),
  );

  const targetOptions = getTargetOptions(targetType, options);
  const submitLabel = getSubmitLabel(Boolean(task), pending);

  // ===== Renderizado principal =====

  return (
    <form action={formAction} className="grid gap-6">
      {task ? (
        <>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="version" value={task.version} />
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
            placeholder="Ej. Solicitar cotización del boiler"
            defaultValue={task?.title}
            invalid={Boolean(state.errors?.title)}
            autoFocus={!task}
          />
          <FieldMessage error>{state.errors?.title?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="category">Categoría</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="category"
            name="category"
            defaultValue={task?.category ?? "household"}
          >
            {taskCategories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="priority">Prioridad</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="priority"
            name="priority"
            defaultValue={task?.priority ?? "normal"}
          >
            {taskPriorities.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="description">Descripción</FieldLabel>
          <textarea
            className="min-h-28 rounded-[var(--radius-md)] border bg-white px-3.5 py-3"
            id="description"
            name="description"
            defaultValue={task?.description ?? ""}
          />
        </Field>
      </div>

      {/* ===== Elemento relacionado ===== */}

      <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="targetType">Relacionado con</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
            id="targetType"
            name="targetType"
            value={targetType}
            onChange={(event) => {
              setTargetType(event.target.value);
              setTargetId("");
            }}
          >
            <option value="family">Familia en general</option>
            <option value="property">Vivienda</option>
            <option value="vehicle">Vehículo</option>
            <option value="service">Servicio programado</option>
          </select>
        </Field>

        {targetType !== "family" ? (
          <Field>
            <FieldLabel htmlFor="targetId">Elemento</FieldLabel>
            <select
              className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5"
              id="targetId"
              name="targetId"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Selecciona una opción</option>
              {targetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <FieldMessage error>{state.errors?.targetId?.[0]}</FieldMessage>
          </Field>
        ) : null}
      </div>

      {/* ===== Fecha y recordatorio ===== */}

      <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="dueDate">Fecha límite (opcional)</FieldLabel>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);

              if (!event.target.value) {
                setReminderLeadDays("off");
              }
            }}
          />
          <FieldMessage error>{state.errors?.dueDate?.[0]}</FieldMessage>
        </Field>

        <Field>
          <FieldLabel htmlFor="reminderLeadDays">Aviso</FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5 disabled:bg-[var(--color-surface-alt)]"
            id="reminderLeadDays"
            name="reminderLeadDays"
            value={reminderLeadDays}
            disabled={!dueDate}
            onChange={(event) => setReminderLeadDays(event.target.value)}
          >
            <option value="off">Sin aviso</option>
            <option value="0">El mismo día</option>
            <option value="1">1 día antes</option>
            <option value="3">3 días antes</option>
            <option value="7">7 días antes</option>
            <option value="15">15 días antes</option>
            <option value="30">30 días antes</option>
          </select>
        </Field>

        <Field className="sm:col-start-2">
          <FieldLabel htmlFor="reminderRepeatIntervalDays">
            Si sigue pendiente
          </FieldLabel>
          <select
            className="min-h-12 rounded-[var(--radius-md)] border bg-white px-3.5 disabled:bg-[var(--color-surface-alt)]"
            id="reminderRepeatIntervalDays"
            name="reminderRepeatIntervalDays"
            defaultValue={String(task?.reminder_repeat_interval_days ?? "off")}
            disabled={!dueDate || reminderLeadDays === "off"}
          >
            <option value="off">No repetir el aviso</option>
            <option value="1">Recordar cada día</option>
            <option value="7">Recordar cada semana</option>
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
