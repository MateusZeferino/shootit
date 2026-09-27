import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PHOTO_BUCKET } from "@/lib/photos/validation";
import { photoVariantPaths } from "@/lib/photos/variant-paths";

export async function uploadPhotoVariants(
  storage: SupabaseClient["storage"],
  originalPath: string,
  variants: { thumbnail: Buffer; preview: Buffer },
) {
  const paths = photoVariantPaths(originalPath);
  const bucket = storage.from(PHOTO_BUCKET);

  for (const variant of ["thumbnail", "preview"] as const) {
    const { error } = await bucket.upload(paths[variant], variants[variant], {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw new Error("Não foi possível salvar a versão otimizada da foto.");
  }
}

export async function removePhotoObjects(storage: SupabaseClient["storage"], originalPath: string) {
  const paths = photoVariantPaths(originalPath);
  return storage.from(PHOTO_BUCKET).remove([originalPath, paths.thumbnail, paths.preview]);
}
