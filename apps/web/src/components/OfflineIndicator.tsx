"use client";

import { useEffect, useRef, useState } from "react";
import { countQueuedWrites } from "@/lib/offlineCache";

/**
 * Status pill in the bottom-right. Surfaces in three cases:
 *
 *   Offline:                       amber, "Offline — N change(s) queued"
 *   Online + queue (<30s old):     blue,  "Syncing N change(s)…"
 *   Online + queue stuck (>=30s):  red,   "N change(s) NOT SYNCED — DO NOT RELOAD"
 *
 * The stuck state is the important one: it tells the user that local-only
 * data is at risk if they close the tab or reload before the queue drains.
 * Drives off the sync-queue-changed event emitted by offlineCache helpers.
 */
const STUCK_AFTER_MS = 30_000;

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);
  const [stuck, setStuck] = useState(false);
  // When pending first became non-zero. Reset on drain.
  const pendingSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function updateOnline() { setOffline(!navigator.onLine); }
    async function refreshPending() {
      try {
        const n = await countQueuedWrites();
        setPending(n);
        if (n === 0) {
          pendingSinceRef.current = null;
          setStuck(false);
        } else if (pendingSinceRef.current == null) {
          pendingSinceRef.current = Date.now();
        }
      } catch { setPending(0); }
    }

    updateOnline();
    void refreshPending();

    // Poll the stuck flag every 5s while the queue is non-empty. Cheap and
    // independent of whether sync-queue-changed fires (the drainer might be
    // idle if the network is down).
    const tick = setInterval(() => {
      const since = pendingSinceRef.current;
      if (since != null && Date.now() - since >= STUCK_AFTER_MS) setStuck(true);
    }, 5_000);

    window.addEventListener("online",  updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("sync-queue-changed", refreshPending);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online",  updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("sync-queue-changed", refreshPending);
    };
  }, []);

  if (!offline && pending === 0) return null;

  const isStuck   = !offline && stuck && pending > 0;
  const isSyncing = !offline && !stuck && pending > 0;

  const label = isStuck
    ? `${pending} change${pending !== 1 ? "s" : ""} NOT SYNCED — DO NOT RELOAD`
    : offline
      ? `Offline${pending > 0 ? ` — ${pending} change${pending !== 1 ? "s" : ""} queued` : ""}`
      : `Syncing ${pending} change${pending !== 1 ? "s" : ""}…`;

  const background = isStuck   ? "rgba(220, 38, 38, 0.97)"  // red
                   : isSyncing ? "rgba(37, 99, 235, 0.95)"  // blue
                   :             "rgba(245, 158, 11, 0.95)"; // amber (offline)
  const color      = isStuck || isSyncing ? "#ffffff" : "#1f2937";
  const icon       = isStuck ? "⚠" : isSyncing ? "↻" : "⚠";

  return (
    <div
      role="status"
      aria-live={isStuck ? "assertive" : "polite"}
      style={{
        position: "fixed",
        right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        zIndex: 100000,
        background,
        color,
        padding: isStuck ? "10px 16px" : "8px 14px",
        borderRadius: 999,
        fontSize: isStuck ? 13 : 12,
        fontWeight: 700,
        boxShadow: isStuck
          ? "0 8px 32px rgba(220, 38, 38, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.4)"
          : "0 6px 24px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        // Subtle pulse to draw attention when stuck. CSS animation defined in globals.css.
        animation: isStuck ? "stuck-pulse 1.6s ease-in-out infinite" : undefined,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      {label}
    </div>
  );
}
