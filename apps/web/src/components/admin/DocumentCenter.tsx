"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import FilePreviewModal from "@/components/admin/FilePreviewModal";
import type { Employee } from "@/app/admin/page";
import { createClient } from "@/lib/supabase/client";

export type DocCategory = "agreement" | "waiver" | "health-safety" | "receipt" | "tax" | "cvor" | "driver-log" | "other";
export type DocStatus   = "signed" | "pending" | "expired" | "draft";

interface Doc {
  id:           string;
  name:         string;
  category:     DocCategory;
  employee:     string;
  status:       DocStatus;
  size:         string;
  has_file:     boolean;
  storage_path: string | null;
  date_added:   string;
}

type DocCategoryFilter = DocCategory | "all";
type DocStatusFilter   = DocStatus   | "all";
type SortField = "name" | "employee" | "category" | "date_added" | "status";

const CATEGORY_LABELS: Record<DocCategory, string> = {
  agreement:       "Employment Agreement",
  waiver:          "Liability Waiver",
  "health-safety": "Health & Safety",
  receipt:         "Receipt",
  tax:             "Tax Form",
  cvor:            "CVOR",
  "driver-log":    "Driver Log",
  other:           "Other",
};

const CATEGORY_COLORS: Record<DocCategory, React.CSSProperties> = {
  agreement:       { background: "rgba(59,130,246,0.12)",  color: "var(--color-info)" },
  waiver:          { background: "rgba(168,85,247,0.12)",  color: "#a855f7" },
  "health-safety": { background: "rgba(239,68,68,0.12)",   color: "var(--color-danger)" },
  receipt:         { background: "rgba(249,115,22,0.12)",  color: "#f97316" },
  tax:             { background: "rgba(20,184,166,0.12)",  color: "#14b8a6" },
  cvor:            { background: "rgba(99,102,241,0.12)",  color: "#6366f1" },
  "driver-log":    { background: "rgba(6,182,212,0.12)",   color: "#06b6d4" },
  other:           { background: "rgba(0,0,0,0.05)",       color: "var(--color-text-tertiary)" },
};

const STATUS_BADGE: Record<DocStatus, { label: string; style: React.CSSProperties }> = {
  signed:  { label: "Signed",  style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  pending: { label: "Pending", style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  expired: { label: "Expired", style: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  } },
  draft:   { label: "Draft",   style: { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" } },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentCenterProps {
  employees: Employee[];
}

export default function DocumentCenter({ employees }: DocumentCenterProps) {
  const supabase = createClient();

  const [docs, setDocs]     = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<DocCategoryFilter>("all");
  const [statusFilter,   setStatusFilter]   = useState<DocStatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date_added");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [localSearch, setLocalSearch] = useState("");

  // Upload modal
  const [showUpload,      setShowUpload]      = useState(false);
  const [uploadName,      setUploadName]      = useState("");
  const [uploadCategory,  setUploadCategory]  = useState<DocCategory>("agreement");
  const [uploadEmployee,  setUploadEmployee]  = useState("All Staff");
  const [uploadStatus,    setUploadStatus]    = useState<DocStatus>("draft");
  const [uploadFile,      setUploadFile]      = useState<File | null>(null);
  const [uploading,       setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewType, setPreviewType] = useState("");

  // Toast
  const [toast, setToast] = useState<{ msg: string; type?: "error" } | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);

  // Edit modal
  const [editTarget,   setEditTarget]   = useState<Doc | null>(null);
  const [editName,     setEditName]     = useState("");
  const [editCategory, setEditCategory] = useState<DocCategory>("agreement");
  const [editEmployee, setEditEmployee] = useState("All Staff");
  const [editStatus,   setEditStatus]   = useState<DocStatus>("draft");
  const [editFile,     setEditFile]     = useState<File | null>(null);
  const [editing,      setEditing]      = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Send modal
  const [sendTarget,      setSendTarget]      = useState<Doc | null>(null);
  const [sendEmail,       setSendEmail]       = useState("");
  const [sendName,        setSendName]        = useState("");
  const [sending,         setSending]         = useState(false);
  const [sendError,       setSendError]       = useState("");

  const showToast = useCallback((msg: string, type?: "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("id,name,category,employee,status,size,has_file,storage_path,date_added")
      .order("date_added", { ascending: false });
    if (!error && data) setDocs(data as Doc[]);
    setLoading(false);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const filtered = docs
    .filter(d => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      if (statusFilter   !== "all" && d.status   !== statusFilter)   return false;
      if (localSearch) {
        const q = localSearch.toLowerCase();
        if (!d.name.toLowerCase().includes(q) && !d.employee.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      const av = a[sortField] ?? ""; const bv = b[sortField] ?? "";
      return av < bv ? -mult : av > bv ? mult : 0;
    });

  const counts = {
    total:   docs.length,
    signed:  docs.filter(d => d.status === "signed").length,
    pending: docs.filter(d => d.status === "pending").length,
    expired: docs.filter(d => d.status === "expired").length,
  };

  async function handleUpload() {
    if (!uploadName.trim()) return;
    setUploading(true);

    let storagePath: string | null = null;
    let size = "—";

    if (uploadFile) {
      const ext  = uploadFile.name.split(".").pop() ?? "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, uploadFile, { cacheControl: "3600", upsert: false });
      if (upErr) {
        showToast(`Upload failed: ${upErr.message}`, "error");
        setUploading(false);
        return;
      }
      storagePath = path;
      size = formatSize(uploadFile.size);
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        name:         uploadName.trim(),
        category:     uploadCategory,
        employee:     uploadEmployee,
        status:       uploadStatus,
        size,
        has_file:     !!storagePath,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (error) {
      showToast(`Save failed: ${error.message}`, "error");
    } else {
      setDocs(prev => [data as Doc, ...prev]);
      setShowUpload(false);
      resetUploadForm();
      showToast("Document saved.");
    }
    setUploading(false);
  }

  function resetUploadForm() {
    setUploadName(""); setUploadCategory("agreement");
    setUploadEmployee("All Staff"); setUploadStatus("draft"); setUploadFile(null);
  }

  async function getSignedUrl(doc: Doc): Promise<string | null> {
    if (!doc.has_file || !doc.storage_path) return null;
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    return data?.signedUrl ?? null;
  }

  async function handleView(doc: Doc) {
    if (!doc.has_file) { showToast("No file attached."); return; }
    const url = await getSignedUrl(doc);
    if (!url) { showToast("Could not load file."); return; }
    setPreviewUrl(url);
    setPreviewName(doc.name);
    const ext = doc.name.split(".").pop()?.toLowerCase() ?? "";
    setPreviewType(["png","jpg","jpeg","gif","webp","svg"].includes(ext) ? "image" : "other");
  }

  async function handleDownload(doc: Doc) {
    if (!doc.has_file) { showToast("No file attached."); return; }
    const url = await getSignedUrl(doc);
    if (!url) { showToast("Could not load file."); return; }
    const a = document.createElement("a");
    a.href = url; a.download = doc.name; a.click();
  }

  function openEdit(doc: Doc) {
    setEditTarget(doc); setEditName(doc.name);
    setEditCategory(doc.category); setEditEmployee(doc.employee);
    setEditStatus(doc.status); setEditFile(null);
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim()) return;
    setEditing(true);

    let storagePath = editTarget.storage_path;
    let size        = editTarget.size;
    let hasFile     = editTarget.has_file;

    if (editFile) {
      const ext  = editFile.name.split(".").pop() ?? "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, editFile, { cacheControl: "3600", upsert: false });
      if (upErr) {
        showToast(`Upload failed: ${upErr.message}`, "error");
        setEditing(false);
        return;
      }
      // Delete old file
      if (editTarget.storage_path) {
        await supabase.storage.from("documents").remove([editTarget.storage_path]);
      }
      storagePath = path;
      size = formatSize(editFile.size);
      hasFile = true;
    }

    const { error } = await supabase
      .from("documents")
      .update({
        name: editName.trim(), category: editCategory,
        employee: editEmployee, status: editStatus,
        size, has_file: hasFile, storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editTarget.id);

    if (error) {
      showToast(`Update failed: ${error.message}`, "error");
    } else {
      setDocs(prev => prev.map(d => d.id === editTarget.id
        ? { ...d, name: editName.trim(), category: editCategory, employee: editEmployee,
            status: editStatus, size, has_file: hasFile, storage_path: storagePath }
        : d
      ));
      setEditTarget(null);
      showToast("Document updated.");
    }
    setEditing(false);
  }

  async function handleDelete(doc: Doc) {
    if (doc.storage_path) {
      await supabase.storage.from("documents").remove([doc.storage_path]);
    }
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    setDeleteTarget(null);
    showToast("Document deleted.");
  }

  async function handleStatusChange(doc: Doc, status: DocStatus) {
    await supabase.from("documents").update({ status, updated_at: new Date().toISOString() }).eq("id", doc.id);
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status } : d));
    showToast(`Status → ${STATUS_BADGE[status].label}`);
  }

  function openSend(doc: Doc) {
    const emp = employees.find(e => e.name === doc.employee);
    setSendTarget(doc);
    setSendEmail(emp?.email ?? "");
    setSendName(doc.employee === "All Staff" ? "" : doc.employee);
    setSendError("");
  }

  async function handleSend() {
    if (!sendTarget || !sendEmail) return;
    setSending(true); setSendError("");
    const res = await fetch("/api/admin/documents/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: sendTarget.id, recipientEmail: sendEmail, recipientName: sendName }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSendError(json.error ?? "Failed to send.");
    } else {
      // Refresh status if it changed to pending
      await loadDocs();
      setSendTarget(null);
      showToast(`Document sent to ${sendEmail}`);
    }
    setSending(false);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-text-tertiary opacity-30 ml-1">↕</span>;
    return <span className="ml-1" style={{ color: "var(--color-primary)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const employeeNames = ["All Staff", ...employees.map(e => e.name)];

  const inputCls = "w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";
  const labelCls = "block text-[11px] font-medium text-text-secondary mb-1";

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center h-64">
        <span className="text-sm text-text-tertiary animate-pulse">Loading documents…</span>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Documents", value: counts.total,   accent: "" },
          { label: "Signed",          value: counts.signed,  accent: "text-success" },
          { label: "Pending",         value: counts.pending, accent: "text-warning" },
          { label: "Expired",         value: counts.expired, accent: "text-danger" },
        ].map(k => (
          <div key={k.label} className="bg-surface rounded-xl border border-border shadow-sm p-4">
            <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{k.label}</div>
            <div className={`text-2xl font-bold mt-1 ${k.accent || "text-text-primary"}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text" placeholder="Search documents…"
          value={localSearch} onChange={e => setLocalSearch(e.target.value)}
          className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 w-48"
        />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as DocCategoryFilter)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none focus:border-primary/50">
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map(k => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as DocStatusFilter)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none focus:border-primary/50">
          <option value="all">All statuses</option>
          <option value="signed">Signed</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="draft">Draft</option>
        </select>
        <div className="flex-1" />
        <div className="text-xs text-text-tertiary">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</div>
        <button onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
          + Upload Document
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {([
                { field: "name" as SortField,      label: "Document Name" },
                { field: "category" as SortField,  label: "Type" },
                { field: "employee" as SortField,  label: "Employee" },
                { field: "date_added" as SortField, label: "Date Added" },
                { field: "status" as SortField,    label: "Status" },
              ]).map(col => (
                <th key={col.field} onClick={() => handleSort(col.field)}
                  className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px] cursor-pointer hover:text-text-secondary select-none">
                  {col.label}<SortIcon field={col.field} />
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map(doc => {
              const catColor = CATEGORY_COLORS[doc.category];
              const sb = STATUS_BADGE[doc.status];
              return (
                <tr key={doc.id} onClick={() => doc.has_file && handleView(doc)}
                  className={`hover:bg-surface-secondary transition-colors group ${doc.has_file ? "cursor-pointer" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary flex items-center gap-1.5">
                      {!doc.has_file && <span className="text-[9px] text-text-tertiary border border-border rounded px-1 py-0.5">no file</span>}
                      {doc.name}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">{doc.size}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={catColor}>
                      {CATEGORY_LABELS[doc.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{doc.employee}</td>
                  <td className="px-4 py-3 text-text-secondary">{doc.date_added}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select value={doc.status}
                      onChange={e => handleStatusChange(doc, e.target.value as DocStatus)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none"
                      style={sb.style}>
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="signed">Signed</option>
                      <option value="expired">Expired</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {doc.has_file && (
                        <>
                          <button onClick={() => handleView(doc)} className="text-[11px] hover:underline" style={{ color: "var(--color-primary)" }}>View</button>
                          <span className="text-border">|</span>
                          <button onClick={() => handleDownload(doc)} className="text-[11px] text-text-secondary hover:text-text-primary" title="Download">↓</button>
                          <span className="text-border">|</span>
                        </>
                      )}
                      <button onClick={() => openSend(doc)}
                        className="text-[11px] font-semibold hover:underline" style={{ color: "var(--color-info)" }}>
                        Send
                      </button>
                      <span className="text-border">|</span>
                      <button onClick={() => openEdit(doc)} className="text-[11px] text-text-secondary hover:text-text-primary">Edit</button>
                      <span className="text-border">|</span>
                      <button onClick={() => setDeleteTarget(doc)} className="text-[11px] text-text-tertiary hover:text-danger">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-2xl mb-2 opacity-20">◫</div>
            <div className="text-sm font-medium text-text-secondary">
              {docs.length === 0 ? "No documents yet" : "No documents match your filters"}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {docs.length === 0 ? "Upload your first document using the button above" : "Try adjusting your filters"}
            </div>
          </div>
        )}
      </div>

      {/* ── Upload Modal ── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[480px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Upload Document</h3>
              <button onClick={() => { setShowUpload(false); resetUploadForm(); }} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className={labelCls}>Document Name *</label>
                <input type="text" value={uploadName} onChange={e => setUploadName(e.target.value)}
                  placeholder="e.g. Employment Agreement – John Smith 2026" className={inputCls} /></div>
              <div><label className={labelCls}>Category</label>
                <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value as DocCategory)} className={inputCls}>
                  {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map(k => (
                    <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                  ))}
                </select></div>
              <div><label className={labelCls}>Employee</label>
                <select value={uploadEmployee} onChange={e => setUploadEmployee(e.target.value)} className={inputCls}>
                  {employeeNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select></div>
              <div><label className={labelCls}>Status</label>
                <select value={uploadStatus} onChange={e => setUploadStatus(e.target.value as DocStatus)} className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="expired">Expired</option>
                </select></div>
              <div>
                <label className={labelCls}>Attach File (optional)</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  {uploadFile ? (
                    <div className="text-xs text-text-primary">
                      <span className="font-medium">{uploadFile.name}</span>
                      <span className="text-text-tertiary ml-2">({formatSize(uploadFile.size)})</span>
                      <button onClick={e => { e.stopPropagation(); setUploadFile(null); }} className="ml-3 text-danger hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div className="text-xs text-text-tertiary">
                      <div className="text-lg opacity-30 mb-1">↑</div>Click to attach a file
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setUploadFile(f); if (!uploadName) setUploadName(f.name.replace(/\.[^.]+$/, "")); }
                  }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowUpload(false); resetUploadForm(); }}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleUpload} disabled={!uploadName.trim() || uploading}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {uploading ? "Uploading…" : "Save Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewUrl && (
        <FilePreviewModal url={previewUrl} name={previewName} type={previewType}
          onClose={() => setPreviewUrl(null)} />
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[480px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Edit Document</h3>
              <button onClick={() => setEditTarget(null)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className={labelCls}>Document Name *</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Category</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value as DocCategory)} className={inputCls}>
                  {(Object.keys(CATEGORY_LABELS) as DocCategory[]).map(k => (
                    <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                  ))}
                </select></div>
              <div><label className={labelCls}>Employee</label>
                <select value={editEmployee} onChange={e => setEditEmployee(e.target.value)} className={inputCls}>
                  {employeeNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select></div>
              <div><label className={labelCls}>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as DocStatus)} className={inputCls}>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="expired">Expired</option>
                </select></div>
              <div>
                <label className={labelCls}>Replace File {editTarget.has_file && <span className="text-text-tertiary font-normal">(replaces existing)</span>}</label>
                <div onClick={() => editFileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  {editFile ? (
                    <div className="text-xs text-text-primary">
                      <span className="font-medium">{editFile.name}</span>
                      <span className="text-text-tertiary ml-2">({formatSize(editFile.size)})</span>
                      <button onClick={e => { e.stopPropagation(); setEditFile(null); }} className="ml-3 text-danger hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div className="text-xs text-text-tertiary">
                      <div className="text-lg opacity-30 mb-1">↑</div>
                      {editTarget.has_file ? "Click to replace the attached file" : "Click to attach a file"}
                    </div>
                  )}
                </div>
                <input ref={editFileInputRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setEditFile(f); }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleEdit} disabled={!editName.trim() || editing}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {editing ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Modal ── */}
      {sendTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[420px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Send Document</h3>
              <button onClick={() => setSendTarget(null)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="text-xs text-text-secondary bg-surface-secondary rounded-lg px-3 py-2 border border-border truncate">
                {sendTarget.name}
              </div>
              <div><label className={labelCls}>Recipient Name</label>
                <input type="text" value={sendName} onChange={e => setSendName(e.target.value)}
                  placeholder="Jane Smith" className={inputCls} /></div>
              <div><label className={labelCls}>Recipient Email *</label>
                <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)}
                  placeholder="jane@example.com" className={inputCls} /></div>
              {sendError && (
                <div className="text-[11px] text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">{sendError}</div>
              )}
              <p className="text-[10px] text-text-tertiary">
                The recipient will receive an email with a secure download link (valid 72 hours).
                {sendTarget.status === "draft" && " Status will be updated to Pending."}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setSendTarget(null)}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleSend} disabled={!sendEmail || sending}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {sending ? <><span className="animate-spin">⟳</span> Sending…</> : <>✉ Send Document</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[380px] p-6">
            <div className="text-sm font-semibold text-text-primary mb-2">Delete Document</div>
            <div className="text-xs text-text-secondary mb-5">
              Are you sure you want to delete <span className="font-medium text-text-primary">{deleteTarget.name}</span>? This cannot be undone.
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-xs font-medium bg-danger text-white rounded-lg hover:opacity-90 transition-opacity">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-xs px-5 py-3 rounded-xl shadow-xl z-50 max-w-sm text-center ${
          toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
