import { revalidatePath } from "next/cache";

import { collectionIdSchema } from "@/lib/collections/validation";
import { getPhotoAccess, isCrossOrigin, photoAccessResponse } from "@/lib/photos/access";
import {
  detectImageMimeType,
  PHOTO_BUCKET,
  SIMPLE_UPLOAD_MAX_BYTES,
  photoExtension,
  validatePhotoFile,
} from "@/lib/photos/validation";

export async function POST(request: Request, context: RouteContext<"/api/colecoes/[id]/fotos">) {
  if (isCrossOrigin(request)) {
    return Response.json({ error: "Origem não permitida." }, { status: 403 });
  }
  const { id: rawId } = await context.params;
  const id = collectionIdSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: "Álbum não encontrado." }, { status: 404 });

  const access = await getPhotoAccess(id.data);
  if (access.status !== "ok") return photoAccessResponse(access.status);

  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > SIMPLE_UPLOAD_MAX_BYTES + 200_000) {
    return Response.json({ error: "Imagens acima de 6 MiB devem usar o envio retomável." }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return Response.json({ error: "Envie uma imagem." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Não foi possível ler o arquivo." }, { status: 400 });
  }
  const files = formData.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File)) {
    return Response.json({ error: "Envie uma imagem por requisição." }, { status: 400 });
  }
  const file = files[0];
  const validationError = validatePhotoFile(file);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });
  if (file.size > SIMPLE_UPLOAD_MAX_BYTES) {
    return Response.json({ error: "Imagens acima de 6 MiB devem usar o envio retomável." }, { status: 413 });
  }

  const signature = detectImageMimeType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (signature !== file.type) {
    return Response.json({ error: "O conteúdo do arquivo não corresponde ao formato informado." }, { status: 400 });
  }

  const photoId = crypto.randomUUID();
  const storagePath = `${access.userId}/${id.data}/${photoId}.${photoExtension(signature)}`;
  const { error: uploadError } = await access.supabase.storage.from(PHOTO_BUCKET).upload(
    storagePath,
    file,
    { contentType: signature, upsert: false },
  );
  if (uploadError) {
    return Response.json({ error: "Não foi possível enviar a imagem. Tente novamente." }, { status: 500 });
  }

  const { error: insertError } = await access.supabase.from("photos").insert({
    id: photoId,
    collection_id: id.data,
    storage_path: storagePath,
    mime_type: signature,
    file_size_bytes: file.size,
  });
  if (insertError) {
    const { error: cleanupError } = await access.supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
    if (cleanupError) console.error("Falha ao limpar upload sem metadados", { code: cleanupError.statusCode });
    return Response.json({ error: "Não foi possível salvar a imagem. Tente novamente." }, { status: 500 });
  }

  revalidatePath(`/colecoes/${id.data}`);
  return Response.json({ id: photoId }, { status: 201 });
}
