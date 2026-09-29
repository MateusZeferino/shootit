"use client";

import { useEffect, useRef, useState } from "react";

const PUBLIC_PHOTO_PAGE_SIZE = 24;

export type PublicPhoto = {
  id: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
};

type PhotoPageResponse = { photos: PublicPhoto[]; hasMore: boolean };

async function fetchPhotoPage(publicToken: string, offset: number): Promise<PhotoPageResponse> {
  const response = await fetch(`/g/${encodeURIComponent(publicToken)}/fotos?offset=${offset}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível carregar mais fotos.");

  const page: PhotoPageResponse = await response.json();
  if (!Array.isArray(page.photos) || typeof page.hasMore !== "boolean") {
    throw new Error("Resposta inválida ao carregar as fotos.");
  }
  return page;
}

export function PublicPhotoGallery({
  collectionName,
  publicToken,
  photos,
  initialHasMore,
}: {
  collectionName: string;
  publicToken: string;
  photos: PublicPhoto[];
  initialHasMore: boolean;
}) {
  const [loadedPhotos, setLoadedPhotos] = useState(photos);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (loadedPhotos.length === 0) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden" || loadingRef.current) return;
      const offsets = Array.from(
        { length: Math.ceil(loadedPhotos.length / PUBLIC_PHOTO_PAGE_SIZE) },
        (_, index) => index * PUBLIC_PHOTO_PAGE_SIZE,
      );
      void Promise.all(offsets.map((offset) => fetchPhotoPage(publicToken, offset)))
        .then((pages) => {
          if (!active) return;
          setLoadedPhotos(pages.flatMap((page) => page.photos));
          setHasMore(pages.at(-1)?.hasMore ?? false);
        })
        .catch(() => {
          // Existing images stay visible; the next refresh can retry signed URLs.
        });
    }, 4 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadedPhotos.length, publicToken]);

  async function loadMore() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextPage = await fetchPhotoPage(publicToken, loadedPhotos.length);
      setLoadedPhotos((current) => [...current, ...nextPage.photos]);
      setHasMore(nextPage.hasMore);
    } catch {
      setLoadError("Não foi possível carregar mais fotos. Tente novamente.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    function handleModalKeys(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "Tab") {
        event.preventDefault();
        if (document.activeElement === closeButtonRef.current) {
          downloadLinkRef.current?.focus();
        } else {
          closeButtonRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", handleModalKeys);
    return () => {
      window.removeEventListener("keydown", handleModalKeys);
      previousFocus?.focus();
    };
  }, [selectedId]);

  const selectedPhoto = loadedPhotos.find((photo) => photo.id === selectedId);

  if (loadedPhotos.length === 0) {
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
        {loadedPhotos.map((photo, index) => (
          <li className="overflow-hidden rounded-2xl bg-white shadow-sm" key={photo.id}>
            {photo.thumbnailUrl || photo.previewUrl ? (
              <button
                aria-label={`Ampliar foto ${index + 1}`}
                className="block aspect-square w-full overflow-hidden bg-stone-100"
                onClick={() => setSelectedId(photo.id)}
                type="button"
              >
                <PublicImage
                  alt={`Foto ${index + 1} de ${collectionName}`}
                  className="h-full w-full object-cover"
                  fallbackUrl={photo.previewUrl}
                  fetchPriority={index === 0 ? "high" : undefined}
                  key={`${photo.thumbnailUrl}:${photo.previewUrl}`}
                  loading={index < 4 ? "eager" : "lazy"}
                  primaryUrl={photo.thumbnailUrl}
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
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            disabled={isLoading}
            onClick={loadMore}
            type="button"
          >
            {isLoading ? "Carregando fotos..." : "Carregar mais fotos"}
          </button>
        </div>
      )}
      {loadError && <p className="mt-3 text-center text-sm text-red-700" role="alert">{loadError}</p>}
      {selectedPhoto && (selectedPhoto.previewUrl || selectedPhoto.thumbnailUrl) && (
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
            <PublicImage
              alt={`Foto ampliada de ${collectionName}`}
              className="max-h-full max-w-full object-contain"
              fallbackUrl={selectedPhoto.thumbnailUrl}
              key={`${selectedPhoto.id}:${selectedPhoto.previewUrl}:${selectedPhoto.thumbnailUrl}`}
              primaryUrl={selectedPhoto.previewUrl}
            />
          </div>
          <a
            ref={downloadLinkRef}
            className="mt-4 self-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            href={`/g/${publicToken}/fotos/${selectedPhoto.id}/download`}
          >
            Baixar foto
          </a>
        </div>
      )}
    </section>
  );
}

function PublicImage({
  alt,
  className,
  fallbackUrl,
  fetchPriority,
  loading,
  primaryUrl,
}: {
  alt: string;
  className: string;
  fallbackUrl: string | null;
  fetchPriority?: "high";
  loading?: "lazy" | "eager";
  primaryUrl: string | null;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const firstUrl = primaryUrl ?? fallbackUrl;
  const imageUrl = useFallback ? fallbackUrl : firstUrl;

  if (!imageUrl || failed) {
    return <span className="text-sm text-slate-400">Arquivo indisponível</span>;
  }

  return (
    // Signed URLs are short-lived and should not be cached by the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={className}
      fetchPriority={fetchPriority}
      loading={loading}
      onError={() => {
        if (!useFallback && fallbackUrl && fallbackUrl !== firstUrl) setUseFallback(true);
        else setFailed(true);
      }}
      src={imageUrl}
    />
  );
}
