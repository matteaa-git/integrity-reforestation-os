"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { parseGeoPdf, geoToCanvasPx, type GeoPdfMeta } from "@/lib/geopdf";

interface Props {
  url: string;
  name: string;
  blockName: string;
  onClose: () => void;
}

interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

const RENDER_SCALE = 2; // canvas px per PDF point — high enough to look sharp when zoomed in

export default function BlockMapViewer({ url, name, blockName, onClose }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const viewportRef  = useRef<HTMLDivElement | null>(null);

  const [meta, setMeta]       = useState<GeoPdfMeta | null>(null);
  const [hasGeo, setHasGeo]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [pos, setPos]         = useState<Position | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);

  // Pan/zoom transform applied to the canvas wrapper.
  const [tx, setTx]   = useState(0);
  const [ty, setTy]   = useState(0);
  const [zoom, setZoom] = useState(1);
  const [autoFollow, setAutoFollow] = useState(true);

  // ── Load PDF + parse geo + render to canvas ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Map fetch failed (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const parsed = parseGeoPdf(buf);
        if (parsed) {
          setMeta(parsed);
          setHasGeo(true);
        }

        // Lazy-import pdf.js so it doesn't ship in the main bundle. The worker
        // is self-hosted under /public so we don't depend on a CDN mirroring
        // whatever pdfjs-dist version we're on.
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        console.log(`[BlockMapViewer] pdf.js ${pdfjs.version} → fetching PDF`);

        const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) return;
        console.log(`[BlockMapViewer] doc loaded, pages=${pdfDoc.numPages}`);

        const page = await pdfDoc.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = canvasRef.current;
        if (!canvas) {
          console.warn("[BlockMapViewer] canvas ref missing");
          return;
        }
        canvas.width  = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        console.log(`[BlockMapViewer] rendering ${canvas.width}×${canvas.height}…`);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (cancelled) return;
        console.log("[BlockMapViewer] render complete");
        setCanvasSize({ w: canvas.width, h: canvas.height });

        setLoading(false);
      } catch (err) {
        console.error("[BlockMapViewer] load error:", err);
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Failed to load map: ${msg}`);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  // ── Live geolocation ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPosError("Geolocation isn't available in this browser.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      p => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? 0 });
        setPosError(null);
      },
      err => {
        setPosError(err.code === err.PERMISSION_DENIED
          ? "Location permission denied — enable it in browser settings to see your position."
          : err.message || "Couldn't get your location");
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── Project GPS to canvas px ───────────────────────────────────────────
  const dot = meta && pos
    ? geoToCanvasPx(pos.lat, pos.lng, meta, RENDER_SCALE)
    : null;

  // Accuracy ring in canvas px (approx — 1° lat ≈ 111 km).
  let accuracyPx: number | null = null;
  if (meta && pos && pos.accuracy > 0) {
    const offset = geoToCanvasPx(
      pos.lat + pos.accuracy / 111_320,
      pos.lng,
      meta,
      RENDER_SCALE,
    );
    if (offset && dot) {
      accuracyPx = Math.max(8, Math.abs(offset.y - dot.y));
    }
  }

  // ── Fit-to-screen on first render, and re-fit when canvas first appears ─
  const fitToScreen = useCallback(() => {
    if (!canvasSize || !viewportRef.current) return;
    const vp = viewportRef.current.getBoundingClientRect();
    const s = Math.min(vp.width / canvasSize.w, vp.height / canvasSize.h);
    setZoom(s);
    setTx((vp.width  - canvasSize.w * s) / 2);
    setTy((vp.height - canvasSize.h * s) / 2);
  }, [canvasSize]);

  useEffect(() => { fitToScreen(); }, [fitToScreen]);

  // ── Auto-follow GPS dot ────────────────────────────────────────────────
  useEffect(() => {
    if (!autoFollow || !dot || !viewportRef.current || !canvasSize) return;
    const vp = viewportRef.current.getBoundingClientRect();
    // Position dot at the centre of the viewport.
    setTx(vp.width  / 2 - dot.x * zoom);
    setTy(vp.height / 2 - dot.y * zoom);
  }, [dot?.x, dot?.y, autoFollow, zoom, canvasSize]);

  // ── Pan / zoom interactions ────────────────────────────────────────────
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ d: number; zoom: number; cx: number; cy: number; tx: number; ty: number } | null>(null);

  function getTouchDistance(a: React.Touch, b: React.Touch) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function getTouchCenter(a: React.Touch, b: React.Touch) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(0.1, Math.min(8, zoom * factor));
    // Zoom around cursor position.
    const cx = e.clientX - vp.left;
    const cy = e.clientY - vp.top;
    setTx(cx - (cx - tx) * (newZoom / zoom));
    setTy(cy - (cy - ty) * (newZoom / zoom));
    setZoom(newZoom);
    setAutoFollow(false);
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
    setAutoFollow(false);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    setTx(dragRef.current.tx + (e.clientX - dragRef.current.x));
    setTy(dragRef.current.ty + (e.clientY - dragRef.current.y));
  }
  function onMouseUp() { dragRef.current = null; }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty };
      pinchRef.current = null;
    } else if (e.touches.length === 2) {
      const d = getTouchDistance(e.touches[0], e.touches[1]);
      const c = getTouchCenter(e.touches[0], e.touches[1]);
      pinchRef.current = { d, zoom, cx: c.x, cy: c.y, tx, ty };
      dragRef.current = null;
    }
    setAutoFollow(false);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = getTouchDistance(e.touches[0], e.touches[1]);
      const factor = d / pinchRef.current.d;
      const newZoom = Math.max(0.1, Math.min(8, pinchRef.current.zoom * factor));
      const vp = viewportRef.current?.getBoundingClientRect();
      if (!vp) return;
      const cx = pinchRef.current.cx - vp.left;
      const cy = pinchRef.current.cy - vp.top;
      const ratio = newZoom / pinchRef.current.zoom;
      setTx(cx - (cx - pinchRef.current.tx) * ratio);
      setTy(cy - (cy - pinchRef.current.ty) * ratio);
      setZoom(newZoom);
    } else if (e.touches.length === 1 && dragRef.current) {
      e.preventDefault();
      setTx(dragRef.current.tx + (e.touches[0].clientX - dragRef.current.x));
      setTy(dragRef.current.ty + (e.touches[0].clientY - dragRef.current.y));
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length === 0) {
      dragRef.current = null;
      pinchRef.current = null;
    }
  }

  // Off-screen indicator: arrow when dot is outside visible area.
  let arrow: { angle: number } | null = null;
  if (dot && viewportRef.current && !autoFollow) {
    const vp = viewportRef.current.getBoundingClientRect();
    const dotScreenX = dot.x * zoom + tx;
    const dotScreenY = dot.y * zoom + ty;
    if (dotScreenX < 0 || dotScreenX > vp.width || dotScreenY < 0 || dotScreenY > vp.height) {
      const cx = vp.width / 2, cy = vp.height / 2;
      arrow = { angle: Math.atan2(dotScreenY - cy, dotScreenX - cx) };
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="bg-surface border-b border-border px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">MAP</span>
          <span className="text-xs font-semibold text-text-primary truncate">{blockName}</span>
          <span className="text-[10px] text-text-tertiary truncate hidden sm:inline">{name}</span>
          {hasGeo && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 shrink-0 uppercase tracking-wider">Georef</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pos && (
            <span className="text-[10px] text-text-tertiary tabular-nums hidden md:inline">
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} · ±{pos.accuracy.toFixed(0)} m
            </span>
          )}
          <button
            onClick={() => { setAutoFollow(v => !v); }}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              autoFollow
                ? "border-primary/50 text-primary bg-primary/10"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
            disabled={!dot}
            title={dot ? "" : "Waiting for location"}
          >
            {autoFollow ? "Following" : "Follow"}
          </button>
          <button
            onClick={fitToScreen}
            className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            Fit
          </button>
          <a
            href={url}
            download={name}
            className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            ↓
          </a>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        className="flex-1 relative overflow-hidden bg-surface-secondary touch-none select-none"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate3d(${tx}px, ${ty}px, 0) scale(${zoom})` }}
        >
          <canvas ref={canvasRef} className="block" />

          {/* Accuracy ring + dot, in canvas-pixel coordinate space */}
          {dot && (
            <>
              {accuracyPx && (
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: dot.x - accuracyPx,
                    top:  dot.y - accuracyPx,
                    width:  accuracyPx * 2,
                    height: accuracyPx * 2,
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.45)",
                  }}
                />
              )}
              <div
                className="absolute rounded-full pointer-events-none shadow-lg"
                style={{
                  left: dot.x - 8,
                  top:  dot.y - 8,
                  width: 16,
                  height: 16,
                  background: "#3b82f6",
                  border: "3px solid #ffffff",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.5)",
                }}
              />
            </>
          )}
        </div>

        {/* Status overlays */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-text-tertiary bg-surface-secondary">
            Loading map…
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400">
            {error}
          </div>
        )}
        {!loading && !hasGeo && !error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[11px] px-3 py-1.5 rounded-lg shadow-lg">
            This map isn&apos;t georeferenced — live location can&apos;t be plotted.
          </div>
        )}
        {!loading && hasGeo && posError && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[11px] px-3 py-1.5 rounded-lg shadow-lg">
            {posError}
          </div>
        )}

        {/* Off-screen arrow when not auto-following */}
        {arrow && viewportRef.current && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: viewportRef.current.clientWidth  / 2,
              top:  viewportRef.current.clientHeight / 2,
              transform: `translate(-50%, -50%) rotate(${(arrow.angle * 180) / Math.PI}deg)`,
            }}
          >
            <div
              className="absolute rounded-full shadow-lg"
              style={{
                left: 100,
                top: -8,
                width: 16,
                height: 16,
                background: "#3b82f6",
                border: "3px solid #ffffff",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
