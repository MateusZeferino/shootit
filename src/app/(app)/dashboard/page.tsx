import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/app/(app)/app-header";
import { CollectionForm } from "@/app/(app)/collection-form";
import { CopyGalleryLink } from "@/app/(app)/copy-gallery-link";
import { requireUser } from "@/lib/auth/user";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { supabase, userId } = await requireUser();
  const [profileResult, collectionsResult] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", userId).single(),
    supabase
      .from("collections")
      .select("id,name,public_token,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("Não foi possível carregar seu perfil.");
  }
  if (collectionsResult.error || !collectionsResult.data) {
    throw new Error("Não foi possível carregar suas coleções.");
  }

  const collections = collectionsResult.data;

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-6 sm:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <AppHeader />
        <section className="py-12">
          <p className="text-sm font-medium text-slate-500">Olá, {profileResult.data.name}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Suas coleções</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Organize cada ensaio em uma coleção e compartilhe a galeria por link.
          </p>

          <div className="mt-9 max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-semibold">Nova coleção</h2>
            <CollectionForm mode="create" />
          </div>

          {collections.length === 0 ? (
            <div className="mt-9 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h2 className="text-xl font-semibold">Sua primeira coleção começa aqui</h2>
              <p className="mx-auto mt-2 max-w-lg leading-7 text-slate-600">
                Dê um nome ao ensaio no formulário acima para criar sua primeira coleção.
              </p>
            </div>
          ) : (
            <section className="mt-10" aria-label="Coleções cadastradas">
              <h2 className="text-xl font-semibold">Coleções cadastradas</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {collections.map((collection) => (
                  <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" key={collection.id}>
                    <h3 className="text-xl font-semibold break-words">{collection.name}</h3>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Galeria pública
                    </p>
                    <div className="mt-2"><CopyGalleryLink publicToken={collection.public_token} /></div>
                    <Link
                      className="mt-6 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      href={`/colecoes/${collection.id}`}
                    >
                      Abrir coleção
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
