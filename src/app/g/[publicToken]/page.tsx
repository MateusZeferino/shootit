import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPhotoGallery } from "@/app/g/[publicToken]/public-photo-gallery";
import { loadPublicPhotoPage } from "@/lib/photos/public-photo-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Galeria compartilhada",
  robots: { index: false, follow: false },
};

export default async function PublicGalleryPage({ params }: PageProps<"/g/[publicToken]">) {
  const { publicToken } = await params;
  const photoPage = await loadPublicPhotoPage(publicToken, 0);
  if (!photoPage) notFound();

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">Galeria compartilhada</p>
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {photoPage.collectionName}
          </h1>
        </header>
        <PublicPhotoGallery
          collectionName={photoPage.collectionName}
          publicToken={publicToken}
          photos={photoPage.photos}
          initialHasMore={photoPage.hasMore}
        />
      </div>
    </main>
  );
}
