"use client";

import type { ScoredDraftItem } from "@/lib/api";

interface Props {
  items: ScoredDraftItem[];
  loading: boolean;
}

const FORMAT_COLORS: Record<string, string> = {
  reel: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  carousel: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  story: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  post: "text-gray-400 bg-gray-500/10 border-gray-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-white/40",
  in_review: "text-amber-400",
  approved: "text-[#39de8b]",
  scheduled: "text-blue-400",
  rejected: "text-red-400",
};

function ScoreBar({ value, max = 100, color = "#39de8b" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function ViralGauge({ score }: { score: number }) {
  const color = score >= 75 ? "#39de8b" : score >= 55 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-9 h-9">
        <svg width="36" height="36" className="-rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#ffffff0a" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * (2 * Math.PI * 14)} ${2 * Math.PI * 14}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold" style={{ color }}>{Math.round(score)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ContentScoreTable({ items, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#12121f] flex flex-col items-center justify-center py-16 text-center">
        <div className="text-3xl text-white/10 mb-3">◎</div>
        <div className="text-[13px] text-white/30 mb-1">No content to score yet</div>
        <div className="text-[11px] text-white/20">Create drafts to see predicted performance scores here</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-[#12121f] overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-3 px-5 py-3 border-b border-white/5 text-[9px] font-semibold uppercase tracking-widest text-white/25">
        <div>Content</div>
        <div className="text-center">Viral</div>
        <div className="text-center">Reach</div>
        <div className="text-center">Hook</div>
        <div className="text-center">Save</div>
        <div className="text-center">Share</div>
      </div>

      <div className="divide-y divide-white/5">
        {items.map((item) => (
          <div key={item.draft_id} className="grid grid-cols-[1fr_80px_80px_80px_80px_80px] gap-3 px-5 py-4 hover:bg-white/3 transition-colors group">
            {/* Title + meta */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${FORMAT_COLORS[item.format] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                  {item.format}
                </span>
                <span className={`text-[9px] ${STATUS_COLORS[item.status] ?? "text-white/40"}`}>
                  {item.status.replace("_", " ")}
                </span>
                {item.scheduled_for && (
                  <span className="text-[9px] text-white/25">
                    {new Date(item.scheduled_for).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="text-[12px] font-medium text-white/80 truncate">{item.title}</div>
              <div className="mt-1.5 text-[9px] text-[#8b5cf6] capitalize">{item.content_category}</div>
            </div>

            {/* Viral score */}
            <div className="flex flex-col items-center justify-center gap-1">
              <ViralGauge score={item.viral_probability} />
            </div>

            {/* Reach */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-[11px] font-semibold text-white/70">
                {item.predicted_reach_low >= 1000
                  ? `${(item.predicted_reach_low / 1000).toFixed(0)}K`
                  : item.predicted_reach_low}
                <span className="text-white/25">–</span>
                {item.predicted_reach_high >= 1000
                  ? `${(item.predicted_reach_high / 1000).toFixed(0)}K`
                  : item.predicted_reach_high}
              </div>
              <div className="text-[8px] text-white/25 mt-0.5">est.</div>
            </div>

            {/* Hook */}
            <div className="flex flex-col items-center justify-center gap-1.5">
              <div className="text-[12px] font-semibold text-white/70">{Math.round(item.hook_strength)}</div>
              <ScoreBar value={item.hook_strength} color="#a78bfa" />
            </div>

            {/* Save */}
            <div className="flex flex-col items-center justify-center gap-1.5">
              <div className="text-[12px] font-semibold text-white/70">{Math.round(item.save_potential)}</div>
              <ScoreBar value={item.save_potential} color="#34d399" />
            </div>

            {/* Share */}
            <div className="flex flex-col items-center justify-center gap-1.5">
              <div className="text-[12px] font-semibold text-white/70">{Math.round(item.share_potential)}</div>
              <ScoreBar value={item.share_potential} color="#60a5fa" />
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center gap-6 text-[9px] text-white/25">
        <span>Viral = composite performance probability</span>
        <span>Hook = opening line strength</span>
        <span>Confidence: 74%</span>
      </div>
    </div>
  );
}
