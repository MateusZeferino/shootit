import "server-only";

import type { PublicPhoto } from "@/app/g/[publicToken]/public-photo-gallery";
import { collectionIdSchema } from "@/lib/collections/validation";
import { photoVariantPaths } from "@/lib/photos/variant-paths";
import { PHOTO_BUCKET, PHOTO_URL_TTL_SECONDS } from "@/lib/photos/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const PUBLIC_PHOTO_PAGE_SIZE = 24;

export type PublicPhotoPage = {
  collectionName: string;
  photos: PublicPhoto[];
  hasMore: boolean;
};

export async function loadPublicPhotoPage(publicToken: string, offset: number): Promise<PublicPhotoPage | null> {
  const token = collectionIdSchema.safeParse(publicToken);
  if (!token.success || !Number.isSafeInteger(offset) || offset < 0) return null;

  const admin = createAdminClient();
  const { data: collection, error: collectionError } = await admin
    .from("collections")
    .select("id,name")
    .eq("public_token", token.data)
    .maybeSingle();
  if (collectionError) throw new Error("Não foi possível carregar a galeria.");
  if (!collection) return null;

  const { data: batch, error: photosError } = await admin
    .from("photos")
    .select("id,storage_path")
    .eq("collection_id", collection.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PUBLIC_PHOTO_PAGE_SIZE);
  if (photosError || !batch) throw new Error("Não foi possível carregar as fotos da galeria.");

  const visiblePhotos = batch.slice(0, PUBLIC_PHOTO_PAGE_SIZE);
  if (visiblePhotos.length === 0) {
    return { collectionName: collection.name, photos: [], hasMore: false };
  }

  const paths = visiblePhotos.flatMap(({ storage_path }) => {
    const { thumbnail, preview } = photoVariantPaths(storage_path);
    return [thumbnail, preview, storage_path];
  });
  const { data: signed, error: signedError } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
  if (signedError || !signed || signed.length !== paths.length) {
    throw new Error("Não foi possível preparar as fotos da galeria.");
  }

  const signedUrls = new Map(signed.map((item) => [
    item.path,
    item.error ? null : item.signedUrl,
  ]));
  const photos: PublicPhoto[] = visiblePhotos.map((photo) => {
    const { thumbnail, preview } = photoVariantPaths(photo.storage_path);
    return {
      id: photo.id,
      thumbnailUrl: signedUrls.get(thumbnail) ?? null,
      previewUrl: signedUrls.get(preview) ?? null,
      originalUrl: signedUrls.get(photo.storage_path) ?? null,
    };
  });

  return { collectionName: collection.name, photos, hasMore: batch.length > PUBLIC_PHOTO_PAGE_SIZE };
}
