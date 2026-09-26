import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyGalleryLink } from "./copy-gallery-link";

afterEach(cleanup);

describe("copy gallery link", () => {
  it("copies the absolute public URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const token = "d8ca854a-d68b-4a9f-98d4-4dc9285c9f6f";
    render(<CopyGalleryLink publicToken={token} />);

    expect(screen.getByRole("link", { name: `/g/${token}` })).toHaveAttribute("href", `/g/${token}`);
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(await screen.findByText("Link copiado.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/g/${token}`);
  });
});
