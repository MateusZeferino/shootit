import { revalidatePath } from "next/cache";

import { collectionIdSchema } from "@/lib/collections/validation";
import { getPhotoAccess, isCrossOrigin, photoAccessResponse } from "@/lib/photos/access";
import { createImageVariants, InvalidPhotoError } from "@/lib/photos/image-variants";
import { uploadPaths, verifyUploadTicket } from "@/lib/photos/upload-ticket";
import { detectImageMimeType, MAX_PHOTO_BYTES } from "@/lib/photos/validation";
import { uploadPhotoVariants } from "@/lib/photos/variant-storage";
import { isExistingObject, isMissingObject, readObject, removeObjects, writeObject } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

async function discardPending(path: string) {
  try { await removeObjects([path]); }
  catch { console.error("R2_PENDING_CLEANUP_FAILED"); }
}

export async function POST(request: Request, context: RouteContext<"/api/colecoes/[id]/fotos/finalizar">) {
  if (isCrossOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const { id: rawId } = await context.params;
  const id = collectionIdSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: "Álbum não encontrado." }, { status: 404 });

  try {
    const access = await getPhotoAccess(id.data);
    if (access.status !== "ok") return photoAccessResponse(access.status);
    const body = await request.json().catch(() => null);
    const ticket = verifyUploadTicket(body?.ticket, access.userId, id.data);
    if (!ticket) return Response.json({ error: "Envio inválido ou expirado. Envie a foto novamente." }, { status: 400 });
    const paths = uploadPaths(ticket);

    const existing = await access.supabase.from("photos").select("id,storage_path")
      .eq("id", ticket.photoId).eq("collection_id", id.data).maybeSingle();
    if (existing.error) throw new Error("Photo lookup failed");
    if (existing.data) {
      if (existing.data.storage_path !== paths.original) {
        return Response.json({ error: "Foto já registrada." }, { status: 409 });
      }
      await discardPending(paths.pending);
      return Response.json({ id: ticket.photoId });
    }

    // An interrupted finalization can resume from the immutable original.
    let originalExists = true;
    let object;
    try { object = await readObject(paths.original, MAX_PHOTO_BYTES); }
    catch (error) {
      if (!isMissingObject(error)) throw error;
      originalExists = false;
      try { object = await readObject(paths.pending, MAX_PHOTO_BYTES); }
      catch (error) {
        if (!isMissingObject(error)) throw error;
        return Response.json({ error: "Arquivo ainda não disponível. Tente novamente." }, { status: 409 });
      }
    }

    if (object.body.length !== ticket.size || object.contentType !== ticket.mimeType ||
        detectImageMimeType(object.body) !== ticket.mimeType) {
      await discardPending(paths.pending);
      return Response.json({ error: "O conteúdo do arquivo não corresponde ao formato ou tamanho informado." }, { status: 400 });
    }

    let variants;
    try { variants = await createImageVariants(object.body); }
    catch (error) {
      if (!(error instanceof InvalidPhotoError)) throw error;
      await discardPending(paths.pending);
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (!originalExists) {
      try { await writeObject(paths.original, object.body, ticket.mimeType, true); }
      catch (error) {
        if (!isExistingObject(error)) throw error;
        // Retry against the winning finalizer's immutable bytes, not a changed staging upload.
        return Response.json({ error: "Foto em processamento. Tente novamente." }, { status: 409 });
      }
    }
    await uploadPhotoVariants(paths.original, variants);
    const inserted = await access.supabase.from("photos").insert({
      id: ticket.photoId, collection_id: id.data, storage_path: paths.original,
      mime_type: ticket.mimeType, file_size_bytes: ticket.size,
    });
    if (inserted.error) {
      // A retry or concurrent request may have committed the row already.
      const committed = await access.supabase.from("photos").select("id,storage_path")
        .eq("id", ticket.photoId).eq("collection_id", id.data).maybeSingle();
      if (committed.error || committed.data?.storage_path !== paths.original) throw new Error("Photo insert failed");
    }
    await discardPending(paths.pending);
    revalidatePath(`/colecoes/${id.data}`);
    return Response.json({ id: ticket.photoId }, { status: 201 });
  } catch {
    // Keep validated objects on transient failures so finalization can safely retry.
    console.error("R2_UPLOAD_FINALIZE_FAILED");
    return Response.json({ error: "Não foi possível concluir o envio. Tente novamente." }, { status: 500 });
  }
}
