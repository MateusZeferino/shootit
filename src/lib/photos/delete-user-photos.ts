import type { SupabaseClient } from "@supabase/supabase-js";

import { PHOTO_BUCKET } from "@/lib/photos/validation";

const PAGE_SIZE = 100;

export async function deleteUserPhotos(
  storage: SupabaseClient["storage"],
  userId: string,
): Promise<void> {
  const bucket = storage.from(PHOTO_BUCKET);
  const folders = [userId];

  while (folders.length > 0) {
    const folder = folders.pop()!;
    const filePaths: string[] = [];
    let offset = 0;

    // Enumerate before removing: deleting during pagination would skip objects.
    while (true) {
      const { data: entries, error } = await bucket.list(folder, {
        limit: PAGE_SIZE,
        offset,
      });
      if (error || !entries) throw new Error("Não foi possível listar as fotos da conta.");

      for (const entry of entries) {
        if (!entry.name || entry.name === "." || entry.name === ".." || entry.name.includes("/")) {
          throw new Error("Caminho de foto inválido no armazenamento.");
        }

        const path = `${folder}/${entry.name}`;
        if (entry.id == null) folders.push(path);
        else filePaths.push(path);
      }

      if (entries.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    for (let index = 0; index < filePaths.length; index += PAGE_SIZE) {
      const { error } = await bucket.remove(filePaths.slice(index, index + PAGE_SIZE));
      if (error) throw new Error("Não foi possível remover todas as fotos da conta.");
    }
  }
}
