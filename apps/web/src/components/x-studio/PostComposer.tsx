"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import XPostPreview from "./XPostPreview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadPost {
  id: string;
  text: string;
}

interface Hook {
  id: string;
  hook_text: string;
  hook_category: string;
  performance_score: number;
}

interface Asset {
  id: string;
  filename: string;
  media_type: string;
  content_type: string | null;
  ai_keywords: string[] | null;
}

interface AttachedMedia {
  asset_id: string;
  filename: string;
  media_type: string;
  url: string;
}

interface ViralScores {
  hookStrength: number;
  narrativePower: number;
  clarity: number;
  shareability: number;
  estimatedReach: number;
}

interface Props {
  postType: "single" | "thread";
  onSaveDraft: (post: { content: string; post_type: string; thread_posts: { position: number; text: string; char_count: number }[]; hook_score: number; estimated_reach: number; media: { asset_id: string; media_type: string }[] }) => Promise<string | null>;
  onSubmitApproval: (postId: string) => Promise<void>;
  onSchedule: (postId: string, time: string) => Promise<void>;
  onMultiply: (post: { content: string; thread_posts: { position: number; text: string; char_count: number }[] }) => void;
}

// ---------------------------------------------------------------------------
// Viral scoring (client-side, instant)
// ---------------------------------------------------------------------------

const HOOK_PATTERNS = [
  /\d+\s*(ways|tips|things|reasons|secrets|facts|steps)/i,
  /^(how|why|what|when|who|the truth|stop|never|always)/i,
  /\?$/,
  /(thread|🧵|here's what|breaking|urgent)/i,
  /(most people|nobody talks|unpopular opinion|hot take)/i,
];

const EMOTION_WORDS = ["devastating", "incredible", "shocking", "urgent", "critical", "inspiring", "heartbreaking", "miraculous", "now", "today", "breaking"];
const ENV_KEYWORDS  = ["forest", "tree", "reforestation", "wildfire", "climate", "ecosystem", "deforestation", "carbon", "plant", "restore", "conservation", "biodiversity"];
const CTA_PATTERNS  = [/repost/i, /share/i, /follow/i, /comment/i, /reply/i, /subscribe/i, /tag/i, /rt/i];

function computeScores(text: string, threadPosts: ThreadPost[]): ViralScores {
  const allText = threadPosts.length > 0
    ? threadPosts.map((p) => p.text).join(" ")
    : text;
  const firstLine = allText.split("\n")[0] || allText.slice(0, 120);
  const words = allText.toLowerCase().split(/\s+/).filter(Boolean);
  const sentences = allText.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Hook Strength: pattern matching on first line
  const hookMatches = HOOK_PATTERNS.filter((p) => p.test(firstLine)).length;
  const hookStrength = Math.min(hookMatches * 20 + (firstLine.length > 30 ? 15 : 0) + (firstLine.includes("?") ? 10 : 0), 100);

  // Narrative Power: env keyword density
  const envMatches = ENV_KEYWORDS.filter((kw) => allText.toLowerCase().includes(kw)).length;
  const narrativePower = Math.min(envMatches * 12 + (words.length > 20 ? 15 : 0), 100);

  // Clarity: ideal length 80–250 words, short sentences
  const avgSentLen = sentences.length > 0 ? words.length / sentences.length : words.length;
  const lenScore = words.length >= 10 && words.length <= 250 ? 40 : words.length < 10 ? 10 : 20;
  const clarity = Math.min(lenScore + (avgSentLen < 20 ? 30 : 10) + (sentences.length >= 3 ? 20 : 0), 100);

  // Shareability: emotion words + CTAs + hashtags
  const emotionMatches = EMOTION_WORDS.filter((w) => allText.toLowerCase().includes(w)).length;
  const ctaMatches = CTA_PATTERNS.filter((p) => p.test(allText)).length;
  const hashtagCount = (allText.match(/#\w+/g) || []).length;
  const shareability = Math.min(emotionMatches * 10 + ctaMatches * 15 + hashtagCount * 5 + 10, 100);

  // Estimated Reach: composite
  const composite = (hookStrength * 0.35 + narrativePower * 0.25 + clarity * 0.20 + shareability * 0.20);
  const estimatedReach = Math.round(composite * 850 + (threadPosts.length > 1 ? 5000 : 0));

  return {
    hookStrength: Math.max(hookStrength, text.trim().length > 10 ? 15 : 0),
    narrativePower: Math.max(narrativePower, text.trim().length > 10 ? 10 : 0),
    clarity: Math.max(clarity, text.trim().length > 10 ? 20 : 0),
    shareability: Math.max(shareability, text.trim().length > 10 ? 10 : 0),
    estimatedReach,
  };
}

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------

function ScoreBar({ label, value, color, tip }: { label: string; value: number; color: string; tip: string }) {
  return (
    <div className="group relative">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-mono text-white/40 uppercase">{label}</span>
        <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: value >= 60 ? color : "#64748b" }}>
          {value}
        </span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, backgroundColor: value >= 60 ? color : "#334155" }}
        />
      </div>
      <div className="hidden group-hover:block absolute left-0 top-8 z-10 bg-[#0d1117] border border-white/15 rounded-lg px-2.5 py-1.5 text-[10px] text-white/60 w-48 leading-relaxed">
        {tip}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character count ring
// ---------------------------------------------------------------------------

function CharRing({ count, limit = 280 }: { count: number; limit?: number }) {
  const remaining = limit - count;
  const pct = Math.min(count / limit, 1);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = remaining <= 20 ? "#ff2d55" : remaining <= 60 ? "#ff9500" : "#00ff88";
  return (
    <svg width={38} height={38} className="shrink-0">
      <circle cx={19} cy={19} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
      <circle
        cx={19} cy={19} r={r}
        fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 19 19)"
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize={9} fontFamily="monospace" fill={color}>
        {remaining >= 0 ? remaining : `+${Math.abs(remaining)}`}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const THREAD_FLOW = ["Hook", "Context", "Proof", "Impact", "CTA"];

export default function PostComposer({ postType, onSaveDraft, onSubmitApproval, onSchedule, onMultiply }: Props) {
  const [content, setContent]             = useState("");
  const [threadPosts, setThreadPosts]     = useState<ThreadPost[]>([{ id: "1", text: "" }]);
  const [hooks, setHooks]                 = useState<Hook[]>([]);
  const [assets, setAssets]               = useState<Asset[]>([]);
  const [assetSearch, setAssetSearch]     = useState("");
  const [assetFilter, setAssetFilter]     = useState<"all" | "image" | "video">("all");
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [showSchedule, setShowSchedule]   = useState(false);
  const [scheduleTime, setScheduleTime]   = useState("");
  const [saving, setSaving]               = useState<string | null>(null);
  const [savedId, setSavedId]             = useState<string | null>(null);
  const [scores, setScores]               = useState<ViralScores>({ hookStrength: 0, narrativePower: 0, clarity: 0, shareability: 0, estimatedReach: 0 });
  const [suggestions, setSuggestions]     = useState<string[]>([]);
  const [showPreview, setShowPreview]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load side data on mount
  useEffect(() => {
    fetch(`${API_BASE}/hooks?limit=10&sort_by=performance_score`)
      .then((r) => r.json()).then((d) => setHooks(d.hooks ?? [])).catch(() => {});
    setAssetsLoading(true);
    fetch(`${API_BASE}/assets?limit=120`)
      .then((r) => r.json())
      .then((d) => setAssets((d.assets ?? []).filter((a: Asset) => a.media_type === "image" || a.media_type === "video")))
      .catch(() => {})
      .finally(() => setAssetsLoading(false));
  }, []);

  // Recompute scores on content change
  useEffect(() => {
    const s = computeScores(content, postType === "thread" ? threadPosts : []);
    setScores(s);

    const tips: string[] = [];
    if (s.hookStrength < 50) tips.push("Start with a number, question, or bold claim for a stronger hook.");
    if (s.narrativePower < 40) tips.push("Include environmental keywords (forest, reforestation, climate) to boost relevance.");
    if (s.shareability < 40) tips.push("Add a repost request or question at the end to drive sharing.");
    if (postType === "thread" && threadPosts.length < 3) tips.push("Threads of 5–8 posts perform 3× better than single posts.");
    if (s.clarity < 50 && content.length > 20) tips.push("Break into shorter sentences. Aim for under 20 words per sentence.");
    setSuggestions(tips.slice(0, 3));
  }, [content, threadPosts, postType]);

  const insertAtCursor = useCallback((text: string) => {
    if (postType === "single") {
      const el = textareaRef.current;
      if (!el) { setContent((c) => c + " " + text); return; }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = content.slice(0, start) + text + content.slice(end);
      setContent(newVal);
      setTimeout(() => { el.selectionStart = el.selectionEnd = start + text.length; el.focus(); }, 0);
    } else {
      setThreadPosts((prev) => prev.map((p, i) => i === 0 ? { ...p, text: p.text + " " + text } : p));
    }
  }, [content, postType]);

  const addThreadPost = () => setThreadPosts((prev) => [...prev, { id: String(Date.now()), text: "" }]);
  const removeThreadPost = (id: string) => setThreadPosts((prev) => prev.filter((p) => p.id !== id));
  const updateThreadPost = (id: string, text: string) => setThreadPosts((prev) => prev.map((p) => p.id === id ? { ...p, text } : p));

  const attachMedia = useCallback((asset: Asset) => {
    setAttachedMedia((prev) => {
      if (prev.find((m) => m.asset_id === asset.id)) return prev; // already attached
      if (prev.length >= 4) return prev; // X limit: 4 images
      return [...prev, {
        asset_id: asset.id,
        filename: asset.filename,
        media_type: asset.media_type === "video" ? "video" : "image",
        url: `${API_BASE}/assets/${asset.id}/file`,
      }];
    });
  }, []);

  const detachMedia = useCallback((assetId: string) => {
    setAttachedMedia((prev) => prev.filter((m) => m.asset_id !== assetId));
  }, []);

  const buildPayload = () => ({
    content: postType === "single" ? content : threadPosts[0]?.text ?? "",
    post_type: postType,
    thread_posts: postType === "thread"
      ? threadPosts.map((p, i) => ({ position: i + 1, text: p.text, char_count: p.text.length }))
      : [],
    hook_score: scores.hookStrength,
    estimated_reach: scores.estimatedReach,
    media: attachedMedia.map((m) => ({ asset_id: m.asset_id, media_type: m.media_type })),
  });

  const handleSaveDraft = async (): Promise<string | null> => {
    setSaving("draft");
    try {
      const id = await onSaveDraft(buildPayload());
      setSavedId(id);
      return id;
    } finally { setSaving(null); }
  };

  const handleSubmitApproval = async () => {
    setSaving("approval");
    try {
      const id = await onSaveDraft(buildPayload());
      if (id) await onSubmitApproval(id);
    } finally { setSaving(null); }
  };

  const scoreColor = (v: number) => v >= 70 ? "#00ff88" : v >= 45 ? "#ff9500" : "#64748b";

  return (
    <div className="flex gap-4 h-full">

      {/* ── Left Rail: Media Library + Hook Bank ─────────────────────── */}
      <div className="w-52 shrink-0 flex flex-col gap-3 overflow-hidden min-h-0">

        {/* ── Media Library ── */}
        <div className="rounded-lg border border-white/8 bg-white/3 flex flex-col overflow-hidden min-h-0 flex-1">
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/6 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                ◫ MEDIA LIBRARY
              </span>
              {attachedMedia.length > 0 && (
                <span className="text-[10px] font-mono font-bold text-[#00ff88]">
                  {attachedMedia.length}/4 added
                </span>
              )}
            </div>
            {/* Search */}
            <div className="relative mb-2">
              <input
                type="text"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-white/6 border border-white/10 rounded px-2.5 py-1.5 text-[10px] text-white/70 placeholder-white/20 font-mono focus:outline-none focus:border-white/20 pr-6"
              />
              {assetSearch && (
                <button
                  onClick={() => setAssetSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
            {/* Filter tabs */}
            <div className="flex gap-1">
              {(["all", "image", "video"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAssetFilter(f)}
                  className={`flex-1 py-1 rounded text-[9px] font-mono uppercase transition-all ${
                    assetFilter === f
                      ? "bg-[#00ff88]/15 text-[#00ff88]/80 border border-[#00ff88]/20"
                      : "text-white/25 hover:text-white/45 border border-transparent"
                  }`}
                >
                  {f === "all" ? "All" : f === "image" ? "IMG" : "VID"}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {assetsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-white/10 border-t-[#00ff88]/60 rounded-full animate-spin" />
              </div>
            ) : (() => {
              const filtered = assets.filter((a) => {
                const matchesType = assetFilter === "all" || a.media_type === assetFilter;
                const matchesSearch = !assetSearch || a.filename.toLowerCase().includes(assetSearch.toLowerCase()) || (a.ai_keywords ?? []).some((k) => k.toLowerCase().includes(assetSearch.toLowerCase()));
                return matchesType && matchesSearch;
              });
              if (filtered.length === 0) return (
                <div className="text-center py-6 space-y-2">
                  <div className="text-[10px] font-mono text-white/20">
                    {assetSearch ? "No matches" : "Library empty"}
                  </div>
                  {!assetSearch && (
                    <a href="/assets" target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-[#00d4ff]/50 hover:text-[#00d4ff]/80 underline block">
                      Sync library →
                    </a>
                  )}
                </div>
              );
              return (
                <div className="grid grid-cols-2 gap-1.5">
                  {filtered.map((asset) => {
                    const isAttached = attachedMedia.some((m) => m.asset_id === asset.id);
                    const canAdd = isAttached || attachedMedia.length < 4;
                    return (
                      <button
                        key={asset.id}
                        onClick={() => isAttached ? detachMedia(asset.id) : attachMedia(asset)}
                        disabled={!canAdd}
                        title={asset.filename}
                        className={`group relative rounded overflow-hidden aspect-square transition-all disabled:opacity-25 ${
                          isAttached
                            ? "ring-2 ring-[#00ff88] ring-offset-1 ring-offset-[#0d1117]"
                            : "ring-1 ring-white/8 hover:ring-white/25"
                        }`}
                      >
                        {asset.media_type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${API_BASE}/assets/${asset.id}/thumb?size=160`}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).src = `${API_BASE}/assets/${asset.id}/file`; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/5">
                            <span className="text-[#ff2d55]/70 text-xl">▶</span>
                          </div>
                        )}
                        {/* Attached overlay */}
                        {isAttached && (
                          <div className="absolute inset-0 bg-[#00ff88]/20 flex items-center justify-center">
                            <div className="w-5 h-5 rounded-full bg-[#00ff88] flex items-center justify-center">
                              <span className="text-black text-[10px] font-bold">✓</span>
                            </div>
                          </div>
                        )}
                        {/* Hover: show filename */}
                        {!isAttached && (
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="text-[8px] text-white/70 truncate font-mono leading-tight">
                              {asset.filename.replace(/\.[^/.]+$/, "")}
                            </div>
                          </div>
                        )}
                        {/* Max reached overlay */}
                        {!isAttached && !canAdd && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[9px] font-mono text-white/40">FULL</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Attached strip */}
          {attachedMedia.length > 0 && (
            <div className="border-t border-white/6 px-2 py-2 shrink-0">
              <div className="text-[9px] font-mono text-white/25 uppercase mb-1.5">Attached to post</div>
              <div className="flex gap-1.5 flex-wrap">
                {attachedMedia.map((m) => (
                  <div key={m.asset_id} className="group relative w-10 h-10 rounded overflow-hidden ring-1 ring-[#00ff88]/40">
                    {m.media_type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${API_BASE}/assets/${m.asset_id}/thumb?size=80`} alt={m.filename} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5 text-[#ff2d55] text-xs">▶</div>
                    )}
                    <button
                      onClick={() => detachMedia(m.asset_id)}
                      className="absolute inset-0 bg-black/60 text-white/80 text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Hook Bank ── */}
        <div className="rounded-lg border border-white/8 bg-white/3 overflow-hidden shrink-0">
          <div className="px-3 py-2 border-b border-white/6 text-[10px] font-mono text-white/30 uppercase tracking-wider">
            HOOK BANK
          </div>
          <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
            {hooks.slice(0, 5).map((hook) => (
              <div key={hook.id} className="p-2.5">
                <div className="text-[10px] text-white/60 leading-tight mb-1.5 line-clamp-2 italic">
                  &ldquo;{hook.hook_text.slice(0, 60)}&rdquo;
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-[#a78bfa]/60">{hook.hook_category}</span>
                  <button
                    onClick={() => insertAtCursor(hook.hook_text)}
                    className="text-[9px] font-mono text-[#00d4ff]/60 hover:text-[#00d4ff] transition-colors"
                  >
                    INSERT →
                  </button>
                </div>
              </div>
            ))}
            {hooks.length === 0 && (
              <div className="px-3 py-4 text-[10px] font-mono text-white/20 text-center">No hooks</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Center: Editor ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

        {/* Editor */}
        <div className="rounded-lg border border-white/10 bg-white/3 flex-1 flex flex-col overflow-hidden">
          {postType === "single" ? (
            /* Single post editor */
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">COMPOSE</span>
                <CharRing count={content.length} />
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening in the forests right now?

Start with a hook: a number, a question, or a bold claim.

Example:
'7 million hectares of forest burned this year. Here's what nobody is telling you 🧵'"
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white/85 placeholder-white/15 resize-none focus:outline-none leading-relaxed"
                maxLength={580}
              />
              {/* Attached media count indicator */}
              {attachedMedia.length > 0 && (
                <div className="px-4 py-1.5 border-t border-white/6 flex items-center gap-2">
                  <span className="text-[9px] font-mono text-[#00ff88]/60">
                    ◫ {attachedMedia.length} media attached
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {attachedMedia.map((m) => (
                      <span key={m.asset_id} className="text-[8px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                        {m.filename.replace(/\.[^/.]+$/, "").slice(0, 10)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested hashtags */}
              <div className="px-4 py-2 border-t border-white/6 flex items-center gap-2 flex-wrap">
                {["#Reforestation", "#ClimateAction", "#Forest", "#TreePlanting", "#Conservation"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setContent((c) => c + " " + tag)}
                    className="text-[10px] font-mono text-[#00d4ff]/50 hover:text-[#00d4ff]/80 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Thread editor */
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6 sticky top-0 bg-white/3 z-10">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                  THREAD · {threadPosts.length} POSTS
                </span>
                <div className="flex items-center gap-2 text-[9px] font-mono text-white/25">
                  {THREAD_FLOW.map((label, i) => (
                    <span key={label} className={i < threadPosts.length ? "text-[#00ff88]/70" : ""}>
                      {label}{i < THREAD_FLOW.length - 1 ? " →" : ""}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col divide-y divide-white/5">
                {threadPosts.map((post, index) => (
                  <div key={post.id} className="flex gap-3 p-3.5">
                    {/* Position indicator */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold font-mono"
                        style={{
                          background: index === 0 ? "rgba(255,45,85,0.15)" : "rgba(255,255,255,0.06)",
                          color: index === 0 ? "#ff2d55" : "#ffffff60",
                          border: `1px solid ${index === 0 ? "rgba(255,45,85,0.3)" : "rgba(255,255,255,0.1)"}`,
                        }}
                      >
                        {index + 1}
                      </div>
                      {index < threadPosts.length - 1 && (
                        <div className="w-px flex-1 bg-white/10 my-1 min-h-4" />
                      )}
                    </div>

                    {/* Text area */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-mono text-white/20 mb-1 uppercase">
                        {THREAD_FLOW[index] ?? `Post ${index + 1}`}
                      </div>
                      <textarea
                        value={post.text}
                        onChange={(e) => updateThreadPost(post.id, e.target.value)}
                        placeholder={
                          index === 0 ? "Hook: Start with a bold claim, question, or number..."
                          : index === threadPosts.length - 1 ? "CTA: Ask for reposts, follows, or replies..."
                          : "Continue the narrative..."
                        }
                        rows={3}
                        className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/15 resize-none focus:outline-none focus:border-white/20 transition-all leading-relaxed"
                        maxLength={280}
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] font-mono text-white/20">{post.text.length}/280</span>
                        {index > 0 && (
                          <button onClick={() => removeThreadPost(post.id)} className="text-[9px] font-mono text-white/20 hover:text-[#ff2d55]/70 transition-colors">
                            REMOVE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-white/6">
                <button
                  onClick={addThreadPost}
                  disabled={threadPosts.length >= 12}
                  className="w-full py-2 rounded-lg border border-dashed border-white/15 text-[11px] font-mono text-white/30 hover:border-white/25 hover:text-white/50 transition-all disabled:opacity-30"
                >
                  + ADD POST ({threadPosts.length}/12)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={saving !== null}
            className="px-3 py-2 rounded-lg border border-white/12 text-[11px] font-mono text-white/40 hover:border-white/22 hover:text-white/60 transition-all disabled:opacity-40"
          >
            {saving === "draft" ? "SAVING..." : "SAVE DRAFT"}
          </button>

          <button
            onClick={handleSubmitApproval}
            disabled={saving !== null || (postType === "single" ? content.trim().length < 10 : threadPosts[0]?.text.trim().length < 10)}
            className="px-3 py-2 rounded-lg border border-[#ff9500]/30 text-[11px] font-mono text-[#ff9500]/70 hover:bg-[#ff9500]/10 transition-all disabled:opacity-40"
          >
            {saving === "approval" ? "SUBMITTING..." : "SUBMIT FOR APPROVAL"}
          </button>

          {/* Schedule toggle */}
          <div className="relative">
            <button
              onClick={() => setShowSchedule((s) => !s)}
              className="px-3 py-2 rounded-lg border border-[#00d4ff]/30 text-[11px] font-mono text-[#00d4ff]/70 hover:bg-[#00d4ff]/10 transition-all"
            >
              SCHEDULE
            </button>
            {showSchedule && (
              <div className="absolute bottom-10 left-0 z-10 bg-[#0d1117] border border-white/15 rounded-lg p-3 flex items-center gap-2 shadow-xl">
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="bg-white/8 border border-white/12 rounded px-2 py-1 text-[11px] text-white/70 font-mono focus:outline-none"
                />
                <button
                  onClick={async () => {
                    if (!scheduleTime || saving) return;
                    setSaving("schedule");
                    try {
                      const id = await onSaveDraft(buildPayload());
                      if (id) {
                        setSavedId(id);
                        await onSchedule(id, scheduleTime);
                      }
                      setShowSchedule(false);
                      setScheduleTime("");
                    } finally { setSaving(null); }
                  }}
                  className="px-2 py-1 rounded bg-[#00d4ff]/20 text-[#00d4ff] text-[10px] font-mono hover:bg-[#00d4ff]/30 transition-all"
                >
                  {saving === "schedule" ? "..." : "CONFIRM"}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => onMultiply(buildPayload())}
            disabled={postType === "single" ? content.trim().length < 10 : threadPosts[0]?.text.trim().length < 10}
            className="ml-auto px-3 py-2 rounded-lg text-[11px] font-mono font-semibold transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#a78bfa,#00d4ff)", color: "#000" }}
          >
            ⊕ MULTIPLY CONTENT
          </button>
        </div>
      </div>

      {/* ── Right Rail: Viral Intelligence ────────────────────────────── */}
      <div className="w-52 shrink-0 space-y-3 overflow-y-auto">
        {/* Score panel */}
        <div className="rounded-lg border border-white/8 bg-white/3 p-4 space-y-3">
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider flex items-center justify-between">
            VIRAL INTELLIGENCE
            <div className="flex items-center gap-2">
              {scores.estimatedReach > 0 && (
                <span className="text-[#00ff88] animate-pulse text-[9px]">● LIVE</span>
              )}
              <button
                onClick={() => setShowPreview((s) => !s)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all ${
                  showPreview
                    ? "border-[#1d9bf0]/40 text-[#1d9bf0]/80 bg-[#1d9bf0]/10"
                    : "border-white/12 text-white/25 hover:border-white/22 hover:text-white/45"
                }`}
              >
                {showPreview ? "HIDE" : "PREVIEW"}
              </button>
            </div>
          </div>

          <ScoreBar label="Hook Strength"   value={scores.hookStrength}   color="#ff2d55" tip="Measures how likely the first line stops scrolling. Patterns: numbers, questions, bold claims." />
          <ScoreBar label="Narrative Power" value={scores.narrativePower} color="#00ff88" tip="Keyword richness for environmental/conservation topics. More specific = higher score." />
          <ScoreBar label="Clarity"         value={scores.clarity}        color="#00d4ff" tip="Short sentences and clear structure improve this score. Aim for <20 words per sentence." />
          <ScoreBar label="Shareability"    value={scores.shareability}   color="#fbbf24" tip="Emotion words, CTAs (repost, share, follow), and hashtags boost shareability." />

          <div className="border-t border-white/8 pt-3">
            <div className="text-[9px] font-mono text-white/25 uppercase mb-1">EST. REACH</div>
            <div className="text-xl font-bold font-mono" style={{ color: scoreColor(Math.round((scores.hookStrength + scores.narrativePower + scores.clarity + scores.shareability) / 4)) }}>
              {scores.estimatedReach >= 1000 ? `${(scores.estimatedReach / 1000).toFixed(1)}K` : scores.estimatedReach}
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/5 p-3 space-y-2">
            <div className="text-[9px] font-mono text-[#fbbf24]/70 uppercase tracking-wider">SUGGESTIONS</div>
            {suggestions.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[#fbbf24]/50 mt-0.5 shrink-0">→</span>
                <span className="text-[10px] text-white/50 leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        )}

        {/* Live Post Preview */}
        {showPreview && (
          <XPostPreview
            content={content}
            postType={postType}
            threadPosts={postType === "thread" ? threadPosts.map((p, i) => ({ position: i + 1, text: p.text })) : []}
            attachedMedia={attachedMedia}
            hookScore={scores.hookStrength}
            estimatedReach={scores.estimatedReach}
          />
        )}

      </div>
    </div>
  );
}
