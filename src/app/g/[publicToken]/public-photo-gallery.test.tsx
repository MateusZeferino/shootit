import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicPhotoGallery, type PublicPhoto } from "./public-photo-gallery";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const photo: PublicPhoto = {
  id: "photo-1",
  thumbnailUrl: "https://example.com/thumbnail.png",
  previewUrl: "https://example.com/preview.png",
};

describe("public photo gallery", () => {
  it("shows an empty state without administrative actions", () => {
    render(<PublicPhotoGallery collectionName="Ensaio" publicToken="album-token" photos={[]} initialHasMore={false} />);

    expect(screen.getByText(/ainda não tem fotos/i)).toBeInTheDocument();
    expect(screen.queryByText(/excluir|renomear|upload/i)).not.toBeInTheDocument();
  });

  it("loads images lazily and opens a simple lightbox", () => {
    render(<PublicPhotoGallery
      collectionName="Ensaio"
      publicToken="album-token"
      photos={[photo]}
      initialHasMore={false}
    />);

    const thumbnail = screen.getByRole("img", { name: "Foto 1 de Ensaio" });
    expect(thumbnail).toHaveAttribute("loading", "eager");
    expect(thumbnail).toHaveAttribute("fetchpriority", "high");
    expect(thumbnail).toHaveAttribute("src", photo.thumbnailUrl);
    fireEvent.error(thumbnail);
    expect(thumbnail).toHaveAttribute("src", photo.previewUrl);
    expect(screen.queryByRole("link", { name: "Baixar foto" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar foto 1" }));
    expect(screen.getByRole("dialog", { name: "Visualização ampliada" })).toBeInTheDocument();
    const enlarged = screen.getByRole("img", { name: "Foto ampliada de Ensaio" });
    expect(enlarged).toHaveAttribute("src", photo.previewUrl);
    fireEvent.error(enlarged);
    expect(enlarged).toHaveAttribute("src", photo.thumbnailUrl);
    const download = screen.getByRole("link", { name: "Baixar foto" });
    expect(download).toHaveAttribute("href", "/g/album-token/fotos/photo-1/download");
    fireEvent.keyDown(window, { key: "Tab" });
    expect(download).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/excluir foto/i)).not.toBeInTheDocument();
  });

  it("loads the next 24 photos on demand", async () => {
    const firstPage = Array.from({ length: 24 }, (_, index) => ({ ...photo, id: `photo-${index + 1}` }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [{ ...photo, id: "photo-25" }], hasMore: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicPhotoGallery collectionName="Ensaio" publicToken="album-token" photos={firstPage} initialHasMore />);
    expect(screen.getByRole("img", { name: "Foto 5 de Ensaio" })).toHaveAttribute("loading", "lazy");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais fotos" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Ampliar foto 25" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/g/album-token/fotos?offset=24", { cache: "no-store" });
    expect(screen.queryByRole("button", { name: "Carregar mais fotos" })).not.toBeInTheDocument();
  });

  it("keeps previously loaded photos when a page request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<PublicPhotoGallery collectionName="Ensaio" publicToken="album-token" photos={[photo]} initialHasMore />);

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais fotos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente");
    expect(screen.getByRole("button", { name: "Ampliar foto 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carregar mais fotos" })).toBeInTheDocument();
  });
});
