import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { createImageVariants, InvalidPhotoError } from "./image-variants";

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#6b8fb0" },
  })
    .jpeg()
    .toBuffer();
}

describe("createImageVariants", () => {
  it("creates bounded WebP variants without enlarging the original", async () => {
    const { thumbnail, preview } = await createImageVariants(await jpeg(2400, 1200));
    const thumbnailMetadata = await sharp(thumbnail).metadata();
    const previewMetadata = await sharp(preview).metadata();

    expect(Buffer.isBuffer(thumbnail)).toBe(true);
    expect(Buffer.isBuffer(preview)).toBe(true);
    expect(thumbnailMetadata).toMatchObject({ format: "webp", width: 640, height: 320 });
    expect(previewMetadata).toMatchObject({ format: "webp", width: 1600, height: 800 });

    const small = await createImageVariants(await jpeg(200, 100));
    expect(await sharp(small.thumbnail).metadata()).toMatchObject({ width: 200, height: 100 });
    expect(await sharp(small.preview).metadata()).toMatchObject({ width: 200, height: 100 });
  });

  it("applies EXIF orientation and strips metadata from the variants", async () => {
    const oriented = await sharp({
      create: { width: 300, height: 100, channels: 3, background: "#6b8fb0" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    expect((await sharp(oriented).metadata()).orientation).toBe(6);

    const { thumbnail, preview } = await createImageVariants(oriented);
    for (const output of [thumbnail, preview]) {
      expect(await sharp(output).metadata()).toMatchObject({
        format: "webp",
        width: 100,
        height: 300,
      });
      expect((await sharp(output).metadata()).orientation).toBeUndefined();
    }
  });

  it("rejects unsupported or corrupted images", async () => {
    await expect(createImageVariants(Buffer.from("<svg></svg>"))).rejects.toBeInstanceOf(InvalidPhotoError);
    await expect(createImageVariants(Buffer.from([0xff, 0xd8, 0xff]))).rejects.toBeInstanceOf(InvalidPhotoError);
  });

  it("accepts a valid PNG with and without trailing TUS padding", async () => {
    const tinyPng = await sharp({
      create: { width: 1, height: 1, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const largePng = Buffer.concat([tinyPng, Buffer.alloc(4 * 1024 * 1024 + 1)]);

    for (const input of [tinyPng, largePng]) {
      const variants = await createImageVariants(input);
      expect(await sharp(variants.thumbnail).metadata()).toMatchObject({ format: "webp", width: 1, height: 1 });
      expect(await sharp(variants.preview).metadata()).toMatchObject({ format: "webp", width: 1, height: 1 });
    }
  });

  it("accepts WebP input", async () => {
    const input = await sharp({
      create: { width: 800, height: 400, channels: 3, background: "#6b8fb0" },
    })
      .webp()
      .toBuffer();

    const { thumbnail, preview } = await createImageVariants(input);
    expect(await sharp(thumbnail).metadata()).toMatchObject({ format: "webp", width: 640, height: 320 });
    expect(await sharp(preview).metadata()).toMatchObject({ format: "webp", width: 800, height: 400 });
  });

  it("rejects images whose declared dimensions exceed 50 megapixels", async () => {
    const oversized = Buffer.from(await jpeg(100, 100));
    const frameMarker = oversized.indexOf(Buffer.from([0xff, 0xc0]));
    expect(frameMarker).toBeGreaterThanOrEqual(0);
    oversized.writeUInt16BE(7000, frameMarker + 5);
    oversized.writeUInt16BE(8000, frameMarker + 7);

    await expect(createImageVariants(oversized)).rejects.toBeInstanceOf(InvalidPhotoError);
  });
});
