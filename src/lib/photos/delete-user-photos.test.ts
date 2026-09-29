import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeUserObjects } from "@/lib/storage/r2";
import { deleteUserPhotos } from "./delete-user-photos";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({ removeUserObjects: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

describe("deleteUserPhotos", () => {
  it("cleans all R2 objects for the verified user, including pending uploads", async () => {
    await deleteUserPhotos("user-a");
    expect(removeUserObjects).toHaveBeenCalledWith("user-a");
  });
  it("stops account deletion on a storage failure", async () => {
    vi.mocked(removeUserObjects).mockRejectedValue(new Error("R2 unavailable"));
    await expect(deleteUserPhotos("user-a")).rejects.toThrow("R2 unavailable");
  });
});
