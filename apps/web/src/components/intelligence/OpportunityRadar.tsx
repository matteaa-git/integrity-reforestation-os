"use client";

import { useState } from "react";
import type { TrendItem, TrendRadarResponse } from "@/lib/api";

interface Props {
  data: TrendRadarResponse | null;
  loading: boolean;
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  reddit: { bg: "bg-orange-500/15 border-orange-500/25", text: "text-orange-400", label: "Reddit" },
  instagram: { bg: "bg-pink-500/15 border-pink-500/25", text: "text-pink-400", label: "Instagram" },
  tiktok: { bg: "bg-cyan-500/15 border-cyan-500/25", text: "text-cyan-400", label: "TikTok" },
  youtube: { bg: "bg-red-500/15 border-red-500/25", text: "text-red-400", label: "YouTube" },
  google: { bg: "bg-blue-500/15 border-blue-500/25", text: "text-blue-400", label: "Google" },
  news: { bg: "bg-purple-500/15 border-purple-500/25", text: "text-purple-400", label: "News" },
};

const VELOCITY_STYLES: Record<string, { color: string; icon: string }> = {
  rising: { color: "text-[#39de8b]", icon: "↑" },
  peak: { color: "text-amber-400", icon: "⬆" },
  declining: { color: "text-white/35", icon: "↓" },
};

const FORMAT_ICONS: Record<string, string> = {
  reel: "▶",
  carousel: "⊞",
  story: "▣",
};

export default function OpportunityRadar({ data, loading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string>("all");

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const platforms = ["all", ...Array.from(new Set(data.trends.map((t) => t.platform)))];
  const filtered = platform === "all" ? data.trends : data.trends.filter((t) => t.platform === platform);

  return (
    <div className="space-y-4">
      {/* Top opportunity callout */}
      {data.top_opportunity && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-1">🔥 Top Opportunity Right Now</div>
              <div className="text-[14px] font-bold text-white mb-1">{data.top_opportunity.topic}</div>
              <p className="text-[11px] text-white/55 leading-relaxed">{data.top_opportunity.content_angle}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[22px] font-bold text-amber-400 leading-none">
                {Math.round(data.top_opportunity.trend_score)}
              </div>
              <div className="text-[9px] text-white/30 mt-0.5">score</div>
              <div className="mt-2 text-[9px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                {data.top_opportunity.opportunity_window}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Platform filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {platforms.map((p) => {
          const style = PLATFORM_STYLES[p];
          return (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors border ${
                platform === p
                  ? (style ? `${style.bg} ${style.text}` : "bg-white/15 text-white border-white/20")
                  : "bg-white/4 text-white/40 border-white/8 hover:text-white/60"
              }`}
            >
              {style?.label ?? "All"}
            </button>
          );
        })}
        <span className="ml-auto text-[10px] text-white/25">{filtered.length} opportunities</span>
      </div>

      {/* Trend grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((trend) => {
          const pStyle = PLATFORM_STYLES[trend.platform] ?? { bg: "bg-white/5 border-white/10", text: "text-white/50", label: trend.platform };
          const vel = VELOCITY_STYLES[trend.velocity] ?? VELOCITY_STYLES.rising;
          const isOpen = expanded === trend.id;

          return (
            <div
              key={trend.id}
              onClick={() => setExpanded(isOpen ? null : trend.id)}
              className="rounded-2xl border border-white/8 bg-[#12121f] overflow-hidden cursor-pointer hover:border-white/15 transition-colors"
            >
              <div className="px-4 py-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${pStyle.bg} ${pStyle.text}`}>
                        {pStyle.label}
                      </span>
                      <span className={`text-[10px] font-semibold ${vel.color}`}>
                        {vel.icon} {trend.velocity}
                      </span>
                      <span className="text-[9px] text-white/25">{trend.opportunity_window}</span>
                    </div>
                    <div className="text-[13px] font-bold text-white leading-tight">{trend.topic}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[18px] font-bold text-white leading-none">{Math.round(trend.trend_score)}</div>
                    <div className="text-[8px] text-white/25">trend</div>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <div className="text-[8px] text-white/25 uppercase tracking-wide">Volume</div>
                    <div className="text-[10px] font-semibold text-white/60 mt-0.5">{trend.volume_label}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-white/25 uppercase tracking-wide">Brand Fit</div>
                    <div className="text-[10px] font-semibold text-[#39de8b] mt-0.5">{Math.round(trend.relevance_to_brand)}%</div>
                  </div>
                  <div className="ml-auto flex gap-1">
                    {trend.content_formats.map((f) => (
                      <span key={f} className="text-[9px] text-white/40 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">
                        {FORMAT_ICONS[f] ?? f} {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Brand relevance bar */}
                <div className="mt-3">
                  <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#39de8b] transition-all duration-700"
                      style={{ width: `${trend.relevance_to_brand}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded content angle */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3">
                  <div className="text-[9px] font-semibold text-white/35 uppercase tracking-widest mb-2">Content Angle</div>
                  <p className="text-[11px] text-white/60 leading-relaxed">{trend.content_angle}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {trend.tags.map((tag) => (
                      <span key={tag} className="text-[9px] text-white/35 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
