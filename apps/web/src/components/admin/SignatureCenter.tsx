"use client";

import { useState, useMemo, useEffect } from "react";
import type { Employee } from "@/app/admin/page";
import { getAllRecords, saveRecord, deleteRecord, getAllDocuments, getDocumentBlob, type StoredDocument } from "@/lib/adminDb";

type SigStatus = "awaiting" | "signed" | "overdue" | "declined" | "voided";
type FilterTab = "all" | SigStatus;

interface SignatureRequest {
  id: string;
  document: string;
  documentId: string;
  category: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  sentDate: string;
  dueDate: string;
  status: SigStatus;
  signedDate?: string;
  note?: string;
  token?: string;
  signingUrl?: string;
}

const DOC_CATEGORY_LABELS: Record<string, string> = {
  agreement:       "Agreement",
  waiver:          "Waiver",
  "health-safety": "H&S Form",
  receipt:         "Receipt",
  tax:             "Tax Form",
  cvor:            "CVOR",
  "driver-log":    "Driver Log",
  other:           "Other",
};

const STATUS_META: Record<SigStatus, { label: string; pill: React.CSSProperties; dot: string; rowStyle?: React.CSSProperties; rowClass?: string }> = {
  awaiting: { label: "Awaiting",  pill: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" }, dot: "var(--color-warning)" },
  signed:   { label: "Signed",    pill: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }, dot: "var(--color-primary)" },
  overdue:  { label: "Overdue",   pill: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  }, dot: "var(--color-danger)",  rowStyle: { background: "rgba(239,68,68,0.03)" } },
  declined: { label: "Declined",  pill: { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" }, dot: "var(--color-text-tertiary)" },
  voided:   { label: "Voided",    pill: { background: "rgba(0,0,0,0.04)",      color: "var(--color-text-tertiary)" }, dot: "var(--color-text-tertiary)", rowClass: "opacity-50" },
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPast(date: string) { return date < today(); }

interface Props { employees: Employee[] }

export default function SignatureCenter({ employees }: Props) {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [docCenterDocs, setDocCenterDocs] = useState<StoredDocument[]>([]);

  useEffect(() => {
    getAllRecords<SignatureRequest>("signature_requests").then(async saved => {
      const sorted = saved.sort((a, b) => b.sentDate.localeCompare(a.sentDate));
      setRequests(sorted);
      // Sync server-side signature status for any awaiting requests with a token
      const pending = sorted.filter(r => (r.status === "awaiting" || r.status === "overdue") && r.token);
      for (const req of pending) {
        try {
          const res = await fetch(`/api/sign-token?requestId=${req.id}`);
          const data = await res.json();
          if (data.signed) {
            setRequests(prev => prev.map(r => {
              if (r.id !== req.id) return r;
              const updated = { ...r, status: "signed" as const, signedDate: data.signedAt ?? today() };
              saveRecord("signature_requests", updated);
              return updated;
            }));
          }
        } catch { /* ignore network errors */ }
      }
    });
    getAllDocuments().then(docs => setDocCenterDocs(docs));
  }, []);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showSend, setShowSend] = useState(false);
  const [viewReq, setViewReq] = useState<SignatureRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [sending, setSending] = useState(false);
  const [sendForm, setSendForm] = useState({
    template: "", recipientId: "", dueDate: "", note: "",
  });

  // Auto-flag overdue
  const normalized = useMemo(() =>
    requests.map(r =>
      (r.status === "awaiting" && isPast(r.dueDate))
        ? { ...r, status: "overdue" as SigStatus }
        : r
    ), [requests]);

  const filtered = useMemo(() =>
    filter === "all" ? normalized : normalized.filter(r => r.status === filter),
    [normalized, filter]);

  const counts = useMemo(() => ({
    all:      normalized.length,
    awaiting: normalized.filter(r => r.status === "awaiting").length,
    overdue:  normalized.filter(r => r.status === "overdue").length,
    signed:   normalized.filter(r => r.status === "signed").length,
    declined: normalized.filter(r => r.status === "declined").length,
    voided:   normalized.filter(r => r.status === "voided").length,
  }), [normalized]);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToastType(type);
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSend() {
    if (!sendForm.template || !sendForm.recipientId || !sendForm.dueDate) return;
    const doc = docCenterDocs.find(d => d.id === sendForm.template)!;
    const emp = employees.find(e => e.id === sendForm.recipientId)!;
    const docCategory = DOC_CATEGORY_LABELS[doc.category] ?? doc.category;
    const requestId = `sig-${Date.now()}`;

    setSending(true);
    try {
      // Fetch document blob from IndexedDB to embed in signing token
      let documentBlob = "";
      let documentType = "application/pdf";
      if (doc.hasFile) {
        const blobData = await getDocumentBlob(doc.id);
        if (blobData) {
          documentType = blobData.type || "application/pdf";
          documentBlob = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
            reader.onerror = reject;
            reader.readAsDataURL(blobData.blob);
          });
        }
      }

      // Create a server-side signing token
      const tokenRes = await fetch("/api/sign-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          employeeName: emp.name,
          employeeEmail: emp.email,
          documentName: doc.name,
          documentBlob,
          documentType,
          dueDate: sendForm.dueDate,
          note: sendForm.note || null,
        }),
      });
      if (!tokenRes.ok) throw new Error("Token creation failed");
      const { token, signingUrl } = await tokenRes.json();

      // Send the email with the signing link
      const res = await fetch("/api/send-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: emp.name,
          recipientEmail: emp.email,
          document: doc.name,
          category: docCategory,
          dueDate: sendForm.dueDate,
          note: sendForm.note || null,
          isReminder: false,
          signingUrl,
        }),
      });
      if (!res.ok) throw new Error("Send failed");

      const newReq: SignatureRequest = {
        id: requestId,
        document: doc.name,
        documentId: doc.id,
        category: docCategory,
        recipientId: emp.id,
        recipientName: emp.name,
        recipientEmail: emp.email,
        sentDate: today(),
        dueDate: sendForm.dueDate,
        status: "awaiting",
        note: sendForm.note || undefined,
        token,
        signingUrl,
      };
      setRequests(prev => [newReq, ...prev]);
      saveRecord("signature_requests", newReq);
      setShowSend(false);
      setSendForm({ template: "", recipientId: "", dueDate: "", note: "" });
      showToast(`Email sent to ${emp.name} (${emp.email})`);
    } catch {
      showToast("Failed to send. Check Gmail credentials.", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleRemind(req: SignatureRequest) {
    try {
      const res = await fetch("/api/send-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: req.recipientName,
          recipientEmail: req.recipientEmail,
          document: req.document,
          category: req.category,
          dueDate: req.dueDate,
          note: req.note || null,
          isReminder: true,
          signingUrl: req.signingUrl,
        }),
      });
      if (!res.ok) throw new Error();
      showToast(`Reminder sent to ${req.recipientEmail}`);
    } catch {
      showToast("Failed to send reminder.", "error");
    }
  }

  function copySigningLink(url: string) {
    navigator.clipboard.writeText(url).then(
      () => showToast("Signing link copied to clipboard"),
      () => showToast("Could not copy link", "error"),
    );
  }

  function handleMarkSigned(id: string) {
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, status: "signed" as const, signedDate: today() };
      saveRecord("signature_requests", updated);
      return updated;
    }));
    setViewReq(prev => prev?.id === id ? { ...prev, status: "signed", signedDate: today() } : prev);
    showToast("Marked as signed");
  }

  function handleMarkDeclined(id: string) {
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, status: "declined" as const };
      saveRecord("signature_requests", updated);
      return updated;
    }));
    setViewReq(prev => prev?.id === id ? { ...prev, status: "declined" } : prev);
    showToast("Marked as declined");
  }

  function handleVoid(id: string) {
    setRequests(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, status: "voided" as const };
      saveRecord("signature_requests", updated);
      return updated;
    }));
    setViewReq(null);
    showToast("Request voided");
  }

  function handleDelete(id: string) {
    setRequests(prev => prev.filter(r => r.id !== id));
    deleteRecord("signature_requests", id);
    setViewReq(null);
  }

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "awaiting", label: "Awaiting" },
    { key: "overdue",  label: "Overdue" },
    { key: "signed",   label: "Signed" },
    { key: "declined", label: "Declined" },
  ];

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Sent",  value: counts.all,      color: "var(--color-text-primary)" },
          { label: "Awaiting",    value: counts.awaiting, color: "var(--color-warning)" },
          { label: "Overdue",     value: counts.overdue,  color: "var(--color-danger)" },
          { label: "Completed",   value: counts.signed,   color: "var(--color-primary)" },
        ].map(k => (
          <div key={k.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{k.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs + action */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              filter === key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
            {key !== "all" && counts[key] > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold ${filter === key ? "text-primary" : "text-text-tertiary"}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowSend(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-1 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
        >
          ✍ Send for Signature
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Document", "Type", "Recipient", "Sent", "Due", "Status", "Signed", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map(req => {
              const meta = STATUS_META[req.status];
              return (
                <tr key={req.id} className={`group hover:bg-surface-secondary/60 transition-colors ${meta.rowClass ?? ""}`} style={meta.rowStyle}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary leading-snug max-w-[220px]">{req.document}</div>
                    {req.note && <div className="text-[10px] text-text-tertiary mt-0.5 italic truncate max-w-[220px]">{req.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{req.category}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{req.recipientName}</div>
                    <div className="text-[10px] text-text-tertiary">{req.recipientEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary whitespace-nowrap">{req.sentDate}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: req.status === "overdue" ? "var(--color-danger)" : "var(--color-text-secondary)" }}>
                    {req.dueDate}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={meta.pill}>
                        {meta.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-tertiary whitespace-nowrap">{req.signedDate ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(req.status === "awaiting" || req.status === "overdue") && req.signingUrl && (
                        <button
                          onClick={() => copySigningLink(req.signingUrl!)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                          title="Copy signing link"
                        >
                          Copy Link
                        </button>
                      )}
                      {(req.status === "awaiting" || req.status === "overdue") && (
                        <button
                          onClick={() => handleRemind(req)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
                        >
                          Remind
                        </button>
                      )}
                      <button
                        onClick={() => setViewReq(req)}
                        className="text-[11px] text-primary hover:text-primary/80 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(req.id)}
                        className="text-[11px] text-text-tertiary hover:text-red-400 font-medium transition-colors"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-2xl mb-2 opacity-20">✍</div>
            <div className="text-sm font-medium text-text-secondary">No signature requests</div>
            <div className="text-xs text-text-tertiary mt-1">
              {filter !== "all" ? `No ${filter} requests` : "Send a document to get started"}
            </div>
          </div>
        )}
      </div>

      {/* ── Send Modal ──────────────────────────────────────────────────────── */}
      {showSend && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <div className="text-sm font-semibold text-text-primary">Send for E-Signature</div>
                <div className="text-xs text-text-tertiary mt-0.5">Creates a signature request for the recipient</div>
              </div>
              <button onClick={() => setShowSend(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Document</label>
                <select
                  value={sendForm.template}
                  onChange={e => setSendForm(s => ({ ...s, template: e.target.value }))}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select a document…</option>
                  {docCenterDocs.length === 0 ? (
                    <option disabled value="">No documents in Document Center yet</option>
                  ) : (
                    docCenterDocs.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({DOC_CATEGORY_LABELS[d.category] ?? d.category})
                      </option>
                    ))
                  )}
                </select>
                {docCenterDocs.length === 0 && (
                  <p className="text-[10px] text-text-tertiary mt-1">Upload documents in Document Center first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Recipient</label>
                <select
                  value={sendForm.recipientId}
                  onChange={e => setSendForm(s => ({ ...s, recipientId: e.target.value }))}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select employee…</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Signature Due Date</label>
                <input
                  type="date"
                  value={sendForm.dueDate}
                  onChange={e => setSendForm(s => ({ ...s, dueDate: e.target.value }))}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-primary focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Message (optional)</label>
                <textarea
                  value={sendForm.note}
                  onChange={e => setSendForm(s => ({ ...s, note: e.target.value }))}
                  placeholder="Add a note to the recipient…"
                  rows={3}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowSend(false)}
                className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!sendForm.template || !sendForm.recipientId || !sendForm.dueDate || sending}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                {sending ? "Sending…" : "✍ Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View / Detail Modal ─────────────────────────────────────────────── */}
      {viewReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border">
              <div>
                <div className="text-sm font-semibold text-text-primary">{viewReq.document}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{viewReq.category}</div>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const meta = STATUS_META[viewReq.status];
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={meta.pill}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                  );
                })()}
                <button onClick={() => setViewReq(null)} className="text-text-tertiary hover:text-text-primary text-lg leading-none ml-2">×</button>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              {/* Recipient */}
              <div className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg border border-border">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {viewReq.recipientName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="text-xs font-semibold text-text-primary">{viewReq.recipientName}</div>
                  <div className="text-[11px] text-text-tertiary">{viewReq.recipientEmail}</div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">Sent</div>
                  <div className="text-text-primary">{viewReq.sentDate}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">Due</div>
                  <div className="font-semibold" style={{ color: viewReq.status === "overdue" ? "var(--color-danger)" : "var(--color-text-primary)" }}>{viewReq.dueDate}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">Signed</div>
                  <div className="font-semibold" style={{ color: viewReq.signedDate ? "var(--color-primary)" : "var(--color-text-tertiary)" }}>
                    {viewReq.signedDate ?? "Not yet signed"}
                  </div>
                </div>
              </div>

              {/* Signing link */}
              {viewReq.signingUrl && (viewReq.status === "awaiting" || viewReq.status === "overdue") && (
                <div className="p-3 bg-surface-secondary rounded-lg border border-border">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1.5">Signing Link</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-[11px] text-text-secondary truncate font-mono bg-surface px-2 py-1 rounded border border-border">{viewReq.signingUrl}</div>
                    <button
                      onClick={() => copySigningLink(viewReq.signingUrl!)}
                      className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded border border-border text-text-secondary hover:text-primary hover:border-primary transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Note */}
              {viewReq.note && (
                <div className="p-3 bg-surface-secondary rounded-lg border border-border text-xs text-text-secondary italic">
                  {viewReq.note}
                </div>
              )}

              {/* Document placeholder */}
              <div className="rounded-lg border border-border bg-surface-secondary/50 p-8 text-center">
                <div className="text-2xl opacity-20 mb-2">◫</div>
                <div className="text-xs text-text-tertiary">Document preview</div>
                <div className="text-[10px] text-text-tertiary/60 mt-1">{viewReq.document}.pdf</div>
                <button className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border transition-colors">
                  <span className="text-[10px]">↓</span> Download
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-border">
              {(viewReq.status === "awaiting" || viewReq.status === "overdue") && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMarkSigned(viewReq.id)}
                    className="flex-1 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                  >
                    ✓ Mark as Signed
                  </button>
                  <button
                    onClick={() => handleMarkDeclined(viewReq.id)}
                    className="flex-1 py-2 text-xs font-semibold bg-surface-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ✕ Mark as Declined
                  </button>
                  <button
                    onClick={() => handleRemind(viewReq)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border hover:opacity-90 transition-all" style={{ background: "rgba(251,183,0,0.12)", color: "var(--color-warning)", borderColor: "rgba(251,183,0,0.2)" }}
                  >
                    ↺ Remind
                  </button>
                </div>
              )}
              {viewReq.status === "signed" && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 py-2 text-xs font-semibold text-center" style={{ color: "var(--color-primary)" }}>
                    ✓ Signed on {viewReq.signedDate}
                  </div>
                  <button
                    onClick={() => handleVoid(viewReq.id)}
                    className="px-4 py-2 text-xs font-medium text-text-tertiary hover:text-danger border border-border rounded-lg transition-colors"
                  >
                    Void
                  </button>
                </div>
              )}
              {(viewReq.status === "declined" || viewReq.status === "voided") && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(viewReq.id)}
                    className="px-4 py-2 text-xs font-medium text-danger/80 hover:text-danger border border-border rounded-lg transition-colors"
                  >
                    Delete Record
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => setViewReq(null)}
                    className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-xs font-medium text-text-primary flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span style={{ color: toastType === "error" ? "var(--color-danger)" : "var(--color-primary)" }}>
            {toastType === "error" ? "✕" : "✓"}
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
