import { collectionIdSchema } from "@/lib/collections/validation";
import { getPhotoAccess, isCrossOrigin, photoAccessResponse } from "@/lib/photos/access";
import { SIMPLE_UPLOAD_MAX_BYTES, photoExtension, validatePhotoFile } from "@/lib/photos/validation";

export async function POST(
  request: Request,
  context: RouteContext<"/api/colecoes/[id]/fotos/preparar">,
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
  const { size, mimeType } = body as { size?: unknown; mimeType?: unknown };
  if (typeof size !== "number" || !Number.isSafeInteger(size) || typeof mimeType !== "string") {
    return Response.json({ error: "Dados de upload inválidos." }, { status: 400 });
  }
  const error = validatePhotoFile({ size, type: mimeType });
  if (error) return Response.json({ error }, { status: 400 });
  if (size <= SIMPLE_UPLOAD_MAX_BYTES) {
    return Response.json({ error: "Use o envio simples para imagens de até 4 MiB." }, { status: 400 });
  }

  const photoId = crypto.randomUUID();
  const storagePath = `${access.userId}/${id.data}/${photoId}.${photoExtension(mimeType)}`;
  return Response.json({ photoId, storagePath });
}
