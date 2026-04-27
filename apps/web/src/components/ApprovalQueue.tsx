"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Draft, DraftAssetEntry, DraftStatus } from "@/lib/api";
import {
  approveDraft,
  copyAsCarousel,
  fetchDraft,
  fetchDrafts,
  rejectDraft,
  returnToDraft,
  submitForReview,
} from "@/lib/api";
import DraftStatusBadge from "@/components/DraftStatusBadge";
import SchedulePanel from "@/components/SchedulePanel";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

// ─── Shared text overlay renderer ────────────────────────────────────────────
interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  width?: number;   // percentage of canvas width
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  opacity: number;
  textAlign: string;
  rotation: number;
  dropShadow: boolean;
  bgStyle: "none" | "pill" | "block";
  bgColor: string;
}

const REFERENCE_CANVAS_HEIGHT = 640;

function TextLayersOverlay({ layers, containerRef }: { layers: TextLayer[]; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetHeight / REFERENCE_CANVAS_HEIGHT);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  if (!layers.length) return null;
  return (
    <>
      {layers.map((layer) => (
        <div
          key={layer.id}
          className="absolute pointer-events-none select-none"
          style={{
            left: `${layer.x}%`,
            top: `${layer.y}%`,
            width: `${layer.width ?? 80}%`,
            transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontFamily: layer.fontFamily,
              fontSize: `${Math.max(6, Math.round(layer.fontSize * scale))}px`,
              fontWeight: layer.fontWeight,
              color: layer.color,
              opacity: layer.opacity,
              textAlign: layer.textAlign as "left" | "center" | "right",
              textShadow: layer.dropShadow ? "0 2px 8px rgba(0,0,0,0.6)" : "none",
              padding: layer.bgStyle !== "none" ? "4px 12px" : undefined,
              borderRadius: layer.bgStyle === "pill" ? "9999px" : layer.bgStyle === "block" ? "6px" : undefined,
              backgroundColor: layer.bgStyle !== "none" ? layer.bgColor : "transparent",
              whiteSpace: "pre-wrap",
              lineHeight: 1.2,
              wordBreak: "break-word",
              width: "100%",
            }}
          >
            {layer.text}
          </div>
        </div>
      ))}
    </>
  );
}

const STATUS_FILTERS: { label: string; value: DraftStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "In Review", value: "in_review" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Scheduled", value: "scheduled" },
];

const FORMAT_LABELS: Record<string, string> = {
  story: "Story",
  reel: "Reel",
  carousel: "Carousel",
};

// ─── Draft with loaded assets ────────────────────────────────────────────────
interface DraftWithAssets extends Draft {
  assets: DraftAssetEntry[];
  _loaded?: boolean;
}

// ─── Story Sequence Viewer ───────────────────────────────────────────────────
function StoryViewer({ assets, metadata }: { assets: DraftAssetEntry[]; metadata?: Record<string, unknown> }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoPlay && assets.length > 1) {
      timerRef.current = setInterval(() => {
        setFrameIndex((prev) => (prev + 1) % assets.length);
      }, 2500);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoPlay, assets.length]);

  if (assets.length === 0) {
    return (
      <div className="aspect-[9/16] bg-gray-100 rounded-xl flex items-center justify-center">
        <span className="text-xs text-text-tertiary">No frames</span>
      </div>
    );
  }

  const current = assets[frameIndex];
  const frameTextLayers = ((metadata?.frameTextLayers ?? metadata?.frame_text_layers) ?? {}) as Record<string, TextLayer[]>;
  const currentLayers = frameTextLayers[current.asset_id] ?? [];

  return (
    <div className="relative">
      <div ref={containerRef} className="aspect-[9/16] rounded-xl overflow-hidden bg-black relative">
        {current.asset.media_type === "image" ? (
          <img
            src={`${API_BASE}/assets/${current.asset_id}/file`}
            alt={current.asset.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <span className="text-3xl text-white/30">▶</span>
          </div>
        )}

        {/* Text layers */}
        <TextLayersOverlay layers={currentLayers} containerRef={containerRef} />

        {/* Progress bars */}
        {assets.length > 1 && (
          <div className="absolute top-2 left-0 right-0 flex gap-0.5 px-2 z-10">
            {assets.map((_, i) => (
              <div key={i} className={`h-[2px] flex-1 rounded-full ${i === frameIndex ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        )}

        {/* Frame counter */}
        <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
          {frameIndex + 1} / {assets.length}
        </div>

        {/* Click zones for nav */}
        {assets.length > 1 && (
          <>
            <button
              className="absolute inset-y-0 left-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); setAutoPlay(false); setFrameIndex((prev) => Math.max(0, prev - 1)); }}
            />
            <button
              className="absolute inset-y-0 right-0 w-1/3 z-10"
              onClick={(e) => { e.stopPropagation(); setAutoPlay(false); setFrameIndex((prev) => Math.min(assets.length - 1, prev + 1)); }}
            />
          </>
        )}
      </div>

      {/* Controls */}
      {assets.length > 1 && (
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex gap-1">
            {assets.map((_, i) => (
              <button
                key={i}
                onClick={() => { setAutoPlay(false); setFrameIndex(i); }}
                className={`w-5 h-5 rounded text-[9px] font-semibold transition-colors ${
                  i === frameIndex ? "bg-primary text-white" : "bg-surface-secondary text-text-tertiary hover:bg-primary/10"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
              autoPlay ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {autoPlay ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>
      )}

      {/* Thumbnail strip */}
      {assets.length > 1 && (
        <div className="flex gap-1 mt-2">
          {assets.map((entry, i) => (
            <button
              key={entry.id}
              onClick={() => { setAutoPlay(false); setFrameIndex(i); }}
              className={`flex-1 aspect-[9/16] rounded overflow-hidden border-2 transition-all ${
                i === frameIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {entry.asset.media_type === "image" ? (
                <img
                  src={`${API_BASE}/assets/${entry.asset_id}/file`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-purple-50 flex items-center justify-center">
                  <span className="text-[8px] text-purple-300">▶</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reel Player ─────────────────────────────────────────────────────────────
function ReelPlayer({ assets, metadata }: { assets: DraftAssetEntry[]; metadata?: Record<string, unknown> }) {
  const [clipIndex, setClipIndex] = useState(0);
  const reelContainerRef = useRef<HTMLDivElement>(null);
  const asset = (assets[clipIndex] ?? assets[0])?.asset;
  const textOverlays = (metadata?.text_overlays ?? []) as TextLayer[];

  if (!asset) {
    return (
      <div className="aspect-[9/16] bg-gray-100 rounded-xl flex items-center justify-center">
        <span className="text-xs text-text-tertiary">No asset</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={reelContainerRef} className="aspect-[9/16] rounded-xl overflow-hidden bg-black relative">
        {asset.media_type === "video" ? (
          <video
            key={asset.id}
            src={`${API_BASE}/assets/${asset.id}/file`}
            className="w-full h-full object-cover"
            controls
            preload="metadata"
            playsInline
          />
        ) : (
          <img
            src={`${API_BASE}/assets/${asset.id}/file`}
            alt={asset.filename}
            className="w-full h-full object-cover"
          />
        )}
        {asset.duration != null && (
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full z-20">
            {asset.duration.toFixed(1)}s
          </div>
        )}
        {/* Text overlays */}
        <TextLayersOverlay layers={textOverlays} containerRef={reelContainerRef} />
      </div>
      {/* Clip strip for multi-clip reels */}
      {assets.length > 1 && (
        <div className="flex gap-1 mt-2">
          {assets.map((entry, i) => (
            <button
              key={entry.id}
              onClick={() => setClipIndex(i)}
              className={`flex-1 aspect-video rounded overflow-hidden border-2 transition-all ${
                i === clipIndex ? "border-primary" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              {entry.asset.media_type === "image" ? (
                <img src={`${API_BASE}/assets/${entry.asset_id}/file`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                  <span className="text-[8px] text-white/40">▶</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Carousel Slide Mini-Preview (from stored metadata) ──────────────────────
function CarouselSlidePreview({ slides, slideIndex }: { slides: unknown[]; slideIndex: number }) {
  const slide = slides[slideIndex] as Record<string, unknown> | undefined;
  if (!slide) return null;
  const style = (slide.style ?? {}) as Record<string, unknown>;
  const content = (slide.content ?? {}) as Record<string, unknown>;
  const bgColor = (style.bgColor as string | undefined) ?? "#1a1a2e";
  const headlineColor = (style.headlineColor as string | undefined) ?? "#ffffff";
  const bodyColor = (style.bodyColor as string | undefined) ?? "rgba(255,255,255,0.7)";
  const accentColor = (style.accentColor as string | undefined) ?? "#39de8b";
  const fontFamily = (style.fontFamily as string | undefined) ?? "Inter, sans-serif";
  const headline = (content.headline as string | undefined) ?? "";
  const body = (content.body as string | undefined) ?? "";
  const slideType = (slide.type as string | undefined) ?? "content";

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-3 text-center overflow-hidden"
      style={{ backgroundColor: bgColor, fontFamily }}
    >
      {slideType === "cover" && (
        <div className="w-6 h-0.5 mb-2 rounded-full" style={{ backgroundColor: accentColor }} />
      )}
      {headline && (
        <div
          className="font-bold leading-tight mb-1 line-clamp-3"
          style={{ color: headlineColor, fontSize: "clamp(6px, 2.5vw, 11px)" }}
        >
          {headline}
        </div>
      )}
      {body && (
        <div
          className="leading-snug line-clamp-3"
          style={{ color: bodyColor, fontSize: "clamp(5px, 2vw, 9px)" }}
        >
          {body}
        </div>
      )}
      {slideType === "cta" && (
        <div
          className="mt-1.5 px-2 py-0.5 rounded-full text-[7px] font-bold"
          style={{ backgroundColor: accentColor, color: bgColor }}
        >
          {(content.ctaText as string | undefined) ?? "Follow"}
        </div>
      )}
    </div>
  );
}

// ─── Carousel Viewer ─────────────────────────────────────────────────────────
function CarouselViewer({ assets, draft }: { assets: DraftAssetEntry[]; draft: DraftWithAssets }) {
  const [slideIndex, setSlideIndex] = useState(0);

  // Use metadata slides when no library assets are attached (carousel builder content)
  const metaSlides = (draft.metadata?.slides as unknown[] | undefined) ?? [];

  if (assets.length === 0 && metaSlides.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
        <span className="text-xs text-text-tertiary">No slides</span>
      </div>
    );
  }

  if (assets.length === 0 && metaSlides.length > 0) {
    const clampedIndex = Math.min(slideIndex, metaSlides.length - 1);
    return (
      <div>
        <div className="aspect-square rounded-xl overflow-hidden relative">
          <CarouselSlidePreview slides={metaSlides} slideIndex={clampedIndex} />
          {metaSlides.length > 1 && (
            <>
              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-10">
                {metaSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlideIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === clampedIndex ? "bg-white" : "bg-white/40"}`}
                  />
                ))}
              </div>
              {clampedIndex > 0 && (
                <button onClick={() => setSlideIndex(clampedIndex - 1)} className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 text-white text-xs flex items-center justify-center z-10">‹</button>
              )}
              {clampedIndex < metaSlides.length - 1 && (
                <button onClick={() => setSlideIndex(clampedIndex + 1)} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 text-white text-xs flex items-center justify-center z-10">›</button>
              )}
              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {clampedIndex + 1} / {metaSlides.length}
              </div>
            </>
          )}
        </div>
        {metaSlides.length > 1 && (
          <div className="flex gap-1 mt-2 overflow-x-auto">
            {metaSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className={`w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === clampedIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
              >
                <div className="w-full h-full">
                  <CarouselSlidePreview slides={metaSlides} slideIndex={i} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const current = assets[slideIndex];

  return (
    <div>
      <div className="aspect-square rounded-xl overflow-hidden bg-black relative">
        {current.asset.media_type === "image" ? (
          <img
            src={`${API_BASE}/assets/${current.asset_id}/file`}
            alt={current.asset.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <span className="text-3xl text-white/30">▶</span>
          </div>
        )}

        {/* Dot indicators */}
        {assets.length > 1 && (
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-10">
            {assets.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === slideIndex ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        )}

        {/* Nav arrows */}
        {assets.length > 1 && (
          <>
            {slideIndex > 0 && (
              <button
                onClick={() => setSlideIndex(slideIndex - 1)}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs flex items-center justify-center hover:bg-black/60 transition-colors z-10"
              >
                ‹
              </button>
            )}
            {slideIndex < assets.length - 1 && (
              <button
                onClick={() => setSlideIndex(slideIndex + 1)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs flex items-center justify-center hover:bg-black/60 transition-colors z-10"
              >
                ›
              </button>
            )}
          </>
        )}

        {/* Counter */}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
          {slideIndex + 1} / {assets.length}
        </div>
      </div>

      {/* Thumbnail strip */}
      {assets.length > 1 && (
        <div className="flex gap-1 mt-2">
          {assets.map((entry, i) => (
            <button
              key={entry.id}
              onClick={() => setSlideIndex(i)}
              className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                i === slideIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {entry.asset.media_type === "image" ? (
                <img src={`${API_BASE}/assets/${entry.asset_id}/file`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-purple-50 flex items-center justify-center">
                  <span className="text-[8px] text-purple-300">▶</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Content Preview (dispatches to format-specific viewer) ──────────────────
function ContentPreview({ draft }: { draft: DraftWithAssets }) {
  const assets = draft.assets ?? [];
  const hasMetaSlides = draft.format === "carousel" && ((draft.metadata?.slides as unknown[] | undefined)?.length ?? 0) > 0;

  if (assets.length === 0 && !hasMetaSlides) {
    return (
      <div className="aspect-[9/16] bg-surface-secondary rounded-xl flex items-center justify-center border border-dashed border-border">
        <div className="text-center">
          <div className="text-xl text-text-tertiary/30 mb-1">◫</div>
          <div className="text-[10px] text-text-tertiary">No content added</div>
        </div>
      </div>
    );
  }

  const meta = draft.metadata as Record<string, unknown> | undefined;
  if (draft.format === "story") return <StoryViewer assets={assets} metadata={meta} />;
  if (draft.format === "reel") return <ReelPlayer assets={assets} metadata={meta} />;
  if (draft.format === "carousel") return <CarouselViewer assets={assets} draft={draft} />;

  return <StoryViewer assets={assets} metadata={meta} />;
}

// ─── Expanded Review Modal ───────────────────────────────────────────────────
function ReviewModal({
  draft,
  onClose,
  onAction,
  onScheduled,
}: {
  draft: DraftWithAssets;
  onClose: () => void;
  onAction: (action: (id: string) => Promise<Draft>, draftId: string) => void;
  onScheduled: (updated: Draft) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: large preview */}
        <div className="w-[360px] shrink-0 bg-[#f5f5f7] p-6 flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-[280px]">
            <ContentPreview draft={draft} />
          </div>
        </div>

        {/* Right: details + actions */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-text-primary">{draft.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={draft.format === "story" ? "info" : draft.format === "reel" ? "success" : "warning"}>
                  {FORMAT_LABELS[draft.format] ?? draft.format}
                </Badge>
                <DraftStatusBadge status={draft.status} />
                <span className="text-[10px] text-text-tertiary">
                  {(draft.assets ?? []).length} asset{(draft.assets ?? []).length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg transition-colors">&times;</button>
          </div>

          {/* Asset details */}
          <div className="px-6 py-4 flex-1 space-y-4">
            {/* Asset list */}
            {(draft.assets ?? []).length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block mb-2">Assets</span>
                <div className="space-y-1.5">
                  {(draft.assets ?? []).map((entry, i) => (
                    <div key={entry.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-secondary">
                      <span className="text-[10px] font-semibold text-text-tertiary w-4 text-center">{i + 1}</span>
                      <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 shrink-0">
                        {entry.asset.media_type === "image" ? (
                          <img src={`${API_BASE}/assets/${entry.asset_id}/file`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-purple-50 flex items-center justify-center">
                            <span className="text-[8px] text-purple-300">▶</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-text-primary truncate">{entry.asset.filename}</div>
                        <div className="text-[10px] text-text-tertiary">
                          {entry.asset.media_type}
                          {entry.asset.width && entry.asset.height && ` · ${entry.asset.width}×${entry.asset.height}`}
                          {entry.asset.duration != null && ` · ${entry.asset.duration.toFixed(1)}s`}
                        </div>
                      </div>
                      {entry.asset.project && <Badge variant="success">{entry.asset.project}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Created</span>
                <span className="text-[11px] text-text-primary">{new Date(draft.created_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Updated</span>
                <span className="text-[11px] text-text-primary">{new Date(draft.updated_at).toLocaleString()}</span>
              </div>
              {draft.scheduled_for && (
                <div className="col-span-2">
                  <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Scheduled For</span>
                  <span className="text-[11px] text-info">{new Date(draft.scheduled_for).toLocaleString()}</span>
                  {draft.schedule_notes && <span className="text-[10px] text-text-tertiary ml-2">— {draft.schedule_notes}</span>}
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">ID</span>
              <span className="text-[10px] text-text-tertiary font-mono">{draft.id}</span>
            </div>
          </div>

          {/* Schedule panel */}
          {draft.status === "approved" && (
            <div className="px-6 pb-4">
              <SchedulePanel draft={draft} onScheduled={onScheduled} />
            </div>
          )}

          {/* Action bar */}
          <div className="px-6 py-4 border-t border-border bg-surface-secondary flex items-center gap-2">
            {draft.status === "draft" && (
              <Button size="sm" onClick={() => onAction(submitForReview, draft.id)}>Submit for Review</Button>
            )}
            {draft.status === "in_review" && (
              <>
                <Button size="sm" onClick={() => onAction(approveDraft, draft.id)}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => onAction(rejectDraft, draft.id)} title="Reject">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onAction(returnToDraft, draft.id)}>Remove from Queue</Button>
              </>
            )}
            {draft.status === "rejected" && (
              <Button size="sm" variant="secondary" onClick={() => onAction(returnToDraft, draft.id)}>Return to Draft</Button>
            )}
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Review Card ─────────────────────────────────────────────────────────────
function ReviewCard({
  draft,
  onAction,
  onScheduled,
  onExpand,
  onCopyAsCarousel,
}: {
  draft: DraftWithAssets;
  onAction: (action: (id: string) => Promise<Draft>, draftId: string) => void;
  onScheduled: (updated: Draft) => void;
  onExpand: () => void;
  onCopyAsCarousel: (id: string) => void;
}) {
  const assetCount = (draft.assets ?? []).length;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex">
        {/* Left: visual preview */}
        <div className="w-[200px] shrink-0 bg-[#f5f5f7] p-3 flex items-start justify-center">
          <div className="w-full">
            <ContentPreview draft={draft} />
          </div>
        </div>

        {/* Right: details + actions */}
        <div className="flex-1 flex flex-col p-4 min-w-0">
          {/* Top: title + badges */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-primary truncate">{draft.title}</h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge variant={draft.format === "story" ? "info" : draft.format === "reel" ? "success" : "warning"}>
                  {FORMAT_LABELS[draft.format] ?? draft.format}
                </Badge>
                <DraftStatusBadge status={draft.status} />
                {assetCount > 0 && (
                  <span className="text-[10px] text-text-tertiary bg-surface-secondary px-1.5 py-0.5 rounded-md font-medium">
                    {assetCount} asset{assetCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {draft.status === "in_review" && (
                <button
                  onClick={() => onAction(returnToDraft, draft.id)}
                  className="text-[10px] font-medium text-text-tertiary hover:text-red-600 hover:bg-red-50 transition-colors px-2 py-1 rounded-md border border-transparent hover:border-red-200"
                  title="Remove from approval queue (returns to draft)"
                >
                  Remove
                </button>
              )}
              <button
                onClick={onExpand}
                className="text-[10px] font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-md hover:bg-primary/5"
                title="Expand preview"
              >
                Expand ↗
              </button>
            </div>
          </div>

          {/* Asset thumbnail strip (compact) */}
          {assetCount > 0 && (
            <div className="flex gap-1 mb-3">
              {(draft.assets ?? []).slice(0, 6).map((entry) => (
                <div key={entry.id} className="w-8 h-8 rounded overflow-hidden bg-gray-100 shrink-0 border border-border-light">
                  {entry.asset.media_type === "image" ? (
                    <img src={`${API_BASE}/assets/${entry.asset_id}/file`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-purple-50 flex items-center justify-center">
                      <span className="text-[7px] text-purple-300">▶</span>
                    </div>
                  )}
                </div>
              ))}
              {assetCount > 6 && (
                <div className="w-8 h-8 rounded bg-surface-secondary flex items-center justify-center text-[10px] text-text-tertiary font-medium">
                  +{assetCount - 6}
                </div>
              )}
            </div>
          )}

          {/* Schedule info */}
          {draft.status === "scheduled" && draft.scheduled_for && (
            <div className="text-[11px] text-info mb-2">
              Scheduled: {new Date(draft.scheduled_for).toLocaleString()}
              {draft.schedule_notes && <span className="text-text-tertiary ml-1.5">— {draft.schedule_notes}</span>}
            </div>
          )}

          {/* Schedule panel inline */}
          {draft.status === "approved" && <SchedulePanel draft={draft} onScheduled={onScheduled} />}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom: actions + meta */}
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border-light">
            <div className="flex gap-1.5 flex-wrap">
              {draft.status === "draft" && (
                <Button size="sm" onClick={() => onAction(submitForReview, draft.id)}>Submit for Review</Button>
              )}
              {draft.status === "in_review" && (
                <>
                  <Button size="sm" onClick={() => onAction(approveDraft, draft.id)}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => onAction(rejectDraft, draft.id)} title="Reject">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onAction(returnToDraft, draft.id)}>Return to Draft</Button>
                </>
              )}
              {draft.status === "rejected" && (
                <Button size="sm" variant="secondary" onClick={() => onAction(returnToDraft, draft.id)}>Return to Draft</Button>
              )}
              {(draft.format === "story" || draft.format === "reel") && (
                <Button size="sm" variant="ghost" onClick={() => onCopyAsCarousel(draft.id)} title="Copy frames into a new carousel">
                  ⊞ Copy as Carousel
                </Button>
              )}
            </div>
            <div className="text-[10px] text-text-tertiary shrink-0">
              Updated {new Date(draft.updated_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Approval Queue ─────────────────────────────────────────────────────
export default function ApprovalQueue() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftWithAssets[]>([]);
  const [filter, setFilter] = useState<DraftStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);

  // Count by status (from all drafts)
  const [allDrafts, setAllDrafts] = useState<Draft[]>([]);

  const statusCounts: Record<string, number> = {};
  for (const d of allDrafts) {
    statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
  }

  // Load drafts and their assets
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all drafts for counts
      const allRes = await fetchDrafts({});
      setAllDrafts(allRes.drafts);

      // Fetch filtered set
      const params = filter === "all" ? {} : { status: filter };
      const res = await fetchDrafts(params);

      // Load assets for each draft
      const withAssets: DraftWithAssets[] = await Promise.all(
        res.drafts.map(async (d) => {
          try {
            const detail = await fetchDraft(d.id);
            return { ...detail, assets: detail.assets ?? [], _loaded: true };
          } catch {
            return { ...d, assets: [], _loaded: false };
          }
        })
      );
      setDrafts(withAssets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: (id: string) => Promise<Draft>, draftId: string) => {
    try {
      const updated = await action(draftId);
      // Reload the draft detail to get updated assets
      const detail = await fetchDraft(updated.id);
      const withAssets: DraftWithAssets = { ...detail, assets: detail.assets ?? [], _loaded: true };
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? withAssets : d)));
      setAllDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const handleScheduled = (updated: Draft) => {
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
    setAllDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleCopyAsCarousel = async (draftId: string) => {
    try {
      const result = await copyAsCarousel(draftId);
      router.push(`/carousels/new?draft=${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy as carousel");
    }
  };

  const expandedDraft = drafts.find((d) => d.id === expandedDraftId) ?? null;

  return (
    <div className="max-w-5xl">
      {/* Status filter tabs with counts */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === "all" ? allDrafts.length : (statusCounts[f.value] ?? 0);
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filter === f.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-text-secondary border border-border hover:bg-surface-secondary hover:border-border"
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                filter === f.value
                  ? "bg-white/20 text-white"
                  : "bg-surface-secondary text-text-tertiary"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-[11px] text-red-700 mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && drafts.length === 0 && (
        <EmptyState
          icon="◫"
          title="No drafts found"
          description={filter === "all" ? "Create content drafts from the builder pages." : `No drafts with status "${filter.replace("_", " ")}".`}
        />
      )}

      {/* Review cards */}
      {!loading && (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <ReviewCard
              key={draft.id}
              draft={draft}
              onAction={handleAction}
              onScheduled={handleScheduled}
              onExpand={() => setExpandedDraftId(draft.id)}
              onCopyAsCarousel={handleCopyAsCarousel}
            />
          ))}
        </div>
      )}

      {/* Expanded review modal */}
      {expandedDraft && (
        <ReviewModal
          draft={expandedDraft}
          onClose={() => setExpandedDraftId(null)}
          onAction={handleAction}
          onScheduled={handleScheduled}
        />
      )}
    </div>
  );
}
