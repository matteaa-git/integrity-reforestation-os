"use client";

import { useEffect, useState } from "react";

interface Analytics {
  total_pins: number;
  total_impressions: number;
  total_saves: number;
  total_clicks: number;
  total_closeups: number;
  avg_pin_score: number;
  top_pin_id: string | null;
  top_pin_title: string | null;
  top_pin_impressions: number;
  monthly_views: number;
  profile_visits: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function KPI({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-[#E60023]/20 bg-[#E60023]/5" : "border-gray-200 bg-white"}`}>
      <div className="text-[10px] text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent ? "text-[#E60023]" : "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-[11px] text-gray-600 truncate shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#E60023]/70 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 text-right text-[11px] font-semibold text-gray-700 shrink-0">{fmt(value)}</div>
    </div>
  );
}

const TIPS = [
  { icon: "📌", tip: "Vertical pins (2:3) get 60% more impressions than square pins." },
  { icon: "🔑", tip: "Put your top keyword in the first 30 characters of your title — it ranks in Google." },
  { icon: "📋", tip: "Pins saved to niche boards distribute faster than general boards." },
  { icon: "🕐", tip: "Best times to post: Fri–Sun evenings and Sat morning 8–11am PST." },
  { icon: "♻", tip: "Repinning your top performers to new boards resets their distribution window." },
];

export default function PerformanceTab() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/pinterest/analytics/summary`)
      .then(r => r.json())
      .then(setAnalytics)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400 text-[13px]">Loading…</div>;
  if (!analytics) return null;

  const saveRate   = analytics.total_impressions > 0 ? ((analytics.total_saves / analytics.total_impressions) * 100).toFixed(1) : "0.0";
  const clickRate  = analytics.total_impressions > 0 ? ((analytics.total_clicks / analytics.total_impressions) * 100).toFixed(1) : "0.0";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Monthly Views" value={fmt(analytics.monthly_views)} sub="estimated" accent />
        <KPI label="Total Impressions" value={fmt(analytics.total_impressions)} />
        <KPI label="Total Saves" value={fmt(analytics.total_saves)} sub={`${saveRate}% save rate`} />
        <KPI label="Total Clicks" value={fmt(analytics.total_clicks)} sub={`${clickRate}% click rate`} />
        <KPI label="Closeups" value={fmt(analytics.total_closeups)} />
        <KPI label="Profile Visits" value={fmt(analytics.profile_visits)} />
      </div>

      {/* Top pin */}
      {analytics.top_pin_id && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Top Performing Pin</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-12 rounded-lg bg-[#E60023]/10 flex items-center justify-center text-[#E60023] shrink-0">📌</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-gray-800 truncate">{analytics.top_pin_title || "Untitled"}</div>
              <div className="text-[11px] text-gray-400">{fmt(analytics.top_pin_impressions)} impressions</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-gray-400">Avg Pin Score</div>
              <div className={`text-lg font-bold ${analytics.avg_pin_score >= 70 ? "text-emerald-600" : "text-amber-600"}`}>
                {analytics.avg_pin_score}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engagement breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-4">Engagement Breakdown</div>
        <div className="space-y-3">
          {[
            { label: "Impressions", value: analytics.total_impressions },
            { label: "Saves", value: analytics.total_saves },
            { label: "Clicks", value: analytics.total_clicks },
            { label: "Closeups", value: analytics.total_closeups },
            { label: "Profile Visits", value: analytics.profile_visits },
          ].map((row) => (
            <BarRow key={row.label} label={row.label} value={row.value} max={analytics.total_impressions} />
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Pinterest Growth Tips</div>
        <div className="space-y-2.5">
          {TIPS.map((t) => (
            <div key={t.tip} className="flex gap-2.5 items-start">
              <span className="text-sm shrink-0">{t.icon}</span>
              <p className="text-[12px] text-gray-600 leading-snug">{t.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
