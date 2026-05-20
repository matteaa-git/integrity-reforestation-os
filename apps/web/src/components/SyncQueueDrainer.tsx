"use client";

import { useEffect } from "react";
import { flushPendingWrites } from "@/lib/productionDb";

/**
 * Drains the offline write queue against Supabase whenever the device can
 * plausibly reach the network: on mount, when navigator.onLine flips to
 * true, when the window regains focus (user pops back into the app), and
 * once every 30 seconds as a safety net for cases where a previous drain
 * stopped on error.
 */
export default function SyncQueueDrainer() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const drain = () => { void flushPendingWrites(); };

    drain();
    window.addEventListener("online", drain);
    window.addEventListener("focus",  drain);
    const interval = setInterval(drain, 30_000);

    return () => {
      window.removeEventListener("online", drain);
      window.removeEventListener("focus",  drain);
      clearInterval(interval);
    };
  }, []);

  return null;
}
