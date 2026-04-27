"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Employee } from "@/app/admin/page";
import { getAllRecords, saveRecord, deleteRecord, saveBlobRecord, getBlobRecord, deleteBlobRecord } from "@/lib/adminDb";

// ── Types ─────────────────────────────────────────────────────────────────────

type ComplianceTab = "register" | "health-safety" | "forms";
type ComplianceStatus = "compliant" | "non-compliant" | "pending" | "na";
type FormStatus = "pending-review" | "reviewed" | "action-required";

interface ComplianceItem {
  id: string;
  category: string;
  requirement: string;
  scope: string;
  dueDate: string;
  completedDate: string;
  status: ComplianceStatus;
  notes: string;
}

interface HSForm {
  id: string;
  formType: string;
  title: string;
  submittedBy: string;
  date: string;
  description: string;
  status: FormStatus;
  fileName?: string;
  fileSize?: number;
  objectUrl?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPLIANCE_CATEGORIES = [
  "Employment", "Health & Safety", "WSIB / WCB", "CVOR",
  "Payroll", "Insurance", "Environmental", "Corporate / Legal", "Other",
];

const HS_FORM_TYPES = [
  "Hazard Assessment",
  "Near Miss Report",
  "Injury / Incident Report",
  "Daily Safety Inspection",
  "Equipment Pre-Op Check",
  "Emergency Drill Record",
  "WHMIS Checklist",
  "Return to Work Plan",
  "Other",
];

const TABS: { id: ComplianceTab; label: string; icon: string }[] = [
  { id: "register",      label: "Compliance Register", icon: "☑" },
  { id: "health-safety", label: "Health & Safety",     icon: "⚑" },
  { id: "forms",         label: "H&S Forms",           icon: "◫" },
];

const COMP_STATUS_META: Record<ComplianceStatus, { label: string; pill: React.CSSProperties; dot: string }> = {
  compliant:       { label: "Compliant",     pill: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }, dot: "var(--color-primary)" },
  "non-compliant": { label: "Non-Compliant", pill: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  }, dot: "var(--color-danger)"  },
  pending:         { label: "Pending",       pill: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" }, dot: "var(--color-warning)" },
  na:              { label: "N/A",           pill: { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" }, dot: "var(--color-text-tertiary)" },
};

const FORM_STATUS_META: Record<FormStatus, { label: string; pill: React.CSSProperties }> = {
  "pending-review":  { label: "Pending Review",  pill: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  reviewed:          { label: "Reviewed",         pill: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  "action-required": { label: "Action Required",  pill: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  } },
};

const TODAY = new Date().toISOString().split("T")[0];

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>
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

interface Props { employees: Employee[] }

export default function ComplianceCenter({ employees }: Props) {
  const [activeTab, setActiveTab] = useState<ComplianceTab>("register");

  // ── Register state ────────────────────────────────────────────────────────
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState<ComplianceItem | null>(null);
  const blankItem = { category: "Health & Safety", requirement: "", scope: "Company-Wide", dueDate: "", completedDate: "", status: "pending" as ComplianceStatus, notes: "" };
  const [itemForm, setItemForm] = useState(blankItem);

  // ── H&S Forms state ───────────────────────────────────────────────────────
  const [forms, setForms] = useState<HSForm[]>([]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [prefilledType, setPrefilledType] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blankForm = { formType: "", title: "", submittedBy: "", date: TODAY, description: "", status: "pending-review" as FormStatus };
  const [hsForm, setHsForm] = useState(blankForm);

  // ── Load from IndexedDB on mount ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [savedItems, savedFormsMeta] = await Promise.all([
        getAllRecords<ComplianceItem>("compliance_items"),
        getAllRecords<HSForm & { hasFile: boolean }>("compliance_forms"),
      ]);
      setItems(savedItems);
      const formsWithUrls: HSForm[] = await Promise.all(
        savedFormsMeta.map(async (f) => {
          const objectUrl = f.hasFile ? (await getBlobRecord("compliance_form_blobs", f.id)) ?? undefined : undefined;
          return { ...f, objectUrl };
        })
      );
      setForms(formsWithUrls.sort((a, b) => b.date.localeCompare(a.date)));
    }
    load();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeEmployees = employees.filter(e => e.status === "active");

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category))), [items]);

  const filteredItems = useMemo(() =>
    categoryFilter === "all" ? items : items.filter(i => i.category === categoryFilter),
    [items, categoryFilter]);

  const safetyItems = useMemo(() => items.filter(i => i.category === "Health & Safety"), [items]);

  const compliant    = items.filter(i => i.status === "compliant").length;
  const nonCompliant = items.filter(i => i.status === "non-compliant").length;
  const pending      = items.filter(i => i.status === "pending").length;
  const total        = items.length;
  const score        = total === 0 ? 100 : Math.round((compliant / total) * 100);

  // ── Register handlers ─────────────────────────────────────────────────────

  function openAddItem() {
    setItemForm(blankItem);
    setShowAddItem(true);
  }

  function openEditItem(item: ComplianceItem) {
    setItemForm({ ...item });
    setEditItem(item);
  }

  function saveItem() {
    if (!itemForm.requirement.trim()) return;
    if (editItem) {
      const updated = { ...itemForm, id: editItem.id };
      setItems(prev => prev.map(i => i.id === editItem.id ? updated : i));
      saveRecord("compliance_items", updated);
      setEditItem(null);
    } else {
      const newItem = { ...itemForm, id: `ci-${Date.now()}` };
      setItems(prev => [newItem, ...prev]);
      saveRecord("compliance_items", newItem);
      setShowAddItem(false);
    }
    setItemForm(blankItem);
  }

  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    deleteRecord("compliance_items", id);
  }

  function cycleStatus(id: string) {
    const order: ComplianceStatus[] = ["pending", "compliant", "non-compliant", "na"];
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, status: order[(order.indexOf(i.status) + 1) % order.length] };
      saveRecord("compliance_items", updated);
      return updated;
    }));
  }

  // ── H&S Form handlers ─────────────────────────────────────────────────────

  function openSubmitForm(type = "") {
    setPrefilledType(type);
    setHsForm({ ...blankForm, formType: type, title: type });
    setFormFile(null);
    setShowSubmitForm(true);
  }

  function handleFormFile(file: File) { setFormFile(file); }

  function submitHSForm() {
    if (!hsForm.formType || !hsForm.submittedBy) return;
    const id = `hs-${Date.now()}`;
    const newForm: HSForm = {
      id,
      formType: hsForm.formType,
      title: hsForm.title || hsForm.formType,
      submittedBy: hsForm.submittedBy,
      date: hsForm.date,
      description: hsForm.description,
      status: "pending-review",
      ...(formFile ? {
        fileName: formFile.name,
        fileSize: formFile.size,
        objectUrl: URL.createObjectURL(formFile),
      } : {}),
    };
    setForms(prev => [newForm, ...prev]);
    saveRecord("compliance_forms", { ...newForm, objectUrl: undefined, hasFile: !!formFile });
    if (formFile) saveBlobRecord("compliance_form_blobs", id, formFile);
    setShowSubmitForm(false);
    setFormFile(null);
    setHsForm(blankForm);
  }

  function updateFormStatus(id: string, status: FormStatus) {
    setForms(prev => prev.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, status };
      saveRecord("compliance_forms", { ...updated, objectUrl: undefined, hasFile: !!updated.objectUrl });
      return updated;
    }));
  }

  function deleteForm(id: string) {
    setForms(prev => {
      const f = prev.find(x => x.id === id);
      if (f?.objectUrl) URL.revokeObjectURL(f.objectUrl);
      return prev.filter(x => x.id !== id);
    });
    deleteRecord("compliance_forms", id);
    deleteBlobRecord("compliance_form_blobs", id);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {/* Score card */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1">Compliance Score</div>
          <div className="text-3xl font-bold" style={{ color: score >= 80 ? "var(--color-primary)" : score >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}>
            {total === 0 ? "—" : `${score}%`}
          </div>
          <div className="mt-2 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${score}%`, background: score >= 80 ? "var(--color-primary)" : score >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}
            />
          </div>
          <div className="text-[10px] text-text-tertiary mt-1">
            {total === 0 ? "No requirements added" : `${compliant}/${total} requirements met`}
          </div>
        </div>
        {[
          { label: "Compliant",     value: compliant,    color: "text-emerald-400" },
          { label: "Non-Compliant", value: nonCompliant, color: nonCompliant > 0 ? "text-red-400" : "" },
          { label: "Pending",       value: pending,      color: pending > 0 ? "text-amber-400" : "" },
        ].map(k => (
          <div key={k.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{k.label}</div>
            <div className={`text-2xl font-bold mt-1 ${k.color || "text-text-primary"}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-border mb-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <span className="opacity-60">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Compliance Register ──────────────────────────────────────────────── */}
      {activeTab === "register" && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none focus:border-primary/50"
            >
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex-1" />
            <span className="text-[11px] text-text-tertiary">{filteredItems.length} requirement{filteredItems.length !== 1 ? "s" : ""}</span>
            <button onClick={openAddItem} className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
              + Add Requirement
            </button>
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Category", "Requirement", "Scope", "Due", "Completed", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center text-xs text-text-tertiary">
                      No compliance requirements yet — add your first one above.
                    </td>
                  </tr>
                ) : filteredItems.map(item => {
                  const s = COMP_STATUS_META[item.status];
                  return (
                    <tr key={item.id} className="hover:bg-surface-secondary/50 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-surface-secondary px-2 py-0.5 rounded font-medium text-text-secondary whitespace-nowrap">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="font-medium text-text-primary leading-snug">{item.requirement}</div>
                        {item.notes && <div className="text-[10px] text-red-400 mt-0.5">{item.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{item.scope}</td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{item.dueDate || "—"}</td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{item.completedDate || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => cycleStatus(item.id)}
                          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                          title="Click to cycle status"
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s.pill}>{s.label}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditItem(item)} className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors" title="Edit">✎</button>
                          <button onClick={() => deleteItem(item.id)} className="text-[11px] text-text-tertiary hover:text-danger transition-colors" title="Delete">×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add / Edit modal */}
          {(showAddItem || editItem) && (
            <Modal title={editItem ? "Edit Requirement" : "Add Compliance Requirement"} onClose={() => { setShowAddItem(false); setEditItem(null); }}>
              <div className="space-y-3">
                <div>
                  <Label>Category</Label>
                  <select value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                    {COMPLIANCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Requirement</Label>
                  <input type="text" value={itemForm.requirement} onChange={e => setItemForm(f => ({ ...f, requirement: e.target.value }))} className={inputCls} placeholder="e.g. WHMIS Training – All Staff" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Scope</Label>
                    <input type="text" value={itemForm.scope} onChange={e => setItemForm(f => ({ ...f, scope: e.target.value }))} className={inputCls} placeholder="e.g. All Staff, Company-Wide" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <select value={itemForm.status} onChange={e => setItemForm(f => ({ ...f, status: e.target.value as ComplianceStatus }))} className={inputCls}>
                      <option value="pending">Pending</option>
                      <option value="compliant">Compliant</option>
                      <option value="non-compliant">Non-Compliant</option>
                      <option value="na">N/A</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Due Date</Label>
                    <input type="text" value={itemForm.dueDate} onChange={e => setItemForm(f => ({ ...f, dueDate: e.target.value }))} className={inputCls} placeholder="e.g. 2026-12-31 or Ongoing" />
                  </div>
                  <div>
                    <Label>Completed Date</Label>
                    <input type="text" value={itemForm.completedDate} onChange={e => setItemForm(f => ({ ...f, completedDate: e.target.value }))} className={inputCls} placeholder="Leave blank if not done" />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <textarea value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + " resize-none"} placeholder="Any issues, exceptions, or action items…" />
                </div>
              </div>
              <ModalFooter
                onCancel={() => { setShowAddItem(false); setEditItem(null); setItemForm(blankItem); }}
                onSave={saveItem}
                disabled={!itemForm.requirement.trim()}
                label={editItem ? "Save Changes" : "Add Requirement"}
              />
            </Modal>
          )}
        </>
      )}

      {/* ── Health & Safety ──────────────────────────────────────────────────── */}
      {activeTab === "health-safety" && (
        <div className="space-y-5">
          {/* Quick action cards */}
          <div>
            <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest mb-3">Submit a Form</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Hazard Assessment",    icon: "⚠", desc: "Site or task hazard ID" },
                { label: "Near Miss Report",     icon: "◎", desc: "Incident without injury" },
                { label: "Injury / Incident Report", icon: "+", desc: "Worker injury or incident" },
                { label: "Daily Safety Inspection", icon: "☑", desc: "Pre-work site check" },
                { label: "Equipment Pre-Op Check", icon: "⚙", desc: "Vehicle / equipment check" },
                { label: "Emergency Drill Record", icon: "◉", desc: "Drill log entry" },
                { label: "WHMIS Checklist",      icon: "◈", desc: "Hazardous materials check" },
                { label: "Return to Work Plan",  icon: "⟳", desc: "Modified duty plan" },
              ].map(a => (
                <button
                  key={a.label}
                  onClick={() => openSubmitForm(a.label)}
                  className="bg-surface border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:bg-surface-secondary/50 transition-all"
                >
                  <div className="text-lg mb-2 opacity-40">{a.icon}</div>
                  <div className="text-xs font-semibold text-text-primary leading-snug">{a.label}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{a.desc}</div>
                  <div className="text-[10px] text-primary mt-2 font-medium">Start →</div>
                </button>
              ))}
            </div>
          </div>

          {/* H&S requirements from register */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Health & Safety Requirements</div>
              <button
                onClick={() => { setItemForm({ ...blankItem, category: "Health & Safety" }); setShowAddItem(true); setActiveTab("register"); }}
                className="text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                + Add Requirement
              </button>
            </div>
            {safetyItems.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-text-tertiary">
                No H&S requirements in the register yet. Add them from the Compliance Register tab.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {safetyItems.map(item => {
                  const s = COMP_STATUS_META[item.status];
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-text-primary">{item.requirement}</div>
                        {item.notes && <div className="text-[10px] text-red-400 mt-0.5">{item.notes}</div>}
                      </div>
                      {item.dueDate && <div className="text-[10px] text-text-tertiary whitespace-nowrap">{item.dueDate}</div>}
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={s.pill}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent H&S forms */}
          {forms.length > 0 && (
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="text-xs font-semibold text-text-primary">Recent H&S Forms</div>
                <button onClick={() => setActiveTab("forms")} className="text-[11px] text-primary hover:text-primary/80 transition-colors">View all →</button>
              </div>
              <div className="divide-y divide-border/50">
                {forms.slice(0, 5).map(f => {
                  const s = FORM_STATUS_META[f.status];
                  return (
                    <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-text-primary">{f.title}</div>
                        <div className="text-[10px] text-text-tertiary">{f.formType} · {f.submittedBy} · {f.date}</div>
                      </div>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={s.pill}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── H&S Forms ────────────────────────────────────────────────────────── */}
      {activeTab === "forms" && (
        <>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Submitted Forms ({forms.length})</div>
              <button onClick={() => openSubmitForm()} className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                + Submit Form
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Title", "Type", "Submitted By", "Date", "Attachment", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {forms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center text-xs text-text-tertiary">
                      No forms submitted yet — use the quick actions in Health & Safety or click Submit Form.
                    </td>
                  </tr>
                ) : forms.map(form => {
                  const s = FORM_STATUS_META[form.status];
                  return (
                    <tr key={form.id} className="hover:bg-surface-secondary/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{form.title}</div>
                        {form.description && <div className="text-[10px] text-text-tertiary mt-0.5 max-w-[200px] truncate">{form.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{form.formType}</td>
                      <td className="px-4 py-3 text-text-secondary">{form.submittedBy}</td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{form.date}</td>
                      <td className="px-4 py-3">
                        {form.objectUrl ? (
                          <a href={form.objectUrl} download={form.fileName} className="text-[11px] text-primary hover:text-primary/80 transition-colors">
                            ↓ {form.fileName?.split(".").pop()?.toUpperCase()} · {fmtSize(form.fileSize ?? 0)}
                          </a>
                        ) : (
                          <span className="text-[11px] text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s.pill}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {form.status !== "reviewed" && (
                            <button onClick={() => updateFormStatus(form.id, "reviewed")} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap">✓ Review</button>
                          )}
                          {form.status !== "action-required" && (
                            <button onClick={() => updateFormStatus(form.id, "action-required")} className="text-[10px] text-red-400 hover:text-red-300 font-medium whitespace-nowrap">! Action</button>
                          )}
                          <button onClick={() => deleteForm(form.id)} className="text-[11px] text-text-tertiary hover:text-danger transition-colors">×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Submit form modal */}
          {showSubmitForm && (
            <Modal title="Submit H&S Form" onClose={() => { setShowSubmitForm(false); setFormFile(null); }}>
              <div className="space-y-3">
                <div>
                  <Label>Form Type</Label>
                  <select value={hsForm.formType} onChange={e => setHsForm(f => ({ ...f, formType: e.target.value, title: f.title || e.target.value }))} className={inputCls}>
                    <option value="">Select form type…</option>
                    {HS_FORM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Title</Label>
                  <input type="text" value={hsForm.title} onChange={e => setHsForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="e.g. Site Hazard Assessment – Block 7A" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Submitted By</Label>
                    {activeEmployees.length > 0 ? (
                      <select value={hsForm.submittedBy} onChange={e => setHsForm(f => ({ ...f, submittedBy: e.target.value }))} className={inputCls}>
                        <option value="">Select employee…</option>
                        {activeEmployees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={hsForm.submittedBy} onChange={e => setHsForm(f => ({ ...f, submittedBy: e.target.value }))} className={inputCls} placeholder="Name" />
                    )}
                  </div>
                  <div>
                    <Label>Date</Label>
                    <input type="date" value={hsForm.date} onChange={e => setHsForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <Label>Description / Notes</Label>
                  <textarea value={hsForm.description} onChange={e => setHsForm(f => ({ ...f, description: e.target.value }))} rows={3} className={inputCls + " resize-none"} placeholder="Describe what happened, findings, or actions taken…" />
                </div>
                {/* File attachment */}
                <div>
                  <Label>Attachment (optional)</Label>
                  <div
                    className={`rounded-xl border-2 border-dashed transition-colors p-5 text-center cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-border-strong"}`}
                        style={formFile ? { borderColor: "rgba(57,222,139,0.4)", background: "rgba(57,222,139,0.04)" } : {}}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFormFile(file); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFormFile(f); }} />
                    {formFile ? (
                      <div className="text-xs">
                        <span className="font-semibold" style={{ color: "var(--color-primary)" }}>✓ {formFile.name}</span>
                        <span className="text-text-tertiary ml-2">{fmtSize(formFile.size)}</span>
                        <div className="text-[10px] text-text-tertiary mt-1">Click to replace</div>
                      </div>
                    ) : (
                      <div className="text-xs text-text-tertiary">Drop a file or click to browse · PDF, DOCX, or image</div>
                    )}
                  </div>
                </div>
              </div>
              <ModalFooter
                onCancel={() => { setShowSubmitForm(false); setFormFile(null); setHsForm(blankForm); }}
                onSave={submitHSForm}
                disabled={!hsForm.formType || !hsForm.submittedBy}
                label="Submit Form"
              />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
