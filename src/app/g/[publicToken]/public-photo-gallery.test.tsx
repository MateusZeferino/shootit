import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicPhotoGallery } from "./public-photo-gallery";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("public photo gallery", () => {
  it("shows an empty state without administrative actions", () => {
    render(<PublicPhotoGallery collectionName="Ensaio" photos={[]} />);

    expect(screen.getByText(/ainda não tem fotos/i)).toBeInTheDocument();
    expect(screen.queryByText(/excluir|renomear|upload/i)).not.toBeInTheDocument();
  });

  it("loads images lazily and opens a simple lightbox", () => {
    render(<PublicPhotoGallery
      collectionName="Ensaio"
      photos={[{ id: "photo-1", signedUrl: "https://example.com/signed-image.png" }]}
    />);

    expect(screen.getByRole("img", { name: "Foto 1 de Ensaio" })).toHaveAttribute("loading", "lazy");
    fireEvent.click(screen.getByRole("button", { name: "Ampliar foto 1" }));
    expect(screen.getByRole("dialog", { name: "Visualização ampliada" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/excluir foto/i)).not.toBeInTheDocument();
  });
});
