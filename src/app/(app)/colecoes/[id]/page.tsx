import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/app/(app)/app-header";
import { AlbumStatusForm } from "@/app/(app)/album-status-form";
import { CollectionForm } from "@/app/(app)/collection-form";
import { DeleteCollectionForm } from "@/app/(app)/delete-collection-form";
import { CopyGalleryLink } from "@/app/(app)/copy-gallery-link";
import { PhotoGallery } from "@/app/(app)/colecoes/[id]/photo-gallery";
import { PhotoUpload } from "@/app/(app)/colecoes/[id]/photo-upload";
import { requireUser } from "@/lib/auth/user";
import { collectionIdSchema } from "@/lib/collections/validation";
import { signGalleryPhotos } from "@/lib/photos/signed-photos";

const PHOTO_PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "Álbum",
};

export default async function CollectionPage({ params }: PageProps<"/colecoes/[id]">) {
  const { id: rawId } = await params;
  const parsedId = collectionIdSchema.safeParse(rawId);
  if (!parsedId.success) notFound();

  const { supabase, userId } = await requireUser();
  const { data: collection, error } = await supabase
    .from("collections")
    .select("id,name,public_token,is_active")
    .eq("id", parsedId.data)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar o álbum.");
  if (!collection) notFound();

  const { data: batch, error: photosError } = await supabase
    .from("photos")
    .select("id,storage_path")
    .eq("collection_id", collection.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, PHOTO_PAGE_SIZE);
  if (photosError || !batch) throw new Error("Não foi possível carregar as fotos.");

  const firstPage = batch.slice(0, PHOTO_PAGE_SIZE);
  const photos = await signGalleryPhotos(firstPage);

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-6 sm:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <AppHeader />
        <div className="py-10">
          <Link className="text-sm font-medium text-slate-600 underline hover:text-slate-950" href="/albuns">
            ← Voltar aos álbuns
          </Link>
          <p className="mt-8 text-sm font-medium text-slate-500">Álbum</p>
          <h1 className="mt-2 break-words text-4xl font-semibold tracking-tight">
            {collection.name}
          </h1>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Renomear álbum</h2>
              <div className="mt-5">
                <CollectionForm
                  collectionId={collection.id}
                  initialName={collection.name}
                  mode="rename"
                />
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Compartilhamento</h2>
                <span className={collection.is_active
                  ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"}
                >
                  {collection.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
              {collection.is_active ? (
                <>
                  <p className="mt-3 leading-7 text-slate-600">
                    Qualquer pessoa com este link pode visualizar a galeria, sem fazer login.
                  </p>
                  <div className="mt-4"><CopyGalleryLink publicToken={collection.public_token} /></div>
                </>
              ) : (
                <p className="mt-3 leading-7 text-slate-600">
                  O álbum continua disponível para você, mas o compartilhamento público está desativado.
                </p>
              )}
              <div className="mt-5">
                <AlbumStatusForm collectionId={collection.id} isActive={collection.is_active} />
              </div>
            </section>
          </div>

          <PhotoUpload collectionId={collection.id} />
          <PhotoGallery collectionId={collection.id} initialHasMore={batch.length > PHOTO_PAGE_SIZE} key={collection.id} photos={photos} />

          <section className="mt-6 rounded-3xl border border-red-100 bg-white p-6">
            <h2 className="text-lg font-semibold">Excluir álbum</h2>
            <p className="mt-2 mb-5 text-sm text-slate-600">
              O álbum e todas as suas fotos serão removidos. Esta ação não pode ser desfeita.
            </p>
            <DeleteCollectionForm id={collection.id} name={collection.name} />
          </section>
        </div>
      </div>
    </main>
  );
}
