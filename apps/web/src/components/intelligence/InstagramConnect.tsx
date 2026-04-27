"use client";

import { useCallback, useEffect, useState } from "react";
import type { InstagramStatus, InstagramPost } from "@/lib/api";
import {
  fetchInstagramStatus,
  fetchInstagramPosts,
  syncInstagram,
  disconnectInstagram,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function mediaTypeLabel(mt: string): string {
  if (mt === "VIDEO") return "Reel";
  if (mt === "CAROUSEL_ALBUM") return "Carousel";
  return "Post";
}

function mediaTypeColor(mt: string): string {
  if (mt === "VIDEO") return "bg-purple-100 text-purple-700";
  if (mt === "CAROUSEL_ALBUM") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

interface Props {
  /** Notify parent when connection state changes */
  onStatusChange?: (connected: boolean) => void;
}

export default function InstagramConnect({ onStatusChange }: Props) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPosts, setShowPosts] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchInstagramStatus();
      setStatus(s);
      onStatusChange?.(s.connected);
      if (s.connected && s.post_count && s.post_count > 0) {
        const { posts: p } = await fetchInstagramPosts(25);
        setPosts(p);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Handle OAuth redirect back with ?ig_connected=true or ?ig_error=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ig_connected") === "true" || params.get("ig_error")) {
      // Clear the query params then reload status
      const url = new URL(window.location.href);
      url.searchParams.delete("ig_connected");
      url.searchParams.delete("ig_error");
      window.history.replaceState({}, "", url.toString());
      if (params.get("ig_error")) {
        setError(decodeURIComponent(params.get("ig_error") ?? "Unknown error"));
      }
      loadStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncInstagram();
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Instagram? Cached post data will be cleared.")) return;
    await disconnectInstagram();
    setPosts([]);
    await loadStatus();
  };

  const handleConnect = async () => {
    setError(null);
    try {
      // Fetch the actual Facebook OAuth URL from the API, then open it
      const res = await fetch(`${API_BASE}/instagram/auth-url`);
      if (!res.ok) throw new Error(await res.text());
      const { auth_url } = await res.json();
      if (!auth_url) throw new Error("No auth_url returned from API");
      window.open(auth_url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get auth URL");
      return;
    }

    // Poll for connection every 3s for up to 2 min
    let attempts = 0;
    const iv = setInterval(async () => {
      attempts++;
      if (attempts > 40) { clearInterval(iv); return; }
      try {
        const s = await fetchInstagramStatus();
        if (s.connected) {
          clearInterval(iv);
          setStatus(s);
          onStatusChange?.(true);
          if (s.post_count && s.post_count > 0) {
            const { posts: p } = await fetchInstagramPosts(25);
            setPosts(p);
          }
        }
      } catch { /* silent */ }
    }, 3000);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5 animate-pulse">
        <div className="h-4 w-40 bg-white/10 rounded mb-3" />
        <div className="h-20 bg-white/5 rounded-xl" />
      </div>
    );
  }

  // ── Not configured ──────────────────────────────────────────────────────
  if (!status?.configured && !status?.connected) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
        <h3 className="text-[13px] font-bold text-white mb-1">Connect Instagram</h3>
        <p className="text-[11px] text-white/40 mb-4 leading-relaxed">
          Connect your Instagram Business or Creator account to pull real reach, saves,
          engagement rate, and follower data into your Intelligence dashboards.
        </p>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] text-amber-400/80 leading-relaxed">
          <div className="font-semibold mb-1">Setup required</div>
          Add <span className="font-mono">INSTAGRAM_APP_ID</span> and{" "}
          <span className="font-mono">INSTAGRAM_APP_SECRET</span> to{" "}
          <span className="font-mono">apps/api/.env</span> then restart the API.
          See <span className="font-mono">apps/api/.env.example</span> for instructions.
        </div>
      </div>
    );
  }

  // ── Not connected ───────────────────────────────────────────────────────
  if (!status?.connected) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-bold text-white">Connect Instagram</h3>
            <p className="text-[10px] text-white/35 mt-0.5">Pull real performance data into Intelligence</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-amber-400 flex items-center justify-center text-white text-[13px]">
            IG
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-500/20 px-3 py-2 text-[10px] text-red-400 mb-3 leading-relaxed">
            {error}
          </div>
        )}

        <div className="space-y-1.5 mb-4">
          {[
            "Real follower count + growth in Flywheel",
            "Actual reach, saves & shares per post",
            "Published post mix for Portfolio Optimizer",
            "Engagement rate vs. content type breakdown",
          ].map((f) => (
            <div key={f} className="flex items-start gap-2 text-[11px] text-white/50">
              <span className="text-[#39de8b] mt-0.5 shrink-0">✓</span>
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={handleConnect}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[12px] font-bold transition-all"
        >
          Connect Instagram Account
        </button>
        <p className="text-[9px] text-white/25 text-center mt-2">
          Opens Facebook OAuth in a new tab · Read-only access
        </p>
      </div>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────
  const s = status!;
  const topPosts = posts.slice(0, 6);

  return (
    <div className="rounded-2xl border border-white/8 bg-[#12121f] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {s.profile_picture_url ? (
              <img
                src={s.profile_picture_url}
                alt={s.username}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-amber-400 flex items-center justify-center text-white text-[12px] font-bold">
                {(s.username ?? "IG")[0].toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-white">@{s.username}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[10px] text-white/35">{s.account_type ?? "Business"} Account</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[10px] font-semibold disabled:opacity-40 transition-colors"
            >
              {syncing ? "Syncing…" : "↻ Sync"}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-2.5 py-1.5 rounded-lg text-white/25 hover:text-red-400 text-[10px] transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-white/5">
        {[
          { label: "Followers", value: formatNum(s.followers_count ?? 0) },
          { label: "Posts",     value: formatNum(s.post_count ?? 0) },
          { label: "Reach",     value: formatNum(s.total_reach ?? 0) },
          { label: "Saves",     value: formatNum(s.total_saves ?? 0) },
        ].map((stat) => (
          <div key={stat.label} className="px-3 py-3 text-center">
            <div className="text-[14px] font-bold text-white">{stat.value}</div>
            <div className="text-[9px] text-white/30 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Engagement rate */}
      {(s.avg_engagement_rate ?? 0) > 0 && (
        <div className="px-5 py-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-white/35">Avg. engagement rate</span>
          <span className={`text-[11px] font-bold ${(s.avg_engagement_rate ?? 0) >= 3 ? "text-[#39de8b]" : (s.avg_engagement_rate ?? 0) >= 1 ? "text-amber-400" : "text-red-400"}`}>
            {s.avg_engagement_rate?.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Last synced */}
      {s.last_synced_at && (
        <div className="px-5 pb-1 text-[9px] text-white/20">
          Last synced {new Date(s.last_synced_at).toLocaleTimeString()}
        </div>
      )}

      {error && (
        <div className="mx-5 mb-3 rounded-lg bg-red-900/20 border border-red-500/20 px-3 py-2 text-[10px] text-red-400">
          {error}
        </div>
      )}

      {/* Recent posts toggle */}
      {topPosts.length > 0 && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setShowPosts((v) => !v)}
            className="w-full px-5 py-2.5 flex items-center justify-between text-[10px] text-white/40 hover:text-white/60 transition-colors"
          >
            <span>Recent posts ({posts.length})</span>
            <span>{showPosts ? "▲" : "▼"}</span>
          </button>

          {showPosts && (
            <div className="px-4 pb-4 space-y-2">
              {topPosts.map((post) => {
                const reach   = post.insights?.reach ?? 0;
                const saves   = post.insights?.saved ?? 0;
                const shares  = post.insights?.shares ?? 0;
                const plays   = post.insights?.plays ?? post.insights?.video_views ?? 0;
                const date    = new Date(post.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });

                return (
                  <div
                    key={post.id}
                    className="rounded-xl bg-white/3 border border-white/6 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${mediaTypeColor(post.media_type)}`}>
                          {mediaTypeLabel(post.media_type)}
                        </span>
                        <span className="text-[9px] text-white/30">{date}</span>
                      </div>
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] text-white/20 hover:text-white/50 transition-colors"
                        >
                          ↗
                        </a>
                      )}
                    </div>

                    {post.caption && (
                      <p className="text-[10px] text-white/50 leading-relaxed mb-2 line-clamp-2">
                        {post.caption}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[9px] text-white/35">
                      {reach > 0   && <span>↗ {formatNum(reach)} reach</span>}
                      {saves > 0   && <span>⬇ {formatNum(saves)} saves</span>}
                      {shares > 0  && <span>↷ {formatNum(shares)} shares</span>}
                      {plays > 0   && <span>▶ {formatNum(plays)} plays</span>}
                      <span>❤ {formatNum(post.like_count)}</span>
                      <span>💬 {formatNum(post.comments_count)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
