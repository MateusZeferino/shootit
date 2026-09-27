import { PUBLIC_PHOTO_PAGE_SIZE, loadPublicPhotoPage } from "@/lib/photos/public-photo-page";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(
  request: Request,
  context: RouteContext<"/g/[publicToken]/fotos">,
) {
  const { publicToken } = await context.params;
  const offsetText = new URL(request.url).searchParams.get("offset");
  if (!offsetText || !/^(0|[1-9]\d*)$/.test(offsetText)) {
    return new Response("Deslocamento inválido.", { status: 400, headers: NO_STORE_HEADERS });
  }

  const offset = Number(offsetText);
  if (!Number.isSafeInteger(offset) || offset % PUBLIC_PHOTO_PAGE_SIZE !== 0) {
    return new Response("Deslocamento inválido.", { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const photoPage = await loadPublicPhotoPage(publicToken, offset);
    if (!photoPage) {
      return new Response("Galeria não encontrada.", { status: 404, headers: NO_STORE_HEADERS });
    }
    return Response.json({ photos: photoPage.photos, hasMore: photoPage.hasMore }, { headers: NO_STORE_HEADERS });
  } catch {
    return new Response("Não foi possível carregar as fotos da galeria.", { status: 500, headers: NO_STORE_HEADERS });
  }
}
