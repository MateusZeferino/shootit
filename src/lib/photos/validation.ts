export const PHOTO_BUCKET = "photos";
export const SIMPLE_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_URL_TTL_SECONDS = 5 * 60;

const imageTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PhotoMimeType = keyof typeof imageTypes;

export function photoExtension(mimeType: string): string | null {
  return imageTypes[mimeType as PhotoMimeType] ?? null;
}

export function validatePhotoFile(file: Pick<File, "size" | "type">): string | null {
  if (!photoExtension(file.type)) return "Use apenas imagens JPEG, PNG ou WebP.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_PHOTO_BYTES) return "A imagem deve ter no máximo 10 MiB.";
  return null;
}

export function detectImageMimeType(bytes: Uint8Array): PhotoMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    [82, 73, 70, 70].every((byte, index) => bytes[index] === byte) &&
    [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte)
  ) {
    return "image/webp";
  }
  return null;
}
