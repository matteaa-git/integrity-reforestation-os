"use client";

import { useState, useEffect, useCallback } from "react";
import type { Employee } from "@/app/admin/page";
import { getAllRecords, saveRecord, deleteRecord, seedPayrollData } from "@/lib/adminDb";
import T2200Form from "./T2200Form";

type PayrollTab = "stubs" | "tax-forms" | "run-history";

interface PayrollStub {
  id: string;
  employeeId: string;
  employee: string;
  period: string;
  periodEnd: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: "paid" | "processing" | "pending";
}

interface TaxForm {
  id: string;
  type: string;
  employeeId: string;
  employee: string;
  taxYear: number;
  issueDate: string;
  grossIncome: number;
  taxDeducted: number;
  status: "issued" | "pending" | "amended";
}

interface PayrollRun {
  id: string;
  period: string;
  periodEnd: string;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  processedBy: string;
  processedDate: string;
  status: "completed" | "processing" | "draft";
}

interface Props {
  employees: Employee[];
}

const TABS: { id: PayrollTab; label: string; icon: string }[] = [
  { id: "stubs",       label: "Pay Stubs",    icon: "▦" },
  { id: "tax-forms",   label: "Tax Forms",    icon: "◫" },
  { id: "run-history", label: "Payroll Runs", icon: "◎" },
];

const STUB_STATUS: Record<PayrollStub["status"], { label: string; style: React.CSSProperties }> = {
  paid:       { label: "Paid",       style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  processing: { label: "Processing", style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  pending:    { label: "Pending",    style: { background: "rgba(0,0,0,0.04)",      color: "var(--color-text-tertiary)" } },
};

const RUN_STATUS: Record<PayrollRun["status"], { label: string; style: React.CSSProperties }> = {
  completed:  { label: "Completed",  style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  processing: { label: "Processing", style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  draft:      { label: "Draft",      style: { background: "rgba(0,0,0,0.04)",      color: "var(--color-text-tertiary)" } },
};

const TAX_STATUS: Record<TaxForm["status"], { label: string; style: React.CSSProperties }> = {
  issued:   { label: "Issued",   style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  pending:  { label: "Pending",  style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  amended:  { label: "Amended",  style: { background: "rgba(59,130,246,0.12)", color: "var(--color-info)"    } },
};

function fmt(n: number) {
  return n === 0 ? "—" : `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2 })}`;
}

const INPUT  = "w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";
const LABEL  = "block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-1";

const EMPTY_STUB = { employeeId: "", employee: "", period: "", periodEnd: "", grossPay: "", deductions: "", netPay: "", status: "pending" as PayrollStub["status"] };
const EMPTY_TAX  = { type: "T4", employeeId: "", employee: "", taxYear: new Date().getFullYear() - 1, issueDate: "", grossIncome: "", taxDeducted: "", status: "pending" as TaxForm["status"] };
const EMPTY_RUN  = { period: "", periodEnd: "", employeeCount: "", totalGross: "", totalNet: "", processedBy: "", processedDate: "", status: "draft" as PayrollRun["status"] };

export default function PayrollTaxCenter({ employees }: Props) {
  const [activeTab, setActiveTab] = useState<PayrollTab>("stubs");
  const [stubs, setStubs]         = useState<PayrollStub[]>([]);
  const [taxForms, setTaxForms]   = useState<TaxForm[]>([]);
  const [runs, setRuns]           = useState<PayrollRun[]>([]);
  const [empFilter, setEmpFilter]       = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  const [showAddStub,  setShowAddStub]  = useState(false);
  const [showAddTax,   setShowAddTax]   = useState(false);
  const [showAddRun,   setShowAddRun]   = useState(false);
  const [showT2200,    setShowT2200]    = useState(false);
  const [stubForm, setStubForm] = useState({ ...EMPTY_STUB });
  const [taxForm,  setTaxForm]  = useState({ ...EMPTY_TAX });
  const [runForm,  setRunForm]  = useState({ ...EMPTY_RUN });

  useEffect(() => {
    seedPayrollData().then(() => {
      getAllRecords<PayrollStub>("payroll_stubs").then(r =>
        setStubs(r.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))));
      getAllRecords<TaxForm>("payroll_tax").then(r =>
        setTaxForms(r.sort((a, b) => b.taxYear - a.taxYear || b.issueDate.localeCompare(a.issueDate))));
      getAllRecords<PayrollRun>("payroll_runs").then(r =>
        setRuns(r.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))));
    });
  }, []);

  const periods  = Array.from(new Set(stubs.map(s => s.period)));
  const filteredStubs = stubs.filter(s => {
    if (empFilter !== "all" && s.employee !== empFilter) return false;
    if (periodFilter !== "all" && s.period !== periodFilter) return false;
    return true;
  });
  const filteredTax = taxForms.filter(t => empFilter === "all" || t.employee === empFilter);

  const lastRun = runs.find(r => r.status === "completed");
  const latestPeriod = stubs[0]?.period;
  const latestGross  = latestPeriod ? stubs.filter(s => s.period === latestPeriod).reduce((sum, s) => sum + s.grossPay, 0) : 0;
  const latestNet    = latestPeriod ? stubs.filter(s => s.period === latestPeriod).reduce((sum, s) => sum + s.netPay, 0) : 0;

  // ── Save helpers ──────────────────────────────────────────────────────────

  const saveStub = useCallback(() => {
    if (!stubForm.employee || !stubForm.period || !stubForm.periodEnd) return;
    const rec: PayrollStub = {
      id: `ps-${Date.now()}`,
      employeeId: stubForm.employeeId,
      employee: stubForm.employee,
      period: stubForm.period,
      periodEnd: stubForm.periodEnd,
      grossPay: parseFloat(stubForm.grossPay) || 0,
      deductions: parseFloat(stubForm.deductions) || 0,
      netPay: parseFloat(stubForm.netPay) || 0,
      status: stubForm.status,
    };
    setStubs(prev => [rec, ...prev]);
    saveRecord("payroll_stubs", rec);
    setShowAddStub(false);
    setStubForm({ ...EMPTY_STUB });
  }, [stubForm]);

  const saveTax = useCallback(() => {
    if (!taxForm.employee || !taxForm.issueDate) return;
    const rec: TaxForm = {
      id: `t4-${Date.now()}`,
      type: taxForm.type,
      employeeId: taxForm.employeeId,
      employee: taxForm.employee,
      taxYear: taxForm.taxYear,
      issueDate: taxForm.issueDate,
      grossIncome: parseFloat(taxForm.grossIncome) || 0,
      taxDeducted: parseFloat(taxForm.taxDeducted) || 0,
      status: taxForm.status,
    };
    setTaxForms(prev => [rec, ...prev]);
    saveRecord("payroll_tax", rec);
    setShowAddTax(false);
    setTaxForm({ ...EMPTY_TAX });
  }, [taxForm]);

  const saveRun = useCallback(() => {
    if (!runForm.period || !runForm.periodEnd) return;
    const rec: PayrollRun = {
      id: `run-${Date.now()}`,
      period: runForm.period,
      periodEnd: runForm.periodEnd,
      employeeCount: parseInt(runForm.employeeCount) || 0,
      totalGross: parseFloat(runForm.totalGross) || 0,
      totalNet: parseFloat(runForm.totalNet) || 0,
      processedBy: runForm.processedBy,
      processedDate: runForm.processedDate,
      status: runForm.status,
    };
    setRuns(prev => [rec, ...prev]);
    saveRecord("payroll_runs", rec);
    setShowAddRun(false);
    setRunForm({ ...EMPTY_RUN });
  }, [runForm]);

  const deleteStub    = useCallback((id: string) => { setStubs(p => p.filter(s => s.id !== id));    deleteRecord("payroll_stubs", id); }, []);
  const deleteTaxForm = useCallback((id: string) => { setTaxForms(p => p.filter(t => t.id !== id)); deleteRecord("payroll_tax", id); }, []);
  const deleteRun     = useCallback((id: string) => { setRuns(p => p.filter(r => r.id !== id));     deleteRecord("payroll_runs", id); }, []);

  function pickStubEmp(name: string) {
    const emp = employees.find(e => e.name === name);
    setStubForm(f => ({ ...f, employee: name, employeeId: emp?.id ?? "" }));
  }
  function pickTaxEmp(name: string) {
    const emp = employees.find(e => e.name === name);
    setTaxForm(f => ({ ...f, employee: name, employeeId: emp?.id ?? "" }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Last Payroll Period",               value: lastRun?.period ?? "—" },
          { label: `Gross (${latestPeriod ?? "—"})`,    value: fmt(latestGross) },
          { label: `Net (${latestPeriod ?? "—"})`,      value: fmt(latestNet) },
          { label: "T4 Slips Issued",                   value: taxForms.filter(t => t.status === "issued").length },
        ].map(k => (
          <div key={k.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">{k.label}</div>
            <div className="text-xl font-bold mt-1 text-text-primary tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div className="flex items-center gap-0.5 border-b border-border mb-5">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            }`}>
            <span className="opacity-60">{tab.icon}</span>{tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex gap-2 pb-1">
          <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none">
            <option value="all">All employees</option>
            {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
          {activeTab === "stubs" && (
            <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none">
              <option value="all">All periods</option>
              {periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Pay Stubs ─────────────────────────────────────────────────────── */}
      {activeTab === "stubs" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="text-xs font-semibold text-text-primary">Pay Stubs ({filteredStubs.length})</div>
            <button onClick={() => setShowAddStub(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
              + Add Stub
            </button>
          </div>
          {filteredStubs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-3xl opacity-20 mb-2">▦</div>
              <div className="text-sm font-medium text-text-secondary">No pay stubs yet</div>
              <div className="text-xs text-text-tertiary mt-1">Click "Add Stub" to record a pay stub</div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Employee","Pay Period","Period End","Gross Pay","Deductions","Net Pay","Status",""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStubs.map(stub => {
                  const s = STUB_STATUS[stub.status];
                  return (
                    <tr key={stub.id} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{stub.employee}</td>
                      <td className="px-4 py-3 text-text-secondary">{stub.period}</td>
                      <td className="px-4 py-3 text-text-secondary">{stub.periodEnd}</td>
                      <td className="px-4 py-3 font-mono text-text-primary">{fmt(stub.grossPay)}</td>
                      <td className="px-4 py-3 font-mono text-rose-400">{stub.deductions > 0 ? `-${fmt(stub.deductions)}` : "—"}</td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: "var(--color-primary)" }}>{fmt(stub.netPay)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s.style}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteStub(stub.id)} className="text-[11px] text-text-tertiary hover:text-rose-400 transition-colors" title="Delete">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tax Forms ─────────────────────────────────────────────────────── */}
      {activeTab === "tax-forms" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-xs text-text-tertiary">{filteredTax.length} forms</div>
            <div className="flex-1" />
            <button onClick={() => setShowT2200(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all border border-red-600 text-red-600 bg-red-50">
              + Fill T2200
            </button>
            <button onClick={() => setShowAddTax(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
              + Add Tax Form
            </button>
          </div>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {filteredTax.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-3xl opacity-20 mb-2">◫</div>
                <div className="text-sm font-medium text-text-secondary">No tax forms yet</div>
                <div className="text-xs text-text-tertiary mt-1">Click "Add Tax Form" to issue a T4 or other slip</div>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary">
                    {["Type","Employee","Tax Year","Issue Date","Gross Income","Tax Deducted","Status",""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTax.map(form => {
                    const s = TAX_STATUS[form.status];
                    return (
                      <tr key={form.id} className="hover:bg-surface-secondary/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-text-primary bg-surface-secondary px-2 py-0.5 rounded text-[11px]">{form.type}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">{form.employee}</td>
                        <td className="px-4 py-3 text-text-secondary">{form.taxYear}</td>
                        <td className="px-4 py-3 text-text-secondary">{form.issueDate}</td>
                        <td className="px-4 py-3 font-mono text-text-primary">{fmt(form.grossIncome)}</td>
                        <td className="px-4 py-3 font-mono text-rose-400">{fmt(form.taxDeducted)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s.style}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteTaxForm(form.id)} className="text-[11px] text-text-tertiary hover:text-rose-400 transition-colors" title="Delete">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Payroll Run History ───────────────────────────────────────────── */}
      {activeTab === "run-history" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="text-xs font-semibold text-text-primary">Payroll Run History</div>
            <button onClick={() => setShowAddRun(true)}
              className="text-xs font-semibold px-3 py-1 rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
              + New Payroll Run
            </button>
          </div>
          {runs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-3xl opacity-20 mb-2">◎</div>
              <div className="text-sm font-medium text-text-secondary">No payroll runs yet</div>
              <div className="text-xs text-text-tertiary mt-1">Click "New Payroll Run" to record a run</div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Period","Period End","Employees","Total Gross","Total Net","Processed By","Date","Status",""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map(run => {
                  const s = RUN_STATUS[run.status];
                  return (
                    <tr key={run.id} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-primary">{run.period}</td>
                      <td className="px-4 py-3 text-text-secondary">{run.periodEnd}</td>
                      <td className="px-4 py-3 text-text-secondary">{run.employeeCount > 0 ? run.employeeCount : "—"}</td>
                      <td className="px-4 py-3 font-mono text-text-primary">{fmt(run.totalGross)}</td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: "var(--color-primary)" }}>{fmt(run.totalNet)}</td>
                      <td className="px-4 py-3 text-text-secondary">{run.processedBy || "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{run.processedDate || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={s.style}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteRun(run.id)} className="text-[11px] text-text-tertiary hover:text-rose-400 transition-colors" title="Delete">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Add Pay Stub Modal ─────────────────────────────────────────────── */}
      {showAddStub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Add Pay Stub</div>
              <button onClick={() => { setShowAddStub(false); setStubForm({ ...EMPTY_STUB }); }}
                className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={LABEL}>Employee</label>
                <select value={stubForm.employee} onChange={e => pickStubEmp(e.target.value)} className={INPUT}>
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Pay Period</label>
                  <input type="text" placeholder="e.g. May 2026" value={stubForm.period}
                    onChange={e => setStubForm(f => ({ ...f, period: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Period End Date</label>
                  <input type="date" value={stubForm.periodEnd}
                    onChange={e => setStubForm(f => ({ ...f, periodEnd: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Gross Pay ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={stubForm.grossPay}
                    onChange={e => setStubForm(f => ({ ...f, grossPay: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Deductions ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={stubForm.deductions}
                    onChange={e => setStubForm(f => ({ ...f, deductions: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Net Pay ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={stubForm.netPay}
                    onChange={e => setStubForm(f => ({ ...f, netPay: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select value={stubForm.status}
                  onChange={e => setStubForm(f => ({ ...f, status: e.target.value as PayrollStub["status"] }))} className={INPUT}>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowAddStub(false); setStubForm({ ...EMPTY_STUB }); }}
                className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary">Cancel</button>
              <button onClick={saveStub} disabled={!stubForm.employee || !stubForm.period || !stubForm.periodEnd}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Tax Form Modal ────────────────────────────────────────────── */}
      {showAddTax && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Add Tax Form</div>
              <button onClick={() => { setShowAddTax(false); setTaxForm({ ...EMPTY_TAX }); }}
                className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Form Type</label>
                  <select value={taxForm.type} onChange={e => setTaxForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                    <option>T4</option>
                    <option>T4A</option>
                    <option>T4E</option>
                    <option>RL-1</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Tax Year</label>
                  <input type="number" min="2020" max="2099" value={taxForm.taxYear}
                    onChange={e => setTaxForm(f => ({ ...f, taxYear: parseInt(e.target.value) || f.taxYear }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Employee</label>
                <select value={taxForm.employee} onChange={e => pickTaxEmp(e.target.value)} className={INPUT}>
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Issue Date</label>
                <input type="date" value={taxForm.issueDate}
                  onChange={e => setTaxForm(f => ({ ...f, issueDate: e.target.value }))} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Gross Income ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={taxForm.grossIncome}
                    onChange={e => setTaxForm(f => ({ ...f, grossIncome: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Tax Deducted ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={taxForm.taxDeducted}
                    onChange={e => setTaxForm(f => ({ ...f, taxDeducted: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select value={taxForm.status}
                  onChange={e => setTaxForm(f => ({ ...f, status: e.target.value as TaxForm["status"] }))} className={INPUT}>
                  <option value="pending">Pending</option>
                  <option value="issued">Issued</option>
                  <option value="amended">Amended</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowAddTax(false); setTaxForm({ ...EMPTY_TAX }); }}
                className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary">Cancel</button>
              <button onClick={saveTax} disabled={!taxForm.employee || !taxForm.issueDate}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Payroll Run Modal ─────────────────────────────────────────── */}
      {showAddRun && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">New Payroll Run</div>
              <button onClick={() => { setShowAddRun(false); setRunForm({ ...EMPTY_RUN }); }}
                className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Pay Period</label>
                  <input type="text" placeholder="e.g. May 2026" value={runForm.period}
                    onChange={e => setRunForm(f => ({ ...f, period: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Period End Date</label>
                  <input type="date" value={runForm.periodEnd}
                    onChange={e => setRunForm(f => ({ ...f, periodEnd: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Employee Count</label>
                <input type="number" min="0" value={runForm.employeeCount}
                  onChange={e => setRunForm(f => ({ ...f, employeeCount: e.target.value }))} className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Total Gross ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={runForm.totalGross}
                    onChange={e => setRunForm(f => ({ ...f, totalGross: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Total Net ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={runForm.totalNet}
                    onChange={e => setRunForm(f => ({ ...f, totalNet: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Processed By</label>
                  <input type="text" value={runForm.processedBy}
                    onChange={e => setRunForm(f => ({ ...f, processedBy: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Processed Date</label>
                  <input type="date" value={runForm.processedDate}
                    onChange={e => setRunForm(f => ({ ...f, processedDate: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select value={runForm.status}
                  onChange={e => setRunForm(f => ({ ...f, status: e.target.value as PayrollRun["status"] }))} className={INPUT}>
                  <option value="draft">Draft</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowAddRun(false); setRunForm({ ...EMPTY_RUN }); }}
                className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary">Cancel</button>
              <button onClick={saveRun} disabled={!runForm.period || !runForm.periodEnd}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── T2200 Form ────────────────────────────────────────────────────── */}
      {showT2200 && (
        <T2200Form employees={employees} onClose={() => setShowT2200(false)} />
      )}
    </div>
  );
}
