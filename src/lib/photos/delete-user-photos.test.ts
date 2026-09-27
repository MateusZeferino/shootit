import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { deleteUserPhotos } from "@/lib/photos/delete-user-photos";

function storageWith(
  entriesByFolder: Record<string, { name: string; id: string | null }[]>,
  removeError = false,
) {
  const list = vi.fn(async (folder: string, options: { offset: number; limit: number }) => ({
    data: entriesByFolder[folder]?.slice(options.offset, options.offset + options.limit) ?? [],
    error: null,
  }));
  const remove = vi.fn(async (paths: string[]) => ({
    data: paths,
    error: removeError ? new Error("Storage unavailable") : null,
  }));
  const storage = { from: vi.fn(() => ({ list, remove })) } as unknown as SupabaseClient["storage"];
  return { storage, list, remove };
}

describe("deleteUserPhotos", () => {
  it("removes every file across folders and paginated listings", async () => {
    const userId = "user-a";
    const photos = Array.from({ length: 101 }, (_, index) => ({
      name: `${index}.png`, id: `${index}`,
    }));
    const { storage, list, remove } = storageWith({
      [userId]: [
        { name: "album-a", id: null },
        { name: "album-b", id: null },
      ],
      [`${userId}/album-a`]: photos,
      [`${userId}/album-b`]: [{ name: "orphan.png", id: "orphan" }],
    });

    await deleteUserPhotos(storage, userId);

    expect(list).toHaveBeenCalledWith(`${userId}/album-a`, { limit: 100, offset: 100 });
    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls.flatMap(([paths]) => paths)).toHaveLength(102);
    expect(remove.mock.calls.flatMap(([paths]) => paths)).toContain(`${userId}/album-b/orphan.png`);
  });

  it("stops when Storage cannot remove files", async () => {
    const { storage } = storageWith({ "user-a": [{ name: "photo.png", id: "photo" }] }, true);
    await expect(deleteUserPhotos(storage, "user-a")).rejects.toThrow(
      "Não foi possível remover todas as fotos da conta.",
    );
  });

  it("rejects an unexpected path before deleting", async () => {
    const { storage, remove } = storageWith({ "user-a": [{ name: "../user-b", id: null }] });
    await expect(deleteUserPhotos(storage, "user-a")).rejects.toThrow(
      "Caminho de foto inválido no armazenamento.",
    );
    expect(remove).not.toHaveBeenCalled();
  });
});
