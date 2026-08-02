import { describe, expect, it } from "vitest";

import { getMileageAttention } from "./attention";

// ============================================================================
// Clasificación de mantenimientos por kilometraje
// ============================================================================

describe("proximidad por kilometraje", () => {
  it("marca como próximo un mantenimiento a mil kilómetros", () => {
    // ===== Ejecución =====

    const result = getMileageAttention(31000, 30000);

    // ===== Verificación =====

    expect(result).toEqual({
      remainingMileage: 1000,
      due: false,
      upcoming: true,
    });
  });

  it("marca como vencido un kilometraje alcanzado", () => {
    // ===== Ejecución =====

    const result = getMileageAttention(30000, 30100);

    // ===== Verificación =====

    expect(result?.due).toBe(true);
    expect(result?.remainingMileage).toBe(-100);
  });

  it("omite la clasificación cuando falta una lectura", () => {
    // ===== Ejecución y verificación =====

    expect(getMileageAttention(30000, null)).toBeNull();
    expect(getMileageAttention(null, 30000)).toBeNull();
  });
});
