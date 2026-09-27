import { collectionIdSchema } from "@/lib/collections/validation";
import { PHOTO_BUCKET, photoExtension } from "@/lib/photos/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DOWNLOAD_URL_TTL_SECONDS = 60;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(
  _request: Request,
  context: RouteContext<"/g/[publicToken]/fotos/[photoId]/download">,
) {
  const { publicToken: rawToken, photoId: rawPhotoId } = await context.params;
  const token = collectionIdSchema.safeParse(rawToken);
  const photoId = collectionIdSchema.safeParse(rawPhotoId);
  if (!token.success || !photoId.success) {
    return new Response("Foto não encontrada.", { status: 404, headers: NO_STORE_HEADERS });
  }

  const admin = createAdminClient();
  const { data: collection, error: collectionError } = await admin
    .from("collections")
    .select("id")
    .eq("public_token", token.data)
    .maybeSingle();
  if (collectionError) {
    return new Response("Não foi possível preparar o download.", { status: 500, headers: NO_STORE_HEADERS });
  }
  if (!collection) {
    return new Response("Foto não encontrada.", { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data: photo, error: photoError } = await admin
    .from("photos")
    .select("id,storage_path,mime_type")
    .eq("id", photoId.data)
    .eq("collection_id", collection.id)
    .maybeSingle();
  if (photoError) {
    return new Response("Não foi possível preparar o download.", { status: 500, headers: NO_STORE_HEADERS });
  }
  if (!photo) {
    return new Response("Foto não encontrada.", { status: 404, headers: NO_STORE_HEADERS });
  }

  const extension = photoExtension(photo.mime_type);
  if (!extension) {
    return new Response("Arquivo indisponível.", { status: 500, headers: NO_STORE_HEADERS });
  }
  const { data, error } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(
    photo.storage_path,
    DOWNLOAD_URL_TTL_SECONDS,
    { download: `foto-${photo.id}.${extension}` },
  );
  if (error || !data) {
    return new Response("Não foi possível preparar o download.", { status: 500, headers: NO_STORE_HEADERS });
  }

  return new Response(null, {
    status: 302,
    headers: { ...NO_STORE_HEADERS, Location: data.signedUrl },
  });
}
