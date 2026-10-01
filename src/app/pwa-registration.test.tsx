import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PwaRegistration } from "@/app/pwa-registration";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("PWA registration", () => {
  it("removes Shootit service workers and caches during development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubGlobal("isSecureContext", true);

    const unregister = vi.fn().mockResolvedValue(true);
    const unregisterOther = vi.fn();
    const register = vi.fn();
    const deleteCache = vi.fn().mockResolvedValue(true);
    const serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([
        { active: { scriptURL: `${window.location.origin}/sw.js` }, unregister },
        { active: { scriptURL: `${window.location.origin}/other-sw.js` }, unregister: unregisterOther },
      ]),
      register,
    };
    const navigatorWithWorker = Object.create(window.navigator) as Navigator;
    Object.defineProperty(navigatorWithWorker, "serviceWorker", { value: serviceWorker });
    vi.stubGlobal("navigator", navigatorWithWorker);
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["shootit-static-v1", "other-app-cache"]),
      delete: deleteCache,
    });

    render(<PwaRegistration />);

    await waitFor(() => expect(unregister).toHaveBeenCalledOnce());
    expect(unregisterOther).not.toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledExactlyOnceWith("shootit-static-v1");
    expect(register).not.toHaveBeenCalled();
  });

  it("registers the service worker outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("isSecureContext", true);

    const register = vi.fn().mockResolvedValue({});
    const navigatorWithWorker = Object.create(window.navigator) as Navigator;
    Object.defineProperty(navigatorWithWorker, "serviceWorker", { value: { register } });
    vi.stubGlobal("navigator", navigatorWithWorker);

    render(<PwaRegistration />);

    await waitFor(() => expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js", {
      updateViaCache: "none",
    }));
  });
});
