import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlbumCard } from "@/app/(app)/album-card";

afterEach(cleanup);

describe("album card visibility", () => {
  it("shows the public link for an active album", () => {
    const token = "22222222-2222-4222-8222-222222222222";
    render(<AlbumCard album={{ id: "album-1", name: "Ensaio", public_token: token, is_active: true }} />);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `/g/${token}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
  });

  it("keeps an inactive album manageable without rendering its public token", () => {
    const token = "33333333-3333-4333-8333-333333333333";
    const { container } = render(
      <AlbumCard album={{ id: "album-2", name: "Evento", public_token: token, is_active: false }} />,
    );

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(screen.getByText("Compartilhamento desativado.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir álbum" })).toHaveAttribute("href", "/colecoes/album-2");
    expect(screen.queryByRole("button", { name: "Copiar link" })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(token);
  });
});
