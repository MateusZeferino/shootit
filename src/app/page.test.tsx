import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("home page", () => {
  it("presents the core Shootit value proposition", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /suas fotos organizadas/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /criar minha conta/i }),
    ).toHaveAttribute("href", "/cadastro");
  });
});
