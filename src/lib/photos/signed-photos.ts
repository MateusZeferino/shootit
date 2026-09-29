import "server-only";

import { signDownload } from "@/lib/storage/r2";
import { photoVariantPaths } from "./variant-paths";
import { PHOTO_URL_TTL_SECONDS } from "./validation";

export async function signGalleryPhotos(photos: { id: string; storage_path: string }[]) {
  return Promise.all(photos.map(async (photo) => {
    const paths = photoVariantPaths(photo.storage_path);
    const [thumbnailUrl, previewUrl] = await Promise.all([
      signDownload(paths.thumbnail, PHOTO_URL_TTL_SECONDS),
      signDownload(paths.preview, PHOTO_URL_TTL_SECONDS),
    ]);
    return { id: photo.id, thumbnailUrl, previewUrl };
  }));
}
