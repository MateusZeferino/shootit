"use client";

async function postUpload(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

export async function sendPhotoR2(collectionId: string, file: File, onProgress: (value: number) => void) {
  const base = `/api/colecoes/${collectionId}/fotos`;
  const prepared = await postUpload(`${base}/preparar`, { size: file.size, mimeType: file.type });
  if (!prepared.response.ok) throw new Error(prepared.result.error ?? "Não foi possível preparar o envio.");
  const { uploadUrl, ticket } = prepared.result;
  if (typeof uploadUrl !== "string" || typeof ticket !== "string") throw new Error("Resposta de envio inválida.");

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 90));
    };
    request.onerror = () => reject(new Error(navigator.onLine ? "Falha de conexão. Tente novamente." : "Sem conexão. Reconecte-se para enviar fotos."));
    request.ontimeout = () => reject(new Error("O envio demorou demais. Tente novamente."));
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve() : reject(new Error("Não foi possível enviar o arquivo. Tente novamente."));
    request.send(file);
  });

  onProgress(95);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completed = await postUpload(`${base}/finalizar`, { ticket });
      if (completed.response.ok) return;
      if (completed.response.status < 500 && completed.response.status !== 409) {
        throw new Error(completed.result.error ?? "Arquivo inválido.", { cause: "invalid_upload" });
      }
      if (attempt === 2) throw new Error(completed.result.error ?? "Não foi possível concluir o envio.");
    } catch (error) {
      if (attempt === 2 || (error instanceof Error && error.cause === "invalid_upload")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
  }
}
