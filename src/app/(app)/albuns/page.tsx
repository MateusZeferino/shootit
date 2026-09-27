import type { Metadata } from "next";

import { AlbumSearch } from "@/app/(app)/albuns/album-search";
import { AppHeader } from "@/app/(app)/app-header";
import type { AlbumSummary } from "@/app/(app)/album-card";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Todos os álbuns",
};

export default async function AlbumsPage() {
  const { supabase, userId } = await requireUser();
  const albums: AlbumSummary[] = [];
  const pageSize = 200;

  while (true) {
    const { data, error } = await supabase
      .from("collections")
      .select("id,name,public_token")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(albums.length, albums.length + pageSize - 1);

    if (error || !data) throw new Error("Não foi possível carregar seus álbuns.");
    albums.push(...data);
    if (data.length < pageSize) break;
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-6 sm:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <AppHeader showBack />
        <section className="py-8">
          <AlbumSearch albums={albums} />
        </section>
      </div>
    </main>
  );
}
