"use client";

import { useState } from "react";
import type { PlanterCharacter, PlanterListResponse } from "@/lib/api";

interface Props {
  data: PlanterListResponse;
}

const ARC_CONFIG = {
  origin:          { color: "#00d4ff", label: "Origin Story",    icon: "◎" },
  challenge:       { color: "#ff9500", label: "Challenge Arc",   icon: "△" },
  transformation:  { color: "#a78bfa", label: "Transformation",  icon: "◑" },
  impact:          { color: "#00ff88", label: "Impact Story",    icon: "⬡" },
};

const EMOTION_CONFIG = {
  inspiring:    { color: "#00ff88" },
  educational:  { color: "#00d4ff" },
  humbling:     { color: "#a78bfa" },
  urgent:       { color: "#ff9500" },
};

const CONTENT_FORMATS = [
  { key: "reel_60s",   label: "60s Reel", icon: "▶", color: "#f472b6" },
  { key: "carousel",   label: "Carousel", icon: "⊞", color: "#00d4ff" },
  { key: "thread",     label: "Thread",   icon: "≡", color: "#00d4ff" },
  { key: "short_doc",  label: "Mini Doc", icon: "◈", color: "#fbbf24" },
];

function PlanterCard({ planter, onClick, selected }: { planter: PlanterCharacter; onClick: () => void; selected: boolean }) {
  const arcCfg = ARC_CONFIG[planter.story_arc as keyof typeof ARC_CONFIG] ?? ARC_CONFIG.impact;
  const emoColor = (EMOTION_CONFIG[planter.emotional_profile as keyof typeof EMOTION_CONFIG] ?? EMOTION_CONFIG.inspiring).color;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected ? "border-white/20 bg-white/5" : "border-white/8 bg-white/2 hover:bg-white/4 hover:border-white/12"
      }`}
    >
      {/* Avatar placeholder */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{ background: `linear-gradient(135deg, ${arcCfg.color}20, ${emoColor}10)`, border: `1px solid ${arcCfg.color}30` }}
        >
          {planter.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white/85">{planter.name}</div>
          <div className="text-[11px] text-white/40">{planter.role}</div>
          <div className="text-[10px] text-white/25 font-mono">{planter.location}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
            style={{ color: arcCfg.color, backgroundColor: `${arcCfg.color}15` }}
          >
            {arcCfg.label}
          </span>
          <span
            className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
            style={{ color: emoColor, backgroundColor: `${emoColor}15` }}
          >
            {planter.emotional_profile}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-[#00ff88]">
            {planter.impact_metrics.trees_planted >= 1000
              ? `${(planter.impact_metrics.trees_planted / 1000).toFixed(0)}K`
              : planter.impact_metrics.trees_planted}
          </div>
          <div className="text-[9px] text-white/25 font-mono">TREES</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-[#00d4ff]">{planter.impact_metrics.hectares_restored}ha</div>
          <div className="text-[9px] text-white/25 font-mono">HECTARES</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold font-mono text-[#fbbf24]">{planter.impact_metrics.years_active}yr</div>
          <div className="text-[9px] text-white/25 font-mono">ACTIVE</div>
        </div>
      </div>

      {/* Quote preview */}
      <div className="text-[11px] text-white/40 italic line-clamp-2">&ldquo;{planter.quote}&rdquo;</div>
    </button>
  );
}

function PlanterDetail({ planter }: { planter: PlanterCharacter }) {
  const arcCfg = ARC_CONFIG[planter.story_arc as keyof typeof ARC_CONFIG] ?? ARC_CONFIG.impact;
  const [activeFormat, setActiveFormat] = useState("reel_60s");

  const contentScripts: Record<string, string[]> = {
    reel_60s: [
      `0–3s: Text overlay: "${planter.content_angle.slice(0, 50)}..."`,
      `3–10s: Establish shot — planter in the field`,
      `10–25s: B-roll of trees, hands, impact moments`,
      `25–45s: Direct-to-camera quote: "${planter.quote.slice(0, 60)}..."`,
      `45–55s: Impact metric reveal: ${planter.impact_metrics.trees_planted.toLocaleString()} trees`,
      `55–60s: CTA: "Sponsor a tree in their forest. Link in bio."`,
    ],
    carousel: [
      `Slide 1: Bold hook — "${planter.content_angle.slice(0, 60)}"`,
      `Slide 2: Meet ${planter.name} — role, location, years active`,
      `Slide 3: The origin story — why they started`,
      `Slide 4: The challenge — what nearly stopped them`,
      `Slide 5: The impact numbers — trees, hectares, communities`,
      `Slide 6: The quote — "${planter.quote}"`,
      `Slide 7: CTA — how audience can support their work`,
    ],
    thread: planter.story_beats.map((beat, i) => `Tweet ${i + 1}: ${beat}`).concat(["Final tweet: CTA + sponsor link"]),
    short_doc: [
      `Opening: Aerial shot of restored land. No music. Just wind.`,
      `Act 1 (0–2min): ${planter.name}'s origin story in their own words`,
      `Act 2 (2–5min): The work — a day in the field`,
      `Act 3 (5–7min): The transformation — before/after`,
      `Close (7–8min): "${planter.quote}" — then impact numbers over field footage`,
    ],
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shrink-0"
            style={{ background: `linear-gradient(135deg, ${arcCfg.color}20, rgba(0,0,0,0.4))`, border: `1px solid ${arcCfg.color}30` }}
          >
            {planter.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white/90">{planter.name}</h2>
            <div className="text-sm text-white/50">{planter.role}</div>
            <div className="text-[11px] text-white/30 font-mono">{planter.location}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Trees", value: planter.impact_metrics.trees_planted.toLocaleString(), color: "#00ff88" },
            { label: "Hectares", value: `${planter.impact_metrics.hectares_restored}ha`, color: "#00d4ff" },
            { label: "Communities", value: planter.impact_metrics.communities_served, color: "#fbbf24" },
            { label: "Years Active", value: planter.impact_metrics.years_active, color: "#a78bfa" },
          ].map((stat) => (
            <div key={stat.label} className="text-center bg-white/3 rounded-lg p-2.5">
              <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[9px] text-white/25 font-mono uppercase">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-3 mb-3" style={{ borderColor: `${arcCfg.color}25`, backgroundColor: `${arcCfg.color}05` }}>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: arcCfg.color }}>
            {arcCfg.icon} {arcCfg.label}
          </div>
          <p className="text-sm text-white/70 italic leading-relaxed">&ldquo;{planter.quote}&rdquo;</p>
        </div>

        <div>
          <div className="text-[10px] text-white/25 font-mono uppercase mb-1.5">CONTENT ANGLE</div>
          <p className="text-sm text-white/60 leading-relaxed">{planter.content_angle}</p>
        </div>
      </div>

      {/* Story Beats */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-4">
        <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3">STORY BEATS</div>
        <div className="space-y-2">
          {planter.story_beats.map((beat, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono shrink-0 mt-0.5"
                style={{ backgroundColor: `${arcCfg.color}20`, color: arcCfg.color, border: `1px solid ${arcCfg.color}30` }}
              >
                {i + 1}
              </div>
              <div className="text-sm text-white/60 leading-relaxed">{beat}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Production Guide */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-4">
        <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3">CONTENT PRODUCTION GUIDE</div>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {CONTENT_FORMATS.map((fmt) => (
            <button
              key={fmt.key}
              onClick={() => setActiveFormat(fmt.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                activeFormat === fmt.key
                  ? "text-white bg-white/8 border-white/20"
                  : "border-white/10 text-white/40 hover:border-white/20"
              }`}
              style={activeFormat === fmt.key ? { borderColor: `${fmt.color}40`, color: fmt.color } : undefined}
            >
              <span>{fmt.icon}</span>
              {fmt.label}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {(contentScripts[activeFormat] ?? []).map((line, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/60">
              <span className="text-[#00ff88] shrink-0 mt-0.5">→</span>
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Narrative Tags */}
      <div className="flex flex-wrap gap-1.5">
        {planter.narrative_tags.map((tag) => (
          <span key={tag} className="text-[10px] font-mono text-[#00d4ff]/60 bg-[#00d4ff]/8 px-2 py-0.5 rounded">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PlanterEngine({ data }: Props) {
  const [selected, setSelected] = useState<PlanterCharacter | null>(data.planters[0] ?? null);
  const [arcFilter, setArcFilter] = useState<string>("all");

  const filtered = arcFilter === "all"
    ? data.planters
    : data.planters.filter((p) => p.story_arc === arcFilter);

  return (
    <div className="flex gap-4 h-full">
      {/* Planter List */}
      <div className="w-80 shrink-0 space-y-3 overflow-y-auto pr-1">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setArcFilter("all")}
            className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase border transition-all ${
              arcFilter === "all" ? "border-white/20 text-white bg-white/8" : "border-white/8 text-white/30"
            }`}
          >
            ALL ({data.total})
          </button>
          {Object.entries(ARC_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setArcFilter(key)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase border transition-all ${
                arcFilter === key ? "border-opacity-50 bg-opacity-10" : "border-white/8 text-white/30"
              }`}
              style={arcFilter === key ? { borderColor: `${cfg.color}50`, color: cfg.color, backgroundColor: `${cfg.color}10` } : undefined}
            >
              {cfg.icon} {key}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((planter) => (
            <PlanterCard
              key={planter.id}
              planter={planter}
              onClick={() => setSelected(planter)}
              selected={selected?.id === planter.id}
            />
          ))}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div className="flex-1 min-w-0 overflow-y-auto">
          <PlanterDetail planter={selected} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/20 text-sm font-mono text-center">
            <div className="text-3xl mb-2">◍</div>
            SELECT A PLANTER TO BUILD THEIR STORY
          </div>
        </div>
      )}
    </div>
  );
}
