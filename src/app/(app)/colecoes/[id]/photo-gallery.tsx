"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PHOTO_PAGE_SIZE = 24;

export type GalleryPhoto = {
  id: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  originalUrl: string | null;
};

type PhotoPageResponse = { photos: GalleryPhoto[]; hasMore: boolean };

async function fetchPhotoPage(collectionId: string, offset: number): Promise<PhotoPageResponse> {
  const response = await fetch(`/api/colecoes/${encodeURIComponent(collectionId)}/fotos?offset=${offset}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível carregar mais fotos.");
  const page: PhotoPageResponse = await response.json();
  if (!Array.isArray(page.photos) || typeof page.hasMore !== "boolean") {
    throw new Error("Resposta inválida ao carregar as fotos.");
  }
  return page;
}

export function PhotoGallery({
  collectionId,
  photos,
  initialHasMore,
}: {
  collectionId: string;
  photos: GalleryPhoto[];
  initialHasMore: boolean;
}) {
  const router = useRouter();
  const [extraPhotos, setExtraPhotos] = useState<GalleryPhoto[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(PHOTO_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const nextOffsetRef = useRef(PHOTO_PAGE_SIZE);
  const loadingRef = useRef(false);
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
    const loadedPageCount = nextOffsetRef.current / PHOTO_PAGE_SIZE;
    if (loadedPageCount <= 1) return;

    let active = true;
    const offsets = Array.from(
      { length: loadedPageCount - 1 },
      (_, index) => (index + 1) * PHOTO_PAGE_SIZE,
    );
    void Promise.all(offsets.map((offset) => fetchPhotoPage(collectionId, offset)))
      .then((pages) => {
        if (!active || nextOffsetRef.current / PHOTO_PAGE_SIZE !== loadedPageCount) return;
        setExtraPhotos(pages.flatMap((page) => page.photos));
        setHasMore(pages.at(-1)?.hasMore ?? false);
      })
      .catch(() => {
        if (active) setLoadError("Não foi possível atualizar as fotos. Recarregue a página.");
      });
    return () => { active = false; };
  }, [collectionId, photos, initialHasMore]);

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

  const hidden = new Set(hiddenIds);
  const seen = new Set<string>();
  const visiblePhotos = [...photos, ...extraPhotos].filter((photo) => {
    if (hidden.has(photo.id) || seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  });
  const selectedPhoto = visiblePhotos.find((photo) => photo.id === selectedId);
  const canLoadMore = nextOffset === PHOTO_PAGE_SIZE ? initialHasMore : hasMore;

  async function loadMore() {
    if (loadingRef.current || !canLoadMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const offset = nextOffsetRef.current;
      const page = await fetchPhotoPage(collectionId, offset);
      setExtraPhotos((current) => [...current, ...page.photos]);
      nextOffsetRef.current = offset + PHOTO_PAGE_SIZE;
      setNextOffset(nextOffsetRef.current);
      setHasMore(page.hasMore);
    } catch {
      setLoadError("Não foi possível carregar mais fotos. Tente novamente.");
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }

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
        <span className="text-sm text-slate-500">{visiblePhotos.length} carregadas</span>
      </div>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
      {loadError && <p className="mt-3 text-sm text-red-700" role="alert">{loadError}</p>}
      {visiblePhotos.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold">Nenhuma foto neste álbum</p>
          <p className="mt-2 text-slate-600">Selecione imagens acima para começar.</p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo, index) => (
            <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white" key={photo.id}>
              {photo.thumbnailUrl || photo.originalUrl ? (
                <button
                  aria-label={`Ampliar foto ${index + 1}`}
                  className="block aspect-square w-full overflow-hidden bg-stone-100"
                  onClick={() => setSelectedId(photo.id)}
                  type="button"
                >
                  {/* Signed URLs are short-lived and are not cached by the Next image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`Foto ${index + 1} do álbum`}
                    className="h-full w-full object-cover"
                    fetchPriority={index === 0 ? "high" : undefined}
                    loading={index < 4 ? "eager" : "lazy"}
                    onError={(event) => {
                      if (photo.originalUrl && event.currentTarget.src !== photo.originalUrl) {
                        event.currentTarget.src = photo.originalUrl;
                      }
                    }}
                    src={photo.thumbnailUrl ?? photo.originalUrl ?? undefined}
                  />
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
      {canLoadMore && (
        <div className="mt-6 flex justify-center">
          <button
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            disabled={loadingMore}
            onClick={loadMore}
            type="button"
          >
            {loadingMore ? "Carregando fotos..." : "Carregar mais fotos"}
          </button>
        </div>
      )}
      {(selectedPhoto?.previewUrl || selectedPhoto?.originalUrl) && (
        <div aria-label="Visualização ampliada" aria-modal="true" className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog">
          <button ref={closeButtonRef} className="self-end rounded-lg px-4 py-2 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white" onClick={() => setSelectedId(null)} type="button">Fechar</button>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Foto ampliada"
              className="max-h-full max-w-full object-contain"
              onError={(event) => {
                if (selectedPhoto.originalUrl && event.currentTarget.src !== selectedPhoto.originalUrl) {
                  event.currentTarget.src = selectedPhoto.originalUrl;
                }
              }}
              src={selectedPhoto.previewUrl ?? selectedPhoto.originalUrl ?? undefined}
            />
          </div>
        </div>
      )}
    </section>
  );
}
