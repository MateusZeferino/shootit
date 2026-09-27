import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/app/(app)/app-header";
import { CollectionForm } from "@/app/(app)/collection-form";
import { DeleteCollectionForm } from "@/app/(app)/delete-collection-form";
import { CopyGalleryLink } from "@/app/(app)/copy-gallery-link";
import { PhotoGallery, type GalleryPhoto } from "@/app/(app)/colecoes/[id]/photo-gallery";
import { PhotoUpload } from "@/app/(app)/colecoes/[id]/photo-upload";
import { requireUser } from "@/lib/auth/user";
import { collectionIdSchema } from "@/lib/collections/validation";
import { PHOTO_BUCKET, PHOTO_URL_TTL_SECONDS } from "@/lib/photos/validation";

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
    .select("id,name,public_token")
    .eq("id", parsedId.data)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar o álbum.");
  if (!collection) notFound();

  const photos: GalleryPhoto[] = [];
  let offset = 0;
  while (true) {
    const { data: batch, error: photosError } = await supabase
      .from("photos")
      .select("id,storage_path")
      .eq("collection_id", collection.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 99);
    if (photosError || !batch) throw new Error("Não foi possível carregar as fotos.");
    if (batch.length > 0) {
      const { data: signed, error: signedError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(batch.map((photo) => photo.storage_path), PHOTO_URL_TTL_SECONDS);
      if (signedError || !signed) {
        throw new Error("Não foi possível preparar a visualização das fotos.");
      }
      photos.push(...batch.map((photo, index) => ({
        id: photo.id,
        signedUrl: signed[index]?.signedUrl ?? null,
      })));
    }
    if (batch.length < 100) break;
    offset += 100;
  }

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
              <h2 className="text-xl font-semibold">Compartilhamento</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Qualquer pessoa com este link pode visualizar a galeria, sem fazer login.
              </p>
              <div className="mt-4"><CopyGalleryLink publicToken={collection.public_token} /></div>
            </section>
          </div>

          <PhotoUpload collectionId={collection.id} />
          <PhotoGallery collectionId={collection.id} photos={photos} />

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
