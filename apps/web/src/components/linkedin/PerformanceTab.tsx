"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Analytics {
  total_posts: number;
  total_impressions: number;
  total_reactions: number;
  total_comments: number;
  total_shares: number;
  avg_thought_leadership_score: number;
  top_post_id: string | null;
  top_post_preview: string | null;
  top_post_impressions: number;
  followers_gained: number;
  profile_views: number;
}

function StatCard({ label, value, sub, color = "text-text-primary" }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <div className={`text-2xl font-bold ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[11px] font-medium text-text-secondary mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

const TLS_TIERS = [
  { label: "Elite",   range: "75–100", color: "bg-emerald-500", desc: "Top thought leader content" },
  { label: "Strong",  range: "50–74",  color: "bg-amber-400",   desc: "Solid professional content" },
  { label: "Average", range: "25–49",  color: "bg-gray-300",    desc: "Needs more hook / depth" },
  { label: "Weak",    range: "0–24",   color: "bg-red-200",     desc: "Revise before publishing" },
];

export default function PerformanceTab() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/linkedin/analytics/summary`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#0a66c2]/30 border-t-[#0a66c2] rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="p-6 text-[11px] text-red-600">{error ?? "No data"}</div>
  );

  const engRate = data.total_impressions > 0
    ? ((data.total_reactions + data.total_comments + data.total_shares) / data.total_impressions * 100).toFixed(2)
    : "0.00";

  return (
    <div className="p-6 max-w-4xl space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Posts"      value={data.total_posts} />
        <StatCard label="Impressions"       value={data.total_impressions} color="text-[#0a66c2]" />
        <StatCard label="Reactions"         value={data.total_reactions}   color="text-emerald-600" />
        <StatCard label="Comments"          value={data.total_comments}    color="text-amber-600" />
        <StatCard label="Engagement Rate"   value={`${engRate}%`}         color="text-purple-600" sub="Reactions + Comments + Shares / Impressions" />
        <StatCard label="Followers Gained"  value={data.followers_gained}  color="text-emerald-600" />
        <StatCard label="Profile Views"     value={data.profile_views}     color="text-blue-500" />
        <StatCard label="Shares"            value={data.total_shares}      color="text-indigo-600" />
        <StatCard
          label="Avg TL Score"
          value={data.avg_thought_leadership_score}
          color={data.avg_thought_leadership_score >= 75 ? "text-emerald-600" : data.avg_thought_leadership_score >= 50 ? "text-amber-600" : "text-gray-500"}
          sub="Thought Leadership Score"
        />
      </div>

      {/* Top post */}
      {data.top_post_preview && (
        <div>
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-3">Top Performing Post</div>
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#002a27] flex items-center justify-center text-white text-sm font-bold shrink-0">
                IR
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-text-primary mb-0.5">Integrity Reforestation</div>
                <div className="text-[11px] text-[#0a66c2] mb-2">Tree Planting Services</div>
                <p className="text-[13px] text-text-primary leading-relaxed line-clamp-3 whitespace-pre-wrap">
                  {data.top_post_preview}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border-light flex items-center gap-5 text-[11px] text-text-tertiary">
              <span className="text-[#0a66c2] font-semibold">
                {data.top_post_impressions.toLocaleString()} impressions
              </span>
              <span className="font-mono text-text-tertiary/60 text-[10px]">{data.top_post_id}</span>
            </div>
          </div>
        </div>
      )}

      {/* TLS tiers */}
      <div>
        <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-3">
          Thought Leadership Score Tiers
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TLS_TIERS.map((t) => (
            <div key={t.label} className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${t.color}`} />
              <div>
                <div className="text-[12px] font-bold text-text-primary">
                  {t.label}
                  <span className="text-[10px] font-normal text-text-tertiary ml-1.5">{t.range}</span>
                </div>
                <div className="text-[10px] text-text-tertiary">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Writing tips */}
      <div>
        <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-3">
          LinkedIn Algorithm Tips
        </div>
        <div className="bg-white rounded-xl border border-border divide-y divide-border-light">
          {[
            { icon: "⏰", tip: "Best times: Tue–Thu 7–9am, 12pm (EST)" },
            { icon: "📝", tip: "Text posts often outperform images for reach — the algorithm rewards dwell time" },
            { icon: "🔗", tip: "Avoid external links in the post body — add them in the first comment instead" },
            { icon: "💬", tip: "Responding to every comment in the first 60 minutes boosts algorithm reach" },
            { icon: "#️⃣", tip: "3–5 niche hashtags outperform 10+ generic tags" },
            { icon: "📊", tip: "Polls drive 3–5× more comments than standard text posts" },
          ].map(({ icon, tip }) => (
            <div key={tip} className="flex items-start gap-3 px-4 py-3">
              <span className="text-base shrink-0 mt-0.5">{icon}</span>
              <p className="text-[12px] text-text-secondary leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
