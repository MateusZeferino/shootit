import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicPhotoGallery } from "./public-photo-gallery";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("public photo gallery", () => {
  it("shows an empty state without administrative actions", () => {
    render(<PublicPhotoGallery collectionName="Ensaio" publicToken="album-token" photos={[]} />);

    expect(screen.getByText(/ainda não tem fotos/i)).toBeInTheDocument();
    expect(screen.queryByText(/excluir|renomear|upload/i)).not.toBeInTheDocument();
  });

  it("loads images lazily and opens a simple lightbox", () => {
    render(<PublicPhotoGallery
      collectionName="Ensaio"
      publicToken="album-token"
      photos={[{ id: "photo-1", signedUrl: "https://example.com/signed-image.png" }]}
    />);

    expect(screen.getByRole("img", { name: "Foto 1 de Ensaio" })).toHaveAttribute("loading", "lazy");
    expect(screen.queryByRole("link", { name: "Baixar foto" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar foto 1" }));
    expect(screen.getByRole("dialog", { name: "Visualização ampliada" })).toBeInTheDocument();
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
});
