"use client";

import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NarrativeTopic {
  topic_id: string;
  title: string;
  summary: string;
  signal_count: number;
  sources: string[];
  keywords: string[];
  opportunity_score: number;
  conversation_velocity: number;
  controversy_score: number;
  engagement_potential: number;
  relevance_score: number;
  search_volume_estimate: number;
  trend_direction: string;
  status: string;
  category: string;
  lifespan_estimate: string;
  signal_ids: string[];
  top_signal_title: string;
  top_signal_url: string | null;
  created_at: string;
}

export interface NarrativeTopicListResponse {
  topics: NarrativeTopic[];
  total: number;
  respond_now_count: number;
  good_opportunity_count: number;
  last_clustered: string;
}

interface Props {
  data: NarrativeTopicListResponse;
  onSelectTopic: (topic: NarrativeTopic) => void;
  selectedTopicId: string | null;
  onRecluster: () => void;
}

// ---------------------------------------------------------------------------
// Score config
// ---------------------------------------------------------------------------

const SCORE_STATES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  respond_now:      { label: "RESPOND NOW",      color: "#ff2d55", bg: "bg-[#ff2d55]/10", border: "border-[#ff2d55]/40" },
  good_opportunity: { label: "GOOD OPPORTUNITY", color: "#ff9500", bg: "bg-[#ff9500]/10", border: "border-[#ff9500]/40" },
  monitor:          { label: "MONITOR",          color: "#fbbf24", bg: "bg-[#fbbf24]/10", border: "border-[#fbbf24]/30" },
  low_priority:     { label: "LOW PRIORITY",     color: "#64748b", bg: "bg-[#64748b]/10", border: "border-[#64748b]/20" },
};

const DIRECTION_ICON: Record<string, { icon: string; color: string }> = {
  rising:   { icon: "↑", color: "#00ff88" },
  peak:     { icon: "▲", color: "#ff9500" },
  stable:   { icon: "→", color: "#fbbf24" },
  declining:{ icon: "↓", color: "#64748b" },
};

const CATEGORY_COLORS: Record<string, string> = {
  environmental: "#00ff88",
  cultural:      "#00d4ff",
  political:     "#a78bfa",
  social:        "#fbbf24",
  trend:         "#f472b6",
};

// ---------------------------------------------------------------------------
// Score Ring
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const size = 52;
  const r = (size - 7) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const cfg = score >= 80
    ? SCORE_STATES.respond_now
    : score >= 60
    ? SCORE_STATES.good_opportunity
    : score >= 40
    ? SCORE_STATES.monitor
    : SCORE_STATES.low_priority;

  return (
    <div className="flex flex-col items-center shrink-0">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={cfg.color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="48%" textAnchor="middle" dy="0.35em" fontSize={11} fontFamily="monospace" fontWeight="bold" fill={cfg.color}>
          {score}
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score bar row
// ---------------------------------------------------------------------------

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[9px] font-mono text-white/25 uppercase">{label}</span>
        <span className="text-[9px] font-mono tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NarrativeRadar({ data, onSelectTopic, selectedTopicId, onRecluster }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reclustering, setReclustering] = useState(false);

  const handleRecluster = useCallback(async () => {
    setReclustering(true);
    try {
      await onRecluster();
    } finally {
      setReclustering(false);
    }
  }, [onRecluster]);

  const filtered = data.topics.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  const statusFilters = ["all", "respond_now", "good_opportunity", "monitor"];
  const categories    = ["all", "environmental", "social", "cultural", "political", "trend"];

  return (
    <div className="flex gap-4">
      {/* Main feed */}
      <div className="flex-1 min-w-0 space-y-3">

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {statusFilters.map((s) => {
              const cfg = SCORE_STATES[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                    filter === s
                      ? "text-white bg-white/8 border-white/20"
                      : "border-white/8 text-white/30 hover:border-white/15 hover:text-white/50"
                  }`}
                  style={filter === s && cfg ? { color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}12` } : undefined}
                >
                  {s === "all" ? "ALL" : cfg?.label ?? s}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 ml-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                  categoryFilter === c
                    ? "border-white/20 text-white/70 bg-white/6"
                    : "border-white/6 text-white/20 hover:border-white/12 hover:text-white/40"
                }`}
                style={
                  categoryFilter === c && c !== "all"
                    ? { color: CATEGORY_COLORS[c], borderColor: `${CATEGORY_COLORS[c]}40`, backgroundColor: `${CATEGORY_COLORS[c]}10` }
                    : undefined
                }
              >
                {c}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3 text-[11px] font-mono">
            <span className="text-white/30">
              <span className="text-[#ff2d55]">{data.respond_now_count}</span> respond now
            </span>
            <span className="text-white/30">
              <span className="text-[#ff9500]">{data.good_opportunity_count}</span> opportunities
            </span>
            <span className="text-white/20">{data.total} total</span>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="text-white/10 text-5xl">◉</div>
            <div className="text-center">
              <div className="text-white/40 text-sm font-mono uppercase tracking-widest mb-1">
                {data.total === 0 ? "No narratives detected yet" : "No narratives match filter"}
              </div>
              <div className="text-white/20 text-xs font-mono">
                {data.total === 0
                  ? "Refresh signals then recluster to detect narratives"
                  : "Adjust the status or category filter"}
              </div>
            </div>
            {data.total === 0 && (
              <button
                onClick={handleRecluster}
                disabled={reclustering}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#00ff88,#00d4ff)", color: "#000" }}
              >
                <span className={reclustering ? "animate-spin" : ""}>⟳</span>
                {reclustering ? "DETECTING..." : "DETECT NARRATIVES"}
              </button>
            )}
          </div>
        )}

        {/* Narrative cards */}
        <div className="space-y-2">
          {filtered.map((topic) => {
            const cfg = SCORE_STATES[topic.status] ?? SCORE_STATES.monitor;
            const dir = DIRECTION_ICON[topic.trend_direction] ?? DIRECTION_ICON.stable;
            const catColor = CATEGORY_COLORS[topic.category] ?? "#00ff88";
            const isSelected = selectedTopicId === topic.topic_id;

            return (
              <button
                key={topic.topic_id}
                onClick={() => onSelectTopic(topic)}
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  isSelected
                    ? `${cfg.bg} ${cfg.border}`
                    : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                }`}
                style={isSelected ? { borderColor: `${cfg.color}50` } : undefined}
              >
                <div className="flex items-start gap-3">
                  <ScoreRing score={topic.opportunity_score} />

                  <div className="flex-1 min-w-0">
                    {/* Top row: badges + score state */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ color: cfg.color, backgroundColor: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ color: catColor, backgroundColor: `${catColor}12` }}
                      >
                        {topic.category}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold"
                        style={{ color: dir.color }}
                      >
                        {dir.icon} {topic.trend_direction.toUpperCase()}
                      </span>
                      <span className="ml-auto text-[9px] font-mono text-white/25">
                        {topic.lifespan_estimate} window
                      </span>
                    </div>

                    {/* Title */}
                    <div className="text-sm font-semibold text-white/90 leading-snug mb-1.5">
                      {topic.title}
                    </div>

                    {/* Summary */}
                    <div className="text-[11px] text-white/40 leading-relaxed mb-2 line-clamp-2">
                      {topic.summary}
                    </div>

                    {/* Score bars */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <ScoreBar label="Relevance"   value={topic.relevance_score}      color="#00ff88" />
                      <ScoreBar label="Velocity"    value={Math.min(topic.conversation_velocity * 33, 100)} color="#00d4ff" />
                      <ScoreBar label="Controversy" value={topic.controversy_score}    color="#a78bfa" />
                    </div>

                    {/* Footer: sources + signal count + keywords */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-white/25">
                        {topic.signal_count} signal{topic.signal_count !== 1 ? "s" : ""}
                      </span>
                      <span className="text-white/10 text-[10px]">·</span>
                      {topic.sources.slice(0, 3).map((src) => (
                        <span key={src} className="text-[9px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded">
                          {src}
                        </span>
                      ))}
                      {topic.sources.length > 3 && (
                        <span className="text-[9px] font-mono text-white/20">+{topic.sources.length - 3} more</span>
                      )}
                      <span className="text-white/10 text-[10px] ml-auto">·</span>
                      {topic.keywords.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[9px] font-mono text-[#00d4ff]/50">#{kw}</span>
                      ))}
                    </div>

                    {/* CTA hint */}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-white/8 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white/30">→ Panel open</span>
                        <span className="text-[10px] font-mono" style={{ color: cfg.color }}>
                          Generating response content for X, LinkedIn &amp; Substack
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recluster button */}
        {data.total > 0 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={handleRecluster}
              disabled={reclustering}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono text-white/30 hover:border-white/20 hover:text-white/50 transition-all disabled:opacity-40"
            >
              <span className={reclustering ? "animate-spin" : ""}>⟳</span>
              {reclustering ? "RECLUSTERING..." : "RECLUSTER NARRATIVES"}
            </button>
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="w-60 shrink-0 space-y-3">
        {/* Opportunity summary */}
        <div className="rounded-lg border border-white/8 bg-white/3 p-4 space-y-3">
          <div className="text-[10px] text-white/25 font-mono uppercase tracking-wider">OPPORTUNITY SUMMARY</div>
          {Object.entries(SCORE_STATES).map(([key, cfg]) => {
            const count = data.topics.filter((t) => t.status === key).length;
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-[10px] font-mono" style={{ color: cfg.color }}>{cfg.label}</span>
                <span className="text-[13px] font-bold font-mono" style={{ color: cfg.color }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Category breakdown */}
        <div className="rounded-lg border border-white/8 bg-white/3 p-4 space-y-2">
          <div className="text-[10px] text-white/25 font-mono uppercase tracking-wider mb-2">CATEGORY BREAKDOWN</div>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
            const count = data.topics.filter((t) => t.category === cat).length;
            const maxScore = data.topics.filter((t) => t.category === cat)
              .reduce((m, t) => Math.max(m, t.opportunity_score), 0);
            return (
              <div key={cat}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] font-mono capitalize" style={{ color }}>{cat}</span>
                  <span className="text-[10px] font-mono text-white/30">{count}</span>
                </div>
                <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${maxScore}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Top narrative */}
        {data.topics[0] && (
          <div
            className="rounded-lg border p-4 space-y-2 cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              borderColor: `${SCORE_STATES[data.topics[0].status]?.color ?? "#00ff88"}30`,
              backgroundColor: `${SCORE_STATES[data.topics[0].status]?.color ?? "#00ff88"}08`,
            }}
            onClick={() => onSelectTopic(data.topics[0])}
          >
            <div className="text-[9px] font-mono uppercase tracking-wider"
              style={{ color: SCORE_STATES[data.topics[0].status]?.color ?? "#00ff88" }}>
              TOP NARRATIVE
            </div>
            <div className="text-[12px] font-semibold text-white/85 leading-snug">
              {data.topics[0].title}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-white/30">Score</span>
              <span className="font-bold" style={{ color: SCORE_STATES[data.topics[0].status]?.color ?? "#00ff88" }}>
                {data.topics[0].opportunity_score}
              </span>
              <span className="text-white/20">·</span>
              <span style={{ color: DIRECTION_ICON[data.topics[0].trend_direction]?.color ?? "#fbbf24" }}>
                {DIRECTION_ICON[data.topics[0].trend_direction]?.icon} {data.topics[0].trend_direction}
              </span>
            </div>
            <div className="text-[9px] font-mono text-white/30 pt-1 border-t border-white/8">
              Click to generate response →
            </div>
          </div>
        )}

        {/* Last clustered */}
        <div className="text-[9px] text-white/15 font-mono text-center">
          LAST CLUSTERED:{" "}
          {data.last_clustered
            ? new Date(data.last_clustered).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
            : "—"}
        </div>
      </div>
    </div>
  );
}
