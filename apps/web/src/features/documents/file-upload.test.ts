import {
  getDocumentNameFromFilename,
  getFileError,
} from "./file-upload";
import { describe, expect, it } from "vitest";

describe("validación de archivos documentales", () => {
  it("acepta archivos de iPhone aunque el navegador no informe su MIME", () => {
    const file = new File(["contenido"], "póliza.pdf", { type: "" });

    expect(getFileError(file)).toBeUndefined();
  });

  it("rechaza archivos vacíos o que exceden el límite", () => {
    expect(getFileError(new File([], "vacío.pdf"))).toBe(
      "El archivo está vacío. Selecciona otro archivo.",
    );
    expect(
      getFileError(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf")),
    ).toBe("El archivo debe pesar como máximo 10 MiB.");
  });

  it("propone un nombre a partir del archivo seleccionado", () => {
    expect(getDocumentNameFromFilename("Póliza hogar 2026.pdf")).toBe(
      "Póliza hogar 2026",
    );
  });
});
