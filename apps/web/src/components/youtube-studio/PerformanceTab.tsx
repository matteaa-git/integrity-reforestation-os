"use client";

import type { YouTubeVideo } from "./DraftsTab";

interface Analytics {
  total_videos: number;
  total_views: number;
  total_watch_time: number;
  avg_seo_score: number;
  published_count: number;
}

interface Props {
  videos: YouTubeVideo[];
  analytics: Analytics;
}

function scoreColor(v: number) {
  if (v >= 70) return "#39de8b";
  if (v >= 40) return "#f59e0b";
  return "#ef4444";
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-white/3 border border-white/6 p-4">
      <div className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-2">{label}</div>
      <div
        className="text-[28px] font-black tabular-nums leading-none mb-1"
        style={{ color: accent ?? "rgba(255,255,255,0.75)" }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-white/25">{sub}</div>}
    </div>
  );
}

export default function PerformanceTab({ videos, analytics }: Props) {
  const published = videos.filter((v) => v.status === "published");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white/80">Performance</h2>
        <p className="text-xs text-white/30 mt-0.5">Channel stats · connect YouTube account for live data</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard
          label="Published"
          value={String(analytics.published_count)}
          sub="videos live"
          accent="#ff0033"
        />
        <KpiCard
          label="Total Videos"
          value={String(analytics.total_videos)}
          sub="in system"
        />
        <KpiCard
          label="Total Views"
          value={analytics.total_views > 0 ? analytics.total_views.toLocaleString() : "—"}
          sub="connect account"
        />
        <KpiCard
          label="Avg SEO Score"
          value={analytics.avg_seo_score > 0 ? String(analytics.avg_seo_score) : "—"}
          sub="out of 100"
          accent={analytics.avg_seo_score > 0 ? scoreColor(analytics.avg_seo_score) : undefined}
        />
      </div>

      {/* Published table */}
      {published.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Published Videos</h3>
          <div className="space-y-2">
            {published.map((video) => (
              <div
                key={video.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/3 border border-white/6"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/75 truncate">
                    {video.title || "Untitled"}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Published {video.published_time ? new Date(video.published_time).toLocaleDateString() : "—"} · {video.visibility}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <div className="text-[11px] font-mono text-white/25">—</div>
                    <div className="text-[9px] text-white/20">Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[11px] font-mono text-white/25">—</div>
                    <div className="text-[9px] text-white/20">Watch time</div>
                  </div>
                  <div className="text-center">
                    <div
                      className="text-[12px] font-bold font-mono tabular-nums"
                      style={{ color: scoreColor(video.hook_score) }}
                    >
                      {video.hook_score}
                    </div>
                    <div className="text-[9px] text-white/20">SEO</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-40 rounded-xl border border-white/5 border-dashed">
          <p className="text-sm text-white/25">No published videos yet</p>
          <p className="text-xs text-white/15 mt-1">Publish your first video to see performance data</p>
        </div>
      )}

      {/* Connect account CTA */}
      <div className="mt-6 p-4 rounded-xl bg-[#ff0033]/5 border border-[#ff0033]/10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/60">Connect YouTube Account</p>
          <p className="text-xs text-white/30 mt-0.5">Get real-time views, watch time, CTR, and subscriber data</p>
        </div>
        <button className="px-4 py-2 rounded-xl bg-[#ff0033] hover:bg-[#cc0026] text-xs font-bold text-white transition-colors">
          Connect →
        </button>
      </div>
    </div>
  );
}
