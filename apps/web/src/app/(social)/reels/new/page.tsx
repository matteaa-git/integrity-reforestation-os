"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { Asset, Draft, DraftAssetEntry, DraftStatus, ReelTemplate } from "@/lib/api";
import {
  addDraftAsset,
  createDraft,
  createTemplate,
  deleteTemplate,
  fetchAsset,
  fetchAssets,
  fetchTemplates,
  removeDraftAsset,
  submitForReview,
  updateDraft,
  uploadAsset,
  useTemplate,
} from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Timeline from "@/components/reel-editor/Timeline";
import Preview from "@/components/reel-editor/Preview";
import TextOverlayEditor from "@/components/reel-editor/TextOverlayEditor";
import EffectsPanel from "@/components/reel-editor/EffectsPanel";
import type { Caption, TextOverlay, ClipEffects, ClipTrim } from "@/components/reel-editor/types";
import { CAPTION_STYLES, DEFAULT_EFFECTS, BRAND_FONTS, BRAND_COLORS, formatTime, parseTime } from "@/components/reel-editor/types";
import DraftPickerModal from "@/components/DraftPickerModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_CONFIG: Record<DraftStatus, { label: string; variant: "default" | "warning" | "success" | "danger" | "info" }> = {
  draft:          { label: "Draft",          variant: "default" },
  in_review:      { label: "In Review",      variant: "warning" },
  approved:       { label: "Approved",       variant: "success" },
  rejected:       { label: "Rejected",       variant: "danger"  },
  scheduled:      { label: "Scheduled",      variant: "info"    },
  publishing:     { label: "Publishing…",    variant: "info"    },
  published:      { label: "Published",      variant: "success" },
  publish_failed: { label: "Publish Failed", variant: "danger"  },
  failed:         { label: "Failed",         variant: "danger"  },
};

const TEMPLATE_CATEGORIES = [
  { label: "All", value: "" },
  { label: "Hook + Reveal", value: "hook_reveal" },
  { label: "Product Showcase", value: "product_showcase" },
  { label: "Before / After", value: "before_after" },
  { label: "Educational", value: "educational" },
  { label: "Quick Montage", value: "quick_montage" },
  { label: "Story Driven", value: "story_driven" },
  { label: "Custom", value: "custom" },
];

function createCaption(startTime: number = 0): Caption {
  return { id: crypto.randomUUID(), text: "", startTime, endTime: startTime + 3, style: "default" };
}

function createTextOverlay(startTime: number, endTime: number): TextOverlay {
  return {
    id: crypto.randomUUID(),
    text: "New Text",
    x: 50,
    y: 50,
    width: 80,
    fontSize: 24,
    fontFamily: "'Noto Sans', sans-serif",
    fontWeight: "700",
    color: "#ffffff",
    opacity: 1,
    textAlign: "center",
    rotation: 0,
    dropShadow: true,
    bgStyle: "none",
    bgColor: "#002a27",
    startTime,
    endTime,
  };
}

// ─── Video hover-preview card ─────────────────────────────────────────────────
function VideoThumbCard({
  asset,
  aiScore,
  onClick,
}: {
  asset: Asset;
  aiScore?: { composite: number };
  onClick: () => void;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const handleMouseEnter = () => {
    const v = vidRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    const v = vidRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group rounded-lg overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-md transition-all text-left bg-white"
    >
      <div className="aspect-[9/16] overflow-hidden bg-gray-900 relative">
        <video
          ref={vidRef}
          src={`${API}/assets/${asset.id}/file`}
          muted
          playsInline
          loop
          preload="metadata"
          className="w-full h-full object-cover"
        />
        {/* Play icon — hidden while video plays */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
          <span className="text-2xl text-white/40">▶</span>
        </div>
        {/* Badges */}
        <div className="absolute top-1 left-1">
          <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded backdrop-blur-sm bg-blue-500/70 text-white">VID</span>
        </div>
        {asset.duration != null && (
          <div className="absolute bottom-1 right-1">
            <span className="text-[9px] bg-black/60 text-white px-1 rounded backdrop-blur-sm">{asset.duration.toFixed(1)}s</span>
          </div>
        )}
        {aiScore && (
          <div className="absolute bottom-1 left-1">
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded backdrop-blur-sm ${
              aiScore.composite >= 0.70 ? "bg-emerald-500/85 text-white" :
              aiScore.composite >= 0.45 ? "bg-amber-500/85 text-white" :
              "bg-gray-600/75 text-white"
            }`}>
              {Math.round(aiScore.composite * 100)}
            </span>
          </div>
        )}
        {/* Add overlay */}
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-all flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
            <span className="text-primary text-xs font-bold">+</span>
          </div>
        </div>
      </div>
      <div className="px-1.5 py-1">
        <div className="text-[10px] font-medium text-text-primary truncate">{asset.filename}</div>
      </div>
    </button>
  );
}

// ─── Main Reel Builder ───────────────────────────────────────────────────────
export default function ReelBuilderPageWrapper() {
  return (
    <Suspense fallback={null}>
      <ReelBuilderPage />
    </Suspense>
  );
}

function ReelBuilderPage() {
  const searchParams = useSearchParams();

  // Draft state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("draft");
  const [title, setTitle] = useState("");
  const [frames, setFrames] = useState<DraftAssetEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clip / video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [clipTrims, setClipTrims] = useState<Record<string, ClipTrim>>({});
  const [clipEffects, setClipEffects] = useState<Record<string, ClipEffects>>({});

  // Global timeline time
  const [globalTime, setGlobalTime] = useState(0);

  // Music state
  const [musicTrack, setMusicTrack] = useState<Asset | null>(null);
  const [musicVolume, setMusicVolume] = useState(80);
  const [videoVolume, setVideoVolume] = useState(100);
  const [musicStartOffset, setMusicStartOffset] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Captions state
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [hookText, setHookText] = useState("");
  const [ctaText, setCtaText] = useState("");

  // Instagram post caption
  const [postCaption, setPostCaption] = useState("");
  const [postHashtags, setPostHashtags] = useState("");

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Asset browser state
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryPage, setLibraryPage] = useState(0);
  const ASSET_PAGE_SIZE = 25;
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<"" | "image" | "video">("");
  const [assetTab, setAssetTab] = useState<"media" | "music" | "templates">("media");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [musicDragOver, setMusicDragOver] = useState(false);
  const musicUploadInputRef = useRef<HTMLInputElement>(null);

  // Template state
  const [templates, setTemplates] = useState<ReelTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("custom");

  // Right panel tab
  const [rightTab, setRightTab] = useState<"settings" | "clip" | "text" | "captions" | "music" | "ai">("settings");

  // ── AI Reel Director state ──
  // Strategy
  const [aiStoryType, setAiStoryType] = useState<"narrative" | "hook_reveal" | "problem_solution" | "montage" | "testimonial" | "educational">("narrative");
  const [aiObjective, setAiObjective] = useState<"awareness" | "engagement" | "conversion" | "education">("engagement");
  const [aiAudience, setAiAudience] = useState("general");
  const [aiTone, setAiTone] = useState<"inspiring" | "educational" | "entertaining" | "urgent" | "calm">("inspiring");
  const [aiDuration, setAiDuration] = useState(30);
  const [aiVersions, setAiVersions] = useState(3);
  // Analysis + generation
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiJobStatus, setAiJobStatus] = useState<{ status: string; progress: number; analyzed: number; total: number } | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiVersionResults, setAiVersionResults] = useState<any[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  // Intelligence layer
  const [aiScores, setAiScores] = useState<Record<string, { composite: number; hook_score: number; motion_score: number; story_role_suggestion: string }>>({});
  const [clipRoles, setClipRoles] = useState<Record<string, string>>({}); // frame.id → story_role label
  const [expandedWhy, setExpandedWhy] = useState<string | null>(null); // "vi-ci" key
  const [regeneratingSegment, setRegeneratingSegment] = useState<string | null>(null); // "vi-ci" key

  // Draft picker
  const [showDraftPicker, setShowDraftPicker] = useState(false);

  // Export
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Auto-save
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Playback control refs ──
  // pendingSeekRef: local video time to apply once the next clip's element mounts
  const pendingSeekRef = useRef<number | null>(null);
  // isPlayingRef: mirrors isPlaying synchronously so effects outside React batching can read it
  const isPlayingRef = useRef(false);
  // clipAdvancingRef: true while we're internally pausing to cut to the next clip,
  //   so the onPause handler doesn't interpret it as a user-initiated pause
  const clipAdvancingRef = useRef(false);

  // ── Derived state ──
  const activeClip = selectedClipIndex >= 0 && selectedClipIndex < frames.length ? frames[selectedClipIndex] : null;
  const selectedCaption = captions.find((c) => c.id === selectedCaptionId) ?? null;
  const activeCaption = captions.find((c) => globalTime >= c.startTime && globalTime < c.endTime);
  const selectedText = textOverlays.find((t) => t.id === selectedTextId) ?? null;
  const statusInfo = STATUS_CONFIG[draftStatus];
  const activeClipTrim = activeClip ? clipTrims[activeClip.id] : null;

  const getClipDuration = useCallback((clip: DraftAssetEntry): number => {
    const trim = clipTrims[clip.id];
    const rawDuration = clip.asset.duration ?? 0;
    if (!trim) return rawDuration;
    return (trim.outPoint ?? rawDuration) - trim.inPoint;
  }, [clipTrims]);

  const totalReelDuration = frames.reduce((sum, f) => sum + getClipDuration(f), 0);

  // Build clip start offsets for global timeline
  const clipOffsets: number[] = [];
  let offsetAcc = 0;
  for (const clip of frames) {
    clipOffsets.push(offsetAcc);
    offsetAcc += getClipDuration(clip);
  }

  // Convert global time to local clip time and which clip we're on
  const globalToClipInfo = useCallback((gTime: number) => {
    let accumulated = 0;
    for (let i = 0; i < frames.length; i++) {
      const dur = getClipDuration(frames[i]);
      if (gTime < accumulated + dur) {
        return { clipIndex: i, localTime: gTime - accumulated };
      }
      accumulated += dur;
    }
    return { clipIndex: frames.length - 1, localTime: 0 };
  }, [frames, getClipDuration]);

  // ── Load assets ──
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const params: Parameters<typeof fetchAssets>[0] = {
        limit: 25,
        offset: libraryPage * 25,
      };
      if (assetTab === "music") {
        params.media_type = "audio";
      } else if (assetFilter) {
        params.media_type = assetFilter;
      }
      if (assetSearch) params.search = assetSearch;
      const data = await fetchAssets(params);
      setLibraryAssets(data.assets);
      setLibraryTotal(data.total);
    } catch {
      setLibraryAssets([]);
      setLibraryTotal(0);
    } finally {
      setLibraryLoading(false);
    }
  }, [assetFilter, assetSearch, assetTab, libraryPage]);

  // Reset to page 0 when filters or tab change
  useEffect(() => { setLibraryPage(0); }, [assetFilter, assetSearch, assetTab]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // Auto-add asset from ?asset=<id> query param (launched from Asset Library)
  useEffect(() => {
    const assetId = searchParams.get("asset");
    if (!assetId) return;
    fetchAsset(assetId).then((asset) => handleAddClip(asset)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload handler ──
  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      await Promise.all(fileArray.map((f) => uploadAsset(f)));
      await loadLibrary();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }, [loadLibrary]);

  // ── Auto-save hook (full state, 2s debounce) ──
  const { status: autoSaveStatus, lastSaved: autoSavedAt } = useAutoSave({
    enabled: autoSaveEnabled,
    delay: 2000,
    onSave: async () => {
      const id = await ensureDraft();
      await updateDraft(id, {
        title: title || "Untitled Reel",
        caption: postCaption || undefined,
        hashtags: postHashtags || undefined,
        metadata: { frames, clipTrims, clipEffects, musicTrack: musicTrack?.id ?? null, musicVolume, videoVolume, hookText, ctaText, captions, textOverlays },
      });
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    },
    deps: [title, postCaption, postHashtags, frames, clipTrims, clipEffects, musicTrack, musicVolume, videoVolume, hookText, ctaText, captions, textOverlays],
  });

  // Keep isPlayingRef in sync with React state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── Master playback engine ──
  // Single video element; outPoint is hard-enforced here so clips never bleed.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const vt = video.currentTime;
      const trim = activeClip ? clipTrims[activeClip.id] : null;
      const inPoint = trim?.inPoint ?? 0;
      const outPoint = trim?.outPoint ?? null; // null → play to natural end

      // ── Hard-cut at outPoint ──
      if (outPoint !== null && vt >= outPoint) {
        clipAdvancingRef.current = true; // suppress the onPause below
        video.pause();
        if (selectedClipIndex < frames.length - 1) {
          setSelectedClipIndex(selectedClipIndex + 1);
          // isPlayingRef stays true → auto-play effect will resume on next clip
        } else {
          clipAdvancingRef.current = false;
          isPlayingRef.current = false;
          setIsPlaying(false);
          setGlobalTime(totalReelDuration);
        }
        return;
      }

      const clipOffset = clipOffsets[selectedClipIndex] ?? 0;
      setCurrentTime(vt);
      setGlobalTime(clipOffset + (vt - inPoint));
    };

    const onLoadedMetadata = () => setDuration(video.duration);

    const onPlay = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
    };

    const onPause = () => {
      // Ignore internal pauses that are just clip-advance bookkeeping
      if (clipAdvancingRef.current) return;
      isPlayingRef.current = false;
      setIsPlaying(false);
    };

    const onEnded = () => {
      // Fallback: fires when outPoint === null and file naturally ends
      if (selectedClipIndex < frames.length - 1) {
        clipAdvancingRef.current = true;
        setSelectedClipIndex(selectedClipIndex + 1);
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [activeClip, selectedClipIndex, frames.length, clipOffsets, clipTrims, totalReelDuration]);

  // ── Clip transition: seek + resume when selectedClipIndex changes ──
  // Runs after React commits the new activeClip / new <video key=...> to the DOM.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip) return;

    const trim = clipTrims[activeClip.id];
    const inPoint = trim?.inPoint ?? 0;
    // Use pending seek (from seekGlobal cross-clip seeks) or default to inPoint
    const seekTarget = pendingSeekRef.current ?? inPoint;
    pendingSeekRef.current = null;
    clipAdvancingRef.current = false; // advancing is complete

    const apply = () => {
      video.currentTime = seekTarget;
      if (isPlayingRef.current) {
        video.play().catch(() => {});
      }
    };

    // The video element may have just been remounted (key changed) and not yet
    // have metadata — wait for it before seeking.
    if (video.readyState >= 1) {
      apply();
    } else {
      video.addEventListener("loadedmetadata", apply, { once: true });
      return () => video.removeEventListener("loadedmetadata", apply);
    }
  }, [selectedClipIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync audio with video ──
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;
    const syncAudio = () => {
      const targetTime = globalTime - musicStartOffset;
      if (targetTime < 0) { audio.pause(); return; }
      if (Math.abs(audio.currentTime - targetTime) > 0.3) {
        audio.currentTime = targetTime;
      }
    };
    const onVideoPlay = () => { if (globalTime >= musicStartOffset) audio.play().catch(() => {}); };
    const onVideoPause = () => { audio.pause(); };
    const onVideoSeeked = () => { syncAudio(); };
    video.addEventListener("play", onVideoPlay);
    video.addEventListener("pause", onVideoPause);
    video.addEventListener("seeked", onVideoSeeked);
    video.addEventListener("timeupdate", syncAudio);
    return () => {
      video.removeEventListener("play", onVideoPlay);
      video.removeEventListener("pause", onVideoPause);
      video.removeEventListener("seeked", onVideoSeeked);
      video.removeEventListener("timeupdate", syncAudio);
    };
  }, [musicTrack, musicStartOffset, globalTime]);

  // ── Volume sync ──
  useEffect(() => { if (audioRef.current) audioRef.current.volume = musicVolume / 100; }, [musicVolume]);
  useEffect(() => { if (videoRef.current) videoRef.current.volume = videoVolume / 100; }, [videoVolume]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).tagName === "SELECT") return;

      switch (e.key) {
        case " ": // Space = play/pause
          e.preventDefault();
          togglePlayback();
          break;
        case "t":
        case "T": // T = add text overlay
          e.preventDefault();
          handleAddText();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          if (selectedTextId) {
            setTextOverlays((prev) => prev.filter((t) => t.id !== selectedTextId));
            setSelectedTextId(null);
          } else if (selectedCaptionId) {
            setCaptions((prev) => prev.filter((c) => c.id !== selectedCaptionId));
            setSelectedCaptionId(null);
          } else if (activeClip) {
            handleRemoveClip(activeClip);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            // Previous clip
            setSelectedClipIndex((i) => Math.max(0, i - 1));
          } else {
            seekGlobal(Math.max(0, globalTime - 0.5));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            // Next clip
            setSelectedClipIndex((i) => Math.min(frames.length - 1, i + 1));
          } else {
            seekGlobal(Math.min(totalReelDuration, globalTime + 0.5));
          }
          break;
        case "s":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleSave();
          } else if (frames.length > 0) {
            e.preventDefault();
            const info = globalToClipInfo(globalTime);
            if (info.localTime > 0.1) {
              handleSplitClip(info.clipIndex, info.localTime);
            }
          }
          break;
        case "d":
        case "D":
          if (!e.metaKey && !e.ctrlKey && frames.length > 0) {
            e.preventDefault();
            handleDuplicateClip(selectedClipIndex);
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTextId, globalTime, totalReelDuration, frames.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft helpers ──
  const ensureDraft = async (): Promise<string> => {
    if (draftId) return draftId;
    const draft = await createDraft({ title: title || "Untitled Reel", format: "reel" });
    setDraftId(draft.id);
    setDraftStatus(draft.status);
    return draft.id;
  };

  const handleAddClip = async (asset: Asset) => {
    setError(null);
    try {
      const id = await ensureDraft();
      const result = await addDraftAsset(id, asset.id);
      setFrames(result.assets);
      setSelectedClipIndex(result.assets.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add clip");
    }
  };

  const handleRemoveClip = async (clip: DraftAssetEntry) => {
    const entryId = clip.id;
    const isSplitClip = entryId.startsWith("split-");

    if (isSplitClip) {
      // Split clips are client-side only — just remove from local state
      setFrames((prev) => prev.filter((f) => f.id !== entryId));
    } else if (draftId) {
      try {
        const result = await removeDraftAsset(draftId, clip.asset_id);
        setFrames(result.assets);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove clip");
        return;
      }
    }
    setClipTrims((prev) => { const next = { ...prev }; delete next[entryId]; return next; });
    setClipEffects((prev) => { const next = { ...prev }; delete next[entryId]; return next; });
    setFrames((prev) => {
      if (selectedClipIndex >= prev.length) {
        setSelectedClipIndex(Math.max(0, prev.length - 1));
      }
      return prev;
    });
  };

  const handleDuplicateClip = async (index: number) => {
    const clip = frames[index];
    if (!clip || !draftId) return;
    try {
      const result = await addDraftAsset(draftId, clip.asset_id);
      setFrames(result.assets);
      setSelectedClipIndex(result.assets.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate clip");
    }
  };

  const handleReorderClips = (fromIndex: number, toIndex: number) => {
    setFrames((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    if (selectedClipIndex === fromIndex) setSelectedClipIndex(toIndex);
  };

  const handleSplitClip = (index: number, atLocalTime: number) => {
    const clip = frames[index];
    if (!clip) return;
    const rawDur = clip.asset.duration ?? 0;
    const trim = clipTrims[clip.id];
    const inPoint = trim?.inPoint ?? 0;
    const outPoint = trim?.outPoint ?? rawDur;

    // atLocalTime is relative to the trimmed clip start, convert to absolute media time
    const splitAt = inPoint + atLocalTime;
    if (splitAt <= inPoint + 0.1 || splitAt >= outPoint - 0.1) return; // too close to edges

    // Set out-point on original clip
    updateClipTrim(clip.id, { outPoint: splitAt });

    // Create a new entry for the second half (clone with unique id)
    const newEntryId = `split-${clip.id}-${Date.now()}`;
    const newEntry: DraftAssetEntry = {
      ...clip,
      id: newEntryId,
      position: index + 1,
    };

    // Set in-point on new clip
    setClipTrims((prev) => ({
      ...prev,
      [newEntryId]: { inPoint: splitAt, outPoint },
    }));

    // Insert new clip after original
    setFrames((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, newEntry);
      return next;
    });

    // Select the second half
    setSelectedClipIndex(index + 1);
  };

  const updateClipTrim = (entryId: string, updates: Partial<ClipTrim>) => {
    setClipTrims((prev) => {
      const existing = prev[entryId] ?? { inPoint: 0, outPoint: null };
      return { ...prev, [entryId]: { ...existing, ...updates } };
    });
  };

  const updateClipEffects = (entryId: string, effects: ClipEffects) => {
    setClipEffects((prev) => ({ ...prev, [entryId]: effects }));
  };

  // ── Playback ──
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = time;
  };

  const seekGlobal = useCallback((gTime: number) => {
    const { clipIndex, localTime } = globalToClipInfo(gTime);
    const clip = frames[clipIndex];
    if (!clip) return;

    const trim = clipTrims[clip.id];
    const inPoint = trim?.inPoint ?? 0;
    const targetVideoTime = inPoint + localTime;

    setGlobalTime(gTime);

    if (clipIndex !== selectedClipIndex) {
      // Cross-clip seek: store the target and let the clip-transition effect apply it
      // once the new video element has mounted and loaded metadata.
      pendingSeekRef.current = targetVideoTime;
      setSelectedClipIndex(clipIndex);
    } else {
      // Same clip: seek immediately
      const video = videoRef.current;
      if (video) video.currentTime = targetVideoTime;
    }
  }, [globalToClipInfo, selectedClipIndex, frames, clipTrims]);

  // ── Music ──
  const handleSelectMusic = (asset: Asset) => { setMusicTrack(asset); setRightTab("music"); };
  const handleRemoveMusic = () => { if (audioRef.current) audioRef.current.pause(); setMusicTrack(null); };

  // ── Captions ──
  const addCaption = () => {
    const cap = createCaption(globalTime);
    setCaptions((prev) => [...prev, cap].sort((a, b) => a.startTime - b.startTime));
    setSelectedCaptionId(cap.id);
    setRightTab("captions");
  };

  const updateCaption = (id: string, updates: Partial<Caption>) => {
    setCaptions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)).sort((a, b) => a.startTime - b.startTime)
    );
  };

  const deleteCaption = (id: string) => {
    setCaptions((prev) => prev.filter((c) => c.id !== id));
    if (selectedCaptionId === id) setSelectedCaptionId(null);
  };

  // ── Text Overlays ──
  const handleAddText = () => {
    const endTime = Math.min(globalTime + 5, totalReelDuration || 30);
    const txt = createTextOverlay(globalTime, endTime);
    setTextOverlays((prev) => [...prev, txt]);
    setSelectedTextId(txt.id);
    setRightTab("text");
  };

  const updateTextOverlay = (id: string, updated: TextOverlay) => {
    setTextOverlays((prev) => prev.map((t) => (t.id === id ? updated : t)));
  };

  const applyTextOverlayToAll = (id: string) => {
    const src = textOverlays.find((t) => t.id === id);
    if (!src || frames.length === 0) return;
    // Replace with one copy per clip, each spanning that clip's timespan
    const kept = textOverlays.filter((t) => t.id !== id);
    const copies = frames.map((f, i) => {
      const start = clipOffsets[i] ?? 0;
      const end = start + getClipDuration(f);
      return { ...src, id: i === 0 ? id : crypto.randomUUID(), startTime: start, endTime: end };
    });
    setTextOverlays([...kept, ...copies]);
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const duplicateTextOverlay = (id: string) => {
    const src = textOverlays.find((t) => t.id === id);
    if (!src) return;
    const dup = { ...src, id: crypto.randomUUID(), startTime: src.endTime, endTime: src.endTime + (src.endTime - src.startTime) };
    setTextOverlays((prev) => [...prev, dup]);
    setSelectedTextId(dup.id);
  };

  const moveTextOverlay = (id: string, x: number, y: number) => {
    setTextOverlays((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
  };

  const resizeTextOverlay = (id: string, width: number) => {
    setTextOverlays((prev) => prev.map((t) => (t.id === id ? { ...t, width } : t)));
  };

  // ── Save / Submit ──
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const metadata = { text_overlays: textOverlays, captions, hook_text: hookText, cta_text: ctaText };
      if (!draftId) {
        const draft = await createDraft({ title: title || "Untitled Reel", format: "reel", metadata });
        setDraftId(draft.id);
        setDraftStatus(draft.status);
      } else {
        await updateDraft(draftId, { title, caption: postCaption || undefined, hashtags: postHashtags || undefined, metadata });
      }
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!draftId || frames.length === 0) return;
    setError(null);
    try {
      // Always flush latest state before submitting so text/metadata is current
      const metadata = { text_overlays: textOverlays, captions, hook_text: hookText, cta_text: ctaText };
      await updateDraft(draftId, { title, caption: postCaption || undefined, hashtags: postHashtags || undefined, metadata });
      const updated = await submitForReview(draftId);
      setDraftStatus(updated.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  // ── Open saved draft ──
  const handleOpenDraft = (draft: Draft) => {
    setDraftId(draft.id);
    setDraftStatus(draft.status as DraftStatus);
    setTitle(draft.title);
    setPostCaption(draft.caption ?? "");
    setPostHashtags(draft.hashtags ?? "");
    setFrames((draft.assets ?? []) as DraftAssetEntry[]);
    setSelectedClipIndex(0);
    setClipTrims({});
    setClipEffects({});
    setCaptions([]);
    setTextOverlays([]);
    setMusicTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setGlobalTime(0);
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setShowDraftPicker(false);
  };

  // ── Template helpers ──
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetchTemplates();
      setTemplates(res.templates);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (assetTab === "templates") loadTemplates();
  }, [assetTab, loadTemplates]);

  // ── AI Reel Director handlers ──────────────────────────────────────────

  const handleAnalyzeLibrary = async () => {
    setAiError(null);
    setAiJobId(null);
    setAiJobStatus(null);
    try {
      const res = await fetch(`${API_BASE}/ai/analyze-all`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Analysis failed");
      setAiJobId(data.job_id);
      setAiJobStatus({ status: "pending", progress: 0, analyzed: 0, total: data.total });
      // Start polling
      _pollJobStatus(data.job_id);
    } catch (e: any) {
      setAiError(e.message);
    }
  };

  const _pollJobStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/ai/job/${jobId}`);
        const data = await res.json();
        setAiJobStatus(data);
        if (data.status === "done") {
          clearInterval(interval);
          // Load intelligence scores into media browser
          fetch(`${API_BASE}/ai/scores`)
            .then((r) => r.json())
            .then((d) => { if (d.scores) setAiScores(d.scores); })
            .catch(() => {});
        } else if (data.status === "error") {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
  };

  const handleGenerateReel = async () => {
    setAiError(null);
    setAiGenerating(true);
    setAiVersionResults([]);
    setExpandedWhy(null);
    try {
      const res = await fetch(`${API_BASE}/ai/generate-reel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_type: aiStoryType,
          objective: aiObjective,
          audience: aiAudience,
          tone: aiTone,
          target_duration: aiDuration,
          versions: aiVersions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Generation failed");
      setAiVersionResults(data.versions ?? []);
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleRegenerateSegment = async (versionIndex: number, clipIndex: number, timeline: any) => {
    const key = `${versionIndex}-${clipIndex}`;
    setRegeneratingSegment(key);
    try {
      const tc = timeline.clips[clipIndex];
      const excludeIds = timeline.clips.map((c: any) => c.asset_id);
      const res = await fetch(`${API_BASE}/ai/regenerate-segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_index: clipIndex,
          story_role: tc.role,
          story_type: aiStoryType,
          target_duration: tc.duration,
          exclude_asset_ids: excludeIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Regeneration failed");
      // Splice new clip into the version result
      setAiVersionResults((prev) =>
        prev.map((v, i) => {
          if (i !== versionIndex) return v;
          const newClips = [...v.clips];
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            asset_id: data.asset_id,
            filename: data.filename,
            in_point: data.in_point,
            out_point: data.out_point,
            duration: data.duration,
            story_role: data.story_role,
            why_chosen: data.why_chosen,
          };
          return { ...v, clips: newClips };
        })
      );
    } catch (e: any) {
      setAiError(`Segment regen failed: ${e.message}`);
    } finally {
      setRegeneratingSegment(null);
    }
  };

  const loadAITimeline = async (timeline: any) => {
    if (!timeline.clips?.length) return;
    setError(null);
    try {
      // Ensure draft exists — use a local var to avoid stale closure
      let activeDraftId = draftId;
      if (!activeDraftId) {
        const res = await fetch(`${API_BASE}/drafts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "AI Reel", format: "reel" }),
        });
        if (!res.ok) throw new Error(`Failed to create draft: ${res.status}`);
        const d = await res.json();
        activeDraftId = d.id;
        setDraftId(d.id);
        setTitle(d.title || "AI Reel");
      }

      // Add each clip in order
      const assetIdOrder: string[] = [];
      for (let i = 0; i < timeline.clips.length; i++) {
        const tc = timeline.clips[i];
        // Check library; if not found, try fetching directly (handles post-restart state)
        let asset = libraryAssets.find((a) => a.id === tc.asset_id);
        if (!asset) {
          const assetRes = await fetch(`${API_BASE}/assets/${tc.asset_id}`);
          if (!assetRes.ok) continue; // asset truly gone — skip
          asset = await assetRes.json();
        }
        const addRes = await fetch(`${API_BASE}/drafts/${activeDraftId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset_id: tc.asset_id, position: i }),
        });
        if (addRes.ok) assetIdOrder.push(tc.asset_id);
      }

      if (assetIdOrder.length === 0) {
        setError("No matching assets found. Re-index the asset library and try again.");
        return;
      }

      // Fetch the draft to get fully-populated DraftAssetEntry objects
      const draftRes = await fetch(`${API_BASE}/drafts/${activeDraftId}`);
      if (!draftRes.ok) throw new Error(`Failed to fetch draft: ${draftRes.status}`);
      const draft = await draftRes.json();
      const orderedFrames: DraftAssetEntry[] = (draft.assets ?? []).sort(
        (a: DraftAssetEntry, b: DraftAssetEntry) => a.position - b.position,
      );
      setFrames(orderedFrames);

      // Apply trims + story roles — match by asset_id to the ordered frames
      const newTrims: Record<string, ClipTrim> = {};
      const newRoles: Record<string, string> = {};
      timeline.clips.forEach((tc: any) => {
        const frame = orderedFrames.find((f) => f.asset_id === tc.asset_id);
        if (frame) {
          newTrims[frame.id] = { inPoint: tc.in_point, outPoint: tc.out_point };
          if (tc.story_role) newRoles[frame.id] = tc.story_role;
        }
      });
      setClipTrims(newTrims);
      setClipRoles(newRoles);

      // Apply captions, text overlays, hook/CTA
      if (timeline.captions?.length) setCaptions(timeline.captions);
      if (timeline.text_overlays?.length) setTextOverlays(timeline.text_overlays);
      if (timeline.hook_text) setHookText(timeline.hook_text);
      if (timeline.cta_text) setCtaText(timeline.cta_text);
      setSelectedClipIndex(0);
      setRightTab("settings");
    } catch (e: any) {
      setError(`Load failed: ${e?.message ?? "Unknown error"}`);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    setError(null);
    try {
      const clipSlots = frames.map((f, i) => ({
        position: i,
        label: f.asset.filename,
        locked_asset_id: null as string | null,
        duration: f.asset.duration ?? null,
      }));
      const captionSlots = captions.map((c) => ({
        text: c.text,
        start_time: c.startTime,
        end_time: c.endTime,
        style: c.style,
      }));
      await createTemplate({
        name: templateName,
        category: templateCategory,
        hook_text: hookText,
        cta_text: ctaText,
        clip_slots: clipSlots,
        captions: captionSlots,
        music_asset_id: musicTrack?.id ?? undefined,
        thumbnail_asset_id: activeClip?.asset_id ?? undefined,
      });
      setShowSaveTemplate(false);
      setTemplateName("");
      if (assetTab === "templates") loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
    }
  };

  const handleApplyTemplate = async (template: ReelTemplate) => {
    setHookText(template.hook_text);
    setCtaText(template.cta_text);
    const newCaptions: Caption[] = template.captions.map((c) => ({
      id: crypto.randomUUID(),
      text: c.text,
      startTime: c.start_time,
      endTime: c.end_time,
      style: c.style as Caption["style"],
    }));
    setCaptions(newCaptions);
    setAppliedTemplateId(template.id);
    try { await useTemplate(template.id); } catch { /* non-critical */ }
    setAssetTab("media");
  };

  const handleDuplicateTemplate = async (template: ReelTemplate) => {
    try {
      await createTemplate({
        name: `${template.name} (Copy)`,
        category: template.category,
        hook_text: template.hook_text,
        cta_text: template.cta_text,
        clip_slots: template.clip_slots,
        captions: template.captions,
        music_asset_id: template.music_asset_id ?? undefined,
        thumbnail_asset_id: template.thumbnail_asset_id ?? undefined,
      });
      loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate template");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete template");
    }
  };

  // ── Export ──
  const EXPORT_FORMATS = [
    { label: "Instagram Reel", id: "ig_reel", res: "1080×1920", ratio: "9:16", icon: "▶" },
    { label: "TikTok", id: "tiktok", res: "1080×1920", ratio: "9:16", icon: "▶" },
    { label: "YouTube Short", id: "yt_short", res: "1080×1920", ratio: "9:16", icon: "▶" },
    { label: "Square", id: "square", res: "1080×1080", ratio: "1:1", icon: "◻" },
    { label: "Landscape", id: "landscape", res: "1920×1080", ratio: "16:9", icon: "▬" },
    { label: "Export Manifest (JSON)", id: "json", res: "—", ratio: "—", icon: "{}" },
  ];

  const handleExport = async (format: typeof EXPORT_FORMATS[number]) => {
    setShowExportMenu(false);
    if (format.id === "json") {
      const manifest = {
        title: title || "Untitled Reel",
        format: "reel",
        clips: frames.map((f, i) => ({
          position: i,
          asset_id: f.asset_id,
          filename: f.asset.filename,
          trim: clipTrims[f.id] ?? null,
          effects: clipEffects[f.id] ?? null,
          story_role: clipRoles[f.id] ?? null,
        })),
        captions,
        text_overlays: textOverlays,
        hook_text: hookText,
        cta_text: ctaText,
        music: musicTrack ? { id: musicTrack.id, filename: musicTrack.filename, volume: musicVolume, offset: musicStartOffset } : null,
        total_duration_s: totalReelDuration,
        exported_at: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "reel").replace(/\s+/g, "_")}_manifest.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    setExportNotice(`Export queued: ${format.label} (${format.res}) — your render will be ready shortly.`);
    setTimeout(() => setExportNotice(null), 5000);
  };

  // On media tab with no filter, exclude audio assets
  const filteredAssets = assetTab === "media" && !assetFilter
    ? libraryAssets.filter((a) => a.media_type === "image" || a.media_type === "video")
    : libraryAssets;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7]">
      {showDraftPicker && (
        <DraftPickerModal
          format="reel"
          onSelect={handleOpenDraft}
          onClose={() => setShowDraftPicker(false)}
        />
      )}
      {/* ═══ Top Bar ═══ */}
      <div className="shrink-0 border-b border-border bg-white px-5 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="text-text-tertiary hover:text-text-secondary transition-colors text-sm">←</a>
            <div className="w-px h-4 bg-border" />
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wide shrink-0">Reel Editor</span>
            <span className="text-text-tertiary text-xs">/</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Reel"
              className="text-sm font-semibold text-text-primary bg-transparent border-none outline-none placeholder:text-text-tertiary/60 min-w-0 flex-1 max-w-[240px] focus:ring-0"
            />
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {appliedTemplateId && (
              <span className="text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded-md font-medium border border-primary/10">
                From Template
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Keyboard shortcuts hint */}
            <span className="text-[9px] text-text-tertiary hidden lg:inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[8px] font-mono">Space</kbd> Play
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[8px] font-mono ml-1">T</kbd> Text
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[8px] font-mono ml-1">⌘S</kbd> Save
            </span>
            <div className="w-px h-4 bg-border" />
            {/* Auto-save toggle + status */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => setAutoSaveEnabled((v) => !v)}
                className={`w-7 h-4 rounded-full transition-colors relative ${autoSaveEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${autoSaveEnabled ? "left-3.5" : "left-0.5"}`} />
              </div>
              <span className="text-[11px] text-text-tertiary">Auto-save</span>
            </label>
            <span className="text-[10px] text-text-tertiary font-mono min-w-[80px]">
              {autoSaveStatus === "saving" && "Saving..."}
              {autoSaveStatus === "saved" && autoSavedAt && `✓ ${autoSavedAt}`}
              {autoSaveStatus === "error" && "⚠ Save failed"}
              {autoSaveStatus === "idle" && (savedAt ?? autoSavedAt) && `✓ ${savedAt ?? autoSavedAt}`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setShowDraftPicker(true)}>
              Open
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(true)}>
              Save as Template
            </Button>
            {/* Export As dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExportMenu((v) => !v)}
              >
                Export As ▾
              </Button>
              {showExportMenu && (
                <>
                  {/* backdrop */}
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl bg-white border border-border shadow-lg py-1 overflow-hidden">
                    {EXPORT_FORMATS.map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => handleExport(fmt)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-text-tertiary w-4 text-center">{fmt.icon}</span>
                          <span className="text-[12px] font-medium text-text-primary">{fmt.label}</span>
                        </div>
                        {fmt.res !== "—" && (
                          <span className="text-[9px] text-text-tertiary font-mono">{fmt.ratio}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            {draftStatus === "draft" && frames.length > 0 && (
              <Button size="sm" onClick={handleSubmitForReview}>Submit</Button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <div className="shrink-0 bg-red-50 border-b border-red-200 px-5 py-2 flex items-center justify-between">
          <span className="text-[11px] text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm">&times;</button>
        </div>
      )}
      {/* ═══ Export Notice ═══ */}
      {exportNotice && (
        <div className="shrink-0 bg-emerald-50 border-b border-emerald-200 px-5 py-2 flex items-center justify-between">
          <span className="text-[11px] text-emerald-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {exportNotice}
          </span>
          <button onClick={() => setExportNotice(null)} className="text-emerald-400 hover:text-emerald-600 text-sm">&times;</button>
        </div>
      )}

      {/* ═══ Main Editor Area ═══ */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Asset Library ── */}
        <div className="w-[260px] shrink-0 border-r border-border bg-white flex flex-col">
          <div className="flex border-b border-border-light shrink-0">
            {(["media", "templates", "music"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setAssetTab(tab); setAssetFilter(""); }}
                className={`flex-1 py-2 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                  assetTab === tab
                    ? "text-primary border-b-2 border-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {tab === "media" ? "Media" : tab === "templates" ? "Templates" : "Music"}
              </button>
            ))}
          </div>

          {/* ── Upload zone (media tab only) ── */}
          {assetTab === "media" && (
            <div className="px-3 pt-2.5 pb-2 border-b border-border-light">
              {/* Hidden file input */}
              <input
                ref={uploadInputRef}
                type="file"
                accept="video/*,image/*,audio/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
              />
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
                onDragLeave={() => setUploadDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setUploadDragOver(false);
                  if (e.dataTransfer.files.length > 0) handleUploadFiles(e.dataTransfer.files);
                }}
                onClick={() => !uploading && uploadInputRef.current?.click()}
                className={[
                  "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-2.5 cursor-pointer transition-colors",
                  uploading ? "opacity-60 pointer-events-none" : "",
                  uploadDragOver
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border-light text-text-tertiary hover:border-primary/40 hover:text-text-secondary",
                ].join(" ")}
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                    <span className="text-[11px] font-medium text-primary">Uploading…</span>
                  </>
                ) : (
                  <>
                    <span className="text-base leading-none" aria-hidden="true">⬆</span>
                    <span className="text-[11px] font-medium">
                      {uploadDragOver ? "Drop to upload" : "Upload video / image"}
                    </span>
                  </>
                )}
              </div>
              {uploadError && (
                <p className="mt-1.5 text-[10px] text-danger flex items-center justify-between gap-1">
                  <span className="truncate">{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="shrink-0 hover:text-red-700">✕</button>
                </p>
              )}
            </div>
          )}

          {/* ── Music import zone ── */}
          {assetTab === "music" && (
            <div className="px-3 pt-2.5 pb-2 border-b border-border-light">
              <input
                ref={musicUploadInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleUploadFiles(e.target.files);
                  if (musicUploadInputRef.current) musicUploadInputRef.current.value = "";
                }}
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setMusicDragOver(true); }}
                onDragLeave={() => setMusicDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setMusicDragOver(false);
                  if (e.dataTransfer.files.length > 0) handleUploadFiles(e.dataTransfer.files);
                }}
                onClick={() => !uploading && musicUploadInputRef.current?.click()}
                className={[
                  "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-2.5 cursor-pointer transition-colors",
                  uploading ? "opacity-60 pointer-events-none" : "",
                  musicDragOver
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border-light text-text-tertiary hover:border-primary/40 hover:text-text-secondary",
                ].join(" ")}
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                    <span className="text-[11px] font-medium text-primary">Uploading…</span>
                  </>
                ) : (
                  <>
                    <span className="text-base leading-none" aria-hidden="true">♪</span>
                    <span className="text-[11px] font-medium">
                      {musicDragOver ? "Drop to import" : "Import music file"}
                    </span>
                  </>
                )}
              </div>
              {uploadError && assetTab === "music" && (
                <p className="mt-1.5 text-[10px] text-danger flex items-center justify-between gap-1">
                  <span className="truncate">{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="shrink-0 hover:text-red-700">✕</button>
                </p>
              )}
            </div>
          )}

          {assetTab !== "templates" && (
            <div className="px-3 pt-2.5 pb-2 border-b border-border-light space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder={assetTab === "music" ? "Search music..." : "Search media..."}
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="w-full rounded-lg border border-border pl-7 pr-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface-secondary"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[10px]">⌕</span>
              </div>
              {assetTab === "media" && (
                <div className="flex gap-1">
                  {([
                    { label: "All", value: "" as const },
                    { label: "Photos", value: "image" as const },
                    { label: "Videos", value: "video" as const },
                  ]).map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setAssetFilter(f.value)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                        assetFilter === f.value
                          ? "bg-primary text-white shadow-sm"
                          : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            {/* Templates tab */}
            {assetTab === "templates" && (
              <>
                {templatesLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
                {!templatesLoading && templates.length === 0 && (
                  <div className="text-center py-10">
                    <div className="text-xl text-text-tertiary/30 mb-2">⎔</div>
                    <div className="text-[11px] text-text-tertiary mb-2">No templates yet</div>
                    <div className="text-[10px] text-text-tertiary leading-relaxed px-4">
                      Build a reel then &quot;Save as Template&quot;
                    </div>
                  </div>
                )}
                {!templatesLoading && templates.map((tpl) => (
                  <div key={tpl.id} className={`rounded-lg border overflow-hidden bg-white mb-2 transition-all hover:shadow-md ${
                    appliedTemplateId === tpl.id ? "border-primary shadow-sm" : "border-border/60 hover:border-primary/30"
                  }`}>
                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
                      {tpl.thumbnail_asset_id ? (
                        <img src={`${API_BASE}/assets/${tpl.thumbnail_asset_id}/file`} alt={tpl.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><span className="text-2xl text-text-tertiary/20">⎔</span></div>
                      )}
                      <div className="absolute top-1.5 left-1.5">
                        <span className="text-[8px] font-semibold bg-black/50 text-white px-1.5 py-0.5 rounded backdrop-blur-sm uppercase tracking-wide">
                          {tpl.category.replace("_", " ")}
                        </span>
                      </div>
                      <div className="absolute top-1.5 right-1.5">
                        <span className="text-[8px] font-semibold bg-black/50 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
                          {tpl.clip_slots.length} clip{tpl.clip_slots.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-[11px] font-semibold text-text-primary truncate">{tpl.name}</div>
                      {tpl.hook_text && <div className="text-[10px] text-text-tertiary truncate mt-0.5 italic">&quot;{tpl.hook_text}&quot;</div>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] text-text-tertiary">Used {tpl.usage_count}x</span>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={() => handleApplyTemplate(tpl)} className="flex-1 text-[10px] font-medium text-white bg-primary hover:bg-primary-dark py-1.5 rounded-md transition-colors">Use</button>
                        <button onClick={() => handleDuplicateTemplate(tpl)} className="text-[10px] text-text-tertiary hover:text-primary px-2 py-1.5 rounded-md border border-border hover:border-primary/30 transition-colors" title="Duplicate">⧉</button>
                        <button onClick={() => handleDeleteTemplate(tpl.id)} className="text-[10px] text-text-tertiary hover:text-red-500 px-2 py-1.5 rounded-md border border-border hover:border-red-200 transition-colors" title="Delete">×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Loading / Empty */}
            {assetTab !== "templates" && libraryLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {assetTab !== "templates" && !libraryLoading && filteredAssets.length === 0 && (
              <div className="text-center py-10">
                <div className="text-xl text-text-tertiary/40 mb-2">{assetTab === "music" ? "♪" : "⬚"}</div>
                <div className="text-[11px] text-text-tertiary">
                  {assetTab === "music" ? "No audio files found." : "No media assets available."}
                </div>
              </div>
            )}

            {/* Video grid */}
            {assetTab === "media" && (
              <>
              <div className="grid grid-cols-2 gap-1.5">
                {filteredAssets.map((asset) =>
                  asset.media_type === "video" ? (
                    <VideoThumbCard
                      key={asset.id}
                      asset={asset}
                      aiScore={aiScores[asset.id]}
                      onClick={() => handleAddClip(asset)}
                    />
                  ) : (
                    <button
                      key={asset.id}
                      onClick={() => handleAddClip(asset)}
                      className="group rounded-lg overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-md transition-all text-left bg-white"
                    >
                      <div className="aspect-[9/16] overflow-hidden bg-gray-50 relative">
                        <img src={`${API_BASE}/assets/${asset.id}/file`} alt={asset.filename} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute top-1 left-1">
                          <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded backdrop-blur-sm bg-amber-500/70 text-white">IMG</span>
                        </div>
                        {asset.duration != null && (
                          <div className="absolute bottom-1 right-1">
                            <span className="text-[9px] bg-black/60 text-white px-1 rounded backdrop-blur-sm">{asset.duration.toFixed(1)}s</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-all flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
                            <span className="text-primary text-xs font-bold">+</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-1.5 py-1">
                        <div className="text-[10px] font-medium text-text-primary truncate">{asset.filename}</div>
                      </div>
                    </button>
                  )
                )}
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between gap-2 pt-2 pb-1">
                <button
                  onClick={() => setLibraryPage((p) => Math.max(0, p - 1))}
                  disabled={libraryPage === 0 || libraryLoading}
                  className="px-2 py-1 rounded text-[10px] font-medium text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Prev
                </button>
                <span className="text-[9px] text-text-tertiary">
                  {libraryTotal === 0 ? "0" : `${libraryPage * ASSET_PAGE_SIZE + 1}–${Math.min((libraryPage + 1) * ASSET_PAGE_SIZE, libraryTotal)}`} of {libraryTotal}
                </span>
                <button
                  onClick={() => setLibraryPage((p) => p + 1)}
                  disabled={(libraryPage + 1) * ASSET_PAGE_SIZE >= libraryTotal || libraryLoading}
                  className="px-2 py-1 rounded text-[10px] font-medium text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next ›
                </button>
              </div>
              </>
            )}

            {/* Music list */}
            {assetTab === "music" && (
              <>
              <div className="space-y-1">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => handleSelectMusic(asset)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5 ${
                      musicTrack?.id === asset.id ? "bg-primary/5 border border-primary/20" : "hover:bg-surface-secondary border border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center shrink-0">
                      <span className="text-sm text-purple-400">♪</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-text-primary truncate">{asset.filename}</div>
                      <div className="text-[10px] text-text-tertiary">
                        {asset.duration != null ? formatTime(asset.duration) : "Audio"}
                        {asset.extension && ` · ${asset.extension.replace(".", "").toUpperCase()}`}
                      </div>
                    </div>
                    {musicTrack?.id === asset.id && <span className="text-[9px] font-semibold text-primary">SELECTED</span>}
                  </button>
                ))}
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between gap-2 pt-2 pb-1">
                <button
                  onClick={() => setLibraryPage((p) => Math.max(0, p - 1))}
                  disabled={libraryPage === 0 || libraryLoading}
                  className="px-2 py-1 rounded text-[10px] font-medium text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ‹ Prev
                </button>
                <span className="text-[9px] text-text-tertiary">
                  {libraryTotal === 0 ? "0" : `${libraryPage * ASSET_PAGE_SIZE + 1}–${Math.min((libraryPage + 1) * ASSET_PAGE_SIZE, libraryTotal)}`} of {libraryTotal}
                </span>
                <button
                  onClick={() => setLibraryPage((p) => p + 1)}
                  disabled={(libraryPage + 1) * ASSET_PAGE_SIZE >= libraryTotal || libraryLoading}
                  className="px-2 py-1 rounded text-[10px] font-medium text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next ›
                </button>
              </div>
              </>
            )}
          </div>
        </div>

        {/* ── Center: Preview + Timeline ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Reel structure bar */}
          {frames.length > 0 && (
            <div className="shrink-0 px-4 pt-2 pb-1 bg-white border-b border-border">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${hookText ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>
                  <span>Hook</span>
                  {hookText && <span className="text-[8px]">✓</span>}
                </div>
                <span className="text-[8px] text-text-tertiary">→</span>
                {frames.map((clip, i) => (
                  <button
                    key={clip.id}
                    onClick={() => setSelectedClipIndex(i)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors ${
                      i === selectedClipIndex ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                    }`}
                  >
                    Clip {i + 1}
                  </button>
                ))}
                <span className="text-[8px] text-text-tertiary">→</span>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${ctaText ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                  <span>CTA</span>
                  {ctaText && <span className="text-[8px]">✓</span>}
                </div>
                <div className="flex-1" />
                <span className="text-[9px] text-text-tertiary font-mono">{formatTime(totalReelDuration)}</span>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="relative flex-1 flex">
            <Preview
              ref={videoRef}
              activeClip={activeClip}
              clipCount={frames.length}
              selectedClipIndex={selectedClipIndex}
              clipEffects={clipEffects}
              textOverlays={textOverlays}
              selectedTextId={selectedTextId}
              hookText={hookText}
              ctaText={ctaText}
              activeCaption={activeCaption}
              musicTrack={musicTrack}
              isPlaying={isPlaying}
              currentTime={globalTime}
              totalDuration={totalReelDuration}
              onTogglePlayback={togglePlayback}
              onSelectText={setSelectedTextId}
              onMoveText={moveTextOverlay}
              onResizeText={resizeTextOverlay}
            />
            {/* ── Playback debug overlay ── */}
            {process.env.NODE_ENV === "development" && frames.length > 0 && (
              <div className="absolute top-2 right-2 z-50 bg-black/80 text-[10px] font-mono text-green-400 rounded px-2 py-1.5 space-y-0.5 pointer-events-none leading-snug">
                <div>global: {globalTime.toFixed(2)}s</div>
                <div>clip: {selectedClipIndex + 1}/{frames.length} · {activeClip?.id.slice(-6) ?? "—"}</div>
                <div>local: {(videoRef.current?.currentTime ?? 0).toFixed(2)}s</div>
                <div>trim: [{activeClipTrim?.inPoint?.toFixed(1) ?? "0"} → {activeClipTrim?.outPoint?.toFixed(1) ?? "end"}]</div>
                <div>state: {isPlaying ? "▶ playing" : "⏸ paused"}</div>
              </div>
            )}
          </div>

          {/* Quick toolbar above timeline */}
          {frames.length > 0 && (
            <div className="shrink-0 px-3 py-1.5 bg-white border-t border-border flex items-center gap-2">
              <button
                onClick={togglePlayback}
                className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs hover:bg-primary-dark transition-colors shrink-0"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <span className="text-[10px] text-text-secondary font-mono w-20 shrink-0">
                {formatTime(globalTime)} / {formatTime(totalReelDuration)}
              </span>
              <div className="flex-1" />
              <button onClick={handleAddText} className="text-[10px] font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded border border-blue-200 hover:border-blue-300 transition-colors flex items-center gap-1">
                <span className="text-[9px]">T</span> Add Text
              </button>
              <button onClick={addCaption} className="text-[10px] font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded border border-amber-200 hover:border-amber-300 transition-colors flex items-center gap-1">
                <span className="text-[9px]">Cc</span> Caption
              </button>
              <span className="text-[9px] text-text-tertiary">
                {frames.length} clip{frames.length !== 1 ? "s" : ""} · {captions.length} caption{captions.length !== 1 ? "s" : ""} · {textOverlays.length} text
              </span>
            </div>
          )}

          {/* Timeline */}
          {frames.length > 0 && (
            <Timeline
              frames={frames}
              clipTrims={clipTrims}
              captions={captions}
              textOverlays={textOverlays}
              musicTrack={musicTrack ? { id: musicTrack.id, filename: musicTrack.filename, duration: musicTrack.duration } : null}
              musicStartOffset={musicStartOffset}
              selectedClipIndex={selectedClipIndex}
              selectedCaptionId={selectedCaptionId}
              selectedTextId={selectedTextId}
              currentTime={globalTime}
              totalDuration={totalReelDuration}
              isPlaying={isPlaying}
              onSelectClip={(i) => { setSelectedClipIndex(i); setRightTab("clip"); }}
              onSelectCaption={(id) => { setSelectedCaptionId(id); if (id) setRightTab("captions"); }}
              onSelectText={(id) => { setSelectedTextId(id); if (id) setRightTab("text"); }}
              onSeek={seekGlobal}
              onReorderClips={handleReorderClips}
              onSplitClip={handleSplitClip}
              onTrimClip={(clipIndex, updates) => {
                const clip = frames[clipIndex];
                if (clip) updateClipTrim(clip.id, updates);
              }}
              getClipDuration={getClipDuration}
              clipRoles={clipRoles}
            />
          )}

          {/* Hidden audio */}
          {musicTrack && (
            <audio ref={audioRef} src={`${API_BASE}/assets/${musicTrack.id}/file`} preload="auto" loop />
          )}
        </div>

        {/* ── Right: Properties Panel ── */}
        <div className="w-[270px] shrink-0 border-l border-border bg-white flex flex-col">
          <div className="flex border-b border-border-light shrink-0">
            {(["settings", "clip", "text", "captions", "music", "ai"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                  rightTab === tab
                    ? tab === "ai" ? "text-[#39de8b] border-b-2 border-[#39de8b]" : "text-primary border-b-2 border-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {tab === "settings" ? "Reel" : tab === "clip" ? "Clip" : tab === "text" ? "Text" : tab === "captions" ? "Cap" : tab === "music" ? "Music" : "✦ AI"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Reel Settings Tab ── */}
            {rightTab === "settings" && (
              <div className="p-3.5 space-y-4">
                <div>
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled Reel"
                    className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Hook Text</label>
                  <input type="text" value={hookText} onChange={(e) => setHookText(e.target.value)} placeholder="Opening line..."
                    className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  <div className="text-[9px] text-text-tertiary mt-0.5">Displayed at top during playback</div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Call to Action</label>
                  <input type="text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Follow for more..."
                    className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div className="pt-2 border-t border-border-light space-y-3">
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Instagram Caption</label>
                  <div>
                    <textarea
                      value={postCaption}
                      onChange={(e) => setPostCaption(e.target.value)}
                      rows={4}
                      placeholder="Write your Instagram caption..."
                      className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                    <div className="text-[9px] text-text-tertiary mt-0.5 text-right">{postCaption.length} chars</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Hashtags</label>
                    <input
                      type="text"
                      value={postHashtags}
                      onChange={(e) => setPostHashtags(e.target.value)}
                      placeholder="#reforestation #climateaction"
                      className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  {(postCaption || postHashtags) && (
                    <button
                      onClick={() => navigator.clipboard.writeText(`${postCaption}${postHashtags ? `\n\n${postHashtags}` : ""}`)}
                      className="w-full py-1.5 rounded-lg border border-border text-[10px] font-medium text-text-tertiary hover:text-primary hover:border-primary transition-colors"
                    >
                      Copy Caption
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Format</label>
                    <div className="text-xs text-text-primary bg-surface-secondary rounded-lg px-2.5 py-1.5 border border-border-light">Reel</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Status</label>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                </div>
                {/* Workflow */}
                <div className="pt-2 border-t border-border-light">
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-2">Workflow</label>
                  <div className="space-y-1">
                    {(["draft", "in_review", "approved", "scheduled"] as const).map((step, i) => {
                      const stepConfig = STATUS_CONFIG[step];
                      const isActive = draftStatus === step;
                      const steps = ["draft", "in_review", "approved", "scheduled"];
                      const isPast = steps.indexOf(draftStatus) > i;
                      return (
                        <div key={step} className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                            isActive ? "bg-primary text-white shadow-sm shadow-primary/20" : isPast ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                          }`}>
                            {isPast ? "✓" : i + 1}
                          </div>
                          <span className={`text-xs ${isActive ? "text-text-primary font-semibold" : isPast ? "text-emerald-600" : "text-text-tertiary"}`}>
                            {stepConfig.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Clip Tab ── */}
            {rightTab === "clip" && (
              <div className="p-3.5 space-y-4">
                {activeClip ? (
                  <>
                    <div>
                      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                        Clip {selectedClipIndex + 1} of {frames.length}
                      </span>
                      <div className="p-2.5 rounded-lg bg-surface-secondary border border-border-light">
                        <div className="text-[11px] font-medium text-text-primary truncate">{activeClip.asset.filename}</div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">
                          {activeClip.asset.media_type} · {activeClip.asset.duration != null ? formatTime(activeClip.asset.duration) : "N/A"}
                          {activeClip.asset.width && activeClip.asset.height && ` · ${activeClip.asset.width}×${activeClip.asset.height}`}
                        </div>
                      </div>
                    </div>

                    {/* Trim */}
                    {activeClip.asset.media_type === "video" && (
                      <div>
                        <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">Trim</span>
                        <div className="space-y-2.5">
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] font-medium text-text-secondary">In Point</span>
                              <span className="text-[10px] text-text-tertiary font-mono">{formatTime(activeClipTrim?.inPoint ?? 0)}</span>
                            </div>
                            <input type="range" min={0} max={(activeClip.asset.duration ?? duration) * 10}
                              value={(activeClipTrim?.inPoint ?? 0) * 10}
                              onChange={(e) => updateClipTrim(activeClip.id, { inPoint: Number(e.target.value) / 10 })}
                              className="w-full h-1.5 accent-primary" />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] font-medium text-text-secondary">Out Point</span>
                              <span className="text-[10px] text-text-tertiary font-mono">{formatTime(activeClipTrim?.outPoint ?? activeClip.asset.duration ?? duration)}</span>
                            </div>
                            <input type="range" min={0} max={(activeClip.asset.duration ?? duration) * 10}
                              value={(activeClipTrim?.outPoint ?? activeClip.asset.duration ?? duration) * 10}
                              onChange={(e) => updateClipTrim(activeClip.id, { outPoint: Number(e.target.value) / 10 })}
                              className="w-full h-1.5 accent-primary" />
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateClipTrim(activeClip.id, { inPoint: currentTime })}
                              className="flex-1 text-[10px] font-medium text-text-secondary hover:text-primary py-1 rounded-lg border border-border hover:border-primary/30 transition-colors">
                              Set In
                            </button>
                            <button onClick={() => updateClipTrim(activeClip.id, { outPoint: currentTime })}
                              className="flex-1 text-[10px] font-medium text-text-secondary hover:text-primary py-1 rounded-lg border border-border hover:border-primary/30 transition-colors">
                              Set Out
                            </button>
                          </div>
                          <div className="flex items-center justify-between bg-surface-secondary rounded-lg px-3 py-1.5">
                            <span className="text-[10px] text-text-tertiary">Trimmed</span>
                            <span className="text-[11px] font-semibold text-text-primary font-mono">{formatTime(getClipDuration(activeClip))}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Effects */}
                    <div className="pt-2 border-t border-border-light">
                      <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">Effects</span>
                      <EffectsPanel
                        effects={clipEffects[activeClip.id] ?? DEFAULT_EFFECTS}
                        onChange={(fx) => updateClipEffects(activeClip.id, fx)}
                      />
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-border-light space-y-1.5">
                      <div className="flex gap-2">
                        {selectedClipIndex > 0 && (
                          <button onClick={() => handleReorderClips(selectedClipIndex, selectedClipIndex - 1)}
                            className="flex-1 text-[10px] font-medium text-text-secondary hover:text-primary py-1 rounded-lg border border-border hover:border-primary/30 transition-colors">
                            ← Move
                          </button>
                        )}
                        {selectedClipIndex < frames.length - 1 && (
                          <button onClick={() => handleReorderClips(selectedClipIndex, selectedClipIndex + 1)}
                            className="flex-1 text-[10px] font-medium text-text-secondary hover:text-primary py-1 rounded-lg border border-border hover:border-primary/30 transition-colors">
                            Move →
                          </button>
                        )}
                      </div>
                      <button onClick={() => handleDuplicateClip(selectedClipIndex)}
                        className="w-full text-[10px] font-medium text-text-secondary hover:text-primary py-1 rounded-lg border border-border hover:border-primary/30 transition-colors">
                        Duplicate Clip
                      </button>
                      <button onClick={() => handleRemoveClip(activeClip)}
                        className="w-full text-[10px] font-medium text-red-500 hover:text-red-700 py-1 rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors">
                        Remove Clip
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg">
                    <div className="text-lg text-text-tertiary/40 mb-2">🎬</div>
                    <div className="text-[11px] text-text-tertiary">No clip selected</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Text Tab ── */}
            {rightTab === "text" && (
              <div className="p-3.5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">Text Overlays</span>
                  <button onClick={handleAddText} className="text-[10px] font-medium text-blue-600 hover:text-blue-700 transition-colors">+ Add</button>
                </div>

                {textOverlays.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg">
                    <div className="text-lg text-text-tertiary/40 mb-2">T</div>
                    <div className="text-[11px] text-text-tertiary mb-3">No text overlays</div>
                    <button onClick={handleAddText} className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                      Add Text Layer
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Text layer list */}
                    <div className="space-y-1.5">
                      {textOverlays.map((txt) => (
                        <button
                          key={txt.id}
                          onClick={() => { setSelectedTextId(txt.id); seekGlobal(txt.startTime); }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg transition-all border ${
                            txt.id === selectedTextId ? "bg-blue-50 border-blue-200" : "border-transparent hover:bg-surface-secondary"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">T</span>
                            <span className="text-[9px] text-text-tertiary font-mono">
                              {formatTime(txt.startTime)} → {formatTime(txt.endTime)}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-primary truncate">{txt.text}</div>
                        </button>
                      ))}
                    </div>

                    {/* Selected text editor */}
                    {selectedText && (
                      <div className="border-t border-border-light pt-3">
                        <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block mb-2">Edit Text</span>
                        <TextOverlayEditor
                          overlay={selectedText}
                          totalDuration={totalReelDuration}
                          onChange={(updated) => updateTextOverlay(selectedText.id, updated)}
                          onDelete={() => deleteTextOverlay(selectedText.id)}
                          onDuplicate={() => duplicateTextOverlay(selectedText.id)}
                          onApplyToAll={frames.length > 1 ? () => applyTextOverlayToAll(selectedText.id) : undefined}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Captions Tab ── */}
            {rightTab === "captions" && (
              <div className="p-3.5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">Captions</span>
                  <button onClick={addCaption} className="text-[10px] font-medium text-primary hover:text-primary-dark transition-colors">+ Add</button>
                </div>

                {captions.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg">
                    <div className="text-lg text-text-tertiary/40 mb-2">Cc</div>
                    <div className="text-[11px] text-text-tertiary mb-3">No captions yet</div>
                    <button onClick={addCaption} className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                      Add First Caption
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {captions.map((cap) => (
                      <button
                        key={cap.id}
                        onClick={() => { setSelectedCaptionId(cap.id); seekGlobal(cap.startTime); }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg transition-all border ${
                          cap.id === selectedCaptionId ? "bg-primary/5 border-primary/20" : "border-transparent hover:bg-surface-secondary"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${CAPTION_STYLES[cap.style].className}`}>
                            {CAPTION_STYLES[cap.style].label}
                          </span>
                          <span className="text-[9px] text-text-tertiary font-mono">
                            {formatTime(cap.startTime)} → {formatTime(cap.endTime)}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-primary truncate">
                          {cap.text || <span className="text-text-tertiary italic">Empty</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected caption editor */}
                {selectedCaption && (
                  <div className="border-t border-border-light pt-3 space-y-2.5">
                    <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block">Edit Caption</span>
                    <textarea
                      value={selectedCaption.text}
                      onChange={(e) => updateCaption(selectedCaption.id, { text: e.target.value })}
                      rows={2}
                      placeholder="Caption text..."
                      className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                    <div>
                      <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Style</label>
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(CAPTION_STYLES) as Caption["style"][]).map((style) => (
                          <button
                            key={style}
                            onClick={() => updateCaption(selectedCaption.id, { style })}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              selectedCaption.style === style ? "bg-primary text-white" : CAPTION_STYLES[style].className + " hover:opacity-80"
                            }`}
                          >
                            {CAPTION_STYLES[style].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-text-tertiary block mb-0.5">Start</span>
                        <input type="text" value={formatTime(selectedCaption.startTime)}
                          onChange={(e) => updateCaption(selectedCaption.id, { startTime: parseTime(e.target.value) })}
                          className="w-full rounded-lg border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div>
                        <span className="text-[9px] text-text-tertiary block mb-0.5">End</span>
                        <input type="text" value={formatTime(selectedCaption.endTime)}
                          onChange={(e) => updateCaption(selectedCaption.id, { endTime: parseTime(e.target.value) })}
                          className="w-full rounded-lg border border-border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const dup = { ...selectedCaption, id: crypto.randomUUID(), startTime: selectedCaption.endTime, endTime: selectedCaption.endTime + 3 };
                          setCaptions((prev) => [...prev, dup].sort((a, b) => a.startTime - b.startTime));
                          setSelectedCaptionId(dup.id);
                        }}
                        className="flex-1 text-[10px] font-medium text-text-secondary hover:text-primary py-1 rounded-lg border border-border hover:border-primary/30 transition-colors">
                        Duplicate
                      </button>
                      <button onClick={() => deleteCaption(selectedCaption.id)}
                        className="flex-1 text-[10px] font-medium text-red-500 hover:text-red-700 py-1 rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Music Tab ── */}
            {rightTab === "music" && (
              <div className="p-3.5 space-y-4">
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block">Music Track</span>
                {musicTrack ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-50/30 border border-purple-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-200 to-purple-100 flex items-center justify-center shrink-0">
                          <span className="text-lg text-purple-500">♪</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold text-text-primary truncate">{musicTrack.filename}</div>
                          <div className="text-[10px] text-text-tertiary">
                            {musicTrack.duration != null ? formatTime(musicTrack.duration) : "Audio"}
                            {musicTrack.extension && ` · ${musicTrack.extension.replace(".", "").toUpperCase()}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Music start offset */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-medium text-text-secondary">Start Offset</span>
                        <span className="text-[10px] text-text-tertiary font-mono">{formatTime(musicStartOffset)}</span>
                      </div>
                      <input type="range" min={0} max={totalReelDuration * 10} value={musicStartOffset * 10}
                        onChange={(e) => setMusicStartOffset(Number(e.target.value) / 10)}
                        className="w-full h-1.5 accent-purple-500" />
                    </div>

                    {/* Volume controls */}
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-medium text-text-secondary">Music Volume</span>
                          <span className="text-[10px] text-text-tertiary">{musicVolume}%</span>
                        </div>
                        <input type="range" min={0} max={100} value={musicVolume}
                          onChange={(e) => setMusicVolume(Number(e.target.value))} className="w-full h-1.5 accent-purple-500" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-medium text-text-secondary">Original Audio</span>
                          <span className="text-[10px] text-text-tertiary">{videoVolume}%</span>
                        </div>
                        <input type="range" min={0} max={100} value={videoVolume}
                          onChange={(e) => setVideoVolume(Number(e.target.value))} className="w-full h-1.5 accent-primary" />
                      </div>
                    </div>

                    {/* Mix presets */}
                    <div>
                      <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Presets</span>
                      <div className="flex gap-1.5">
                        {[
                          { label: "Music", music: 100, video: 0 },
                          { label: "Focus", music: 80, video: 30 },
                          { label: "Balanced", music: 60, video: 60 },
                          { label: "Voice", music: 30, video: 100 },
                        ].map((preset) => (
                          <button key={preset.label}
                            onClick={() => { setMusicVolume(preset.music); setVideoVolume(preset.video); }}
                            className="flex-1 text-[9px] font-medium text-text-secondary py-1 rounded-md border border-border hover:border-primary/30 hover:text-primary transition-colors">
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button onClick={handleRemoveMusic}
                      className="w-full text-[10px] font-medium text-red-500 hover:text-red-700 py-1 rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors">
                      Remove Music
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-border rounded-lg">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl text-purple-300">♪</span>
                    </div>
                    <div className="text-[11px] text-text-tertiary mb-3">No music selected</div>
                    <button onClick={() => setAssetTab("music")}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-purple-500 text-white hover:bg-purple-600 transition-colors">
                      Browse Music
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── AI Reel Director Tab ── */}
            {rightTab === "ai" && (
              <div className="p-3 space-y-4 pb-8">

                {/* Header */}
                <div className="bg-[#002a27] rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-[#39de8b]">✦</span>
                    <div>
                      <div className="text-[11px] font-bold text-[#39de8b]">AI Reel Director</div>
                      <div className="text-[9px] text-white/50">Score → Strategy → Generate → Edit</div>
                    </div>
                  </div>
                </div>

                {/* ── Reel Strategy ── */}
                <div>
                  <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">Reel Strategy</div>
                  <div className="space-y-3">

                    {/* Objective */}
                    <div>
                      <label className="text-[9px] font-medium text-text-tertiary uppercase tracking-wide block mb-1.5">Objective</label>
                      <div className="grid grid-cols-2 gap-1">
                        {([
                          { v: "awareness",  label: "Awareness",  icon: "📢" },
                          { v: "engagement", label: "Engagement", icon: "❤️" },
                          { v: "conversion", label: "Conversion",  icon: "🔗" },
                          { v: "education",  label: "Education",  icon: "💡" },
                        ] as const).map((o) => (
                          <button key={o.v} onClick={() => setAiObjective(o.v)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-left transition-colors ${aiObjective === o.v ? "bg-[#002a27] text-[#39de8b]" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"}`}>
                            <span className="text-[11px]">{o.icon}</span>
                            <span className="text-[9px] font-semibold">{o.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Story Type */}
                    <div>
                      <label className="text-[9px] font-medium text-text-tertiary uppercase tracking-wide block mb-1.5">Story Structure</label>
                      <div className="space-y-1">
                        {([
                          { v: "narrative",         label: "Narrative Arc",      icon: "📖", desc: "Hook → Setup → Proof → Escalation → Payoff → CTA" },
                          { v: "hook_reveal",        label: "Hook + Reveal",      icon: "⚡", desc: "Hook → Build → Build → Reveal → CTA" },
                          { v: "problem_solution",   label: "Problem → Solution", icon: "🔧", desc: "Hook → Problem → Solution → Proof → CTA" },
                          { v: "montage",            label: "Montage",            icon: "🎬", desc: "Hook → Impact × 4 → CTA" },
                          { v: "testimonial",        label: "Testimonial",        icon: "🎙️", desc: "Hook → Story → B-Roll → Impact → CTA" },
                          { v: "educational",        label: "Educational",        icon: "🧠", desc: "Hook → Teach → B-Roll → Recap → CTA" },
                        ] as const).map((s) => (
                          <button key={s.v} onClick={() => setAiStoryType(s.v)}
                            className={`w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${aiStoryType === s.v ? "bg-[#002a27] text-[#39de8b]" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"}`}>
                            <span className="text-[11px] mt-0.5 shrink-0">{s.icon}</span>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold leading-tight">{s.label}</div>
                              <div className={`text-[8px] leading-tight mt-0.5 ${aiStoryType === s.v ? "text-[#39de8b]/70" : "text-text-tertiary"}`}>{s.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tone */}
                    <div>
                      <label className="text-[9px] font-medium text-text-tertiary uppercase tracking-wide block mb-1.5">Tone</label>
                      <div className="flex flex-wrap gap-1">
                        {(["inspiring", "educational", "entertaining", "urgent", "calm"] as const).map((t) => (
                          <button key={t} onClick={() => setAiTone(t)}
                            className={`px-2 py-1 rounded-full text-[9px] font-semibold transition-colors capitalize ${aiTone === t ? "bg-[#002a27] text-[#39de8b]" : "bg-surface-secondary text-text-tertiary hover:bg-surface-tertiary"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Audience */}
                    <div>
                      <label className="text-[9px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Audience</label>
                      <select value={aiAudience} onChange={(e) => setAiAudience(e.target.value)}
                        className="w-full text-[10px] border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#39de8b]">
                        <option value="general">General</option>
                        <option value="young_adults">Young Adults (18-30)</option>
                        <option value="professionals">Professionals</option>
                        <option value="eco_conscious">Eco-Conscious</option>
                      </select>
                    </div>

                    {/* Duration + Versions */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Duration — {aiDuration}s</label>
                        <input type="range" min={10} max={90} step={5} value={aiDuration}
                          onChange={(e) => setAiDuration(Number(e.target.value))}
                          className="w-full h-1 accent-[#39de8b]" />
                        <div className="flex justify-between text-[8px] text-text-tertiary mt-0.5">
                          <span>10s</span><span>60s</span><span>90s</span>
                        </div>
                      </div>
                      <div className="w-16">
                        <label className="text-[9px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Drafts</label>
                        <div className="flex flex-col gap-0.5">
                          {[1, 2, 3].map((v) => (
                            <button key={v} onClick={() => setAiVersions(v)}
                              className={`py-0.5 rounded text-[9px] font-bold transition-colors ${aiVersions === v ? "bg-[#002a27] text-[#39de8b]" : "bg-surface-secondary text-text-secondary"}`}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Analyze Library ── */}
                <div>
                  <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">
                    Library Analysis
                    {Object.keys(aiScores).length > 0 && (
                      <span className="ml-1 text-[8px] text-[#39de8b] normal-case font-normal">· {Object.keys(aiScores).length} clips scored</span>
                    )}
                  </div>
                  {aiJobStatus ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-medium ${aiJobStatus.status === "done" ? "text-emerald-600" : aiJobStatus.status === "error" ? "text-red-500" : "text-amber-600"}`}>
                          {aiJobStatus.status === "done" ? `✓ ${aiJobStatus.analyzed} clips scored` : aiJobStatus.status === "error" ? "✗ Error" : `Scoring… ${aiJobStatus.analyzed}/${aiJobStatus.total}`}
                        </span>
                        <span className="text-text-tertiary">{Math.round(aiJobStatus.progress * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-[#39de8b] transition-all duration-500 rounded-full" style={{ width: `${aiJobStatus.progress * 100}%` }} />
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleAnalyzeLibrary}
                      className="w-full py-2 rounded-lg bg-[#002a27] hover:bg-[#003d38] text-[#39de8b] text-[11px] font-semibold transition-colors">
                      Score All Video Clips
                    </button>
                  )}
                  {aiJobStatus?.status === "done" && (
                    <button onClick={handleAnalyzeLibrary}
                      className="w-full mt-1 py-1 rounded-lg border border-border text-[9px] text-text-tertiary hover:text-text-secondary transition-colors">
                      Re-score library
                    </button>
                  )}
                </div>

                {/* ── Generate ── */}
                <div className={aiJobStatus?.status !== "done" ? "opacity-40 pointer-events-none" : ""}>
                  {aiError && (
                    <div className="text-[10px] text-red-600 bg-red-50 rounded-lg px-2 py-1.5 mb-2 leading-relaxed">{aiError}</div>
                  )}
                  <button
                    onClick={handleGenerateReel}
                    disabled={aiGenerating || aiJobStatus?.status !== "done"}
                    className="w-full py-2.5 rounded-xl bg-[#39de8b] hover:bg-[#2ec97a] disabled:opacity-50 text-[#002a27] text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                    {aiGenerating ? (
                      <><div className="w-3.5 h-3.5 border-2 border-[#002a27]/30 border-t-[#002a27] rounded-full animate-spin" />Generating…</>
                    ) : (
                      <>✦ Generate {aiVersions} Draft{aiVersions !== 1 ? "s" : ""}</>
                    )}
                  </button>
                  {aiVersionResults.length > 0 && (
                    <button onClick={() => { setAiVersionResults([]); setExpandedWhy(null); }}
                      className="w-full mt-1 py-1 rounded-lg border border-border text-[9px] text-text-tertiary hover:text-text-secondary transition-colors">
                      Clear results
                    </button>
                  )}
                </div>

                {/* ── Version Results ── */}
                {aiVersionResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
                      {aiVersionResults.length} Draft{aiVersionResults.length !== 1 ? "s" : ""} Generated
                    </div>
                    {aiVersionResults.map((timeline, vi) => (
                      <div key={vi} className="border border-border rounded-xl overflow-hidden bg-white">
                        {/* Version header */}
                        <div className="bg-[#002a27] px-3 py-2 flex items-center justify-between">
                          <div className="text-[10px] font-bold text-[#39de8b]">Draft {vi + 1}</div>
                          <div className="text-[9px] text-white/50">
                            {timeline.clips?.length} clips · {timeline.actual_duration?.toFixed(1)}s
                          </div>
                        </div>

                        <div className="p-2.5 space-y-2">
                          {/* Story role sequence */}
                          <div className="flex flex-wrap gap-1">
                            {timeline.clips?.map((tc: any, ci: number) => {
                              const roleColors: Record<string, string> = {
                                Hook: "bg-red-100 text-red-700 border-red-200",
                                Setup: "bg-blue-100 text-blue-700 border-blue-200",
                                Proof: "bg-emerald-100 text-emerald-700 border-emerald-200",
                                Escalation: "bg-amber-100 text-amber-700 border-amber-200",
                                Payoff: "bg-purple-100 text-purple-700 border-purple-200",
                                CTA: "bg-[#002a27]/10 text-[#002a27] border-[#002a27]/20",
                                Build: "bg-orange-100 text-orange-700 border-orange-200",
                                Reveal: "bg-pink-100 text-pink-700 border-pink-200",
                                Problem: "bg-red-100 text-red-700 border-red-200",
                                Solution: "bg-green-100 text-green-700 border-green-200",
                                Impact: "bg-amber-100 text-amber-700 border-amber-200",
                                Story: "bg-violet-100 text-violet-700 border-violet-200",
                                "B-Roll": "bg-gray-100 text-gray-600 border-gray-200",
                                Teach: "bg-sky-100 text-sky-700 border-sky-200",
                                Recap: "bg-indigo-100 text-indigo-700 border-indigo-200",
                              };
                              const colorClass = roleColors[tc.story_role] ?? "bg-gray-100 text-gray-600 border-gray-200";
                              const whyKey = `${vi}-${ci}`;
                              const isExpanded = expandedWhy === whyKey;
                              const isRegen = regeneratingSegment === whyKey;
                              return (
                                <div key={ci} className="w-full">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${colorClass} leading-tight cursor-pointer`}
                                      title={tc.filename}
                                      onClick={() => setExpandedWhy(isExpanded ? null : whyKey)}>
                                      {tc.story_role ?? tc.role}
                                    </span>
                                    <span className="text-[8px] text-text-tertiary font-mono">{tc.duration?.toFixed(1)}s</span>
                                    <button
                                      onClick={() => handleRegenerateSegment(vi, ci, timeline)}
                                      disabled={isRegen}
                                      className="ml-auto text-[8px] text-text-tertiary hover:text-[#002a27] transition-colors disabled:opacity-40"
                                      title="Try a different clip for this slot">
                                      {isRegen ? "…" : "↺"}
                                    </button>
                                  </div>
                                  {/* Why this clip — expandable */}
                                  {isExpanded && tc.why_chosen && (
                                    <div className="mt-0.5 ml-1 text-[8px] text-text-tertiary leading-relaxed bg-surface-secondary rounded px-2 py-1">
                                      <span className="font-semibold text-text-secondary">{tc.filename}</span><br/>
                                      {tc.why_chosen}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Music hint */}
                          {timeline.music_suggestion && (
                            <div className="text-[8px] text-text-tertiary italic border-t border-border pt-1.5">
                              ♪ {timeline.music_suggestion}
                            </div>
                          )}

                          {/* CTA preview */}
                          {timeline.cta_text && (
                            <div className="text-[8px] bg-[#39de8b]/15 text-[#002a27] rounded px-2 py-1 font-medium truncate">
                              CTA: "{timeline.cta_text}"
                            </div>
                          )}

                          {/* Load button */}
                          <button
                            onClick={() => loadAITimeline(timeline)}
                            className="w-full py-2 rounded-lg bg-[#002a27] hover:bg-[#003d38] text-[#39de8b] text-[10px] font-bold transition-colors">
                            ↓ Load into Editor
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Save as Template Modal ═══ */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowSaveTemplate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Save as Template</h3>
              <button onClick={() => setShowSaveTemplate(false)} className="text-text-tertiary hover:text-text-primary text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Template Name</label>
                <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Hook + Reveal, Product Showcase..."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" autoFocus />
              </div>
              <div>
                <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Category</label>
                <select value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                  {TEMPLATE_CATEGORIES.filter((c) => c.value).map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3 space-y-1.5">
                <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">Includes:</div>
                <div className="text-[11px] text-text-secondary flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                  {frames.length} clip{frames.length !== 1 ? "s" : ""}
                </div>
                {hookText && <div className="text-[11px] text-text-secondary flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-text-tertiary" /> Hook text</div>}
                {ctaText && <div className="text-[11px] text-text-secondary flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-text-tertiary" /> CTA text</div>}
                {captions.length > 0 && <div className="text-[11px] text-text-secondary flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-text-tertiary" /> {captions.length} caption{captions.length !== 1 ? "s" : ""}</div>}
                {musicTrack && <div className="text-[11px] text-text-secondary flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-text-tertiary" /> Music: {musicTrack.filename}</div>}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border bg-surface-secondary flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveAsTemplate} disabled={!templateName.trim()}>Save Template</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
