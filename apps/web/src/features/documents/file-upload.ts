export const MAX_FILE_SIZE = 10 * 1024 * 1024;

type FunctionErrorContext = {
  json?: () => Promise<unknown>;
};

export function getFileError(file: File | null) {
  if (!file) return "Selecciona un archivo PDF, JPEG o PNG.";
  if (file.size === 0) return "El archivo está vacío. Selecciona otro archivo.";
  if (file.size > MAX_FILE_SIZE) {
    return "El archivo debe pesar como máximo 10 MiB.";
  }

  return undefined;
}

export function getDocumentNameFromFilename(filename: string) {
  const name = filename.replace(/\.[^.]+$/, "").trim();
  return name.slice(0, 150);
}

export async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
) {
  const context = (error as { context?: FunctionErrorContext } | undefined)
    ?.context;

  try {
    const body = await context?.json?.();
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }
  } catch {
    // Algunas respuestas de la función no incluyen un cuerpo JSON legible.
  }

  return fallback;
}
