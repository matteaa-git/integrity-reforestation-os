"use client";

import { useState, useEffect } from "react";
import type { Employee } from "@/app/admin/page";
import { getAllRecords, saveRecord, deleteRecord } from "@/lib/adminDb";

type TrainingTab = "certifications" | "cvor" | "driver-logs";

const TODAY = new Date().toISOString().split("T")[0];

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Certification {
  id: string;
  employeeId: string;
  employee: string;
  course: string;
  category: string;
  completedDate: string;
  expiryDate: string | null;
  status: "valid" | "expiring" | "expired";
}

interface CvorRecord {
  id: string;
  employeeId: string;
  employee: string;
  licenceClass: string;
  licenceNumber: string;
  expiryDate: string;
  abstractDate: string;
  status: "valid" | "expiring" | "expired";
  violations: number;
}

interface DriverLog {
  id: string;
  employeeId: string;
  employee: string;
  period: string;       // "YYYY-MM"
  hoursOnDuty: number;
  kmDriven: number;
  submittedDate: string | null;
  status: "submitted" | "pending" | "overdue";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CERT_CATEGORIES    = ["Safety", "H&S", "CVOR", "TDG", "Equipment", "First Aid", "Other"];
const LICENCE_CLASSES    = ["G", "G2", "G1", "DZ", "AZ", "F", "M", "M2", "Other"];

const TABS: { id: TrainingTab; label: string; icon: string }[] = [
  { id: "certifications", label: "Certifications", icon: "⚑" },
  { id: "cvor",           label: "CVOR Program",   icon: "◎" },
  { id: "driver-logs",    label: "Driver Logs",    icon: "▦" },
];

const STATUS_BADGE: Record<"valid" | "expiring" | "expired", { label: string; pill: React.CSSProperties }> = {
  valid:    { label: "Valid",    pill: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  expiring: { label: "Expiring", pill: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  expired:  { label: "Expired",  pill: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  } },
};

const LOG_BADGE: Record<DriverLog["status"], { label: string; pill: React.CSSProperties }> = {
  submitted: { label: "Submitted", pill: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  pending:   { label: "Pending",   pill: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  overdue:   { label: "Overdue",   pill: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcCertStatus(expiryDate: string | null): "valid" | "expiring" | "expired" {
  if (!expiryDate) return "valid";
  if (expiryDate < TODAY) return "expired";
  const days = (new Date(expiryDate).getTime() - new Date(TODAY).getTime()) / 86_400_000;
  return days <= 60 ? "expiring" : "valid";
}

function calcLogStatus(period: string, submittedDate: string | null): DriverLog["status"] {
  if (submittedDate) return "submitted";
  return period < TODAY.slice(0, 7) ? "overdue" : "pending";
}

function fmtPeriod(ym: string) {
  const [y, m] = ym.split("-");
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]} ${y}`;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">{children}</label>;
}
const inputCls = "w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-14 text-center text-text-tertiary text-xs">{label}</td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { employees: Employee[] }

export default function TrainingSafetyCenter({ employees }: Props) {
  const [activeTab, setActiveTab] = useState<TrainingTab>("certifications");
  const [empFilter, setEmpFilter] = useState("all");

  // Certifications
  const [certs, setCerts] = useState<Certification[]>([]);
  const [showAddCert, setShowAddCert] = useState(false);
  const [certForm, setCertForm] = useState({
    employeeId: "", course: "", category: "Safety",
    completedDate: "", hasExpiry: true, expiryDate: "",
  });

  // CVOR
  const [cvorRecords, setCvorRecords] = useState<CvorRecord[]>([]);
  const [showAddCvor, setShowAddCvor] = useState(false);
  const [cvorForm, setCvorForm] = useState({
    employeeId: "", licenceClass: "G", licenceNumber: "",
    expiryDate: "", abstractDate: "", violations: "0",
  });

  // Driver Logs
  const [logs, setLogs] = useState<DriverLog[]>([]);
  const [showAddLog, setShowAddLog] = useState(false);
  const [logForm, setLogForm] = useState({
    employeeId: "", period: "", hoursOnDuty: "", kmDriven: "", submittedDate: "",
  });

  // ── Load from IndexedDB on mount ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [savedCerts, savedCvor, savedLogs] = await Promise.all([
        getAllRecords<Certification>("training_certs"),
        getAllRecords<CvorRecord>("training_cvor"),
        getAllRecords<DriverLog>("training_logs"),
      ]);
      setCerts(savedCerts.sort((a, b) => b.completedDate.localeCompare(a.completedDate)));
      setCvorRecords(savedCvor.sort((a, b) => a.employee.localeCompare(b.employee)));
      setLogs(savedLogs.sort((a, b) => b.period.localeCompare(a.period)));
    }
    load();
  }, []);

  // Derived
  const activeEmployees = employees.filter(e => e.status === "active");

  const filteredCerts = certs.filter(c => empFilter === "all" || c.employeeId === empFilter);
  const filteredCvor  = cvorRecords.filter(v => empFilter === "all" || v.employeeId === empFilter);
  const filteredLogs  = logs.filter(l => empFilter === "all" || l.employeeId === empFilter);

  const expiredCount   = certs.filter(c => c.status === "expired").length;
  const expiringCount  = certs.filter(c => c.status === "expiring").length;
  const overdueCount   = logs.filter(l => l.status === "overdue").length;
  const expiredCvor    = cvorRecords.filter(v => v.status === "expired").length;

  // ── Cert handlers ────────────────────────────────────────────────────────

  function saveCert() {
    if (!certForm.employeeId || !certForm.course || !certForm.completedDate) return;
    const emp = employees.find(e => e.id === certForm.employeeId)!;
    const expiry = certForm.hasExpiry && certForm.expiryDate ? certForm.expiryDate : null;
    const cert: Certification = {
      id: `c-${Date.now()}`,
      employeeId: emp.id,
      employee: emp.name,
      course: certForm.course,
      category: certForm.category,
      completedDate: certForm.completedDate,
      expiryDate: expiry,
      status: calcCertStatus(expiry),
    };
    setCerts(prev => [cert, ...prev]);
    saveRecord("training_certs", cert);
    setShowAddCert(false);
    setCertForm({ employeeId: "", course: "", category: "Safety", completedDate: "", hasExpiry: true, expiryDate: "" });
  }

  function deleteCert(id: string) {
    setCerts(prev => prev.filter(c => c.id !== id));
    deleteRecord("training_certs", id);
  }

  // ── CVOR handlers ────────────────────────────────────────────────────────

  function saveCvor() {
    if (!cvorForm.employeeId || !cvorForm.licenceNumber || !cvorForm.expiryDate || !cvorForm.abstractDate) return;
    const emp = employees.find(e => e.id === cvorForm.employeeId)!;
    const record: CvorRecord = {
      id: `v-${Date.now()}`,
      employeeId: emp.id,
      employee: emp.name,
      licenceClass: cvorForm.licenceClass,
      licenceNumber: cvorForm.licenceNumber,
      expiryDate: cvorForm.expiryDate,
      abstractDate: cvorForm.abstractDate,
      violations: parseInt(cvorForm.violations) || 0,
      status: calcCertStatus(cvorForm.expiryDate),
    };
    setCvorRecords(prev => [record, ...prev]);
    saveRecord("training_cvor", record);
    setShowAddCvor(false);
    setCvorForm({ employeeId: "", licenceClass: "G", licenceNumber: "", expiryDate: "", abstractDate: "", violations: "0" });
  }

  function deleteCvor(id: string) {
    setCvorRecords(prev => prev.filter(v => v.id !== id));
    deleteRecord("training_cvor", id);
  }

  // ── Log handlers ─────────────────────────────────────────────────────────

  function saveLog() {
    if (!logForm.employeeId || !logForm.period) return;
    const emp = employees.find(e => e.id === logForm.employeeId)!;
    const submitted = logForm.submittedDate || null;
    const log: DriverLog = {
      id: `l-${Date.now()}`,
      employeeId: emp.id,
      employee: emp.name,
      period: logForm.period,
      hoursOnDuty: parseFloat(logForm.hoursOnDuty) || 0,
      kmDriven: parseFloat(logForm.kmDriven) || 0,
      submittedDate: submitted,
      status: calcLogStatus(logForm.period, submitted),
    };
    setLogs(prev => [log, ...prev]);
    saveRecord("training_logs", log);
    setShowAddLog(false);
    setLogForm({ employeeId: "", period: "", hoursOnDuty: "", kmDriven: "", submittedDate: "" });
  }

  function deleteLog(id: string) {
    setLogs(prev => prev.filter(l => l.id !== id));
    deleteRecord("training_logs", id);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Certifications", value: certs.filter(c => c.status === "valid").length,  color: "text-emerald-400" },
          { label: "Certs Expiring Soon",   value: expiringCount, color: expiringCount > 0 ? "text-amber-400"   : "" },
          { label: "Certs Expired",         value: expiredCount,  color: expiredCount  > 0 ? "text-red-400"     : "" },
          { label: "Driver Logs Overdue",   value: overdueCount,  color: overdueCount  > 0 ? "text-red-400"     : "" },
        ].map(k => (
          <div key={k.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{k.label}</div>
            <div className={`text-2xl font-bold mt-1 ${k.color || "text-text-primary"}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar + employee filter */}
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
        <div className="flex-1" />
        <div className="mb-0.5">
          <select
            value={empFilter}
            onChange={e => setEmpFilter(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none focus:border-primary/50"
          >
            <option value="all">All employees</option>
            {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Certifications ──────────────────────────────────────────────────── */}
      {activeTab === "certifications" && (
        <>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Training Records ({filteredCerts.length})</div>
              <button
                onClick={() => setShowAddCert(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                + Add Record
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Employee", "Course / Certification", "Category", "Completed", "Expires", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredCerts.length === 0
                  ? <EmptyRow cols={7} label="No certification records yet — add the first one above." />
                  : filteredCerts.map(c => {
                    const b = STATUS_BADGE[c.status];
                    return (
                      <tr key={c.id} className="hover:bg-surface-secondary/50 transition-colors group">
                        <td className="px-4 py-3 font-medium text-text-primary">{c.employee}</td>
                        <td className="px-4 py-3 text-text-primary">{c.course}</td>
                        <td className="px-4 py-3 text-text-secondary">{c.category}</td>
                        <td className="px-4 py-3 text-text-secondary">{c.completedDate}</td>
                        <td className={`px-4 py-3 ${c.status !== "valid" ? "text-red-400 font-medium" : "text-text-secondary"}`}>
                          {c.expiryDate ?? "No expiry"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={b.pill}>{b.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteCert(c.id)} className="text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-all" title="Delete">×</button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>

          {/* Add cert modal */}
          {showAddCert && (
            <Modal title="Add Certification Record" onClose={() => setShowAddCert(false)}>
              <div className="space-y-3">
                <div>
                  <Label>Employee</Label>
                  <select value={certForm.employeeId} onChange={e => setCertForm(f => ({ ...f, employeeId: e.target.value }))} className={inputCls}>
                    <option value="">Select employee…</option>
                    {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Course / Certification</Label>
                  <input type="text" value={certForm.course} onChange={e => setCertForm(f => ({ ...f, course: e.target.value }))} className={inputCls} placeholder="e.g. First Aid & CPR Level C" />
                </div>
                <div>
                  <Label>Category</Label>
                  <select value={certForm.category} onChange={e => setCertForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                    {CERT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Completed Date</Label>
                  <input type="date" value={certForm.completedDate} onChange={e => setCertForm(f => ({ ...f, completedDate: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="hasExpiry" checked={certForm.hasExpiry} onChange={e => setCertForm(f => ({ ...f, hasExpiry: e.target.checked }))} className="rounded" />
                  <label htmlFor="hasExpiry" className="text-xs text-text-secondary">Has expiry date</label>
                </div>
                {certForm.hasExpiry && (
                  <div>
                    <Label>Expiry Date</Label>
                    <input type="date" value={certForm.expiryDate} onChange={e => setCertForm(f => ({ ...f, expiryDate: e.target.value }))} className={inputCls} />
                  </div>
                )}
              </div>
              <ModalFooter
                onCancel={() => setShowAddCert(false)}
                onSave={saveCert}
                disabled={!certForm.employeeId || !certForm.course || !certForm.completedDate}
                label="Save Record"
              />
            </Modal>
          )}
        </>
      )}

      {/* ── CVOR Program ─────────────────────────────────────────────────────── */}
      {activeTab === "cvor" && (
        <>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <div className="text-xs font-semibold text-text-primary">CVOR Driver Records</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">Commercial Vehicle Operator Registration</div>
              </div>
              <div className="flex items-center gap-3">
                {expiredCvor > 0 && (
                  <span className="text-[11px] text-red-400 font-medium">{expiredCvor} expired licence{expiredCvor !== 1 ? "s" : ""}</span>
                )}
                <button onClick={() => setShowAddCvor(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                  + Add Driver
                </button>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Driver", "Licence Class", "Licence No.", "Expires", "Abstract Date", "Violations", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredCvor.length === 0
                  ? <EmptyRow cols={8} label="No CVOR records yet — add the first driver above." />
                  : filteredCvor.map(v => {
                    const b = STATUS_BADGE[v.status];
                    return (
                      <tr key={v.id} className="hover:bg-surface-secondary/50 transition-colors group">
                        <td className="px-4 py-3 font-medium text-text-primary">{v.employee}</td>
                        <td className="px-4 py-3 text-text-secondary">{v.licenceClass}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-text-secondary">{v.licenceNumber}</td>
                        <td className={`px-4 py-3 font-medium ${v.status !== "valid" ? "text-red-400" : "text-text-secondary"}`}>{v.expiryDate}</td>
                        <td className="px-4 py-3 text-text-secondary">{v.abstractDate}</td>
                        <td className={`px-4 py-3 font-medium ${v.violations > 0 ? "text-red-400" : "text-emerald-400"}`}>{v.violations}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={b.pill}>{b.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteCvor(v.id)} className="text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-all" title="Delete">×</button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>

          {showAddCvor && (
            <Modal title="Add CVOR Driver Record" onClose={() => setShowAddCvor(false)}>
              <div className="space-y-3">
                <div>
                  <Label>Driver</Label>
                  <select value={cvorForm.employeeId} onChange={e => setCvorForm(f => ({ ...f, employeeId: e.target.value }))} className={inputCls}>
                    <option value="">Select employee…</option>
                    {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Licence Class</Label>
                    <select value={cvorForm.licenceClass} onChange={e => setCvorForm(f => ({ ...f, licenceClass: e.target.value }))} className={inputCls}>
                      {LICENCE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Violations</Label>
                    <input type="number" min="0" value={cvorForm.violations} onChange={e => setCvorForm(f => ({ ...f, violations: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <Label>Licence Number</Label>
                  <input type="text" value={cvorForm.licenceNumber} onChange={e => setCvorForm(f => ({ ...f, licenceNumber: e.target.value }))} className={inputCls} placeholder="e.g. A1234-56789-00001" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Licence Expiry</Label>
                    <input type="date" value={cvorForm.expiryDate} onChange={e => setCvorForm(f => ({ ...f, expiryDate: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <Label>Abstract Date</Label>
                    <input type="date" value={cvorForm.abstractDate} onChange={e => setCvorForm(f => ({ ...f, abstractDate: e.target.value }))} className={inputCls} />
                  </div>
                </div>
              </div>
              <ModalFooter onCancel={() => setShowAddCvor(false)} onSave={saveCvor} disabled={!cvorForm.employeeId || !cvorForm.licenceNumber || !cvorForm.expiryDate || !cvorForm.abstractDate} label="Save Record" />
            </Modal>
          )}
        </>
      )}

      {/* ── Driver Logs ──────────────────────────────────────────────────────── */}
      {activeTab === "driver-logs" && (
        <>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Driver Activity Logs ({filteredLogs.length})</div>
              <button onClick={() => setShowAddLog(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                + New Log
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Driver", "Period", "Hours on Duty", "KM Driven", "Submitted", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredLogs.length === 0
                  ? <EmptyRow cols={7} label="No driver logs yet — add the first entry above." />
                  : filteredLogs.map(l => {
                    const b = LOG_BADGE[l.status];
                    return (
                      <tr key={l.id} className="hover:bg-surface-secondary/50 transition-colors group">
                        <td className="px-4 py-3 font-medium text-text-primary">{l.employee}</td>
                        <td className="px-4 py-3 text-text-secondary">{fmtPeriod(l.period)}</td>
                        <td className="px-4 py-3 font-medium text-text-primary">{l.hoursOnDuty > 0 ? `${l.hoursOnDuty}h` : "—"}</td>
                        <td className="px-4 py-3 font-medium text-text-primary">{l.kmDriven > 0 ? `${l.kmDriven.toLocaleString()} km` : "—"}</td>
                        <td className="px-4 py-3 text-text-secondary">{l.submittedDate ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={b.pill}>{b.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteLog(l.id)} className="text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-all" title="Delete">×</button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>

          {showAddLog && (
            <Modal title="Add Driver Log" onClose={() => setShowAddLog(false)}>
              <div className="space-y-3">
                <div>
                  <Label>Driver</Label>
                  <select value={logForm.employeeId} onChange={e => setLogForm(f => ({ ...f, employeeId: e.target.value }))} className={inputCls}>
                    <option value="">Select employee…</option>
                    {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Period (month)</Label>
                  <input type="month" value={logForm.period} onChange={e => setLogForm(f => ({ ...f, period: e.target.value }))} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Hours on Duty</Label>
                    <input type="number" min="0" step="0.5" value={logForm.hoursOnDuty} onChange={e => setLogForm(f => ({ ...f, hoursOnDuty: e.target.value }))} className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <Label>KM Driven</Label>
                    <input type="number" min="0" value={logForm.kmDriven} onChange={e => setLogForm(f => ({ ...f, kmDriven: e.target.value }))} className={inputCls} placeholder="0" />
                  </div>
                </div>
                <div>
                  <Label>Submitted Date (leave blank if pending)</Label>
                  <input type="date" value={logForm.submittedDate} onChange={e => setLogForm(f => ({ ...f, submittedDate: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <ModalFooter onCancel={() => setShowAddLog(false)} onSave={saveLog} disabled={!logForm.employeeId || !logForm.period} label="Save Log" />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared modal shell ────────────────────────────────────────────────────────

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
