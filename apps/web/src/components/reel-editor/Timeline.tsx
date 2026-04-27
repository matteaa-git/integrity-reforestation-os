"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftAssetEntry } from "@/lib/api";
import type { ClipTrim, Caption, TextOverlay } from "./types";
import { formatTime, CAPTION_STYLES } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Minimum timeline width per second in pixels
const PX_PER_SEC_MIN = 20;
const PX_PER_SEC_MAX = 120;

interface TimelineProps {
  frames: DraftAssetEntry[];
  clipTrims: Record<string, ClipTrim>;
  captions: Caption[];
  textOverlays: TextOverlay[];
  musicTrack: { id: string; filename: string; duration: number | null } | null;
  musicStartOffset: number;
  selectedClipIndex: number;
  selectedCaptionId: string | null;
  selectedTextId: string | null;
  currentTime: number; // global timeline time
  totalDuration: number;
  isPlaying: boolean;
  onSelectClip: (index: number) => void;
  onSelectCaption: (id: string | null) => void;
  onSelectText: (id: string | null) => void;
  onSeek: (time: number) => void;
  onReorderClips: (from: number, to: number) => void;
  onSplitClip: (index: number, atTime: number) => void;
  onTrimClip: (clipIndex: number, updates: { inPoint?: number; outPoint?: number | null }) => void;
  getClipDuration: (clip: DraftAssetEntry) => number;
  clipRoles?: Record<string, string>;
}

export default function Timeline({
  frames,
  clipTrims,
  captions,
  textOverlays,
  musicTrack,
  musicStartOffset,
  selectedClipIndex,
  selectedCaptionId,
  selectedTextId,
  currentTime,
  totalDuration,
  isPlaying,
  onSelectClip,
  onSelectCaption,
  onSelectText,
  onSeek,
  onReorderClips,
  onSplitClip,
  onTrimClip,
  getClipDuration,
  clipRoles,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1); // 1x = default
  const [dragClipIndex, setDragClipIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [trimDrag, setTrimDrag] = useState<{
    clipIndex: number;
    edge: "left" | "right";
    startX: number;
    startValue: number;
    rawDuration: number; // full clip duration without trims
  } | null>(null);

  const effectiveDuration = Math.max(totalDuration, 1);
  const pxPerSec = Math.min(PX_PER_SEC_MAX, Math.max(PX_PER_SEC_MIN, 40 * zoom));
  const timelineWidth = effectiveDuration * pxPerSec;

  // Auto-scroll to playhead during playback
  useEffect(() => {
    if (!isPlaying || !containerRef.current) return;
    const playheadX = (currentTime / effectiveDuration) * timelineWidth;
    const container = containerRef.current;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (playheadX < viewLeft + 40 || playheadX > viewRight - 40) {
      container.scrollTo({ left: playheadX - container.clientWidth / 2, behavior: "smooth" });
    }
  }, [currentTime, isPlaying, effectiveDuration, timelineWidth]);

  // Scrub handler
  const handleScrub = useCallback((e: React.MouseEvent | React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const time = Math.max(0, Math.min(effectiveDuration, (x / timelineWidth) * effectiveDuration));
    onSeek(time);
  }, [effectiveDuration, timelineWidth, onSeek]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-clip]") || (e.target as HTMLElement).closest("[data-layer]")) return;
    setIsScrubbing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handleScrub(e);
  }, [handleScrub]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (trimDrag) {
      const deltaX = e.clientX - trimDrag.startX;
      const deltaSec = deltaX / pxPerSec;
      const clip = frames[trimDrag.clipIndex];
      const rawDur = trimDrag.rawDuration;
      const trim = clipTrims[clip.id];
      if (trimDrag.edge === "left") {
        const currentOut = trim?.outPoint ?? rawDur;
        const newIn = Math.max(0, Math.min(currentOut - 0.1, trimDrag.startValue + deltaSec));
        onTrimClip(trimDrag.clipIndex, { inPoint: Math.round(newIn * 10) / 10 });
      } else {
        const currentIn = trim?.inPoint ?? 0;
        const newOut = Math.max(currentIn + 0.1, Math.min(rawDur, trimDrag.startValue + deltaSec));
        onTrimClip(trimDrag.clipIndex, { outPoint: Math.round(newOut * 10) / 10 });
      }
      return;
    }
    if (!isScrubbing) return;
    handleScrub(e);
  }, [isScrubbing, handleScrub, trimDrag, pxPerSec, frames, clipTrims, onTrimClip]);

  const handlePointerUp = useCallback(() => {
    setIsScrubbing(false);
    setTrimDrag(null);
  }, []);

  // Build clip start offsets
  const clipOffsets: number[] = [];
  let offset = 0;
  for (const clip of frames) {
    clipOffsets.push(offset);
    offset += getClipDuration(clip);
  }

  // Find which clip the playhead is on and local time within it
  const playheadClipInfo = (() => {
    let acc = 0;
    for (let i = 0; i < frames.length; i++) {
      const dur = getClipDuration(frames[i]);
      if (currentTime < acc + dur) {
        return { clipIndex: i, localTime: currentTime - acc };
      }
      acc += dur;
    }
    return frames.length > 0 ? { clipIndex: frames.length - 1, localTime: 0 } : null;
  })();

  // Time ruler ticks
  const ticks: number[] = [];
  const tickInterval = zoom >= 2 ? 0.5 : zoom >= 1 ? 1 : 2;
  for (let t = 0; t <= effectiveDuration; t += tickInterval) {
    ticks.push(t);
  }

  return (
    <div className="flex flex-col bg-[#1a1a2e] border-t border-[#2a2a4a]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1e38] border-b border-[#2a2a4a]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">Timeline</span>
          <span className="text-[10px] text-white/40 font-mono">{formatTime(currentTime)} / {formatTime(effectiveDuration)}</span>
          {playheadClipInfo && playheadClipInfo.localTime > 0.1 && (
            <button
              onClick={() => onSplitClip(playheadClipInfo.clipIndex, playheadClipInfo.localTime)}
              className="px-2 py-0.5 rounded text-[10px] font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 transition-colors flex items-center gap-1"
              title="Split clip at playhead (S)"
            >
              <span className="text-[9px]">✂</span> Split
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="w-6 h-5 rounded text-[10px] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-[9px] text-white/50 font-mono w-8 text-center">{zoom.toFixed(1)}x</span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="w-6 h-5 rounded text-[10px] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline body */}
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden relative cursor-crosshair select-none"
        style={{ height: "180px" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="relative" style={{ width: `${timelineWidth}px`, height: "100%" }}>
          {/* Time ruler */}
          <div className="absolute top-0 left-0 right-0 h-5 bg-[#16162b] border-b border-[#2a2a4a]">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 h-full flex flex-col items-center"
                style={{ left: `${(t / effectiveDuration) * 100}%` }}
              >
                <div className="w-px h-2 bg-white/20 mt-auto" />
                <span className="text-[8px] text-white/30 font-mono leading-none">{formatTime(t)}</span>
              </div>
            ))}
          </div>

          {/* ── Video track ── */}
          <div className="absolute left-0 right-0" style={{ top: "20px", height: "48px" }}>
            <div className="absolute -left-0 top-1/2 -translate-y-1/2 text-[8px] text-white/30 font-semibold uppercase tracking-wider" style={{ left: "-2px", writingMode: "vertical-rl", transform: "rotate(180deg) translateX(50%)" }}>
            </div>
            {frames.map((clip, i) => {
              const clipDur = getClipDuration(clip);
              const startPct = (clipOffsets[i] / effectiveDuration) * 100;
              const widthPct = (clipDur / effectiveDuration) * 100;
              return (
                <div
                  key={clip.id}
                  data-clip
                  draggable
                  onDragStart={() => setDragClipIndex(i)}
                  onDragOver={(e) => { e.preventDefault(); setDropTargetIndex(i); }}
                  onDragLeave={() => setDropTargetIndex(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragClipIndex !== null && dragClipIndex !== i) onReorderClips(dragClipIndex, i);
                    setDragClipIndex(null);
                    setDropTargetIndex(null);
                  }}
                  onDragEnd={() => { setDragClipIndex(null); setDropTargetIndex(null); }}
                  onClick={(e) => { e.stopPropagation(); onSelectClip(i); }}
                  className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-pointer transition-all group ${
                    i === selectedClipIndex
                      ? "ring-2 ring-[#39de8b] shadow-lg shadow-[#39de8b]/20"
                      : dropTargetIndex === i
                      ? "ring-2 ring-white/40"
                      : "ring-1 ring-white/10 hover:ring-white/30"
                  } ${dragClipIndex === i ? "opacity-40" : ""}`}
                  style={{ left: `${startPct}%`, width: `${widthPct}%`, minWidth: "24px" }}
                >
                  {/* Clip background gradient */}
                  <div className={`absolute inset-0 ${
                    i === selectedClipIndex ? "bg-gradient-to-b from-[#39de8b]/30 to-[#39de8b]/10" : "bg-gradient-to-b from-white/10 to-white/5"
                  }`} />

                  {/* Thumbnail preview */}
                  {clip.asset.media_type === "video" ? (
                    <video
                      src={`${API_BASE}/assets/${clip.asset_id}/file`}
                      className="absolute inset-0 w-full h-full object-cover opacity-40"
                      muted
                      preload="none"
                    />
                  ) : (
                    <img
                      src={`${API_BASE}/assets/${clip.asset_id}/file`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-40"
                    />
                  )}

                  {/* Clip info overlay */}
                  <div className="absolute inset-0 flex flex-col justify-center px-1.5 z-10">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[8px] font-bold text-white/80 bg-black/30 px-1 rounded shrink-0">{i + 1}</span>
                      <span className="text-[9px] text-white/70 truncate">{clip.asset.filename}</span>
                    </div>
                    {clipRoles?.[clip.id] && (
                      <span className="text-[7px] font-bold uppercase tracking-wide text-white/60 bg-white/15 rounded px-1 mt-0.5 self-start truncate">
                        {clipRoles[clip.id]}
                      </span>
                    )}
                  </div>

                  {/* Duration label */}
                  <div className="absolute bottom-0.5 right-1 z-10">
                    <span className="text-[8px] font-mono text-white/50">{formatTime(clipDur)}</span>
                  </div>

                  {/* Trim handles */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 bg-white/0 hover:bg-[#39de8b]/60 cursor-col-resize transition-colors rounded-l z-20"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const trim = clipTrims[clip.id];
                      setTrimDrag({
                        clipIndex: i,
                        edge: "left",
                        startX: e.clientX,
                        startValue: trim?.inPoint ?? 0,
                        rawDuration: clip.asset.duration ?? 0,
                      });
                      containerRef.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 bg-white/0 hover:bg-[#39de8b]/60 cursor-col-resize transition-colors rounded-r z-20"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const trim = clipTrims[clip.id];
                      const rawDur = clip.asset.duration ?? 0;
                      setTrimDrag({
                        clipIndex: i,
                        edge: "right",
                        startX: e.clientX,
                        startValue: trim?.outPoint ?? rawDur,
                        rawDuration: rawDur,
                      });
                      containerRef.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* ── Caption track ── */}
          <div className="absolute left-0 right-0" style={{ top: "72px", height: "28px" }}>
            {captions.map((cap) => {
              const startPct = (cap.startTime / effectiveDuration) * 100;
              const widthPct = ((cap.endTime - cap.startTime) / effectiveDuration) * 100;
              return (
                <div
                  key={cap.id}
                  data-layer
                  onClick={(e) => { e.stopPropagation(); onSelectCaption(cap.id); }}
                  className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                    cap.id === selectedCaptionId
                      ? "bg-amber-400/40 ring-1 ring-amber-400"
                      : "bg-amber-400/20 hover:bg-amber-400/30"
                  }`}
                  style={{ left: `${startPct}%`, width: `${widthPct}%`, minWidth: "8px" }}
                  title={cap.text || "Caption"}
                >
                  <div className="px-1 flex items-center h-full overflow-hidden">
                    <span className="text-[8px] text-white/80 truncate">{cap.text || "Cc"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Text overlay track ── */}
          <div className="absolute left-0 right-0" style={{ top: "104px", height: "28px" }}>
            {textOverlays.map((txt) => {
              const startPct = (txt.startTime / effectiveDuration) * 100;
              const widthPct = ((txt.endTime - txt.startTime) / effectiveDuration) * 100;
              return (
                <div
                  key={txt.id}
                  data-layer
                  onClick={(e) => { e.stopPropagation(); onSelectText(txt.id); }}
                  className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                    txt.id === selectedTextId
                      ? "bg-blue-400/40 ring-1 ring-blue-400"
                      : "bg-blue-400/20 hover:bg-blue-400/30"
                  }`}
                  style={{ left: `${startPct}%`, width: `${widthPct}%`, minWidth: "8px" }}
                  title={txt.text}
                >
                  <div className="px-1 flex items-center h-full overflow-hidden">
                    <span className="text-[8px] text-white/80 truncate">T: {txt.text}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Music track ── */}
          {musicTrack && (
            <div className="absolute left-0 right-0" style={{ top: "136px", height: "28px" }}>
              <div
                className="absolute top-1 bottom-1 rounded bg-purple-500/20 border border-purple-500/30"
                style={{
                  left: `${(musicStartOffset / effectiveDuration) * 100}%`,
                  width: `${((musicTrack.duration ?? effectiveDuration) / effectiveDuration) * 100}%`,
                }}
              >
                <div className="px-1.5 flex items-center h-full gap-1 overflow-hidden">
                  <span className="text-[9px] text-purple-300">♪</span>
                  <span className="text-[8px] text-purple-200/70 truncate">{musicTrack.filename}</span>
                </div>
                {/* Fake waveform */}
                <div className="absolute inset-0 flex items-center px-1 opacity-30">
                  {Array.from({ length: 40 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-purple-400 mx-px rounded-full"
                      style={{ height: `${20 + Math.sin(i * 0.7) * 15 + Math.random() * 20}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Track labels */}
          <div className="absolute left-1 z-20 pointer-events-none" style={{ top: "20px" }}>
            <div className="h-[48px] flex items-center"><span className="text-[8px] font-semibold text-white/30 uppercase">Video</span></div>
            <div className="h-[28px] flex items-center"><span className="text-[8px] font-semibold text-amber-400/40 uppercase">Captions</span></div>
            <div className="h-[28px] flex items-center"><span className="text-[8px] font-semibold text-blue-400/40 uppercase">Text</span></div>
            <div className="h-[28px] flex items-center"><span className="text-[8px] font-semibold text-purple-400/40 uppercase">Music</span></div>
          </div>

          {/* ── Playhead ── */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none"
            style={{ left: `${(currentTime / effectiveDuration) * 100}%` }}
          >
            {/* Top indicator */}
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500" />
            {/* Line */}
            <div className="absolute top-0 bottom-0 w-px bg-red-500 left-1/2 -translate-x-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}
