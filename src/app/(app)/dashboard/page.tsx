import type { Metadata } from "next";

import { AlbumCard } from "@/app/(app)/album-card";
import { AppHeader } from "@/app/(app)/app-header";
import { CreateAlbumActions } from "@/app/(app)/create-album-actions";
import { DeleteAccountForm } from "@/app/(app)/delete-account-form";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Seus álbuns",
};

export default async function DashboardPage() {
  const { supabase, userId } = await requireUser();
  const [profileResult, albumsResult] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", userId).single(),
    supabase
      .from("collections")
      .select("id,name,public_token")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(3),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("Não foi possível carregar seu perfil.");
  }
  if (albumsResult.error || !albumsResult.data) {
    throw new Error("Não foi possível carregar seus álbuns.");
  }

  const albums = albumsResult.data;

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-6 sm:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <AppHeader />
        <section className="py-12">
          <h1 className="text-4xl font-semibold tracking-tight">Seus álbuns</h1>
          <p className="mt-3 text-sm font-medium text-slate-500">
            Seja bem-vindo, {profileResult.data.name}
          </p>

          {albums.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h2 className="text-xl font-semibold">Seu primeiro álbum começa aqui</h2>
              <p className="mx-auto mt-2 max-w-lg leading-7 text-slate-600">
                Use o botão abaixo para criar seu primeiro álbum.
              </p>
            </div>
          ) : (
            <section className="mt-10" aria-label="Álbuns recentes">
              <h2 className="text-xl font-semibold">Álbuns recentes</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {albums.map((album) => <AlbumCard album={album} key={album.id} />)}
              </div>
            </section>
          )}

          <CreateAlbumActions />
        </section>
        <DeleteAccountForm />
      </div>
    </main>
  );
}
