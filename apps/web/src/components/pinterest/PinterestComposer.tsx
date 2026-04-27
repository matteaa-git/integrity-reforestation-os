"use client";

import { useState, useEffect, useCallback } from "react";
import PinterestPinPreview from "./PinterestPinPreview";
import AssetPicker from "@/components/AssetPicker";
import type { Asset } from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TITLE_LIMIT = 100;
const DESC_LIMIT  = 500;

const PIN_TYPES = [
  { value: "standard", label: "Standard",  icon: "📌" },
  { value: "idea",     label: "Idea Pin",  icon: "💡" },
  { value: "video",    label: "Video Pin", icon: "▶" },
  { value: "product",  label: "Product",   icon: "🛍" },
];

const BOARDS = [
  "Reforestation Projects",
  "Climate Action",
  "Tree Planting Tips",
  "Impact Stories",
  "Behind the Scenes",
  "Conservation Science",
  "Forest Recovery",
  "Native Species",
];

const PIN_HOOKS = [
  {
    type: "before_after",
    label: "Before & After",
    icon: "🔄",
    score: 92,
    titleTemplate: "From Barren to Forest: [Location] After [X] Years of Restoration",
    descTemplate:
      "This hillside was completely stripped of vegetation just [X] years ago. Through systematic native planting and community partnerships, Integrity Reforestation has restored [X] acres of forest habitat.\n\nSwipe to see the transformation ↓\n\n#Reforestation #BeforeAndAfter #ClimateAction",
  },
  {
    type: "data_insight",
    label: "Data & Impact",
    icon: "📊",
    score: 88,
    titleTemplate: "[X] Trees Planted — What That Actually Means for the Climate",
    descTemplate:
      "Every tree absorbs ~22 lbs of CO₂ per year. [X] trees = [Y] tons of carbon sequestered annually.\n\nBut the impact goes beyond carbon. We're rebuilding wildlife corridors, restoring watershed function, and creating permanent employment for local communities.\n\n#Conservation #ClimateData #Reforestation",
  },
  {
    type: "how_to",
    label: "How-To Guide",
    icon: "📋",
    score: 85,
    titleTemplate: "How to Plant a Native Tree That Actually Survives",
    descTemplate:
      "Most reforestation projects fail within 3 years. Here's what our field teams do differently:\n\n1. Site analysis before species selection\n2. Mycorrhizal inoculation at planting\n3. First-year monitoring protocol\n4. Community stewardship model\n\nSave this for your next planting project 📌\n\n#TreePlanting #Restoration #NativePlants",
  },
  {
    type: "story",
    label: "Field Story",
    icon: "🌱",
    score: 89,
    titleTemplate: "Meet [Name]: The Planter Who Restored [X] Acres Single-Handedly",
    descTemplate:
      "Three years ago, [Name] joined our reforestation crew with no experience. Today, [they've] personally planted and monitored over [X,000] trees across [location].\n\nEvery forest starts with one person deciding to show up.\n\n#FieldStory #Reforestation #Planters",
  },
  {
    type: "visual_guide",
    label: "Visual Guide",
    icon: "🗺",
    score: 82,
    titleTemplate: "The Complete Guide to California Fire Zone Recovery [2025]",
    descTemplate:
      "After the fires, the land looks dead. But the recovery timeline is faster than you think — if you plant the right species in the right sequence.\n\nThis visual guide covers the 5-year restoration arc we use in all Southern California fire recovery projects.\n\n#WildfireRecovery #California #Reforestation",
  },
  {
    type: "comparison",
    label: "Comparison",
    icon: "⚖",
    score: 79,
    titleTemplate: "Tree Planting vs. Forest Restoration: What's the Difference?",
    descTemplate:
      "Most people think planting trees = restoring forests. The reality is much more complex.\n\nForest restoration means rebuilding the entire ecosystem — soil microbiome, understory plants, wildlife corridors, and hydrology.\n\nHere's why the distinction matters for climate outcomes.\n\n#Conservation #ForestRestoration #ClimateAction",
  },
];

const TAG_SUGGESTIONS = [
  "Reforestation",
  "ClimateAction",
  "TreePlanting",
  "Conservation",
  "Sustainability",
  "ForestRestoration",
  "NativePlants",
  "WildfireRecovery",
  "Biodiversity",
  "CarbonCapture",
  "GreenFuture",
  "NatureBasedSolutions",
];

const SEO_SIGNALS = [
  { label: "Use keywords in title", icon: "🔑", tip: "Pinterest is a search engine — titles rank in Google too" },
  { label: "Vertical image (2:3 ratio)", icon: "▯", tip: "Tall pins get more impressions in the feed" },
  { label: "Add destination URL", icon: "🔗", tip: "Links drive traffic and boost pin authority" },
  { label: "Save to a specific board", icon: "📋", tip: "Board relevance improves distribution" },
  { label: "5–10 keyword-rich tags", icon: "#", tip: "Tags directly affect search discovery" },
];

// ---------------------------------------------------------------------------
// Pin Score — computed client-side
// ---------------------------------------------------------------------------
function computePinScore(
  title: string,
  description: string,
  url: string,
  board: string,
  tags: string[],
  coverImageUrl: string,
): { seo: number; visual: number; engagement: number; total: number } {
  if (!title.trim() && !description.trim()) {
    return { seo: 0, visual: 0, engagement: 0, total: 0 };
  }

  const combined = (title + " " + description).toLowerCase();
  const keywords = [
    "reforestation", "conservation", "ecosystem", "climate", "carbon",
    "watershed", "biodiversity", "wildfire", "restoration", "sustainability",
    "native species", "forest", "tree planting", "habitat", "seedling",
  ];

  // SEO score
  let seo = 20;
  seo += Math.min(30, keywords.filter(k => combined.includes(k)).length * 6);
  if (title.length >= 20 && title.length <= 80) seo += 15;
  if (description.length >= 100) seo += 15;
  if (tags.length >= 3) seo += 10;
  if (tags.length >= 7) seo += 10;
  seo = Math.min(100, seo);

  // Visual score
  let visual = 30;
  if (coverImageUrl) visual += 50;
  if (title.trim()) visual += 10;
  if (description.trim()) visual += 10;
  visual = Math.min(100, visual);

  // Engagement potential
  let engagement = 20;
  if (url) engagement += 20;
  if (board) engagement += 15;
  if (/\?|\!/.test(title)) engagement += 10;
  if (/save|pin|guide|how|tips|ideas|best|top/i.test(title)) engagement += 15;
  if (description.length >= 200) engagement += 10;
  if (/↓|📌|→|✓/.test(description)) engagement += 10;
  engagement = Math.min(100, engagement);

  const total = Math.round((seo + visual + engagement) / 3);
  return { seo, visual, engagement, total };
}

function estimateMonthlyViews(score: number, pinType: string): number {
  const base =
    pinType === "idea" ? 8000 :
    pinType === "video" ? 6500 :
    pinType === "product" ? 4500 : 3500;
  return Math.round(base * (0.4 + (score / 100) * 1.2));
}

// ---------------------------------------------------------------------------
// API helpers
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
// Sub-components
// ---------------------------------------------------------------------------
function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-gray-500">{label}</span>
        <span className="text-[9px] font-semibold text-gray-600">{value}</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
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
interface SavedPin { id: string; status: string }

export default function PinterestComposer() {
  const [title, setTitle]               = useState("");
  const [description, setDescription]  = useState("");
  const [destinationUrl, setDestUrl]   = useState("");
  const [board, setBoard]               = useState("");
  const [pinType, setPinType]           = useState("standard");
  const [coverImageUrl, setCoverUrl]   = useState("");
  const [tags, setTags]                 = useState<string[]>([]);
  const [tagInput, setTagInput]         = useState("");
  const [savedPin, setSavedPin]         = useState<SavedPin | null>(null);
  const [saving, setSaving]             = useState(false);
  const [publishing, setPublishing]     = useState(false);
  const [notice, setNotice]             = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const scores = computePinScore(title, description, destinationUrl, board, tags, coverImageUrl);
  const reach  = estimateMonthlyViews(scores.total, pinType);

  const flash = useCallback((text: string, kind: "success" | "error" = "success") => {
    setNotice({ text, kind });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  // Auto-save debounce
  useEffect(() => {
    if ((!title.trim() && !description.trim()) || !savedPin) return;
    const t = setTimeout(async () => {
      try {
        await apiPatch(`/pinterest/${savedPin.id}`, {
          title, description, destination_url: destinationUrl,
          board_name: board, pin_type: pinType,
          cover_image_url: coverImageUrl, tags,
          pin_score: scores.total, estimated_monthly_views: reach,
        });
      } catch { /* silent */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [title, description, destinationUrl, board, pinType, coverImageUrl, tags, scores.total, reach, savedPin]);

  const buildPayload = () => ({
    title, description, destination_url: destinationUrl,
    board_name: board, pin_type: pinType,
    cover_image_url: coverImageUrl, tags,
    pin_score: scores.total, estimated_monthly_views: reach,
  });

  const ensureSaved = async (): Promise<string> => {
    if (savedPin) return savedPin.id;
    const p = await apiPost("/pinterest/draft", buildPayload());
    setSavedPin({ id: p.id, status: p.status });
    return p.id;
  };

  const handleSaveDraft = async () => {
    if (!title.trim() && !description.trim()) { flash("Add a title or description first", "error"); return; }
    setSaving(true);
    try {
      if (savedPin) {
        await apiPatch(`/pinterest/${savedPin.id}`, buildPayload());
      } else {
        const p = await apiPost("/pinterest/draft", buildPayload());
        setSavedPin({ id: p.id, status: p.status });
      }
      flash("Draft saved");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed", "error");
    } finally { setSaving(false); }
  };

  const handleSubmitReview = async () => {
    if (!title.trim() && !description.trim()) { flash("Add a title or description first", "error"); return; }
    setSaving(true);
    try {
      const id = await ensureSaved();
      const p  = await apiPost(`/pinterest/${id}/submit-approval`, {});
      setSavedPin({ id: p.id, status: p.status });
      flash("Submitted for review");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Submit failed", "error");
    } finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!title.trim() && !description.trim()) { flash("Add a title or description first", "error"); return; }
    setPublishing(true);
    try {
      const id = await ensureSaved();
      const p  = await apiPost(`/pinterest/${id}/publish`, {});
      setSavedPin({ id: p.id, status: p.status });
      flash("Published to Pinterest");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Publish failed", "error");
    } finally { setPublishing(false); }
  };

  const handleSchedule = async () => {
    if (!scheduleTime || (!title.trim() && !description.trim())) return;
    setSaving(true);
    try {
      const id = await ensureSaved();
      const p  = await apiPost(`/pinterest/${id}/schedule`, {
        scheduled_time: new Date(scheduleTime).toISOString(),
      });
      setSavedPin({ id: p.id, status: p.status });
      setShowSchedule(false);
      flash(`Scheduled for ${new Date(scheduleTime).toLocaleString()}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Schedule failed", "error");
    } finally { setSaving(false); }
  };

  const handleAssetSelect = (asset: Asset) => {
    setSelectedAsset(asset);
    setCoverUrl(`${API_BASE}/assets/${asset.id}/file`);
    setShowPicker(false);
  };

  const addTag = (tag: string) => {
    const t = tag.replace(/^#/, "").trim();
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagInput("");
  };

  const applyHook = (h: typeof PIN_HOOKS[number]) => {
    setTitle(h.titleTemplate);
    setDescription(h.descTemplate);
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* ── Left: Hook Bank + Signals ── */}
      <div className="w-[250px] shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
        <div className="p-3.5 border-b border-gray-100">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            Pin Hook Bank
          </div>
          <div className="space-y-1.5">
            {PIN_HOOKS.map((h) => (
              <button
                key={h.type}
                onClick={() => applyHook(h)}
                className="w-full text-left p-2.5 rounded-xl border border-gray-200 hover:border-[#E60023]/40 hover:bg-[#E60023]/[0.02] transition-all group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{h.icon}</span>
                    <span className="text-[11px] font-semibold text-gray-800 group-hover:text-[#E60023] transition-colors">
                      {h.label}
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold px-1 rounded ${
                    h.score >= 88 ? "bg-emerald-100 text-emerald-700" :
                    h.score >= 78 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {h.score}
                  </span>
                </div>
                <div className="text-[9px] text-gray-400 leading-snug line-clamp-2">
                  {h.titleTemplate}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            SEO Signals
          </div>
          <div className="space-y-2">
            {SEO_SIGNALS.map((s) => (
              <div key={s.label} className="flex gap-2">
                <span className="text-[11px] shrink-0 mt-0.5 w-4 text-center text-gray-400">{s.icon}</span>
                <div>
                  <div className="text-[10px] font-medium text-gray-600">{s.label}</div>
                  <div className="text-[9px] text-gray-400 leading-snug">{s.tip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Center: Composer ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gray-50">
        {/* Notice */}
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
          {/* Pin type */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Pin Type
            </label>
            <div className="flex gap-1.5">
              {PIN_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setPinType(t.value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-colors ${
                    pinType === t.value
                      ? "bg-[#E60023] text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-[#E60023]/40"
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Title</label>
              <span className={`text-[10px] font-mono ${
                title.length > 85 ? "text-red-500 font-bold" : "text-gray-400"
              }`}>
                {title.length}/{TITLE_LIMIT}
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_LIMIT))}
              placeholder="Write a keyword-rich title that ranks in search…"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023] placeholder:text-gray-300"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Description</label>
              <span className={`text-[10px] font-mono ${
                description.length > 450 ? "text-red-500 font-bold" : "text-gray-400"
              }`}>
                {description.length}/{DESC_LIMIT}
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESC_LIMIT))}
              placeholder={`Describe what this pin is about. Include keywords naturally.\n\nAdd a call-to-action: "Save this for later" or "Click to learn more"\n\nUse hashtags: #Reforestation #ClimateAction`}
              rows={8}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023] resize-none placeholder:text-gray-300"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Cover Image
            </label>

            {/* Selected asset preview */}
            {selectedAsset && (
              <div className="flex items-center gap-3 mb-2 p-2.5 rounded-xl border border-[#E60023]/20 bg-[#E60023]/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_BASE}/assets/${selectedAsset.id}/file`}
                  alt={selectedAsset.filename}
                  className="w-10 h-14 object-cover rounded-lg border border-white shadow-sm shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-gray-800 truncate">{selectedAsset.filename}</div>
                  <div className="text-[10px] text-gray-400">
                    {selectedAsset.media_type} · {selectedAsset.width && selectedAsset.height ? `${selectedAsset.width}×${selectedAsset.height}` : "library asset"}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedAsset(null); setCoverUrl(""); }}
                  className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={coverImageUrl}
                onChange={(e) => { setCoverUrl(e.target.value); setSelectedAsset(null); }}
                placeholder="Paste URL or pick from library →"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023] placeholder:text-gray-300"
              />
              <button
                onClick={() => setShowPicker(true)}
                className="px-4 py-2.5 rounded-xl border border-[#E60023]/30 bg-[#E60023]/5 text-[#E60023] text-[12px] font-semibold hover:bg-[#E60023]/10 transition-colors whitespace-nowrap"
              >
                📌 Browse Library
              </button>
            </div>
          </div>

          {/* Destination URL */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Destination URL
            </label>
            <input
              type="text"
              value={destinationUrl}
              onChange={(e) => setDestUrl(e.target.value)}
              placeholder="https://integrityreforestation.com/…"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023] placeholder:text-gray-300"
            />
          </div>

          {/* Board */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Board
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BOARDS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBoard(b === board ? "" : b)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                    board === b
                      ? "bg-[#E60023] text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-[#E60023]/40"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tags</label>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                tags.length <= 10 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}>
                {tags.length}/10
              </span>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <div key={tag} className="flex items-center gap-1 bg-[#E60023]/10 text-[#E60023] text-[11px] font-medium px-2.5 py-1 rounded-full">
                    #{tag}
                    <button onClick={() => setTags(tags.filter(t => t !== tag))} className="opacity-60 hover:opacity-100 text-[10px] ml-0.5">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " " || e.key === ",") && tagInput.trim()) {
                    e.preventDefault();
                    addTag(tagInput.trim());
                  }
                }}
                placeholder="Add tag…"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
              <button
                onClick={() => tagInput.trim() && addTag(tagInput.trim())}
                className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[11px] font-medium hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {TAG_SUGGESTIONS.filter(t => !tags.includes(t)).slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="text-[10px] text-gray-400 hover:text-[#E60023] bg-gray-100 hover:bg-[#E60023]/5 px-2 py-0.5 rounded-full transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Pin Score */}
          <div
            className="rounded-xl border border-gray-200 bg-white p-4 cursor-pointer hover:border-[#E60023]/30 transition-colors"
            onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pin Score</span>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${
                  scores.total >= 75 ? "text-emerald-600" :
                  scores.total >= 50 ? "text-amber-600" : "text-gray-400"
                }`}>
                  {scores.total}
                </span>
                <span className="text-[10px] text-gray-400">{showScoreBreakdown ? "▲" : "▼"}</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
                <ScoreBar label="SEO Optimization" value={scores.seo} />
                <ScoreBar label="Visual Readiness" value={scores.visual} />
                <ScoreBar label="Engagement Potential" value={scores.engagement} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-200 flex-wrap">
            <button
              onClick={handleSaveDraft}
              disabled={saving || (!title.trim() && !description.trim())}
              className="px-4 py-2 rounded-xl border border-gray-200 text-[12px] font-semibold text-gray-600 hover:border-[#E60023]/30 hover:text-[#E60023] transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={saving || (!title.trim() && !description.trim())}
              className="px-4 py-2 rounded-xl border border-gray-200 text-[12px] font-semibold text-gray-600 hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-40"
            >
              Submit for Review
            </button>
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              disabled={!title.trim() && !description.trim()}
              className="px-4 py-2 rounded-xl border border-gray-200 text-[12px] font-semibold text-gray-600 hover:border-[#E60023]/30 hover:text-[#E60023] transition-colors disabled:opacity-40"
            >
              Schedule
            </button>
            <div className="flex-1" />
            <button
              onClick={handlePublish}
              disabled={publishing || (!title.trim() && !description.trim())}
              className="px-5 py-2 rounded-xl bg-[#E60023] text-white text-[12px] font-bold hover:bg-[#ad081b] transition-colors shadow-sm disabled:opacity-40"
            >
              {publishing ? "Publishing…" : "Publish to Pinterest"}
            </button>
          </div>

          {/* Schedule picker */}
          {showSchedule && (
            <div className="rounded-xl border border-[#E60023]/20 bg-[#E60023]/[0.02] p-4 space-y-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Schedule Pin</div>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSchedule}
                  disabled={!scheduleTime || saving}
                  className="flex-1 py-2 rounded-xl bg-[#E60023] text-white text-[11px] font-semibold hover:bg-[#ad081b] disabled:opacity-40 transition-colors"
                >
                  Confirm Schedule
                </button>
                <button
                  onClick={() => setShowSchedule(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-[11px] text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Status pill */}
          {savedPin && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Pin saved ·{" "}
              <span className="capitalize font-medium text-gray-600">
                {savedPin.status.replace("_", " ")}
              </span>
              <span className="font-mono text-gray-300">{savedPin.id}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Asset Picker Modal ── */}
      {showPicker && (
        <AssetPicker
          onSelect={handleAssetSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* ── Right: Live Preview ── */}
      <div className="w-[290px] shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Live Preview</span>
        </div>
        <div className="p-4">
          <PinterestPinPreview
            title={title}
            description={description}
            destinationUrl={destinationUrl}
            boardName={board}
            pinType={pinType}
            coverImageUrl={coverImageUrl}
            tags={tags}
            score={scores.total}
            estimatedMonthlyViews={reach}
          />
        </div>
      </div>
    </div>
  );
}
