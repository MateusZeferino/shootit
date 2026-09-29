import { collectionIdSchema } from "@/lib/collections/validation";
import { getPhotoAccess, photoAccessResponse } from "@/lib/photos/access";
import { signGalleryPhotos } from "@/lib/photos/signed-photos";

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
    const photos = await signGalleryPhotos(visiblePhotos);
    return Response.json({ photos, hasMore: batch.length > PHOTO_PAGE_SIZE }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "Não foi possível carregar as fotos." }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
