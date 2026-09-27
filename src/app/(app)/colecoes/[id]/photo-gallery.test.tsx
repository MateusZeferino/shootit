import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhotoGallery, type GalleryPhoto } from "./photo-gallery";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const photo: GalleryPhoto = {
  id: "photo-1",
  thumbnailUrl: "https://example.com/thumb.webp",
  previewUrl: "https://example.com/preview.webp",
  originalUrl: "https://example.com/original.jpg",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("authenticated photo gallery", () => {
  it("shows uploads when refreshed server props change", () => {
    const { rerender } = render(<PhotoGallery collectionId="album-1" photos={[]} initialHasMore={false} />);
    expect(screen.getByText(/Nenhuma foto neste álbum/i)).toBeInTheDocument();

    rerender(<PhotoGallery collectionId="album-1" photos={[photo]} initialHasMore={false} />);
    expect(screen.getByRole("button", { name: "Ampliar foto 1" })).toBeInTheDocument();

    rerender(<PhotoGallery collectionId="album-1" photos={[{ ...photo, id: "photo-2" }, photo]} initialHasMore={false} />);
    expect(screen.getByRole("button", { name: "Ampliar foto 2" })).toBeInTheDocument();
  });

  it("loads the next page and retains it when the first page refreshes", async () => {
    const firstPage = Array.from({ length: 24 }, (_, index) => ({ ...photo, id: `photo-${index + 1}` }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [{ ...photo, id: "photo-25" }], hasMore: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<PhotoGallery collectionId="album-1" photos={firstPage} initialHasMore />);

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais fotos" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ampliar foto 25" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/colecoes/album-1/fotos?offset=24", { cache: "no-store" });

    rerender(<PhotoGallery collectionId="album-1" photos={[{ ...photo, id: "new-photo" }, ...firstPage.slice(0, 23)]} initialHasMore />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Ampliar foto 25" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ampliar foto 1" })).toBeInTheDocument();
  });

  it("hides a deleted photo immediately and refreshes the album", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<PhotoGallery collectionId="album-1" photos={[photo]} initialHasMore={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir foto" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Ampliar foto 1" })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/colecoes/album-1/fotos/photo-1", { method: "DELETE" });
    expect(refresh).toHaveBeenCalled();
  });
});
