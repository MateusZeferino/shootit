import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPhotoGallery, type PublicPhoto } from "@/app/g/[publicToken]/public-photo-gallery";
import { collectionIdSchema } from "@/lib/collections/validation";
import { PHOTO_BUCKET, PHOTO_URL_TTL_SECONDS } from "@/lib/photos/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Galeria compartilhada",
  robots: { index: false, follow: false },
};

export default async function PublicGalleryPage({ params }: PageProps<"/g/[publicToken]">) {
  const { publicToken } = await params;
  const token = collectionIdSchema.safeParse(publicToken);
  if (!token.success) notFound();

  const admin = createAdminClient();
  const { data: collection, error: collectionError } = await admin
    .from("collections")
    .select("id,name")
    .eq("public_token", token.data)
    .maybeSingle();
  if (collectionError) throw new Error("Não foi possível carregar a galeria.");
  if (!collection) notFound();

  const photos: PublicPhoto[] = [];
  let offset = 0;
  while (true) {
    const { data: batch, error: photosError } = await admin
      .from("photos")
      .select("id,storage_path")
      .eq("collection_id", collection.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 99);
    if (photosError || !batch) throw new Error("Não foi possível carregar as fotos da galeria.");

    if (batch.length > 0) {
      const { data: signed, error: signedError } = await admin.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(batch.map((photo) => photo.storage_path), PHOTO_URL_TTL_SECONDS);
      if (signedError || !signed) throw new Error("Não foi possível preparar as fotos da galeria.");
      photos.push(...batch.map((photo, index) => ({
        id: photo.id,
        signedUrl: signed[index]?.signedUrl ?? null,
      })));
    }

    if (batch.length < 100) break;
    offset += 100;
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">Galeria compartilhada</p>
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {collection.name}
          </h1>
        </header>
        <PublicPhotoGallery collectionName={collection.name} photos={photos} />
      </div>
    </main>
  );
}
