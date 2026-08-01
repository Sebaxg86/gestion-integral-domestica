import { z } from "zod";

export const emailSchema = z.string().trim().email("Ingresa un correo válido.");

export const passwordSchema = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres.")
  .max(128, "La contraseña no puede exceder 128 caracteres.");

export const propertyNameSchema = z
  .string()
  .trim()
  .min(1, "Escribe el nombre de la vivienda.")
  .max(120, "El nombre no puede exceder 120 caracteres.");

export const documentNameSchema = z
  .string()
  .trim()
  .min(1, "Escribe el nombre del documento.")
  .max(160, "El nombre no puede exceder 160 caracteres.");
