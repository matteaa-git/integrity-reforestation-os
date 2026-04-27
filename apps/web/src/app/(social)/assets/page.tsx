"use client";

import { useEffect, useRef, useState } from "react";
import type { Asset, LibraryStatus, IndexDirectoryResponse } from "@/lib/api";
import { fetchAssets, fetchLibraryStatus, syncLibrary, setLibraryPath, uploadAsset } from "@/lib/api";
import AssetGrid from "@/components/AssetGrid";
import AssetPreview from "@/components/AssetPreview";

type UIState = "loading" | "ready" | "empty" | "error";

const MEDIA_FILTERS = [
  { label: "All", value: "" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Audio", value: "audio" },
];

export default function AssetBrowserPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [state, setState] = useState<UIState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [libraryStatus, setLibraryStatus] = useState<LibraryStatus | null>(null);
  const [syncResult, setSyncResult] = useState<IndexDirectoryResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [apiOffline, setApiOffline] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [customPath, setCustomPath] = useState("");
  const [showPathInput, setShowPathInput] = useState(false);

  // ── Filters ──
  const [mediaFilter, setMediaFilter] = useState("");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [pillarFilter, setPillarFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [orientationFilter, setOrientationFilter] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("");

  // ── Upload ──
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      await Promise.all(arr.map((f) => uploadAsset(f)));
      reloadAll();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  // ── Pagination ──
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  // Incrementing this forces the fetch effect to re-run even if page/filters haven't changed
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Status loader (stable reference for use in handlers) ──
  const loadStatus = () =>
    fetchLibraryStatus()
      .then((s) => { setLibraryStatus(s); setApiOffline(false); setStatusLoading(false); })
      .catch(() => { setApiOffline(true); setStatusLoading(false); });

  // Load status on mount with a 5s timeout fallback so "Connecting..." never sticks
  useEffect(() => {
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) { setStatusLoading(false); }
    }, 5000);
    fetchLibraryStatus()
      .then((s) => { done = true; clearTimeout(timeout); setLibraryStatus(s); setApiOffline(false); setStatusLoading(false); })
      .catch(() => { done = true; clearTimeout(timeout); setApiOffline(true); setStatusLoading(false); });
    return () => { done = true; clearTimeout(timeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ref to cancel stale responses when a newer fetch starts
  const fetchIdRef = useRef(0);

  // Load assets whenever page, filters, or refreshKey changes
  useEffect(() => {
    const id = ++fetchIdRef.current;
    setState("loading");
    setError(null);
    fetchAssets({
      media_type: mediaFilter || undefined,
      search: search || undefined,
      project: projectFilter || undefined,
      pillar: pillarFilter || undefined,
      subject: subjectFilter || undefined,
      action: actionFilter || undefined,
      orientation: orientationFilter || undefined,
      content_type: contentTypeFilter || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).then((data) => {
      if (id !== fetchIdRef.current) return;
      setAssets(data.assets);
      setTotal(data.total);
      setState(data.total === 0 ? "empty" : "ready");
      setApiOffline(false);
    }).catch((e) => {
      if (id !== fetchIdRef.current) return;
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setState("error");
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) setApiOffline(true);
    });
  }, [page, refreshKey, mediaFilter, search, projectFilter, pillarFilter, subjectFilter, actionFilter, orientationFilter, contentTypeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadAll = () => {
    loadStatus();
    setPage(0);
    setRefreshKey((k) => k + 1);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    let polling = false;
    try {
      const result = await syncLibrary();
      setSyncResult(result);
      reloadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      if (msg.includes("409")) {
        // Startup sync is already running — poll until it finishes, then reload
        polling = true;
        const poll = setInterval(async () => {
          try {
            const s = await fetchLibraryStatus();
            setLibraryStatus(s);
            if (!s.sync_in_progress) {
              clearInterval(poll);
              setSyncing(false);
              reloadAll();
            }
          } catch {
            clearInterval(poll);
            setSyncing(false);
          }
        }, 2000);
        return;
      }
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) setApiOffline(true);
      setError(msg);
    } finally {
      if (!polling) setSyncing(false);
    }
  };

  const handleConnectCustomPath = async () => {
    if (!customPath.trim()) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await setLibraryPath(customPath.trim());
      setSyncResult(result);
      setShowPathInput(false);
      setCustomPath("");
      reloadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Index failed";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) setApiOffline(true);
      setError(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryConnection = () => {
    setApiOffline(false);
    setError(null);
    setState("loading");
    reloadAll();
  };

  const clearFilters = () => {
    setPage(0);
    setSearch("");
    setProjectFilter("");
    setPillarFilter("");
    setSubjectFilter("");
    setActionFilter("");
    setOrientationFilter("");
    setContentTypeFilter("");
    setMediaFilter("");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const hasActiveFilters = search || projectFilter || pillarFilter || subjectFilter || actionFilter || orientationFilter || contentTypeFilter || mediaFilter;

  const connected = libraryStatus?.connected ?? false;

  return (
    <div className="h-screen flex flex-col bg-[#0e0e1a] text-white overflow-hidden">

      {/* ── API Offline Banner ── */}
      {apiOffline && (
        <div className="shrink-0 bg-red-950/60 border-b border-red-500/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <div>
              <span className="text-[12px] font-semibold text-red-300">API server offline</span>
              <span className="text-[11px] text-red-400/70 ml-2">Start it with:</span>
              <code className="text-[10px] text-red-300/80 bg-red-900/40 px-2 py-0.5 rounded ml-2 font-mono">
                cd apps/api && source venv/bin/activate && uvicorn app.main:app --port 4000
              </code>
            </div>
          </div>
          <button
            onClick={handleRetryConnection}
            className="text-[11px] font-semibold text-red-300 hover:text-white border border-red-500/30 hover:border-red-400/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="shrink-0 px-6 py-4 border-b border-white/5 bg-[#12121f]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-bold text-white">Asset Library</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                apiOffline ? "bg-red-500 animate-pulse" :
                statusLoading ? "bg-amber-400 animate-pulse" :
                connected ? "bg-emerald-400" : "bg-amber-400"
              }`} />
              <span className="text-[11px] text-white/40 font-mono">
                {apiOffline
                  ? "API offline"
                  : statusLoading
                  ? "Connecting..."
                  : connected
                  ? (libraryStatus?.library_path?.replace(/^\/Users\/[^/]+\//, "~/") ?? "~/Integrity_AssetLibrary/LIBRARY")
                  : "Library path not found"}
              </span>
              {libraryStatus?.last_synced_at && (
                <span className="text-[10px] text-white/25">
                  · synced {new Date(libraryStatus.last_synced_at).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
            />
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white/50 hover:text-white/80 text-[10px] font-medium border border-white/8 transition-colors"
              title="Upload files"
            >
              {uploading ? (
                <><span className="w-2.5 h-2.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />Uploading...</>
              ) : (
                <>↑ Upload</>
              )}
            </button>
            <button
              onClick={() => setShowPathInput(!showPathInput)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-[10px] font-medium border border-white/8 transition-colors"
              title="Connect a custom library folder"
            >
              + Connect Folder
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || libraryStatus?.sync_in_progress}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#39de8b]/15 hover:bg-[#39de8b]/25 disabled:opacity-40 text-[#39de8b] text-[11px] font-bold border border-[#39de8b]/20 transition-colors"
            >
              {(syncing || libraryStatus?.sync_in_progress) ? (
                <>
                  <span className="w-3 h-3 border-2 border-[#39de8b]/40 border-t-[#39de8b] rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                <>↻ Sync Library</>
              )}
            </button>
          </div>
        </div>

        {/* ── Custom path input ── */}
        {showPathInput && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnectCustomPath()}
              placeholder="e.g. ~/Integrity_AssetLibrary/LIBRARY or /Volumes/MyDrive/Media"
              autoFocus
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#39de8b]/40 font-mono"
            />
            <button
              onClick={handleConnectCustomPath}
              disabled={syncing || !customPath.trim()}
              className="px-4 py-1.5 rounded-lg bg-[#39de8b]/20 hover:bg-[#39de8b]/30 text-[#39de8b] text-[11px] font-bold border border-[#39de8b]/25 transition-colors disabled:opacity-40"
            >
              {syncing ? "Indexing..." : "Index Folder"}
            </button>
            <button
              onClick={() => { setShowPathInput(false); setCustomPath(""); }}
              className="text-white/30 hover:text-white/60 text-sm px-2"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Library stats ── */}
        {libraryStatus && (
          <div className="flex items-center gap-4 mt-3">
            <Stat label="Total" value={libraryStatus.total_assets} />
            <Stat label="Images" value={libraryStatus.images} icon="◫" />
            <Stat label="Videos" value={libraryStatus.videos} icon="▶" />
            <Stat label="Audio" value={libraryStatus.audio} icon="♪" />
            {!connected && !apiOffline && (
              <span className="text-[10px] text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded-full">
                ⚠ Default library path not found — use + Connect Folder
              </span>
            )}
          </div>
        )}

        {/* ── Not connected empty state (API online, no library) ── */}
        {!apiOffline && !connected && !libraryStatus?.total_assets && (
          <div className="mt-3 flex items-center gap-3 text-[11px] text-amber-400/70 bg-amber-900/10 border border-amber-500/15 rounded-lg px-3 py-2">
            <span>Expected path: <code className="font-mono text-amber-300/80">~/Integrity_AssetLibrary/LIBRARY</code></span>
            <span className="text-white/20">·</span>
            <span>Use <strong>+ Connect Folder</strong> to point at a different directory</span>
          </div>
        )}
      </div>

      {/* ── Sync result banner ── */}
      {syncResult && (
        <div className="shrink-0 mx-6 mt-3 rounded-xl border border-[#39de8b]/20 bg-[#39de8b]/5 px-4 py-2.5 flex items-center gap-4 text-[11px]">
          <span className="font-semibold text-[#39de8b]">Sync complete</span>
          <span className="text-white/60">{syncResult.indexed_count} new</span>
          <span className="text-white/40">{syncResult.duplicate_count} already indexed</span>
          <span className="text-white/40">{syncResult.skipped_count} skipped</span>
          {syncResult.invalid_count > 0 && (
            <span className="text-red-400">{syncResult.invalid_count} errors</span>
          )}
          <span className="text-white/25 font-mono text-[10px] ml-auto truncate">{syncResult.scanned_root}</span>
          <button onClick={() => setSyncResult(null)} className="text-white/30 hover:text-white/60 ml-2">×</button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="shrink-0 px-6 py-3 border-b border-white/5 space-y-2">
        {/* Row 1: search + media type */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 text-[11px]">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename, description, keywords..."
              className="pl-7 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#39de8b]/40 w-72"
            />
          </div>
          <div className="flex gap-1">
            {MEDIA_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setMediaFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${
                  mediaFilter === f.value
                    ? "bg-[#39de8b]/20 text-[#39de8b] border border-[#39de8b]/30"
                    : "bg-white/5 text-white/40 border border-white/8 hover:text-white/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-[10px] text-white/30 hover:text-white/60 ml-auto transition-colors">
              Clear filters
            </button>
          )}
        </div>

        {/* Row 2: library-specific filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            value={projectFilter}
            onChange={setProjectFilter}
            placeholder="Project"
            options={libraryStatus?.projects.map((p) => ({ label: p, value: p })) ?? []}
          />
          <FilterSelect
            value={pillarFilter}
            onChange={setPillarFilter}
            placeholder="Pillar"
            options={libraryStatus?.pillars.map((p) => ({ label: p, value: p })) ?? []}
          />
          <FilterSelect
            value={subjectFilter}
            onChange={setSubjectFilter}
            placeholder="Subject"
            options={["CB", "CREW", "INCAMP", "EQU", "DELIVERY", "CAMP_LIFE"].map((s) => ({ label: s, value: s }))}
          />
          <FilterSelect
            value={actionFilter}
            onChange={setActionFilter}
            placeholder="Action"
            options={["GEN", "WORKING", "TREEDELIVERY", "CAMP_SETUP", "CAMP_LIFE", "EQU_WORKING"].map((a) => ({ label: a, value: a }))}
          />
          <FilterSelect
            value={orientationFilter}
            onChange={setOrientationFilter}
            placeholder="Orientation"
            options={[
              { label: "Portrait", value: "PORTRAIT" },
              { label: "Landscape", value: "LANDSCAPE" },
            ]}
          />
          <FilterSelect
            value={contentTypeFilter}
            onChange={setContentTypeFilter}
            placeholder="Content Type"
            options={[
              { label: "Photo", value: "photo" },
              { label: "Video", value: "video" },
              { label: "Drone", value: "drone" },
              { label: "Talking Head", value: "talking_head" },
              { label: "Timelapse", value: "timelapse" },
            ]}
          />
          <span className="text-[10px] text-white/25 ml-auto">
            {total} result{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Upload error banner ── */}
      {uploadError && (
        <div className="shrink-0 mx-6 mt-3 rounded-xl border border-red-500/20 bg-red-900/20 px-4 py-2.5 flex items-center justify-between text-[11px]">
          <span className="text-red-400">{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-white/30 hover:text-white/60 ml-4">×</button>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">
        <div
          className={`flex-1 overflow-y-auto p-6 relative transition-colors ${dragOver ? "bg-[#39de8b]/5" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); e.dataTransfer.files && handleUploadFiles(e.dataTransfer.files); }}
        >
          {dragOver && (
            <div className="absolute inset-4 border-2 border-dashed border-[#39de8b]/40 rounded-2xl flex items-center justify-center pointer-events-none z-10">
              <div className="text-center">
                <div className="text-2xl text-[#39de8b]/60 mb-2">↑</div>
                <div className="text-[13px] font-semibold text-[#39de8b]/80">Drop to upload</div>
              </div>
            </div>
          )}
          {state === "loading" && (
            <div className="text-[11px] text-white/25 py-12 text-center animate-pulse">Loading assets...</div>
          )}
          {state === "error" && (
            <div className="rounded-xl bg-red-900/20 border border-red-500/20 p-4 text-[12px] text-red-400">
              {error}
              <button onClick={handleRetryConnection} className="ml-3 underline hover:no-underline">Retry</button>
            </div>
          )}
          {state === "empty" && (
            <div className="text-center py-16">
              <div className="text-3xl text-white/10 mb-3">◫</div>
              <div className="text-[13px] text-white/30 mb-1">No assets found</div>
              <div className="text-[11px] text-white/20 mb-4">
                {hasActiveFilters ? "Try clearing filters" : "No assets indexed yet"}
              </div>
              {!hasActiveFilters && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#39de8b]/15 hover:bg-[#39de8b]/25 text-[#39de8b] text-[12px] font-bold border border-[#39de8b]/20 transition-colors disabled:opacity-40"
                  >
                    {syncing ? (
                      <><span className="w-3 h-3 border-2 border-[#39de8b]/40 border-t-[#39de8b] rounded-full animate-spin" />Syncing...</>
                    ) : "↻ Sync ~/Integrity_AssetLibrary/LIBRARY"}
                  </button>
                  <span className="text-[10px] text-white/20">or use + Connect Folder to index a different path</span>
                </div>
              )}
            </div>
          )}
          {state === "ready" && (
            <>
              <AssetGrid assets={assets} selectedId={selected?.id ?? null} onSelect={setSelected} />
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-6 pb-2">
                  <button
                    onClick={() => handlePageChange(0)}
                    disabled={page === 0}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="First page"
                  >
                    «
                  </button>
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed text-white/60 hover:text-white text-[10px] font-semibold border border-white/8 transition-colors"
                  >
                    ‹ Prev
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 7) {
                        p = i;
                      } else if (page < 4) {
                        p = i;
                      } else if (page > totalPages - 5) {
                        p = totalPages - 7 + i;
                      } else {
                        p = page - 3 + i;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`w-7 h-7 rounded-lg text-[10px] font-semibold transition-colors ${
                            p === page
                              ? "bg-[#39de8b]/20 text-[#39de8b] border border-[#39de8b]/30"
                              : "text-white/40 hover:text-white/70 hover:bg-white/5"
                          }`}
                        >
                          {p + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed text-white/60 hover:text-white text-[10px] font-semibold border border-white/8 transition-colors"
                  >
                    Next ›
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    title="Last page"
                  >
                    »
                  </button>

                  <span className="text-[10px] text-white/25 ml-2">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <AssetPreview asset={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Stat({ label, value, icon }: { label: string; value: number; icon?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-[11px] text-white/30">{icon}</span>}
      <span className="text-[13px] font-bold text-white">{value.toLocaleString()}</span>
      <span className="text-[10px] text-white/35">{label}</span>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { label: string; value: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-2.5 py-1.5 rounded-lg text-[10px] border focus:outline-none focus:border-[#39de8b]/40 transition-colors ${
        value
          ? "bg-[#39de8b]/10 border-[#39de8b]/30 text-[#39de8b]"
          : "bg-white/4 border-white/8 text-white/40"
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
