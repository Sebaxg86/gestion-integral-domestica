import { z } from "zod";

// ============================================================================
// Validaciones compartidas
// ============================================================================

// ===== Cuenta y autenticación =====

export const emailSchema = z.string().trim().email("Ingresa un correo válido.");

export const passwordSchema = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres.")
  .max(128, "La contraseña no puede exceder 128 caracteres.")
  .regex(/[a-z]/, "Incluye al menos una letra minúscula.")
  .regex(/[A-Z]/, "Incluye al menos una letra mayúscula.")
  .regex(/[0-9]/, "Incluye al menos un número.");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe al menos 2 caracteres.")
  .max(100, "El nombre no puede exceder 100 caracteres.");

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña."),
});

// ===== Familia y viviendas =====

export const propertyNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe al menos 2 caracteres.")
  .max(100, "El nombre no puede exceder 100 caracteres.");

export const familySchema = z.object({
  name: z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(80),
  timezone: z.string().trim().min(1, "Selecciona una zona horaria.").max(64),
});

export const propertySchema = z.object({
  name: propertyNameSchema,
  type: z.enum(["house", "apartment", "land", "commercial", "other"]),
  address: z
    .string()
    .trim()
    .max(300, "La dirección no puede exceder 300 caracteres."),
});

// ===== Vehículos =====

export const vehicleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe al menos 2 caracteres.")
    .max(100, "El alias no puede exceder 100 caracteres."),
  type: z.enum([
    "car",
    "truck",
    "motorcycle",
    "trailer",
    "recreational",
    "other",
  ]),
  make: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  modelYear: z.coerce
    .number()
    .int("Escribe un año válido.")
    .min(1886, "El año no puede ser anterior a 1886.")
    .max(
      new Date().getFullYear() + 1,
      "El año no puede ser posterior al siguiente año.",
    )
    .optional(),
  trim: z.string().trim().max(100).optional(),
  color: z.string().trim().max(50).optional(),
  vin: z
    .string()
    .trim()
    .refine(
      (value) => !value || (value.length >= 11 && value.length <= 17),
      "El VIN debe tener entre 11 y 17 caracteres.",
    )
    .optional(),
  licensePlate: z.string().trim().max(20).optional(),
  mileage: z.coerce
    .number()
    .int("El kilometraje debe ser un número entero.")
    .min(0, "El kilometraje no puede ser negativo.")
    .optional(),
  fuelType: z
    .enum(["gasoline", "diesel", "hybrid", "electric", "other"])
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const vehicleServiceSchema = z
  .object({
    title: z.string().trim().min(2).max(150),
    type: z.enum([
      "preventive",
      "corrective",
      "repair",
      "diagnostic",
      "inspection",
      "general",
      "other",
    ]),
    status: z.enum(["planned", "in_progress", "completed", "cancelled"]),
    serviceDate: z.string().optional(),
    mileage: z.coerce.number().int().min(0).optional(),
    provider: z.string().trim().max(150).optional(),
    cost: z.coerce.number().min(0).optional(),
    notes: z.string().trim().max(3000).optional(),
    nextDueDate: z.string().optional(),
    nextDueMileage: z.coerce.number().int().min(0).optional(),
    leadDays: z.coerce
      .number()
      .refine((value) => [0, 1, 3, 7, 15, 30].includes(value))
      .optional(),
    repeatIntervalDays: z.coerce
      .number()
      .refine((value) => [1, 7].includes(value))
      .optional(),
  })
  .refine(
    ({ mileage, nextDueMileage }) =>
      mileage === undefined ||
      nextDueMileage === undefined ||
      nextDueMileage >= mileage,
    {
      path: ["nextDueMileage"],
      message: "El próximo kilometraje no puede ser menor al actual.",
    },
  );

// ===== Detalle del mantenimiento =====

export const vehicleServiceItemSchema = z.object({
  category: z.enum([
    "oil",
    "brakes",
    "suspension",
    "battery",
    "tires",
    "fluids",
    "filters",
    "engine",
    "transmission",
    "electrical",
    "body",
    "inspection",
    "other",
  ]),
  description: z
    .string()
    .trim()
    .min(2, "Describe el trabajo con al menos 2 caracteres.")
    .max(150, "La descripción no puede exceder 150 caracteres."),
  status: z.enum(["reviewed", "completed", "pending"]),
  notes: z.string().trim().max(1500).optional(),
  warrantyUntil: z.string().optional(),
});

export const vehicleServicePartSchema = z.object({
  serviceItemId: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de la refacción.")
    .max(150, "El nombre no puede exceder 150 caracteres."),
  brand: z.string().trim().max(100).optional(),
  partNumber: z.string().trim().max(100).optional(),
  quantity: z.coerce
    .number()
    .positive("La cantidad debe ser mayor que cero.")
    .max(999999),
  unitCost: z.coerce.number().min(0).max(9999999999).optional(),
  warrantyUntil: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

// ===== Seguimiento del kilometraje =====

export const vehicleMileageReadingSchema = z.object({
  mileage: z.coerce
    .number()
    .int("El kilometraje debe ser un número entero.")
    .min(0, "El kilometraje no puede ser negativo."),
  recordedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida."),
  notes: z.string().trim().max(1000).optional(),
});

export const vehicleMileageReminderSchema = z.object({
  intervalDays: z.enum(["off", "30", "60", "90"]),
});

// ===== Servicios programados =====

export const scheduledServiceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Escribe al menos 2 caracteres.")
      .max(150, "El nombre no puede exceder 150 caracteres."),
    propertyId: z.string().uuid("Selecciona una vivienda válida.").optional(),
    category: z.enum([
      "electricity",
      "water",
      "gas",
      "internet",
      "phone",
      "insurance",
      "rent",
      "property_tax",
      "subscription",
      "maintenance",
      "other",
    ]),
    provider: z.string().trim().max(150).optional(),
    recurrence: z.enum([
      "once",
      "weekly",
      "monthly",
      "bimonthly",
      "quarterly",
      "semiannual",
      "annual",
      "custom_days",
    ]),
    customIntervalDays: z.coerce
      .number()
      .int("El intervalo debe ser un número entero.")
      .min(1, "El intervalo debe ser de al menos un día.")
      .max(3650, "El intervalo no puede exceder 3650 días.")
      .optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida."),
    leadDays: z.coerce
      .number()
      .refine(
        (value) => [0, 1, 3, 7, 15, 30].includes(value),
        "Selecciona una anticipación válida.",
      ),
    repeatIntervalDays: z.enum(["off", "1", "7"]),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine(
    ({ recurrence, customIntervalDays }) =>
      recurrence !== "custom_days" || customIntervalDays !== undefined,
    {
      path: ["customIntervalDays"],
      message: "Indica cada cuántos días se repite.",
    },
  );

// ===== Pendientes =====

export const taskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Escribe al menos 2 caracteres.")
      .max(150, "El título no puede exceder 150 caracteres."),
    description: z.string().trim().max(3000).optional(),
    category: z.enum([
      "household",
      "maintenance",
      "paperwork",
      "purchase",
      "call",
      "appointment",
      "other",
    ]),
    priority: z.enum(["low", "normal", "high"]),
    targetType: z.enum(["family", "property", "vehicle", "service"]),
    targetId: z.string().uuid("Selecciona un elemento válido.").optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida.")
      .optional(),
    reminderLeadDays: z.enum(["off", "0", "1", "3", "7", "15", "30"]),
    reminderRepeatIntervalDays: z.enum(["off", "1", "7"]),
  })
  .refine(
    ({ targetType, targetId }) =>
      targetType === "family" ? targetId === undefined : targetId !== undefined,
    {
      path: ["targetId"],
      message: "Selecciona el elemento relacionado.",
    },
  )
  .refine(
    ({ dueDate, reminderLeadDays }) =>
      dueDate !== undefined || reminderLeadDays === "off",
    {
      path: ["reminderLeadDays"],
      message: "Agrega una fecha límite para configurar el aviso.",
    },
  )
  .refine(
    ({ reminderLeadDays, reminderRepeatIntervalDays }) =>
      reminderLeadDays !== "off" || reminderRepeatIntervalDays === "off",
    {
      path: ["reminderRepeatIntervalDays"],
      message: "Activa primero el aviso inicial.",
    },
  );

// ===== Documentos y recordatorios =====

export const documentNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe al menos 2 caracteres.")
  .max(150, "El nombre no puede exceder 150 caracteres.");

export const documentCategorySchema = z.enum([
  "deed",
  "contract",
  "insurance_policy",
  "property_tax_receipt",
  "appraisal",
  "plan",
  "warranty",
  "invoice",
  "permit",
  "registration_card",
  "inspection",
  "financing",
  "manual",
  "other",
]);

export const documentSchema = z
  .object({
    name: documentNameSchema,
    category: documentCategorySchema,
    issueDate: z.string().optional(),
    expirationDate: z.string().optional(),
    issuer: z.string().trim().max(150).optional(),
    documentNumber: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
    leadDays: z.coerce
      .number()
      .refine((value) => [0, 1, 3, 7, 15, 30].includes(value))
      .optional(),
    repeatIntervalDays: z.coerce
      .number()
      .refine((value) => [1, 7].includes(value))
      .optional(),
  })
  .refine(
    ({ issueDate, expirationDate }) =>
      !issueDate || !expirationDate || expirationDate >= issueDate,
    {
      path: ["expirationDate"],
      message: "El vencimiento no puede ser anterior a la emisión.",
    },
  );
