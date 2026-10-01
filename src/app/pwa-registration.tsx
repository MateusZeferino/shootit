"use client";

import { useEffect } from "react";

async function removeDevelopmentServiceWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter((registration) =>
    [registration.active, registration.waiting, registration.installing].some((worker) => {
      if (!worker) return false;
      const scriptUrl = new URL(worker.scriptURL);
      return scriptUrl.origin === window.location.origin && scriptUrl.pathname === "/sw.js";
    }),
  ).map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name.startsWith("shootit-static-"))
      .map((name) => caches.delete(name)));
  }
}

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    if (process.env.NODE_ENV === "development") {
      void removeDevelopmentServiceWorker().catch(() => {
        // Service workers are optional, including during local cleanup.
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      // The app remains usable when service workers are unavailable.
    });
  }, []);

  return null;
}
