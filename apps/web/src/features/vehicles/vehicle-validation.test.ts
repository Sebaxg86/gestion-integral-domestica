import { vehicleSchema } from "@gid/validation";
import { describe, expect, it } from "vitest";

describe("validación vehicular", () => {
  it("acepta un vehículo con datos operativos válidos", () => {
    // ===== Ejecución =====

    const result = vehicleSchema.safeParse({
      name: "Civic gris",
      type: "car",
      modelYear: 2025,
      mileage: 18000,
      fuelType: "gasoline",
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("rechaza kilometraje negativo y años futuros fuera del límite", () => {
    // ===== Ejecución =====

    const result = vehicleSchema.safeParse({
      name: "Vehículo inválido",
      type: "car",
      modelYear: new Date().getFullYear() + 2,
      mileage: -1,
    });

    // ===== Verificación =====

    expect(result.success).toBe(false);
  });
});
