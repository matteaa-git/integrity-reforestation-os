"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchLinkedInAccountStatus,
  fetchLinkedInAuthUrl,
  syncLinkedInAccount,
  disconnectLinkedInAccount,
  type LinkedInAccountStatus,
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-[#0a66c2]/30 bg-[#0a66c2]/5" : "border-gray-200 bg-white"}`}>
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold tracking-tight ${accent ? "text-[#0a66c2]" : "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LinkedInAccountPage() {
  const [status, setStatus]         = useState<LinkedInAccountStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [flash, setFlash]           = useState<string | null>(null);

  // Read OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("li_connected") === "1") {
      setFlash("LinkedIn account connected successfully.");
      window.history.replaceState({}, "", "/linkedin/account");
    }
    if (params.get("li_error")) {
      setError(decodeURIComponent(params.get("li_error")!).replace(/\+/g, " "));
      window.history.replaceState({}, "", "/linkedin/account");
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const s = await fetchLinkedInAccountStatus();
      setStatus(s);
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
      const { auth_url } = await fetchLinkedInAuthUrl();
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
      const result = await syncLinkedInAccount();
      setFlash("Profile synced successfully.");
      if (result.errors.length) setError(result.errors.join(" | "));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your LinkedIn account? Live posting will be disabled.")) return;
    await disconnectLinkedInAccount();
    setStatus({ connected: false });
    setFlash("LinkedIn account disconnected.");
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#0a66c2] flex items-center justify-center shadow-sm">
              <span className="text-white text-[11px] font-black">in</span>
            </div>
            <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight">LinkedIn Account</h1>
            {status?.connected && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                CONNECTED
              </span>
            )}
          </div>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Connect your LinkedIn account to publish posts directly and track engagement.
          </p>
        </div>
        {status?.connected && (
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors disabled:opacity-40"
            >
              {syncing ? "Syncing…" : "↻ Sync"}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium border border-red-200 text-red-400 hover:text-red-600 hover:border-red-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      <div className="px-8 py-6 max-w-4xl mx-auto space-y-8">
        {/* Flash / error */}
        {flash && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px]">
            {flash}
            <button onClick={() => setFlash(null)} className="text-emerald-400 hover:text-emerald-700 ml-3">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px]">
            {error}
            <button onClick={() => setError(null)} className="text-red-300 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-300 text-[13px]">Loading…</div>

        ) : !status?.connected ? (

          /* ── Not connected ── */
          <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0a66c2]/10 border border-[#0a66c2]/20 flex items-center justify-center">
              <span className="text-[#0a66c2] text-2xl font-black">in</span>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Connect your LinkedIn account</h2>
              <p className="text-[13px] text-gray-400 max-w-sm">
                Link your LinkedIn account to publish posts directly from the composer and view your engagement analytics.
              </p>
            </div>

            {!status?.configured && (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[12px] max-w-md text-left">
                <strong>Setup required:</strong> Add <code className="font-mono">LINKEDIN_CLIENT_ID</code> and{" "}
                <code className="font-mono">LINKEDIN_CLIENT_SECRET</code> to{" "}
                <code className="font-mono">apps/api/.env</code>, then restart the API.
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || !status?.configured}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold bg-[#0a66c2] hover:bg-[#004182] text-white transition-colors disabled:opacity-40 shadow-sm"
            >
              {connecting ? "Redirecting…" : "Connect LinkedIn Account"}
            </button>

            {/* Setup steps */}
            <div className="text-left max-w-sm space-y-2 pt-2">
              {[
                { step: "1", text: "Go to developer.linkedin.com and create an app" },
                { step: "2", text: 'Add products: "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn"' },
                { step: "3", text: "Set redirect URL to http://localhost:4000/linkedin/account/callback" },
                { step: "4", text: "Copy Client ID + Secret into apps/api/.env" },
                { step: "5", text: "Restart the API and click Connect above" },
              ].map(({ step, text }) => (
                <div key={step} className="flex gap-3 text-[12px] text-gray-500">
                  <div className="w-5 h-5 rounded-full bg-[#0a66c2]/10 text-[#0a66c2] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {step}
                  </div>
                  {text}
                </div>
              ))}
            </div>

            <div className="text-[11px] text-gray-300 max-w-xs">
              Required scopes: <code className="font-mono">openid profile email w_member_social</code>
            </div>
          </div>

        ) : (

          /* ── Connected ── */
          <>
            {/* Profile card */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
              {status.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={status.picture}
                  alt={status.name}
                  className="w-14 h-14 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#0a66c2]/10 border border-[#0a66c2]/20 flex items-center justify-center text-[#0a66c2] font-black text-xl">
                  in
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[16px] text-gray-900 truncate">{status.name}</div>
                {status.headline && (
                  <div className="text-[12px] text-gray-500 truncate mt-0.5">{status.headline}</div>
                )}
                {status.email && (
                  <div className="text-[11px] text-gray-400 mt-0.5">{status.email}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-gray-400">Last synced</div>
                <div className="text-[12px] text-gray-600">{relTime(status.last_synced_at)}</div>
              </div>
            </div>

            {/* Studio analytics from published posts */}
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Studio Analytics
              </h2>
              <div className="grid grid-cols-4 gap-3">
                <StatCard
                  label="Published Posts"
                  value={fmt(status.published_posts)}
                  accent
                />
                <StatCard
                  label="Total Est. Reach"
                  value={fmt(status.total_impressions)}
                />
                <StatCard
                  label="Total Reactions"
                  value={fmt(status.total_reactions)}
                />
                <StatCard
                  label="Avg TL Score"
                  value={String(status.avg_thought_leadership_score ?? "—")}
                  sub="thought leadership"
                  accent={Number(status.avg_thought_leadership_score) >= 65}
                />
              </div>
            </div>

            {/* Live posting info */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="text-[12px] font-semibold text-gray-600">Live Posting</h3>
              <p className="text-[12px] text-gray-400 leading-relaxed">
                Posts published from the LinkedIn Studio Composer are sent directly to your LinkedIn profile via the
                UGC Posts API. Click <strong>Publish Now</strong> in the composer to go live immediately,
                or use the Schedule flow to queue a post for a specific time.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-gray-400">
                  Posting as <strong className="text-gray-700">{status.name}</strong> · OAuth 2.0 ·
                  Scopes: openid profile email w_member_social
                </span>
              </div>
            </div>

            {/* Developer portal link */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-gray-700">Manage LinkedIn App</div>
                <div className="text-[11px] text-gray-400">developer.linkedin.com · view scopes, analytics, rate limits</div>
              </div>
              <a
                href="https://developer.linkedin.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[#0a66c2]/30 text-[#0a66c2] hover:bg-[#0a66c2]/5 transition-colors"
              >
                Open Portal →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
