"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DraftsTab from "@/components/x-studio/DraftsTab";
import ScheduledTab from "@/components/x-studio/ScheduledTab";
import PerformanceTab from "@/components/x-studio/PerformanceTab";
import XPostPreview from "@/components/x-studio/XPostPreview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_CHARS = 280;

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudioPost {
  id: string;
  content: string;
  post_type: string;
  thread_posts: { position: number; text: string; char_count: number }[];
  status: string;
  hook_score: number;
  estimated_reach: number;
  topic_signal: string | null;
  scheduled_time: string | null;
  published_time: string | null;
  updated_at: string;
}

interface XPostListResponse {
  posts: StudioPost[];
  total: number;
  draft_count: number;
  pending_count: number;
  scheduled_count: number;
  published_count: number;
}

interface Signal {
  id: string;
  topic: string;
  signal_type?: string;
  source?: string;
  engagement_score?: number;
}

interface Asset {
  id: string;
  filename: string;
  media_type: "image" | "video" | "audio";
  width: number | null;
  height: number | null;
}

interface AttachedMedia {
  asset_id: string;
  filename: string;
  media_type: string;
  url: string;
}

type TabKey = "compose" | "drafts" | "scheduled" | "performance";
type PreviewMode = "feed" | "mobile" | "thread";
type LeftTab = "library" | "signals" | "hooks";

const EMPTY_LIST: XPostListResponse = {
  posts: [], total: 0, draft_count: 0, pending_count: 0, scheduled_count: 0, published_count: 0,
};

const STATIC_HOOKS = [
  "We planted {X} trees today and discovered something unexpected…",
  "Most reforestation projects fail within 5 years. Here's why ours doesn't:",
  "1 year ago this hillside was bare. Now look:",
  "Nobody talks about what reforestation actually costs. Thread 🧵",
  "The tree that almost died taught us everything.",
  "We were wrong about how to plant trees. Here's what changed:",
];

const SUGGESTED_HASHTAGS = [
  "#reforestation", "#climateaction", "#trees", "#sustainability",
  "#planting", "#forestry", "#carboncapture", "#nature",
];

// ── Entry ─────────────────────────────────────────────────────────────────────

export default function XStudioPage() {
  return (
    <Suspense fallback={null}>
      <XStudio />
    </Suspense>
  );
}

// ── Main Studio ───────────────────────────────────────────────────────────────

function XStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") ?? "compose") as TabKey;
  const setTab = (t: TabKey) => router.replace(`/x-studio?tab=${t}`);

  // ── Post state ──
  const [content, setContent] = useState("");
  const [threadPosts, setThreadPosts] = useState<string[]>([""]);
  const [isThread, setIsThread] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("feed");
  const [postId, setPostId] = useState<string | null>(null);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ── Library ──
  const [leftTab, setLeftTab] = useState<LeftTab>("library");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<"all" | "image" | "video">("all");
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);

  // ── Data ──
  const [posts, setPosts] = useState<XPostListResponse>(EMPTY_LIST);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    const [postsRes, signalsRes] = await Promise.all([
      fetch(`${API_BASE}/x/drafts?limit=100`).then((r) => r.json()).catch(() => EMPTY_LIST),
      fetch(`${API_BASE}/signals/live?limit=5`).then((r) => r.json()).catch(() => ({ signals: [] })),
    ]);
    setPosts(postsRes);
    setSignals(signalsRes?.signals ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Load assets once on mount
  useEffect(() => {
    setAssetsLoading(true);
    fetch(`${API_BASE}/assets?limit=500`)
      .then((r) => r.json())
      .then((d) => setAssets((d.assets ?? []).filter((a: Asset) => a.media_type === "image" || a.media_type === "video")))
      .catch(() => {})
      .finally(() => setAssetsLoading(false));
  }, []);

  const attachMedia = (asset: Asset) => {
    if (attachedMedia.length >= 4) return;
    if (attachedMedia.some((m) => m.asset_id === asset.id)) return;
    setAttachedMedia((prev) => [
      ...prev,
      { asset_id: asset.id, filename: asset.filename, media_type: asset.media_type, url: `${API_BASE}/assets/${asset.id}/file` },
    ]);
  };
  const detachMedia = (assetId: string) => setAttachedMedia((prev) => prev.filter((m) => m.asset_id !== assetId));

  const showNotice = (type: "success" | "error", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 3500);
  };

  // ── Derived ──
  const filteredAssets = assets.filter((a) => {
    const typeOk = assetFilter === "all" || a.media_type === assetFilter;
    const searchOk = !assetSearch || a.filename.toLowerCase().includes(assetSearch.toLowerCase());
    return typeOk && searchOk;
  });
  const activeContent = isThread ? threadPosts[0] : content;
  const charCount = activeContent.length;
  const charLeft = MAX_CHARS - charCount;
  const charPct = Math.min(charCount / MAX_CHARS, 1);
  const isOverLimit = charLeft < 0;
  const isEmpty = isThread
    ? threadPosts.every((p) => !p.trim())
    : !content.trim();

  const visibleHashtags = SUGGESTED_HASHTAGS.filter(
    (h) => !content.includes(h) && !threadPosts.join(" ").includes(h)
  ).slice(0, 5);

  // ── Thread helpers ──
  const updateThreadPost = (i: number, val: string) => {
    setThreadPosts((prev) => prev.map((p, idx) => (idx === i ? val : p)));
  };
  const addThreadPost = () => setThreadPosts((prev) => [...prev, ""]);
  const removeThreadPost = (i: number) => {
    if (threadPosts.length <= 1) return;
    setThreadPosts((prev) => prev.filter((_, idx) => idx !== i));
  };

  // ── Build payload ──
  const buildPayload = () => {
    const media = attachedMedia.map((m) => ({
      asset_id: m.asset_id,
      url: m.url,
      media_type: m.media_type,
    }));
    if (isThread) {
      return {
        content: threadPosts[0],
        post_type: "thread",
        thread_posts: threadPosts.map((text, i) => ({ position: i, text, char_count: text.length })),
        media,
        hook_score: 0,
        estimated_reach: 0,
      };
    }
    return {
      content,
      post_type: "single",
      thread_posts: [],
      media,
      hook_score: 0,
      estimated_reach: 0,
    };
  };

  // ── Actions ──
  const handleSave = async () => {
    if (isEmpty) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (postId) {
        const res = await fetch(`${API_BASE}/x/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch(`${API_BASE}/x/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const data: StudioPost = await res.json();
        setPostId(data.id);
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
    let id = postId;
    if (!id) {
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/x/draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) throw new Error();
        const data: StudioPost = await res.json();
        id = data.id;
        setPostId(id);
      } catch {
        showNotice("error", "Save failed");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/x/${id}/submit-approval`, { method: "POST" });
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
    let id = postId;
    if (!id) {
      const res = await fetch(`${API_BASE}/x/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) { showNotice("error", "Save failed"); return; }
      const data: StudioPost = await res.json();
      id = data.id;
      setPostId(id);
    }
    setScheduling(true);
    try {
      const res = await fetch(`${API_BASE}/x/${id}/schedule`, {
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

  const handlePostNow = async () => {
    let id = postId;
    if (!id) {
      const res = await fetch(`${API_BASE}/x/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) { showNotice("error", "Save failed"); return; }
      const data: StudioPost = await res.json();
      id = data.id;
      setPostId(id);
    }
    try {
      const res = await fetch(`${API_BASE}/x/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail: string = err?.detail ?? `HTTP ${res.status}`;
        showNotice("error", `Post failed: ${detail}`);
        return;
      }
      setContent("");
      setThreadPosts([""]);
      setPostId(null);
      setAttachedMedia([]);
      await loadData();
      showNotice("success", "Posted to X!");
    } catch (e: unknown) {
      showNotice("error", e instanceof Error ? e.message : "Post failed");
    }
  };

  const insertHook = (hook: string) => {
    if (isThread) {
      setThreadPosts((prev) => {
        const next = [...prev];
        next[0] = hook;
        return next;
      });
    } else {
      setContent(hook);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const insertHashtag = (tag: string) => {
    if (isThread) {
      setThreadPosts((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        next[last] = next[last] ? next[last] + " " + tag : tag;
        return next;
      });
    } else {
      setContent((prev) => prev ? prev + " " + tag : tag);
    }
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
  }, [content, threadPosts, isThread, postId]);

  // ── Build thread data for preview ──
  const previewThreadPosts = isThread
    ? threadPosts.map((text, i) => ({ position: i, text, char_count: text.length }))
    : [];

  return (
    <div className="flex flex-col h-screen bg-[#09090f] text-white overflow-hidden">

      {/* ── Top bar ── */}
      <header className="shrink-0 flex items-center justify-between px-5 h-12 border-b border-white/5 bg-[#09090f]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">←</a>
          <div className="w-px h-4 bg-white/10" />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white/60">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span className="text-[13px] font-semibold text-white/80 tracking-tight">X Post Studio</span>
        </div>

        {/* Tab nav */}
        <nav className="flex items-center gap-0.5">
          {(["compose", "drafts", "scheduled", "performance"] as TabKey[]).map((tab) => {
            const labels: Record<TabKey, string> = { compose: "Compose", drafts: "Drafts", scheduled: "Scheduled", performance: "Performance" };
            const badge = tab === "drafts" ? posts.draft_count : tab === "scheduled" ? posts.scheduled_count : 0;
            return (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className={`relative px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-[#39de8b]/15 text-[#39de8b]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {labels[tab]}
                {badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#39de8b] animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-[10px] text-[#39de8b]/50 font-mono flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[#39de8b]/50 inline-block" />
              {savedAt}
            </span>
          )}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-white/25">{posts.draft_count}<span className="text-white/15 ml-0.5">D</span></span>
            <span className="text-white/25">{posts.pending_count}<span className="text-white/15 ml-0.5">P</span></span>
            <span className="text-white/25">{posts.scheduled_count}<span className="text-white/15 ml-0.5">S</span></span>
          </div>
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

      {/* ── Notice banner ── */}
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

      {/* ── Secondary tabs (Drafts / Scheduled / Performance) ── */}
      {activeTab !== "compose" && (
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "drafts" && (
            <DraftsTab
              data={posts}
              onEdit={() => setTab("compose")}
              onRefresh={loadData}
            />
          )}
          {activeTab === "scheduled" && (
            <ScheduledTab
              posts={posts.posts.filter((p) => p.status === "scheduled")}
              onEdit={() => setTab("compose")}
              onRefresh={loadData}
            />
          )}
          {activeTab === "performance" && (
            <PerformanceTab
              posts={posts.posts}
              analytics={{
                total_posts: posts.total,
                total_impressions: 0,
                total_engagements: 0,
                total_reposts: 0,
                total_replies: 0,
                avg_hook_score: posts.posts.length
                  ? Math.round(posts.posts.reduce((s, p) => s + (p.hook_score ?? 0), 0) / posts.posts.length)
                  : 0,
                top_post_id: null,
                top_post_preview: null,
                top_post_impressions: 0,
                followers_gained: 0,
              }}
            />
          )}
        </main>
      )}

      {/* ── Compose view: 3-panel ── */}
      {activeTab === "compose" && (
        <div className="flex flex-1 min-h-0">

          {/* ══ LEFT PANEL — Library + Tools ══ */}
          <aside className="w-[240px] shrink-0 border-r border-white/5 bg-[#0c0c14] flex flex-col overflow-hidden">

            {/* Tab switcher */}
            <div className="shrink-0 flex items-center gap-0.5 p-2 border-b border-white/5">
              {(["library", "signals", "hooks"] as LeftTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setLeftTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                    leftTab === t ? "bg-white/10 text-white/75" : "text-white/30 hover:text-white/55"
                  }`}
                >
                  {t === "library" ? "◫ Library" : t === "signals" ? "⚡ Signals" : "# Hooks"}
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

                {/* Grid */}
                <div className="flex-1 overflow-y-auto px-3 pb-2">
                  {assetsLoading ? (
                    <div className="flex items-center justify-center h-20">
                      <span className="text-[10px] text-white/20">Loading…</span>
                    </div>
                  ) : filteredAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-24 gap-2 text-center">
                      <span className="text-[10px] text-white/20">No assets found</span>
                      <a href="/assets" target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#39de8b]/40 hover:text-[#39de8b]/70 underline transition-colors">
                        Open library →
                      </a>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {filteredAssets.map((asset) => {
                        const isAttached = attachedMedia.some((m) => m.asset_id === asset.id);
                        const disabled = !isAttached && attachedMedia.length >= 4;
                        return (
                          <button
                            key={asset.id}
                            onClick={() => isAttached ? detachMedia(asset.id) : attachMedia(asset)}
                            disabled={disabled}
                            title={disabled ? "Max 4 media attached" : asset.filename}
                            className={`relative rounded-lg overflow-hidden group transition-all disabled:opacity-30 ${
                              isAttached ? "ring-2 ring-[#39de8b]" : "ring-1 ring-white/8 hover:ring-white/25"
                            }`}
                            style={{ aspectRatio: "1/1" }}
                          >
                            {asset.media_type === "video" ? (
                              <div className="w-full h-full bg-gradient-to-br from-[#0a1a0e] to-[#050d07] flex flex-col items-center justify-center gap-0.5">
                                <span className="text-[#39de8b]/50 text-sm">▶</span>
                                <span className="text-[7px] text-white/25 font-mono px-1 max-w-full truncate">
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
                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                              isAttached ? "bg-[#39de8b]/20 opacity-100" : "bg-black/50 opacity-0 group-hover:opacity-100"
                            }`}>
                              <span className="text-[9px] font-semibold text-white drop-shadow">
                                {isAttached ? "✓ Added" : asset.media_type === "video" ? "Add video" : "Add image"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Attached strip */}
                {attachedMedia.length > 0 && (
                  <div className="shrink-0 border-t border-white/5 px-3 py-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] text-white/30 font-mono">{attachedMedia.length}/4 attached</span>
                      <button onClick={() => setAttachedMedia([])} className="text-[9px] text-white/20 hover:text-red-400 transition-colors">Clear all</button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {attachedMedia.map((m) => (
                        <div key={m.asset_id} className="relative w-10 h-10 rounded-lg overflow-hidden ring-1 ring-[#39de8b]/40 shrink-0 group">
                          {m.media_type === "video" ? (
                            <div className="w-full h-full bg-white/8 flex items-center justify-center text-[#39de8b]/60 text-xs">▶</div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${API_BASE}/assets/${m.asset_id}/thumb?size=80`} alt={m.filename} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => detachMedia(m.asset_id)}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="shrink-0 px-3 py-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] text-white/20 font-mono">
                    {assets.filter(a => a.media_type === "image").length} img · {assets.filter(a => a.media_type === "video").length} vid
                  </span>
                  <a href="/assets" target="_blank" rel="noopener noreferrer" className="text-[9px] text-white/25 hover:text-white/50 transition-colors">
                    Manage →
                  </a>
                </div>
              </div>
            )}

            {/* ── Signals tab ── */}
            {leftTab === "signals" && (
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Trend Signals</span>
                  <span className="text-[9px] text-white/20 font-mono">live</span>
                </div>
                <div className="space-y-1.5">
                  {signals.length > 0
                    ? signals.slice(0, 5).map((s) => (
                        <button key={s.id} onClick={() => insertHook(s.topic)}
                          className="w-full text-left px-2.5 py-2 rounded-lg bg-white/3 hover:bg-[#39de8b]/8 border border-white/5 hover:border-[#39de8b]/20 transition-all group">
                          <div className="flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#39de8b]/60 mt-1.5 shrink-0 group-hover:bg-[#39de8b]" />
                            <span className="text-[10px] text-white/55 group-hover:text-white/80 leading-snug line-clamp-2 transition-colors">{s.topic}</span>
                          </div>
                        </button>
                      ))
                    : ["Reforestation ROI", "Carbon sequestration data", "Tree species survival rates", "Crew welfare programs", "Seedling technology"].map((topic) => (
                        <button key={topic} onClick={() => insertHook(topic)}
                          className="w-full text-left px-2.5 py-2 rounded-lg bg-white/3 hover:bg-[#39de8b]/8 border border-white/5 hover:border-[#39de8b]/20 transition-all group">
                          <div className="flex items-start gap-2">
                            <span className="w-1 h-1 rounded-full bg-white/20 mt-1.5 shrink-0 group-hover:bg-[#39de8b]" />
                            <span className="text-[10px] text-white/45 group-hover:text-white/70 leading-snug transition-colors">{topic}</span>
                          </div>
                        </button>
                      ))
                  }
                </div>
              </div>
            )}

            {/* ── Hooks tab ── */}
            {leftTab === "hooks" && (
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Hook Bank</span>
                </div>
                <div className="space-y-1.5">
                  {STATIC_HOOKS.map((hook, i) => (
                    <button key={i} onClick={() => insertHook(hook)}
                      className="w-full text-left px-2.5 py-2 rounded-lg bg-white/3 hover:bg-[#39de8b]/8 border border-white/5 hover:border-[#39de8b]/20 transition-all group">
                      <span className="text-[10px] text-white/45 group-hover:text-white/75 leading-snug line-clamp-2 transition-colors">{hook}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </aside>

          {/* ══ CENTER PANEL — Composer ══ */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#09090f]">

            {/* Composer toolbar */}
            <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-white/5">
              <div className="flex items-center gap-1">
                {/* Thread toggle */}
                <button
                  onClick={() => { setIsThread(!isThread); if (!isThread) setThreadPosts([content || ""]); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                    isThread
                      ? "bg-[#39de8b]/15 text-[#39de8b] border border-[#39de8b]/25"
                      : "bg-white/5 text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  <span className="text-[11px]">≡</span>
                  Thread
                </button>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-white/25 font-mono">
                <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">⌘S</kbd>
                <span>save</span>
                <span className="mx-1 opacity-50">·</span>
                <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10">⌘↵</kbd>
                <span>submit</span>
              </div>
            </div>

            {/* Writing area */}
            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2">

              {!isThread ? (
                /* Single post */
                <div className="relative">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a6b3c] to-[#0d4a7a] border border-white/15 flex items-center justify-center text-[11px] font-bold text-white/80 shrink-0 mt-0.5">
                      IR
                    </div>
                    <div className="flex-1">
                      <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS + 20))}
                        placeholder="What's happening in the forest?"
                        rows={6}
                        className="w-full bg-transparent text-[15px] text-white/85 placeholder-white/20 resize-none outline-none leading-relaxed"
                        style={{ caretColor: "#39de8b" }}
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Thread mode */
                <div className="space-y-0">
                  {threadPosts.map((post, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0" style={{ width: 40 }}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a6b3c] to-[#0d4a7a] border border-white/15 flex items-center justify-center text-[11px] font-bold text-white/80 shrink-0">
                          IR
                        </div>
                        {i < threadPosts.length - 1 && (
                          <div className="w-0.5 flex-1 bg-white/8 my-1 min-h-6" />
                        )}
                      </div>
                      <div className="flex-1 pb-4 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-white/25 font-mono">{i + 1}/{threadPosts.length}</span>
                          {threadPosts.length > 1 && (
                            <button onClick={() => removeThreadPost(i)} className="text-[10px] text-white/20 hover:text-red-400 transition-colors">✕</button>
                          )}
                        </div>
                        <textarea
                          value={post}
                          onChange={(e) => updateThreadPost(i, e.target.value.slice(0, MAX_CHARS + 20))}
                          placeholder={i === 0 ? "Start your thread here…" : "Continue the thread…"}
                          rows={4}
                          className="w-full bg-transparent text-[15px] text-white/85 placeholder-white/20 resize-none outline-none leading-relaxed"
                          style={{ caretColor: "#39de8b" }}
                          autoFocus={i === 0}
                        />
                        <div className="flex justify-end mt-1">
                          <span className={`text-[10px] font-mono ${
                            post.length > MAX_CHARS ? "text-red-400" :
                            post.length > MAX_CHARS * 0.85 ? "text-amber-400" :
                            "text-white/20"
                          }`}>
                            {MAX_CHARS - post.length}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addThreadPost}
                    className="flex items-center gap-2 ml-[52px] px-3 py-2 rounded-lg bg-white/3 hover:bg-[#39de8b]/8 border border-white/8 hover:border-[#39de8b]/25 text-[11px] text-white/40 hover:text-[#39de8b] transition-all"
                  >
                    <span>+</span> Add post to thread
                  </button>
                </div>
              )}
            </div>

            {/* Attached media preview */}
            {attachedMedia.length > 0 && (
              <div className="shrink-0 px-5 py-3 border-b border-white/5">
                <div className={`grid gap-2 ${
                  attachedMedia.length === 1 ? "grid-cols-1" :
                  attachedMedia.length === 2 ? "grid-cols-2" :
                  "grid-cols-2"
                }`}>
                  {attachedMedia.map((m, idx) => (
                    <div
                      key={m.asset_id}
                      className={`relative rounded-xl overflow-hidden group bg-white/5 ${
                        attachedMedia.length === 1 ? "h-48" :
                        attachedMedia.length === 3 && idx === 0 ? "row-span-2 h-full" :
                        "h-32"
                      }`}
                    >
                      {m.media_type === "video" ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                          <span className="text-[#39de8b]/60 text-2xl">▶</span>
                          <span className="text-[10px] text-white/30 font-mono max-w-[120px] truncate">{m.filename}</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_BASE}/assets/${m.asset_id}/thumb?size=400`}
                          alt={m.filename}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => detachMedia(m.asset_id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white/70 hover:text-white text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Char counter + hashtags */}
            <div className="shrink-0 px-5 pb-3 border-b border-white/5">
              {/* Char ring + bar */}
              {!isThread && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {visibleHashtags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => insertHashtag(tag)}
                        className="text-[10px] text-white/25 hover:text-[#39de8b]/70 transition-colors font-mono"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Ring */}
                    <svg width="22" height="22" viewBox="0 0 22 22">
                      <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                      <circle
                        cx="11" cy="11" r="9"
                        fill="none"
                        strokeWidth="2"
                        strokeDasharray={`${2 * Math.PI * 9}`}
                        strokeDashoffset={`${2 * Math.PI * 9 * (1 - charPct)}`}
                        stroke={isOverLimit ? "#ef4444" : charLeft <= 20 ? "#f59e0b" : "#39de8b"}
                        strokeLinecap="round"
                        transform="rotate(-90 11 11)"
                        style={{ transition: "stroke-dashoffset 0.2s" }}
                      />
                    </svg>
                    <span className={`text-[11px] font-mono tabular-nums ${
                      isOverLimit ? "text-red-400" : charLeft <= 20 ? "text-amber-400" : "text-white/30"
                    }`}>
                      {charLeft}
                    </span>
                  </div>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setLeftTab("library"); setAssetFilter("image"); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] border transition-colors ${
                    attachedMedia.some(m => m.media_type === "image")
                      ? "bg-[#39de8b]/10 border-[#39de8b]/20 text-[#39de8b]/80"
                      : "bg-white/4 hover:bg-white/8 text-white/35 hover:text-white/60 border-white/6"
                  }`}
                >
                  <span>🖼</span> Image{attachedMedia.filter(m => m.media_type === "image").length > 0 && ` (${attachedMedia.filter(m => m.media_type === "image").length})`}
                </button>
                <button
                  onClick={() => { setLeftTab("library"); setAssetFilter("video"); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] border transition-colors ${
                    attachedMedia.some(m => m.media_type === "video")
                      ? "bg-[#39de8b]/10 border-[#39de8b]/20 text-[#39de8b]/80"
                      : "bg-white/4 hover:bg-white/8 text-white/35 hover:text-white/60 border-white/6"
                  }`}
                >
                  <span>🎬</span> Video{attachedMedia.filter(m => m.media_type === "video").length > 0 && ` (${attachedMedia.filter(m => m.media_type === "video").length})`}
                </button>
                <button
                  onClick={() => insertHook(STATIC_HOOKS[Math.floor(Math.random() * STATIC_HOOKS.length)])}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/4 hover:bg-[#39de8b]/10 text-[10px] text-white/35 hover:text-[#39de8b]/70 border border-white/6 hover:border-[#39de8b]/20 transition-colors"
                >
                  <span>⚡</span> Hook
                </button>
                {attachedMedia.length > 0 && (
                  <span className="ml-auto text-[10px] font-mono text-[#39de8b]/50 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#39de8b]/50 inline-block" />
                    {attachedMedia.length}/4
                  </span>
                )}
              </div>
            </div>

            {/* ── Bottom action bar ── */}
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
                {submitting ? <span className="w-3 h-3 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> : "▲"}
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
                    <div className="absolute bottom-full mb-2 left-0 z-20 bg-[#15151f] border border-white/10 rounded-xl p-3 shadow-xl w-64">
                      <div className="text-[10px] text-white/40 font-medium mb-2">Schedule for</div>
                      <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white/70 focus:outline-none focus:border-[#39de8b]/40 mb-2"
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
                onClick={handlePostNow}
                disabled={isEmpty || isOverLimit}
                className="flex items-center gap-1.5 ml-auto px-5 py-2 rounded-xl bg-[#39de8b] hover:bg-[#2ec97a] text-[11px] font-bold text-[#002a27] transition-colors disabled:opacity-40"
              >
                Post Now →
              </button>
            </div>
          </div>

          {/* ══ RIGHT PANEL — Live Preview ══ */}
          <aside className="w-[340px] shrink-0 border-l border-white/5 bg-[#0c0c14] flex flex-col overflow-hidden">

            {/* Preview mode toggle */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Preview</span>
              <div className="flex items-center gap-0.5 bg-white/4 rounded-lg p-0.5">
                {(["feed", "mobile", "thread"] as PreviewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setPreviewMode(mode); if (mode === "thread") setIsThread(true); }}
                    className={`px-2.5 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                      previewMode === mode
                        ? "bg-white/10 text-white/80"
                        : "text-white/25 hover:text-white/50"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview content */}
            <div className={`flex-1 overflow-y-auto ${
              previewMode === "mobile"
                ? "flex items-start justify-center pt-4 px-2 bg-[#080810]"
                : "p-4"
            }`}>
              {previewMode === "mobile" ? (
                /* Mobile phone frame */
                <div className="w-[260px] shrink-0 rounded-[28px] border-2 border-white/15 bg-[#000000] overflow-hidden shadow-2xl">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-5 pt-3 pb-1">
                    <span className="text-[9px] text-white/50 font-mono">9:41</span>
                    <div className="flex items-center gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-1 rounded-sm bg-white/60" style={{ height: 5 + i * 2 }} />
                      ))}
                    </div>
                  </div>
                  {/* X header */}
                  <div className="flex items-center justify-center py-2 border-b border-white/5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div className="p-3">
                    <XPostPreview
                      content={isThread ? threadPosts[0] : content}
                      postType={isThread ? "thread" : "single"}
                      threadPosts={isThread ? previewThreadPosts : []}
                    />
                  </div>
                </div>
              ) : (
                /* Feed / Thread view */
                <div>
                  {/* Fake feed chrome */}
                  {previewMode === "feed" && (
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex gap-3 text-[11px] text-white/20">
                        <span className="text-white/50 border-b-2 border-white/50 pb-1">For You</span>
                        <span className="hover:text-white/40 pb-1 cursor-default">Following</span>
                      </div>
                    </div>
                  )}
                  <XPostPreview
                    content={isThread ? threadPosts[0] : content}
                    postType={isThread ? "thread" : "single"}
                    threadPosts={isThread ? previewThreadPosts : []}
                  />
                  {/* Fake next post (feed feel) */}
                  {previewMode === "feed" && !isEmpty && (
                    <div className="mt-2 px-3 py-3 border-t border-white/5 opacity-20 pointer-events-none">
                      <div className="flex gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-white/5 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 bg-white/10 rounded w-24" />
                          <div className="h-2 bg-white/8 rounded w-full" />
                          <div className="h-2 bg-white/8 rounded w-3/4" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </aside>

        </div>
      )}
    </div>
  );
}
