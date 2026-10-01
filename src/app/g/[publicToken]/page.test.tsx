import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PublicGalleryPage from "./page";
import { loadPublicPhotoPage } from "@/lib/photos/public-photo-page";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/photos/public-photo-page", () => ({ loadPublicPhotoPage: vi.fn() }));

const token = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("public gallery page", () => {
  it("shows an informative page instead of a 404 for an inactive album", async () => {
    vi.mocked(loadPublicPhotoPage).mockResolvedValue({ status: "inactive" });

    render(await PublicGalleryPage({
      params: Promise.resolve({ publicToken: token }),
      searchParams: Promise.resolve({}),
    }));

    expect(screen.getByRole("heading", { name: "Álbum indisponível" })).toBeInTheDocument();
    expect(screen.getByText("O compartilhamento deste álbum está desativado no momento.")).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});
