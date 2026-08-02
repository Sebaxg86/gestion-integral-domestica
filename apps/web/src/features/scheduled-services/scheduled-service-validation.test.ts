import { scheduledServiceSchema } from "@gid/validation";
import { describe, expect, it } from "vitest";

describe("validación de servicios programados", () => {
  it("acepta una obligación mensual con aviso recurrente", () => {
    // ===== Ejecución =====

    const result = scheduledServiceSchema.safeParse({
      name: "Recibo de electricidad",
      category: "electricity",
      provider: "Proveedor",
      recurrence: "monthly",
      dueDate: "2026-08-15",
      leadDays: "7",
      repeatIntervalDays: "1",
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("acepta una obligación de una sola vez", () => {
    // ===== Ejecución =====

    const result = scheduledServiceSchema.safeParse({
      name: "Renovación extraordinaria",
      category: "other",
      recurrence: "once",
      dueDate: "2026-10-10",
      leadDays: "15",
      repeatIntervalDays: "off",
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("requiere días cuando la frecuencia es personalizada", () => {
    // ===== Ejecución =====

    const result = scheduledServiceSchema.safeParse({
      name: "Revisión de filtro",
      category: "maintenance",
      recurrence: "custom_days",
      dueDate: "2026-09-01",
      leadDays: "3",
      repeatIntervalDays: "off",
    });

    // ===== Verificación =====

    expect(result.success).toBe(false);
  });

  it("rechaza anticipaciones y repeticiones no permitidas", () => {
    // ===== Ejecución =====

    const invalidLead = scheduledServiceSchema.safeParse({
      name: "Servicio inválido",
      category: "other",
      recurrence: "monthly",
      dueDate: "2026-09-01",
      leadDays: "2",
      repeatIntervalDays: "off",
    });
    const invalidRepeat = scheduledServiceSchema.safeParse({
      name: "Servicio inválido",
      category: "other",
      recurrence: "monthly",
      dueDate: "2026-09-01",
      leadDays: "7",
      repeatIntervalDays: "30",
    });

    // ===== Verificación =====

    expect(invalidLead.success).toBe(false);
    expect(invalidRepeat.success).toBe(false);
  });
});
