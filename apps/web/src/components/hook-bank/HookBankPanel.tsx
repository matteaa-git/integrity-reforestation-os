"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hook, HookCategory, HookFormat } from "@/lib/api";
import {
  fetchHooks,
  createHook,
  updateHook,
  deleteHook,
  useHook,
  toggleHookFavorite,
  generateHooks,
} from "@/lib/api";

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES: { key: HookCategory; label: string; color: string; icon: string }[] = [
  { key: "curiosity",       label: "Curiosity",       color: "bg-violet-500/20 text-violet-300 border-violet-500/30",  icon: "?" },
  { key: "shock",           label: "Shock",           color: "bg-red-500/20 text-red-300 border-red-500/30",           icon: "!" },
  { key: "authority",       label: "Authority",       color: "bg-blue-500/20 text-blue-300 border-blue-500/30",        icon: "◈" },
  { key: "story",           label: "Story",           color: "bg-amber-500/20 text-amber-300 border-amber-500/30",     icon: "◎" },
  { key: "contrarian",      label: "Contrarian",      color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: "↯" },
  { key: "transformation",  label: "Transform",       color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: "→" },
];

const SORT_OPTIONS = [
  { value: "performance_score", label: "Performance" },
  { value: "times_used",        label: "Most Used" },
  { value: "saves",             label: "Most Saved" },
  { value: "created_at",        label: "Newest" },
];

const EMOTIONS = ["inspiring", "educational", "urgent", "surprising", "authentic", "provocative", "hopeful", "alarming"];

function getCategoryMeta(cat: HookCategory) {
  return CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[0];
}

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-white/40";
}

// ── Types ──────────────────────────────────────────────────────────────────

interface HookBankPanelProps {
  /**
   * When provided, activates "Insert" mode — clicking a hook calls this
   * instead of navigating away. Used when embedded in the carousel builder.
   */
  onInsertHook?: (hookText: string, hook: Hook) => void;
  /** Pre-filter by topic (e.g. from carousel meta.topic) */
  initialTopic?: string;
  /** Compact layout for sidebar embedding */
  compact?: boolean;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function HookCard({
  hook,
  onInsert,
  onToggleFavorite,
  onEdit,
  onDelete,
  onRecordUse,
  compact,
}: {
  hook: Hook;
  onInsert?: (hook: Hook) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (hook: Hook) => void;
  onDelete: (id: string) => void;
  onRecordUse: (id: string) => void;
  compact?: boolean;
}) {
  const meta = getCategoryMeta(hook.hook_category);
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`group relative rounded-xl border transition-all ${
        compact ? "p-2.5" : "p-3.5"
      } bg-white/3 border-white/8 hover:bg-white/5 hover:border-white/15`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Top row: category + score + favorite */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${meta.color}`}>
          <span>{meta.icon}</span>
          {meta.label}
        </span>
        <span className={`text-[10px] font-mono font-bold ml-auto ${scoreColor(hook.performance_score)}`}>
          {hook.performance_score.toFixed(0)}
        </span>
        <button
          onClick={() => onToggleFavorite(hook.id)}
          className={`text-[12px] transition-colors ${
            hook.is_favorite ? "text-amber-400" : "text-white/20 hover:text-amber-400/60"
          }`}
          title={hook.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          ★
        </button>
      </div>

      {/* Hook text */}
      <p className={`text-white/80 leading-snug font-medium ${compact ? "text-[11px]" : "text-[12px]"}`}>
        {hook.hook_text}
      </p>

      {/* Tags */}
      {!compact && hook.topic_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {hook.topic_tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[8px] bg-white/5 text-white/35 px-1.5 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[9px] text-white/30 flex items-center gap-0.5">
          <span className="opacity-60">↑</span> {hook.times_used} used
        </span>
        <span className="text-[9px] text-white/30 flex items-center gap-0.5">
          <span className="opacity-60">♡</span> {hook.saves}
        </span>
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ml-auto ${
          hook.format === "universal"
            ? "bg-white/5 text-white/25"
            : "bg-white/8 text-white/40"
        }`}>
          {hook.format}
        </span>
      </div>

      {/* Action bar (shown on hover) */}
      {(showActions || compact) && (
        <div className={`flex gap-1 mt-2.5 pt-2.5 border-t border-white/5 ${compact ? "" : ""}`}>
          {onInsert && (
            <button
              onClick={() => { onRecordUse(hook.id); onInsert(hook); }}
              className="flex-1 py-1.5 rounded-lg bg-[#39de8b]/15 hover:bg-[#39de8b]/25 text-[#39de8b] text-[10px] font-semibold transition-colors"
            >
              ↗ Insert
            </button>
          )}
          <button
            onClick={() => onEdit(hook)}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 text-[10px] transition-colors"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(hook.id)}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-red-900/30 text-white/30 hover:text-red-400 text-[10px] transition-colors"
            title="Delete"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ── Edit / Create modal ────────────────────────────────────────────────────

function HookEditModal({
  hook,
  onSave,
  onClose,
}: {
  hook: Partial<Hook> | null;
  onSave: (data: Partial<Hook>) => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !hook?.id;
  const [text, setText] = useState(hook?.hook_text ?? "");
  const [category, setCategory] = useState<HookCategory>(hook?.hook_category ?? "curiosity");
  const [format, setFormat] = useState<HookFormat>(hook?.format ?? "carousel");
  const [topicTagsRaw, setTopicTagsRaw] = useState((hook?.topic_tags ?? []).join(", "));
  const [emotionTagsRaw, setEmotionTagsRaw] = useState((hook?.emotion_tags ?? []).join(", "));
  const [score, setScore] = useState(hook?.performance_score ?? 50);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await onSave({
      hook_text: text.trim(),
      hook_category: category,
      format,
      topic_tags: topicTagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
      emotion_tags: emotionTagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
      performance_score: score,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[480px] bg-[#16162b] border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[13px] font-bold text-white">{isNew ? "Add Hook" : "Edit Hook"}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg transition-colors">×</button>
        </div>

        <div className="space-y-4">
          {/* Hook text */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block mb-1.5">
              Hook Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Write your hook here..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] text-white placeholder-white/20 resize-none focus:outline-none focus:border-[#39de8b]/50"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                    category === c.key ? c.color : "bg-white/3 border-white/8 text-white/40 hover:text-white/60"
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format + Score row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block mb-1.5">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as HookFormat)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-[#39de8b]/50"
              >
                {(["carousel", "reel", "story", "universal"] as HookFormat[]).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block mb-1.5">
                Score ({score})
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block mb-1.5">
                Topic Tags
              </label>
              <input
                type="text"
                value={topicTagsRaw}
                onChange={(e) => setTopicTagsRaw(e.target.value)}
                placeholder="reforestation, climate..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-[#39de8b]/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wide block mb-1.5">
                Emotion Tags
              </label>
              <input
                type="text"
                value={emotionTagsRaw}
                onChange={(e) => setEmotionTagsRaw(e.target.value)}
                placeholder="inspiring, urgent..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-[#39de8b]/50"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-[11px] font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="flex-1 py-2 rounded-xl bg-[#39de8b] hover:bg-[#2bc777] disabled:opacity-40 text-[#002a27] text-[11px] font-bold transition-colors"
          >
            {saving ? "Saving..." : isNew ? "Add to Bank" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Generator panel ─────────────────────────────────────────────────────

function AIGeneratorPanel({
  onGenerated,
  initialTopic,
}: {
  onGenerated: (hooks: Hook[]) => void;
  initialTopic?: string;
}) {
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [emotion, setEmotion] = useState("inspiring");
  const [contentType, setContentType] = useState("carousel");
  const [category, setCategory] = useState<HookCategory | "">("");
  const [count, setCount] = useState(5);
  const [saveToBank, setSaveToBank] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateHooks({
        topic: topic.trim(),
        emotion,
        content_type: contentType,
        hook_category: category || undefined,
        count,
        save_to_bank: saveToBank,
      });
      onGenerated(result.hooks);
    } catch {
      setError("Generation failed. Make sure the API is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5">
        <div>
          <label className="text-[9px] font-semibold text-white/40 uppercase tracking-wide block mb-1">
            Topic *
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. reforestation, climate action..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-[#39de8b]/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-semibold text-white/40 uppercase tracking-wide block mb-1">
              Emotion
            </label>
            <select
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white focus:outline-none focus:border-[#39de8b]/50"
            >
              {EMOTIONS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-semibold text-white/40 uppercase tracking-wide block mb-1">
              Content Type
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white focus:outline-none focus:border-[#39de8b]/50"
            >
              <option value="carousel">Carousel</option>
              <option value="reel">Reel</option>
              <option value="story">Story</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-semibold text-white/40 uppercase tracking-wide block mb-1">
              Category (optional)
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as HookCategory | "")}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-[11px] text-white focus:outline-none focus:border-[#39de8b]/50"
            >
              <option value="">Any</option>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-semibold text-white/40 uppercase tracking-wide block mb-1">
              Count ({count})
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveToBank}
            onChange={(e) => setSaveToBank(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#39de8b]"
          />
          <span className="text-[10px] text-white/50">Save generated hooks to bank</span>
        </label>
      </div>

      {error && (
        <div className="text-[10px] text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !topic.trim()}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-[#39de8b] hover:from-violet-500 hover:to-[#2bc777] disabled:opacity-40 text-white text-[11px] font-bold transition-all"
      >
        {loading ? "Generating..." : "✦ Generate Hooks"}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function HookBankPanel({
  onInsertHook,
  initialTopic,
  compact = false,
}: HookBankPanelProps) {
  // ── State ──
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<HookCategory | "">("");
  const [filterTopic, setFilterTopic] = useState(initialTopic ?? "");
  const [filterEmotion, setFilterEmotion] = useState("");
  const [filterMinScore, setFilterMinScore] = useState<number | "">("");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [sortBy, setSortBy] = useState("performance_score");
  const [editingHook, setEditingHook] = useState<Partial<Hook> | null | false>(false); // false = closed
  const [generatedHooks, setGeneratedHooks] = useState<Hook[]>([]);
  const [activeTab, setActiveTab] = useState<"bank" | "generate">("bank");

  // ── Load hooks ──
  const loadHooks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchHooks({
        category: filterCategory || undefined,
        topic: filterTopic || undefined,
        emotion: filterEmotion || undefined,
        min_score: filterMinScore !== "" ? filterMinScore : undefined,
        search: search || undefined,
        favorites_only: filterFavorites,
        sort_by: sortBy,
        limit: 100,
      });
      setHooks(result.hooks);
    } catch {
      // API not running — show empty state
      setHooks([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterTopic, filterEmotion, filterMinScore, search, filterFavorites, sortBy]);

  useEffect(() => {
    loadHooks();
  }, [loadHooks]);

  // Update topic filter when prop changes
  useEffect(() => {
    if (initialTopic) setFilterTopic(initialTopic);
  }, [initialTopic]);

  // ── Actions ──
  const handleToggleFavorite = async (id: string) => {
    await toggleHookFavorite(id);
    setHooks((prev) =>
      prev.map((h) => (h.id === id ? { ...h, is_favorite: !h.is_favorite } : h))
    );
    setGeneratedHooks((prev) =>
      prev.map((h) => (h.id === id ? { ...h, is_favorite: !h.is_favorite } : h))
    );
  };

  const handleDelete = async (id: string) => {
    await deleteHook(id);
    setHooks((prev) => prev.filter((h) => h.id !== id));
    setGeneratedHooks((prev) => prev.filter((h) => h.id !== id));
  };

  const handleRecordUse = async (id: string) => {
    const result = await useHook(id);
    setHooks((prev) =>
      prev.map((h) => (h.id === id ? { ...h, times_used: result.times_used } : h))
    );
  };

  const handleSaveEdit = async (data: Partial<Hook>) => {
    if (!editingHook) return;
    if ((editingHook as Hook).id) {
      const updated = await updateHook((editingHook as Hook).id, data);
      setHooks((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    } else {
      const created = await createHook(data as Parameters<typeof createHook>[0]);
      setHooks((prev) => [created, ...prev]);
    }
    setEditingHook(false);
  };

  const handleInsert = (hook: Hook) => {
    onInsertHook?.(hook.hook_text, hook);
  };

  const handleGeneratedHooks = (newHooks: Hook[]) => {
    setGeneratedHooks(newHooks);
    setActiveTab("bank"); // show results in bank view
    if (newHooks.some((h) => h.id)) {
      // Some were saved — reload
      loadHooks();
    } else {
      // Not saved — prepend to view
      setHooks((prev) => [...newHooks, ...prev]);
    }
  };

  const displayHooks = hooks;
  const favCount = hooks.filter((h) => h.is_favorite).length;
  const topHooks = [...hooks].sort((a, b) => b.performance_score - a.performance_score).slice(0, 3);

  return (
    <div className={`flex flex-col h-full bg-[#0e0e1a] ${compact ? "" : ""}`}>
      {/* ── Header ── */}
      <div className={`shrink-0 ${compact ? "px-3 pt-3 pb-2" : "px-5 pt-5 pb-3"} border-b border-white/5`}>
        {!compact && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-bold text-white">Hook Bank</h1>
              <p className="text-[10px] text-white/40 mt-0.5">
                {hooks.length} hooks · {favCount} favorited
              </p>
            </div>
            <button
              onClick={() => setEditingHook({})}
              className="px-3 py-1.5 rounded-xl bg-[#39de8b]/15 hover:bg-[#39de8b]/25 text-[#39de8b] text-[10px] font-bold transition-colors border border-[#39de8b]/20"
            >
              + Add Hook
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-3">
          <button
            onClick={() => setActiveTab("bank")}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
              activeTab === "bank"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            ◈ Bank ({hooks.length})
          </button>
          <button
            onClick={() => setActiveTab("generate")}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
              activeTab === "generate"
                ? "bg-gradient-to-r from-violet-600/40 to-emerald-600/30 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            ✦ AI Generate
          </button>
        </div>

        {activeTab === "bank" && (
          <>
            {/* Search */}
            <div className="relative mb-2">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-[10px]">⌕</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hooks..."
                className="w-full bg-white/5 border border-white/8 rounded-lg pl-7 pr-3 py-2 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#39de8b]/40"
              />
            </div>

            {/* Category filter pills */}
            <div className="flex flex-wrap gap-1 mb-2">
              <button
                onClick={() => setFilterCategory("")}
                className={`px-2 py-0.5 rounded-full text-[8px] font-semibold border transition-colors ${
                  filterCategory === ""
                    ? "bg-white/15 text-white border-white/20"
                    : "bg-white/3 text-white/35 border-white/8 hover:text-white/55"
                }`}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilterCategory(filterCategory === c.key ? "" : c.key)}
                  className={`px-2 py-0.5 rounded-full text-[8px] font-semibold border transition-colors ${
                    filterCategory === c.key
                      ? c.color
                      : "bg-white/3 text-white/35 border-white/8 hover:text-white/55"
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {/* Secondary filters row */}
            <div className="flex gap-1.5 flex-wrap">
              <input
                type="text"
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                placeholder="Topic..."
                className="flex-1 min-w-[80px] bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-[10px] text-white placeholder-white/25 focus:outline-none focus:border-[#39de8b]/40"
              />
              <select
                value={filterEmotion}
                onChange={(e) => setFilterEmotion(e.target.value)}
                className="flex-1 min-w-[80px] bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-[#39de8b]/40"
              >
                <option value="">Any emotion</option>
                {EMOTIONS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <select
                value={filterMinScore}
                onChange={(e) => setFilterMinScore(e.target.value === "" ? "" : Number(e.target.value))}
                className="bg-white/4 border border-white/8 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-[#39de8b]/40"
              >
                <option value="">Any score</option>
                <option value="85">≥ 85</option>
                <option value="75">≥ 75</option>
                <option value="65">≥ 65</option>
              </select>
            </div>

            {/* Sort + favorites toggle */}
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterFavorites}
                  onChange={(e) => setFilterFavorites(e.target.checked)}
                  className="w-3 h-3 rounded accent-amber-400"
                />
                <span className="text-[9px] text-white/40">Favorites only</span>
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white/4 border border-white/8 rounded-lg px-2 py-1 text-[9px] text-white/50 focus:outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "generate" ? (
          <div className={`${compact ? "p-3" : "p-4"}`}>
            <AIGeneratorPanel onGenerated={handleGeneratedHooks} initialTopic={filterTopic || initialTopic} />
          </div>
        ) : (
          <div className={`${compact ? "p-2" : "p-4"} space-y-2`}>
            {/* Top performers banner (non-compact only) */}
            {!compact && !filterCategory && !search && topHooks.length > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-amber-500/8 to-transparent border border-amber-500/15 p-3 mb-3">
                <div className="text-[9px] font-bold text-amber-400/70 uppercase tracking-widest mb-1.5">
                  ★ Top Performers
                </div>
                <div className="space-y-1">
                  {topHooks.map((h) => (
                    <div key={h.id} className="flex items-start gap-2">
                      <span className={`text-[9px] font-mono font-bold shrink-0 mt-0.5 ${scoreColor(h.performance_score)}`}>
                        {h.performance_score.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-white/60 leading-snug truncate">{h.hook_text}</span>
                      {onInsertHook && (
                        <button
                          onClick={() => { handleRecordUse(h.id); handleInsert(h); }}
                          className="shrink-0 text-[8px] px-1.5 py-0.5 rounded-md bg-[#39de8b]/15 text-[#39de8b] hover:bg-[#39de8b]/25 transition-colors"
                        >
                          ↗
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="text-[11px] text-white/25 animate-pulse">Loading hooks...</div>
              </div>
            ) : displayHooks.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-2xl text-white/10 mb-2">⚡</div>
                <div className="text-[11px] text-white/30">No hooks found</div>
                <div className="text-[9px] text-white/20 mt-1">
                  {search || filterCategory ? "Try clearing filters" : "Make sure the API is running"}
                </div>
              </div>
            ) : (
              displayHooks.map((hook) => (
                <HookCard
                  key={hook.id}
                  hook={hook}
                  compact={compact}
                  onInsert={onInsertHook ? handleInsert : undefined}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={(h) => setEditingHook(h)}
                  onDelete={handleDelete}
                  onRecordUse={handleRecordUse}
                />
              ))
            )}

            {!compact && (
              <button
                onClick={() => setEditingHook({})}
                className="w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-white/25 text-[10px] text-white/30 hover:text-white/50 transition-colors mt-2"
              >
                + Add a new hook
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit / Create modal */}
      {editingHook !== false && (
        <HookEditModal
          hook={editingHook || null}
          onSave={handleSaveEdit}
          onClose={() => setEditingHook(false)}
        />
      )}
    </div>
  );
}
