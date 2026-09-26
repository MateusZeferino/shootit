"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type GalleryPhoto = { id: string; signedUrl: string | null };

export function PhotoGallery({ collectionId, photos }: { collectionId: string; photos: GalleryPhoto[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  const visiblePhotos = photos.filter((photo) => !hiddenIds.includes(photo.id));
  const selectedPhoto = visiblePhotos.find((photo) => photo.id === selectedId);

  async function deletePhoto(photoId: string) {
    if (!window.confirm("Excluir esta foto? Esta ação não pode ser desfeita.")) return;
    setError(null);
    setDeletingId(photoId);
    try {
      const response = await fetch(`/api/colecoes/${collectionId}/fotos/${photoId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível excluir a foto.");
      setHiddenIds((current) => [...current, photoId]);
      setSelectedId(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a foto.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Fotos</h2>
        <span className="text-sm text-slate-500">{visiblePhotos.length}</span>
      </div>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {visiblePhotos.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold">Nenhuma foto nesta coleção</p>
          <p className="mt-2 text-slate-600">Selecione imagens acima para começar.</p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo, index) => (
            <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white" key={photo.id}>
              {photo.signedUrl ? (
                <button
                  aria-label={`Ampliar foto ${index + 1}`}
                  className="block aspect-square w-full overflow-hidden bg-stone-100"
                  onClick={() => setSelectedId(photo.id)}
                  type="button"
                >
                  {/* Signed URLs are short-lived and are not cached by the Next image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`Foto ${index + 1} da coleção`} className="h-full w-full object-cover" loading="lazy" src={photo.signedUrl} />
                </button>
              ) : (
                <div className="flex aspect-square items-center justify-center bg-stone-100 p-3 text-center text-sm text-slate-600">
                  Arquivo indisponível
                </div>
              )}
              <div className="p-3">
                <button
                  className="text-sm font-medium text-red-700 disabled:opacity-50"
                  disabled={deletingId !== null}
                  onClick={() => deletePhoto(photo.id)}
                  type="button"
                >
                  {deletingId === photo.id ? "Excluindo..." : "Excluir foto"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {selectedPhoto?.signedUrl && (
        <div aria-label="Visualização ampliada" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog">
          <button ref={closeButtonRef} className="self-end rounded-lg px-4 py-2 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white" onClick={() => setSelectedId(null)} type="button">Fechar</button>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Foto ampliada" className="max-h-full max-w-full object-contain" src={selectedPhoto.signedUrl} />
          </div>
        </div>
      )}
    </section>
  );
}
