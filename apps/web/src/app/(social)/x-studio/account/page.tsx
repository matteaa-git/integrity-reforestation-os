"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchXAccountStatus,
  fetchXAccountAuthUrl,
  syncXAccount,
  disconnectXAccount,
  fetchXAccountPosts,
  type XAccountStatus,
  type XCachedPost,
} from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-sky-500/30 bg-sky-500/5" : "border-white/8 bg-white/3"}`}>
      <div className="text-[11px] text-white/40 mb-1">{label}</div>
      <div className={`text-2xl font-bold tracking-tight ${accent ? "text-sky-400" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Top post row ──────────────────────────────────────────────────────────────

function PostRow({ post, rank }: { post: XCachedPost; rank: number }) {
  const rate = post.impressions > 0
    ? ((post.engagements / post.impressions) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="flex gap-3 py-3 border-b border-white/6 last:border-0">
      <div className="w-5 text-[11px] text-white/20 font-mono pt-0.5 shrink-0">{rank}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white/80 leading-snug line-clamp-2">{post.text}</p>
        <div className="flex gap-4 mt-1.5 text-[11px] text-white/35">
          <span>{fmt(post.impressions)} impr</span>
          <span>{fmt(post.likes)} likes</span>
          <span>{fmt(post.repost_count)} RT</span>
          <span>{fmt(post.replies)} replies</span>
          <span className="text-sky-400/70">{rate}% eng</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function XAccountPage() {
  const [status, setStatus]     = useState<XAccountStatus | null>(null);
  const [posts, setPosts]       = useState<XCachedPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [flash, setFlash]       = useState<string | null>(null);

  // Read URL params set by OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("x_connected") === "1") {
      setFlash("X account connected successfully.");
      window.history.replaceState({}, "", "/x-studio/account");
    }
    if (params.get("x_error")) {
      setError(decodeURIComponent(params.get("x_error")!));
      window.history.replaceState({}, "", "/x-studio/account");
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const s = await fetchXAccountStatus();
      setStatus(s);
      if (s.connected) {
        const p = await fetchXAccountPosts(20);
        setPosts(p.posts);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const { auth_url } = await fetchXAccountAuthUrl();
      window.location.href = auth_url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to get auth URL");
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncXAccount();
      setFlash(`Synced ${result.synced} tweets.`);
      if (result.errors.length) setError(result.errors.join(" | "));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your X account? Live posting will be disabled.")) return;
    await disconnectXAccount();
    setStatus({ connected: false });
    setPosts([]);
    setFlash("X account disconnected.");
  }

  const sortedPosts = [...posts].sort((a, b) => b.impressions - a.impressions);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Header */}
      <div className="border-b border-white/8 px-8 py-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">𝕏</span>
            <h1 className="text-[17px] font-semibold tracking-tight">X Account</h1>
            {status?.connected && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                LIVE
              </span>
            )}
          </div>
          <p className="text-[12px] text-white/35 mt-0.5">
            Connect your X account for live posting and real-time analytics.
          </p>
        </div>
        {status?.connected && (
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium border border-white/12 text-white/60 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40"
            >
              {syncing ? "Syncing…" : "↻ Sync"}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto space-y-8">
        {/* Flash / error */}
        {flash && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[13px]">
            {flash}
            <button onClick={() => setFlash(null)} className="text-green-400/50 hover:text-green-400">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
            {error}
            <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-white/25 text-[13px]">Loading…</div>
        ) : !status?.connected ? (
          /* ── Not connected ── */
          <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
              𝕏
            </div>
            <div>
              <h2 className="text-[15px] font-semibold mb-1">Connect your X account</h2>
              <p className="text-[13px] text-white/40 max-w-sm">
                Link your X account to post directly from the composer, schedule tweets, and pull live analytics.
              </p>
            </div>

            {!status?.configured && (
              <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px] max-w-md text-left">
                <strong>Setup required:</strong> Add <code className="font-mono">X_CLIENT_ID</code> and{" "}
                <code className="font-mono">X_CLIENT_SECRET</code> to <code className="font-mono">apps/api/.env</code> then restart the API.
                Register your app at{" "}
                <span className="underline underline-offset-2">developer.twitter.com</span> with OAuth 2.0 enabled.
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || !status?.configured}
              className="px-6 py-2.5 rounded-xl text-[13px] font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-colors disabled:opacity-40"
            >
              {connecting ? "Redirecting…" : "Connect X Account"}
            </button>

            <div className="text-[11px] text-white/20 max-w-xs">
              Requires scopes: <code className="font-mono">tweet.read tweet.write users.read offline.access</code>
            </div>
          </div>
        ) : (
          /* ── Connected ── */
          <>
            {/* Profile card */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-5 flex items-center gap-4">
              {status.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={status.profile_image_url}
                  alt={status.username}
                  className="w-12 h-12 rounded-full object-cover border border-white/10"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-lg">
                  {(status.username ?? "X")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] truncate">{status.name ?? status.username}</div>
                <div className="text-[12px] text-white/40">@{status.username}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white/30">Last synced</div>
                <div className="text-[12px] text-white/55">{relTime(status.last_synced_at)}</div>
              </div>
            </div>

            {/* Account stats */}
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">Account</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Followers" value={fmt(status.followers_count)} />
                <StatCard label="Following" value={fmt(status.following_count)} />
                <StatCard label="Total Tweets" value={fmt(status.tweet_count)} />
              </div>
            </div>

            {/* Analytics summary */}
            {(status.post_count ?? 0) > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">
                  Analytics — Last {status.post_count} Posts
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  <StatCard
                    label="Total Impressions"
                    value={fmt(status.total_impressions)}
                    accent
                  />
                  <StatCard
                    label="Total Engagements"
                    value={fmt(status.total_engagements)}
                  />
                  <StatCard
                    label="Total Reposts"
                    value={fmt(status.total_reposts)}
                  />
                  <StatCard
                    label="Avg Engagement Rate"
                    value={`${status.avg_engagement_rate?.toFixed(1) ?? "0.0"}%`}
                    accent={Number(status.avg_engagement_rate) >= 2}
                  />
                </div>
              </div>
            )}

            {/* Top posts */}
            {sortedPosts.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">
                  Top Posts by Impressions
                </h2>
                <div className="rounded-xl border border-white/8 bg-white/3 px-5 py-1">
                  {sortedPosts.slice(0, 10).map((post, i) => (
                    <PostRow key={post.tweet_id} post={post} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {sortedPosts.length === 0 && (
              <div className="text-center py-10 text-white/25 text-[13px]">
                No posts synced yet.{" "}
                <button onClick={handleSync} className="text-sky-400 hover:underline">
                  Sync now
                </button>
              </div>
            )}

            {/* Setup notes */}
            <div className="rounded-xl border border-white/6 bg-white/2 p-5 space-y-3">
              <h3 className="text-[12px] font-semibold text-white/50">Live Posting</h3>
              <p className="text-[12px] text-white/30 leading-relaxed">
                Posts published from the X Studio Composer will be sent directly to your X account via the API.
                Threads are posted sequentially with the correct reply chain. The Post Now button in the Composer
                will go live immediately; the Schedule flow queues for the worker to dispatch at the selected time.
              </p>
              <p className="text-[12px] text-white/25 leading-relaxed">
                X API v2 · OAuth 2.0 PKCE · Scopes: tweet.read tweet.write users.read offline.access
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
