"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CropData {
  /** Horizontal offset as % of the element's own width (same as CSS translate X%) */
  offsetX: number;
  /** Vertical offset as % of the element's own height (same as CSS translate Y%) */
  offsetY: number;
  /** Zoom scale factor (1 = fill container, max 3) */
  scale: number;
}

export const DEFAULT_CROP: CropData = { offsetX: 0, offsetY: 0, scale: 1 };

interface ImageCropModalProps {
  src: string;
  filename: string;
  initialCrop?: CropData | null;
  onConfirm: (crop: CropData) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maximum pan offset (%) for a given scale to keep image covering the viewport */
function maxOffset(scale: number) {
  return (scale - 1) * 50;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// ImageCropModal
// ---------------------------------------------------------------------------

export default function ImageCropModal({
  src,
  filename,
  initialCrop,
  onConfirm,
  onClose,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<CropData>(initialCrop ?? DEFAULT_CROP);
  const dragging = useRef(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Drag ──────────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: crop.offsetX, oy: crop.offsetY };
    },
    [crop.offsetX, crop.offsetY]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !dragStart.current || !containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragStart.current.mx) / width) * 100;
      const dy = ((e.clientY - dragStart.current.my) / height) * 100;
      const mo = maxOffset(crop.scale);
      setCrop((prev) => ({
        ...prev,
        offsetX: clamp(dragStart.current!.ox + dx, -mo, mo),
        offsetY: clamp(dragStart.current!.oy + dy, -mo, mo),
      }));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [crop.scale]);

  // ── Scroll-to-zoom ─────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCrop((prev) => {
      const newScale = clamp(prev.scale - e.deltaY * 0.005, 1, 3);
      const mo = maxOffset(newScale);
      return {
        scale: newScale,
        offsetX: clamp(prev.offsetX, -mo, mo),
        offsetY: clamp(prev.offsetY, -mo, mo),
      };
    });
  }, []);

  // ── Zoom slider ────────────────────────────────────────────────────────────

  const handleZoomSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = Number(e.target.value) / 100;
    const mo = maxOffset(newScale);
    setCrop((prev) => ({
      scale: newScale,
      offsetX: clamp(prev.offsetX, -mo, mo),
      offsetY: clamp(prev.offsetY, -mo, mo),
    }));
  };

  // ── Presets ────────────────────────────────────────────────────────────────

  const PRESETS = [
    { label: "Center", crop: { offsetX: 0, offsetY: 0, scale: 1 } },
    { label: "Top",    crop: { offsetX: 0, offsetY: -25, scale: 1.5 } },
    { label: "Bottom", crop: { offsetX: 0, offsetY: 25, scale: 1.5 } },
    { label: "Fill",   crop: { offsetX: 0, offsetY: 0, scale: 1.2 } },
  ] as const;

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm(crop);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [crop, onClose, onConfirm]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const transform = `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.scale})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#111827", width: 420 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div>
            <div className="text-sm font-semibold text-white">Crop Frame</div>
            <div className="text-[10px] text-white/35 mt-0.5 truncate max-w-[280px]">{filename}</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
          >
            ×
          </button>
        </div>

        {/* Viewport */}
        <div className="flex flex-col items-center gap-4 px-5 py-5">
          {/* Crop box */}
          <div
            ref={containerRef}
            className="relative rounded-xl overflow-hidden bg-black select-none"
            style={{ width: 220, height: 390, cursor: "grab" }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          >
            <img
              src={src}
              alt={filename}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ transform, transformOrigin: "center", userSelect: "none" }}
            />

            {/* Rule-of-thirds grid */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/15" />
              <div className="absolute top-0 bottom-0 right-1/3 w-px bg-white/15" />
              <div className="absolute left-0 right-0 top-1/3 h-px bg-white/15" />
              <div className="absolute left-0 right-0 bottom-1/3 h-px bg-white/15" />
            </div>

            {/* Corner handles */}
            {(["top-0 left-0 rounded-tl-xl border-t border-l", "top-0 right-0 rounded-tr-xl border-t border-r", "bottom-0 left-0 rounded-bl-xl border-b border-l", "bottom-0 right-0 rounded-br-xl border-b border-r"] as const).map((cls) => (
              <div key={cls} className={`absolute ${cls} w-5 h-5 border-white/70 pointer-events-none`} />
            ))}
          </div>

          {/* Zoom slider */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] text-white/35 font-mono">1×</span>
            <input
              type="range"
              min={100}
              max={300}
              step={1}
              value={Math.round(crop.scale * 100)}
              onChange={handleZoomSlider}
              className="flex-1 h-1.5 accent-emerald-500"
            />
            <span className="text-[10px] text-white/35 font-mono w-8 text-right">
              {crop.scale.toFixed(1)}×
            </span>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 w-full">
            <span className="text-[10px] text-white/30 mr-1">Quick:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setCrop(p.crop)}
                className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-white/20 text-center">
            Drag to reposition · Scroll or slider to zoom
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10">
          <button
            onClick={() => setCrop(DEFAULT_CROP)}
            className="text-[11px] text-white/35 hover:text-white/60 transition-colors"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-white/12 text-[11px] text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(crop)}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-400 transition-colors"
            >
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
