import { vehicleSchema, vehicleServiceSchema } from "@gid/validation";
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

describe("validación de mantenimiento vehicular", () => {
  it("acepta un servicio con próxima atención", () => {
    // ===== Ejecución =====

    const result = vehicleServiceSchema.safeParse({
      title: "Cambio de aceite",
      type: "preventive",
      status: "completed",
      mileage: 20000,
      nextDueMileage: 30000,
      nextDueDate: "2027-02-01",
      leadDays: 7,
    });

    // ===== Verificación =====

    expect(result.success).toBe(true);
  });

  it("rechaza un próximo kilometraje menor al registrado", () => {
    // ===== Ejecución =====

    const result = vehicleServiceSchema.safeParse({
      title: "Cambio de aceite",
      type: "preventive",
      status: "completed",
      mileage: 30000,
      nextDueMileage: 20000,
    });

    // ===== Verificación =====

    expect(result.success).toBe(false);
  });
});
