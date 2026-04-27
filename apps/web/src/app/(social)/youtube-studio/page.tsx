"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VideoPreview from "@/components/youtube-studio/VideoPreview";
import DraftsTab from "@/components/youtube-studio/DraftsTab";
import ScheduledTab from "@/components/youtube-studio/ScheduledTab";
import PerformanceTab from "@/components/youtube-studio/PerformanceTab";
import type { YouTubeListResponse, YouTubeVideo } from "@/components/youtube-studio/DraftsTab";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_TITLE = 100;
const MAX_DESC = 5000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  filename: string;
  media_type: "image" | "video" | "audio";
  width: number | null;
  height: number | null;
  created_at: string;
}

interface VideoScores {
  titleStrength: number;
  tagCoverage: number;
  descriptionQuality: number;
  thumbnailScore: number;
  overall: number;
}

type VisibilityType = "public" | "unlisted" | "private";
type PreviewMode = "desktop" | "mobile" | "suggested";
type TabKey = "compose" | "drafts" | "scheduled" | "performance";

const EMPTY_LIST: YouTubeListResponse = {
  videos: [], total: 0, draft_count: 0, scheduled_count: 0, published_count: 0,
};

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScores(
  title: string,
  description: string,
  tags: string[],
  hasThumbnail: boolean
): VideoScores {
  const titleLen = title.length;
  let titleBase = 0;
  if (titleLen >= 50 && titleLen <= 70) titleBase = 100;
  else if (titleLen > 70) titleBase = Math.max(40, 100 - (titleLen - 70) * 2);
  else if (titleLen > 30) titleBase = (titleLen / 50) * 75;
  else if (titleLen > 0) titleBase = (titleLen / 30) * 35;

  const hasPowerWord = /\b(how|why|best|top|secret|truth|revealed|never|always|must|proven|ultimate|complete|guide|tips|free|new|inside|watch)\b/i.test(title);
  const hasNumber = /\d/.test(title);
  const hasBrackets = /[\[\(]/.test(title);
  const titleStrength = Math.min(100, Math.round(
    titleBase * 0.6 + (hasPowerWord ? 20 : 0) + (hasNumber ? 10 : 0) + (hasBrackets ? 10 : 0)
  ));

  const tagCoverage = Math.min(100, Math.round(tags.length * 7));

  let descriptionQuality = 0;
  if (description.length > 500) descriptionQuality = 95;
  else if (description.length > 200) descriptionQuality = 75;
  else if (description.length > 50) descriptionQuality = 45;
  else if (description.length > 0) descriptionQuality = 20;

  const thumbnailScore = hasThumbnail ? 100 : 0;

  const overall = Math.round(
    titleStrength * 0.35 + tagCoverage * 0.25 + descriptionQuality * 0.2 + thumbnailScore * 0.2
  );

  return { titleStrength, tagCoverage, descriptionQuality, thumbnailScore, overall };
}

function scoreColor(v: number) {
  if (v >= 70) return "#39de8b";
  if (v >= 40) return "#f59e0b";
  return "#ef4444";
}
function scoreLabel(v: number) {
  if (v >= 80) return "Excellent";
  if (v >= 60) return "Good";
  if (v >= 40) return "Fair";
  return "Weak";
}

// ── Content banks ─────────────────────────────────────────────────────────────

const TITLE_TEMPLATES = [
  "We planted {X} trees in 48 hours. Here's what happened:",
  "The Truth About Reforestation (Nobody Talks About This)",
  "How 1 Tree Sequesters {X} kg CO₂ Every Year [Data]",
  "Before vs After: 5 Years of Forest Restoration",
  "Why 90% of Tree Planting Projects Fail",
  "Inside a Wildfire Recovery Zone – 1 Year Later",
  "Top 5 Native Species for Maximum Carbon Capture",
  "We Made a Costly Mistake. Here's What We Learned:",
];

const TAG_SUGGESTIONS = [
  "reforestation", "tree planting", "carbon capture", "climate action",
  "deforestation", "forest restoration", "sustainability", "biodiversity",
  "wildfire recovery", "native trees", "carbon sequestration",
  "conservation", "integrity reforestation", "forest ecosystem",
  "environmental", "climate change", "ecosystem restoration",
];

const CATEGORIES = [
  "Nonprofits & Activism", "Education", "Science & Technology",
  "News & Politics", "People & Blogs",
];

// ── Entry ─────────────────────────────────────────────────────────────────────

export default function YouTubeStudioPage() {
  return (
    <Suspense fallback={null}>
      <YouTubeStudio />
    </Suspense>
  );
}

// ── YouTube icon ──────────────────────────────────────────────────────────────

function YtIcon({ size = 16, color = "#ff0033" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 461 334" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M451.046,52.06C445.468,31.07,429.025,14.555,408.122,8.958C372.357,0,230.5,0,230.5,0S88.643,0,52.878,8.515C32.418,14.109,15.532,31.069,9.954,52.061C1.455,87.96,1.455,167,1.455,167s0,79.483,8.499,115.383c5.578,20.989,22.021,36.949,42.924,42.547C88.643,334,230.5,334,230.5,334s141.857,0,177.622-8.516c20.903-5.597,37.346-22.113,42.924-43.1C459.545,246.483,459.545,167,459.545,167S459.988,87.96,451.046,52.06z M185.57,238.5l0.002-143L303.822,167L185.57,238.5z"/>
    </svg>
  );
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, tip }: { label: string; value: number; tip: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/40">{label}</span>
        <span className="text-[10px] font-mono tabular-nums" style={{ color: scoreColor(value) }}>
          {value}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden" title={tip}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
        />
      </div>
    </div>
  );
}

// ── Main Studio ───────────────────────────────────────────────────────────────

function YouTubeStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") ?? "compose") as TabKey;
  const setTab = (t: TabKey) => router.replace(`/youtube-studio?tab=${t}`);

  // ── Video metadata ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [thumbnail, setThumbnail] = useState<Asset | null>(null);
  const [visibility, setVisibility] = useState<VisibilityType>("public");
  const [category, setCategory] = useState("Nonprofits & Activism");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");

  // ── Left rail ──
  const [leftTab, setLeftTab] = useState<"library" | "titles" | "tags">("library");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "image" | "video">("all");

  // ── Data ──
  const [videos, setVideos] = useState<YouTubeListResponse>(EMPTY_LIST);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [scores, setScores] = useState<VideoScores>({
    titleStrength: 0, tagCoverage: 0, descriptionQuality: 0, thumbnailScore: 0, overall: 0,
  });

  const titleRef = useRef<HTMLInputElement>(null);

  // ── Load ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setAssetsLoading(true);
    const [videosRes, assetsRes] = await Promise.all([
      fetch(`${API_BASE}/youtube/drafts?limit=100`).then((r) => r.json()).catch(() => EMPTY_LIST),
      fetch(`${API_BASE}/assets?limit=500`).then((r) => r.json()).catch(() => ({ assets: [] })),
    ]);
    setVideos(videosRes);
    setAssets((assetsRes.assets ?? []).filter((a: Asset) => a.media_type === "image" || a.media_type === "video"));
    setAssetsLoading(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Scores ──
  useEffect(() => {
    setScores(computeScores(title, description, tags, !!thumbnail));
  }, [title, description, tags, thumbnail]);

  const showNotice = (type: "success" | "error", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 3500);
  };

  // ── Derived ──
  const titleLeft = MAX_TITLE - title.length;
  const isEmpty = !title.trim();
  const filteredAssets = assets.filter((a) => {
    const typeOk = assetFilter === "all" || a.media_type === assetFilter;
    const searchOk = !assetSearch || a.filename.toLowerCase().includes(assetSearch.toLowerCase());
    return typeOk && searchOk;
  });
  const imageAssets = assets.filter((a) => a.media_type === "image");

  // ── Tag helpers ──
  const addTag = (t: string) => {
    const clean = t.trim().toLowerCase().replace(/,/g, "");
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput("");
  };
  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  // ── Build payload ──
  const buildPayload = () => ({
    title,
    description,
    tags,
    visibility,
    category,
    video_url: videoUrl || null,
    thumbnail_asset_id: thumbnail?.id ?? null,
    hook_score: scores.overall,
    estimated_reach: Math.round(scores.overall * 150 + tags.length * 50),
  });

  // ── Actions ──
  const handleSave = async () => {
    if (isEmpty) return;
    setSaving(true);
    try {
      if (videoId) {
        const res = await fetch(`${API_BASE}/youtube/${videoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch(`${API_BASE}/youtube/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) throw new Error();
        const data: YouTubeVideo = await res.json();
        setVideoId(data.id);
      }
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      await loadData();
      showNotice("success", "Draft saved");
    } catch {
      showNotice("error", "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    let id = videoId;
    if (!id) {
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/youtube/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) throw new Error();
        const data: YouTubeVideo = await res.json();
        id = data.id;
        setVideoId(id);
      } catch {
        showNotice("error", "Save failed");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/youtube/${id}/submit-approval`, { method: "POST" });
      if (!res.ok) throw new Error();
      await loadData();
      showNotice("success", "Submitted for approval");
    } catch {
      showNotice("error", "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleTime) return;
    let id = videoId;
    if (!id) {
      const res = await fetch(`${API_BASE}/youtube/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) { showNotice("error", "Save failed"); return; }
      const data: YouTubeVideo = await res.json();
      id = data.id;
      setVideoId(id);
    }
    setScheduling(true);
    try {
      const res = await fetch(`${API_BASE}/youtube/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_time: scheduleTime }),
      });
      if (!res.ok) throw new Error();
      await loadData();
      setShowSchedulePicker(false);
      showNotice("success", `Scheduled for ${new Date(scheduleTime).toLocaleString()}`);
    } catch {
      showNotice("error", "Schedule failed");
    } finally {
      setScheduling(false);
    }
  };

  const handlePublish = async () => {
    let id = videoId;
    if (!id) {
      const res = await fetch(`${API_BASE}/youtube/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) { showNotice("error", "Save failed"); return; }
      const data: YouTubeVideo = await res.json();
      id = data.id;
      setVideoId(id);
    }
    setPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/youtube/${id}/publish`, { method: "POST" });
      if (!res.ok) throw new Error();
      setTitle(""); setDescription(""); setTags([]); setThumbnail(null);
      setVideoUrl(""); setVideoId(null); setSavedAt(null);
      await loadData();
      showNotice("success", "Published to YouTube!");
    } catch {
      showNotice("error", "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setTags([]); setThumbnail(null);
    setVideoUrl(""); setVideoId(null); setSavedAt(null);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, tags, thumbnail, visibility, category, videoUrl, videoId]);

  // ── SEO tips ──
  const seoTips = [
    scores.titleStrength < 60 && { icon: "◈", msg: "Make title 50–70 chars with a number or power word", color: "#f59e0b" },
    scores.tagCoverage < 60 && { icon: "◈", msg: "Add more tags from the Tag Bank (aim for 12–15)", color: "#f59e0b" },
    scores.descriptionQuality < 60 && { icon: "◈", msg: "Write 200+ chars with timestamps and links", color: "#f59e0b" },
    scores.thumbnailScore === 0 && { icon: "◈", msg: "Set a custom thumbnail to boost CTR by ~30%", color: "#ef4444" },
    !videoUrl && { icon: "◎", msg: "Add a video URL or upload before publishing", color: "#f59e0b" },
    scores.overall >= 80 && { icon: "✓", msg: "Great SEO setup! Ready to publish.", color: "#39de8b" },
  ].filter(Boolean) as { icon: string; msg: string; color: string }[];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#09090f] text-white overflow-hidden">

      {/* ── Top bar ── */}
      <header className="shrink-0 flex items-center justify-between px-5 h-12 border-b border-white/5 bg-[#09090f]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">←</a>
          <div className="w-px h-4 bg-white/10" />
          <YtIcon size={16} />
          <span className="text-[13px] font-semibold text-white/80 tracking-tight">YouTube Studio</span>
        </div>

        {/* Tab nav */}
        <nav className="flex items-center gap-0.5">
          {(["compose", "drafts", "scheduled", "performance"] as TabKey[]).map((tab) => {
            const labels: Record<TabKey, string> = {
              compose: "Compose", drafts: "Drafts", scheduled: "Scheduled", performance: "Performance",
            };
            const badge =
              tab === "drafts" ? videos.draft_count :
              tab === "scheduled" ? videos.scheduled_count : 0;
            return (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className={`relative px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-[#ff0033]/15 text-[#ff0033]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {labels[tab]}
                {badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#ff0033] animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-[10px] text-[#ff0033]/50 font-mono flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[#ff0033]/50 inline-block" />
              {savedAt}
            </span>
          )}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-white/25">{videos.draft_count}<span className="text-white/15 ml-0.5">D</span></span>
            <span className="text-white/25">{videos.scheduled_count}<span className="text-white/15 ml-0.5">S</span></span>
            <span className="text-white/25">{videos.published_count}<span className="text-white/15 ml-0.5">P</span></span>
          </div>
          {videoId && (
            <button
              onClick={resetForm}
              className="text-[10px] font-mono text-white/25 hover:text-white/50 px-2 py-1 rounded border border-white/8 hover:border-white/15 transition-colors"
            >
              + New
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="text-white/25 hover:text-white/50 text-sm transition-colors disabled:opacity-30"
            title="Refresh"
          >
            <span className={loading ? "inline-block animate-spin" : ""}>⟳</span>
          </button>
        </div>
      </header>

      {/* ── Notice ── */}
      {notice && (
        <div className={`shrink-0 px-5 py-2 text-[11px] font-medium flex items-center gap-2 ${
          notice.type === "success"
            ? "bg-[#39de8b]/10 border-b border-[#39de8b]/20 text-[#39de8b]"
            : "bg-red-500/10 border-b border-red-500/20 text-red-400"
        }`}>
          <span>{notice.type === "success" ? "✓" : "✕"}</span>
          {notice.msg}
        </div>
      )}

      {/* ── Non-compose tabs ── */}
      {activeTab !== "compose" && (
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "drafts" && (
            <DraftsTab data={videos} onEdit={() => setTab("compose")} onRefresh={loadData} />
          )}
          {activeTab === "scheduled" && (
            <ScheduledTab
              videos={videos.videos.filter((v) => v.status === "scheduled")}
              onEdit={() => setTab("compose")}
              onRefresh={loadData}
            />
          )}
          {activeTab === "performance" && (
            <PerformanceTab
              videos={videos.videos}
              analytics={{
                total_videos: videos.total,
                total_views: 0,
                total_watch_time: 0,
                avg_seo_score: videos.videos.length
                  ? Math.round(videos.videos.reduce((s, v) => s + (v.hook_score ?? 0), 0) / videos.videos.length)
                  : 0,
                published_count: videos.published_count,
              }}
            />
          )}
        </main>
      )}

      {/* ── Compose: 3-panel ── */}
      {activeTab === "compose" && (
        <div className="flex flex-1 min-h-0">

          {/* ══ LEFT PANEL ══ */}
          <aside className="w-[240px] shrink-0 border-r border-white/5 bg-[#0c0c14] flex flex-col overflow-hidden">

            {/* Tab switcher */}
            <div className="shrink-0 flex items-center gap-0.5 p-2 border-b border-white/5">
              {(["library", "titles", "tags"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLeftTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                    leftTab === t
                      ? "bg-white/10 text-white/75"
                      : "text-white/30 hover:text-white/55"
                  }`}
                >
                  {t === "library" ? "◫ Library" : t === "titles" ? "✍ Titles" : "# Tags"}
                </button>
              ))}
            </div>

            {/* ── Library tab ── */}
            {leftTab === "library" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Search */}
                <div className="px-3 pt-3 pb-2 shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      placeholder="Search assets…"
                      className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-1.5 text-[11px] text-white/60 placeholder-white/20 focus:outline-none focus:border-white/15 transition-colors pr-6"
                    />
                    {assetSearch && (
                      <button
                        onClick={() => setAssetSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55 text-[10px] transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter + count */}
                <div className="flex items-center gap-0.5 px-3 pb-2 shrink-0">
                  {(["all", "image", "video"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setAssetFilter(f)}
                      className={`px-2.5 py-1 rounded text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                        assetFilter === f ? "bg-white/10 text-white/70" : "text-white/25 hover:text-white/50"
                      }`}
                    >
                      {f === "all" ? "All" : f === "image" ? "IMG" : "VID"}
                    </button>
                  ))}
                  <span className="ml-auto text-[9px] text-white/20 font-mono">{filteredAssets.length}</span>
                </div>

                {/* Asset grid */}
                <div className="flex-1 overflow-y-auto px-3 pb-3">
                  {assetsLoading ? (
                    <div className="flex items-center justify-center h-20">
                      <span className="text-[10px] text-white/20">Loading…</span>
                    </div>
                  ) : filteredAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-24 gap-2 text-center">
                      <span className="text-[10px] text-white/20">No assets found</span>
                      <a
                        href="/assets"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-[#ff0033]/40 hover:text-[#ff0033]/70 underline transition-colors"
                      >
                        Open library →
                      </a>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {filteredAssets.map((asset) => {
                        const isThumb = thumbnail?.id === asset.id;
                        const isVideoAsset = asset.media_type === "video";
                        const isVideoSet = videoUrl === `${API_BASE}/assets/${asset.id}/file`;
                        const isActive = isThumb || isVideoSet;
                        return (
                          <button
                            key={asset.id}
                            onClick={() => {
                              if (isVideoAsset) {
                                setVideoUrl(`${API_BASE}/assets/${asset.id}/file`);
                                showNotice("success", `Video source set: ${asset.filename}`);
                              } else {
                                setThumbnail(asset);
                                showNotice("success", `Thumbnail set: ${asset.filename}`);
                              }
                            }}
                            className={`relative rounded-lg overflow-hidden group transition-all ${
                              isActive
                                ? "ring-2 ring-[#ff0033]"
                                : "ring-1 ring-white/8 hover:ring-white/25"
                            }`}
                            style={{ aspectRatio: "16/9" }}
                            title={asset.filename}
                          >
                            {isVideoAsset ? (
                              <div className="w-full h-full bg-gradient-to-br from-[#1a0a0f] to-[#0d0508] flex flex-col items-center justify-center gap-0.5">
                                <span className="text-[#ff0033]/60 text-sm">▶</span>
                                <span className="text-[7px] text-white/30 font-mono px-1 max-w-full truncate">
                                  {asset.filename.replace(/\.[^/.]+$/, "").slice(0, 14)}
                                </span>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`${API_BASE}/assets/${asset.id}/thumb?size=160`}
                                alt={asset.filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            )}
                            {/* Hover / active overlay */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                              isActive
                                ? "bg-[#ff0033]/25 opacity-100"
                                : "bg-black/50 opacity-0 group-hover:opacity-100"
                            }`}>
                              <span className="text-[9px] font-semibold text-white text-center px-1 leading-tight drop-shadow">
                                {isThumb ? "✓ Thumb" : isVideoSet ? "✓ Video" : isVideoAsset ? "Set video" : "Set thumb"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer: sync link */}
                <div className="shrink-0 px-3 py-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/20 font-mono">
                      {assets.filter(a => a.media_type === "image").length} img · {assets.filter(a => a.media_type === "video").length} vid
                    </span>
                    <a
                      href="/assets"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-white/25 hover:text-white/50 transition-colors"
                    >
                      Manage →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* ── Titles tab ── */}
            {leftTab === "titles" && (
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Title Bank</span>
                  <span className="text-[9px] text-white/20 font-mono">{TITLE_TEMPLATES.length}</span>
                </div>
                <div className="space-y-1.5">
                  {TITLE_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      onClick={() => { setTitle(tpl); titleRef.current?.focus(); }}
                      className="w-full text-left px-2.5 py-2 rounded-lg bg-white/3 hover:bg-[#ff0033]/8 border border-white/5 hover:border-[#ff0033]/20 transition-all group"
                    >
                      <span className="text-[10px] text-white/45 group-hover:text-white/75 leading-snug line-clamp-2 transition-colors">
                        {tpl}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tags tab ── */}
            {leftTab === "tags" && (
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Tag Bank</span>
                  <span className="text-[9px] text-white/20 font-mono">{tags.length} added</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_SUGGESTIONS.map((tag) => {
                    const added = tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => added ? removeTag(tag) : addTag(tag)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-all border ${
                          added
                            ? "bg-[#ff0033]/15 border-[#ff0033]/25 text-[#ff0033]/80"
                            : "bg-white/4 border-white/8 text-white/40 hover:border-white/20 hover:text-white/65"
                        }`}
                      >
                        {added ? "✓ " : "+ "}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </aside>

          {/* ══ CENTER PANEL ══ */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#09090f]">

            {/* Toolbar */}
            <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  visibility === "public" ? "bg-[#39de8b]/10 border-[#39de8b]/20 text-[#39de8b]" :
                  visibility === "unlisted" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                  "bg-white/6 border-white/10 text-white/40"
                }`}>
                  {visibility === "public" ? "◉ Public" : visibility === "unlisted" ? "◎ Unlisted" : "○ Private"}
                </span>
                {videoId && (
                  <span className="text-[10px] font-mono text-[#ff0033]/40 px-1.5 py-0.5 border border-[#ff0033]/15 rounded-full">
                    editing draft
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-white/25 font-mono">
                <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">⌘S</kbd>
                <span>save</span>
                <span className="mx-1 opacity-50">·</span>
                <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">⌘↵</kbd>
                <span>submit</span>
              </div>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Video source */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    Video Source
                  </label>
                  {videoUrl && (
                    <button
                      onClick={() => setVideoUrl("")}
                      className="text-[10px] text-white/25 hover:text-red-400 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste YouTube URL or pick a video from Library →"
                    className="flex-1 bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-[13px] text-white/70 placeholder-white/20 focus:outline-none focus:border-[#ff0033]/30 focus:bg-white/5 transition-colors"
                  />
                  <button
                    onClick={() => { setLeftTab("library"); setAssetFilter("video"); }}
                    className="shrink-0 px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-[10px] text-white/40 hover:text-white/65 transition-colors"
                    title="Browse video library"
                  >
                    ◫
                  </button>
                </div>
                {videoUrl && (
                  <p className="mt-1.5 text-[10px] text-[#39de8b]/50 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#39de8b]/50 inline-block" />
                    Video source set
                  </p>
                )}
              </div>

              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    Title
                  </label>
                  <div className="flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2"/>
                      <circle
                        cx="9" cy="9" r="7" fill="none" strokeWidth="2"
                        strokeDasharray={`${2 * Math.PI * 7}`}
                        strokeDashoffset={`${2 * Math.PI * 7 * (1 - title.length / MAX_TITLE)}`}
                        stroke={title.length > MAX_TITLE * 0.9 ? "#f59e0b" : "#ff0033"}
                        strokeLinecap="round"
                        transform="rotate(-90 9 9)"
                        style={{ transition: "stroke-dashoffset 0.15s" }}
                      />
                    </svg>
                    <span className={`text-[11px] font-mono tabular-nums ${
                      title.length > MAX_TITLE * 0.9 ? "text-amber-400" : "text-white/25"
                    }`}>
                      {titleLeft}
                    </span>
                  </div>
                </div>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                  placeholder="Enter an attention-grabbing title…"
                  className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-[16px] text-white/85 placeholder-white/20 font-semibold focus:outline-none focus:border-[#ff0033]/30 focus:bg-white/5 transition-colors"
                  style={{ caretColor: "#ff0033" }}
                  autoFocus
                />
                {title.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-white/6 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${scores.titleStrength}%`,
                          backgroundColor: scoreColor(scores.titleStrength),
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-white/25">
                      {scoreLabel(scores.titleStrength)}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    Description
                  </label>
                  <span className="text-[10px] text-white/20 font-mono">
                    {description.length}/{MAX_DESC}
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                  placeholder="Describe the video — add timestamps, links, and keywords for SEO."
                  rows={6}
                  className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-[13px] text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-[#ff0033]/30 focus:bg-white/5 transition-colors leading-relaxed"
                  style={{ caretColor: "#ff0033" }}
                />
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    Tags
                  </label>
                  <span className="text-[10px] text-white/20 font-mono">{tags.length} tags</span>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ff0033]/10 border border-[#ff0033]/20 text-[11px] text-[#ff0033]/80"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-[#ff0033]/40 hover:text-[#ff0033] ml-0.5 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder="Add a tag and press Enter…"
                    className="flex-1 bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/20 focus:outline-none focus:border-[#ff0033]/25 transition-colors"
                  />
                  <button
                    onClick={() => addTag(tagInput)}
                    disabled={!tagInput.trim()}
                    className="px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10 text-[11px] text-white/50 border border-white/8 transition-colors disabled:opacity-30"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Thumbnail */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    Thumbnail
                  </label>
                  {thumbnail && (
                    <button
                      onClick={() => setThumbnail(null)}
                      className="text-[10px] text-white/25 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {thumbnail ? (
                  <div className="flex items-start gap-3">
                    <div
                      className="relative rounded-xl overflow-hidden bg-white/3 border border-white/8 shrink-0"
                      style={{ aspectRatio: "16/9", width: 200 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API_BASE}/assets/${thumbnail.id}/thumb?size=480`}
                        alt={thumbnail.filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                        <p className="text-[8px] text-white/70 truncate">{thumbnail.filename}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <button
                        onClick={() => { setLeftTab("library"); setAssetFilter("image"); }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/45 hover:text-white/70 border border-white/8 transition-colors text-left"
                      >
                        ◫ Change…
                      </button>
                      <button
                        onClick={() => setThumbnail(null)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/12 text-[10px] text-red-400/60 hover:text-red-400 border border-red-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setLeftTab("library"); setAssetFilter("image"); }}
                      className="rounded-xl border-2 border-dashed border-white/10 hover:border-[#ff0033]/30 bg-white/2 hover:bg-white/4 transition-all flex flex-col items-center justify-center py-7 gap-2"
                      style={{ width: 200, aspectRatio: "16/9" }}
                    >
                      <span className="text-xl opacity-20">🖼</span>
                      <span className="text-[10px] text-white/30">Pick from Library</span>
                    </button>
                    <div className="space-y-1.5">
                      {imageAssets.slice(0, 4).map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => setThumbnail(asset)}
                          className="relative w-16 rounded-lg overflow-hidden ring-1 ring-white/8 hover:ring-[#ff0033]/40 transition-all block"
                          style={{ aspectRatio: "16/9" }}
                          title={asset.filename}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${API_BASE}/assets/${asset.id}/thumb?size=160`}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                      {imageAssets.length === 0 && (
                        <span className="text-[10px] text-white/20">No images in library</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-5">
                {/* Visibility */}
                <div>
                  <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-2">
                    Visibility
                  </label>
                  <div className="flex flex-col gap-1">
                    {(["public", "unlisted", "private"] as VisibilityType[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setVisibility(v)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors border ${
                          visibility === v
                            ? "bg-white/10 border-white/20 text-white/80"
                            : "bg-white/3 border-white/6 text-white/35 hover:border-white/15 hover:text-white/60"
                        }`}
                      >
                        <span className="text-[10px]">
                          {v === "public" ? "◉" : v === "unlisted" ? "◎" : "○"}
                        </span>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-2">
                    Category
                  </label>
                  <div className="flex flex-col gap-1">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-2 rounded-lg text-[10px] text-left font-medium transition-colors border ${
                          category === cat
                            ? "bg-white/10 border-white/20 text-white/80"
                            : "bg-white/3 border-white/6 text-white/35 hover:border-white/15 hover:text-white/60"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-4" />
            </div>

            {/* ── Action bar ── */}
            <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-white/5 bg-[#0c0c14]">
              <button
                onClick={handleSave}
                disabled={saving || isEmpty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-[11px] font-semibold text-white/60 hover:text-white/80 border border-white/8 transition-colors disabled:opacity-40"
              >
                {saving ? (
                  <span className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                ) : "◫"}
                Save Draft
              </button>

              <button
                onClick={handleSubmit}
                disabled={submitting || isEmpty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-[11px] font-semibold text-amber-400 border border-amber-500/20 transition-colors disabled:opacity-40"
              >
                {submitting ? (
                  <span className="w-3 h-3 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                ) : "▲"}
                Submit for Approval
              </button>

              {/* Schedule */}
              <div className="relative">
                <button
                  onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                  disabled={isEmpty}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/12 hover:bg-violet-500/20 text-[11px] font-semibold text-violet-400 border border-violet-500/20 transition-colors disabled:opacity-40"
                >
                  🕐 Schedule
                </button>
                {showSchedulePicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSchedulePicker(false)} />
                    <div className="absolute bottom-full mb-2 left-0 z-20 bg-[#15151f] border border-white/10 rounded-xl p-3 shadow-2xl w-64">
                      <div className="text-[10px] text-white/40 font-medium mb-2">Schedule publish for</div>
                      <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white/70 focus:outline-none focus:border-[#ff0033]/40 mb-2"
                      />
                      <button
                        onClick={handleSchedule}
                        disabled={!scheduleTime || scheduling}
                        className="w-full py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-[11px] font-semibold text-violet-300 border border-violet-500/20 transition-colors disabled:opacity-40"
                      >
                        {scheduling ? "Scheduling…" : "Confirm Schedule"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handlePublish}
                disabled={publishing || isEmpty}
                className="flex items-center gap-2 ml-auto px-5 py-2 rounded-xl bg-[#ff0033] hover:bg-[#cc0026] text-[11px] font-bold text-white transition-colors disabled:opacity-40"
              >
                {publishing ? (
                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                ) : <YtIcon size={13} color="white" />}
                Publish to YouTube →
              </button>
            </div>
          </div>

          {/* ══ RIGHT PANEL — Preview + SEO ══ */}
          <aside className="w-[300px] shrink-0 border-l border-white/5 bg-[#0c0c14] flex flex-col overflow-hidden">

            {/* Preview mode toggle */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Preview</span>
              <div className="flex items-center gap-0.5 bg-white/4 rounded-lg p-0.5">
                {(["desktop", "mobile", "suggested"] as PreviewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={`px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                      previewMode === mode ? "bg-white/10 text-white/80" : "text-white/25 hover:text-white/50"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className={`shrink-0 border-b border-white/5 overflow-hidden ${
              previewMode === "mobile" ? "flex justify-center bg-[#080810] py-4" : "p-4"
            }`}>
              <VideoPreview
                title={title}
                thumbnail={thumbnail}
                channelName="Integrity Reforestation"
                mode={previewMode}
              />
            </div>

            {/* SEO Intelligence */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

              {/* Score header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    SEO Score
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-[22px] font-black font-mono tabular-nums"
                      style={{ color: scoreColor(scores.overall) }}
                    >
                      {scores.overall}
                    </span>
                    <span className="text-[9px] text-white/25">/100</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/6 overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${scores.overall}%`, backgroundColor: scoreColor(scores.overall) }}
                  />
                </div>
                <div className="space-y-3">
                  <ScoreBar label="Title Strength" value={scores.titleStrength} tip="50–70 chars, power words, numbers" />
                  <ScoreBar label="Tag Coverage" value={scores.tagCoverage} tip="10–15 tags recommended" />
                  <ScoreBar label="Description" value={scores.descriptionQuality} tip="200+ chars with keywords" />
                  <ScoreBar label="Thumbnail" value={scores.thumbnailScore} tip="Custom thumbnail set" />
                </div>
              </div>

              {/* SEO Tips */}
              {seoTips.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                    Recommendations
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {seoTips.map((tip, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white/2 border border-white/5"
                      >
                        <span className="text-[10px] mt-0.5 shrink-0" style={{ color: tip.color }}>
                          {tip.icon}
                        </span>
                        <span className="text-[10px] text-white/40 leading-snug">{tip.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Channel summary */}
              <div className="border-t border-white/5 pt-4">
                <span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                  Channel
                </span>
                <div className="mt-3 space-y-1.5">
                  {[
                    { label: "Subscribers", value: "—", sub: "connect account" },
                    { label: "Published", value: String(videos.published_count), sub: "videos" },
                    { label: "Drafts", value: String(videos.draft_count), sub: "in progress" },
                    { label: "Scheduled", value: String(videos.scheduled_count), sub: "queued" },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="flex items-center justify-between py-0.5">
                      <span className="text-[10px] text-white/30">{label}</span>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-white/60">{value}</span>
                        <span className="text-[9px] text-white/20 ml-1">{sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </aside>

        </div>
      )}
    </div>
  );
}
