// ============================================================================
// Cálculo de proximidad por kilometraje
// ============================================================================

export const MILEAGE_ATTENTION_THRESHOLD = 1000;

export function getMileageAttention(
  nextDueMileage: number | null,
  currentMileage: number | null,
) {
  // ===== Validación de lecturas comparables =====

  if (nextDueMileage === null || currentMileage === null) {
    return null;
  }

  // ===== Clasificación de la distancia restante =====

  const remainingMileage = nextDueMileage - currentMileage;

  return {
    remainingMileage,
    due: remainingMileage <= 0,
    upcoming: remainingMileage <= MILEAGE_ATTENTION_THRESHOLD,
  };
}
