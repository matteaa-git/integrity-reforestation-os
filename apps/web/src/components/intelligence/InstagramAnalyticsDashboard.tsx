"use client";

import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend,
} from "recharts";
import type { InstagramAnalytics } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

// ── Color palette ─────────────────────────────────────────────────────────────
const GREEN = "#39de8b";
const TEAL = "#002a27";
const GOLD = "#fbb700";
const BLUE = "#60a5fa";
const PURPLE = "#a78bfa";
const TYPE_COLORS: Record<string, string> = {
  IMAGE: GREEN,
  VIDEO: BLUE,
  CAROUSEL_ALBUM: GOLD,
  REEL: PURPLE,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso; }
}

function fmtHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function typeLabel(mt: string): string {
  const map: Record<string, string> = {
    IMAGE: "Photo",
    VIDEO: "Video",
    CAROUSEL_ALBUM: "Carousel",
    REEL: "Reel",
  };
  return map[mt] ?? mt;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false, icon }: {
  label: string; value: string; sub?: string; accent?: boolean; icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#12121f] px-5 py-4">
      {icon && <div className="text-[18px] mb-2">{icon}</div>}
      <div className="text-[9px] font-semibold text-white/35 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-[26px] font-bold leading-none ${accent ? "text-[#39de8b]" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[9px] text-white/30 mt-1">{sub}</div>}
    </div>
  );
}

// ── Post thumbnail card ───────────────────────────────────────────────────────
function PostCard({ post, rank }: { post: any; rank?: number }) {
  const thumb = post.thumbnail_url || post.media_url;
  const mt = post.media_type || "IMAGE";

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-xl overflow-hidden border border-white/8 bg-[#12121f] hover:border-white/20 transition-all"
    >
      <div className="relative aspect-square bg-white/5 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">
            {mt === "VIDEO" || mt === "REEL" ? "▶" : "◻"}
          </div>
        )}
        {rank !== undefined && (
          <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#39de8b] text-[#002a27] text-[9px] font-bold flex items-center justify-center">
            {rank}
          </div>
        )}
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-semibold"
          style={{ backgroundColor: TYPE_COLORS[mt] + "33", color: TYPE_COLORS[mt], border: `1px solid ${TYPE_COLORS[mt]}40` }}>
          {typeLabel(mt)}
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-white/30">{fmtDate(post.timestamp)}</span>
          <span className="text-[10px] font-bold text-[#39de8b]">{post.engagement_rate}%</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Micro label="❤" value={fmt(post.like_count || 0)} />
          <Micro label="💬" value={fmt(post.comments_count || 0)} />
          <Micro label="🔖" value={fmt(post.saves || 0)} />
        </div>
        {post.reach > 0 && (
          <div className="mt-1.5 text-[9px] text-white/25">
            {fmt(post.reach)} reach · {fmt(post.impressions || 0)} impressions
          </div>
        )}
      </div>
    </a>
  );
}

function Micro({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[8px]">{label}</div>
      <div className="text-[10px] font-semibold text-white/60">{value}</div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-xs shadow-xl">
      <div className="text-white/50 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
type TopTab = "engagement" | "reach" | "saves";
type Section = "overview" | "posts" | "audience" | "timing";

interface Props {
  data: InstagramAnalytics;
  onSync: () => void;
  syncing: boolean;
}

export default function InstagramAnalyticsDashboard({ data, onSync, syncing }: Props) {
  const [topTab, setTopTab] = useState<TopTab>("engagement");
  const [section, setSection] = useState<Section>("overview");
  const [postSort, setPostSort] = useState<"engagement_rate" | "reach" | "saves" | "timestamp">("timestamp");

  const { account, summary, follower_growth, daily_metrics, audience, content_mix, posts,
    top_by_engagement, top_by_reach, top_by_saves, best_hours, best_days } = data;

  // ── Build follower growth chart data ──
  const growthData = follower_growth.map((v) => ({
    date: fmtDate(v.end_time),
    followers: v.value,
  }));

  // ── Build daily reach chart ──
  const reachSeries = (daily_metrics.reach || []).map((v) => ({
    date: fmtDate(v.end_time),
    reach: v.value,
    impressions: 0,
  }));
  const impressionMap: Record<string, number> = {};
  (daily_metrics.impressions || []).forEach((v) => {
    impressionMap[fmtDate(v.end_time)] = v.value;
  });
  reachSeries.forEach((d) => { d.impressions = impressionMap[d.date] || 0; });

  // ── Top posts to display ──
  const topPosts = topTab === "engagement" ? top_by_engagement
    : topTab === "reach" ? top_by_reach
    : top_by_saves;

  // ── Sorted post table ──
  const sortedPosts = [...posts].sort((a: any, b: any) => {
    if (postSort === "timestamp") return (b.timestamp || "").localeCompare(a.timestamp || "");
    return ((b as any)[postSort] || 0) - ((a as any)[postSort] || 0);
  });

  // ── Audience gender/age ──
  const genderAge = audience.audience_gender_age || {};
  const genderAgeRows = Object.entries(genderAge)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, val]) => ({ key, val }));
  const genderAgeTotal = genderAgeRows.reduce((s, r) => s + r.val, 0) || 1;

  const topCountries = Object.entries(audience.audience_country || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCities = Object.entries(audience.audience_city || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const audienceTotal = topCountries.reduce((s, [, v]) => s + v, 0) || 1;

  // ── Content mix for pie chart ──
  const pieData = content_mix.map((c) => ({
    name: typeLabel(c.type),
    value: c.count,
    fill: TYPE_COLORS[c.type] || GREEN,
  }));

  const SECTIONS: { key: Section; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "posts", label: "All Posts" },
    { key: "audience", label: "Audience" },
    { key: "timing", label: "Best Times" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Account header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {account.profile_picture_url && (
            <img src={account.profile_picture_url} alt={account.username}
              className="w-12 h-12 rounded-full border-2 border-[#39de8b]/40" />
          )}
          <div>
            <div className="text-[16px] font-bold text-white">@{account.username}</div>
            <div className="text-[10px] text-white/35 mt-0.5">
              {account.last_synced_at ? `Last synced ${fmtDate(account.last_synced_at)}` : "Not yet synced"}
            </div>
          </div>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#39de8b]/10 hover:bg-[#39de8b]/20 text-[#39de8b] text-[11px] font-semibold border border-[#39de8b]/25 transition-colors disabled:opacity-50"
        >
          <span className={syncing ? "animate-spin" : ""}>↻</span>
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      </div>

      {/* ── Section tabs ── */}
      <div className="flex gap-0.5 border-b border-white/8">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-4 py-2.5 text-[11px] font-medium border-b-2 transition-colors ${
              section === s.key ? "border-[#39de8b] text-[#39de8b]" : "border-transparent text-white/40 hover:text-white/60"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {section === "overview" && (
        <div className="space-y-6">

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Followers" value={fmt(account.followers_count)} accent icon="👥" />
            <StatCard label="Avg Engagement" value={`${summary.avg_engagement_rate}%`} accent={summary.avg_engagement_rate >= 3} icon="💡" />
            <StatCard label="Total Reach (all posts)" value={fmt(summary.total_reach)} icon="📡" />
            <StatCard label="Total Saves" value={fmt(summary.total_saves)} icon="🔖" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Posts" value={String(summary.total_posts)} />
            <StatCard label="Total Likes" value={fmt(summary.total_likes)} />
            <StatCard label="Total Comments" value={fmt(summary.total_comments)} />
            <StatCard label="Total Shares" value={fmt(summary.total_shares)} />
          </div>

          {/* Follower growth chart */}
          {growthData.length > 1 && (
            <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
              <div className="text-[12px] font-bold text-white mb-1">Follower Growth (30 days)</div>
              <div className="text-[10px] text-white/30 mb-4">Daily follower count</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="date" tick={{ fill: "#ffffff30", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#ffffff30", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="followers" stroke={GREEN} strokeWidth={2} dot={false} name="Followers" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily reach + impressions */}
          {reachSeries.length > 1 && (
            <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
              <div className="text-[12px] font-bold text-white mb-1">Reach & Impressions (30 days)</div>
              <div className="text-[10px] text-white/30 mb-4">Daily account reach vs impressions</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={reachSeries} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="date" tick={{ fill: "#ffffff30", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#ffffff30", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="reach" fill={GREEN} fillOpacity={0.8} radius={[2, 2, 0, 0]} name="Reach" />
                  <Bar dataKey="impressions" fill={BLUE} fillOpacity={0.5} radius={[2, 2, 0, 0]} name="Impressions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Content mix + top posts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Content type breakdown */}
            <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
              <div className="text-[12px] font-bold text-white mb-4">Content Mix</div>
              {pieData.length > 0 && (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} posts`, ""]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", color: "#ffffff60" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 space-y-2">
                {content_mix.map((c) => (
                  <div key={c.type} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[c.type] || GREEN }} />
                      <span className="text-white/60">{typeLabel(c.type)}</span>
                    </div>
                    <div className="flex gap-3 text-white/40">
                      <span>{c.count} posts</span>
                      <span>{fmt(c.avg_reach)} avg reach</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement rate per content type */}
            {content_mix.length > 0 && (
              <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
                <div className="text-[12px] font-bold text-white mb-4">Avg Engagement by Type</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={content_mix.map(c => ({ name: typeLabel(c.type), engagement: c.avg_engagement, saves: c.avg_saves }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis type="number" tick={{ fill: "#ffffff30", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "#ffffff50", fontSize: 9 }} tickLine={false} axisLine={false} width={60} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="engagement" fill={GREEN} fillOpacity={0.8} radius={[0, 2, 2, 0]} name="Avg Eng." />
                    <Bar dataKey="saves" fill={GOLD} fillOpacity={0.7} radius={[0, 2, 2, 0]} name="Avg Saves" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top posts */}
          <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[12px] font-bold text-white">Top Posts</div>
              <div className="flex gap-1">
                {(["engagement", "reach", "saves"] as TopTab[]).map((t) => (
                  <button key={t} onClick={() => setTopTab(t)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-semibold capitalize transition-colors ${
                      topTab === t ? "bg-[#39de8b]/20 text-[#39de8b] border border-[#39de8b]/30" : "text-white/30 hover:text-white/50"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {topPosts.slice(0, 9).map((post: any, i) => (
                <PostCard key={post.id} post={post} rank={i + 1} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ ALL POSTS ══════════════════════════════════════════════════════════ */}
      {section === "posts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/40">Sort by:</span>
            {(["timestamp", "engagement_rate", "reach", "saves"] as const).map((s) => (
              <button key={s} onClick={() => setPostSort(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium capitalize transition-colors ${
                  postSort === s ? "bg-[#39de8b]/15 text-[#39de8b] border border-[#39de8b]/25" : "text-white/35 hover:text-white/60"
                }`}>
                {s === "timestamp" ? "Newest" : s.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#12121f] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left px-4 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Post</th>
                  <th className="text-right px-3 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Date</th>
                  <th className="text-right px-3 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Reach</th>
                  <th className="text-right px-3 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Impr.</th>
                  <th className="text-right px-3 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Likes</th>
                  <th className="text-right px-3 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Comments</th>
                  <th className="text-right px-3 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Saves</th>
                  <th className="text-right px-3 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Shares</th>
                  <th className="text-right px-4 py-3 text-[9px] font-semibold text-white/30 uppercase tracking-wider">Eng. Rate</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map((post: any, i) => {
                  const thumb = post.thumbnail_url || post.media_url;
                  const engColor = post.engagement_rate >= 5 ? "#39de8b" : post.engagement_rate >= 2 ? "#f59e0b" : "#ffffff60";
                  return (
                    <tr key={post.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                      <td className="px-4 py-3">
                        <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 group">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 shrink-0">
                            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : (
                              <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px]">◻</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] font-medium px-1.5 py-0.5 rounded inline-block"
                              style={{ backgroundColor: (TYPE_COLORS[post.media_type] || GREEN) + "20", color: TYPE_COLORS[post.media_type] || GREEN }}>
                              {typeLabel(post.media_type)}
                            </div>
                            <div className="text-[10px] text-white/50 truncate max-w-[160px] mt-0.5 group-hover:text-white/70">
                              {post.caption?.slice(0, 60) || "No caption"}
                            </div>
                          </div>
                        </a>
                      </td>
                      <td className="px-3 py-3 text-right text-[10px] text-white/35">{fmtDate(post.timestamp)}</td>
                      <td className="px-3 py-3 text-right text-[11px] text-white/70 font-medium">{fmt(post.reach || 0)}</td>
                      <td className="px-3 py-3 text-right text-[10px] text-white/40">{fmt(post.impressions || 0)}</td>
                      <td className="px-3 py-3 text-right text-[10px] text-white/60">{fmt(post.like_count || 0)}</td>
                      <td className="px-3 py-3 text-right text-[10px] text-white/60">{fmt(post.comments_count || 0)}</td>
                      <td className="px-3 py-3 text-right text-[10px] text-white/60">{fmt(post.saves || 0)}</td>
                      <td className="px-3 py-3 text-right text-[10px] text-white/60">{fmt(post.shares || 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] font-bold" style={{ color: engColor }}>{post.engagement_rate}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ AUDIENCE ══════════════════════════════════════════════════════════ */}
      {section === "audience" && (
        <div className="space-y-5">
          {Object.keys(audience).length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-[#12121f] p-10 text-center">
              <div className="text-white/20 text-3xl mb-3">👥</div>
              <div className="text-[12px] text-white/40">Audience demographics require the <span className="text-white/60">instagram_manage_insights</span> permission</div>
              <div className="text-[10px] text-white/25 mt-1">Re-sync after granting the permission in your Facebook App settings</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Gender / Age */}
              {genderAgeRows.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
                  <div className="text-[12px] font-bold text-white mb-4">Gender & Age Breakdown</div>
                  <div className="space-y-2">
                    {genderAgeRows.map((r) => {
                      const pct = Math.round((r.val / genderAgeTotal) * 100);
                      const isMale = r.key.startsWith("M.");
                      return (
                        <div key={r.key}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-white/50">{r.key}</span>
                            <span className="text-[10px] font-semibold text-white/70">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${pct}%`,
                              backgroundColor: isMale ? BLUE : GREEN,
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top countries */}
              {topCountries.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
                  <div className="text-[12px] font-bold text-white mb-4">Top Countries</div>
                  <div className="space-y-2.5">
                    {topCountries.map(([country, count]) => {
                      const pct = Math.round((count / audienceTotal) * 100);
                      return (
                        <div key={country}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-white/60">{country}</span>
                            <span className="text-[10px] font-semibold text-white/70">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full">
                            <div className="h-full rounded-full bg-[#39de8b]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top cities */}
              {topCities.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5 md:col-span-2">
                  <div className="text-[12px] font-bold text-white mb-4">Top Cities</div>
                  <div className="grid grid-cols-2 gap-3">
                    {topCities.map(([city, count]) => (
                      <div key={city} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                        <span className="text-[11px] text-white/60">{city}</span>
                        <span className="text-[11px] font-semibold text-white/70">{fmt(count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ BEST TIMES ════════════════════════════════════════════════════════ */}
      {section === "timing" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
            <div className="text-[12px] font-bold text-white mb-1">Best Times to Post</div>
            <div className="text-[10px] text-white/30 mb-5">Derived from your top-performing posts by engagement rate</div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Best Hours</div>
                {best_hours.length > 0 ? (
                  <div className="space-y-2">
                    {best_hours.map((h, i) => (
                      <div key={h} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                          style={{ backgroundColor: i === 0 ? GREEN : i === 1 ? GOLD : "#ffffff20", color: i < 2 ? "#000" : "#fff" }}>
                          {i + 1}
                        </div>
                        <span className="text-[14px] font-bold text-white">{fmtHour(h)}</span>
                        {i === 0 && <span className="text-[9px] text-[#39de8b] font-semibold">Best</span>}
                      </div>
                    ))}
                  </div>
                ) : <div className="text-[10px] text-white/25">Not enough data yet</div>}
              </div>
              <div>
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">Best Days</div>
                {best_days.length > 0 ? (
                  <div className="space-y-2">
                    {best_days.map((d, i) => (
                      <div key={d} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                          style={{ backgroundColor: i === 0 ? GREEN : i === 1 ? GOLD : "#ffffff20", color: i < 2 ? "#000" : "#fff" }}>
                          {i + 1}
                        </div>
                        <span className="text-[14px] font-bold text-white">{d}</span>
                        {i === 0 && <span className="text-[9px] text-[#39de8b] font-semibold">Best</span>}
                      </div>
                    ))}
                  </div>
                ) : <div className="text-[10px] text-white/25">Not enough data yet</div>}
              </div>
            </div>
          </div>

          {/* Heatmap by hour (from all posts) */}
          {posts.length > 0 && (() => {
            const hourCounts: Record<number, { total: number; eng: number }> = {};
            posts.forEach((p: any) => {
              try {
                const h = new Date(p.timestamp).getHours();
                if (!hourCounts[h]) hourCounts[h] = { total: 0, eng: 0 };
                hourCounts[h].total += 1;
                hourCounts[h].eng += p.engagement_rate || 0;
              } catch { /* ignore */ }
            });
            const heatData = Array.from({ length: 24 }, (_, h) => ({
              hour: fmtHour(h),
              posts: hourCounts[h]?.total || 0,
              avg_eng: hourCounts[h] ? Math.round((hourCounts[h].eng / hourCounts[h].total) * 10) / 10 : 0,
            }));
            return (
              <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
                <div className="text-[12px] font-bold text-white mb-1">Post Activity by Hour</div>
                <div className="text-[10px] text-white/30 mb-4">Number of posts published per hour of day</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={heatData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="hour" tick={{ fill: "#ffffff25", fontSize: 8 }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fill: "#ffffff25", fontSize: 9 }} tickLine={false} axisLine={false} width={25} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="posts" fill={GREEN} fillOpacity={0.7} radius={[2, 2, 0, 0]} name="Posts" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
