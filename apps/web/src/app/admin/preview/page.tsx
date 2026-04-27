"use client";

import { useState } from "react";

const DEVICES = [
  {
    name:        "iPhone 15 Pro",
    screenW:     393,
    screenH:     852,
    frameW:      415,
    frameH:      896,
    radius:      50,
    border:      14,
    notch:       "dynamic-island" as const,
    color:       "#2a2a2a",
    highlight:   "#4a4a4a",
  },
  {
    name:        "iPhone SE 3",
    screenW:     375,
    screenH:     667,
    frameW:      397,
    frameH:      713,
    radius:      38,
    border:      14,
    notch:       "none" as const,
    color:       "#2a2a2a",
    highlight:   "#4a4a4a",
  },
  {
    name:        "Galaxy S24",
    screenW:     360,
    screenH:     780,
    frameW:      382,
    frameH:      826,
    radius:      44,
    border:      14,
    notch:       "punch-hole" as const,
    color:       "#1a1a2e",
    highlight:   "#2a2a4a",
  },
];

export default function MobilePreviewPage() {
  const [deviceIdx, setDeviceIdx] = useState(0);
  const [scale, setScale]         = useState(0.82);
  const [landscape, setLandscape] = useState(false);

  const dev = DEVICES[deviceIdx];
  const sw  = landscape ? dev.screenH : dev.screenW;
  const sh  = landscape ? dev.screenW : dev.screenH;
  const fw  = landscape ? dev.frameH  : dev.frameW;
  const fh  = landscape ? dev.frameW  : dev.frameH;

  const pad = dev.border;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(135deg, #0a0f0d 0%, #0d1f15 50%, #0a1610 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      WebkitFontSmoothing: "antialiased",
    }}>

      {/* ── Top control bar ───────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, padding: "12px 24px",
        background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: "#39de8b",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#002a27", fontWeight: 800, fontSize: 11, flexShrink: 0,
          }}>IR</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Mobile Preview</span>
        </div>

        {/* Device selector */}
        <div style={{ display: "flex", gap: 6 }}>
          {DEVICES.map((d, i) => (
            <button key={d.name} onClick={() => setDeviceIdx(i)} style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: "1px solid",
              borderColor: i === deviceIdx ? "#39de8b" : "rgba(255,255,255,0.12)",
              background: i === deviceIdx ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.04)",
              color: i === deviceIdx ? "#39de8b" : "rgba(255,255,255,0.45)",
              cursor: "pointer", transition: "all 0.15s",
            }}>{d.name}</button>
          ))}
        </div>

        {/* Landscape toggle */}
        <button onClick={() => setLandscape(v => !v)} style={{
          padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
          border: "1px solid",
          borderColor: landscape ? "#39de8b" : "rgba(255,255,255,0.12)",
          background: landscape ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.04)",
          color: landscape ? "#39de8b" : "rgba(255,255,255,0.45)",
          cursor: "pointer", transition: "all 0.15s",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 14, transform: landscape ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>📱</span>
          {landscape ? "Landscape" : "Portrait"}
        </button>

        {/* Scale */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>Scale</span>
          <input
            type="range" min={0.4} max={1.0} step={0.02} value={scale}
            onChange={e => setScale(Number(e.target.value))}
            style={{ width: 90, accentColor: "#39de8b", cursor: "pointer" }}
          />
          <span style={{ fontSize: 11, color: "#39de8b", fontWeight: 700, width: 36 }}>
            {Math.round(scale * 100)}%
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Back to desktop */}
        <a href="/admin" style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)",
          textDecoration: "none", padding: "5px 12px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)", transition: "all 0.15s",
        }}>
          ⇱ Desktop
        </a>
      </div>

      {/* ── Phone preview area ────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", position: "relative",
      }}>

        {/* Subtle grid background */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "radial-gradient(circle, #39de8b 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        {/* Phone wrapper (applies scale) */}
        <div style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          transition: "transform 0.2s ease",
          position: "relative",
        }}>

          {/* ── Phone body ────────────────────────────────────────── */}
          <div style={{
            width: fw, height: fh,
            borderRadius: dev.radius,
            background: `linear-gradient(160deg, ${dev.highlight} 0%, ${dev.color} 40%)`,
            boxShadow: [
              "0 0 0 1px rgba(255,255,255,0.12)",
              "0 30px 80px rgba(0,0,0,0.8)",
              "0 10px 30px rgba(0,0,0,0.5)",
              "inset 0 1px 0 rgba(255,255,255,0.15)",
              "inset 0 -1px 0 rgba(0,0,0,0.3)",
            ].join(", "),
            position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>

            {/* Side buttons — left (volume) */}
            {!landscape && (<>
              <div style={{
                position: "absolute", left: -3, top: "22%", width: 3, height: 30,
                background: dev.highlight, borderRadius: "3px 0 0 3px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
              }} />
              <div style={{
                position: "absolute", left: -3, top: "30%", width: 3, height: 48,
                background: dev.highlight, borderRadius: "3px 0 0 3px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
              }} />
              <div style={{
                position: "absolute", left: -3, top: "40%", width: 3, height: 48,
                background: dev.highlight, borderRadius: "3px 0 0 3px",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
              }} />
            </>)}

            {/* Side buttons — right (power) */}
            {!landscape && (
              <div style={{
                position: "absolute", right: -3, top: "28%", width: 3, height: 72,
                background: dev.highlight, borderRadius: "0 3px 3px 0",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
              }} />
            )}

            {/* Screen bezel */}
            <div style={{
              width: sw, height: sh,
              borderRadius: dev.radius - pad + 4,
              background: "#000",
              overflow: "hidden",
              position: "relative",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.8)",
            }}>

              {/* Status bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: dev.notch === "dynamic-island" ? 54 : dev.notch === "punch-hole" ? 40 : 24,
                background: "#001f1c",
                zIndex: 10,
                display: "flex", alignItems: "center",
                padding: "0 20px",
              }}>
                {/* Time (left) */}
                <span style={{ fontSize: 12, fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
                  {new Date().toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>

                {/* Dynamic Island */}
                {dev.notch === "dynamic-island" && (
                  <div style={{
                    position: "absolute", left: "50%", top: 10, transform: "translateX(-50%)",
                    width: 120, height: 34, borderRadius: 20,
                    background: "#000",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
                  }} />
                )}

                {/* Punch-hole */}
                {dev.notch === "punch-hole" && (
                  <div style={{
                    position: "absolute", left: "50%", top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 12, height: 12, borderRadius: "50%",
                    background: "#000",
                  }} />
                )}

                {/* Status icons (right) */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  {/* Signal */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
                    {[3, 5, 7, 9].map((h, i) => (
                      <div key={i} style={{ width: 3, height: h, background: i < 3 ? "white" : "rgba(255,255,255,0.3)", borderRadius: 1 }} />
                    ))}
                  </div>
                  {/* WiFi */}
                  <span style={{ fontSize: 11, color: "white" }}>WiFi</span>
                  {/* Battery */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <div style={{
                      width: 22, height: 11, borderRadius: 3,
                      border: "1.5px solid rgba(255,255,255,0.6)",
                      position: "relative", display: "flex", alignItems: "center", padding: "1px",
                    }}>
                      <div style={{ width: "75%", height: "100%", background: "#39de8b", borderRadius: 1.5 }} />
                      <div style={{
                        position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)",
                        width: 2.5, height: 5, background: "rgba(255,255,255,0.4)", borderRadius: "0 1px 1px 0",
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* The actual mobile app in an iframe */}
              <iframe
                src="/admin/mobile"
                style={{
                  width: sw, height: sh,
                  border: "none", display: "block",
                  background: "#f5f7f5",
                }}
                title="IR Admin Mobile"
              />

              {/* Home indicator (iPhone) */}
              {(dev.notch === "dynamic-island" || dev.notch === "none") && (
                <div style={{
                  position: "absolute", bottom: 8, left: "50%",
                  transform: "translateX(-50%)",
                  width: 120, height: 4, borderRadius: 2,
                  background: "rgba(255,255,255,0.35)",
                  pointerEvents: "none",
                  zIndex: 10,
                }} />
              )}
            </div>
          </div>

          {/* Phone shadow */}
          <div style={{
            position: "absolute", bottom: -20, left: "10%", right: "10%", height: 20,
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 70%)",
            filter: "blur(8px)",
            pointerEvents: "none",
          }} />
        </div>

        {/* Device info label */}
        <div style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 20px", borderRadius: 20,
          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            {dev.name}
          </span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            {landscape ? `${sh} × ${sw}` : `${sw} × ${sh}`}
          </span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
          <span style={{ fontSize: 12, color: "#39de8b", fontWeight: 600 }}>
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
