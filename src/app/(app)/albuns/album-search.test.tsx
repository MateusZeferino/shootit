import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlbumSearch } from "@/app/(app)/albuns/album-search";

const albums = [
  { id: "1", name: "Família", public_token: "token-1", is_active: true },
  { id: "2", name: "Casamento", public_token: "token-2", is_active: true },
  { id: "3", name: "Retratos", public_token: "token-3", is_active: false },
];

afterEach(cleanup);

describe("album search", () => {
  it("filters albums by name without requiring matching accents or case", () => {
    render(<AlbumSearch albums={albums} />);

    const search = screen.getByRole("searchbox", { name: "Buscar álbuns pelo nome" });
    expect(screen.getAllByRole("link", { name: "Abrir álbum" })).toHaveLength(3);

    fireEvent.change(search, { target: { value: "FAMILIA" } });

    expect(screen.getByRole("heading", { name: "Família" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Casamento" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Abrir álbum" })).toHaveLength(1);
  });

  it("shows an informative state when the search has no results", () => {
    render(<AlbumSearch albums={albums} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "inexistente" } });

    expect(screen.getByRole("status")).toHaveTextContent("Nenhum álbum encontrado");
  });
});
