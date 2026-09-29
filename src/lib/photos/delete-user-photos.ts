import "server-only";

import { removeUserObjects } from "@/lib/storage/r2";

export async function deleteUserPhotos(userId: string): Promise<void> {
  await removeUserObjects(userId);
}
