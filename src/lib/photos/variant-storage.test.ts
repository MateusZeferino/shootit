import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeObjects, writeObject } from "@/lib/storage/r2";
import { removePhotoObjects, uploadPhotoVariants } from "./variant-storage";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({ removeObjects: vi.fn(), writeObject: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

describe("R2 photo variants", () => {
  it("stores WebP derivatives without modifying the original", async () => {
    await uploadPhotoVariants("user/album/photo.jpg", { thumbnail: Buffer.from("thumb"), preview: Buffer.from("preview") });
    expect(writeObject).toHaveBeenCalledTimes(2);
    expect(writeObject).toHaveBeenCalledWith("user/album/photo-thumb.webp", Buffer.from("thumb"), "image/webp");
    expect(writeObject).toHaveBeenCalledWith("user/album/photo-preview.webp", Buffer.from("preview"), "image/webp");
  });
  it("removes the original and both derivatives", async () => {
    await removePhotoObjects("user/album/photo.jpg");
    expect(removeObjects).toHaveBeenCalledWith(["user/album/photo.jpg", "user/album/photo-thumb.webp", "user/album/photo-preview.webp"]);
  });
  it("propagates partial removal failures instead of allowing the database deletion", async () => {
    vi.mocked(removeObjects).mockRejectedValue(new Error("Partial deletion"));
    await expect(removePhotoObjects("user/album/photo.jpg")).rejects.toThrow("Partial deletion");
  });
});
