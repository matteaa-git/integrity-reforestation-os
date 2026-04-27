"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DraftAssetEntry } from "@/lib/api";
import type { TextLayer } from "./TextOverlay";
import { DraggableText } from "./TextOverlay";
import type { CropData } from "./ImageCropModal";
import type { PhotoEdits } from "./photoEdits";
import { DEFAULT_PHOTO_EDITS, computePhotoFilter } from "./photoEdits";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface VideoEdits {
  trimStart: number; // seconds
  trimEnd: number;   // seconds (0 = use full duration)
  muted: boolean;
}

export const DEFAULT_VIDEO_EDITS: VideoEdits = { trimStart: 0, trimEnd: 0, muted: true };

interface StoryCanvasProps {
  frame: DraftAssetEntry | null;
  frameIndex: number;
  totalFrames: number;
  textLayers: TextLayer[];
  selectedTextLayerId: string | null;
  onSelectTextLayer: (id: string | null) => void;
  onMoveTextLayer: (id: string, x: number, y: number) => void;
  onResizeTextLayer: (id: string, width: number) => void;
  showSafeZone: boolean;
  photoEdits?: PhotoEdits;
  zoom: number;
  cropData?: CropData | null;
  videoEdits?: VideoEdits;
}

export default function StoryCanvas({
  frame,
  frameIndex,
  totalFrames,
  textLayers,
  selectedTextLayerId,
  onSelectTextLayer,
  onMoveTextLayer,
  onResizeTextLayer,
  showSafeZone,
  photoEdits = DEFAULT_PHOTO_EDITS,
  zoom,
  cropData,
  videoEdits = DEFAULT_VIDEO_EDITS,
}: StoryCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canvasHeight, setCanvasHeight] = useState(640);
  const [isPlaying, setIsPlaying] = useState(false);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    setCanvasHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setCanvasHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync video trim / mute whenever edits or frame changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = videoEdits.muted;
    vid.currentTime = videoEdits.trimStart;
    setIsPlaying(false);
  }, [frame?.asset_id, videoEdits.trimStart, videoEdits.muted]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.pause();
      setIsPlaying(false);
    } else {
      vid.currentTime = videoEdits.trimStart;
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const filterStyle = computePhotoFilter(photoEdits);
  const vignetteOpacity = photoEdits.vignette / 100;

  // Empty state
  if (!frame && totalFrames === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-52 aspect-[9/16] rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto mb-5 bg-white/50">
            <div className="text-center px-6">
              <div className="w-10 h-10 rounded-xl bg-surface-secondary flex items-center justify-center mx-auto mb-3">
                <span className="text-lg text-text-tertiary">+</span>
              </div>
              <div className="text-xs text-text-tertiary leading-relaxed">
                Select assets from the library to build your story
              </div>
            </div>
          </div>
          <div className="text-[11px] text-text-tertiary">
            Tip: Click any asset in the left panel to add it as a frame
          </div>
        </div>
      </div>
    );
  }

  if (!frame) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        ref={canvasRef}
        className="relative h-full max-h-[640px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl bg-black transition-transform"
        style={{ transform: `scale(${zoom / 100})` }}
        onClick={() => onSelectTextLayer(null)}
      >
        {/* Image / video placeholder */}
        {frame.asset.media_type === "image" ? (
          <img
            src={`${API_BASE}/assets/${frame.asset_id}/file`}
            alt={frame.asset.filename}
            className="w-full h-full object-cover"
            style={{
              filter: filterStyle,
              ...(cropData
                ? {
                    transform: `translate(${cropData.offsetX}%, ${cropData.offsetY}%) scale(${cropData.scale})`,
                    transformOrigin: "center",
                  }
                : {}),
            }}
            draggable={false}
          />
        ) : (
          <>
            <video
              ref={videoRef}
              src={`${API_BASE}/assets/${frame.asset_id}/file`}
              className="w-full h-full object-cover"
              style={{ filter: filterStyle }}
              muted={videoEdits.muted}
              playsInline
              loop
              preload="metadata"
              onTimeUpdate={() => {
                const vid = videoRef.current;
                if (!vid) return;
                const end = videoEdits.trimEnd > 0
                  ? videoEdits.trimEnd
                  : (frame.asset.duration ?? Infinity);
                if (vid.currentTime >= end) {
                  vid.currentTime = videoEdits.trimStart;
                  if (!vid.loop) vid.pause();
                }
              }}
              onEnded={() => setIsPlaying(false)}
            />
            {/* Play / Pause overlay button */}
            <button
              onClick={togglePlay}
              className={`absolute inset-0 flex items-center justify-center z-20 transition-opacity ${
                isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white text-xl">{isPlaying ? "⏸" : "▶"}</span>
              </div>
            </button>
          </>
        )}

        {/* Vignette overlay */}
        {vignetteOpacity > 0 && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
              opacity: vignetteOpacity,
            }}
          />
        )}

        {/* Instagram-style progress bars */}
        {totalFrames > 1 && (
          <div className="absolute top-3 left-0 right-0 flex gap-1 px-4 z-30">
            {Array.from({ length: totalFrames }).map((_, i) => (
              <div
                key={i}
                className={`h-[2px] flex-1 rounded-full transition-colors ${
                  i === frameIndex ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        {/* Safe zone overlay */}
        {showSafeZone && (
          <div className="absolute inset-0 pointer-events-none z-20">
            <div className="absolute inset-[10%] border border-yellow-400/40 rounded-lg" />
            <div className="absolute inset-[5%] border border-red-400/30 rounded-lg" />
            <div className="absolute top-0 left-0 right-0 h-[14%] bg-red-500/5 border-b border-red-400/20" />
            <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-red-500/5 border-t border-red-400/20" />
            <div className="absolute top-[5.5%] right-[6%] text-[8px] text-yellow-400/60">Action Safe</div>
            <div className="absolute top-[10.5%] right-[11%] text-[8px] text-yellow-400/60">Title Safe</div>
          </div>
        )}

        {/* Text layers */}
        {textLayers.map((layer) => (
          <DraggableText
            key={layer.id}
            layer={layer}
            isSelected={layer.id === selectedTextLayerId}
            canvasRef={canvasRef}
            canvasHeight={canvasHeight}
            onSelect={() => onSelectTextLayer(layer.id)}
            onMove={(x, y) => onMoveTextLayer(layer.id, x, y)}
            onResize={(w) => onResizeTextLayer(layer.id, w)}
          />
        ))}

        {/* Frame counter badge */}
        <div className="absolute bottom-3 right-3 z-30">
          <span className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
            {frameIndex + 1} / {totalFrames}
          </span>
        </div>
      </div>
    </div>
  );
}
