"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchPinterestAccountStatus,
  fetchPinterestAuthUrl,
  syncPinterestAccount,
  disconnectPinterestAccount,
  fetchPinterestBoards,
  fetchPinterestCachedPins,
  type PinterestAccountStatus,
  type PinterestBoard,
  type PinterestCachedPin,
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
    <div className={`rounded-xl border p-4 ${accent ? "border-[#E60023]/30 bg-[#E60023]/5" : "border-gray-200 bg-white"}`}>
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold tracking-tight ${accent ? "text-[#E60023]" : "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function BoardCard({ board }: { board: PinterestBoard }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-[#E60023]/10 border border-[#E60023]/20 flex items-center justify-center text-[#E60023] shrink-0">
        📋
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-900 truncate">{board.name}</div>
        <div className="text-[11px] text-gray-400">
          {fmt(board.pin_count)} pins · {fmt(board.follower_count)} followers
        </div>
      </div>
      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
        board.privacy === "PUBLIC" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`}>
        {board.privacy}
      </span>
    </div>
  );
}

function PinRow({ pin, rank }: { pin: PinterestCachedPin; rank: number }) {
  const saveRate = pin.impression_count > 0
    ? ((pin.save_count / pin.impression_count) * 100).toFixed(1)
    : "0.0";
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-5 text-[11px] text-gray-300 font-mono pt-0.5 shrink-0">{rank}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-800 font-medium leading-snug truncate">
          {pin.title || <span className="text-gray-400 italic">Untitled</span>}
        </p>
        <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{pin.description}</p>
        <div className="flex gap-4 mt-1.5 text-[11px] text-gray-400">
          <span>{fmt(pin.impression_count)} impr</span>
          <span>{fmt(pin.save_count)} saves</span>
          <span>{fmt(pin.outbound_clicks)} clicks</span>
          <span className="text-[#E60023]/80">{saveRate}% save rate</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PinterestAccountPage() {
  const [status, setStatus]       = useState<PinterestAccountStatus | null>(null);
  const [boards, setBoards]       = useState<PinterestBoard[]>([]);
  const [pins, setPins]           = useState<PinterestCachedPin[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [flash, setFlash]         = useState<string | null>(null);

  // Read OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("p_connected") === "1") {
      setFlash("Pinterest account connected successfully.");
      window.history.replaceState({}, "", "/pinterest/account");
    }
    if (params.get("p_error")) {
      setError(decodeURIComponent(params.get("p_error")!));
      window.history.replaceState({}, "", "/pinterest/account");
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const s = await fetchPinterestAccountStatus();
      setStatus(s);
      if (s.connected) {
        const [b, p] = await Promise.all([
          fetchPinterestBoards(),
          fetchPinterestCachedPins(25),
        ]);
        setBoards(b.boards);
        setPins(p.pins);
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
      const { auth_url } = await fetchPinterestAuthUrl();
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
      const result = await syncPinterestAccount();
      setFlash(`Synced ${result.synced_boards} boards · ${result.synced_pins} pins.`);
      if (result.errors.length) setError(result.errors.join(" | "));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your Pinterest account?")) return;
    await disconnectPinterestAccount();
    setStatus({ connected: false });
    setBoards([]);
    setPins([]);
    setFlash("Pinterest account disconnected.");
  }

  const sortedPins = [...pins].sort((a, b) => b.impression_count - a.impression_count);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#E60023] flex items-center justify-center shadow-sm">
              <span className="text-white text-[14px] font-bold">P</span>
            </div>
            <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight">Pinterest Account</h1>
            {status?.connected && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                CONNECTED
              </span>
            )}
          </div>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Connect your Pinterest account for live posting, board management, and analytics.
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

      <div className="px-8 py-6 max-w-5xl mx-auto space-y-8">
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
            <div className="w-16 h-16 rounded-2xl bg-[#E60023]/10 border border-[#E60023]/20 flex items-center justify-center text-3xl font-bold text-[#E60023]">
              P
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900 mb-1">Connect your Pinterest account</h2>
              <p className="text-[13px] text-gray-400 max-w-sm">
                Link your Pinterest account to publish pins directly from the studio, manage boards, and pull live analytics.
              </p>
            </div>

            {!status?.configured && (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-[12px] max-w-md text-left">
                <strong>Setup required:</strong> Add <code className="font-mono">PINTEREST_CLIENT_ID</code> and{" "}
                <code className="font-mono">PINTEREST_CLIENT_SECRET</code> to{" "}
                <code className="font-mono">apps/api/.env</code>, then restart the API.
                Register your app at <span className="underline underline-offset-2">developers.pinterest.com</span>.
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || !status?.configured}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold bg-[#E60023] hover:bg-[#ad081b] text-white transition-colors disabled:opacity-40 shadow-sm"
            >
              {connecting ? "Redirecting…" : "Connect Pinterest Account"}
            </button>

            {/* Setup steps */}
            <div className="text-left max-w-sm space-y-2 pt-2">
              {[
                { step: "1", text: "Go to developers.pinterest.com and create an app" },
                { step: "2", text: "Set redirect URI to http://localhost:4000/pinterest/account/callback" },
                { step: "3", text: "Enable scopes: boards:read/write, pins:read/write, user_accounts:read" },
                { step: "4", text: "Copy Client ID + Secret into apps/api/.env" },
                { step: "5", text: "Restart the API and click Connect above" },
              ].map(({ step, text }) => (
                <div key={step} className="flex gap-3 text-[12px] text-gray-500">
                  <div className="w-5 h-5 rounded-full bg-[#E60023]/10 text-[#E60023] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {step}
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>

        ) : (

          /* ── Connected ── */
          <>
            {/* Profile card */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
              {status.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={status.profile_image}
                  alt={status.username}
                  className="w-12 h-12 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#E60023]/10 border border-[#E60023]/20 flex items-center justify-center text-[#E60023] font-bold text-lg">
                  {(status.username ?? "P")[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] text-gray-900 truncate">{status.username}</div>
                <div className="text-[12px] text-gray-400 capitalize">{status.account_type?.toLowerCase() ?? "Personal"} account</div>
                {status.website_url && (
                  <div className="text-[11px] text-[#E60023]/80 truncate">{status.website_url}</div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-gray-400">Last synced</div>
                <div className="text-[12px] text-gray-600">{relTime(status.last_synced_at)}</div>
              </div>
            </div>

            {/* Account stats */}
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Account</h2>
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="Monthly Views"  value={fmt(status.monthly_views)}  accent />
                <StatCard label="Followers"      value={fmt(status.follower_count)} />
                <StatCard label="Following"      value={fmt(status.following_count)} />
                <StatCard label="Boards"         value={fmt(status.board_count)} />
              </div>
            </div>

            {/* Pin analytics */}
            {(status.pin_count ?? 0) > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Pin Analytics — Last {status.pin_count} Pins
                </h2>
                <div className="grid grid-cols-4 gap-3">
                  <StatCard label="Total Impressions" value={fmt(status.total_impressions)} accent />
                  <StatCard label="Total Saves"       value={fmt(status.total_saves)} />
                  <StatCard label="Total Clicks"      value={fmt(status.total_clicks)} />
                  <StatCard
                    label="Avg Save Rate"
                    value={`${status.avg_save_rate?.toFixed(1) ?? "0.0"}%`}
                    accent={Number(status.avg_save_rate) >= 1}
                  />
                </div>
              </div>
            )}

            {/* Boards */}
            {boards.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Your Boards ({boards.length})
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {boards.map((b) => <BoardCard key={b.board_id} board={b} />)}
                </div>
              </div>
            )}

            {/* Top pins */}
            {sortedPins.length > 0 && (
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Top Pins by Impressions
                </h2>
                <div className="rounded-xl border border-gray-200 bg-white px-5 py-1">
                  {sortedPins.slice(0, 10).map((pin, i) => (
                    <PinRow key={pin.pin_id} pin={pin} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {boards.length === 0 && pins.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-[13px]">
                No data synced yet.{" "}
                <button onClick={handleSync} className="text-[#E60023] hover:underline">Sync now</button>
              </div>
            )}

            {/* Live posting note */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
              <h3 className="text-[12px] font-semibold text-gray-500">Live Posting</h3>
              <p className="text-[12px] text-gray-400 leading-relaxed">
                Pins published from the Pinterest Studio Composer will be sent directly to your Pinterest account via the API v5.
                Select a board in the composer and click <strong>Publish to Pinterest</strong> to go live immediately,
                or use the Schedule flow to queue for a specific time.
              </p>
              <p className="text-[11px] text-gray-300">
                Pinterest API v5 · OAuth 2.0 PKCE · Scopes: boards:read/write pins:read/write user_accounts:read
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
