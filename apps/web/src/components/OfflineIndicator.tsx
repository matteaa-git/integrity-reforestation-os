"use client";

import { useEffect, useState } from "react";
import { countQueuedWrites } from "@/lib/offlineCache";

/**
 * Status pill in the bottom-right. Surfaces in two cases:
 *
 *   Offline:        amber, "Offline — N change(s) queued"
 *   Online + queue: blue,  "Syncing N change(s)…"
 *
 * Hidden when online with empty queue. Pending count refreshes on the
 * sync-queue-changed event emitted by offlineCache helpers.
 */
export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function updateOnline() { setOffline(!navigator.onLine); }
    async function refreshPending() {
      try { setPending(await countQueuedWrites()); }
      catch { setPending(0); }
    }

    updateOnline();
    void refreshPending();

    window.addEventListener("online",  updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("sync-queue-changed", refreshPending);
    return () => {
      window.removeEventListener("online",  updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("sync-queue-changed", refreshPending);
    };
  }, []);

  if (!offline && pending === 0) return null;

  const isSyncing = !offline && pending > 0;
  const label = offline
    ? `Offline${pending > 0 ? ` — ${pending} change${pending !== 1 ? "s" : ""} queued` : ""}`
    : `Syncing ${pending} change${pending !== 1 ? "s" : ""}…`;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        zIndex: 100000,
        background: isSyncing ? "rgba(37, 99, 235, 0.95)" : "rgba(245, 158, 11, 0.95)",
        color: isSyncing ? "#ffffff" : "#1f2937",
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{isSyncing ? "↻" : "⚠"}</span>
      {label}
    </div>
  );
}
