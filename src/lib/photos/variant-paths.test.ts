import { describe, expect, it } from "vitest";

import { photoVariantPaths } from "./variant-paths";

describe("photo variant paths", () => {
  it("keeps variants next to the original photo", () => {
    expect(photoVariantPaths("user/album/photo.jpg")).toEqual({
      thumbnail: "user/album/photo-thumb.webp",
      preview: "user/album/photo-preview.webp",
    });
  });

  it("rejects paths without a supported image extension", () => {
    expect(() => photoVariantPaths("user/album/photo.svg")).toThrow("Caminho de foto inválido.");
  });
});
