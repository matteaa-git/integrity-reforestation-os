"use client";

import { useState, useEffect, useCallback } from "react";
import LinkedInPreview from "./LinkedInPreview";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHAR_LIMIT = 3000;

const POST_TYPES = [
  { value: "text",     label: "Text",     icon: "T" },
  { value: "article",  label: "Article",  icon: "✍" },
  { value: "poll",     label: "Poll",     icon: "◎" },
  { value: "document", label: "Document", icon: "📄" },
  { value: "image",    label: "Image",    icon: "▣" },
  { value: "video",    label: "Video",    icon: "▶" },
];

const HOOK_BANK = [
  {
    type: "story",
    label: "Story Opener",
    icon: "📖",
    score: 88,
    template:
      "3 years ago, I made a mistake that cost us everything.\n\nHere's what I learned (and why it made us stronger):\n\n",
  },
  {
    type: "statistic",
    label: "Statistic Hook",
    icon: "📊",
    score: 84,
    template:
      "Most people don't know this about reforestation:\n\n[Insert your data point here]\n\nHere's why it changes everything:\n\n",
  },
  {
    type: "controversial",
    label: "Controversial Take",
    icon: "⚡",
    score: 91,
    template:
      "Unpopular opinion:\n\nTree planting programs alone won't save us.\n\nHere's what actually works:\n\n",
  },
  {
    type: "question",
    label: "Question Hook",
    icon: "❓",
    score: 79,
    template:
      "What if everything we know about forest restoration is wrong?\n\nI've spent 10 years in the field. Here's what the data shows:\n\n",
  },
  {
    type: "achievement",
    label: "Achievement",
    icon: "🏆",
    score: 76,
    template:
      "We just crossed a milestone I never thought possible.\n\n[Describe the achievement]\n\nHere's what made the difference:\n\n",
  },
  {
    type: "observation",
    label: "Observation",
    icon: "🔍",
    score: 72,
    template:
      "After 10 years restoring California's fire zones, here's what almost no one talks about:\n\n",
  },
  {
    type: "list",
    label: "List Hook",
    icon: "📋",
    score: 82,
    template:
      "7 things I wish I knew before leading a reforestation crew:\n\n1. \n2. \n3. \n\n",
  },
  {
    type: "failure",
    label: "Failure Story",
    icon: "💡",
    score: 86,
    template:
      "I failed publicly in year one.\n\nIt was the best thing that happened to this organization.\n\nFull story:\n\n",
  },
];

const HASHTAG_SUGGESTIONS = [
  "#Reforestation",
  "#Conservation",
  "#ClimateAction",
  "#Sustainability",
  "#TreePlanting",
  "#ForestRestoration",
  "#EnvironmentalLeadership",
  "#Biodiversity",
  "#WildfireRecovery",
  "#GreenFuture",
  "#NatureBasedSolutions",
  "#CarbonCapture",
  "#ClimateSolution",
  "#EnvironmentalImpact",
];

const WRITING_SIGNALS = [
  { label: "Hook your reader in line 1", icon: "⚡", tip: "Only the first ~2 lines show before 'see more'" },
  { label: "Use short paragraphs", icon: "↕", tip: "LinkedIn readers skim — max 2-3 sentences per paragraph" },
  { label: "End with a question or CTA", icon: "❓", tip: "Drives comments and reach in the algorithm" },
  { label: "Post at peak hours", icon: "🕐", tip: "Tues–Thurs 7-9am and 12pm perform best" },
  { label: "3–5 hashtags is optimal", icon: "#", tip: "More than 5 hashtags can reduce reach" },
];

// ---------------------------------------------------------------------------
// Thought Leadership Score — computed client-side
// ---------------------------------------------------------------------------
function computeScore(content: string, hashtags: string[]): {
  hookStrength: number;
  expertiseSignal: number;
  narrativePower: number;
  readability: number;
  total: number;
} {
  if (!content.trim()) return { hookStrength: 0, expertiseSignal: 0, narrativePower: 0, readability: 0, total: 0 };

  const firstLine = content.split("\n")[0] ?? "";
  const words = content.split(/\s+/).filter(Boolean);
  const sentences = content.split(/[.!?]+/).filter(Boolean);
  const paragraphs = content.split(/\n\n+/).filter(Boolean);

  // Hook strength
  let hookStrength = 35;
  if (firstLine.endsWith("?")) hookStrength += 18;
  if (/^\d/.test(firstLine)) hookStrength += 18;
  if (firstLine.length > 30 && firstLine.length < 120) hookStrength += 12;
  if (/unpopular opinion|most people|mistake|secret|truth|fail|wrong/i.test(firstLine)) hookStrength += 17;
  hookStrength = Math.min(100, hookStrength);

  // Expertise signal
  let expertiseSignal = 25;
  const expertWords = ["reforestation", "conservation", "ecosystem", "biomass", "carbon", "watershed",
    "biodiversity", "wildfire", "restoration", "sustainability", "climate", "habitat", "planting",
    "seedling", "canopy", "deforestation", "native species"];
  expertiseSignal += Math.min(35, expertWords.filter(w => content.toLowerCase().includes(w)).length * 7);
  if (words.length > 80) expertiseSignal += 12;
  if (/\d+%|\d+ trees|\d+ acres|\d+ years|\d+k/i.test(content)) expertiseSignal += 18;
  if (hashtags.length >= 2) expertiseSignal += 10;
  expertiseSignal = Math.min(100, expertiseSignal);

  // Narrative power
  let narrativePower = 25;
  if (paragraphs.length >= 3) narrativePower += 20;
  if (paragraphs.length >= 5) narrativePower += 12;
  if (/I (remember|learned|discovered|realized|failed|succeeded|noticed)/i.test(content)) narrativePower += 20;
  if (sentences.length >= 5) narrativePower += 10;
  if (/\n\n/.test(content)) narrativePower += 13;
  narrativePower = Math.min(100, narrativePower);

  // Readability
  let readability = 40;
  const avgSentLen = words.length / Math.max(sentences.length, 1);
  if (avgSentLen < 20) readability += 20;
  if (avgSentLen < 15) readability += 10;
  if (paragraphs.length >= 2) readability += 15;
  if (content.includes("\n")) readability += 10;
  if (words.length >= 50 && words.length <= 400) readability += 5;
  readability = Math.min(100, readability);

  const total = Math.round((hookStrength + expertiseSignal + narrativePower + readability) / 4);
  return { hookStrength, expertiseSignal, narrativePower, readability, total };
}

function estimateReach(score: number, postType: string, visibility: string): number {
  const base = postType === "article" ? 3500 : postType === "document" ? 2800 : 2200;
  const sm = 0.5 + (score / 100) * 1.5;
  const vm = visibility === "public" ? 1.0 : 0.55;
  return Math.round(base * sm * vm);
}

// ---------------------------------------------------------------------------
// API helpers (inline to avoid separate file for now)
// ---------------------------------------------------------------------------
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function apiPost(path: string, body: unknown) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPatch(path: string, body: unknown) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ---------------------------------------------------------------------------
// Score bar sub-component
// ---------------------------------------------------------------------------
function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-text-tertiary">{label}</span>
        <span className="text-[9px] font-semibold text-text-secondary">{value}</span>
      </div>
      <div className="h-1 bg-surface-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            value >= 70 ? "bg-emerald-500" : value >= 45 ? "bg-amber-400" : "bg-gray-300"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Composer
// ---------------------------------------------------------------------------
interface SavedPost { id: string; status: string }

export default function LinkedInComposer() {
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("text");
  const [hookType, setHookType] = useState("story");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [savedPost, setSavedPost] = useState<SavedPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const scores = computeScore(content, hashtags);
  const reach = estimateReach(scores.total, postType, visibility);
  const charCount = content.length;
  const charLeft = CHAR_LIMIT - charCount;

  const flash = useCallback((text: string, kind: "success" | "error" = "success") => {
    setNotice({ text, kind });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  // Auto-save debounce
  useEffect(() => {
    if (!content.trim() || !savedPost) return;
    const t = setTimeout(async () => {
      try {
        await apiPatch(`/linkedin/${savedPost.id}`, {
          content,
          post_type: postType,
          hook_type: hookType,
          hashtags,
          visibility,
          thought_leadership_score: scores.total,
          estimated_reach: reach,
        });
      } catch { /* silent */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [content, postType, hookType, hashtags, visibility, scores.total, reach, savedPost]);

  const handleSaveDraft = async () => {
    if (!content.trim()) { flash("Write something first", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        content,
        post_type: postType,
        hook_type: hookType,
        hashtags,
        visibility,
        thought_leadership_score: scores.total,
        estimated_reach: reach,
      };
      if (savedPost) {
        await apiPatch(`/linkedin/${savedPost.id}`, payload);
      } else {
        const p = await apiPost("/linkedin/draft", payload);
        setSavedPost({ id: p.id, status: p.status });
      }
      flash("Draft saved");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!content.trim()) { flash("Write something first", "error"); return; }
    setSaving(true);
    try {
      let id = savedPost?.id;
      if (!id) {
        const p = await apiPost("/linkedin/draft", {
          content, post_type: postType, hook_type: hookType,
          hashtags, visibility, thought_leadership_score: scores.total, estimated_reach: reach,
        });
        id = p.id;
        setSavedPost({ id: p.id, status: "pending_approval" });
      }
      const p = await apiPost(`/linkedin/${id}/submit-approval`, {});
      setSavedPost({ id: p.id, status: p.status });
      flash("Submitted for review");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Submit failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!content.trim()) { flash("Write something first", "error"); return; }
    setPublishing(true);
    try {
      let id = savedPost?.id;
      if (!id) {
        const p = await apiPost("/linkedin/draft", {
          content, post_type: postType, hook_type: hookType,
          hashtags, visibility, thought_leadership_score: scores.total, estimated_reach: reach,
        });
        id = p.id;
      }
      const p = await apiPost(`/linkedin/${id}/publish`, {});
      setSavedPost({ id: p.id, status: "published" });
      flash("Published to LinkedIn");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Publish failed", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleTime || !content.trim()) return;
    setSaving(true);
    try {
      let id = savedPost?.id;
      if (!id) {
        const p = await apiPost("/linkedin/draft", {
          content, post_type: postType, hook_type: hookType,
          hashtags, visibility, thought_leadership_score: scores.total, estimated_reach: reach,
        });
        id = p.id;
      }
      const p = await apiPost(`/linkedin/${id}/schedule`, { scheduled_time: new Date(scheduleTime).toISOString() });
      setSavedPost({ id: p.id, status: p.status });
      setShowSchedule(false);
      flash(`Scheduled for ${new Date(scheduleTime).toLocaleString()}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Schedule failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const addHashtag = (tag: string) => {
    const t = tag.startsWith("#") ? tag : `#${tag}`;
    if (!hashtags.includes(t) && hashtags.length < 10) setHashtags([...hashtags, t]);
    setHashtagInput("");
  };

  const insertHook = (template: string) => {
    setContent(template);
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* ── Left: Hooks + Signals ── */}
      <div className="w-[240px] shrink-0 border-r border-border bg-white flex flex-col overflow-y-auto">
        <div className="p-3.5 border-b border-border-light">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2.5">
            Hook Bank
          </div>
          <div className="space-y-1.5">
            {HOOK_BANK.map((h) => (
              <button
                key={h.type}
                onClick={() => { insertHook(h.template); setHookType(h.type); }}
                className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/[0.02] transition-all group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{h.icon}</span>
                    <span className="text-[11px] font-semibold text-text-primary group-hover:text-primary transition-colors">
                      {h.label}
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold px-1 rounded ${
                    h.score >= 85 ? "bg-emerald-100 text-emerald-700" :
                    h.score >= 75 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {h.score}
                  </span>
                </div>
                <div className="text-[9px] text-text-tertiary leading-snug line-clamp-2">
                  {h.template.split("\n")[0]}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2.5">
            Writing Signals
          </div>
          <div className="space-y-2">
            {WRITING_SIGNALS.map((s) => (
              <div key={s.label} className="flex gap-2">
                <span className="text-[11px] shrink-0 mt-0.5 w-4 text-center text-text-tertiary">{s.icon}</span>
                <div>
                  <div className="text-[10px] font-medium text-text-secondary">{s.label}</div>
                  <div className="text-[9px] text-text-tertiary leading-snug">{s.tip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Center: Composer ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Notice banner */}
        {notice && (
          <div className={`shrink-0 px-5 py-2 flex items-center justify-between text-[11px] ${
            notice.kind === "success"
              ? "bg-emerald-50 border-b border-emerald-200 text-emerald-700"
              : "bg-red-50 border-b border-red-200 text-red-700"
          }`}>
            {notice.text}
            <button onClick={() => setNotice(null)} className="ml-3 opacity-60 hover:opacity-100">&times;</button>
          </div>
        )}

        <div className="flex-1 p-6 space-y-5 max-w-2xl mx-auto w-full">
          {/* Post type selector */}
          <div>
            <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
              Post Type
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setPostType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    postType === t.value
                      ? "bg-[#0a66c2] text-white shadow-sm"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  <span className="text-[12px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Composer textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
                Content
              </label>
              <span className={`text-[10px] font-mono ${
                charLeft < 200 ? "text-red-500 font-bold" : charLeft < 500 ? "text-amber-500" : "text-text-tertiary"
              }`}>
                {charCount.toLocaleString()} / {CHAR_LIMIT.toLocaleString()}
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, CHAR_LIMIT))}
              placeholder={`Start with a hook that stops the scroll…\n\nLinkedIn rewards authentic, specific, professional storytelling.\nBe concrete. Tell a story. End with a question or call-to-action.`}
              rows={14}
              className="w-full rounded-xl border border-border px-4 py-3 text-[13px] text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/20 focus:border-[#0a66c2] resize-none placeholder:text-text-tertiary/60"
            />
            {/* Character progress bar */}
            <div className="mt-1 h-0.5 rounded-full bg-surface-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  charLeft < 200 ? "bg-red-500" : charLeft < 500 ? "bg-amber-400" : "bg-[#0a66c2]"
                }`}
                style={{ width: `${(charCount / CHAR_LIMIT) * 100}%` }}
              />
            </div>
          </div>

          {/* Thought Leadership Score breakdown */}
          <div
            className="rounded-xl border border-border p-4 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
                Thought Leadership Score
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${
                  scores.total >= 75 ? "text-emerald-600" :
                  scores.total >= 50 ? "text-amber-600" : "text-text-tertiary"
                }`}>
                  {scores.total}
                </span>
                <span className="text-[10px] text-text-tertiary">{showScoreBreakdown ? "▲" : "▼"}</span>
              </div>
            </div>
            <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  scores.total >= 75 ? "bg-emerald-500" :
                  scores.total >= 50 ? "bg-amber-500" : "bg-gray-300"
                }`}
                style={{ width: `${scores.total}%` }}
              />
            </div>
            {showScoreBreakdown && (
              <div className="mt-3 space-y-2">
                <ScoreBar label="Hook Strength" value={scores.hookStrength} />
                <ScoreBar label="Expertise Signal" value={scores.expertiseSignal} />
                <ScoreBar label="Narrative Power" value={scores.narrativePower} />
                <ScoreBar label="Readability" value={scores.readability} />
              </div>
            )}
          </div>

          {/* Hashtags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
                Hashtags
              </label>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                hashtags.length <= 5 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}>
                {hashtags.length}/10 · {hashtags.length <= 5 ? "Optimal" : "Consider trimming"}
              </span>
            </div>

            {/* Selected hashtags */}
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {hashtags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 bg-[#0a66c2]/10 text-[#0a66c2] text-[11px] font-medium px-2.5 py-1 rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => setHashtags(hashtags.filter((t) => t !== tag))}
                      className="opacity-60 hover:opacity-100 ml-0.5 text-[10px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " " || e.key === ",") && hashtagInput.trim()) {
                    e.preventDefault();
                    addHashtag(hashtagInput.trim().replace(/,\s*$/, ""));
                  }
                }}
                placeholder="Add hashtag…"
                className="flex-1 rounded-lg border border-border px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/20 focus:border-[#0a66c2]"
              />
              <button
                onClick={() => hashtagInput.trim() && addHashtag(hashtagInput.trim())}
                className="px-3 py-1.5 rounded-lg bg-surface-secondary text-text-secondary text-[11px] font-medium hover:bg-surface-tertiary transition-colors"
              >
                Add
              </button>
            </div>

            {/* Suggestions */}
            <div className="flex flex-wrap gap-1">
              {HASHTAG_SUGGESTIONS.filter((t) => !hashtags.includes(t)).slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => addHashtag(tag)}
                  className="text-[10px] text-text-tertiary hover:text-[#0a66c2] bg-surface-secondary hover:bg-[#0a66c2]/5 px-2 py-0.5 rounded-full transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
              Visibility
            </label>
            <div className="flex gap-2">
              {[
                { value: "public",      label: "Public",           icon: "🌍", desc: "Anyone on LinkedIn" },
                { value: "connections", label: "Connections Only",  icon: "👥", desc: "Your network" },
              ].map((v) => (
                <button
                  key={v.value}
                  onClick={() => setVisibility(v.value)}
                  className={`flex-1 flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    visibility === v.value
                      ? "border-[#0a66c2] bg-[#0a66c2]/5"
                      : "border-border hover:border-[#0a66c2]/40"
                  }`}
                >
                  <span className="text-base mt-0.5">{v.icon}</span>
                  <div>
                    <div className="text-[11px] font-semibold text-text-primary">{v.label}</div>
                    <div className="text-[10px] text-text-tertiary">{v.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 pt-1 border-t border-border-light flex-wrap">
            <button
              onClick={handleSaveDraft}
              disabled={saving || !content.trim()}
              className="px-4 py-2 rounded-xl border border-border text-[12px] font-semibold text-text-secondary hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={saving || !content.trim()}
              className="px-4 py-2 rounded-xl border border-border text-[12px] font-semibold text-text-secondary hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-40"
            >
              Submit for Review
            </button>
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              disabled={!content.trim()}
              className="px-4 py-2 rounded-xl border border-border text-[12px] font-semibold text-text-secondary hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-40"
            >
              Schedule
            </button>
            <div className="flex-1" />
            <button
              onClick={handlePublish}
              disabled={publishing || !content.trim()}
              className="px-5 py-2 rounded-xl bg-[#0a66c2] text-white text-[12px] font-bold hover:bg-[#004182] transition-colors shadow-sm disabled:opacity-40"
            >
              {publishing ? "Publishing…" : "Publish Now"}
            </button>
          </div>

          {/* Schedule picker */}
          {showSchedule && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
              <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
                Schedule Post
              </div>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSchedule}
                  disabled={!scheduleTime || saving}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  Confirm Schedule
                </button>
                <button
                  onClick={() => setShowSchedule(false)}
                  className="px-4 py-2 rounded-lg border border-border text-[11px] text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Draft status pill */}
          {savedPost && (
            <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Post saved ·{" "}
              <span className="capitalize font-medium text-text-secondary">
                {savedPost.status.replace("_", " ")}
              </span>
              <span className="font-mono text-text-tertiary/60">{savedPost.id}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Live Preview ── */}
      <div className="w-[320px] shrink-0 border-l border-border bg-[#f3f2ef] flex flex-col overflow-y-auto">
        <div className="px-4 py-3 border-b border-border bg-white">
          <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
            Live Preview
          </span>
        </div>
        <div className="p-4">
          <LinkedInPreview
            content={content}
            postType={postType}
            hashtags={hashtags}
            visibility={visibility}
            score={scores.total}
            estimatedReach={reach}
          />
        </div>
      </div>
    </div>
  );
}
