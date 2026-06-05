"use client";

/**
 * Sync Status — in-app diagnostic page.
 *
 * Purpose: tell us, on devices without DevTools (iPad PWA), exactly which
 * build is running, whether writes are reaching Supabase, and what's
 * sitting unsynced in the offline queue. Reachable at /admin/sync-status.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { countQueuedWrites, getQueuedWrites, getCachedAll, isOnline, type QueuedWrite } from "@/lib/offlineCache";
import { flushPendingWrites } from "@/lib/productionDb";

interface LastSave {
  at: string;
  sessionDate: string;
  crewBoss: string;
  totalAttempted: number;
  successCount: number;
  failedCount: number;
  failed: { name: string; error: string }[];
}

export default function SyncStatusPage() {
  const supabase = createClient();

  const [online, setOnline]               = useState<boolean>(true);
  const [authEmail, setAuthEmail]         = useState<string | null>(null);
  const [authRole, setAuthRole]           = useState<string | null>(null);
  const [authError, setAuthError]         = useState<string | null>(null);
  const [queueCount, setQueueCount]       = useState<number>(0);
  const [queue, setQueue]                 = useState<QueuedWrite[]>([]);
  const [cacheCount, setCacheCount]       = useState<number>(0);
  const [serverCount, setServerCount]     = useState<number | null>(null);
  const [serverError, setServerError]     = useState<string | null>(null);
  const [lastSave, setLastSave]           = useState<LastSave | null>(null);
  const [flushing, setFlushing]           = useState<boolean>(false);
  const [flushResult, setFlushResult]     = useState<string | null>(null);
  const [testWriteResult, setTestWriteResult] = useState<string | null>(null);
  const [testing, setTesting]             = useState<boolean>(false);

  async function refresh() {
    setOnline(isOnline());

    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) setAuthError(error.message);
      setAuthEmail(user?.email ?? null);
      if (user) {
        const { data: roleData } = await supabase.rpc("get_my_role");
        setAuthRole((roleData as string | null) ?? null);
      }
    } catch (e) {
      setAuthError((e as Error).message);
    }

    try {
      setQueueCount(await countQueuedWrites());
      setQueue(await getQueuedWrites());
    } catch { /* ignore */ }

    try {
      const cached = await getCachedAll("production_entries");
      setCacheCount(cached.length);
    } catch { /* ignore */ }

    try {
      const { count, error } = await supabase
        .from("app_data")
        .select("id", { count: "exact", head: true })
        .eq("table_name", "production_entries");
      if (error) setServerError(error.message);
      else setServerCount(count ?? 0);
    } catch (e) {
      setServerError((e as Error).message);
    }

    try {
      const raw = localStorage.getItem("last_save_result");
      if (raw) setLastSave(JSON.parse(raw) as LastSave);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    void refresh();
    const tick = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFlush() {
    setFlushing(true);
    setFlushResult(null);
    try {
      const n = await flushPendingWrites();
      setFlushResult(`Flushed ${n} write${n !== 1 ? "s" : ""}`);
    } catch (e) {
      setFlushResult(`Flush error: ${(e as Error).message}`);
    } finally {
      setFlushing(false);
      void refresh();
    }
  }

  async function handleTestWrite() {
    setTesting(true);
    setTestWriteResult(null);
    const probeId = `__sync_probe_${Date.now()}`;
    try {
      const { data, error } = await supabase
        .from("app_data")
        .upsert({
          table_name: "__diagnostic_probes",
          id: probeId,
          data: { source: "sync-status", at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }, { onConflict: "table_name,id" })
        .select("id");
      if (error) {
        setTestWriteResult(`FAILED: ${error.message}`);
      } else if (!data || data.length === 0) {
        setTestWriteResult("FAILED: write returned no rows (RLS may be silently dropping writes)");
      } else {
        // Clean up the probe so it doesn't accumulate
        await supabase.from("app_data").delete().eq("table_name", "__diagnostic_probes").eq("id", probeId);
        setTestWriteResult(`OK: round-trip succeeded (${data.length} row${data.length !== 1 ? "s" : ""} confirmed)`);
      }
    } catch (e) {
      setTestWriteResult(`FAILED: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  const buildSha  = process.env.NEXT_PUBLIC_BUILD_SHA  ?? "unknown";
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown";

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px", background: "#0d0d0d", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Sync Status</h1>
          <Link href="/admin" style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}>← Back to Admin</Link>
        </div>

        <Card title="Build">
          <Row label="Commit SHA"   value={<code style={mono}>{buildSha.slice(0, 12)}</code>} />
          <Row label="Built at"     value={buildTime} />
          <Row label="Expecting"    value={<code style={mono}>2c6ee8a or later</code>} />
        </Card>

        <Card title="Network & Auth">
          <Row label="Online"       value={<Badge ok={online}>{online ? "yes" : "no"}</Badge>} />
          <Row label="Signed in as" value={authEmail ?? <Badge ok={false}>not authenticated</Badge>} />
          <Row label="Role"         value={authRole ?? "—"} />
          {authError && <Row label="Auth error" value={<span style={{ color: "#f87171" }}>{authError}</span>} />}
        </Card>

        <Card title="Production Entries">
          <Row label="In local cache"     value={`${cacheCount} entr${cacheCount !== 1 ? "ies" : "y"}`} />
          <Row label="In Supabase"        value={
            serverError
              ? <span style={{ color: "#f87171" }}>error: {serverError}</span>
              : serverCount == null
                ? "loading…"
                : `${serverCount} entr${serverCount !== 1 ? "ies" : "y"}`
          } />
          <Row label="Local ↔ Server diff" value={
            serverCount == null ? "—"
              : cacheCount === serverCount ? <Badge ok>in sync</Badge>
              : <Badge ok={false}>{cacheCount - serverCount > 0 ? `+${cacheCount - serverCount} local-only` : `${serverCount - cacheCount} server-only`}</Badge>
          } />
        </Card>

        <Card title="Offline Write Queue">
          <Row label="Pending writes" value={
            queueCount === 0 ? <Badge ok>empty</Badge> : <Badge ok={false}>{queueCount} queued</Badge>
          } />
          {queue.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#d1d5db" }}>
              {queue.slice(0, 10).map(q => (
                <div key={q.id} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 6 }}>
                  <div><strong>{q.op}</strong> {q.table} <code style={mono}>{q.recordId.slice(0, 20)}</code></div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                    queued {new Date(q.enqueuedAt).toLocaleString()} · attempts: {q.attempts}
                    {q.lastError && <> · last error: <span style={{ color: "#fca5a5" }}>{q.lastError}</span></>}
                  </div>
                </div>
              ))}
              {queue.length > 10 && <div style={{ fontSize: 10, color: "#9ca3af" }}>+{queue.length - 10} more…</div>}
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={handleFlush} disabled={flushing || queueCount === 0} style={btn}>
              {flushing ? "Flushing…" : "Force Sync Now"}
            </button>
            {flushResult && <span style={{ fontSize: 11, color: "#d1d5db" }}>{flushResult}</span>}
          </div>
        </Card>

        <Card title="Last Save Attempt">
          {lastSave ? (
            <>
              <Row label="When"      value={new Date(lastSave.at).toLocaleString()} />
              <Row label="Crew boss" value={`${lastSave.crewBoss} · ${lastSave.sessionDate}`} />
              <Row label="Result"    value={
                lastSave.failedCount === 0
                  ? <Badge ok>{lastSave.successCount} succeeded</Badge>
                  : <Badge ok={false}>{lastSave.successCount} ok / {lastSave.failedCount} failed</Badge>
              } />
              {lastSave.failed.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#fca5a5" }}>
                  {lastSave.failed.map((f, i) => <div key={i}>• {f.name}: {f.error}</div>)}
                </div>
              )}
            </>
          ) : <Row label="—" value="no save attempt recorded since last page load" />}
        </Card>

        <Card title="End-to-End Probe">
          <div style={{ fontSize: 12, color: "#d1d5db", marginBottom: 10 }}>
            Writes a tiny test row to Supabase and reads it back. If this fails, every Crew Boss save will also fail — the issue is auth or RLS, not the entry data.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={handleTestWrite} disabled={testing} style={btn}>
              {testing ? "Testing…" : "Run Write Test"}
            </button>
            {testWriteResult && (
              <span style={{ fontSize: 12, color: testWriteResult.startsWith("OK") ? "#86efac" : "#fca5a5" }}>
                {testWriteResult}
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const mono: React.CSSProperties = { fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 11, background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 4 };
const btn:  React.CSSProperties = { padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 600, cursor: "pointer" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", margin: "0 0 12px 0" }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span style={{ color: "#f3f4f6", textAlign: "right", maxWidth: "70%", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      background: ok ? "rgba(34, 197, 94, 0.2)"  : "rgba(239, 68, 68, 0.2)",
      color:      ok ? "#86efac"                  : "#fca5a5",
      border:     ok ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
    }}>{children}</span>
  );
}
