import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlbumStatusForm } from "@/app/(app)/album-status-form";
import { updateCollectionStatus } from "@/app/(app)/collections-actions";

vi.mock("@/app/(app)/collections-actions", () => ({ updateCollectionStatus: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("album status form", () => {
  it("shows the inactive switch on the left and prepares activation", () => {
    const { container } = render(<AlbumStatusForm collectionId="album-1" isActive={false} />);

    const toggle = screen.getByRole("switch", { name: "Compartilhamento público" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle.querySelector("span")).toHaveClass("translate-x-1");
    expect(container.querySelector<HTMLInputElement>('input[name="id"]')).toHaveValue("album-1");
    expect(container.querySelector<HTMLInputElement>('input[name="status"]')).toHaveValue("active");
  });

  it("shows the active switch on the right and deactivates without confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { container } = render(<AlbumStatusForm collectionId="album-2" isActive />);
    vi.mocked(updateCollectionStatus).mockResolvedValue({ success: "Álbum inativado." });

    const toggle = screen.getByRole("switch", { name: "Compartilhamento público" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle.querySelector("span")).toHaveClass("translate-x-7");
    expect(container.querySelector<HTMLInputElement>('input[name="status"]')).toHaveValue("inactive");
    await act(async () => { fireEvent.click(toggle); });

    expect(confirm).not.toHaveBeenCalled();
    expect(updateCollectionStatus).toHaveBeenCalledOnce();
  });
});
