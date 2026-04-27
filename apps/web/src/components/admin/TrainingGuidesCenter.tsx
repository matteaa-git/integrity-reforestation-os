"use client";

import { useState, useRef, useEffect } from "react";
import { getAllRecords, saveRecord, deleteRecord, saveBlobRecord, getBlobRecord, deleteBlobRecord } from "@/lib/adminDb";
import FilePreviewModal from "@/components/admin/FilePreviewModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrainingGuide {
  id: string;
  title: string;
  category: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedDate: string;
  objectUrl: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const GUIDE_CATEGORIES = ["Onboarding", "Safety", "Equipment", "Operations", "Compliance", "CVOR", "Other"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const inputCls = "w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">{children}</label>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, disabled, label }: { onCancel: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div className="flex gap-2 mt-5 justify-end">
      <button onClick={onCancel} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
      <button onClick={onSave} disabled={disabled} className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>{label}</button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingGuidesCenter() {
  const [guides, setGuides] = useState<TrainingGuide[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", category: "Safety" });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [previewGuide, setPreviewGuide] = useState<TrainingGuide | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const savedMeta = await getAllRecords<TrainingGuide & { hasFile: boolean }>("training_guide_meta");
      const withUrls: TrainingGuide[] = await Promise.all(
        savedMeta.map(async (g) => {
          const objectUrl = g.hasFile ? (await getBlobRecord("training_guide_blobs", g.id)) ?? "" : "";
          return { ...g, objectUrl };
        })
      );
      setGuides(withUrls.sort((a, b) => b.uploadedDate.localeCompare(a.uploadedDate)));
    }
    load();
  }, []);

  function handleFileSelect(file: File) {
    setPendingFile(file);
    setUploadForm(f => ({ ...f, title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") }));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function saveGuide() {
    if (!pendingFile || !uploadForm.title.trim()) return;
    const id = `g-${Date.now()}`;
    const objectUrl = URL.createObjectURL(pendingFile);
    const guide: TrainingGuide = {
      id,
      title: uploadForm.title.trim(),
      category: uploadForm.category,
      fileName: pendingFile.name,
      fileSize: pendingFile.size,
      fileType: pendingFile.type,
      uploadedDate: TODAY,
      objectUrl,
    };
    setGuides(prev => [guide, ...prev]);
    saveRecord("training_guide_meta", { ...guide, objectUrl: undefined, hasFile: true });
    saveBlobRecord("training_guide_blobs", id, pendingFile);
    setShowUpload(false);
    setPendingFile(null);
    setUploadForm({ title: "", category: "Safety" });
  }

  function deleteGuide(id: string) {
    setGuides(prev => {
      const g = prev.find(x => x.id === id);
      if (g?.objectUrl) URL.revokeObjectURL(g.objectUrl);
      return prev.filter(x => x.id !== id);
    });
    deleteRecord("training_guide_meta", id);
    deleteBlobRecord("training_guide_blobs", id);
  }

  function closeUpload() {
    setShowUpload(false);
    setPendingFile(null);
    setUploadForm({ title: "", category: "Safety" });
  }

  const allCategories = [...new Set(guides.map(g => g.category))].sort();
  const filtered = categoryFilter === "all" ? guides : guides.filter(g => g.category === categoryFilter);

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-sm font-semibold text-text-primary">Training Guides</div>
          <div className="text-xs text-text-tertiary mt-0.5">
            {guides.length === 0 ? "No guides uploaded yet" : `${guides.length} guide${guides.length !== 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {allCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none focus:border-primary/50"
            >
              <option value="all">All categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
          >
            <span className="text-[10px]">↑</span> Upload Guide
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {guides.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {GUIDE_CATEGORIES.filter(c => guides.some(g => g.category === c)).map(c => {
            const count = guides.filter(g => g.category === c).length;
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(v => v === c ? "all" : c)}
                className={`bg-surface border rounded-xl p-4 text-left transition-colors ${
                  categoryFilter === c ? "border-primary/50 bg-primary/5" : "border-border hover:border-border-strong"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{c}</div>
                <div className="text-xl font-bold text-text-primary mt-1">{count}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Guide grid */}
      {filtered.length === 0 ? (
        <div
          className={`rounded-xl border-2 border-dashed transition-colors p-16 text-center cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-border-strong"}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { handleDrop(e); setShowUpload(true); }}
          onClick={() => setShowUpload(true)}
        >
          <div className="text-3xl mb-3 opacity-20">◫</div>
          <div className="text-sm font-semibold text-text-secondary">
            {guides.length === 0 ? "No training guides yet" : `No guides in "${categoryFilter}"`}
          </div>
          <div className="text-xs text-text-tertiary mt-1">Upload PDF or DOCX files to build your guide library</div>
          <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-surface border border-border rounded-lg text-text-secondary">
            <span className="text-[10px]">↑</span> Upload your first guide
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(g => {
            const isPdf = g.fileType === "application/pdf" || g.fileName.endsWith(".pdf");
            return (
              <div
                key={g.id}
                onClick={() => setPreviewGuide(g)}
                className="bg-surface border border-border rounded-xl p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${isPdf ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}`}>
                    {isPdf ? "PDF" : "DOC"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-text-primary leading-snug">{g.title}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] bg-surface-secondary px-2 py-0.5 rounded text-text-secondary">{g.category}</span>
                      <span className="text-[10px] text-text-tertiary">{fmtSize(g.fileSize)}</span>
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-1 truncate">{g.fileName}</div>
                    <div className="text-[10px] text-text-tertiary">Uploaded {g.uploadedDate}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                  <span className="flex-1 text-[11px] text-primary font-medium">Click to preview</span>
                  <a
                    href={g.objectUrl}
                    download={g.fileName}
                    onClick={e => e.stopPropagation()}
                    className="text-[11px] text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ↓ Download
                  </a>
                  <button
                    onClick={e => { e.stopPropagation(); deleteGuide(g.id); }}
                    className="text-[11px] text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* File preview modal */}
      {previewGuide && (
        <FilePreviewModal
          url={previewGuide.objectUrl}
          name={previewGuide.fileName}
          type={previewGuide.fileType}
          onClose={() => setPreviewGuide(null)}
        />
      )}

      {/* Upload modal */}
      {showUpload && (
        <Modal title="Upload Training Guide" onClose={closeUpload}>
          <div className="space-y-4">
            <div
              className={`rounded-xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-border-strong"}`}
                style={pendingFile && !dragOver ? { borderColor: "rgba(57,222,139,0.4)", background: "rgba(57,222,139,0.04)" } : {}}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              {pendingFile ? (
                <div>
                  <div className="text-xl mb-1" style={{ color: "var(--color-primary)" }}>✓</div>
                  <div className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>{pendingFile.name}</div>
                  <div className="text-[10px] text-text-tertiary mt-1">{fmtSize(pendingFile.size)} · Click to replace</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-2 opacity-20">◫</div>
                  <div className="text-xs font-medium text-text-secondary">Drop a file or click to browse</div>
                  <div className="text-[10px] text-text-tertiary mt-1">PDF or DOCX, up to 50 MB</div>
                </div>
              )}
            </div>
            <div>
              <Label>Title</Label>
              <input type="text" value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} placeholder="Guide title…" className={inputCls} />
            </div>
            <div>
              <Label>Category</Label>
              <select value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {GUIDE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <ModalFooter onCancel={closeUpload} onSave={saveGuide} disabled={!pendingFile || !uploadForm.title.trim()} label="Save Guide" />
        </Modal>
      )}
    </div>
  );
}
