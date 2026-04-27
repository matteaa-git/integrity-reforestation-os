"use client";

import type { PortfolioAnalysis } from "@/lib/api";

interface Props {
  data: PortfolioAnalysis | null;
  loading: boolean;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "text-red-400 bg-red-400/10 border-red-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-white/40 bg-white/5 border-white/10",
};

const FORMAT_COLORS: Record<string, string> = {
  reels: "#a78bfa",
  carousels: "#60a5fa",
  stories: "#f472b6",
  posts: "#9ca3af",
};

const NARRATIVE_COLORS: Record<string, string> = {
  education: "#34d399",
  entertainment: "#f59e0b",
  story: "#f472b6",
  authority: "#60a5fa",
};

function BarChart({
  items,
}: {
  items: { label: string; actual: number; ideal: number; color: string; count: number }[];
}) {
  return (
    <div className="space-y-3.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[11px] text-white/60 capitalize">{item.label}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-white/50 font-semibold">{item.actual.toFixed(0)}%</span>
              <span className="text-white/20">vs</span>
              <span className="text-white/30">{item.ideal}% ideal</span>
              <span className="text-white/25">({item.count})</span>
            </div>
          </div>
          <div className="relative w-full h-3 bg-white/8 rounded-full overflow-hidden">
            {/* Ideal marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/20 z-10"
              style={{ left: `${item.ideal}%` }}
            />
            {/* Actual bar */}
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(item.actual, 100)}%`,
                backgroundColor: item.color,
                opacity: Math.abs(item.actual - item.ideal) < 8 ? 1 : 0.7,
              }}
            />
          </div>
          {Math.abs(item.actual - item.ideal) > 12 && (
            <div className="mt-1 text-[9px] text-amber-400/70">
              {item.actual > item.ideal ? "↑ over-weight" : "↓ under-weight"} by {Math.abs(item.actual - item.ideal).toFixed(0)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PortfolioPanel({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 rounded-2xl bg-white/5" />
        <div className="h-48 rounded-2xl bg-white/5" />
        <div className="h-32 rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (!data) return null;

  const { format_breakdown: fmt, narrative_breakdown: narr } = data;

  const formatItems = [
    { label: "Reels", actual: fmt.reels_pct, ideal: fmt.ideal_reels_pct, color: FORMAT_COLORS.reels, count: fmt.reels },
    { label: "Carousels", actual: fmt.carousels_pct, ideal: fmt.ideal_carousels_pct, color: FORMAT_COLORS.carousels, count: fmt.carousels },
    { label: "Stories", actual: fmt.stories_pct, ideal: fmt.ideal_stories_pct, color: FORMAT_COLORS.stories, count: fmt.stories },
    { label: "Posts", actual: fmt.total > 0 ? (fmt.posts / fmt.total * 100) : 0, ideal: 0, color: FORMAT_COLORS.posts, count: fmt.posts },
  ];

  const narrativeItems = [
    { label: "Education", actual: narr.education_pct, ideal: 30, color: NARRATIVE_COLORS.education, count: narr.education },
    { label: "Entertainment", actual: narr.entertainment_pct, ideal: 25, color: NARRATIVE_COLORS.entertainment, count: narr.entertainment },
    { label: "Story", actual: narr.story_pct, ideal: 25, color: NARRATIVE_COLORS.story, count: narr.story },
    { label: "Authority", actual: narr.authority_pct, ideal: 20, color: NARRATIVE_COLORS.authority, count: narr.authority },
  ];

  const scoreColor = data.portfolio_score >= 75 ? "#39de8b" : data.portfolio_score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-4">
      {/* Portfolio score header */}
      <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-white">Content Portfolio</h3>
            <p className="text-[10px] text-white/35 mt-0.5">{data.week_label} · {fmt.total} pieces</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[28px] font-bold leading-none" style={{ color: scoreColor }}>
                {Math.round(data.portfolio_score)}
              </div>
              <div className="text-[9px] text-white/25 mt-0.5">balance score</div>
            </div>
          </div>
        </div>

        {/* Quick summary pills */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FORMAT_COLORS.reels }} />
            <span className="text-[10px] text-white/60">{fmt.reels} reels</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FORMAT_COLORS.carousels }} />
            <span className="text-[10px] text-white/60">{fmt.carousels} carousels</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FORMAT_COLORS.stories }} />
            <span className="text-[10px] text-white/60">{fmt.stories} stories</span>
          </div>
        </div>
      </div>

      {/* Format mix */}
      <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
        <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-4">Format Distribution</div>
        <BarChart items={formatItems} />
        <div className="mt-3 text-[9px] text-white/20">Vertical markers = ideal target ratio</div>
      </div>

      {/* Narrative mix */}
      <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
        <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-4">Narrative Balance</div>
        <BarChart items={narrativeItems} />
      </div>

      {/* Next best content */}
      <div className="rounded-2xl border border-[#39de8b]/15 bg-[#39de8b]/5 px-5 py-4">
        <div className="text-[9px] font-bold text-[#39de8b] uppercase tracking-widest mb-2">Next Best Content to Create</div>
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold text-white capitalize">{data.next_best_content}</span>
          <span className="text-[10px] text-[#39de8b] bg-[#39de8b]/10 border border-[#39de8b]/20 px-2 py-0.5 rounded-full capitalize">
            {data.next_best_content}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mt-2 leading-relaxed">{data.next_best_reason}</p>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
          <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-3">Recommendations</div>
          <div className="space-y-3">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/6">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${PRIORITY_STYLES[rec.priority]}`}>
                  {rec.priority}
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-white/80">{rec.action}</div>
                  <div className="text-[10px] text-white/45 mt-0.5 leading-relaxed">{rec.reason}</div>
                  {rec.suggested_topic && (
                    <div className="text-[10px] text-[#39de8b]/70 mt-1">Idea: {rec.suggested_topic}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
