"use client";

import { useEffect, useState } from "react";

/**
 * A small pill in the bottom-right that surfaces when the browser reports
 * no network. Mounted once in the root layout. Visible state is driven by
 * the browser's online/offline events — production data reads still work
 * (served from the offline cache), writes are blocked until reconnection.
 */
export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function update() { setOffline(!navigator.onLine); }
    update();
    window.addEventListener("online",  update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online",  update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        zIndex: 100000,
        background: "rgba(245, 158, 11, 0.95)",
        color: "#1f2937",
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
      <span style={{ fontSize: 14, lineHeight: 1 }}>⚠</span>
      Offline — reading from local cache. Saves are paused.
    </div>
  );
}
