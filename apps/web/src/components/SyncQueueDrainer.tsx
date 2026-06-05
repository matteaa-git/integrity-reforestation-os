"use client";

import { useEffect } from "react";
import { flushPendingWrites } from "@/lib/productionDb";
import { countQueuedWrites } from "@/lib/offlineCache";

/**
 * Drains the offline write queue against Supabase whenever the device can
 * plausibly reach the network: on mount, when navigator.onLine flips to
 * true, when the window regains focus (user pops back into the app), and
 * once every 30 seconds as a safety net for cases where a previous drain
 * stopped on error.
 *
 * Also blocks page unload (refresh / tab close) while writes are pending so
 * the user gets a native "leave site?" confirmation — important because the
 * cache survives reload but a re-fetched server snapshot can hide queued
 * writes briefly. The OfflineIndicator already calls this out visually; the
 * unload guard is a belt-and-braces safety net.
 */
export default function SyncQueueDrainer() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const drain = () => { void flushPendingWrites(); };

    drain();
    window.addEventListener("online", drain);
    window.addEventListener("focus",  drain);
    const interval = setInterval(drain, 30_000);

    // beforeunload runs synchronously, so we can't await IndexedDB inside
    // it. Instead, poll the count every 2 seconds into a ref-style local
    // variable that the handler can read instantly.
    let pendingCount = 0;
    const poll = setInterval(async () => {
      try { pendingCount = await countQueuedWrites(); } catch { /* ignore */ }
    }, 2_000);
    countQueuedWrites().then(n => { pendingCount = n; }).catch(() => { /* ignore */ });

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingCount > 0) {
        // Modern browsers ignore the custom string and show their own message,
        // but setting returnValue is what actually triggers the prompt.
        e.preventDefault();
        e.returnValue = "You have unsynced changes. Leave anyway?";
        return e.returnValue;
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("online", drain);
      window.removeEventListener("focus",  drain);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearInterval(interval);
      clearInterval(poll);
    };
  }, []);

  return null;
}
