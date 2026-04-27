"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Config ───────────────────────────────────────────────────────────────────

const API = "http://127.0.0.1:8000";
const INBOX_DIR = "/Users/matthewmckernan/Integrity_AssetLibrary/INBOX";

function mediaUrl(p: string) { return `${API}/media/?path=${encodeURIComponent(p)}`; }
function basename(p: string) { return p.split("/").pop() ?? p; }
function fmtSize(kb: number) { return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`; }
function fmtTime(ts?: string) {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return ts; }
}

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "inbox" | "library" | "review" | "runs";

interface Stats {
  inbox: number; library: number; review: number;
  rejects: number; archived: number;
  inbox_subdirs: { name: string; count: number }[];
}
interface FileEntry {
  path: string; name: string; size_kb: number;
  is_image: boolean; ext: string; relative: string;
}
interface RunSummary {
  filename: string; mtime: number;
  started_at?: string; completed_at?: string; dry_run?: boolean;
  totals?: { scanned?: number; committed?: number; to_review?: number; failed?: number };
}
interface RunEvent {
  status: string; ts?: string; src?: string; reason?: string;
}
interface Progress {
  running: boolean; complete: boolean;
  processed: number; total: number | null;
  status_counts: Record<string, number>;
  source?: string; dry_run?: boolean; run_file?: string;
}
interface UploadItem {
  id: string; file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FileIngest() {
  const [stats, setStats]       = useState<Stats | null>(null);
  const [tab, setTab]           = useState<Tab>("inbox");
  const [offline, setOffline]   = useState(false);

  // Upload drop zone
  const [uploads, setUploads]   = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploadSubdir, setUploadSubdir] = useState("");
  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Inbox
  const [inboxFiles, setInboxFiles]     = useState<FileEntry[]>([]);
  const [inboxTotal, setInboxTotal]     = useState(0);
  const [inboxSubdir, setInboxSubdir]   = useState("");
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [loadingInbox, setLoadingInbox] = useState(false);

  // Library
  const [libFiles, setLibFiles]     = useState<FileEntry[]>([]);
  const [libTotal, setLibTotal]     = useState(0);
  const [libFilter, setLibFilter]   = useState("");
  const [libSort, setLibSort]       = useState<"newest"|"oldest"|"name"|"size">("newest");
  const [libType, setLibType]       = useState<"all"|"photos"|"videos">("all");
  const [libPage, setLibPage]       = useState(0);
  const [loadingLib, setLoadingLib] = useState(false);
  const [renaming, setRenaming]     = useState<Map<string, string>>(new Map());
  const PAGE = 200;

  // Review
  const [reviewFiles, setReviewFiles]     = useState<FileEntry[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  // Runs
  const [runs, setRuns]               = useState<RunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runEvents, setRunEvents]     = useState<RunEvent[]>([]);

  // Ingest action
  const [running, setRunning]   = useState(false);
  const [msg, setMsg]           = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const runFileRef              = useRef<string | null>(null);

  // ── Loaders ──────────────────────────────────────────────────────────────

  async function loadStats() {
    try {
      const res = await fetch(`${API}/ingest/stats`);
      if (!res.ok) throw new Error();
      setStats(await res.json());
      setOffline(false);
    } catch { setOffline(true); }
  }

  async function loadInbox() {
    setLoadingInbox(true);
    try {
      const p = new URLSearchParams({ limit: "300" });
      if (inboxSubdir) p.set("subdir", inboxSubdir);
      const d = await fetch(`${API}/ingest/inbox?${p}`).then(r => r.json());
      setInboxFiles(d.files ?? []); setInboxTotal(d.total ?? 0);
    } catch { /* ignore */ } finally { setLoadingInbox(false); }
  }

  async function loadLibrary(page = libPage) {
    setLoadingLib(true);
    try {
      const p = new URLSearchParams({ sort: libSort, limit: String(PAGE), offset: String(page * PAGE) });
      if (libFilter) p.set("filter", libFilter);
      if (libType !== "all") p.set("media_type", libType);
      const d = await fetch(`${API}/ingest/library?${p}`).then(r => r.json());
      setLibFiles(d.files ?? []); setLibTotal(d.total ?? 0);
    } catch { /* ignore */ } finally { setLoadingLib(false); }
  }

  async function loadReview() {
    setLoadingReview(true);
    try {
      const d = await fetch(`${API}/ingest/review`).then(r => r.json());
      setReviewFiles(d.files ?? []);
    } catch { /* ignore */ } finally { setLoadingReview(false); }
  }

  async function loadRuns() {
    setLoadingRuns(true);
    try {
      const d = await fetch(`${API}/ingest/runs?limit=20`).then(r => r.json());
      setRuns(d.runs ?? []);
    } catch { /* ignore */ } finally { setLoadingRuns(false); }
  }

  async function loadRunDetail(filename: string) {
    try {
      const d = await fetch(`${API}/ingest/runs/${filename}`).then(r => r.json());
      setRunEvents(d.events ?? []);
    } catch { /* ignore */ }
  }

  async function loadProgress() {
    try {
      const data: Progress = await fetch(`${API}/ingest/progress`).then(r => r.json());
      const tracked = runFileRef.current;
      if (!tracked) {
        if (data.running) { runFileRef.current = data.run_file ?? null; setProgress(data); }
        else setProgress({ running: true, complete: false, processed: 0, total: null, status_counts: {} });
        return;
      }
      if (data.run_file !== tracked) {
        setProgress({ running: true, complete: false, processed: 0, total: null, status_counts: {} });
        return;
      }
      setProgress(data);
      if (!data.running && data.complete) {
        runFileRef.current = null; setRunning(false); setMsg("Ingest complete ✓");
        loadStats(); loadRuns(); loadInbox(); loadLibrary();
      }
    } catch { /* ignore */ }
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  const addFiles = useCallback((rawFiles: File[]) => {
    const items: UploadItem[] = rawFiles.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f, status: "pending",
    }));
    setUploads(prev => [...prev, ...items]);
    uploadFiles(items);
  }, [uploadSubdir]); // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadFiles(items: UploadItem[]) {
    const fd = new FormData();
    items.forEach(item => fd.append("files", item.file));
    if (uploadSubdir) fd.append("subdir", uploadSubdir);

    // Mark all as uploading
    setUploads(prev => prev.map(u =>
      items.find(i => i.id === u.id) ? { ...u, status: "uploading" } : u
    ));

    try {
      // Use the Next.js API route — works even when the AI engine backend is offline
      const res = await fetch("/api/admin/ingest-upload", { method: "POST", body: fd });
      const data = await res.json();

      const savedNames = new Set((data.saved ?? []).map((s: { name: string }) => s.name));
      const errorMap = new Map((data.errors ?? []).map((e: { name: string; error: string }) => [e.name, e.error]));

      setUploads(prev => prev.map(u => {
        if (!items.find(i => i.id === u.id)) return u;
        if (savedNames.has(u.file.name)) return { ...u, status: "done" };
        if (errorMap.has(u.file.name)) return { ...u, status: "error", error: errorMap.get(u.file.name) };
        return u;
      }));

      if ((data.saved ?? []).length > 0) {
        setMsg(`${data.saved.length} file${data.saved.length > 1 ? "s" : ""} added to inbox`);
        loadStats();
        if (tab === "inbox") loadInbox();
      }
    } catch (err) {
      setUploads(prev => prev.map(u =>
        items.find(i => i.id === u.id) ? { ...u, status: "error", error: "Upload failed" } : u
      ));
    }
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  // ── Ingest actions ────────────────────────────────────────────────────────

  async function runIngest(source: string, dry = false) {
    setRunning(true); setProgress(null); runFileRef.current = null;
    setMsg(dry ? "Starting dry run…" : "Starting ingest…");
    try {
      const p = new URLSearchParams({ source, dry_run: String(dry), recursive: "true" });
      await fetch(`${API}/ingest/run?${p}`, { method: "POST" });
      setMsg(dry ? `Dry run: ${basename(source)}` : `Ingest started: ${basename(source)}`);
    } catch { setMsg("Failed to start — is the backend running?"); setRunning(false); }
  }

  async function runIngestSelected(dry = false) {
    const files = Array.from(selected);
    if (!files.length) return;
    setRunning(true); setProgress(null); runFileRef.current = null;
    setMsg(`Ingesting ${files.length} file${files.length > 1 ? "s" : ""}…`);
    try {
      const p = new URLSearchParams(); if (dry) p.set("dry_run", "true");
      const res = await fetch(`${API}/ingest/run-files?${p}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(files),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setMsg(`Error: ${e.detail}`); setRunning(false); return; }
      setMsg(`Ingest started for ${files.length} files`);
      setSelected(new Set());
    } catch { setMsg("Failed"); setRunning(false); }
  }

  async function trashFile(path: string, fromLib = false) {
    try {
      await fetch(`${API}/ingest/trash`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
      fromLib ? setLibFiles(p => p.filter(f => f.path !== path)) : setInboxFiles(p => p.filter(f => f.path !== path));
      setSelected(p => { const n = new Set(p); n.delete(path); return n; });
      loadStats();
    } catch { /* ignore */ }
  }

  async function openInFinder(path: string) {
    try { await fetch(`${API}/ingest/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) }); }
    catch { /* ignore */ }
  }

  async function renameFile(path: string, newName: string) {
    try {
      const res = await fetch(`${API}/ingest/rename`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, new_name: newName }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.detail || "Rename failed"); return; }
      setRenaming(m => { const n = new Map(m); n.delete(path); return n; });
      loadLibrary();
    } catch { alert("Rename failed"); }
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { const iv = setInterval(loadStats, 15000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (tab === "inbox")   loadInbox();
    if (tab === "library") loadLibrary();
    if (tab === "review")  loadReview();
    if (tab === "runs")    loadRuns();
  }, [tab]);
  useEffect(() => { if (tab === "inbox") loadInbox(); }, [inboxSubdir]);
  useEffect(() => { if (tab === "library") { setLibPage(0); loadLibrary(0); } }, [libSort, libType]);
  useEffect(() => {
    if (!running) return;
    loadProgress();
    const iv = setInterval(loadProgress, 2000);
    return () => clearInterval(iv);
  }, [running]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function statusColor(s: string) {
    if (s === "COMMIT") return "#4ade80";
    if (s === "REVIEW") return "#fbbf24";
    if (s === "FAIL")   return "#f87171";
    if (s.startsWith("RUN_")) return "#60a5fa";
    return "var(--color-text-tertiary)";
  }

  const tabDefs: { key: Tab; label: string; count?: number }[] = [
    { key: "inbox",   label: "Inbox",       count: stats?.inbox },
    { key: "library", label: "Library",     count: stats?.library },
    { key: "review",  label: "Review",      count: stats?.review },
    { key: "runs",    label: "Run History" },
  ];

  const doneUploads  = uploads.filter(u => u.status === "done").length;
  const errorUploads = uploads.filter(u => u.status === "error").length;
  const busyUploads  = uploads.filter(u => u.status === "uploading").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--color-surface-secondary)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        <div>
          <h1 className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>File Ingest</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
            Drop files to add to inbox, then run the ingest pipeline
          </p>
        </div>
        {offline ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-lg"
              style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
              Backend offline
            </span>
            <button
              onClick={() => { window.open("x-terminal-emulator://"); }}
              className="text-[11px] px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
              title="Run: cd /Users/matthewmckernan/AI_Content_Engine && ./scripts/launch_vto_console.sh">
              How to start ↗
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#4ade80" }} />
            <span className="text-[11px]" style={{ color: "#4ade80" }}>Backend connected</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Offline notice with start command */}
        {offline && (
          <div className="rounded-2xl p-4"
            style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[12px] font-semibold mb-1" style={{ color: "#fbbf24" }}>
                  AI Engine is not running
                </div>
                <div className="text-[11px] mb-2" style={{ color: "var(--color-text-tertiary)" }}>
                  You can still <strong>add files to the inbox</strong> using the drop zone below.
                  To view stats and run the ingest pipeline, start the backend:
                </div>
                <code className="block text-[11px] px-3 py-2 rounded-lg select-all cursor-text"
                  style={{ background: "rgba(0,0,0,0.25)", color: "#fbbf24", fontFamily: "monospace" }}>
                  cd /Users/matthewmckernan/AI_Content_Engine && ./scripts/launch_vto_console.sh
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Inbox",    value: stats?.inbox,    color: "#fbbf24" },
            { label: "Library",  value: stats?.library,  color: "#4ade80" },
            { label: "Review",   value: stats?.review,   color: "#a78bfa" },
            { label: "Archived", value: stats?.archived, color: "#60a5fa" },
            { label: "Rejects",  value: stats?.rejects,  color: "#f87171" },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-4 text-center"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div className="text-3xl font-black leading-none" style={{ color: c.color }}>
                {c.value?.toLocaleString() ?? "—"}
              </div>
              <div className="text-[11px] font-semibold mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
                {c.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Upload Drop Zone ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Add Files to Inbox
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                Drag &amp; drop or click to browse — files go directly into the asset library inbox
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={uploadSubdir}
                onChange={e => setUploadSubdir(e.target.value)}
                placeholder="Subfolder (optional)"
                className="text-[11px] px-2.5 py-1.5 rounded-lg outline-none w-40"
                style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              />
              {uploads.length > 0 && (
                <button onClick={() => setUploads([])}
                  className="text-[10px] px-2 py-1 rounded-lg"
                  style={{ color: "var(--color-text-tertiary)", border: "1px solid var(--color-border)" }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className="mx-4 mb-4 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all select-none"
            style={{
              minHeight: 100,
              border: `2px dashed ${dragging ? "var(--color-primary)" : "var(--color-border)"}`,
              background: dragging ? "var(--color-primary-muted)" : "var(--color-surface-secondary)",
            }}>
            <span className="text-2xl" style={{ opacity: dragging ? 1 : 0.35 }}>⇓</span>
            <span className="text-[12px] font-medium"
              style={{ color: dragging ? "var(--color-primary)" : "var(--color-text-tertiary)" }}>
              {dragging ? "Drop to add to inbox" : "Drop files here or click to browse"}
            </span>
            {uploadSubdir && (
              <span className="text-[10px]" style={{ color: "var(--color-primary)", opacity: 0.7 }}>
                → inbox/{uploadSubdir}/
              </span>
            )}
          </div>
          <input ref={inputRef} type="file" multiple className="hidden"
            onChange={e => { if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ""; } }} />

          {/* Upload queue */}
          {uploads.length > 0 && (
            <div className="px-4 pb-4 space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--color-text-tertiary)", opacity: 0.6 }}>
                  Upload Queue
                </span>
                <div className="flex gap-3 text-[10px]">
                  {busyUploads > 0  && <span style={{ color: "#fbbf24" }}>{busyUploads} uploading…</span>}
                  {doneUploads > 0  && <span style={{ color: "#4ade80" }}>{doneUploads} saved</span>}
                  {errorUploads > 0 && <span style={{ color: "#f87171" }}>{errorUploads} failed</span>}
                </div>
              </div>
              {uploads.map(u => (
                <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
                  <span className="text-[11px] shrink-0">
                    {u.status === "done"      && <span style={{ color: "#4ade80" }}>✓</span>}
                    {u.status === "error"     && <span style={{ color: "#f87171" }}>✕</span>}
                    {u.status === "uploading" && <span style={{ color: "#fbbf24" }}>↑</span>}
                    {u.status === "pending"   && <span style={{ color: "var(--color-text-tertiary)" }}>○</span>}
                  </span>
                  <span className="flex-1 text-[11px] truncate" style={{ color: "var(--color-text-secondary)" }}>
                    {u.file.name}
                  </span>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-tertiary)" }}>
                    {fmtSize(Math.round(u.file.size / 1024))}
                  </span>
                  {u.error && (
                    <span className="text-[10px] shrink-0" style={{ color: "#f87171" }}>{u.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Ingest Action Bar ── */}
        <div className="rounded-2xl p-4 flex items-center gap-3 flex-wrap"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Run Ingest Pipeline
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
              AI-tag and move files from inbox into the library
            </div>
          </div>
          <button disabled={running || offline}
            onClick={() => runIngest(INBOX_DIR)}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-40 transition-opacity"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
            {running ? "Running…" : "Ingest All Inbox"}
          </button>
          <button disabled={running || offline}
            onClick={() => runIngest(INBOX_DIR, true)}
            className="px-3 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-40"
            style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
            Dry Run
          </button>
          {inboxSubdir && (
            <button disabled={running || offline}
              onClick={() => runIngest(`${INBOX_DIR}/${inboxSubdir}`)}
              className="px-3 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-40"
              style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
              Ingest "{inboxSubdir}"
            </button>
          )}
          {msg && <span className="text-[11px] font-medium" style={{ color: "#4ade80" }}>{msg}</span>}
        </div>

        {/* Progress Bar */}
        {running && progress && (
          <div className="rounded-2xl p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#fbbf24" }} />
                <span className="text-[12px] font-semibold"
                  style={{ color: progress.complete ? "#4ade80" : "#fbbf24" }}>
                  {progress.running ? "Ingesting…" : "Complete ✓"}
                </span>
                {progress.source && (
                  <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {basename(progress.source)}
                  </span>
                )}
                {progress.dry_run && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>dry run</span>
                )}
              </div>
              <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                {progress.processed === 0 && !progress.total ? "Processing…"
                  : `${progress.processed}${progress.total ? ` / ${progress.total}` : ""} files`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: progress.total
                    ? `${Math.min(100, (progress.processed / progress.total) * 100)}%`
                    : progress.running ? "55%" : "100%",
                  background: progress.complete ? "#4ade80" : "linear-gradient(90deg, var(--color-primary), #86efac)",
                }} />
            </div>
            {Object.keys(progress.status_counts).length > 0 && (
              <div className="flex gap-4 mt-2">
                {Object.entries(progress.status_counts).map(([s, n]) => (
                  <span key={s} className="text-[10px] font-bold" style={{ color: statusColor(s) }}>
                    {n} {s.toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 border-b" style={{ borderColor: "var(--color-border)" }}>
          {tabDefs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-[12.5px] font-semibold rounded-t-lg transition-all flex items-center gap-1.5"
              style={{
                background: tab === t.key ? "var(--color-surface)" : "transparent",
                color: tab === t.key ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                borderBottom: tab === t.key ? "2px solid var(--color-primary)" : "2px solid transparent",
              }}>
              {t.label}
              {t.count != null && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: tab === t.key ? "var(--color-primary-muted)" : "var(--color-surface)",
                    color: tab === t.key ? "var(--color-primary)" : "var(--color-text-tertiary)",
                  }}>
                  {t.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── INBOX TAB ── */}
        {tab === "inbox" && (
          <div className="space-y-3">
            {(stats?.inbox_subdirs.length ?? 0) > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Chip active={inboxSubdir === ""} onClick={() => setInboxSubdir("")}>All</Chip>
                {stats!.inbox_subdirs.map(s => (
                  <Chip key={s.name} active={inboxSubdir === s.name}
                    onClick={() => setInboxSubdir(s.name === "(top-level)" ? "" : s.name)}>
                    {s.name} <span className="opacity-50">({s.count})</span>
                  </Chip>
                ))}
              </div>
            )}

            {inboxFiles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] flex-1" style={{ color: "var(--color-text-tertiary)" }}>
                  {inboxFiles.length} of {inboxTotal} files
                  {selected.size > 0 && (
                    <span className="ml-2 font-semibold" style={{ color: "var(--color-primary)" }}>
                      · {selected.size} selected
                    </span>
                  )}
                </span>
                <Chip active={false} onClick={() => setSelected(new Set(inboxFiles.map(f => f.path)))}>
                  Select All
                </Chip>
                {selected.size > 0 && <>
                  <Chip active={false} onClick={() => setSelected(new Set())}>Clear</Chip>
                  <button disabled={running || offline}
                    onClick={() => runIngestSelected()}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40"
                    style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                    Ingest {selected.size}
                  </button>
                  <button disabled={running || offline}
                    onClick={() => runIngestSelected(true)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40"
                    style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                    Dry Run
                  </button>
                </>}
              </div>
            )}

            {loadingInbox ? <GridSkeleton /> : inboxFiles.length === 0 ? (
              <Empty label="Inbox is empty — drop files above to add them" />
            ) : (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {inboxFiles.map(f => {
                  const sel = selected.has(f.path);
                  return (
                    <div key={f.path}
                      onClick={() => setSelected(prev => { const n = new Set(prev); sel ? n.delete(f.path) : n.add(f.path); return n; })}
                      className="rounded-xl overflow-hidden cursor-pointer group relative"
                      style={{
                        border: `${sel ? 2 : 1}px solid ${sel ? "var(--color-primary)" : "var(--color-border)"}`,
                        background: "var(--color-surface)",
                      }}>
                      <div className="absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-md flex items-center justify-center"
                        style={{
                          border: `2px solid ${sel ? "var(--color-primary)" : "rgba(255,255,255,0.3)"}`,
                          background: sel ? "var(--color-primary)" : "rgba(0,0,0,0.4)",
                          backdropFilter: "blur(4px)",
                        }}>
                        {sel && <span className="text-[10px] font-black" style={{ color: "var(--color-primary-deep)" }}>✓</span>}
                      </div>
                      <button
                        className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-md items-center justify-center hidden group-hover:flex text-[11px]"
                        style={{ background: "rgba(0,0,0,0.55)", color: "#f87171" }}
                        onClick={e => { e.stopPropagation(); if (confirm(`Trash "${f.name}"?`)) trashFile(f.path); }}>
                        ✕
                      </button>
                      {f.is_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(f.path)} alt={f.name}
                          className="w-full object-cover" style={{ aspectRatio: "4/5", opacity: sel ? 1 : 0.82 }} />
                      ) : (
                        <div className="w-full flex items-center justify-center text-[11px] font-bold"
                          style={{ aspectRatio: "4/5", background: "var(--color-surface-secondary)", color: "var(--color-text-tertiary)" }}>
                          {f.ext.toUpperCase()}
                        </div>
                      )}
                      <div className="px-2 py-1.5">
                        <div className="text-[9.5px] truncate" style={{ color: "var(--color-text-secondary)" }}>{f.name}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>{fmtSize(f.size_kb)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LIBRARY TAB ── */}
        {tab === "library" && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap items-center">
              <input value={libFilter} onChange={e => setLibFilter(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadLibrary(0)}
                placeholder="Filter by filename…"
                className="px-3 py-1.5 rounded-lg text-[12px] outline-none flex-1 min-w-[160px]"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
              <button onClick={() => { setLibPage(0); loadLibrary(0); }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Search
              </button>
              <div className="flex gap-1">
                {(["newest","oldest","name","size"] as const).map(s => (
                  <Chip key={s} active={libSort === s} onClick={() => setLibSort(s)}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Chip>
                ))}
              </div>
              <div className="flex gap-1">
                {(["all","photos","videos"] as const).map(t => (
                  <Chip key={t} active={libType === t} onClick={() => setLibType(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>

            {libTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                  {libPage * PAGE + 1}–{Math.min((libPage + 1) * PAGE, libTotal)} of {libTotal.toLocaleString()} assets
                </span>
                <div className="flex gap-2 items-center">
                  <button onClick={() => { setLibPage(p => p - 1); loadLibrary(libPage - 1); }}
                    disabled={libPage === 0}
                    className="text-[11px] px-2.5 py-1 rounded-lg disabled:opacity-30"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-tertiary)" }}>← Prev</button>
                  <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {libPage + 1} / {Math.ceil(libTotal / PAGE)}
                  </span>
                  <button onClick={() => { setLibPage(p => p + 1); loadLibrary(libPage + 1); }}
                    disabled={(libPage + 1) * PAGE >= libTotal}
                    className="text-[11px] px-2.5 py-1 rounded-lg disabled:opacity-30"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-tertiary)" }}>Next →</button>
                </div>
              </div>
            )}

            {loadingLib ? <GridSkeleton /> : libFiles.length === 0 ? <Empty label="No assets found" /> : (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {libFiles.map(f => (
                  <div key={f.path} className="rounded-xl overflow-hidden group relative"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                    <div className="absolute top-1.5 right-1.5 z-10 hidden group-hover:flex gap-1">
                      <button className="w-6 h-6 rounded-md flex items-center justify-center text-[11px]"
                        style={{ background: "rgba(0,0,0,0.6)", color: "#60a5fa" }}
                        onClick={() => openInFinder(f.path)} title="Open in Finder">⌃</button>
                      <button className="w-6 h-6 rounded-md flex items-center justify-center text-[11px]"
                        style={{ background: "rgba(0,0,0,0.6)", color: "#fbbf24" }}
                        onClick={() => setRenaming(m => new Map(m).set(f.path, f.name))} title="Rename">✎</button>
                      <button className="w-6 h-6 rounded-md flex items-center justify-center text-[11px]"
                        style={{ background: "rgba(0,0,0,0.6)", color: "#f87171" }}
                        onClick={() => { if (confirm(`Trash "${f.name}"?`)) trashFile(f.path, true); }} title="Trash">✕</button>
                    </div>
                    {f.is_image ? (
                      <a href={mediaUrl(f.path)} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl(f.path)} alt={f.name}
                          className="w-full object-cover" style={{ aspectRatio: "4/5" }} />
                      </a>
                    ) : (
                      <video src={mediaUrl(f.path)} muted preload="metadata"
                        className="w-full object-cover" style={{ aspectRatio: "4/5", background: "var(--color-surface-secondary)" }}
                        onMouseEnter={e => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                    )}
                    <div className="px-2 py-1.5">
                      {renaming.has(f.path) ? (
                        <form onSubmit={e => { e.preventDefault(); const v = (renaming.get(f.path) ?? "").trim(); if (v && v !== f.name) renameFile(f.path, v); else setRenaming(m => { const n = new Map(m); n.delete(f.path); return n; }); }}
                          className="flex gap-1">
                          <input autoFocus value={renaming.get(f.path) ?? f.name}
                            onChange={e => setRenaming(m => new Map(m).set(f.path, e.target.value))}
                            onKeyDown={e => e.key === "Escape" && setRenaming(m => { const n = new Map(m); n.delete(f.path); return n; })}
                            className="flex-1 text-[10px] px-1.5 py-0.5 rounded min-w-0 outline-none"
                            style={{ border: "1px solid #60a5fa", background: "rgba(96,165,250,0.1)", color: "#93c5fd" }} />
                          <button type="submit" className="text-[10px] px-1.5 rounded"
                            style={{ border: "1px solid #4ade80", background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>✓</button>
                          <button type="button" className="text-[10px] px-1.5 rounded"
                            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-tertiary)" }}
                            onClick={() => setRenaming(m => { const n = new Map(m); n.delete(f.path); return n; })}>✕</button>
                        </form>
                      ) : (
                        <div className="text-[9.5px] truncate" style={{ color: "var(--color-text-secondary)" }}>{f.name}</div>
                      )}
                      <div className="text-[9px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>{fmtSize(f.size_kb)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW TAB ── */}
        {tab === "review" && (
          <div className="space-y-3">
            {loadingReview ? <GridSkeleton /> : reviewFiles.length === 0 ? (
              <Empty label="All clear — no files pending review" />
            ) : (
              <>
                <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                  {reviewFiles.length} file{reviewFiles.length !== 1 ? "s" : ""} need review
                </p>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                  {reviewFiles.map(f => (
                    <div key={f.path} className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid rgba(251,191,36,0.25)", background: "var(--color-surface)" }}>
                      {f.is_image ? (
                        <a href={mediaUrl(f.path)} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mediaUrl(f.path)} alt={f.name} className="w-full object-cover" style={{ aspectRatio: "4/5" }} />
                        </a>
                      ) : (
                        <div className="w-full flex items-center justify-center text-[11px] font-bold"
                          style={{ aspectRatio: "4/5", background: "var(--color-surface-secondary)", color: "var(--color-text-tertiary)" }}>
                          {f.ext.toUpperCase()}
                        </div>
                      )}
                      <div className="px-2 py-2">
                        <div className="text-[9.5px] truncate" style={{ color: "var(--color-text-secondary)" }}>{f.name}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: "#fbbf24" }}>needs review</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── RUNS TAB ── */}
        {tab === "runs" && (
          <div className="space-y-2">
            {loadingRuns ? (
              <div className="text-center py-12 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>Loading…</div>
            ) : runs.length === 0 ? (
              <Empty label="No ingest runs yet" />
            ) : runs.map(run => (
              <div key={run.filename} className="rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
                <button
                  onClick={() => {
                    if (expandedRun === run.filename) { setExpandedRun(null); setRunEvents([]); }
                    else { setExpandedRun(run.filename); loadRunDetail(run.filename); }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {fmtTime(run.started_at)}
                      </span>
                      {run.dry_run && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>dry run</span>
                      )}
                      {run.completed_at && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80" }}>complete</span>
                      )}
                    </div>
                    <div className="flex gap-4">
                      {[
                        { l: "scanned",   v: run.totals?.scanned,   c: "var(--color-text-tertiary)" },
                        { l: "committed", v: run.totals?.committed,  c: "#4ade80" },
                        { l: "review",    v: run.totals?.to_review,  c: "#fbbf24" },
                        { l: "failed",    v: run.totals?.failed,     c: "#f87171" },
                      ].filter(x => x.v).map(x => (
                        <span key={x.l} className="text-[10px] font-semibold" style={{ color: x.c }}>
                          {x.v} {x.l}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--color-text-tertiary)" }}>
                    {expandedRun === run.filename ? "▲" : "▼"}
                  </span>
                </button>

                {expandedRun === run.filename && (
                  <div className="border-t px-4 py-3 max-h-56 overflow-y-auto space-y-1"
                    style={{ borderColor: "var(--color-border)", background: "var(--color-surface-secondary)" }}>
                    {runEvents.length === 0 ? (
                      <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>Loading…</div>
                    ) : runEvents.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10.5px]">
                        <span className="shrink-0 font-bold w-16" style={{ color: statusColor(ev.status) }}>
                          {ev.status}
                        </span>
                        <span className="flex-1 truncate" style={{ color: "var(--color-text-secondary)" }}>
                          {ev.src ? basename(ev.src) : ev.reason ?? ""}
                        </span>
                        {ev.ts && (
                          <span className="shrink-0" style={{ color: "var(--color-text-tertiary)" }}>
                            {fmtTime(ev.ts)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
      style={active
        ? { background: "var(--color-primary-muted)", color: "var(--color-primary)", border: "1px solid var(--color-primary)" }
        : { background: "var(--color-surface)", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border)" }}>
      {children}
    </button>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl py-16 text-center"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <div className="text-3xl opacity-10 mb-2">◫</div>
      <div className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>{label}</div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="rounded-xl animate-pulse"
          style={{ aspectRatio: "4/5", background: "var(--color-surface)" }} />
      ))}
    </div>
  );
}
