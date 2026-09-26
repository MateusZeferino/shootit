import { revalidatePath } from "next/cache";

import { collectionIdSchema } from "@/lib/collections/validation";
import { getPhotoAccess, isCrossOrigin, photoAccessResponse } from "@/lib/photos/access";
import { PHOTO_BUCKET } from "@/lib/photos/validation";

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/colecoes/[id]/fotos/[photoId]">,
) {
  if (isCrossOrigin(request)) {
    return Response.json({ error: "Origem não permitida." }, { status: 403 });
  }
  const { id: rawId, photoId: rawPhotoId } = await context.params;
  const id = collectionIdSchema.safeParse(rawId);
  const photoId = collectionIdSchema.safeParse(rawPhotoId);
  if (!id.success || !photoId.success) {
    return Response.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const access = await getPhotoAccess(id.data);
  if (access.status !== "ok") return photoAccessResponse(access.status);

  const { data: photo, error: readError } = await access.supabase
    .from("photos")
    .select("id,storage_path")
    .eq("id", photoId.data)
    .eq("collection_id", id.data)
    .maybeSingle();
  if (readError) return Response.json({ error: "Não foi possível localizar a foto." }, { status: 500 });
  if (!photo) return Response.json({ error: "Foto não encontrada." }, { status: 404 });

  const { error: storageError } = await access.supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (storageError) {
    return Response.json({ error: "Não foi possível excluir o arquivo. Tente novamente." }, { status: 500 });
  }

  const { data: deleted, error: deleteError } = await access.supabase
    .from("photos")
    .delete()
    .eq("id", photoId.data)
    .eq("collection_id", id.data)
    .select("id")
    .maybeSingle();
  if (deleteError || !deleted) {
    return Response.json({ error: "Arquivo removido, mas o registro não pôde ser excluído. Tente novamente." }, { status: 500 });
  }

  revalidatePath(`/colecoes/${id.data}`);
  return Response.json({ success: true });
}
