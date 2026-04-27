"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Employee } from "@/app/admin/page";
import { getAllRecords, saveRecord, deleteRecord, saveBlobRecord, getBlobRecord, deleteBlobRecord } from "@/lib/adminDb";

type MediaType     = "all" | "photo" | "video";
type MediaCategory = "all" | "field-ops" | "team" | "safety" | "equipment" | "events" | "documents";

interface MediaFile {
  id: string;
  name: string;
  type: "photo" | "video";
  category: Exclude<MediaCategory, "all">;
  employee: string;
  date: string;
  size: string;
  resolution?: string;
  duration?: string;
  tags: string[];
  hasBlob: boolean;
}

interface Props {
  employees?: Employee[];
}

const CATEGORY_LABELS: Record<Exclude<MediaCategory, "all">, string> = {
  "field-ops":  "Field Operations",
  team:         "Team",
  safety:       "Safety",
  equipment:    "Equipment",
  events:       "Events",
  documents:    "Documents",
};

const CATEGORY_COLORS: Record<Exclude<MediaCategory, "all">, React.CSSProperties> = {
  "field-ops": { background: "rgba(57,222,139,0.12)",  color: "var(--color-primary)" },
  team:        { background: "rgba(59,130,246,0.12)",  color: "var(--color-info)" },
  safety:      { background: "rgba(239,68,68,0.12)",   color: "var(--color-danger)" },
  equipment:   { background: "rgba(249,115,22,0.12)",  color: "#f97316" },
  events:      { background: "rgba(168,85,247,0.12)",  color: "#a855f7" },
  documents:   { background: "rgba(0,0,0,0.05)",       color: "var(--color-text-tertiary)" },
};

const PLACEHOLDER_COLORS: Record<Exclude<MediaCategory, "all">, string> = {
  "field-ops":  "from-emerald-900/30 to-emerald-950/20",
  team:         "from-blue-900/30 to-blue-950/20",
  safety:       "from-rose-900/30 to-rose-950/20",
  equipment:    "from-orange-900/30 to-orange-950/20",
  events:       "from-purple-900/30 to-purple-950/20",
  documents:    "from-gray-800/30 to-gray-900/20",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessType(name: string): "photo" | "video" {
  return /\.(mp4|mov|avi|mkv|webm)$/i.test(name) ? "video" : "photo";
}

const EMPTY_FORM = {
  name: "", category: "field-ops" as Exclude<MediaCategory, "all">,
  employee: "", date: new Date().toISOString().split("T")[0], tags: "",
};

export default function MediaLibrary({ employees = [] }: Props) {
  const [files, setFiles]             = useState<MediaFile[]>([]);
  const [typeFilter, setTypeFilter]   = useState<MediaType>("all");
  const [catFilter, setCatFilter]     = useState<MediaCategory>("all");
  const [viewMode, setViewMode]       = useState<"grid" | "list">("grid");
  const [isDragging, setIsDragging]   = useState(false);
  const [selected, setSelected]       = useState<MediaFile | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [showUpload, setShowUpload]   = useState(false);
  const [uploadForm, setUploadForm]   = useState({ ...EMPTY_FORM });
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const dropRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAllRecords<MediaFile>("media_files").then(r =>
      setFiles(r.sort((a, b) => b.date.localeCompare(a.date))));
  }, []);

  // Clean up blob URL on unmount / change
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const filtered = files.filter(f => {
    if (typeFilter !== "all" && f.type !== typeFilter) return false;
    if (catFilter  !== "all" && f.category !== catFilter) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase()) &&
        !f.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const photos = files.filter(f => f.type === "photo").length;
  const videos = files.filter(f => f.type === "video").length;

  // ── File picking ──────────────────────────────────────────────────────────

  function openFilePicker() { fileInputRef.current?.click(); }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingBlob(file);
    setUploadForm(f => ({
      ...f,
      name: file.name,
      date: new Date().toISOString().split("T")[0],
    }));
    setShowUpload(true);
    e.target.value = "";
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave() { setIsDragging(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setPendingBlob(file);
    setUploadForm(f => ({
      ...f,
      name: file.name,
      date: new Date().toISOString().split("T")[0],
    }));
    setShowUpload(true);
  }

  // ── Save uploaded file ────────────────────────────────────────────────────

  const confirmUpload = useCallback(async () => {
    if (!uploadForm.name) return;
    const id = `mf-${Date.now()}`;
    const rec: MediaFile = {
      id,
      name: uploadForm.name,
      type: guessType(uploadForm.name),
      category: uploadForm.category,
      employee: uploadForm.employee,
      date: uploadForm.date,
      size: pendingBlob ? formatBytes(pendingBlob.size) : "—",
      tags: uploadForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      hasBlob: !!pendingBlob,
    };
    await saveRecord("media_files", rec);
    if (pendingBlob) await saveBlobRecord("media_blobs", id, pendingBlob);
    setFiles(prev => [rec, ...prev]);
    setShowUpload(false);
    setUploadForm({ ...EMPTY_FORM });
    setPendingBlob(null);
  }, [uploadForm, pendingBlob]);

  // ── Open detail / load preview ────────────────────────────────────────────

  async function openDetail(file: MediaFile) {
    setSelected(file);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    if (file.hasBlob) {
      const url = await getBlobRecord("media_blobs", file.id);
      setPreviewUrl(url);
    }
  }

  function closeDetail() {
    setSelected(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
    await deleteRecord("media_files", id);
    await deleteBlobRecord("media_blobs", id);
    if (selected?.id === id) closeDetail();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const INPUT = "w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";
  const LABEL = "block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-1";

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Files", value: files.length, color: "" },
          { label: "Photos",      value: photos,       color: "text-blue-400" },
          { label: "Videos",      value: videos,       color: "text-purple-400" },
        ].map(k => (
          <div key={k.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{k.label}</div>
            <div className={`text-2xl font-bold mt-1 ${k.color || "text-text-primary"}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
        className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-primary/5"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={`text-3xl transition-transform ${isDragging ? "scale-110" : ""} opacity-30`}>↑</div>
          <div className="text-sm font-semibold text-text-primary">
            {isDragging ? "Drop file to upload" : "Drag & drop or click to upload"}
          </div>
          <div className="text-xs text-text-tertiary">Supports JPG, PNG, MP4, MOV · Max 500 MB per file</div>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChosen} />

      {/* Filters + view toggle */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input type="text" placeholder="Search files or tags…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 w-44" />

        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["all","photo","video"] as MediaType[]).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className="px-3 py-1.5 text-xs font-medium capitalize transition-all"
              style={typeFilter === t ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}>
              {t === "all" ? "All" : t === "photo" ? "Photos" : "Videos"}
            </button>
          ))}
        </div>

        <select value={catFilter} onChange={e => setCatFilter(e.target.value as MediaCategory)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none">
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as Exclude<MediaCategory,"all">[]).map(k => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>

        <div className="flex-1" />
        <div className="text-xs text-text-tertiary">{filtered.length} files</div>

        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setViewMode("grid")}
            className="px-2.5 py-1.5 text-xs transition-all"
            style={viewMode === "grid" ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}>⊞</button>
          <button onClick={() => setViewMode("list")}
            className="px-2.5 py-1.5 text-xs transition-all"
            style={viewMode === "list" ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" } : {}}>≡</button>
        </div>
      </div>

      {/* Grid view */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(file => {
            const grad = PLACEHOLDER_COLORS[file.category];
            const cat  = CATEGORY_COLORS[file.category];
            return (
              <div key={file.id}
                className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
                onClick={() => openDetail(file)}>
                <div className={`h-32 bg-gradient-to-br ${grad} flex items-center justify-center relative`}>
                  <span className="text-4xl opacity-15">{file.type === "video" ? "▶" : "▤"}</span>
                  {file.type === "video" && file.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{file.duration}</div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                </div>
                <div className="p-3">
                  <div className="text-[11px] font-medium text-text-primary truncate">{file.name}</div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold" style={cat}>
                      {CATEGORY_LABELS[file.category]}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-tertiary mt-1">{file.size} · {file.date}</div>
                </div>
              </div>
            );
          })}

          {/* Upload tile */}
          <div onClick={openFilePicker}
            className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 min-h-[160px] hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
            onDragOver={handleDragOver} onDrop={handleDrop}>
            <span className="text-2xl opacity-20 group-hover:opacity-40 transition-opacity">+</span>
            <span className="text-[11px] font-medium text-text-tertiary group-hover:text-primary transition-colors">Upload Files</span>
          </div>
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                {["File Name","Type","Category","Employee","Date","Size",""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(file => {
                const cat = CATEGORY_COLORS[file.category];
                return (
                  <tr key={file.id} className="hover:bg-surface-secondary/40 transition-colors cursor-pointer" onClick={() => openDetail(file)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base opacity-30">{file.type === "video" ? "▶" : "▤"}</span>
                        <span className="font-medium text-text-primary">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-text-secondary">{file.type}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={cat}>
                        {CATEGORY_LABELS[file.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{file.employee || "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{file.date}</td>
                    <td className="px-4 py-3 text-text-secondary">{file.size}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteFile(file.id)}
                        className="text-[11px] text-text-tertiary hover:text-rose-400 transition-colors" title="Delete">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-2xl mb-2 opacity-20">▤</div>
              <div className="text-sm font-medium text-text-secondary">No files found</div>
            </div>
          )}
        </div>
      )}

      {/* ── Upload / Tag Modal ──────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Add File Details</div>
              <button onClick={() => { setShowUpload(false); setPendingBlob(null); setUploadForm({ ...EMPTY_FORM }); }}
                className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={LABEL}>File Name</label>
                <input type="text" value={uploadForm.name}
                  onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Category</label>
                  <select value={uploadForm.category}
                    onChange={e => setUploadForm(f => ({ ...f, category: e.target.value as Exclude<MediaCategory,"all"> }))} className={INPUT}>
                    {(Object.keys(CATEGORY_LABELS) as Exclude<MediaCategory,"all">[]).map(k => (
                      <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Date</label>
                  <input type="date" value={uploadForm.date}
                    onChange={e => setUploadForm(f => ({ ...f, date: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Employee (optional)</label>
                <select value={uploadForm.employee}
                  onChange={e => setUploadForm(f => ({ ...f, employee: e.target.value }))} className={INPUT}>
                  <option value="">— none —</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Tags (comma-separated)</label>
                <input type="text" placeholder="e.g. camp, spring, block-22" value={uploadForm.tags}
                  onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} className={INPUT} />
              </div>
              {pendingBlob && (
                <div className="text-[11px] text-text-tertiary bg-surface-secondary rounded-lg px-3 py-2">
                  File ready: <span className="text-text-secondary font-medium">{formatBytes(pendingBlob.size)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowUpload(false); setPendingBlob(null); setUploadForm({ ...EMPTY_FORM }); }}
                className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary">Cancel</button>
              <button onClick={confirmUpload} disabled={!uploadForm.name}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── File Detail Modal ───────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary truncate pr-4">{selected.name}</div>
              <button onClick={closeDetail} className="text-text-tertiary hover:text-text-primary text-lg leading-none shrink-0">×</button>
            </div>

            {/* Preview */}
            <div className={`h-48 bg-gradient-to-br ${PLACEHOLDER_COLORS[selected.category]} flex items-center justify-center relative overflow-hidden`}>
              {previewUrl && selected.type === "photo" && (
                <img src={previewUrl} alt={selected.name} className="h-full w-full object-contain" />
              )}
              {previewUrl && selected.type === "video" && (
                <video src={previewUrl} controls className="h-full w-full object-contain" />
              )}
              {!previewUrl && (
                <span className="text-6xl opacity-10">{selected.type === "video" ? "▶" : "▤"}</span>
              )}
            </div>

            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: "Type",     value: selected.type },
                  { label: "Category", value: CATEGORY_LABELS[selected.category] },
                  { label: "Employee", value: selected.employee || "—" },
                  { label: "Date",     value: selected.date },
                  { label: "Size",     value: selected.size },
                  { label: selected.type === "video" ? "Duration" : "Resolution",
                    value: selected.duration ?? selected.resolution ?? "—" },
                ].map(row => (
                  <div key={row.label}>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wide font-medium">{row.label}</div>
                    <div className="text-text-primary mt-0.5 font-medium capitalize">{row.value}</div>
                  </div>
                ))}
              </div>
              {selected.tags.length > 0 && (
                <div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wide font-medium mb-1.5">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-surface-secondary border border-border px-2 py-0.5 rounded font-medium text-text-secondary">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <button onClick={() => deleteFile(selected.id)}
                className="px-3 py-2 text-xs font-medium text-rose-400 border border-rose-400/20 rounded-lg hover:bg-rose-400/10 transition-colors">
                Delete
              </button>
              <div className="flex gap-2">
                <button onClick={closeDetail}
                  className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Close</button>
                {previewUrl && (
                  <a href={previewUrl} download={selected.name}
                    className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                    ↓ Download
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
