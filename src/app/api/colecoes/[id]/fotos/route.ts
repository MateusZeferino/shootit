import { revalidatePath } from "next/cache";

import { collectionIdSchema } from "@/lib/collections/validation";
import { getPhotoAccess, isCrossOrigin, photoAccessResponse } from "@/lib/photos/access";
import {
  detectImageMimeType,
  PHOTO_BUCKET,
  PHOTO_URL_TTL_SECONDS,
  SIMPLE_UPLOAD_MAX_BYTES,
  photoExtension,
  validatePhotoFile,
} from "@/lib/photos/validation";
import { createImageVariants, InvalidPhotoError } from "@/lib/photos/image-variants";
import { photoVariantPaths } from "@/lib/photos/variant-paths";
import { removePhotoObjects, uploadPhotoVariants } from "@/lib/photos/variant-storage";

export const dynamic = "force-dynamic";

const PHOTO_PAGE_SIZE = 24;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request, context: RouteContext<"/api/colecoes/[id]/fotos">) {
  const { id: rawId } = await context.params;
  const id = collectionIdSchema.safeParse(rawId);
  if (!id.success) {
    return Response.json({ error: "Álbum não encontrado." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const offsets = new URL(request.url).searchParams.getAll("offset");
  if (offsets.length !== 1 || !/^(0|[1-9]\d*)$/.test(offsets[0])) {
    return Response.json({ error: "Deslocamento inválido." }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const offset = Number(offsets[0]);
  if (!Number.isSafeInteger(offset) || offset % PHOTO_PAGE_SIZE !== 0) {
    return Response.json({ error: "Deslocamento inválido." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const access = await getPhotoAccess(id.data);
    if (access.status !== "ok") {
      const response = photoAccessResponse(access.status);
      for (const [header, value] of Object.entries(NO_STORE_HEADERS)) response.headers.set(header, value);
      return response;
    }

    const { data: batch, error: photosError } = await access.supabase
      .from("photos")
      .select("id,storage_path")
      .eq("collection_id", id.data)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PHOTO_PAGE_SIZE);
    if (photosError || !batch) throw new Error("Photo query failed");

    const visiblePhotos = batch.slice(0, PHOTO_PAGE_SIZE);
    if (visiblePhotos.length === 0) {
      return Response.json({ photos: [], hasMore: false }, { headers: NO_STORE_HEADERS });
    }
    const paths = visiblePhotos.flatMap((photo) => {
      const variants = photoVariantPaths(photo.storage_path);
      return [photo.storage_path, variants.thumbnail, variants.preview];
    });
    const { data: signed, error: signedError } = await access.supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
    if (signedError || !signed || signed.length !== paths.length) {
      throw new Error("Photo signing failed");
    }
    const signedUrls = new Map(signed.map((item) => [item.path, item.error ? null : item.signedUrl]));
    const photos = visiblePhotos.map((photo) => {
      const variants = photoVariantPaths(photo.storage_path);
      return {
        id: photo.id,
        originalUrl: signedUrls.get(photo.storage_path) ?? null,
        thumbnailUrl: signedUrls.get(variants.thumbnail) ?? null,
        previewUrl: signedUrls.get(variants.preview) ?? null,
      };
    });
    return Response.json({ photos, hasMore: batch.length > PHOTO_PAGE_SIZE }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "Não foi possível carregar as fotos." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

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
    return Response.json({ error: "Imagens acima de 4 MiB devem usar o envio retomável." }, { status: 413 });
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
    return Response.json({ error: "Imagens acima de 4 MiB devem usar o envio retomável." }, { status: 413 });
  }

  const signature = detectImageMimeType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (signature !== file.type) {
    return Response.json({ error: "O conteúdo do arquivo não corresponde ao formato informado." }, { status: 400 });
  }

  let variants: Awaited<ReturnType<typeof createImageVariants>>;
  try {
    variants = await createImageVariants(Buffer.from(await file.arrayBuffer()));
  } catch (cause) {
    if (cause instanceof InvalidPhotoError) {
      return Response.json({ error: "Imagem inválida ou grande demais para processamento." }, { status: 400 });
    }
    return Response.json({ error: "Não foi possível processar a imagem. Tente novamente." }, { status: 500 });
  }

  const photoId = crypto.randomUUID();
  const storagePath = `${access.userId}/${id.data}/${photoId}.${photoExtension(signature)}`;
  const { error: uploadError } = await access.supabase.storage.from(PHOTO_BUCKET).upload(
    storagePath,
    file,
    { contentType: signature, cacheControl: "3600", upsert: false },
  );
  if (uploadError) {
    return Response.json({ error: "Não foi possível enviar a imagem. Tente novamente." }, { status: 500 });
  }

  try {
    await uploadPhotoVariants(access.supabase.storage, storagePath, variants);
  } catch {
    const { error: cleanupError } = await removePhotoObjects(access.supabase.storage, storagePath);
    if (cleanupError) console.error("Falha ao limpar upload incompleto", { code: cleanupError.statusCode });
    return Response.json({ error: "Não foi possível preparar a foto. Tente novamente." }, { status: 500 });
  }

  const { error: insertError } = await access.supabase.from("photos").insert({
    id: photoId,
    collection_id: id.data,
    storage_path: storagePath,
    mime_type: signature,
    file_size_bytes: file.size,
  });
  if (insertError) {
    const { error: cleanupError } = await removePhotoObjects(access.supabase.storage, storagePath);
    if (cleanupError) console.error("Falha ao limpar upload sem metadados", { code: cleanupError.statusCode });
    return Response.json({ error: "Não foi possível salvar a imagem. Tente novamente." }, { status: 500 });
  }

  revalidatePath(`/colecoes/${id.data}`);
  return Response.json({ id: photoId }, { status: 201 });
}
