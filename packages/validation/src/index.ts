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
