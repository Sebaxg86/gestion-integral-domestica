import {
  vehicleSchema,
  vehicleServiceItemSchema,
  vehicleServicePartSchema,
  vehicleServiceSchema,
} from "@gid/validation";
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

describe("validación del detalle de mantenimiento", () => {
  it("acepta trabajos y refacciones con garantía opcional", () => {
    // ===== Ejecución =====

    const item = vehicleServiceItemSchema.safeParse({
      category: "brakes",
      description: "Cambio de balatas delanteras",
      status: "completed",
      warrantyUntil: "2027-02-01",
    });
    const part = vehicleServicePartSchema.safeParse({
      name: "Juego de balatas",
      brand: "Ejemplo",
      quantity: 1,
      unitCost: 1250,
    });

    // ===== Verificación =====

    expect(item.success).toBe(true);
    expect(part.success).toBe(true);
  });

  it("rechaza cantidades nulas o negativas", () => {
    // ===== Ejecución =====

    const zeroQuantity = vehicleServicePartSchema.safeParse({
      name: "Filtro de aceite",
      quantity: 0,
    });
    const negativeQuantity = vehicleServicePartSchema.safeParse({
      name: "Filtro de aire",
      quantity: -1,
    });

    // ===== Verificación =====

    expect(zeroQuantity.success).toBe(false);
    expect(negativeQuantity.success).toBe(false);
  });
});
