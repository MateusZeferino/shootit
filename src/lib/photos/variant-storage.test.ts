import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { removePhotoObjects, uploadPhotoVariants } from "./variant-storage";

vi.mock("server-only", () => ({}));

function storage() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ upload, remove }));
  return { client: { from } as unknown as SupabaseClient["storage"], upload, remove, from };
}

describe("photo variant storage", () => {
  const original = "user/album/photo.jpg";

  it("uploads private WebP siblings without overwriting files", async () => {
    const { client, upload, from } = storage();
    await uploadPhotoVariants(client, original, {
      thumbnail: Buffer.from("thumb"),
      preview: Buffer.from("preview"),
    });

    expect(from).toHaveBeenCalledWith("photos");
    expect(upload).toHaveBeenNthCalledWith(1, "user/album/photo-thumb.webp", Buffer.from("thumb"), {
      contentType: "image/webp", cacheControl: "3600", upsert: false,
    });
    expect(upload).toHaveBeenNthCalledWith(2, "user/album/photo-preview.webp", Buffer.from("preview"), {
      contentType: "image/webp", cacheControl: "3600", upsert: false,
    });
  });

  it("removes the original and both variants together", async () => {
    const { client, remove } = storage();
    await removePhotoObjects(client, original);
    expect(remove).toHaveBeenCalledWith([
      original,
      "user/album/photo-thumb.webp",
      "user/album/photo-preview.webp",
    ]);
  });
});
