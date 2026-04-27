"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CropRect {
  x: number;  // 0–100 % of image
  y: number;
  w: number;
  h: number;
}

interface CropModalProps {
  imageUrl: string;
  /** Target width/height ratio for the crop box (e.g. 1080/1350 = 0.8). null = free */
  aspectRatio?: number | null;
  initialCrop?: CropRect;
  onConfirm: (crop: CropRect) => void;
  onClose: () => void;
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";

const HANDLE_PX = 10;
const MIN_CROP_PCT = 5; // minimum crop dimension as % of image

const HANDLE_CURSORS: Record<Handle, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize",
  e: "ew-resize", se: "nwse-resize", s: "ns-resize",
  sw: "nesw-resize", w: "ew-resize", move: "move",
};

export default function CropModal({ imageUrl, aspectRatio = null, initialCrop, onConfirm, onClose }: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // crop in % of image (0–100)
  const [crop, setCrop] = useState<CropRect>(initialCrop ?? { x: 10, y: 10, w: 80, h: 80 });
  const [lockAspect, setLockAspect] = useState(aspectRatio != null);

  // Displayed image size in px (set once image loads)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const dragRef = useRef<{
    handle: Handle;
    startCX: number; startCY: number;
    orig: CropRect;
  } | null>(null);

  const effectiveRatio = lockAspect ? (aspectRatio ?? (crop.w / crop.h)) : null;

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setImgSize({ w: img.offsetWidth, h: img.offsetHeight });
  };

  // Clamp crop so it stays inside [0,100]×[0,100]
  const clamp = useCallback((c: CropRect): CropRect => {
    let { x, y, w, h } = c;
    w = Math.max(MIN_CROP_PCT, Math.min(w, 100));
    h = Math.max(MIN_CROP_PCT, Math.min(h, 100));
    x = Math.max(0, Math.min(x, 100 - w));
    y = Math.max(0, Math.min(y, 100 - h));
    return { x, y, w, h };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const state = dragRef.current;
      if (!state || !imgSize) return;

      const dx = ((e.clientX - state.startCX) / imgSize.w) * 100;
      const dy = ((e.clientY - state.startCY) / imgSize.h) * 100;
      const o = state.orig;
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;

      const ratio = effectiveRatio ?? (lockAspect ? o.w / o.h : null);

      if (state.handle === "move") {
        nx = o.x + dx;
        ny = o.y + dy;
      } else {
        // Resize handles
        if (state.handle.includes("w")) { nx = o.x + dx; nw = o.w - dx; }
        if (state.handle.includes("e")) { nw = o.w + dx; }
        if (state.handle.includes("n")) { ny = o.y + dy; nh = o.h - dy; }
        if (state.handle.includes("s")) { nh = o.h + dy; }

        // Apply aspect ratio lock
        if (ratio) {
          const anchoredW = state.handle.includes("n") || state.handle.includes("s");
          const anchoredH = state.handle.includes("e") || state.handle.includes("w");
          if (anchoredW && !anchoredH) {
            nw = nh * ratio;
          } else {
            nh = nw / ratio;
          }
        }
      }

      setCrop(clamp({ x: nx, y: ny, w: nw, h: nh }));
    };

    const onMouseUp = () => { dragRef.current = null; };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [imgSize, lockAspect, effectiveRatio, clamp]);

  const startDrag = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { handle, startCX: e.clientX, startCY: e.clientY, orig: { ...crop } };
  };

  // Convert crop % → px within the displayed image
  const toBox = () => {
    if (!imgSize) return null;
    return {
      left: (crop.x / 100) * imgSize.w,
      top: (crop.y / 100) * imgSize.h,
      width: (crop.w / 100) * imgSize.w,
      height: (crop.h / 100) * imgSize.h,
    };
  };

  const box = toBox();

  const handlePositions = (b: NonNullable<ReturnType<typeof toBox>>): { handle: Handle; style: React.CSSProperties }[] => {
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const r = b.left + b.width;
    const bot = b.top + b.height;
    const hw = HANDLE_PX / 2;
    const pos = (x: number, y: number) => ({ left: x - hw, top: y - hw, width: HANDLE_PX, height: HANDLE_PX });
    return [
      { handle: "nw", style: pos(b.left, b.top) },
      { handle: "n",  style: pos(cx, b.top) },
      { handle: "ne", style: pos(r, b.top) },
      { handle: "e",  style: pos(r, cy) },
      { handle: "se", style: pos(r, bot) },
      { handle: "s",  style: pos(cx, bot) },
      { handle: "sw", style: pos(b.left, bot) },
      { handle: "w",  style: pos(b.left, cy) },
    ];
  };

  const bg0 = "#16181f";
  const green = "#39de8b";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{ background: bg0, borderRadius: 12, padding: 20, maxWidth: 860, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "system-ui" }}>Crop Image</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setLockAspect(!lockAspect)}
              style={{
                padding: "5px 10px", fontSize: 11, fontFamily: "system-ui",
                background: lockAspect ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${lockAspect ? green : "rgba(255,255,255,0.12)"}`,
                borderRadius: 6, color: lockAspect ? green : "rgba(255,255,255,0.5)", cursor: "pointer",
              }}
            >
              {lockAspect ? "⊠ Locked" : "⊡ Free"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {/* Main crop area */}
          <div style={{ flex: 1, position: "relative", userSelect: "none" }} ref={containerRef}>
            <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Crop"
                draggable={false}
                onLoad={onImgLoad}
                style={{ display: "block", maxWidth: "100%", maxHeight: 480, borderRadius: 6 }}
              />

              {box && imgSize && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {/* Dim overlays — 4 rects around crop box */}
                  {[
                    /* top    */ { left: 0, top: 0, width: imgSize.w, height: box.top },
                    /* bottom */ { left: 0, top: box.top + box.height, width: imgSize.w, height: imgSize.h - box.top - box.height },
                    /* left   */ { left: 0, top: box.top, width: box.left, height: box.height },
                    /* right  */ { left: box.left + box.width, top: box.top, width: imgSize.w - box.left - box.width, height: box.height },
                  ].map((r, i) => (
                    <div key={i} style={{ position: "absolute", background: "rgba(0,0,0,0.55)", ...r }} />
                  ))}

                  {/* Crop box border */}
                  <div
                    style={{
                      position: "absolute",
                      left: box.left, top: box.top, width: box.width, height: box.height,
                      border: "1.5px solid rgba(255,255,255,0.9)",
                      boxSizing: "border-box",
                      pointerEvents: "auto",
                      cursor: "move",
                    }}
                    onMouseDown={(e) => startDrag(e, "move")}
                  >
                    {/* Rule of thirds grid */}
                    {[1, 2].map(i => (
                      <div key={`v${i}`} style={{ position: "absolute", left: `${i * 33.33}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.2)" }} />
                    ))}
                    {[1, 2].map(i => (
                      <div key={`h${i}`} style={{ position: "absolute", top: `${i * 33.33}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.2)" }} />
                    ))}
                  </div>

                  {/* Handles */}
                  {handlePositions(box).map(({ handle, style }) => (
                    <div
                      key={handle}
                      style={{
                        position: "absolute", ...style,
                        background: "#fff",
                        borderRadius: 2,
                        cursor: HANDLE_CURSORS[handle],
                        pointerEvents: "auto",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                      }}
                      onMouseDown={(e) => startDrag(e, handle)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview panel */}
          <div style={{ width: 160, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "system-ui", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Preview</div>
            <div style={{ width: 160, height: 200, overflow: "hidden", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", position: "relative" }}>
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  width: `${100 / (crop.w / 100)}%`,
                  height: `${100 / (crop.h / 100)}%`,
                  left: `-${(crop.x / crop.w) * 100}%`,
                  top: `-${(crop.y / crop.h) * 100}%`,
                  pointerEvents: "none",
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "system-ui", lineHeight: 1.6 }}>
              x {crop.x.toFixed(1)}%<br />
              y {crop.y.toFixed(1)}%<br />
              w {crop.w.toFixed(1)}%<br />
              h {crop.h.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setCrop({ x: 0, y: 0, w: 100, h: 100 })}
            style={{ padding: "7px 14px", fontSize: 12, fontFamily: "system-ui", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
          >
            Reset
          </button>
          <button
            onClick={onClose}
            style={{ padding: "7px 14px", fontSize: 12, fontFamily: "system-ui", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(crop)}
            style={{ padding: "7px 18px", fontSize: 12, fontWeight: 700, fontFamily: "system-ui", background: green, border: "none", borderRadius: 7, color: "#0a2010", cursor: "pointer" }}
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
