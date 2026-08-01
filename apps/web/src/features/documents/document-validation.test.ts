import { documentSchema, passwordSchema } from "@gid/validation";
import { describe, expect, it } from "vitest";

describe("validación documental", () => {
  it("acepta los datos mínimos del primer paso", () => {
    // ===== Ejecución =====

    const result = documentSchema.safeParse({
      name: "Póliza de vivienda",
      category: "insurance_policy",
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("rechaza un vencimiento anterior a la emisión", () => {
    // ===== Ejecución =====

    const result = documentSchema.safeParse({
      name: "Póliza de vivienda",
      category: "insurance_policy",
      issueDate: "2026-07-31",
      expirationDate: "2026-07-30",
      leadDays: 7,
    });

    // ===== Verificación =====

    expect(result.success).toBe(false);
  });

  it("acepta las anticipaciones definidas por el dominio", () => {
    // ===== Ejecución =====

    const result = documentSchema.safeParse({
      name: "Póliza de vivienda",
      category: "insurance_policy",
      expirationDate: "2027-07-31",
      leadDays: 30,
      repeatIntervalDays: 1,
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("rechaza frecuencias de repetición no soportadas", () => {
    // ===== Ejecución =====

    const result = documentSchema.safeParse({
      name: "Póliza de vivienda",
      category: "insurance_policy",
      expirationDate: "2027-07-31",
      leadDays: 7,
      repeatIntervalDays: 2,
    });

    // ===== Verificación =====

    expect(result.success).toBe(false);
  });
});

describe("política de contraseñas", () => {
  it("exige longitud, mayúscula, minúscula y número", () => {
    // ===== Ejecución y verificación =====

    expect(passwordSchema.safeParse("solo-minusculas").success).toBe(false);
    expect(passwordSchema.safeParse("ContrasenaSegura2026").success).toBe(true);
  });
});
