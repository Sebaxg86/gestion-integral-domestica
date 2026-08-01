"use client";

import { Button } from "@gid/ui";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

import { getFileError, getFunctionErrorMessage } from "./file-upload";

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
  const [uploadStatus, setUploadStatus] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFile = file;
    const fileError = getFileError(selectedFile);
    if (fileError) return setMessage(fileError);
    if (!selectedFile) return;
    setPending(true);
    setMessage(undefined);
    setUploadStatus("Preparando la carga segura…");

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setMessage("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setMessage("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }

      const uploadId = crypto.randomUUID();
      const fileId = crypto.randomUUID();
      const stagedPath = `staging/${userData.user.id}/${uploadId}`;
      setUploadStatus("Subiendo el archivo…");
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(stagedPath, selectedFile, {
          cacheControl: "no-cache",
          contentType: selectedFile.type || "application/octet-stream",
        });
      if (uploadError) {
        setMessage("No pudimos cargar el archivo. Revisa tu conexión e intenta de nuevo.");
        return;
      }

      setUploadStatus("Validando y sustituyendo el archivo…");
      const { error } = await supabase.functions.invoke("replace-document-file", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: {
          uploadId,
          documentId,
          fileId,
          expectedVersion: version,
          originalFilename: selectedFile.name,
        },
      });
      if (error) {
        setMessage(
          await getFunctionErrorMessage(
            error,
            "No pudimos sustituir el archivo. El anterior sigue disponible.",
          ),
        );
        return;
      }

      router.push(`/app/documentos/${documentId}`);
      router.refresh();
    } catch {
      setMessage(
        "Ocurrió un problema al sustituir el archivo. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setPending(false);
      setUploadStatus(undefined);
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setMessage(getFileError(selectedFile));
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      {message ? (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-[var(--color-danger-700)]"
          role="alert"
        >
          {message}
        </p>
      ) : null}
      {uploadStatus ? (
        <div
          className="rounded-xl bg-[var(--color-brand-100)] p-3 text-sm text-[var(--color-brand-900)]"
          role="status"
          aria-live="polite"
        >
          <p>{uploadStatus}</p>
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-brand-700)_20%,transparent)]"
            role="progressbar"
            aria-label="Sustitución del archivo en curso"
            aria-valuetext={uploadStatus}
          >
            <div className="h-full w-2/5 animate-pulse rounded-full bg-[var(--color-brand-700)]" />
          </div>
        </div>
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
        onChange={selectFile}
      />
      <Button disabled={pending || !file} fullWidth size="mobile" type="submit">
        {pending ? "Validando y sustituyendo…" : "Sustituir archivo"}
      </Button>
    </form>
  );
}
