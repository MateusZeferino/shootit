import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import RootPage from "@/app/page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("root page", () => {
  it("opens the dashboard, which redirects visitors without a session to login", () => {
    RootPage();

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/dashboard");
  });
});
