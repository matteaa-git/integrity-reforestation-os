"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { Asset, Draft, DraftAssetEntry, DraftStatus } from "@/lib/api";
import {
  addDraftAsset,
  createDraft,
  fetchAsset,
  fetchAssets,
  fetchDrafts,
  fetchDraft,
  removeDraftAsset,
  rescheduleDraft,
  submitForReview,
  updateDraft,
} from "@/lib/api";
import DraftPickerModal from "@/components/DraftPickerModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import StoryCanvas, { type VideoEdits, DEFAULT_VIDEO_EDITS } from "@/components/story-builder/StoryCanvas";
import FrameTimeline from "@/components/story-builder/FrameTimeline";
import {
  type TextLayer,
  createTextLayer,
  TEXT_PRESETS,
  TextLayerEditor,
} from "@/components/story-builder/TextOverlay";
import ImageCropModal, { type CropData } from "@/components/story-builder/ImageCropModal";
import { TemplatePickerPanel } from "@/components/story-builder/StoryTemplates";
import PhotoEditPanel from "@/components/story-builder/PhotoEditPanel";
import type { PhotoEdits } from "@/components/story-builder/photoEdits";
import { DEFAULT_PHOTO_EDITS } from "@/components/story-builder/photoEdits";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_CONFIG: Record<DraftStatus, { label: string; variant: "default" | "warning" | "success" | "danger" | "info" }> = {
  draft:         { label: "Draft",         variant: "default" },
  in_review:     { label: "In Review",     variant: "warning" },
  approved:      { label: "Approved",      variant: "success" },
  rejected:      { label: "Rejected",      variant: "danger" },
  scheduled:     { label: "Scheduled",     variant: "info" },
  publishing:    { label: "Publishing…",   variant: "info"    },
  published:     { label: "Published",     variant: "success" },
  publish_failed:{ label: "Publish Failed",variant: "danger" },
  failed:        { label: "Failed",        variant: "danger" },
};

// Text layers per frame – stored client-side, keyed by asset_id
type FrameTextLayers = Record<string, TextLayer[]>;

export default function StoryBuilderPageWrapper() {
  return (
    <Suspense fallback={null}>
      <StoryBuilderPage />
    </Suspense>
  );
}

function StoryBuilderPage() {
  const searchParams = useSearchParams();

  // ── Draft state ──
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("draft");
  const [title, setTitle] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postHashtags, setPostHashtags] = useState("");
  const [frames, setFrames] = useState<DraftAssetEntry[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(-1);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  // ── Text overlay state ──
  const [frameTextLayers, setFrameTextLayers] = useState<FrameTextLayers>({});
  const [selectedTextLayerId, setSelectedTextLayerId] = useState<string | null>(null);

  // ── Frame editing state ──
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [photoEdits, setPhotoEdits] = useState<PhotoEdits>(DEFAULT_PHOTO_EDITS);
  const [zoom, setZoom] = useState(100);
  const [frameVideoEdits, setFrameVideoEdits] = useState<Record<string, VideoEdits>>({});

  // ── Asset browser state ──
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryPage, setLibraryPage] = useState(0);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const ASSET_PAGE_SIZE = 25;

  // ── Left panel tab ──
  const [leftTab, setLeftTab] = useState<"assets" | "stories">("assets");
  const [recentStories, setRecentStories] = useState<Draft[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);

  // ── Right panel tab ──
  const [rightTab, setRightTab] = useState<"settings" | "text" | "frame" | "templates">("settings");

  // ── Crop state ──
  const [frameCropData, setFrameCropData] = useState<Record<string, CropData>>({});
  const [cropModalAssetId, setCropModalAssetId] = useState<string | null>(null);

  // ── Auto-save ──
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // ── Draft picker ──
  const [showDraftPicker, setShowDraftPicker] = useState(false);

  // ── Export ──
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // ── Autosave timer ──
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedFrame = selectedFrameIndex >= 0 && selectedFrameIndex < frames.length
    ? frames[selectedFrameIndex] : null;
  const currentTextLayers = selectedFrame
    ? frameTextLayers[selectedFrame.asset_id] ?? []
    : [];
  const selectedTextLayer = currentTextLayers.find((l) => l.id === selectedTextLayerId) ?? null;
  const excludeIds = frames.map((f) => f.asset_id);
  const statusInfo = STATUS_CONFIG[draftStatus];

  // ── Load asset library ──
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const params: Parameters<typeof fetchAssets>[0] = {
        limit: 25,
        offset: libraryPage * 25,
      };
      if (assetFilter) params.media_type = assetFilter;
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
  }, [assetFilter, assetSearch, libraryPage]);

  // Reset to page 0 when filters change
  useEffect(() => { setLibraryPage(0); }, [assetFilter, assetSearch]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // ── Load recent story drafts ──
  const loadRecentStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const data = await fetchDrafts({ format: "story" });
      setRecentStories(data.drafts);
    } catch {
      setRecentStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  useEffect(() => { loadRecentStories(); }, [loadRecentStories]);

  // Auto-add asset from ?asset=<id> query param (launched from Asset Library)
  useEffect(() => {
    const assetId = searchParams.get("asset");
    if (!assetId) return;
    fetchAsset(assetId).then((asset) => handleAddFrame(asset)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save hook (full state, 2s debounce) ──
  const { status: autoSaveStatus, lastSaved: autoSavedAt } = useAutoSave({
    enabled: autoSaveEnabled,
    delay: 2000,
    onSave: async () => {
      const id = await ensureDraft();
      await updateDraft(id, {
        title: title || "Untitled Story",
        caption: postCaption || undefined,
        hashtags: postHashtags || undefined,
        metadata: { frames, frameTextLayers, frameCropData, photoEdits, frameVideoEdits, zoom },
      });
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      loadRecentStories();
    },
    deps: [title, postCaption, postHashtags, frames, frameTextLayers, frameCropData, photoEdits, frameVideoEdits, zoom],
  });

  // ── Ensure draft exists ──
  const ensureDraft = async (): Promise<string> => {
    if (draftId) return draftId;
    const draft = await createDraft({ title: title || "Untitled Story", format: "story" });
    setDraftId(draft.id);
    setDraftStatus(draft.status);
    return draft.id;
  };

  // ── Frame actions ──
  const handleAddFrame = async (asset: Asset) => {
    setError(null);
    try {
      const id = await ensureDraft();
      const result = await addDraftAsset(id, asset.id);
      setFrames(result.assets);
      setSelectedFrameIndex(result.assets.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add frame");
    }
  };

  const handleRemoveFrame = async (assetId: string) => {
    if (!draftId) return;
    setError(null);
    try {
      const result = await removeDraftAsset(draftId, assetId);
      setFrames(result.assets);
      // Clean up text layers for removed frame
      setFrameTextLayers((prev) => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
      if (selectedFrameIndex >= result.assets.length) {
        setSelectedFrameIndex(Math.max(0, result.assets.length - 1));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove frame");
    }
  };

  const handleDuplicateFrame = async (index: number) => {
    const frame = frames[index];
    if (!frame || !draftId) return;
    // Duplicate by re-adding the same asset (API allows it with position)
    try {
      const result = await addDraftAsset(draftId, frame.asset_id);
      setFrames(result.assets);
      setSelectedFrameIndex(result.assets.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate frame");
    }
  };

  const handleReorderFrames = (_fromIndex: number, _toIndex: number) => {
    // Client-side reorder for visual feedback
    setFrames((prev) => {
      const next = [...prev];
      const [moved] = next.splice(_fromIndex, 1);
      next.splice(_toIndex, 0, moved);
      return next;
    });
    if (selectedFrameIndex === _fromIndex) setSelectedFrameIndex(_toIndex);
  };

  // ── Save / Submit ──
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const metadata = { frames, frameTextLayers, frameCropData, photoEdits, frameVideoEdits, zoom };
      if (!draftId) {
        const draft = await createDraft({ title: title || "Untitled Story", format: "story", metadata });
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
      // Always flush the latest state (including text layers) before submitting
      const metadata = { frames, frameTextLayers, frameCropData, photoEdits, frameVideoEdits, zoom };
      await updateDraft(draftId, { title, caption: postCaption || undefined, hashtags: postHashtags || undefined, metadata });
      const updated = await submitForReview(draftId);
      setDraftStatus(updated.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  // ── Load story from recent list ──
  const handleLoadStory = async (id: string) => {
    try {
      const draft = await fetchDraft(id);
      handleOpenDraft(draft);
      setLeftTab("assets");
    } catch {
      setError("Failed to load story");
    }
  };

  // ── Clear current story to start fresh ──
  const handleNewStory = () => {
    setDraftId(null);
    setDraftStatus("draft");
    setTitle("");
    setFrames([]);
    setSelectedFrameIndex(-1);
    setFrameTextLayers({});
    setSelectedTextLayerId(null);
    setSavedAt(null);
    setLeftTab("assets");
  };

  // ── Reschedule failed post ──
  const handleReschedule = async () => {
    if (!draftId || !rescheduleAt) return;
    setRescheduling(true);
    setError(null);
    try {
      const updated = await rescheduleDraft(draftId, new Date(rescheduleAt).toISOString());
      setDraftStatus(updated.status);
      setRescheduleAt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule");
    } finally {
      setRescheduling(false);
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
    setSelectedFrameIndex((draft.assets ?? []).length > 0 ? 0 : -1);
    setFrameTextLayers((draft.metadata?.frameTextLayers as FrameTextLayers | undefined) ?? {});
    setPhotoEdits((draft.metadata?.photoEdits as PhotoEdits | undefined) ?? DEFAULT_PHOTO_EDITS);
    setFrameVideoEdits((draft.metadata?.frameVideoEdits as Record<string, VideoEdits> | undefined) ?? {});
    setSelectedTextLayerId(null);
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setShowDraftPicker(false);
  };

  // ── Text layer actions ──
  const addTextLayer = (presetIndex?: number) => {
    if (!selectedFrame) return;
    const preset = presetIndex != null ? TEXT_PRESETS[presetIndex] : undefined;
    const newLayer = createTextLayer(preset);
    setFrameTextLayers((prev) => ({
      ...prev,
      [selectedFrame.asset_id]: [...(prev[selectedFrame.asset_id] ?? []), newLayer],
    }));
    setSelectedTextLayerId(newLayer.id);
    setRightTab("text");
  };

  const updateTextLayer = (updated: TextLayer) => {
    if (!selectedFrame) return;
    setFrameTextLayers((prev) => ({
      ...prev,
      [selectedFrame.asset_id]: (prev[selectedFrame.asset_id] ?? []).map((l) =>
        l.id === updated.id ? updated : l
      ),
    }));
  };

  const deleteTextLayer = (layerId: string) => {
    if (!selectedFrame) return;
    setFrameTextLayers((prev) => ({
      ...prev,
      [selectedFrame.asset_id]: (prev[selectedFrame.asset_id] ?? []).filter((l) => l.id !== layerId),
    }));
    setSelectedTextLayerId(null);
  };

  const duplicateTextLayer = (layerId: string) => {
    if (!selectedFrame) return;
    const source = currentTextLayers.find((l) => l.id === layerId);
    if (!source) return;
    const dup = { ...source, id: crypto.randomUUID(), x: source.x + 3, y: source.y + 3 };
    setFrameTextLayers((prev) => ({
      ...prev,
      [selectedFrame.asset_id]: [...(prev[selectedFrame.asset_id] ?? []), dup],
    }));
    setSelectedTextLayerId(dup.id);
  };

  const applyTextLayerToAll = (layerId: string) => {
    if (!selectedFrame) return;
    const src = currentTextLayers.find((l) => l.id === layerId);
    if (!src) return;
    setFrameTextLayers((prev) => {
      const next = { ...prev };
      frames.forEach((f) => {
        if (f.asset_id === selectedFrame.asset_id) return; // skip current frame
        const existing = next[f.asset_id] ?? [];
        next[f.asset_id] = [...existing, { ...src, id: crypto.randomUUID() }];
      });
      return next;
    });
  };

  const applyTemplate = (layers: Omit<TextLayer, "id">[]) => {
    if (!selectedFrame) return;
    const newLayers: TextLayer[] = layers.map((l) => ({
      ...l,
      id: crypto.randomUUID(),
    }));
    setFrameTextLayers((prev) => ({
      ...prev,
      [selectedFrame.asset_id]: newLayers,
    }));
    setSelectedTextLayerId(newLayers[0]?.id ?? null);
    setRightTab("text");
  };

  const moveTextLayer = (id: string, x: number, y: number) => {
    if (!selectedFrame) return;
    setFrameTextLayers((prev) => ({
      ...prev,
      [selectedFrame.asset_id]: (prev[selectedFrame.asset_id] ?? []).map((l) =>
        l.id === id ? { ...l, x, y } : l
      ),
    }));
  };

  const resizeTextLayer = (id: string, width: number) => {
    if (!selectedFrame) return;
    setFrameTextLayers((prev) => ({
      ...prev,
      [selectedFrame.asset_id]: (prev[selectedFrame.asset_id] ?? []).map((l) =>
        l.id === id ? { ...l, width } : l
      ),
    }));
  };

  // ── Keyboard shortcut: T to add text, Delete to remove selected text ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "t" && selectedFrame) {
        e.preventDefault();
        addTextLayer();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedTextLayerId) {
        e.preventDefault();
        deleteTextLayer(selectedTextLayerId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const filteredAssets = libraryAssets.filter((a) => !excludeIds.includes(a.id));

  const EXPORT_FORMATS = [
    { label: "Instagram Story", id: "ig_story", res: "1080×1920", ratio: "9:16", icon: "▭" },
    { label: "TikTok", id: "tiktok", res: "1080×1920", ratio: "9:16", icon: "▭" },
    { label: "Snapchat", id: "snapchat", res: "1080×1920", ratio: "9:16", icon: "▭" },
    { label: "Pinterest Story", id: "pinterest", res: "1080×1920", ratio: "9:16", icon: "▭" },
    { label: "Export Manifest (JSON)", id: "json", res: "—", ratio: "—", icon: "{}" },
  ];

  const [exporting, setExporting] = useState(false);

  const handleExport = async (fmt: typeof EXPORT_FORMATS[number]) => {
    setShowExportMenu(false);
    if (fmt.id === "json") {
      const manifest = {
        title: title || "Untitled Story",
        format: "story",
        frames: frames.map((f, i) => ({
          position: i,
          asset_id: f.asset_id,
          filename: f.asset.filename,
          text_layers: frameTextLayers[f.asset_id] ?? [],
          crop: frameCropData[f.asset_id] ?? null,
        })),
        exported_at: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "story").replace(/\s+/g, "_")}_manifest.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // For all visual formats (ig_story, tiktok, snapchat, pinterest) — render each frame at 1080×1920
    if (frames.length === 0) {
      setExportNotice("Add frames before exporting.");
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }

    setExporting(true);
    setExportNotice(`Rendering ${frames.length} frame${frames.length !== 1 ? "s" : ""}…`);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";
    const storyTitle = (title || "story").replace(/\s+/g, "_");

    try {
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const layers = frameTextLayers[frame.asset_id] ?? [];
        const resp = await fetch(`${API_BASE}/assets/${frame.asset_id}/render-story`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text_layers: layers }),
        });
        if (!resp.ok) throw new Error(`Frame ${i + 1} render failed: ${resp.statusText}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${storyTitle}_frame${String(i + 1).padStart(2, "0")}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        setExportNotice(`Downloaded frame ${i + 1} of ${frames.length}…`);
      }
      setExportNotice(`✓ All ${frames.length} frames downloaded.`);
    } catch (err) {
      setExportNotice(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
      setTimeout(() => setExportNotice(null), 6000);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f7]">
      {showDraftPicker && (
        <DraftPickerModal
          format="story"
          onSelect={handleOpenDraft}
          onClose={() => setShowDraftPicker(false)}
        />
      )}
      {cropModalAssetId && (() => {
        const frame = frames.find((f) => f.asset_id === cropModalAssetId);
        if (!frame || frame.asset.media_type !== "image") return null;
        return (
          <ImageCropModal
            src={`${API_BASE}/assets/${cropModalAssetId}/file`}
            filename={frame.asset.filename}
            initialCrop={frameCropData[cropModalAssetId] ?? null}
            onConfirm={(crop) => {
              setFrameCropData((prev) => ({ ...prev, [cropModalAssetId]: crop }));
              setCropModalAssetId(null);
            }}
            onClose={() => setCropModalAssetId(null)}
          />
        );
      })()}
      {/* ═══════════ Top Bar ═══════════ */}
      <div className="shrink-0 border-b border-border bg-white px-5 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="text-text-tertiary hover:text-text-secondary transition-colors text-sm">
              ←
            </a>
            <div className="w-px h-4 bg-border" />
            <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wide shrink-0">Story Builder</span>
            <span className="text-text-tertiary text-xs">/</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Story"
              className="text-sm font-semibold text-text-primary bg-transparent border-none outline-none placeholder:text-text-tertiary/60 min-w-0 flex-1 max-w-[240px] focus:ring-0"
            />
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <div className="flex items-center gap-2.5">
            {savedAt && (
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Saved {savedAt}
              </span>
            )}
            <span className="text-[10px] text-text-tertiary bg-surface-secondary px-2 py-0.5 rounded-md font-medium">
              {frames.length} frame{frames.length !== 1 ? "s" : ""}
            </span>
            <div className="w-px h-4 bg-border" />
            <Button variant="ghost" size="sm" onClick={() => setShowDraftPicker(true)}>
              Open
            </Button>
            {/* Export As dropdown */}
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => !exporting && setShowExportMenu((v) => !v)} disabled={exporting}>
                {exporting ? "Exporting…" : "Export As ▾"}
              </Button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl bg-white border border-border shadow-lg py-1 overflow-hidden">
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
            {/* Auto-save toggle + status */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <div
                  onClick={() => setAutoSaveEnabled((v) => !v)}
                  className={`w-7 h-4 rounded-full transition-colors relative ${autoSaveEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${autoSaveEnabled ? "left-3.5" : "left-0.5"}`} />
                </div>
                <span className="text-[11px] text-text-tertiary">Auto-save</span>
              </label>
              <span className="text-[11px] text-text-tertiary font-mono min-w-[80px]">
                {autoSaveStatus === "saving" && "Saving..."}
                {autoSaveStatus === "saved" && autoSavedAt && `✓ ${autoSavedAt}`}
                {autoSaveStatus === "error" && "⚠ Save failed"}
                {autoSaveStatus === "idle" && autoSavedAt && `✓ ${autoSavedAt}`}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            {draftStatus === "draft" && frames.length > 0 && (
              <Button size="sm" onClick={handleSubmitForReview}>
                Submit for Review
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ Export Notice ═══════════ */}
      {exportNotice && (
        <div className="shrink-0 bg-emerald-50 border-b border-emerald-200 px-5 py-2 flex items-center justify-between">
          <span className="text-[11px] text-emerald-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {exportNotice}
          </span>
          <button onClick={() => setExportNotice(null)} className="text-emerald-400 hover:text-emerald-600 text-sm leading-none">&times;</button>
        </div>
      )}

      {/* ═══════════ Error Banner ═══════════ */}
      {error && (
        <div className="shrink-0 bg-red-50 border-b border-red-200 px-5 py-2 flex items-center justify-between">
          <span className="text-[11px] text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm leading-none">&times;</button>
        </div>
      )}

      {/* ═══════════ Publish Failed Banner ═══════════ */}
      {(draftStatus === "publish_failed" || draftStatus === "failed") && draftId && (
        <div className="shrink-0 bg-red-50 border-b border-red-200 px-5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-semibold text-red-700">Publishing failed.</span>
            <span className="text-[11px] text-red-500">Pick a new time to retry.</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={rescheduleAt}
              onChange={(e) => setRescheduleAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="text-[11px] border border-red-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <button
              onClick={handleReschedule}
              disabled={!rescheduleAt || rescheduling}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {rescheduling ? "Rescheduling…" : "Reschedule"}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ Three-Column Layout ═══════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Asset Library + Recent Stories ── */}
        <div className="w-[280px] shrink-0 border-r border-border bg-white flex flex-col">
          {/* Tab toggle */}
          <div className="flex border-b border-border-light shrink-0">
            <button
              onClick={() => setLeftTab("assets")}
              className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                leftTab === "assets"
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Assets
            </button>
            <button
              onClick={() => { setLeftTab("stories"); loadRecentStories(); }}
              className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                leftTab === "stories"
                  ? "text-primary border-b-2 border-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Stories
              {recentStories.length > 0 && (
                <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1 rounded-full">
                  {recentStories.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Stories panel ── */}
          {leftTab === "stories" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="px-3 pt-2.5 pb-2 border-b border-border-light shrink-0 flex items-center justify-between">
                <span className="text-[10px] text-text-tertiary">{recentStories.length} saved</span>
                <button
                  onClick={handleNewStory}
                  className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  + New Story
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {storiesLoading && (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
                {!storiesLoading && recentStories.length === 0 && (
                  <div className="text-center py-10">
                    <div className="text-xl text-text-tertiary/30 mb-2">▣</div>
                    <div className="text-[11px] text-text-tertiary">No stories yet</div>
                    <div className="text-[10px] text-text-tertiary/70 mt-1">
                      Save a draft to see it here
                    </div>
                  </div>
                )}
                {!storiesLoading && recentStories.map((story) => {
                  const isActive = story.id === draftId;
                  const frameCount = (story.assets ?? []).length;
                  const statusColors: Record<string, string> = {
                    draft:      "bg-gray-100 text-gray-500",
                    in_review:  "bg-amber-100 text-amber-700",
                    approved:   "bg-emerald-100 text-emerald-700",
                    rejected:   "bg-red-100 text-red-600",
                    scheduled:  "bg-blue-100 text-blue-700",
                  };
                  return (
                    <button
                      key={story.id}
                      onClick={() => handleLoadStory(story.id)}
                      className={`w-full text-left rounded-lg border transition-all overflow-hidden group ${
                        isActive
                          ? "border-primary/40 bg-primary/[0.03] shadow-sm"
                          : "border-border/60 hover:border-primary/30 hover:shadow-sm bg-white"
                      }`}
                    >
                      <div className="flex items-stretch">
                        {/* Frame count indicator */}
                        <div className={`w-10 shrink-0 flex flex-col items-center justify-center py-3 ${
                          isActive ? "bg-primary/10" : "bg-surface-secondary group-hover:bg-primary/5"
                        } transition-colors`}>
                          <span className={`text-[14px] font-bold leading-none ${isActive ? "text-primary" : "text-text-tertiary"}`}>
                            {frameCount}
                          </span>
                          <span className="text-[8px] text-text-tertiary mt-0.5 leading-none">
                            {frameCount === 1 ? "frame" : "frames"}
                          </span>
                        </div>
                        {/* Meta */}
                        <div className="flex-1 min-w-0 px-2.5 py-2.5">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <div className={`text-[11px] font-semibold leading-snug truncate ${
                              isActive ? "text-primary" : "text-text-primary"
                            }`}>
                              {story.title || "Untitled Story"}
                            </div>
                            {isActive && (
                              <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 rounded shrink-0">
                                OPEN
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                              statusColors[story.status] ?? "bg-gray-100 text-gray-500"
                            }`}>
                              {story.status.replace("_", " ")}
                            </span>
                            <span className="text-[9px] text-text-tertiary">
                              {new Date(story.updated_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Assets panel (original) ── */}
          {leftTab === "assets" && (
          <>
          <div className="px-3.5 pt-3.5 pb-2.5 border-b border-border-light">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">Asset Library</span>
              <span className="text-[10px] text-text-tertiary">{libraryTotal} total</span>
            </div>
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Search assets..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="w-full rounded-lg border border-border pl-7 pr-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface-secondary"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[10px]">⌕</span>
            </div>
            <div className="flex gap-1">
              {[
                { label: "All", value: "" },
                { label: "Images", value: "image" },
                { label: "Videos", value: "video" },
              ].map((f) => (
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
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            {libraryLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {!libraryLoading && filteredAssets.length === 0 && (
              <div className="text-center py-10">
                <div className="text-xl text-text-tertiary/40 mb-2">⬚</div>
                <div className="text-[11px] text-text-tertiary">No assets available</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {filteredAssets.map((asset) => {
                const isHovered = hoveredAssetId === asset.id;
                return (
                  <button
                    key={asset.id}
                    onClick={() => handleAddFrame(asset)}
                    onMouseEnter={() => setHoveredAssetId(asset.id)}
                    onMouseLeave={() => setHoveredAssetId(null)}
                    className="group rounded-lg overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-md transition-all text-left bg-white"
                    title={`${asset.filename}${asset.pillar ? ` · ${asset.pillar}` : ""}`}
                  >
                    <div className="aspect-[4/5] overflow-hidden bg-gray-50 relative">
                      {asset.media_type === "image" ? (
                        <img
                          src={`${API_BASE}/assets/${asset.id}/file`}
                          alt={asset.filename}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-purple-50">
                          <span className="text-lg text-purple-300">▶</span>
                        </div>
                      )}
                      {/* Hover overlay with add button */}
                      <div className={`absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-all flex items-center justify-center`}>
                        <div className={`w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center transition-all ${
                          isHovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
                        }`}>
                          <span className="text-primary text-sm font-bold">+</span>
                        </div>
                      </div>
                      {/* Video duration */}
                      {asset.media_type === "video" && asset.duration != null && (
                        <div className="absolute bottom-1 right-1">
                          <span className="text-[9px] bg-black/60 text-white px-1 rounded backdrop-blur-sm">
                            {asset.duration.toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="px-1.5 py-1.5">
                      <div className="text-[10px] font-medium text-text-primary truncate leading-tight">{asset.filename}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-text-tertiary">{asset.media_type}</span>
                        {asset.pillar && (
                          <>
                            <span className="text-[8px] text-text-tertiary">·</span>
                            <span className="text-[9px] text-primary/70 truncate">{asset.pillar}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          <div className="px-3.5 py-2 border-t border-border-light shrink-0 flex items-center justify-between gap-2">
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

        {/* ── Center: Canvas + Timeline ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Canvas toolbar */}
          {selectedFrame && (
            <div className="shrink-0 border-b border-border bg-white/80 backdrop-blur-sm px-4 py-1.5 flex items-center gap-3">
              {/* Text overlay tools */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-tertiary mr-1">Text:</span>
                {TEXT_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => addTextLayer(i)}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary hover:bg-primary hover:text-white transition-colors"
                    title={`Add ${preset.label} text`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-border" />

              {/* Safe zone toggle */}
              <button
                onClick={() => setShowSafeZone(!showSafeZone)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  showSafeZone
                    ? "bg-amber-100 text-amber-700"
                    : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
                }`}
                title="Toggle Instagram safe zones"
              >
                Safe Zone
              </button>

              <div className="w-px h-4 bg-border" />

              {/* Zoom */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-tertiary">Zoom</span>
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className="w-5 h-5 rounded bg-surface-secondary text-text-tertiary hover:text-text-secondary text-xs flex items-center justify-center"
                >−</button>
                <span className="text-[10px] text-text-secondary w-7 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom(Math.min(150, zoom + 10))}
                  className="w-5 h-5 rounded bg-surface-secondary text-text-tertiary hover:text-text-secondary text-xs flex items-center justify-center"
                >+</button>
              </div>

              <div className="flex-1" />

              {/* Keyboard shortcut hint */}
              <div className="text-[9px] text-text-tertiary">
                <kbd className="px-1 py-0.5 bg-surface-secondary rounded text-[8px] font-mono">T</kbd> add text
              </div>
            </div>
          )}

          {/* Canvas */}
          <StoryCanvas
            frame={selectedFrame}
            frameIndex={selectedFrameIndex}
            totalFrames={frames.length}
            textLayers={currentTextLayers}
            selectedTextLayerId={selectedTextLayerId}
            onSelectTextLayer={setSelectedTextLayerId}
            onMoveTextLayer={moveTextLayer}
            onResizeTextLayer={resizeTextLayer}
            showSafeZone={showSafeZone}
            photoEdits={photoEdits}
            zoom={zoom}
            cropData={selectedFrame ? frameCropData[selectedFrame.asset_id] ?? null : null}
            videoEdits={selectedFrame ? (frameVideoEdits[selectedFrame.asset_id] ?? DEFAULT_VIDEO_EDITS) : DEFAULT_VIDEO_EDITS}
          />

          {/* Frame Timeline */}
          <FrameTimeline
            frames={frames}
            selectedIndex={selectedFrameIndex}
            onSelect={setSelectedFrameIndex}
            onDuplicate={handleDuplicateFrame}
            onDelete={handleRemoveFrame}
            onReorder={handleReorderFrames}
          />
        </div>

        {/* ── Right: Settings Panel ── */}
        <div className="w-[280px] shrink-0 border-l border-border bg-white flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-border-light shrink-0">
            {(["settings", "frame", "text", "templates"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  rightTab === tab
                    ? "text-primary border-b-2 border-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {tab === "settings" ? "Story" : tab === "frame" ? "Frame" : tab === "text" ? "Text" : "Templates"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Story Settings Tab ── */}
            {rightTab === "settings" && (
              <div className="p-4 space-y-5">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled Story"
                    className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* Instagram Caption */}
                <div className="pt-1 border-t border-border-light space-y-3">
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

                {/* Format & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Format</label>
                    <div className="text-xs text-text-primary bg-surface-secondary rounded-lg px-2.5 py-1.5 border border-border-light">
                      Story
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Status</label>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                </div>

                {/* Frame summary */}
                <div>
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Frames</label>
                  <div className="text-xs text-text-primary">{frames.length} frame{frames.length !== 1 ? "s" : ""}</div>
                  {frames.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {frames.map((f, i) => (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFrameIndex(i)}
                          className={`w-6 h-6 rounded text-[9px] font-semibold transition-colors ${
                            i === selectedFrameIndex
                              ? "bg-primary text-white"
                              : "bg-surface-secondary text-text-tertiary hover:bg-primary/10"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Workflow stepper */}
                <div className="pt-2">
                  <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-2">Workflow</label>
                  <div className="space-y-1">
                    {(["draft", "in_review", "approved", "scheduled"] as const).map((step, i) => {
                      const stepConfig = STATUS_CONFIG[step];
                      const isActive = draftStatus === step;
                      const steps = ["draft", "in_review", "approved", "scheduled"];
                      const isPast = steps.indexOf(draftStatus) > i;
                      return (
                        <div key={step} className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 transition-colors ${
                            isActive
                              ? "bg-primary text-white shadow-sm shadow-primary/20"
                              : isPast
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-gray-100 text-gray-400"
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

            {/* ── Frame Tab ── */}
            {rightTab === "frame" && (
              <div className="p-4 space-y-4">
                {selectedFrame ? (
                  <>
                    {/* Frame preview */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
                          Frame {selectedFrameIndex + 1}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDuplicateFrame(selectedFrameIndex)}
                            className="text-[10px] text-text-tertiary hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/5"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleRemoveFrame(selectedFrame.asset_id)}
                            className="text-[10px] text-red-400 hover:text-red-600 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="aspect-[9/16] rounded-lg overflow-hidden bg-gray-100 mb-3">
                        {selectedFrame.asset.media_type === "image" ? (
                          <img
                            src={`${API_BASE}/assets/${selectedFrame.asset_id}/file`}
                            alt={selectedFrame.asset.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-purple-50">
                            <span className="text-2xl text-purple-300">▶</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* File info */}
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Filename</span>
                        <span className="text-[11px] text-text-primary break-all">{selectedFrame.asset.filename}</span>
                      </div>
                      {selectedFrame.asset.width && selectedFrame.asset.height && (
                        <div>
                          <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Dimensions</span>
                          <span className="text-[11px] text-text-primary">{selectedFrame.asset.width} × {selectedFrame.asset.height}</span>
                        </div>
                      )}
                      {selectedFrame.asset.project && (
                        <div>
                          <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Project</span>
                          <Badge variant="success">{selectedFrame.asset.project}</Badge>
                        </div>
                      )}
                      {selectedFrame.asset.pillar && (
                        <div>
                          <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block">Pillar</span>
                          <Badge variant="info">{selectedFrame.asset.pillar}</Badge>
                        </div>
                      )}
                    </div>

                    {/* Video Controls (video frames only) */}
                    {selectedFrame.asset.media_type === "video" && (() => {
                      const duration = selectedFrame.asset.duration ?? 15;
                      const ve = frameVideoEdits[selectedFrame.asset_id] ?? DEFAULT_VIDEO_EDITS;
                      const trimEnd = ve.trimEnd > 0 ? ve.trimEnd : duration;
                      const setVe = (patch: Partial<VideoEdits>) =>
                        setFrameVideoEdits((prev) => ({
                          ...prev,
                          [selectedFrame.asset_id]: { ...(prev[selectedFrame.asset_id] ?? DEFAULT_VIDEO_EDITS), ...patch },
                        }));
                      return (
                        <div className="pt-2 border-t border-border-light space-y-3">
                          <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block">Video</span>
                          {/* Duration info */}
                          <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                            <span>Duration</span>
                            <span className="font-mono">{duration.toFixed(1)}s</span>
                          </div>
                          {/* Trim In */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-text-secondary">Trim In</span>
                              <span className="text-[10px] font-mono text-text-tertiary">{ve.trimStart.toFixed(1)}s</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(0, trimEnd - 0.5)}
                              step={0.1}
                              value={ve.trimStart}
                              onChange={(e) => setVe({ trimStart: Math.min(Number(e.target.value), trimEnd - 0.5) })}
                              className="w-full h-1.5 accent-primary"
                            />
                          </div>
                          {/* Trim Out */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-text-secondary">Trim Out</span>
                              <span className="text-[10px] font-mono text-text-tertiary">{trimEnd.toFixed(1)}s</span>
                            </div>
                            <input
                              type="range"
                              min={Math.min(duration, ve.trimStart + 0.5)}
                              max={duration}
                              step={0.1}
                              value={trimEnd}
                              onChange={(e) => setVe({ trimEnd: Number(e.target.value) })}
                              className="w-full h-1.5 accent-primary"
                            />
                          </div>
                          {/* Clip length */}
                          <div className="text-[10px] text-text-tertiary text-center">
                            Clip: {(trimEnd - ve.trimStart).toFixed(1)}s
                            {trimEnd - ve.trimStart > 15 && (
                              <span className="ml-1 text-amber-500">⚠ Instagram max 15s</span>
                            )}
                          </div>
                          {/* Mute toggle */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div
                              onClick={() => setVe({ muted: !ve.muted })}
                              className={`w-7 h-4 rounded-full transition-colors relative ${!ve.muted ? "bg-emerald-500" : "bg-gray-300"}`}
                            >
                              <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${!ve.muted ? "left-3.5" : "left-0.5"}`} />
                            </div>
                            <span className="text-[10px] text-text-secondary">{ve.muted ? "Audio muted" : "Audio on"}</span>
                          </label>
                          {/* Reset trim */}
                          {(ve.trimStart > 0 || ve.trimEnd > 0) && (
                            <button
                              onClick={() => setVe({ trimStart: 0, trimEnd: 0 })}
                              className="w-full text-[10px] font-medium text-text-tertiary hover:text-danger py-1 rounded-lg transition-colors"
                            >
                              Reset trim
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Photo Editing */}
                    <div className="pt-2 border-t border-border-light">
                      <PhotoEditPanel edits={photoEdits} onChange={setPhotoEdits} />
                    </div>

                    {/* Crop / Replace */}
                    <div className="pt-2 border-t border-border-light space-y-2">
                      {selectedFrame.asset.media_type === "image" && (
                        <button
                          onClick={() => setCropModalAssetId(selectedFrame.asset_id)}
                          className="w-full text-[10px] font-medium text-text-secondary hover:text-primary py-1.5 rounded-lg border border-border hover:border-primary/30 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span>⊞</span>
                          {frameCropData[selectedFrame.asset_id] ? "Edit Crop" : "Crop Frame"}
                          {frameCropData[selectedFrame.asset_id] && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </button>
                      )}
                      {frameCropData[selectedFrame.asset_id] && (
                        <button
                          onClick={() =>
                            setFrameCropData((prev) => {
                              const next = { ...prev };
                              delete next[selectedFrame.asset_id];
                              return next;
                            })
                          }
                          className="w-full text-[10px] font-medium text-text-tertiary hover:text-danger py-1 rounded-lg transition-colors"
                        >
                          Remove Crop
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveFrame(selectedFrame.asset_id)}
                        className="w-full text-[10px] font-medium text-text-secondary hover:text-primary py-1.5 rounded-lg border border-border hover:border-primary/30 transition-colors"
                      >
                        Replace Asset
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <div className="text-lg text-text-tertiary/40 mb-2">◫</div>
                    <div className="text-[11px] text-text-tertiary">Select a frame to edit</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Text Tab ── */}
            {rightTab === "text" && (
              <div className="p-4 space-y-4">
                {!selectedFrame ? (
                  <div className="text-center py-10">
                    <div className="text-lg text-text-tertiary/40 mb-2">T</div>
                    <div className="text-[11px] text-text-tertiary">Select a frame to add text overlays</div>
                  </div>
                ) : (
                  <>
                    {/* Add text buttons */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">Text Layers</span>
                        <button
                          onClick={() => addTextLayer()}
                          className="text-[10px] font-medium text-primary hover:text-primary-dark transition-colors"
                        >
                          + Add Text
                        </button>
                      </div>

                      {/* Layer list */}
                      {currentTextLayers.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-border rounded-lg">
                          <div className="text-[11px] text-text-tertiary mb-2">No text layers yet</div>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {TEXT_PRESETS.map((p, i) => (
                              <button
                                key={p.label}
                                onClick={() => addTextLayer(i)}
                                className="px-2 py-1 rounded-md text-[10px] font-medium bg-surface-secondary text-text-secondary hover:bg-primary hover:text-white transition-colors"
                              >
                                + {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 mb-3">
                          {currentTextLayers.map((layer) => (
                            <button
                              key={layer.id}
                              onClick={() => setSelectedTextLayerId(layer.id)}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-all ${
                                layer.id === selectedTextLayerId
                                  ? "bg-primary/5 border border-primary/20 text-text-primary"
                                  : "hover:bg-surface-secondary text-text-secondary border border-transparent"
                              }`}
                            >
                              <div className="font-medium truncate">{layer.text || "Empty text"}</div>
                              <div className="text-[9px] text-text-tertiary mt-0.5">
                                {layer.preset || "Custom"} · {layer.fontSize}px
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected layer editor */}
                    {selectedTextLayer && (
                      <div className="border-t border-border-light pt-4">
                        <TextLayerEditor
                          layer={selectedTextLayer}
                          onChange={updateTextLayer}
                          onDelete={() => deleteTextLayer(selectedTextLayer.id)}
                          onDuplicate={() => duplicateTextLayer(selectedTextLayer.id)}
                          onApplyToAll={frames.length > 1 ? () => applyTextLayerToAll(selectedTextLayer.id) : undefined}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Templates Tab ── */}
            {rightTab === "templates" && (
              <div>
                {!selectedFrame ? (
                  <div className="text-center py-10 px-4">
                    <div className="text-lg text-text-tertiary/40 mb-2">▦</div>
                    <div className="text-[11px] text-text-tertiary">Select a frame first, then apply a template</div>
                  </div>
                ) : (
                  <TemplatePickerPanel currentLayers={currentTextLayers} onApply={applyTemplate} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
