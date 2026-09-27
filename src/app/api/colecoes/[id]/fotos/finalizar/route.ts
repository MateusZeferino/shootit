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

export async function POST(
  request: Request,
  context: RouteContext<"/api/colecoes/[id]/fotos/finalizar">,
) {
  if (isCrossOrigin(request)) {
    return Response.json({ error: "Origem não permitida." }, { status: 403 });
  }
  const { id: rawId } = await context.params;
  const id = collectionIdSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: "Álbum não encontrado." }, { status: 404 });

  const access = await getPhotoAccess(id.data);
  if (access.status !== "ok") return photoAccessResponse(access.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dados de upload inválidos." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Dados de upload inválidos." }, { status: 400 });
  }
  const { photoId: rawPhotoId, size, mimeType } = body as {
    photoId?: unknown; size?: unknown; mimeType?: unknown;
  };
  const photoId = collectionIdSchema.safeParse(rawPhotoId);
  if (!photoId.success || typeof size !== "number" || !Number.isSafeInteger(size) || typeof mimeType !== "string") {
    return Response.json({ error: "Dados de upload inválidos." }, { status: 400 });
  }
  const error = validatePhotoFile({ size, type: mimeType });
  if (error) return Response.json({ error }, { status: 400 });
  if (size <= SIMPLE_UPLOAD_MAX_BYTES) {
    return Response.json({ error: "Use o envio simples para imagens de até 6 MiB." }, { status: 400 });
  }
  const storagePath = `${access.userId}/${id.data}/${photoId.data}.${photoExtension(mimeType)}`;
  const existing = await access.supabase.from("photos").select("id,storage_path")
    .eq("id", photoId.data).maybeSingle();
  if (existing.error) return Response.json({ error: "Não foi possível verificar a foto." }, { status: 500 });
  if (existing.data) {
    if (existing.data.storage_path !== storagePath) {
      return Response.json({ error: "Foto já registrada." }, { status: 409 });
    }
    return Response.json({ id: photoId.data });
  }

  const { data: file, error: downloadError } = await access.supabase.storage
    .from(PHOTO_BUCKET).download(storagePath);
  if (downloadError || !file) {
    return Response.json({ error: "Arquivo ainda não disponível. Tente novamente." }, { status: 409 });
  }
  const signature = detectImageMimeType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (file.size !== size || file.type !== mimeType || signature !== mimeType) {
    const { error: cleanupError } = await access.supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
    if (cleanupError) console.error("Falha ao remover upload inválido", { code: cleanupError.statusCode });
    return Response.json({ error: "Arquivo inválido ou diferente do informado." }, { status: 400 });
  }

  const { error: insertError } = await access.supabase.from("photos").insert({
    id: photoId.data,
    collection_id: id.data,
    storage_path: storagePath,
    mime_type: mimeType,
    file_size_bytes: size,
  });
  if (insertError) {
    return Response.json({ error: "Não foi possível registrar a foto. Tente novamente." }, { status: 500 });
  }
  revalidatePath(`/colecoes/${id.data}`);
  return Response.json({ id: photoId.data }, { status: 201 });
}
