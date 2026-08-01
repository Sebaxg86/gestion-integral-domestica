import { documentSchema, passwordSchema } from "@gid/validation";
import { describe, expect, it } from "vitest";

describe("validación documental", () => {
  it("acepta los datos mínimos del primer paso", () => {
    const result = documentSchema.safeParse({
      name: "Póliza de vivienda",
      category: "insurance_policy",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un vencimiento anterior a la emisión", () => {
    const result = documentSchema.safeParse({
      name: "Póliza de vivienda",
      category: "insurance_policy",
      issueDate: "2026-07-31",
      expirationDate: "2026-07-30",
      leadDays: 7,
    });
    expect(result.success).toBe(false);
  });

  it("acepta las anticipaciones definidas por el dominio", () => {
    const result = documentSchema.safeParse({
      name: "Póliza de vivienda",
      category: "insurance_policy",
      expirationDate: "2027-07-31",
      leadDays: 30,
    });
    expect(result.success).toBe(true);
  });
});

describe("política de contraseñas", () => {
  it("exige longitud, mayúscula, minúscula y número", () => {
    expect(passwordSchema.safeParse("solo-minusculas").success).toBe(false);
    expect(passwordSchema.safeParse("ContrasenaSegura2026").success).toBe(true);
  });
});
