"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once on the client. Skipped in development so it doesn't
 * trap the dev build. Production users get an installable PWA after one
 * online visit, which is the foundation for offline support — every
 * subsequent visit, including with no network, can hit cached app shell +
 * cached static assets.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Mirror next.config.js — SW is disabled in dev.
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(reg => {
        if (reg.active) console.log("[sw] active:", reg.active.scriptURL);
        else if (reg.installing) console.log("[sw] installing…");
      })
      .catch(err => console.error("[sw] register failed:", err));
  }, []);

  return null;
}
