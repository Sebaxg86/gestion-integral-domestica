"use server";

import { taskSchema } from "@gid/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type FormState, getFieldErrors } from "@/features/shared/form-state";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Gestión de pendientes
// ============================================================================

function optionalFormValue(formData: FormData, name: string) {
  // ===== Normalización de campos opcionales =====

  return String(formData.get(name) ?? "").trim() || undefined;
}

function parseTaskForm(formData: FormData) {
  // ===== Validación compartida del formulario =====

  return taskSchema.safeParse({
    title: formData.get("title"),
    description: optionalFormValue(formData, "description"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    targetType: formData.get("targetType"),
    targetId: optionalFormValue(formData, "targetId"),
    dueDate: optionalFormValue(formData, "dueDate"),
    reminderLeadDays: formData.get("reminderLeadDays") ?? "off",
    reminderRepeatIntervalDays:
      formData.get("reminderRepeatIntervalDays") ?? "off",
  });
}

function taskRpcInput(data: ReturnType<typeof taskSchema.parse>) {
  // ===== Adaptación de la relación polimórfica =====

  const targetId = data.targetId ?? null;

  return {
    target_property_id: data.targetType === "property" ? targetId : null,
    target_vehicle_id: data.targetType === "vehicle" ? targetId : null,
    target_scheduled_service_id:
      data.targetType === "service" ? targetId : null,
    task_title: data.title,
    task_description: data.description ?? "",
    task_category: data.category,
    task_priority: data.priority,
    task_due_date: data.dueDate ?? null,
    task_reminder_lead_days:
      data.reminderLeadDays === "off" ? null : Number(data.reminderLeadDays),
    task_reminder_repeat_interval_days:
      data.reminderRepeatIntervalDays === "off"
        ? null
        : Number(data.reminderRepeatIntervalDays),
  };
}

function revalidateTaskViews(taskId: string) {
  // ===== Actualización de las vistas consumidoras =====

  revalidatePath("/app");
  revalidatePath("/app/pendientes");
  revalidatePath(`/app/pendientes/${taskId}`);
  revalidatePath("/app/avisos");
}

export async function createTaskAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos y familia =====

  const result = parseTaskForm(formData);
  if (!result.success) {
    return { errors: getFieldErrors(result.error) };
  }

  const context = await getSessionContext();
  if (!context?.family) {
    return { message: "Tu sesión ya no es válida." };
  }

  // ===== Creación transaccional =====

  const taskId = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_task", {
    task_id: taskId,
    target_family_id: context.family.id,
    ...taskRpcInput(result.data),
  });

  if (error) {
    return { message: "No pudimos guardar el pendiente. Revisa los datos." };
  }

  redirect(`/app/pendientes/${taskId}`);
}

export async function updateTaskAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  // ===== Validación de datos e identidad =====

  const result = parseTaskForm(formData);
  if (!result.success) {
    return { errors: getFieldErrors(result.error) };
  }

  const taskId = String(formData.get("taskId") ?? "");
  const version = Number(formData.get("version"));

  if (!taskId || !Number.isSafeInteger(version)) {
    return { message: "Los datos del pendiente no son válidos." };
  }

  // ===== Persistencia y actualización de la interfaz =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task", {
    target_task_id: taskId,
    expected_version: version,
    ...taskRpcInput(result.data),
  });

  if (error) {
    return { message: "El pendiente cambió o no pudo guardarse." };
  }

  revalidateTaskViews(taskId);
  redirect(`/app/pendientes/${taskId}`);
}

export async function setTaskStatusAction(formData: FormData) {
  // ===== Validación de la transición solicitada =====

  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");
  const version = Number(formData.get("version"));
  const allowedStatuses = ["pending", "in_progress", "completed", "cancelled"];

  if (
    !taskId ||
    !allowedStatuses.includes(status) ||
    !Number.isSafeInteger(version)
  ) {
    redirect("/app/pendientes?error=estado");
  }

  // ===== Persistencia del estado =====

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_task_status", {
    target_task_id: taskId,
    task_status: status,
    expected_version: version,
  });

  if (error) {
    redirect(`/app/pendientes/${taskId}?error=estado`);
  }

  revalidateTaskViews(taskId);
  redirect(`/app/pendientes/${taskId}`);
}
