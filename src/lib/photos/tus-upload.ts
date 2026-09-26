"use client";

import * as tus from "tus-js-client";

import { readPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos/validation";

type PreparedUpload = { photoId: string; storagePath: string };

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar a imagem.");
  return result;
}

function resumableEndpoint() {
  const url = new URL(readPublicEnv().NEXT_PUBLIC_SUPABASE_URL);
  if (url.hostname.endsWith(".supabase.co")) {
    url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  return new URL("/storage/v1/upload/resumable", url).href;
}

export async function sendPhotoTus(
  collectionId: string,
  file: File,
  onProgress: (value: number) => void,
) {
  if (!navigator.onLine) throw new Error("Sem conexão. Reconecte-se para enviar fotos.");

  const base = `/api/colecoes/${collectionId}/fotos`;
  const prepared = await postJson(`${base}/preparar`, {
    size: file.size,
    mimeType: file.type,
  }) as PreparedUpload;
  const { data: { session }, error: sessionError } = await createClient().auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error("Sua sessão expirou. Entre novamente para enviar fotos.");
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: resumableEndpoint(),
      headers: { authorization: `Bearer ${session.access_token}` },
      metadata: {
        bucketName: PHOTO_BUCKET,
        objectName: prepared.storagePath,
        contentType: file.type,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 3000, 5000, 10000],
      onError: () => reject(new Error("Falha no envio retomável. Verifique a conexão e tente novamente.")),
      onProgress: (uploaded, total) => onProgress(Math.min(99, Math.round(uploaded / total * 100))),
      onSuccess: () => resolve(),
    });
    upload.start();
  });

  await postJson(`${base}/finalizar`, {
    photoId: prepared.photoId,
    size: file.size,
    mimeType: file.type,
  });
  onProgress(100);
}
