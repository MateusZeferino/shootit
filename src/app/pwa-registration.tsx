"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // The app remains usable when service workers are unavailable.
      });
    }
  }, []);

  return null;
}
