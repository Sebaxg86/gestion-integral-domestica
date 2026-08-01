"use client";

import { Button } from "@gid/ui";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

export function ReplaceFileForm({
  documentId,
  version,
}: {
  documentId: string;
  version: number;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setMessage("Selecciona un archivo PDF, JPEG o PNG.");
    if (file.size > 10 * 1024 * 1024)
      return setMessage("El archivo debe pesar como máximo 10 MiB.");
    setPending(true);
    setMessage(undefined);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Tu sesión expiró. Inicia sesión de nuevo.");
      return setPending(false);
    }

    const uploadId = crypto.randomUUID();
    const fileId = crypto.randomUUID();
    const stagedPath = `staging/${userData.user.id}/${uploadId}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(stagedPath, file, {
        cacheControl: "no-cache",
        contentType: file.type || "application/octet-stream",
      });
    if (uploadError) {
      setMessage(
        "No pudimos cargar el archivo. Revisa el formato y tu conexión.",
      );
      return setPending(false);
    }

    const { error } = await supabase.functions.invoke("replace-document-file", {
      body: {
        uploadId,
        documentId,
        fileId,
        expectedVersion: version,
        originalFilename: file.name,
      },
    });
    if (error) {
      setMessage(
        "No pudimos sustituir el archivo. El anterior sigue disponible.",
      );
      return setPending(false);
    }

    router.push(`/app/documentos/${documentId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      {message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {message}
        </p>
      ) : null}
      <label
        className="grid min-h-40 cursor-pointer place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-alt)] p-5 text-center"
        htmlFor="replacementFile"
      >
        <span>
          <FileUp
            aria-hidden
            className="mx-auto text-[var(--color-brand-800)]"
            size={25}
          />
          <span className="mt-2 block text-sm font-semibold">
            {file?.name ?? "Seleccionar archivo nuevo"}
          </span>
          <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
            El archivo actual se conserva hasta completar la validación.
          </span>
        </span>
      </label>
      <input
        className="sr-only"
        id="replacementFile"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button disabled={pending || !file} fullWidth size="mobile" type="submit">
        {pending ? "Validando y sustituyendo…" : "Sustituir archivo"}
      </Button>
    </form>
  );
}
