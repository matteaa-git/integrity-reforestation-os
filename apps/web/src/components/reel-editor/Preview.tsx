"use client";

import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Asset, DraftAssetEntry } from "@/lib/api";
import type { ClipEffects, TextOverlay, Caption } from "./types";
import { DEFAULT_EFFECTS, CAPTION_STYLES, formatTime } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REFERENCE_CANVAS_HEIGHT = 580;

interface DraggableTextProps {
  overlay: TextOverlay;
  isSelected: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  canvasHeight: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number) => void;
}

function DraggableText({ overlay, isSelected, canvasRef, canvasHeight, onSelect, onMove, onResize }: DraggableTextProps) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ clientX: 0, width: 80, canvasWidth: 1 });
  const scale = canvasHeight > 0 ? canvasHeight / REFERENCE_CANVAS_HEIGHT : 1;
  const scaledFontSize = Math.max(8, Math.round(overlay.fontSize * scale));

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    setDragging(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (overlay.x / 100) * rect.width,
      y: e.clientY - (overlay.y / 100) * rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [canvasRef, overlay.x, overlay.y, onSelect]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(100, ((e.clientX - dragOffset.current.x) / rect.width) * 100));
    const ny = Math.max(0, Math.min(100, ((e.clientY - dragOffset.current.y) / rect.height) * 100));
    onMove(nx, ny);
  }, [dragging, canvasRef, onMove]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeStart.current = {
      clientX: e.clientX,
      width: overlay.width ?? 80,
      canvasWidth: canvas.getBoundingClientRect().width,
    };
    setResizing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [canvasRef, overlay.width]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizing) return;
    const delta = e.clientX - resizeStart.current.clientX;
    const deltaPercent = (delta / resizeStart.current.canvasWidth) * 100 * 2;
    const newWidth = Math.max(10, Math.min(100, resizeStart.current.width + deltaPercent));
    onResize(Math.round(newWidth));
  }, [resizing, onResize]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    setResizing(false);
  }, []);

  const textShadow = overlay.dropShadow ? "0 2px 8px rgba(0,0,0,0.6)" : "none";
  const bgPadding = overlay.bgStyle !== "none" ? "4px 12px" : undefined;
  const bgRadius = overlay.bgStyle === "pill" ? "9999px" : overlay.bgStyle === "block" ? "6px" : undefined;
  const bgColorVal = overlay.bgStyle !== "none" ? overlay.bgColor : "transparent";
  const layerWidth = overlay.width ?? 80;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={resizing ? handleResizePointerMove : handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute select-none touch-none"
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        width: `${layerWidth}%`,
        transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
        cursor: dragging ? "grabbing" : "grab",
        zIndex: isSelected ? 25 : 15,
      }}
    >
      <div
        className={`whitespace-pre-wrap w-full ${isSelected ? "ring-2 ring-blue-400 ring-offset-1 rounded" : ""}`}
        style={{
          fontFamily: overlay.fontFamily,
          fontSize: `${scaledFontSize}px`,
          fontWeight: overlay.fontWeight,
          color: overlay.color,
          opacity: overlay.opacity,
          textAlign: overlay.textAlign,
          textShadow,
          padding: bgPadding,
          borderRadius: bgRadius,
          backgroundColor: bgColorVal,
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {overlay.text || "\u00A0"}
      </div>

      {/* Resize handle */}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-6 rounded-sm bg-blue-500 border border-white shadow-lg cursor-ew-resize z-30 flex items-center justify-center"
          style={{ touchAction: "none" }}
        >
          <div className="w-0.5 h-2 bg-white/80 rounded-full" />
        </div>
      )}
    </div>
  );
}

interface PreviewProps {
  activeClip: DraftAssetEntry | null;
  clipCount: number;
  selectedClipIndex: number;
  clipEffects: Record<string, ClipEffects>;
  textOverlays: TextOverlay[];
  selectedTextId: string | null;
  hookText: string;
  ctaText: string;
  activeCaption: Caption | undefined;
  musicTrack: Asset | null;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  onTogglePlayback: () => void;
  onSelectText: (id: string | null) => void;
  onMoveText: (id: string, x: number, y: number) => void;
  onResizeText: (id: string, width: number) => void;
}

const Preview = forwardRef<HTMLVideoElement, PreviewProps>(function Preview(
  {
    activeClip,
    clipCount,
    selectedClipIndex,
    clipEffects,
    textOverlays,
    selectedTextId,
    hookText,
    ctaText,
    activeCaption,
    musicTrack,
    isPlaying,
    currentTime,
    totalDuration,
    onTogglePlayback,
    onSelectText,
    onMoveText,
    onResizeText,
  },
  videoRef
) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasHeight, setCanvasHeight] = useState(580);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    setCanvasHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setCanvasHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effects = activeClip ? (clipEffects[activeClip.id] ?? DEFAULT_EFFECTS) : DEFAULT_EFFECTS;

  const filterStyle = [
    effects.brightness !== 100 && `brightness(${effects.brightness / 100})`,
    effects.contrast !== 100 && `contrast(${effects.contrast / 100})`,
    effects.saturation !== 100 && `saturate(${effects.saturation / 100})`,
    effects.hueRotate && `hue-rotate(${effects.hueRotate}deg)`,
    effects.sepia && `sepia(${effects.sepia / 100})`,
  ].filter(Boolean).join(" ") || "none";

  const zoomScale = effects.zoom / 100;
  const hasTransform = zoomScale !== 1 || effects.panX !== 0 || effects.panY !== 0;
  const transformStyle = hasTransform
    ? `scale(${zoomScale}) translate(${effects.panX}%, ${effects.panY}%)`
    : undefined;

  // Visible text overlays based on current time
  const visibleTexts = textOverlays.filter(
    (t) => currentTime >= t.startTime && currentTime < t.endTime
  );

  if (!activeClip) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-52 aspect-[9/16] rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto mb-5 bg-white/50">
            <div className="text-center px-6">
              <div className="w-10 h-10 rounded-xl bg-surface-secondary flex items-center justify-center mx-auto mb-3">
                <span className="text-lg text-text-tertiary">▶</span>
              </div>
              <div className="text-xs text-text-tertiary leading-relaxed">
                Select a video from the library to start building your reel
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div
        ref={canvasRef}
        className="relative h-full max-h-[580px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl bg-black"
        onClick={(e) => {
          // Click on canvas background deselects text
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "VIDEO" || (e.target as HTMLElement).tagName === "IMG") {
            onSelectText(null);
          }
        }}
      >
        {/* Video/Image with effects */}
        {activeClip.asset.media_type === "video" ? (
          <video
            ref={videoRef}
            key={activeClip.asset_id}
            src={`${API_BASE}/assets/${activeClip.asset_id}/file`}
            className="w-full h-full object-cover"
            style={{
              filter: filterStyle,
              transform: transformStyle,
              transformOrigin: "center center",
            }}
            playsInline
            onClick={onTogglePlayback}
          />
        ) : (
          <img
            src={`${API_BASE}/assets/${activeClip.asset_id}/file`}
            alt={activeClip.asset.filename}
            className="w-full h-full object-cover"
            style={{
              filter: filterStyle,
              transform: transformStyle,
              transformOrigin: "center center",
            }}
          />
        )}

        {/* Clip counter badge */}
        {clipCount > 1 && (
          <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full z-10 font-semibold">
            {selectedClipIndex + 1} / {clipCount}
          </div>
        )}

        {/* Hook text overlay */}
        {hookText && (
          <div className="absolute top-12 inset-x-0 flex justify-center z-10 px-4">
            <div className="bg-black/70 text-white text-sm font-bold px-4 py-2 rounded-lg text-center max-w-[85%] backdrop-blur-sm">
              {hookText}
            </div>
          </div>
        )}

        {/* Active caption overlay */}
        {activeCaption && (
          <div className="absolute bottom-16 inset-x-0 flex justify-center z-10 px-4">
            <div className={CAPTION_STYLES[activeCaption.style].previewClass + " text-center max-w-[85%] backdrop-blur-sm"}>
              {activeCaption.text}
            </div>
          </div>
        )}

        {/* CTA overlay */}
        {ctaText && (
          <div className="absolute bottom-6 inset-x-0 flex justify-center z-10 px-4">
            <div className="bg-[#39de8b] text-[#002a27] text-xs font-bold px-5 py-2 rounded-full shadow-lg">
              {ctaText}
            </div>
          </div>
        )}

        {/* Text overlays */}
        {visibleTexts.map((txt) => (
          <DraggableText
            key={txt.id}
            overlay={txt}
            isSelected={txt.id === selectedTextId}
            canvasRef={canvasRef}
            canvasHeight={canvasHeight}
            onSelect={() => onSelectText(txt.id)}
            onMove={(x, y) => onMoveText(txt.id, x, y)}
            onResize={(w) => onResizeText(txt.id, w)}
          />
        ))}

        {/* Music indicator */}
        {musicTrack && (
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 z-10">
            <span className={isPlaying ? "animate-pulse" : ""}>♪</span>
            <span className="truncate max-w-[80px]">{musicTrack.filename}</span>
          </div>
        )}

        {/* Play button overlay */}
        {activeClip.asset.media_type === "video" && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <span className="text-white text-2xl ml-1">▶</span>
            </div>
          </div>
        )}

        {/* Timeline position indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <div
            className="h-full bg-[#39de8b] transition-all"
            style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
});

export default Preview;
