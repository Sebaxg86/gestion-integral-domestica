export const scheduledServiceCategories = [
  ["electricity", "Electricidad"],
  ["water", "Agua"],
  ["gas", "Gas"],
  ["internet", "Internet"],
  ["phone", "Telefonía"],
  ["insurance", "Seguro"],
  ["rent", "Renta"],
  ["property_tax", "Impuesto o predial"],
  ["subscription", "Suscripción"],
  ["maintenance", "Mantenimiento"],
  ["other", "Otro"],
] as const;

export const scheduledServiceRecurrences = [
  ["once", "Una sola vez"],
  ["weekly", "Cada semana"],
  ["monthly", "Cada mes"],
  ["bimonthly", "Cada dos meses"],
  ["quarterly", "Cada tres meses"],
  ["semiannual", "Cada seis meses"],
  ["annual", "Cada año"],
  ["custom_days", "Intervalo personalizado"],
] as const;

export const scheduledServiceCategoryLabels = Object.fromEntries(
  scheduledServiceCategories,
) as Record<string, string>;

export const scheduledServiceRecurrenceLabels = Object.fromEntries(
  scheduledServiceRecurrences,
) as Record<string, string>;

export const scheduledServiceOccurrenceLabels: Record<string, string> = {
  pending: "Pendiente",
  attended: "Atendido",
  skipped: "Omitido",
  cancelled: "Cancelado",
};
