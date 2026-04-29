"use client";

import { useState, useEffect } from "react";
import type { Employee } from "@/app/admin/page";
import { getAllDocuments, saveRecord, type StoredDocument } from "@/lib/adminDb";
import { createClient } from "@/lib/supabase/client";

type ProfileTab = "overview" | "documents" | "signatures" | "training" | "payroll" | "compliance" | "media";

const TABS: { id: ProfileTab; label: string; icon: string }[] = [
  { id: "overview",    label: "Overview",    icon: "◉" },
  { id: "documents",   label: "Documents",   icon: "◫" },
  { id: "signatures",  label: "Signatures",  icon: "✍" },
  { id: "training",    label: "Training",    icon: "⚑" },
  { id: "payroll",     label: "Payroll",     icon: "▦" },
  { id: "compliance",  label: "Compliance",  icon: "☑" },
  { id: "media",       label: "Media",       icon: "▤" },
];

const DEPARTMENTS = ["Operations", "Field Operations", "Health & Safety", "Human Resources", "Logistics", "Camp Services"];

function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

const STATUS_BADGE: Record<Employee["status"], { label: string; style: React.CSSProperties }> = {
  active:   { label: "Active",   style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  inactive: { label: "Inactive", style: { background: "rgba(0,0,0,0.05)", color: "var(--color-text-tertiary)" } },
  onleave:  { label: "On Leave", style: { background: "rgba(251,183,0,0.12)", color: "var(--color-warning)" } },
};

interface ProfileDocument { id: string; name: string; type: string; date: string; status: string; storagePath?: string; hasFile?: boolean; }
interface ProfileSignature { id: string; document: string; sentDate: string; status: string; method: string; signedDate?: string; }
interface ProfileTraining { id: string; name: string; category: string; completedDate: string; expiryDate: string | null; status: string; }
interface ProfilePayroll { id: string; period: string; grossPay: string; netPay: string; status: string; date: string; }
interface ProfileCompliance { id: string; item: string; status: string; date: string; }
interface ProfileMedia { id: string; name: string; type: string; size: string; date: string; }

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

function today() { return new Date().toISOString().slice(0, 10); }

const DOC_STATUS: Record<string, React.CSSProperties> = {
  signed:  { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" },
  pending: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" },
  expired: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)" },
};

const TRAIN_STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  valid:    { label: "Valid",    style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  expiring: { label: "Expiring", style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  expired:  { label: "Expired",  style: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  } },
};

const COMP_STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  compliant:       { label: "Compliant",     style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  "non-compliant": { label: "Non-Compliant", style: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  } },
  pending:         { label: "Pending",       style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
};

interface HSDoc { id: string; filename: string; category: string; doc_type: string; storage_path?: string; }

interface EmployeeProfileProps {
  employee: Employee;
  employees: Employee[];
  onBack: () => void;
  onUpdateEmployee: (emp: Employee) => void;
  userRole?: string;
  userName?: string;
}

export default function EmployeeProfile({ employee, employees, onBack, onUpdateEmployee, userRole = "admin", userName = "" }: EmployeeProfileProps) {
  const isCrewBoss = userRole === "crew_boss";
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [localEmp, setLocalEmp]   = useState<Employee>(employee);
  const badge = STATUS_BADGE[localEmp.status];

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Employee>(employee);

  function openEdit() {
    setEditForm(localEmp);
    setShowEdit(true);
  }

  function handleSaveEdit() {
    const updated = { ...editForm, avatar: initials(editForm.name) };
    setLocalEmp(updated);
    onUpdateEmployee(updated);
    setShowEdit(false);
  }

  function ef<K extends keyof Employee>(key: K, val: Employee[K]) {
    setEditForm(prev => ({ ...prev, [key]: val }));
  }

  const fieldCls = "w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";
  // React.CSSProperties used throughout for brand-consistent badge styling

  const [documents, setDocuments]   = useState<ProfileDocument[]>([]);
  const [signatures, setSignatures] = useState<ProfileSignature[]>([]);
  const [training, setTraining]     = useState<ProfileTraining[]>([]);
  const [payroll, setPayroll]       = useState<ProfilePayroll[]>([]);
  const [compliance, setCompliance] = useState<ProfileCompliance[]>([]);
  const [media, setMedia]           = useState<ProfileMedia[]>([]);

  const [docCenterDocs, setDocCenterDocs] = useState<StoredDocument[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendDocId, setSendDocId]         = useState("");
  const [sendDueDate, setSendDueDate]     = useState("");
  const [sendNote, setSendNote]           = useState("");
  const [sending, setSending]             = useState(false);
  const [toast, setToast]                 = useState<string | null>(null);
  const [toastType, setToastType]         = useState<"success" | "error">("success");

  // H&S assignment modal
  const [showHSModal, setShowHSModal]     = useState(false);
  const [hsDocs, setHsDocs]               = useState<HSDoc[]>([]);
  const [hsDocId, setHsDocId]             = useState("");
  const [hsDueDate, setHsDueDate]         = useState("");
  const [hsNote, setHsNote]               = useState("");
  const [hsAssigning, setHsAssigning]     = useState(false);
  const [hsAssignDone, setHsAssignDone]   = useState(false);

  useEffect(() => {
    getAllDocuments().then(setDocCenterDocs);
  }, []);

  useEffect(() => {
    fetch(`/api/admin/employee-documents?employee=${encodeURIComponent(employee.name)}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setDocuments(data.map((d: Record<string, unknown>) => ({
          id:          String(d.id),
          name:        String(d.name),
          type:        String(d.category),
          date:        d.date_added ? new Date(String(d.date_added)).toLocaleDateString("en-CA") : "—",
          status:      String(d.status),
          storagePath: d.storage_path ? String(d.storage_path) : undefined,
          hasFile:     Boolean(d.has_file),
        })));
      });
  }, [employee.name]);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToastType(type);
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function openSendModal() {
    setSendDocId("");
    setSendDueDate("");
    setSendNote("");
    setShowSendModal(true);
  }

  async function handleSend() {
    if (!sendDocId || !sendDueDate) return;
    const doc = docCenterDocs.find(d => d.id === sendDocId)!;
    const category = DOC_CATEGORY_LABELS[doc.category] ?? doc.category;
    setSending(true);
    try {
      const res = await fetch("/api/send-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: employee.name,
          recipientEmail: employee.email,
          document: doc.name,
          category,
          dueDate: sendDueDate,
          note: sendNote || null,
          isReminder: false,
        }),
      });
      if (!res.ok) throw new Error();
      const newReq = {
        id: `sig-${Date.now()}`,
        document: doc.name,
        sentDate: today(),
        status: "pending" as const,
        method: "Email",
        signedDate: undefined as string | undefined,
      };
      await saveRecord("signature_requests", {
        ...newReq,
        category,
        recipientId: employee.id,
        recipientName: employee.name,
        recipientEmail: employee.email,
        dueDate: sendDueDate,
        note: sendNote || undefined,
      });
      setSignatures(prev => [newReq, ...prev]);
      setShowSendModal(false);
      showToast(`Document sent to ${employee.email}`);
    } catch {
      showToast("Failed to send. Check your email configuration.", "error");
    } finally {
      setSending(false);
    }
  }

  async function openHSModal() {
    setHsDocId("");
    setHsDueDate("");
    setHsNote("");
    setHsAssignDone(false);
    setShowHSModal(true);
    if (hsDocs.length === 0) {
      const db = (await import("@/lib/supabase/client")).createClient();
      const { data } = await db.from("hs_documents").select("id, filename, category, doc_type, storage_path").order("filename");
      setHsDocs((data as HSDoc[]) ?? []);
    }
  }

  async function handleHSAssign() {
    if (!hsDocId) return;
    const doc = hsDocs.find(d => d.id === hsDocId)!;
    setHsAssigning(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    await fetch(`${API_BASE}/hs/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_id: doc.id,
        doc_title: doc.filename.replace(/\.(pdf|docx?|xlsx?)$/i, ""),
        assigned_to: employee.name,
        assigned_by: userName || "Crew Boss",
        due_date: hsDueDate,
        note: hsNote,
      }),
    });
    setHsAssigning(false);
    setHsAssignDone(true);
  }

  return (
    <>
    <div className="p-7 max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary mb-5 transition-colors"
      >
        ← Back to Employees
      </button>

      {/* Header card */}
      <div className="bg-surface rounded-xl border border-border shadow-sm p-6 mb-5">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-xl text-lg font-bold flex items-center justify-center shrink-0"
            style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
            {localEmp.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-semibold text-text-primary">{localEmp.name}</h1>
              {localEmp.employeeNumber && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide"
                  style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
                  # {localEmp.employeeNumber}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={badge.style}>
                {badge.label}
              </span>
            </div>
            <div className="text-sm text-text-secondary mt-0.5">{localEmp.role} · {localEmp.department}</div>
            <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary flex-wrap">
              <span>✉ {localEmp.email}</span>
              <span>☎ {localEmp.phone}</span>
              {localEmp.city && <span>📍 {localEmp.city}, {localEmp.province}</span>}
              <span>Started {localEmp.startDate}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {!isCrewBoss && (
              <button
                onClick={openEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              >
                ✎ Edit
              </button>
            )}
            <button
              onClick={openHSModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
            >
              ◫ Assign H&S Doc
            </button>
            <button
              onClick={openSendModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
            >
              ✍ Send Document
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-border mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="opacity-60">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Personal */}
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface-secondary/50">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Personal Information</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0 divide-y divide-border/50 md:divide-y-0">
              {[
                { label: "Full Legal Name",  value: localEmp.name },
                { label: "Employee ID #",    value: localEmp.employeeNumber || "—" },
                { label: "Status",           value: badge.label },
                { label: "SIN",              value: localEmp.sin ? `***-***-${localEmp.sin.slice(-3)}` : "—" },
                { label: "Work Permit #",    value: localEmp.workPermit || "—" },
                { label: "Driver's Licence", value: localEmp.dlClass || "—" },
                { label: "First Aid",        value: localEmp.firstAid || "—" },
                { label: "Start Date",       value: localEmp.startDate },
                { label: "Internal ID",      value: localEmp.id },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 border-b border-border/50 last:border-b-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-0.5">{label}</div>
                  <div className={`text-xs text-text-primary ${label === "Internal ID" ? "font-mono" : ""}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface-secondary/50">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Contact Information</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0">
              {[
                { label: "Email",          value: localEmp.email || "—" },
                { label: "Phone",          value: localEmp.phone || "—" },
                { label: "Street Address", value: localEmp.streetAddress || "—" },
                { label: "City",           value: localEmp.city || "—" },
                { label: "Province",       value: localEmp.province || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 border-b border-border/50 last:border-b-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-0.5">{label}</div>
                  <div className="text-xs text-text-primary">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Employment */}
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface-secondary/50">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Employment Details</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0">
              {[
                { label: "Job Title",   value: localEmp.role || "—" },
                { label: "Department",  value: localEmp.department || "—" },
                { label: "Reports To",  value: (localEmp.crewBoss && localEmp.crewBoss.toLowerCase() !== "myself") ? localEmp.crewBoss : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 border-b border-border/50 last:border-b-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-0.5">{label}</div>
                  <div className="text-xs text-text-primary">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface-secondary/50">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Emergency Contact</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0">
              {[
                { label: "Name",  value: localEmp.emergencyContactName  || "—" },
                { label: "Phone", value: localEmp.emergencyContactPhone || "—" },
                { label: "Email", value: localEmp.emergencyContactEmail || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 border-b border-border/50 last:border-b-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-0.5">{label}</div>
                  <div className="text-xs text-text-primary">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Banking */}
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-surface-secondary/50">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Banking Information</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              {[
                { label: "Bank",               value: localEmp.bankName              || "—" },
                { label: "Account #",          value: localEmp.bankAccountNumber     ? `••••${localEmp.bankAccountNumber.slice(-3)}` : "—" },
                { label: "Transit #",          value: localEmp.bankTransitNumber     || "—" },
                { label: "Institution #",      value: localEmp.bankInstitutionNumber || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 border-b border-border/50 last:border-b-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-0.5">{label}</div>
                  <div className="text-xs text-text-primary font-mono">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
            <div className="text-xs font-semibold text-text-primary">Documents ({documents.length})</div>
            <button className="text-xs text-primary hover:underline">+ Upload</button>
          </div>
          {documents.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary">No documents uploaded yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary">
                  {["Document Name", "Type", "Date Added", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {documents.map((doc) => (
                  <tr key={doc.id} className="group hover:bg-surface-secondary transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{doc.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{doc.type}</td>
                    <td className="px-4 py-3 text-text-secondary">{doc.date}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize" style={DOC_STATUS[doc.status]}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {doc.hasFile && doc.storagePath && (
                          <button
                            onClick={() => {
                              window.open(`/api/admin/view-document?path=${encodeURIComponent(doc.storagePath!)}`, "_blank");
                            }}
                            className="text-[11px] text-primary hover:underline"
                          >View</button>
                        )}
                        <button
                          onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))}
                          className="text-[11px] text-text-tertiary hover:text-red-400 font-medium opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "signatures" && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
            <div className="text-xs font-semibold text-text-primary">Signature Requests ({signatures.length})</div>
            <button
              onClick={openSendModal}
              className="text-xs font-semibold px-3 py-1 rounded-lg hover:opacity-90 transition-all"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
            >
              ✍ Send for Signature
            </button>
          </div>
          {signatures.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary">No signature requests yet. Use "Send for Signature" to request one.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary">
                  {["Document", "Sent", "Method", "Status", "Signed", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {signatures.map((sig) => (
                  <tr key={sig.id} className="group hover:bg-surface-secondary transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{sig.document}</td>
                    <td className="px-4 py-3 text-text-secondary">{sig.sentDate}</td>
                    <td className="px-4 py-3 text-text-secondary">{sig.method}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={
                        sig.status === "signed"
                          ? { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }
                          : { background: "rgba(251,183,0,0.12)", color: "var(--color-warning)" }
                      }>
                        {sig.status === "signed" ? "Signed" : "Awaiting"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{sig.signedDate ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSignatures(prev => prev.filter(s => s.id !== sig.id))}
                        className="text-[11px] text-text-tertiary hover:text-red-400 font-medium opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "training" && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
            <div className="text-xs font-semibold text-text-primary">Training & Certifications ({training.length})</div>
            <button className="text-xs text-primary hover:underline">+ Add Record</button>
          </div>
          {training.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary">No training records yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary">
                  {["Certification / Course", "Category", "Completed", "Expires", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {training.map((t) => {
                  const s = TRAIN_STATUS[t.status];
                  return (
                    <tr key={t.id} className="group hover:bg-surface-secondary transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{t.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{t.category}</td>
                      <td className="px-4 py-3 text-text-secondary">{t.completedDate}</td>
                      <td className="px-4 py-3 text-text-secondary">{t.expiryDate ?? "No expiry"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s.style}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setTraining(prev => prev.filter(x => x.id !== t.id))}
                          className="text-[11px] text-text-tertiary hover:text-red-400 font-medium opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
            <div className="text-xs font-semibold text-text-primary">Payroll & Tax Records ({payroll.length})</div>
            <button className="text-xs text-primary hover:underline">+ Generate Stub</button>
          </div>
          {payroll.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary">No payroll records yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-light bg-surface-secondary">
                  {["Period", "Gross Pay", "Net Pay", "Status", "Date", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {payroll.map((p) => (
                  <tr key={p.id} className="group hover:bg-surface-secondary transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{p.period}</td>
                    <td className="px-4 py-3 text-text-primary font-mono">{p.grossPay}</td>
                    <td className="px-4 py-3 text-text-primary font-mono">{p.netPay}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={
                        p.status === "paid"
                          ? { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }
                          : { background: "rgba(59,130,246,0.12)", color: "var(--color-info)" }
                      }>
                        {p.status === "paid" ? "Paid" : "Issued"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{p.date}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button className="text-[11px] text-primary hover:underline">Download PDF</button>
                        <button
                          onClick={() => setPayroll(prev => prev.filter(x => x.id !== p.id))}
                          className="text-[11px] text-text-tertiary hover:text-red-400 font-medium opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "compliance" && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
            <div className="text-xs font-semibold text-text-primary">Compliance Checklist</div>
            <div className="text-xs text-emerald-600 font-medium">
              {compliance.filter((c) => c.status === "compliant").length}/{compliance.length} compliant
            </div>
          </div>
          {compliance.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary">No compliance items yet.</div>
          ) : (
            <div className="divide-y divide-border-light">
              {compliance.map((c) => {
                const s = COMP_STATUS[c.status];
                return (
                  <div key={c.id} className="group flex items-center gap-4 px-5 py-3 hover:bg-surface-secondary transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      c.status === "compliant" ? "bg-success" : c.status === "pending" ? "bg-warning" : "bg-danger"
                    }`} />
                    <div className="flex-1 text-xs text-text-primary">{c.item}</div>
                    <div className="text-[11px] text-text-tertiary">{c.date}</div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s.style}>
                      {s.label}
                    </span>
                    <button
                      onClick={() => setCompliance(prev => prev.filter(x => x.id !== c.id))}
                      className="text-[11px] text-text-tertiary hover:text-red-400 font-medium opacity-0 group-hover:opacity-100 transition-all ml-1"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "media" && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {media.map((m) => (
              <div key={m.id} className="group relative bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="h-24 bg-surface-secondary flex items-center justify-center text-3xl opacity-20">
                  {m.type === "video" ? "▶" : "▤"}
                </div>
                <div className="p-3">
                  <div className="text-[11px] font-medium text-text-primary truncate">{m.name}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{m.size} · {m.date}</div>
                </div>
                <button
                  onClick={() => setMedia(prev => prev.filter(x => x.id !== m.id))}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            {media.length === 0 && (
              <div className="col-span-4 py-10 text-center text-xs text-text-tertiary">No media files yet.</div>
            )}
            {/* Upload tile */}
            <button className="h-full min-h-[120px] bg-surface border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all text-text-tertiary hover:text-primary">
              <span className="text-2xl opacity-40">+</span>
              <span className="text-[11px] font-medium">Upload File</span>
            </button>
          </div>
        </div>
      )}
    </div>

      {/* ── Edit Employee Modal ──────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
              <div className="text-sm font-semibold text-text-primary">Edit Employee — {localEmp.name}</div>
              <button onClick={() => setShowEdit(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-6">

              {/* Personal */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Personal Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Legal Name *</label>
                    <input value={editForm.name} onChange={e => ef("name", e.target.value)} placeholder="Jane Elizabeth Smith" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Employee ID #</label>
                    <input value={editForm.employeeNumber ?? ""} onChange={e => ef("employeeNumber", e.target.value)} placeholder="e.g. EMP-001" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">SIN</label>
                    <input value={editForm.sin ?? ""} onChange={e => ef("sin", e.target.value)} placeholder="000-000-000" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Work Permit #</label>
                    <input value={editForm.workPermit ?? ""} onChange={e => ef("workPermit", e.target.value)} placeholder="If applicable" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Driver's Licence Class</label>
                    <input value={editForm.dlClass ?? ""} onChange={e => ef("dlClass", e.target.value)} placeholder="G, G2, DZ…" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">First Aid</label>
                    <input value={editForm.firstAid ?? ""} onChange={e => ef("firstAid", e.target.value)} placeholder="Standard, Advanced…" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                    <select value={editForm.status} onChange={e => ef("status", e.target.value as Employee["status"])} className={fieldCls}>
                      <option value="active">Active</option>
                      <option value="onleave">On Leave</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Start Date</label>
                    <input type="date" value={editForm.startDate} onChange={e => ef("startDate", e.target.value)} className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Contact Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Email *</label>
                    <input type="email" value={editForm.email} onChange={e => ef("email", e.target.value)} placeholder="jane@example.com" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone Number</label>
                    <input value={editForm.phone} onChange={e => ef("phone", e.target.value)} placeholder="416-555-0100" className={fieldCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Street Address</label>
                    <input value={editForm.streetAddress ?? ""} onChange={e => ef("streetAddress", e.target.value)} placeholder="123 Main St" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">City</label>
                    <input value={editForm.city ?? ""} onChange={e => ef("city", e.target.value)} placeholder="Toronto" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Province</label>
                    <input value={editForm.province ?? ""} onChange={e => ef("province", e.target.value)} placeholder="ON" className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* Employment */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Employment Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Job Title *</label>
                    <input value={editForm.role} onChange={e => ef("role", e.target.value)} placeholder="Tree Planter" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Department</label>
                    <select value={editForm.department} onChange={e => ef("department", e.target.value)} className={fieldCls}>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Reports To (Crew Boss)</label>
                    <input
                      list="cb-options"
                      value={editForm.crewBoss ?? ""}
                      onChange={e => ef("crewBoss", e.target.value)}
                      placeholder="Select or type crew boss name…"
                      className={fieldCls}
                    />
                    <datalist id="cb-options">
                      {employees
                        .filter(e => e.role.toLowerCase().includes("crew boss") || e.role.toLowerCase().includes("supervisor"))
                        .map(e => <option key={e.id} value={e.name} />)
                      }
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Emergency Contact</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name</label>
                    <input value={editForm.emergencyContactName ?? ""} onChange={e => ef("emergencyContactName", e.target.value)} placeholder="John Smith" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone Number</label>
                    <input value={editForm.emergencyContactPhone ?? ""} onChange={e => ef("emergencyContactPhone", e.target.value)} placeholder="416-555-0199" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Email Address</label>
                    <input type="email" value={editForm.emergencyContactEmail ?? ""} onChange={e => ef("emergencyContactEmail", e.target.value)} placeholder="contact@example.com" className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* Banking */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Banking Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Name of Bank</label>
                    <input value={editForm.bankName ?? ""} onChange={e => ef("bankName", e.target.value)} placeholder="TD Bank, RBC…" className={fieldCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Account Number</label>
                    <input value={editForm.bankAccountNumber ?? ""} onChange={e => ef("bankAccountNumber", e.target.value)} placeholder="7-digit account number" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Transit Number</label>
                    <input value={editForm.bankTransitNumber ?? ""} onChange={e => ef("bankTransitNumber", e.target.value)} placeholder="5 digits" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Institution Number</label>
                    <input value={editForm.bankInstitutionNumber ?? ""} onChange={e => ef("bankInstitutionNumber", e.target.value)} placeholder="3 digits" className={fieldCls} />
                  </div>
                </div>
              </div>

            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-surface">
              <button onClick={() => setShowEdit(false)}
                className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveEdit}
                disabled={!editForm.name.trim() || !editForm.email.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Document Modal ───────────────────────────────────────── */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <div className="text-sm font-semibold text-text-primary">Send for E-Signature</div>
                <div className="text-xs text-text-tertiary mt-0.5">To: {employee.name} ({employee.email})</div>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Document</label>
                <select
                  value={sendDocId}
                  onChange={e => setSendDocId(e.target.value)}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select a document…</option>
                  {docCenterDocs.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({DOC_CATEGORY_LABELS[d.category] ?? d.category})
                    </option>
                  ))}
                </select>
                {docCenterDocs.length === 0 && (
                  <p className="text-[10px] text-text-tertiary mt-1">Upload documents in Document Center first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Signature Due Date</label>
                <input
                  type="date"
                  value={sendDueDate}
                  onChange={e => setSendDueDate(e.target.value)}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-primary focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Message (optional)</label>
                <textarea
                  value={sendNote}
                  onChange={e => setSendNote(e.target.value)}
                  placeholder="Add a note to the recipient…"
                  rows={3}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!sendDocId || !sendDueDate || sending}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                {sending ? "Sending…" : "✍ Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* H&S Assign Modal */}
      {showHSModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Assign H&S Document</div>
              <button onClick={() => setShowHSModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            {hsAssignDone ? (
              <div className="py-10 flex flex-col items-center gap-4 px-5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                  style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>✓</div>
                <div className="text-center">
                  <div className="text-sm font-bold text-text-primary">Document Assigned</div>
                  <div className="text-xs text-text-tertiary mt-1">Assigned to <span className="font-semibold text-text-secondary">{employee.name}</span></div>
                </div>
                <button onClick={() => setShowHSModal(false)}
                  className="px-5 py-2 text-xs font-bold rounded-lg"
                  style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                  Done
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Assigning To</label>
                  <div className="px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-secondary">{employee.name}</div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">H&S Document *</label>
                  <select value={hsDocId} onChange={e => setHsDocId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50">
                    <option value="">Select a document…</option>
                    {hsDocs.map(d => (
                      <option key={d.id} value={d.id}>{d.filename.replace(/\.(pdf|docx?|xlsx?)$/i, "")} — {d.category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Due Date</label>
                  <input type="date" value={hsDueDate} onChange={e => setHsDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Note / Instructions</label>
                  <textarea value={hsNote} onChange={e => setHsNote(e.target.value)} rows={3} placeholder="Any instructions…"
                    className="w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50 resize-none" />
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-border">
                  <button onClick={() => setShowHSModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-secondary transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleHSAssign} disabled={hsAssigning || !hsDocId}
                    className="px-5 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                    {hsAssigning ? "Assigning…" : "Assign Document"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-xs font-medium text-text-primary flex items-center gap-2">
          <span className={toastType === "error" ? "text-red-400" : "text-emerald-400"}>
            {toastType === "error" ? "✕" : "✓"}
          </span>
          {toast}
        </div>
      )}
    </>
  );
}
