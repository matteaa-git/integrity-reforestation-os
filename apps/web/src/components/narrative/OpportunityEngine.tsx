"use client";

import { useState } from "react";
import type { NarrativeOpportunity, OpportunityListResponse } from "@/lib/api";

interface Props {
  data: OpportunityListResponse;
}

const PRIORITY_CONFIG = {
  critical: { color: "#ff2d55", bg: "bg-[#ff2d55]/10 border-[#ff2d55]/30", label: "CRITICAL", ring: "ring-1 ring-[#ff2d55]/40" },
  high:     { color: "#ff9500", bg: "bg-[#ff9500]/10 border-[#ff9500]/30", label: "HIGH",     ring: "ring-1 ring-[#ff9500]/20" },
  medium:   { color: "#fbbf24", bg: "bg-[#fbbf24]/10 border-[#fbbf24]/30", label: "MEDIUM",   ring: "" },
  low:      { color: "#64748b", bg: "bg-[#64748b]/10 border-[#64748b]/30", label: "LOW",      ring: "" },
};

const NARRATIVE_TYPE_ICONS: Record<string, string> = {
  crisis_response: "⚡",
  story: "◎",
  authority: "△",
  education: "◻",
  movement: "⬡",
};

function ScoreRing({ value, color, label }: { value: number; label: string; color: string }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx="28" cy="28" r={r}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold font-mono" style={{ color }}>{value}</span>
        </div>
      </div>
      <div className="text-[9px] text-white/30 font-mono uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function OpportunityEngine({ data }: Props) {
  const [selected, setSelected] = useState<NarrativeOpportunity | null>(
    data.opportunities[0] ?? null
  );
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all"
    ? data.opportunities
    : data.opportunities.filter((o) => o.priority === filter);

  return (
    <div className="flex gap-4 h-full">
      {/* Opportunity List */}
      <div className="w-80 shrink-0 space-y-3 overflow-y-auto pr-1">
        {/* Priority Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "critical", "high", "medium", "low"].map((f) => {
            const cfg = f !== "all" ? PRIORITY_CONFIG[f as keyof typeof PRIORITY_CONFIG] : null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                  filter === f
                    ? cfg ? `${cfg.bg} border-transparent` : "bg-white/10 border-transparent text-white"
                    : "border-white/10 text-white/30 hover:text-white/50"
                }`}
                style={filter === f && cfg ? { color: cfg.color } : undefined}
              >
                {f === "all" ? `ALL (${data.total})` : `${f} ${f === "critical" ? `(${data.critical_count})` : f === "high" ? `(${data.high_count})` : ""}`}
              </button>
            );
          })}
        </div>

        {filtered.map((opp) => {
          const pCfg = PRIORITY_CONFIG[opp.priority] ?? PRIORITY_CONFIG.low;
          const isSelected = selected?.id === opp.id;
          return (
            <button
              key={opp.id}
              onClick={() => setSelected(opp)}
              className={`w-full text-left rounded-lg border p-3.5 transition-all ${
                isSelected
                  ? `bg-white/5 border-white/20 ${pCfg.ring}`
                  : "border-white/8 bg-white/2 hover:bg-white/4 hover:border-white/12"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base mt-0.5 shrink-0">{NARRATIVE_TYPE_ICONS[opp.narrative_type] ?? "◎"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${pCfg.bg}`} style={{ color: pCfg.color }}>
                      {pCfg.label}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">Score: {opp.composite_score}</span>
                  </div>
                  <div className="text-[13px] font-medium text-white/85 leading-tight">{opp.title}</div>
                  <div className="text-[11px] text-white/40 mt-1">Closes: {opp.window_closes}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {opp.content_formats.map((f) => (
                  <span key={f} className="text-[10px] font-mono text-[#00d4ff]/60 bg-[#00d4ff]/8 px-1.5 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail Panel */}
      {selected ? (
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header */}
          <div className="rounded-lg border border-white/10 bg-white/3 p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{NARRATIVE_TYPE_ICONS[selected.narrative_type] ?? "◎"}</span>
              <div>
                <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-1">
                  {selected.narrative_type.replace("_", " ")} · {PRIORITY_CONFIG[selected.priority]?.label ?? selected.priority}
                </div>
                <h2 className="text-lg font-semibold text-white/90 leading-tight">{selected.title}</h2>
              </div>
            </div>

            {/* Score Rings */}
            <div className="flex items-center gap-6 flex-wrap">
              <ScoreRing value={selected.composite_score} color="#00ff88" label="COMPOSITE" />
              <ScoreRing value={selected.impact_score} color="#00d4ff" label="IMPACT" />
              <ScoreRing value={selected.urgency_score} color="#ff9500" label="URGENCY" />
              <ScoreRing value={selected.brand_fit} color="#a78bfa" label="BRAND FIT" />
              <div className="flex-1 min-w-0 ml-4">
                <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-2">ESTIMATED REACH</div>
                <div className="text-2xl font-bold font-mono text-[#00ff88]">{selected.estimated_reach}</div>
                <div className="text-[11px] text-white/40 mt-1">Window closes: {selected.window_closes}</div>
              </div>
            </div>
          </div>

          {/* Key Angle */}
          <div className="rounded-lg border border-[#00ff88]/25 bg-[#00ff88]/5 p-4">
            <div className="text-[10px] text-[#00ff88] font-mono uppercase tracking-wider mb-2">KEY ANGLE</div>
            <p className="text-sm text-white/80 italic leading-relaxed">&ldquo;{selected.key_angle}&rdquo;</p>
          </div>

          {/* Recommended Action */}
          <div className="rounded-lg border border-white/10 bg-white/3 p-4">
            <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-2">RECOMMENDED ACTION</div>
            <p className="text-sm text-white/70 leading-relaxed">{selected.recommended_action}</p>
          </div>

          {/* Content Formats */}
          <div className="rounded-lg border border-white/10 bg-white/3 p-4">
            <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3">CONTENT FORMATS</div>
            <div className="flex flex-wrap gap-2">
              {selected.content_formats.map((f) => (
                <div key={f} className="px-3 py-1.5 rounded-lg border border-[#00d4ff]/25 bg-[#00d4ff]/8 text-[12px] font-mono text-[#00d4ff]">
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/20 text-sm font-mono text-center">
            <div className="text-3xl mb-2">⬡</div>
            SELECT AN OPPORTUNITY TO ANALYZE
          </div>
        </div>
      )}
    </div>
  );
}
