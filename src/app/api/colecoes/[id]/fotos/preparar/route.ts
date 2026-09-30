import { collectionIdSchema } from "@/lib/collections/validation";
import { getPhotoAccess, isCrossOrigin, photoAccessResponse } from "@/lib/photos/access";
import { issueUploadTicket, uploadMetadataSchema, uploadPaths } from "@/lib/photos/upload-ticket";
import { R2ConfigurationError, signUpload } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/colecoes/[id]/fotos/preparar">) {
  if (isCrossOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const { id: rawId } = await context.params;
  const id = collectionIdSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: "Álbum não encontrado." }, { status: 404 });

  let stage: "access" | "ticket" | "sign_url" = "access";
  try {
    const access = await getPhotoAccess(id.data);
    if (access.status !== "ok") return photoAccessResponse(access.status);
    const metadata = uploadMetadataSchema.safeParse(await request.json().catch(() => null));
    if (!metadata.success) {
      return Response.json({ error: "Envie uma imagem JPEG, PNG ou WebP de até 10 MiB." }, { status: 400 });
    }
    stage = "ticket";
    const { data, ticket } = issueUploadTicket(access.userId, id.data, metadata.data);
    stage = "sign_url";
    const uploadUrl = await signUpload(uploadPaths(data).pending, data.size, data.mimeType);
    return Response.json({ ticket, uploadUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("R2_UPLOAD_PREPARE_FAILED", error instanceof R2ConfigurationError
      ? { stage, kind: "invalid_r2_environment", fields: error.fields }
      : { stage, kind: "unexpected" });
    return Response.json({ error: "Não foi possível preparar o envio. Tente novamente." }, { status: 500 });
  }
}
