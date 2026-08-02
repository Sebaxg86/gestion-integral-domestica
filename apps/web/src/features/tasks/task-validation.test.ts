import { taskSchema } from "@gid/validation";
import { describe, expect, it } from "vitest";

describe("validación de pendientes", () => {
  it("acepta un pendiente familiar sin fecha", () => {
    // ===== Ejecución =====

    const result = taskSchema.safeParse({
      title: "Solicitar cotización",
      category: "maintenance",
      priority: "normal",
      targetType: "family",
      reminderLeadDays: "off",
      reminderRepeatIntervalDays: "off",
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("acepta un pendiente relacionado con fecha y aviso", () => {
    // ===== Ejecución =====

    const result = taskSchema.safeParse({
      title: "Renovar permiso",
      category: "paperwork",
      priority: "high",
      targetType: "property",
      targetId: "11100000-0000-4000-8000-000000000001",
      dueDate: "2026-08-15",
      reminderLeadDays: "7",
      reminderRepeatIntervalDays: "1",
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("rechaza una relación sin elemento seleccionado", () => {
    // ===== Ejecución =====

    const result = taskSchema.safeParse({
      title: "Revisar vivienda",
      category: "household",
      priority: "normal",
      targetType: "property",
      reminderLeadDays: "off",
      reminderRepeatIntervalDays: "off",
    });

    // ===== Verificación =====

    expect(result.success).toBe(false);
  });

  it("rechaza un aviso sin fecha límite", () => {
    // ===== Ejecución =====

    const result = taskSchema.safeParse({
      title: "Llamar al proveedor",
      category: "call",
      priority: "normal",
      targetType: "family",
      reminderLeadDays: "1",
      reminderRepeatIntervalDays: "off",
    });

    // ===== Verificación =====

    expect(result.success).toBe(false);
  });
});
