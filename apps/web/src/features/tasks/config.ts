// ============================================================================
// Opciones y etiquetas de pendientes
// ============================================================================

// ===== Categorías disponibles =====

export const taskCategories = [
  ["household", "Hogar"],
  ["maintenance", "Mantenimiento"],
  ["paperwork", "Trámite"],
  ["purchase", "Compra"],
  ["call", "Llamada"],
  ["appointment", "Cita"],
  ["other", "Otro"],
] as const;

// ===== Prioridades disponibles =====

export const taskPriorities = [
  ["low", "Baja"],
  ["normal", "Normal"],
  ["high", "Alta"],
] as const;

// ===== Estados del ciclo de vida =====

export const taskStatuses = [
  ["pending", "Pendiente"],
  ["in_progress", "En proceso"],
  ["completed", "Completado"],
  ["cancelled", "Cancelado"],
] as const;

// ===== Diccionarios para consultas y detalles =====

export const taskCategoryLabels = Object.fromEntries(taskCategories) as Record<
  string,
  string
>;

export const taskPriorityLabels = Object.fromEntries(taskPriorities) as Record<
  string,
  string
>;

export const taskStatusLabels = Object.fromEntries(taskStatuses) as Record<
  string,
  string
>;
