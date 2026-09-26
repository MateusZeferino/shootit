"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PublicPhoto = { id: string; signedUrl: string | null };

export function PublicPhotoGallery({
  collectionName,
  photos,
}: {
  collectionName: string;
  photos: PublicPhoto[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (photos.length === 0) return;
    const timer = window.setInterval(() => router.refresh(), 4 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [photos.length, router]);

  useEffect(() => {
    if (!selectedId) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    function handleModalKeys(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleModalKeys);
    return () => {
      window.removeEventListener("keydown", handleModalKeys);
      previousFocus?.focus();
    };
  }, [selectedId]);

  const selectedPhoto = photos.find((photo) => photo.id === selectedId);

  if (photos.length === 0) {
    return (
      <section className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <h2 className="text-xl font-semibold">Esta galeria ainda não tem fotos</h2>
        <p className="mt-2 text-slate-600">Volte mais tarde para ver as imagens.</p>
      </section>
    );
  }

  return (
    <section aria-label="Fotos da galeria" className="mt-8">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li className="overflow-hidden rounded-2xl bg-white shadow-sm" key={photo.id}>
            {photo.signedUrl ? (
              <button
                aria-label={`Ampliar foto ${index + 1}`}
                className="block aspect-square w-full overflow-hidden bg-stone-100"
                onClick={() => setSelectedId(photo.id)}
                type="button"
              >
                {/* Signed URLs are short-lived and should not be cached by the Next image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`Foto ${index + 1} de ${collectionName}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={photo.signedUrl}
                />
              </button>
            ) : (
              <div className="flex aspect-square items-center justify-center bg-stone-100 p-3 text-center text-sm text-slate-600">
                Arquivo indisponível
              </div>
            )}
          </li>
        ))}
      </ul>
      {selectedPhoto?.signedUrl && (
        <div
          aria-label="Visualização ampliada"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          role="dialog"
        >
          <button
            ref={closeButtonRef}
            className="self-end rounded-lg px-4 py-2 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            onClick={() => setSelectedId(null)}
            type="button"
          >
            Fechar
          </button>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`Foto ampliada de ${collectionName}`} className="max-h-full max-w-full object-contain" src={selectedPhoto.signedUrl} />
          </div>
        </div>
      )}
    </section>
  );
}
