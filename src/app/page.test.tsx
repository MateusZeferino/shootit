import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import RootPage from "@/app/page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("root page", () => {
  it("redirects to login instead of rendering a landing page", () => {
    RootPage();

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });
});
