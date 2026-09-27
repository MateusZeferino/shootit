import sharp, { type Metadata } from "sharp";

import { detectImageMimeType } from "./validation";

const MAX_INPUT_PIXELS = 50_000_000;

const inputOptions = {
  failOn: "warning" as const,
  limitInputPixels: MAX_INPUT_PIXELS,
};

export class InvalidPhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPhotoError";
  }
}

async function renderWebp(input: Buffer, maxDimension: number, quality: number): Promise<Buffer> {
  return sharp(input, inputOptions)
    .autoOrient()
    .resize(maxDimension, maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();
}

export async function createImageVariants(
  input: Buffer,
): Promise<{ thumbnail: Buffer; preview: Buffer }> {
  const mimeType = Buffer.isBuffer(input) ? detectImageMimeType(input) : null;
  if (!mimeType) throw new InvalidPhotoError("Use apenas imagens JPEG, PNG ou WebP válidas.");

  let metadata: Metadata;
  try {
    metadata = await sharp(input, inputOptions).metadata();
  } catch {
    throw new InvalidPhotoError("A imagem está inválida ou corrompida.");
  }

  const expectedFormat = mimeType === "image/jpeg" ? "jpeg" : mimeType.slice("image/".length);
  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new InvalidPhotoError("A imagem precisa ser JPEG, PNG ou WebP estático e válido.");
  }
  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw new InvalidPhotoError("A imagem excede o limite de 50 megapixels.");
  }

  try {
    // Process sequentially to avoid decoding a large photo twice at the same time.
    const thumbnail = await renderWebp(input, 640, 72);
    const preview = await renderWebp(input, 1600, 80);
    return { thumbnail, preview };
  } catch {
    throw new InvalidPhotoError("A imagem está inválida ou corrompida.");
  }
}
