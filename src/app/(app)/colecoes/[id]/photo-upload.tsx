"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

import { sendPhotoTus } from "@/lib/photos/tus-upload";
import { detectImageMimeType, SIMPLE_UPLOAD_MAX_BYTES, validatePhotoFile } from "@/lib/photos/validation";

type UploadItem = {
  id: string;
  file: File;
  status: "aguardando" | "enviando" | "concluído" | "falhou";
  progress: number;
  error?: string;
};

function sendPhoto(collectionId: string, item: UploadItem, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/colecoes/${collectionId}/fotos`);
    request.responseType = "json";
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error(navigator.onLine ? "Falha de conexão. Tente novamente." : "Sem conexão. Reconecte-se para enviar fotos."));
    request.ontimeout = () => reject(new Error("O envio demorou demais. Tente novamente."));
    request.onload = () => {
      if (request.status === 201) resolve();
      else reject(new Error(request.response?.error ?? "Não foi possível enviar a imagem."));
    };
    const body = new FormData();
    body.append("file", item.file);
    request.send(body);
  });
}

export function PhotoUpload({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setQueue((current) => [
      ...current,
      ...files.map((file) => {
        const error = validatePhotoFile(file);
        return {
          id: crypto.randomUUID(),
          file,
          status: error ? "falhou" as const : "aguardando" as const,
          progress: 0,
          error: error ?? undefined,
        };
      }),
    ]);
    event.target.value = "";
  }

  function updateItem(id: string, changes: Partial<UploadItem>) {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  async function uploadQueue() {
    if (uploading) return;
    setUploading(true);
    let uploaded = false;
    for (const item of queue.filter((entry) => entry.status === "aguardando")) {
      updateItem(item.id, { status: "enviando", progress: 0 });
      try {
        if (!navigator.onLine) throw new Error("Sem conexão. Reconecte-se para enviar fotos.");
        const signature = detectImageMimeType(new Uint8Array(await item.file.slice(0, 12).arrayBuffer()));
        if (signature !== item.file.type) {
          throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
        }
        const onProgress = (progress: number) => updateItem(item.id, { progress });
        if (item.file.size > SIMPLE_UPLOAD_MAX_BYTES) {
          await sendPhotoTus(collectionId, item.file, onProgress);
        } else {
          await sendPhoto(collectionId, item, onProgress);
        }
        updateItem(item.id, { status: "concluído", progress: 100 });
        uploaded = true;
      } catch (error) {
        updateItem(item.id, {
          status: "falhou",
          error: error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
        });
      }
    }
    setUploading(false);
    if (uploaded) router.refresh();
  }

  const waitingCount = queue.filter((item) => item.status === "aguardando").length;

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Adicionar fotos</h2>
      <p className="mt-2 text-sm text-slate-600">JPEG, PNG ou WebP, até 10 MiB por foto. Acima de 4 MiB, o envio é retomável.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-stone-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          Selecionar imagens
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            multiple
            onChange={addFiles}
            type="file"
          />
        </label>
        <button
          className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={uploading || waitingCount === 0}
          onClick={uploadQueue}
          type="button"
        >
          {uploading ? "Enviando..." : `Enviar ${waitingCount} ${waitingCount === 1 ? "foto" : "fotos"}`}
        </button>
      </div>
      {queue.length > 0 && (
        <ul aria-label="Resultado dos uploads" className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {queue.map((item) => (
            <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" key={item.id}>
              <span className="min-w-0 truncate font-medium" title={item.file.name}>{item.file.name}</span>
              <span aria-live="polite" className={item.status === "falhou" ? "text-red-700" : "text-slate-600"}>
                {item.status === "enviando" ? `Enviando ${item.progress}%` : item.status}
                {item.error ? ` — ${item.error}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
