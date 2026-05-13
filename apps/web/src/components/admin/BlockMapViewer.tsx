"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { parseGeoPdf, geoToCanvasPx, canvasPxToGeo, type GeoPdfMeta } from "@/lib/geopdf";
import { getAllRecords, saveRecord, deleteRecord } from "@/lib/productionDb";

interface Props {
  url: string;
  name: string;
  blockName: string;
  /** Project that owns the block — needed so the Quality form can offer "Return to map". */
  projectId: string;
  /** File id inside the project — used together with projectId to reopen this exact map. */
  fileId: string;
  onClose: () => void;
}

interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

interface MapPin {
  id: string;
  blockName: string;
  lat: number;
  lng: number;
  note: string;
  createdAt: string;
}

// Mirror the QualityPlot shape that DailyProductionReport saves so we can
// surface plots with GPS as read-only markers on this map.
interface QualityPlotLite {
  id: string;
  blockName: string;
  date: string;
  plotNumber: string;
  surveyor: string;
  crewBoss: string;
  treesPlanted: number;
  goodTrees: number;
  prescribedDensity?: number;
  gpsLat?: string;
  gpsLng?: string;
}

interface PopoverState {
  mode: "new" | "existing";
  pinId?: string;       // when editing an existing pin
  lat: number;
  lng: number;
  screenX: number;      // viewport-relative px
  screenY: number;
  note: string;
}

const RENDER_SCALE = 2; // canvas px per PDF point — high enough to look sharp when zoomed in
const DRAG_THRESHOLD = 5; // px — below this, a mouseup counts as a tap, not a pan

export default function BlockMapViewer({ url, name, blockName, projectId, fileId, onClose }: Props) {
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

  // Map pins + linked quality plots, all keyed to this block name.
  const [pins, setPins]           = useState<MapPin[]>([]);
  const [qPlots, setQPlots]       = useState<QualityPlotLite[]>([]);
  const [dropMode, setDropMode]   = useState(false);
  const [popover, setPopover]     = useState<PopoverState | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const [listOpen, setListOpen]   = useState(false);
  const noteInputRef              = useRef<HTMLTextAreaElement | null>(null);

  // Load existing pins + quality plots for this block on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allPins, allPlots] = await Promise.all([
          getAllRecords<MapPin>("map_pins"),
          getAllRecords<QualityPlotLite>("quality_plots"),
        ]);
        if (cancelled) return;
        setPins(allPins.filter(p => p.blockName === blockName));
        setQPlots(
          allPlots.filter(
            p => p.blockName === blockName
              && !!p.gpsLat && !!p.gpsLng
              && !Number.isNaN(parseFloat(p.gpsLat!))
              && !Number.isNaN(parseFloat(p.gpsLng!)),
          ),
        );
      } catch (err) {
        console.warn("[BlockMapViewer] pin/plot load failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [blockName]);

  // Auto-focus the note textarea when the popover opens.
  useEffect(() => {
    if (popover) {
      const t = setTimeout(() => noteInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [popover?.pinId, popover?.mode]);

  function uid() { return `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

  function openExistingPin(pin: MapPin, clientX: number, clientY: number) {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    setPopover({
      mode: "existing",
      pinId: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      screenX: clientX - vp.left,
      screenY: clientY - vp.top,
      note: pin.note,
    });
  }

  function openNewPinAt(lat: number, lng: number, screenX: number, screenY: number) {
    setPopover({ mode: "new", lat, lng, screenX, screenY, note: "" });
  }

  async function savePin() {
    if (!popover) return;
    setSavingPin(true);
    try {
      if (popover.mode === "new") {
        const pin: MapPin = {
          id: uid(),
          blockName,
          lat: popover.lat,
          lng: popover.lng,
          note: popover.note.trim(),
          createdAt: new Date().toISOString(),
        };
        await saveRecord("map_pins", pin);
        setPins(prev => [...prev, pin]);
      } else if (popover.pinId) {
        const existing = pins.find(p => p.id === popover.pinId);
        if (existing) {
          const updated: MapPin = { ...existing, note: popover.note.trim() };
          await saveRecord("map_pins", updated);
          setPins(prev => prev.map(p => p.id === updated.id ? updated : p));
        }
      }
      setPopover(null);
      setDropMode(false);
    } catch (err) {
      console.error("[BlockMapViewer] save pin failed:", err);
      alert("Couldn't save pin — check your connection and try again.");
    } finally {
      setSavingPin(false);
    }
  }

  async function deletePin() {
    if (!popover?.pinId) return;
    if (!confirm("Delete this pin?")) return;
    try {
      await deleteRecord("map_pins", popover.pinId);
      setPins(prev => prev.filter(p => p.id !== popover.pinId));
      setPopover(null);
    } catch (err) {
      console.error("[BlockMapViewer] delete pin failed:", err);
      alert("Couldn't delete pin.");
    }
  }

  function writeReturnContext() {
    try {
      sessionStorage.setItem("return_to_map", JSON.stringify({ projectId, blockName, fileId }));
    } catch { /* ignore */ }
  }

  function createQualityPlotHere() {
    if (!popover) return;
    const draft = {
      block: blockName,
      lat: Number(popover.lat.toFixed(6)),
      lng: Number(popover.lng.toFixed(6)),
    };
    try {
      sessionStorage.setItem("pending_quality_plot", JSON.stringify(draft));
    } catch { /* ignore */ }
    writeReturnContext();
    // Navigate the admin shell to the Production section, then ask the
    // Daily Production component to switch to its Quality tab and prefill.
    window.dispatchEvent(new CustomEvent("admin-nav", { detail: { section: "production" } }));
    window.dispatchEvent(new CustomEvent("prefill-quality-plot", { detail: draft }));
    setPopover(null);
    onClose();
  }

  function editQualityPlot(plot: QualityPlotLite) {
    const draft = { editQualityPlotId: plot.id };
    try {
      sessionStorage.setItem("pending_quality_plot", JSON.stringify(draft));
    } catch { /* ignore */ }
    writeReturnContext();
    window.dispatchEvent(new CustomEvent("admin-nav", { detail: { section: "production" } }));
    window.dispatchEvent(new CustomEvent("prefill-quality-plot", { detail: draft }));
    onClose();
  }

  // Centre the map on a canvas-pixel position. Disables auto-follow so the
  // user's choice sticks until they re-enable Follow.
  const panToCanvasPx = useCallback((canvasX: number, canvasY: number) => {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    setAutoFollow(false);
    setTx(vp.width  / 2 - canvasX * zoom);
    setTy(vp.height / 2 - canvasY * zoom);
  }, [zoom]);

  function focusOnPin(pin: MapPin) {
    if (!meta) return;
    const px = geoToCanvasPx(pin.lat, pin.lng, meta, RENDER_SCALE);
    if (!px) return;
    panToCanvasPx(px.x, px.y);
    // Open the edit popover at the centre of the viewport (where the pin now sits).
    const vp = viewportRef.current?.getBoundingClientRect();
    if (vp) {
      setPopover({
        mode: "existing",
        pinId: pin.id,
        lat: pin.lat,
        lng: pin.lng,
        screenX: vp.width  / 2,
        screenY: vp.height / 2,
        note: pin.note,
      });
    }
    setListOpen(false);
  }

  function focusOnQualityPlot(p: QualityPlotLite) {
    if (!meta || !p.gpsLat || !p.gpsLng) return;
    const lat = parseFloat(p.gpsLat);
    const lng = parseFloat(p.gpsLng);
    const px = geoToCanvasPx(lat, lng, meta, RENDER_SCALE);
    if (!px) return;
    panToCanvasPx(px.x, px.y);
    setListOpen(false);
  }

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

        const parsed = await parseGeoPdf(buf);
        if (cancelled) return;
        if (parsed) {
          setMeta(parsed);
          setHasGeo(true);
        }

        // Lazy-import pdf.js (legacy build — transpiles away modern Map/Set
        // primitives like getOrInsertComputed that crash older Safari/Chrome).
        // Worker is self-hosted under /public so we don't depend on a CDN
        // mirroring whatever pdfjs-dist version we're on.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        console.log(`[BlockMapViewer] pdf.js ${pdfjs.version} (legacy) → fetching PDF`);

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
  // Only follow when the GPS is *inside* the map's registered bounds. If the
  // user is far off-block (e.g. surveying at the camp), following would
  // translate the rendered map clean off the viewport and leave them staring
  // at a blank canvas with just the dot. The off-screen arrow handles that
  // case visually.
  useEffect(() => {
    if (!autoFollow || !dot || !dot.insideMap || !viewportRef.current || !canvasSize) return;
    const vp = viewportRef.current.getBoundingClientRect();
    setTx(vp.width  / 2 - dot.x * zoom);
    setTy(vp.height / 2 - dot.y * zoom);
  }, [dot?.x, dot?.y, dot?.insideMap, autoFollow, zoom, canvasSize]);

  // ── Pan / zoom interactions ────────────────────────────────────────────
  const dragRef  = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ d: number; zoom: number; cx: number; cy: number; tx: number; ty: number } | null>(null);

  function getTouchDistance(a: React.Touch, b: React.Touch) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function getTouchCenter(a: React.Touch, b: React.Touch) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function tryHandleTap(clientX: number, clientY: number) {
    if (!dropMode || !meta) return;
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    const canvasX = (clientX - vp.left - tx) / zoom;
    const canvasY = (clientY - vp.top  - ty) / zoom;
    const geo = canvasPxToGeo(canvasX, canvasY, meta, RENDER_SCALE);
    if (!geo) return;
    openNewPinAt(geo.lat, geo.lng, clientX - vp.left, clientY - vp.top);
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
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty, moved: false };
    setAutoFollow(false);
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
    setTx(dragRef.current.tx + dx);
    setTy(dragRef.current.ty + dy);
  }
  function onMouseUp(e: React.MouseEvent) {
    if (dragRef.current && !dragRef.current.moved) {
      tryHandleTap(e.clientX, e.clientY);
    }
    dragRef.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty, moved: false };
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
      const dx = e.touches[0].clientX - dragRef.current.x;
      const dy = e.touches[0].clientY - dragRef.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
      setTx(dragRef.current.tx + dx);
      setTy(dragRef.current.ty + dy);
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length === 0) {
      // changedTouches has the lifted finger.
      const t = e.changedTouches[0];
      if (t && dragRef.current && !dragRef.current.moved) {
        tryHandleTap(t.clientX, t.clientY);
      }
      dragRef.current = null;
      pinchRef.current = null;
    }
  }

  // Off-screen indicator: arrow when dot is outside visible area. Visible
  // regardless of follow state — if the user is off-block, follow is paused
  // so the arrow is the only hint about where their position is.
  let arrow: { angle: number } | null = null;
  if (dot && viewportRef.current) {
    const vp = viewportRef.current.getBoundingClientRect();
    const dotScreenX = dot.x * zoom + tx;
    const dotScreenY = dot.y * zoom + ty;
    if (dotScreenX < 0 || dotScreenX > vp.width || dotScreenY < 0 || dotScreenY > vp.height) {
      const cx = vp.width / 2, cy = vp.height / 2;
      arrow = { angle: Math.atan2(dotScreenY - cy, dotScreenX - cx) };
    }
  }

  // Render the modal as a portal directly on document.body. Otherwise it's
  // trapped inside whatever stacking context it was mounted in (e.g. the
  // mobile admin shell's content wrapper, which sits below the top/bottom
  // nav bars — that's why map header buttons got hidden behind the bottom
  // tab strip on iPhone).
  if (typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      style={{
        // z higher than the mobile shell's outer container (9999).
        zIndex: 99999,
        // Respect iOS status bar / notch / browser URL bar so the header isn't
        // hidden behind them on iPad Safari and similar.
        paddingTop:    "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft:   "env(safe-area-inset-left)",
        paddingRight:  "env(safe-area-inset-right)",
      }}
    >
      {/* Header — explicit two-row layout so action buttons are always reachable
          on tablets/phones regardless of how the viewport flex math shakes out. */}
      <div className="bg-surface border-b border-border px-3 sm:px-5 py-2 sm:py-3 space-y-2">
        {/* Row 1: title + close. Close is always visible in the top-right. */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">MAP</span>
          <span className="text-xs font-semibold text-text-primary truncate">{blockName}</span>
          <span className="text-[10px] text-text-tertiary truncate hidden lg:inline">{name}</span>
          {hasGeo && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 shrink-0 uppercase tracking-wider">Georef</span>
          )}
          {pos && (
            <span className="text-[10px] text-text-tertiary tabular-nums ml-auto truncate hidden md:inline pr-2">
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)} · ±{pos.accuracy.toFixed(0)} m
            </span>
          )}
          <button
            onClick={onClose}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors text-lg leading-none shrink-0 ${pos ? "" : "ml-auto"}`}
            aria-label="Close map"
          >×</button>
        </div>
        {/* Row 2: action buttons. flex-wrap so they stack on truly narrow widths. */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => { setDropMode(v => !v); if (!dropMode) setAutoFollow(false); }}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              dropMode
                ? "border-amber-400/60 text-amber-400 bg-amber-400/10"
                : "border-border text-text-secondary hover:text-text-primary"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            disabled={!hasGeo || loading}
            title={!hasGeo ? "Map isn't georeferenced — pins need GPS coordinates" : ""}
          >
            {!hasGeo ? "Pin (no GPS)" : dropMode ? "Tap map…" : "+ Pin"}
          </button>
          <button
            onClick={() => setListOpen(v => !v)}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              listOpen
                ? "border-primary/50 text-primary bg-primary/10"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
            disabled={!hasGeo || loading}
          >
            List ({pins.length + qPlots.length})
          </button>
          <button
            onClick={() => { setAutoFollow(v => !v); }}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              autoFollow
                ? "border-primary/50 text-primary bg-primary/10"
                : "border-border text-text-secondary hover:text-text-primary"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            disabled={!dot}
          >
            {autoFollow ? "Following" : "Follow"}
          </button>
          <button
            onClick={fitToScreen}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            Fit
          </button>
          <a
            href={url}
            download={name}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
            title="Download PDF"
          >
            ↓ PDF
          </a>
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
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${zoom})`,
            cursor: dropMode ? "crosshair" : "grab",
          }}
        >
          <canvas ref={canvasRef} className="block" />

          {/* Saved note pins */}
          {meta && pins.map(pin => {
            const px = geoToCanvasPx(pin.lat, pin.lng, meta, RENDER_SCALE);
            if (!px) return null;
            return (
              <button
                key={pin.id}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); openExistingPin(pin, e.clientX, e.clientY); }}
                className="absolute pointer-events-auto"
                style={{
                  left: px.x - 10, top: px.y - 22,
                  width: 20, height: 22,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                title={pin.note || "Map pin"}
              >
                {/* Teardrop pin shape via SVG */}
                <svg viewBox="0 0 20 22" width="20" height="22" style={{ display: "block", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
                  <path d="M10 0 C4.477 0 0 4.477 0 10 C0 17 10 22 10 22 C10 22 20 17 20 10 C20 4.477 15.523 0 10 0 Z" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx="10" cy="9" r="3" fill="#ffffff" />
                </svg>
              </button>
            );
          })}

          {/* Quality plot markers (read-only) */}
          {meta && qPlots.map(p => {
            const lat = parseFloat(p.gpsLat!);
            const lng = parseFloat(p.gpsLng!);
            const px = geoToCanvasPx(lat, lng, meta, RENDER_SCALE);
            if (!px) return null;
            const q = p.treesPlanted > 0 ? (p.goodTrees / p.treesPlanted) * 100 : 0;
            const tip = `Plot ${p.plotNumber || "—"} · ${p.date} · ${p.goodTrees}/${p.treesPlanted} good · ${q.toFixed(0)}%${p.crewBoss ? ` · ${p.crewBoss}` : ""}`;
            return (
              <div
                key={p.id}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                title={tip}
                className="absolute pointer-events-auto"
                style={{
                  left: px.x - 11, top: px.y - 11,
                  width: 22, height: 22,
                }}
              >
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    background: q >= 95 ? "#16a34a" : q >= 85 ? "#f59e0b" : "#dc2626",
                    color: "#ffffff",
                    border: "2px solid #ffffff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                >Q</div>
              </div>
            );
          })}

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
        {!loading && hasGeo && dot && !dot.insideMap && !posError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[11px] px-3 py-1.5 rounded-lg shadow-lg pointer-events-none">
            You&apos;re outside this block&apos;s area — map shown; follow paused.
          </div>
        )}

        {/* Pins / Quality Plots side panel */}
        {listOpen && (
          <div
            className="absolute right-0 top-0 bottom-0 w-80 bg-surface border-l border-border shadow-2xl z-30 flex flex-col"
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs font-semibold text-text-primary">Pins & Plots</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">{blockName}</div>
              </div>
              <button
                onClick={() => setListOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors text-base leading-none"
              >×</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Notes pins */}
              <div className="px-4 py-2 bg-surface-secondary/30 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary border-b border-border/40">
                Notes ({pins.length})
              </div>
              {pins.length === 0 ? (
                <div className="px-4 py-4 text-[11px] text-text-tertiary italic">
                  No pins yet. Tap “+ Pin” then tap the map to add one.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {pins.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(pin => (
                    <button
                      key={pin.id}
                      onClick={() => focusOnPin(pin)}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-secondary/40 transition-colors flex items-start gap-2.5"
                    >
                      <svg viewBox="0 0 20 22" width="16" height="18" className="shrink-0 mt-0.5">
                        <path d="M10 0 C4.477 0 0 4.477 0 10 C0 17 10 22 10 22 C10 22 20 17 20 10 C20 4.477 15.523 0 10 0 Z" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                        <circle cx="10" cy="9" r="3" fill="#ffffff" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-text-primary truncate">
                          {pin.note || <span className="italic text-text-tertiary">(no note)</span>}
                        </div>
                        <div className="text-[10px] text-text-tertiary mt-0.5 tabular-nums">
                          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} · {new Date(pin.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Quality plots */}
              <div className="px-4 py-2 mt-2 bg-surface-secondary/30 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary border-y border-border/40">
                Quality Plots ({qPlots.length})
              </div>
              {qPlots.length === 0 ? (
                <div className="px-4 py-4 text-[11px] text-text-tertiary italic">
                  No quality plots with GPS for this block yet. Drop a pin and tap “Create Quality Plot here”.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {qPlots.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => {
                    const q = p.treesPlanted > 0 ? (p.goodTrees / p.treesPlanted) * 100 : 0;
                    const color = q >= 95 ? "#16a34a" : q >= 85 ? "#f59e0b" : "#dc2626";
                    return (
                      <div key={p.id} className="px-4 py-2.5 flex items-start gap-2.5">
                        <div
                          className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ background: color, border: "1.5px solid #ffffff", boxShadow: "0 0 0 1px rgba(0,0,0,0.2)" }}
                        >Q</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-text-primary truncate">
                            Plot {p.plotNumber || "—"} · {p.goodTrees}/{p.treesPlanted} good ({q.toFixed(0)}%)
                          </div>
                          <div className="text-[10px] text-text-tertiary mt-0.5">
                            {p.date}{p.crewBoss ? ` · ${p.crewBoss}` : ""}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <button
                              onClick={() => focusOnQualityPlot(p)}
                              className="text-[10px] font-medium px-2 py-0.5 rounded border border-border text-text-secondary hover:text-text-primary hover:border-primary/40 transition-colors"
                            >Show on map</button>
                            <button
                              onClick={() => editQualityPlot(p)}
                              className="text-[10px] font-medium px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            >Edit</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pin popover */}
        {popover && (
          <div
            className="absolute z-20 bg-surface border border-border rounded-xl shadow-2xl p-4 w-72"
            style={(() => {
              const vpW = viewportRef.current?.clientWidth  ?? 1000;
              const vpH = viewportRef.current?.clientHeight ?? 800;
              // Place popover above the pin by default; flip below if too close to top.
              const w = 288, h = 200;
              let left = popover.screenX - w / 2;
              let top  = popover.screenY - h - 24;
              if (top < 12)  top  = popover.screenY + 24;
              if (left < 12) left = 12;
              if (left + w > vpW - 12) left = vpW - w - 12;
              if (top + h > vpH - 12)  top  = vpH - h - 12;
              return { left, top };
            })()}
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                {popover.mode === "new" ? "New Pin" : "Pin"}
              </div>
              <div className="text-[10px] text-text-tertiary tabular-nums">
                {popover.lat.toFixed(5)}, {popover.lng.toFixed(5)}
              </div>
            </div>
            <textarea
              ref={noteInputRef}
              value={popover.note}
              onChange={e => setPopover(prev => prev ? { ...prev, note: e.target.value } : prev)}
              placeholder="Add a note…"
              rows={3}
              className="w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-none"
            />
            <div className="flex items-center justify-between gap-2 mt-3">
              {popover.mode === "existing" ? (
                <button
                  onClick={deletePin}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              ) : <div />}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setPopover(null)}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePin}
                  disabled={savingPin}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
                  style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                >
                  {savingPin ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            {/* Hand off to Daily Production → Quality Reports prefilled */}
            <button
              onClick={createQualityPlotHere}
              className="mt-3 w-full text-[11px] font-semibold px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">Q</span>
              Create Quality Plot here
            </button>
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

  return createPortal(modal, document.body);
}
