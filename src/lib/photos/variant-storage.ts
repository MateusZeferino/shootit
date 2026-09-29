import "server-only";

import { removeObjects, writeObject } from "@/lib/storage/r2";
import { photoVariantPaths } from "./variant-paths";

export async function uploadPhotoVariants(originalPath: string, variants: { thumbnail: Buffer; preview: Buffer }) {
  const paths = photoVariantPaths(originalPath);
  // Deterministic derivatives of the immutable original can be retried safely.
  await writeObject(paths.thumbnail, variants.thumbnail, "image/webp");
  await writeObject(paths.preview, variants.preview, "image/webp");
}

export async function removePhotoObjects(originalPath: string) {
  const paths = photoVariantPaths(originalPath);
  await removeObjects([originalPath, paths.thumbnail, paths.preview]);
}
