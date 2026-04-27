"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes: string;
  period: string; // cash flow period label this item belongs to
}

interface FundingSource {
  id: string;
  organization: string;
  contractNumber: string;
  contactName: string;
  contactEmail: string;
  items: LineItem[];
}

interface ExpenseCategory {
  id: string;
  name: string;
  items: LineItem[];
}

interface CashFlowPeriod {
  id: string;
  label: string;
  revenue: number;
  expenses: number;
  notes: string;
}

interface CashFlowProject {
  id: string;
  name: string;
  client: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  description: string;
  location: string;
  projectManager: string;
  fundingSources: FundingSource[];
  expenseCategories: ExpenseCategory[];
  cashFlowPeriods: CashFlowPeriod[];
  createdAt: string;
  updatedAt: string;
}

type Tab = "overview" | "revenue" | "expenses" | "cashflow" | "summary";

// ── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = "ir-cashflow-projects";

function loadProjects(): CashFlowProject[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}

function saveProjects(projects: CashFlowProject[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(projects));
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmtMoney(n: number) {
  return n === 0 ? "—" : `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function lineTotal(item: LineItem) { return item.quantity * item.unitPrice; }
function sourceTotal(src: FundingSource) { return src.items.reduce((s, i) => s + lineTotal(i), 0); }
function catTotal(cat: ExpenseCategory) { return cat.items.reduce((s, i) => s + lineTotal(i), 0); }

const EMPTY_ITEM = (): LineItem => ({ id: uid(), description: "", quantity: 1, unit: "ea", unitPrice: 0, notes: "", period: "" });
const EMPTY_SOURCE = (): FundingSource => ({ id: uid(), organization: "", contractNumber: "", contactName: "", contactEmail: "", items: [EMPTY_ITEM()] });
const EMPTY_CAT = (name = "New Category"): ExpenseCategory => ({ id: uid(), name, items: [EMPTY_ITEM()] });

const DEFAULT_CATEGORIES = ["Labour", "Equipment", "Materials", "Subcontractors", "Overhead", "Other"];

const EMPTY_PROJECT = (): CashFlowProject => ({
  id: uid(),
  name: "New Project",
  client: "",
  contractNumber: "",
  startDate: "",
  endDate: "",
  description: "",
  location: "",
  projectManager: "Matthew McKernan",
  fundingSources: [EMPTY_SOURCE()],
  expenseCategories: DEFAULT_CATEGORIES.map(n => EMPTY_CAT(n)),
  cashFlowPeriods: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const CAT_COLORS: Record<string, string> = {
  "Labour": "#39de8b", "Equipment": "#3b82f6", "Materials": "#f59e0b",
  "Subcontractors": "#8b5cf6", "Overhead": "#ef4444", "Other": "#6b7280",
};

function catColor(name: string) { return CAT_COLORS[name] ?? "#94a3b8"; }

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview",  label: "Overview",   icon: "▦" },
  { id: "revenue",   label: "Revenue",    icon: "◎" },
  { id: "expenses",  label: "Expenses",   icon: "▤" },
  { id: "cashflow",  label: "Cash Flow",  icon: "◫" },
  { id: "summary",   label: "Summary",    icon: "◉" },
];

// ── Inline cell input ────────────────────────────────────────────────────────

const C = "w-full bg-transparent text-xs text-text-primary border-0 focus:outline-none focus:ring-0 px-0 py-0";
const INP = "w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";
const LBL = "block text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-1";

// ── Line item table ───────────────────────────────────────────────────────────

interface LineTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  periods?: string[];
}

function LineTable({ items, onChange, periods = [] }: LineTableProps) {
  function upd(id: string, key: keyof LineItem, val: string | number) {
    onChange(items.map(i => i.id === id ? { ...i, [key]: val } : i));
  }
  function add() { onChange([...items, EMPTY_ITEM()]); }
  function del(id: string) { onChange(items.filter(i => i.id !== id)); }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-secondary border-b border-border">
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary w-5/12">Description</th>
            <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary w-16">Qty</th>
            <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary w-16">Unit</th>
            <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary w-24">Unit Price</th>
            <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary w-24">Total</th>
            {periods.length > 0 && (
              <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary w-24">Period</th>
            )}
            <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Notes</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-surface-secondary/30 group">
              <td className="px-3 py-1.5">
                <input className={C} value={item.description} onChange={e => upd(item.id, "description", e.target.value)} placeholder="Line item description…" />
              </td>
              <td className="px-2 py-1.5 text-right">
                <input className={`${C} text-right`} type="number" min="0" step="any" value={item.quantity || ""} onChange={e => upd(item.id, "quantity", parseFloat(e.target.value) || 0)} placeholder="0" />
              </td>
              <td className="px-2 py-1.5">
                <input className={C} value={item.unit} onChange={e => upd(item.id, "unit", e.target.value)} placeholder="ea" />
              </td>
              <td className="px-2 py-1.5 text-right">
                <input className={`${C} text-right`} type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={e => upd(item.id, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" />
              </td>
              <td className="px-2 py-1.5 text-right font-semibold text-text-primary tabular-nums">
                {fmtMoney(lineTotal(item))}
              </td>
              {periods.length > 0 && (
                <td className="px-2 py-1.5">
                  <select className={`${C} bg-transparent`} value={item.period} onChange={e => upd(item.id, "period", e.target.value)}>
                    <option value="">—</option>
                    {periods.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
              )}
              <td className="px-2 py-1.5">
                <input className={C} value={item.notes} onChange={e => upd(item.id, "notes", e.target.value)} placeholder="Notes…" />
              </td>
              <td className="px-2 py-1.5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => del(item.id)} className="text-text-tertiary hover:text-rose-400 transition-colors text-[11px]">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-surface-secondary/50">
            <td colSpan={2}>
              <button onClick={add} className="text-[11px] font-medium px-3 py-2 text-primary hover:text-primary/70 transition-colors">+ Add line</button>
            </td>
            <td />
            <td className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Subtotal</td>
            <td className="px-2 py-2 text-right font-bold text-text-primary tabular-nums" style={{ color: "var(--color-primary)" }}>
              {fmtMoney(items.reduce((s, i) => s + lineTotal(i), 0))}
            </td>
            {periods.length > 0 && <td />}
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectCashFlowCenter() {
  const [projects, setProjects] = useState<CashFlowProject[]>([]);
  const [current, setCurrent]   = useState<CashFlowProject | null>(null);
  const [tab, setTab]           = useState<Tab>("overview");
  const [dirty, setDirty]       = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  useEffect(() => { setProjects(loadProjects()); }, []);

  // ── Project CRUD ───────────────────────────────────────────────────────────

  function newProject() {
    const p = EMPTY_PROJECT();
    const updated = [p, ...projects];
    setProjects(updated);
    saveProjects(updated);
    setCurrent(p);
    setTab("overview");
    setDirty(false);
  }

  function openProject(p: CashFlowProject) {
    setCurrent({ ...p });
    setTab("overview");
    setDirty(false);
  }

  function deleteProject(id: string) {
    if (!confirm("Delete this project?")) return;
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    saveProjects(updated);
    if (current?.id === id) setCurrent(null);
  }

  function saveProject() {
    if (!current) return;
    const updated = current;
    updated.updatedAt = new Date().toISOString();
    const list = projects.map(p => p.id === updated.id ? updated : p);
    setProjects(list);
    saveProjects(list);
    setDirty(false);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  }

  function updateCurrent(changes: Partial<CashFlowProject>) {
    if (!current) return;
    setCurrent(prev => prev ? { ...prev, ...changes } : null);
    setDirty(true);
  }

  // ── Revenue helpers ────────────────────────────────────────────────────────

  function addSource() {
    updateCurrent({ fundingSources: [...(current?.fundingSources ?? []), EMPTY_SOURCE()] });
  }

  function updateSource(id: string, changes: Partial<FundingSource>) {
    updateCurrent({
      fundingSources: current!.fundingSources.map(s => s.id === id ? { ...s, ...changes } : s),
    });
  }

  function deleteSource(id: string) {
    updateCurrent({ fundingSources: current!.fundingSources.filter(s => s.id !== id) });
  }

  // ── Expense helpers ────────────────────────────────────────────────────────

  function addCategory(name?: string) {
    updateCurrent({ expenseCategories: [...(current?.expenseCategories ?? []), EMPTY_CAT(name)] });
  }

  function updateCategory(id: string, changes: Partial<ExpenseCategory>) {
    updateCurrent({
      expenseCategories: current!.expenseCategories.map(c => c.id === id ? { ...c, ...changes } : c),
    });
  }

  function deleteCategory(id: string) {
    updateCurrent({ expenseCategories: current!.expenseCategories.filter(c => c.id !== id) });
  }

  // ── Cash flow helpers ──────────────────────────────────────────────────────

  function addPeriod() {
    const n = (current?.cashFlowPeriods.length ?? 0) + 1;
    updateCurrent({
      cashFlowPeriods: [...(current?.cashFlowPeriods ?? []), { id: uid(), label: `Period ${n}`, revenue: 0, expenses: 0, notes: "" }],
    });
  }

  function updatePeriod(id: string, changes: Partial<CashFlowPeriod>) {
    updateCurrent({
      cashFlowPeriods: current!.cashFlowPeriods.map(p => p.id === id ? { ...p, ...changes } : p),
    });
  }

  function deletePeriod(id: string) {
    updateCurrent({ cashFlowPeriods: current!.cashFlowPeriods.filter(p => p.id !== id) });
  }

  function autoGeneratePeriods() {
    if (!current?.startDate || !current?.endDate) return;
    const start = new Date(current.startDate);
    const end   = new Date(current.endDate);
    const periods: CashFlowPeriod[] = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      periods.push({
        id: uid(),
        label: cur.toLocaleString("en-CA", { month: "short", year: "numeric" }),
        revenue: 0, expenses: 0, notes: "",
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    updateCurrent({ cashFlowPeriods: periods });
  }

  // ── Computed totals ────────────────────────────────────────────────────────

  const totalRevenue  = current?.fundingSources.reduce((s, src) => s + sourceTotal(src), 0) ?? 0;
  const totalExpenses = current?.expenseCategories.reduce((s, cat) => s + catTotal(cat), 0) ?? 0;
  const grossMargin   = totalRevenue - totalExpenses;
  const marginPct     = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

  // ── Exports ────────────────────────────────────────────────────────────────

  function exportCSV() {
    if (!current) return;
    const lines: string[] = [];
    const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;

    lines.push("PROJECT CASH FLOW PROJECTION");
    lines.push(`Project,${q(current.name)}`);
    lines.push(`Client,${q(current.client)}`);
    lines.push(`Contract #,${q(current.contractNumber)}`);
    lines.push(`Period,${q(`${current.startDate} – ${current.endDate}`)}`);
    lines.push("");

    lines.push("REVENUE");
    lines.push("Funding Source,Contract #,Description,Qty,Unit,Unit Price,Total,Notes");
    for (const src of current.fundingSources) {
      for (const item of src.items) {
        lines.push([q(src.organization), q(src.contractNumber), q(item.description), item.quantity, q(item.unit), item.unitPrice.toFixed(2), lineTotal(item).toFixed(2), q(item.notes)].join(","));
      }
    }
    lines.push(`Total Revenue,,,,,,${ totalRevenue.toFixed(2)}`);
    lines.push("");

    lines.push("EXPENSES");
    lines.push("Category,Description,Qty,Unit,Unit Price,Total,Notes");
    for (const cat of current.expenseCategories) {
      for (const item of cat.items) {
        lines.push([q(cat.name), q(item.description), item.quantity, q(item.unit), item.unitPrice.toFixed(2), lineTotal(item).toFixed(2), q(item.notes)].join(","));
      }
    }
    lines.push(`Total Expenses,,,,,${ totalExpenses.toFixed(2)}`);
    lines.push("");

    lines.push("CASH FLOW");
    lines.push("Period,Revenue,Expenses,Net,Cumulative,Notes");
    let cum = 0;
    for (const p of current.cashFlowPeriods) {
      cum += p.revenue - p.expenses;
      lines.push([q(p.label), p.revenue.toFixed(2), p.expenses.toFixed(2), (p.revenue - p.expenses).toFixed(2), cum.toFixed(2), q(p.notes)].join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `CashFlow_${current.name.replace(/\s+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function exportXLSX() {
    if (!current) return;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["PROJECT CASH FLOW PROJECTION", ""],
      ["Project", current.name],
      ["Client", current.client],
      ["Contract #", current.contractNumber],
      ["Start Date", current.startDate],
      ["End Date", current.endDate],
      ["Location", current.location],
      ["Project Manager", current.projectManager],
      [],
      ["FINANCIALS", ""],
      ["Total Revenue", totalRevenue],
      ["Total Expenses", totalExpenses],
      ["Gross Margin", grossMargin],
      ["Margin %", `${marginPct.toFixed(1)}%`],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    // Revenue sheet
    const revData: (string | number)[][] = [
      ["Funding Source", "Contract #", "Contact", "Description", "Qty", "Unit", "Unit Price", "Total", "Period", "Notes"],
    ];
    for (const src of current.fundingSources) {
      for (const item of src.items) {
        revData.push([src.organization, src.contractNumber, src.contactName, item.description, item.quantity, item.unit, item.unitPrice, lineTotal(item), item.period, item.notes]);
      }
      revData.push(["", "", "", `${src.organization} Subtotal`, "", "", "", sourceTotal(src), "", ""]);
    }
    revData.push(["", "", "", "TOTAL REVENUE", "", "", "", totalRevenue, "", ""]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revData), "Revenue");

    // Expenses sheet
    const expData: (string | number)[][] = [
      ["Category", "Description", "Qty", "Unit", "Unit Price", "Total", "Period", "Notes"],
    ];
    for (const cat of current.expenseCategories) {
      for (const item of cat.items) {
        expData.push([cat.name, item.description, item.quantity, item.unit, item.unitPrice, lineTotal(item), item.period, item.notes]);
      }
      expData.push([`${cat.name} Subtotal`, "", "", "", "", catTotal(cat), "", ""]);
    }
    expData.push(["TOTAL EXPENSES", "", "", "", "", totalExpenses, "", ""]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expData), "Expenses");

    // Cash flow sheet
    let cum = 0;
    const cfData: (string | number)[][] = [
      ["Period", "Revenue", "Expenses", "Net Cash Flow", "Cumulative Balance", "Notes"],
    ];
    for (const p of current.cashFlowPeriods) {
      const net = p.revenue - p.expenses;
      cum += net;
      cfData.push([p.label, p.revenue, p.expenses, net, cum, p.notes]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cfData), "Cash Flow");

    XLSX.writeFile(wb, `CashFlow_${current.name.replace(/\s+/g, "_")}.xlsx`);
  }

  function exportPDF() {
    if (!current) return;
    const win = window.open("", "_blank", "width=1000,height=900");
    if (!win) return;
    let cum = 0;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Cash Flow – ${current.name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 28px; background: white; }
        h1 { font-size: 18px; font-weight: 800; color: #002a27; margin-bottom: 4px; }
        h2 { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 12px; }
        .meta { font-size: 10px; color: #666; margin-bottom: 20px; }
        .section { margin-bottom: 22px; }
        .sec-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
          color: #555; border-bottom: 1.5px solid #39de8b; padding-bottom: 3px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        th { background: #f1f5f4; text-align: left; padding: 5px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border: 1px solid #e0e0e0; }
        td { padding: 5px 8px; border: 1px solid #e8e8e8; vertical-align: top; }
        tr:nth-child(even) td { background: #f9fafa; }
        .subtotal td { font-weight: 700; background: #f0faf5 !important; }
        .total-row td { font-weight: 800; background: #002a27 !important; color: white; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .neg { color: #c0392b; }
        .pos { color: #15803d; }
        .kpi-row { display: flex; gap: 12px; margin-bottom: 16px; }
        .kpi { flex: 1; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 12px; }
        .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
        .kpi-val { font-size: 17px; font-weight: 800; margin-top: 3px; color: #002a27; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h1>Cash Flow Projection — ${current.name}</h1>
      <div class="meta">Client: ${current.client || "—"} &nbsp;|&nbsp; Contract: ${current.contractNumber || "—"} &nbsp;|&nbsp; Period: ${current.startDate || "—"} – ${current.endDate || "—"} &nbsp;|&nbsp; PM: ${current.projectManager || "—"}</div>

      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val" style="color:#15803d">${fmtMoney(totalRevenue)}</div></div>
        <div class="kpi"><div class="kpi-label">Total Expenses</div><div class="kpi-val" style="color:#c0392b">${fmtMoney(totalExpenses)}</div></div>
        <div class="kpi"><div class="kpi-label">Gross Margin</div><div class="kpi-val" style="color:${grossMargin >= 0 ? "#15803d" : "#c0392b"}">${fmtMoney(grossMargin)}</div></div>
        <div class="kpi"><div class="kpi-label">Margin %</div><div class="kpi-val" style="color:${marginPct >= 0 ? "#15803d" : "#c0392b"}">${marginPct.toFixed(1)}%</div></div>
      </div>

      <div class="section">
        <div class="sec-title">Revenue — Funding Sources</div>
        <table><thead><tr><th>Funding Source</th><th>Contract #</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Unit Price</th><th class="num">Total</th><th>Notes</th></tr></thead>
        <tbody>
          ${current.fundingSources.map(src => [
            ...src.items.map(item =>
              `<tr><td>${src.organization}</td><td>${src.contractNumber}</td><td>${item.description}</td><td class="num">${item.quantity}</td><td>${item.unit}</td><td class="num">$${item.unitPrice.toFixed(2)}</td><td class="num">$${lineTotal(item).toFixed(2)}</td><td>${item.notes}</td></tr>`
            ),
            `<tr class="subtotal"><td colspan="6">${src.organization} — Subtotal</td><td class="num">$${sourceTotal(src).toFixed(2)}</td><td></td></tr>`,
          ].join("")).join("")}
          <tr class="total-row"><td colspan="6">TOTAL REVENUE</td><td class="num">$${totalRevenue.toFixed(2)}</td><td></td></tr>
        </tbody></table>
      </div>

      <div class="section">
        <div class="sec-title">Expenses — By Category</div>
        <table><thead><tr><th>Category</th><th>Description</th><th>Qty</th><th>Unit</th><th class="num">Unit Price</th><th class="num">Total</th><th>Notes</th></tr></thead>
        <tbody>
          ${current.expenseCategories.map(cat => [
            ...cat.items.map(item =>
              `<tr><td>${cat.name}</td><td>${item.description}</td><td class="num">${item.quantity}</td><td>${item.unit}</td><td class="num">$${item.unitPrice.toFixed(2)}</td><td class="num">$${lineTotal(item).toFixed(2)}</td><td>${item.notes}</td></tr>`
            ),
            `<tr class="subtotal"><td colspan="4">${cat.name} — Subtotal</td><td></td><td class="num">$${catTotal(cat).toFixed(2)}</td><td></td></tr>`,
          ].join("")).join("")}
          <tr class="total-row"><td colspan="4">TOTAL EXPENSES</td><td></td><td class="num">$${totalExpenses.toFixed(2)}</td><td></td></tr>
        </tbody></table>
      </div>

      ${current.cashFlowPeriods.length > 0 ? `
      <div class="section">
        <div class="sec-title">Cash Flow by Period</div>
        <table><thead><tr><th>Period</th><th class="num">Revenue</th><th class="num">Expenses</th><th class="num">Net</th><th class="num">Cumulative</th><th>Notes</th></tr></thead>
        <tbody>
          ${current.cashFlowPeriods.map(p => {
            const net = p.revenue - p.expenses;
            cum += net;
            return `<tr>
              <td>${p.label}</td>
              <td class="num">$${p.revenue.toFixed(2)}</td>
              <td class="num">$${p.expenses.toFixed(2)}</td>
              <td class="num ${net >= 0 ? "pos" : "neg"}">$${net.toFixed(2)}</td>
              <td class="num ${cum >= 0 ? "pos" : "neg"}">$${cum.toFixed(2)}</td>
              <td>${p.notes}</td>
            </tr>`;
          }).join("")}
        </tbody></table>
      </div>` : ""}

      <div style="margin-top:24px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:8px">
        Integrity Reforestation Inc. · Generated ${new Date().toLocaleDateString("en-CA")}
      </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  // ── Render: project list ───────────────────────────────────────────────────

  if (!current) {
    return (
      <div className="p-7 max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-text-primary">Cash Flow Projections</h1>
            <p className="text-xs text-text-tertiary mt-0.5">Price and analyze project costs, revenue, and cash flow</p>
          </div>
          <button onClick={newProject}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-all"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
            + New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border py-20 text-center">
            <div className="text-4xl opacity-20 mb-3">◫</div>
            <div className="text-sm font-semibold text-text-secondary">No cash flow projects yet</div>
            <div className="text-xs text-text-tertiary mt-1 mb-5">Create your first project to start pricing and analyzing cash flows</div>
            <button onClick={newProject}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-all"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
              + New Project
            </button>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Project", "Client", "Period", "Revenue", "Expenses", "Margin", "Margin %", "Updated", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map(p => {
                  const rev = p.fundingSources.reduce((s, src) => s + sourceTotal(src), 0);
                  const exp = p.expenseCategories.reduce((s, cat) => s + catTotal(cat), 0);
                  const mgn = rev - exp;
                  const mPct = rev > 0 ? (mgn / rev) * 100 : 0;
                  return (
                    <tr key={p.id} className="hover:bg-surface-secondary/40 transition-colors cursor-pointer group" onClick={() => openProject(p)}>
                      <td className="px-4 py-3 font-semibold text-text-primary">{p.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{p.client || "—"}</td>
                      <td className="px-4 py-3 text-text-tertiary text-[11px]">{p.startDate || "—"} {p.endDate ? `→ ${p.endDate}` : ""}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--color-primary)" }}>{fmtMoney(rev)}</td>
                      <td className="px-4 py-3 font-mono text-rose-400">{fmtMoney(exp)}</td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ color: mgn >= 0 ? "var(--color-primary)" : "var(--color-error, #ef4444)" }}>{fmtMoney(mgn)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${mPct >= 20 ? "bg-green-100 text-green-700" : mPct >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                          {mPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-tertiary text-[11px]">{new Date(p.updatedAt).toLocaleDateString("en-CA")}</td>
                      <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                          className="text-text-tertiary hover:text-rose-400 transition-colors text-[11px]">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Render: project editor ─────────────────────────────────────────────────

  const periodLabels = current.cashFlowPeriods.map(p => p.label);

  return (
    <div className="p-7 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => { if (dirty && !confirm("Unsaved changes. Leave?")) return; setCurrent(null); }}
          className="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1.5">
          ← Projects
        </button>
        <span className="text-text-tertiary/30">|</span>

        <input
          value={current.name}
          onChange={e => updateCurrent({ name: e.target.value })}
          className="text-lg font-bold text-text-primary bg-transparent border-0 focus:outline-none focus:underline flex-1 min-w-0"
          placeholder="Project name…"
        />

        <div className="flex items-center gap-2 shrink-0">
          {dirty && <span className="text-[10px] text-amber-500 font-medium">● unsaved</span>}
          {saveFlash && <span className="text-[10px] text-green-600 font-medium">✓ saved</span>}
          <button onClick={saveProject}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors">
            Save
          </button>
          <div className="relative group">
            <button className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors flex items-center gap-1">
              Export ▾
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-surface rounded-xl border border-border shadow-xl z-30 hidden group-hover:block overflow-hidden">
              <button onClick={exportPDF} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-surface-secondary transition-colors text-text-primary">⬇ PDF</button>
              <button onClick={exportCSV} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-surface-secondary transition-colors text-text-primary">⬇ CSV</button>
              <button onClick={exportXLSX} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-surface-secondary transition-colors text-text-primary">⬇ Excel (XLSX)</button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Revenue",  value: fmtMoney(totalRevenue),  color: "var(--color-primary)" },
          { label: "Total Expenses", value: fmtMoney(totalExpenses), color: "#ef4444" },
          { label: "Gross Margin",   value: fmtMoney(grossMargin),   color: grossMargin >= 0 ? "var(--color-primary)" : "#ef4444" },
          { label: "Margin",         value: `${marginPct.toFixed(1)}%`, color: marginPct >= 15 ? "var(--color-primary)" : marginPct >= 0 ? "#f59e0b" : "#ef4444" },
        ].map(k => (
          <div key={k.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">{k.label}</div>
            <div className="text-xl font-bold mt-1 tabular-nums" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-border mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            }`}>
            <span className="opacity-60 text-[11px]">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && (
        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className={LBL}>Project Name</label>
              <input className={INP} value={current.name} onChange={e => updateCurrent({ name: e.target.value })} />
            </div>
            <div>
              <label className={LBL}>Client / Owner</label>
              <input className={INP} value={current.client} onChange={e => updateCurrent({ client: e.target.value })} placeholder="e.g. Ministry of Natural Resources" />
            </div>
            <div>
              <label className={LBL}>Contract / Tender #</label>
              <input className={INP} value={current.contractNumber} onChange={e => updateCurrent({ contractNumber: e.target.value })} placeholder="e.g. MNR-2026-001" />
            </div>
            <div>
              <label className={LBL}>Start Date</label>
              <input className={INP} type="date" value={current.startDate} onChange={e => updateCurrent({ startDate: e.target.value })} />
            </div>
            <div>
              <label className={LBL}>End Date</label>
              <input className={INP} type="date" value={current.endDate} onChange={e => updateCurrent({ endDate: e.target.value })} />
            </div>
            <div>
              <label className={LBL}>Location / Block</label>
              <input className={INP} value={current.location} onChange={e => updateCurrent({ location: e.target.value })} placeholder="e.g. Nagagami, ON" />
            </div>
            <div>
              <label className={LBL}>Project Manager</label>
              <input className={INP} value={current.projectManager} onChange={e => updateCurrent({ projectManager: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={LBL}>Description / Scope of Work</label>
              <textarea className={`${INP} resize-none`} rows={3} value={current.description} onChange={e => updateCurrent({ description: e.target.value })} placeholder="Brief description of the project scope…" />
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue tab ── */}
      {tab === "revenue" && (
        <div className="space-y-4">
          {current.fundingSources.map((src, idx) => (
            <div key={src.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface-secondary/40">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                  {idx + 1}
                </div>
                <input
                  value={src.organization}
                  onChange={e => updateSource(src.id, { organization: e.target.value })}
                  placeholder="Funding organization name…"
                  className="flex-1 text-sm font-semibold text-text-primary bg-transparent border-0 focus:outline-none"
                />
                <div className="flex items-center gap-3">
                  <input
                    value={src.contractNumber}
                    onChange={e => updateSource(src.id, { contractNumber: e.target.value })}
                    placeholder="Contract #"
                    className="text-xs text-text-tertiary bg-transparent border-0 focus:outline-none w-32 text-right"
                  />
                  <input
                    value={src.contactName}
                    onChange={e => updateSource(src.id, { contactName: e.target.value })}
                    placeholder="Contact name"
                    className="text-xs text-text-tertiary bg-transparent border-0 focus:outline-none w-32"
                  />
                  <input
                    value={src.contactEmail}
                    onChange={e => updateSource(src.id, { contactEmail: e.target.value })}
                    placeholder="Contact email"
                    className="text-xs text-text-tertiary bg-transparent border-0 focus:outline-none w-40"
                  />
                  <span className="text-xs font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
                    {fmtMoney(sourceTotal(src))}
                  </span>
                  <button onClick={() => deleteSource(src.id)} className="text-[11px] text-text-tertiary hover:text-rose-400 transition-colors">✕</button>
                </div>
              </div>
              <div className="p-4">
                <LineTable
                  items={src.items}
                  onChange={items => updateSource(src.id, { items })}
                  periods={periodLabels}
                />
              </div>
            </div>
          ))}

          <button onClick={addSource}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-xs font-semibold text-text-tertiary hover:border-primary hover:text-primary transition-all">
            + Add Funding Source
          </button>

          {current.fundingSources.length > 1 && (
            <div className="bg-surface rounded-xl border border-border px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Total Revenue across all sources</span>
              <span className="text-base font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>{fmtMoney(totalRevenue)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Expenses tab ── */}
      {tab === "expenses" && (
        <div className="space-y-4">
          {current.expenseCategories.map(cat => (
            <div key={cat.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface-secondary/40">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: catColor(cat.name) }} />
                <input
                  value={cat.name}
                  onChange={e => updateCategory(cat.id, { name: e.target.value })}
                  className="flex-1 text-sm font-semibold text-text-primary bg-transparent border-0 focus:outline-none"
                />
                <span className="text-xs font-bold tabular-nums text-rose-400">{fmtMoney(catTotal(cat))}</span>
                <button onClick={() => deleteCategory(cat.id)} className="text-[11px] text-text-tertiary hover:text-rose-400 transition-colors">✕</button>
              </div>
              <div className="p-4">
                <LineTable
                  items={cat.items}
                  onChange={items => updateCategory(cat.id, { items })}
                  periods={periodLabels}
                />
              </div>
            </div>
          ))}

          <button onClick={() => addCategory()}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-xs font-semibold text-text-tertiary hover:border-primary hover:text-primary transition-all">
            + Add Category
          </button>

          {current.expenseCategories.length > 1 && (
            <div className="bg-surface rounded-xl border border-border px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Total Expenses across all categories</span>
              <span className="text-base font-bold tabular-nums text-rose-400">{fmtMoney(totalExpenses)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Cash Flow tab ── */}
      {tab === "cashflow" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={addPeriod}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors">
              + Add Period
            </button>
            {current.startDate && current.endDate && (
              <button onClick={autoGeneratePeriods}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors">
                Auto-generate monthly
              </button>
            )}
            <div className="flex-1" />
            <div className="text-xs text-text-tertiary">
              {current.cashFlowPeriods.length} periods · {fmtMoney(current.cashFlowPeriods.reduce((s, p) => s + p.revenue, 0))} revenue · {fmtMoney(current.cashFlowPeriods.reduce((s, p) => s + p.expenses, 0))} expenses
            </div>
          </div>

          {current.cashFlowPeriods.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border py-16 text-center">
              <div className="text-3xl opacity-20 mb-2">◫</div>
              <div className="text-sm font-medium text-text-secondary mb-1">No periods yet</div>
              <div className="text-xs text-text-tertiary mb-4">Add periods manually or auto-generate monthly periods from your project dates</div>
              {current.startDate && current.endDate ? (
                <button onClick={autoGeneratePeriods} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                  Auto-generate Monthly Periods
                </button>
              ) : (
                <button onClick={addPeriod} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                  + Add Period
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="bg-surface rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Period</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Revenue</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Expenses</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Net Cash Flow</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Cumulative</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Notes</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      let running = 0;
                      return current.cashFlowPeriods.map(p => {
                        const net = p.revenue - p.expenses;
                        running += net;
                        const snap = running;
                        return (
                          <tr key={p.id} className="hover:bg-surface-secondary/30 transition-colors group">
                            <td className="px-4 py-2">
                              <input className="text-xs font-medium text-text-primary bg-transparent border-0 focus:outline-none w-full" value={p.label} onChange={e => updatePeriod(p.id, { label: e.target.value })} />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input className="text-xs font-mono tabular-nums text-right bg-transparent border-0 focus:outline-none w-full" type="number" min="0" step="0.01" value={p.revenue || ""} onChange={e => updatePeriod(p.id, { revenue: parseFloat(e.target.value) || 0 })} placeholder="0.00" style={{ color: "var(--color-primary)" }} />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input className="text-xs font-mono tabular-nums text-right bg-transparent border-0 focus:outline-none w-full text-rose-400" type="number" min="0" step="0.01" value={p.expenses || ""} onChange={e => updatePeriod(p.id, { expenses: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                            </td>
                            <td className="px-4 py-2 text-right font-semibold tabular-nums" style={{ color: net >= 0 ? "var(--color-primary)" : "#ef4444" }}>
                              {fmtMoney(net)}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold tabular-nums" style={{ color: snap >= 0 ? "var(--color-primary)" : "#ef4444" }}>
                              {fmtMoney(snap)}
                            </td>
                            <td className="px-4 py-2">
                              <input className="text-xs text-text-tertiary bg-transparent border-0 focus:outline-none w-full" value={p.notes} onChange={e => updatePeriod(p.id, { notes: e.target.value })} placeholder="Notes…" />
                            </td>
                            <td className="px-2 py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => deletePeriod(p.id)} className="text-[11px] text-text-tertiary hover:text-rose-400 transition-colors">✕</button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-surface-secondary">
                      <td className="px-4 py-2.5 text-xs font-bold text-text-primary uppercase tracking-wide">Totals</td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
                        {fmtMoney(current.cashFlowPeriods.reduce((s, p) => s + p.revenue, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-rose-400">
                        {fmtMoney(current.cashFlowPeriods.reduce((s, p) => s + p.expenses, 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums" style={{ color: current.cashFlowPeriods.reduce((s, p) => s + p.revenue - p.expenses, 0) >= 0 ? "var(--color-primary)" : "#ef4444" }}>
                        {fmtMoney(current.cashFlowPeriods.reduce((s, p) => s + p.revenue - p.expenses, 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Cash flow chart */}
              <div className="bg-surface rounded-2xl border border-border p-5">
                <div className="text-xs font-semibold text-text-secondary mb-4">Net Cash Flow by Period</div>
                <div className="flex items-end gap-1.5 h-32">
                  {(() => {
                    const nets = current.cashFlowPeriods.map(p => p.revenue - p.expenses);
                    const maxAbs = Math.max(...nets.map(Math.abs), 1);
                    return nets.map((net, i) => {
                      const pct = Math.abs(net) / maxAbs * 100;
                      const isPos = net >= 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${current.cashFlowPeriods[i].label}: ${fmtMoney(net)}`}>
                          <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{
                                height: `${pct}%`,
                                background: isPos ? "var(--color-primary)" : "#ef4444",
                                opacity: 0.85,
                                minHeight: 2,
                              }}
                            />
                          </div>
                          <div className="text-[8px] text-text-tertiary truncate w-full text-center">{current.cashFlowPeriods[i].label}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Summary tab ── */}
      {tab === "summary" && (
        <div className="space-y-5">

          {/* Revenue breakdown */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Revenue by Funding Source</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-secondary border-b border-border">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Organization</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Contract #</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Lines</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Total</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">% of Revenue</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {current.fundingSources.map(src => {
                  const t = sourceTotal(src);
                  const pct = totalRevenue > 0 ? (t / totalRevenue) * 100 : 0;
                  return (
                    <tr key={src.id} className="hover:bg-surface-secondary/30">
                      <td className="px-4 py-3 font-medium text-text-primary">{src.organization || "Unnamed source"}</td>
                      <td className="px-4 py-3 text-text-tertiary">{src.contractNumber || "—"}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{src.items.length}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: "var(--color-primary)" }}>{fmtMoney(t)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-20 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-primary)" }} />
                          </div>
                          <span className="text-[11px] font-semibold text-text-secondary w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td />
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-secondary">
                  <td className="px-4 py-2.5 text-xs font-bold text-text-primary" colSpan={3}>Total Revenue</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>{fmtMoney(totalRevenue)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expense breakdown */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <div className="text-xs font-semibold text-text-primary">Expenses by Category</div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-secondary border-b border-border">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Category</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Lines</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Total</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">% of Expenses</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">% of Revenue</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {current.expenseCategories.map(cat => {
                  const t = catTotal(cat);
                  const pctExp = totalExpenses > 0 ? (t / totalExpenses) * 100 : 0;
                  const pctRev = totalRevenue > 0 ? (t / totalRevenue) * 100 : 0;
                  return (
                    <tr key={cat.id} className="hover:bg-surface-secondary/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: catColor(cat.name) }} />
                          <span className="font-medium text-text-primary">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">{cat.items.length}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-400">{fmtMoney(t)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-20 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pctExp}%`, background: catColor(cat.name) }} />
                          </div>
                          <span className="text-[11px] font-semibold text-text-secondary w-10 text-right">{pctExp.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] font-semibold text-text-tertiary">{pctRev.toFixed(1)}%</td>
                      <td />
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-secondary">
                  <td className="px-4 py-2.5 text-xs font-bold text-text-primary" colSpan={2}>Total Expenses</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-rose-400">{fmtMoney(totalExpenses)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Profitability summary */}
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="text-xs font-semibold text-text-primary mb-4">Profitability Analysis</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                {[
                  { label: "Gross Revenue", val: fmtMoney(totalRevenue), color: "var(--color-primary)" },
                  { label: "Total Expenses", val: `(${fmtMoney(totalExpenses)})`, color: "#ef4444" },
                  { label: "Gross Margin", val: fmtMoney(grossMargin), color: grossMargin >= 0 ? "var(--color-primary)" : "#ef4444", bold: true },
                ].map(r => (
                  <div key={r.label} className={`flex items-center justify-between py-1.5 ${r.bold ? "border-t border-border pt-2.5" : ""}`}>
                    <span className={`text-xs ${r.bold ? "font-bold text-text-primary" : "text-text-secondary"}`}>{r.label}</span>
                    <span className={`text-xs tabular-nums ${r.bold ? "text-sm font-bold" : "font-medium"}`} style={{ color: r.color }}>{r.val}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-1.5 border-t border-border pt-2.5">
                  <span className="text-xs font-bold text-text-primary">Margin %</span>
                  <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${marginPct >= 20 ? "bg-green-100 text-green-700" : marginPct >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                    {marginPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex flex-col justify-center items-center border border-border rounded-xl p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mb-2">Revenue vs Expenses</div>
                <div className="w-full max-w-[160px]">
                  {totalRevenue > 0 && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] font-medium text-text-secondary mb-0.5">
                          <span>Revenue</span><span>{fmtMoney(totalRevenue)}</span>
                        </div>
                        <div className="w-full h-4 rounded-full bg-surface-secondary overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: "100%", background: "var(--color-primary)", opacity: 0.8 }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-medium text-text-secondary mb-0.5">
                          <span>Expenses</span><span>{fmtMoney(totalExpenses)}</span>
                        </div>
                        <div className="w-full h-4 rounded-full bg-surface-secondary overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min((totalExpenses / totalRevenue) * 100, 100)}%`, background: "#ef4444", opacity: 0.7 }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-medium text-text-secondary mb-0.5">
                          <span>Margin</span><span>{fmtMoney(grossMargin)}</span>
                        </div>
                        <div className="w-full h-4 rounded-full bg-surface-secondary overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(Math.min(marginPct, 100), 0)}%`, background: marginPct >= 0 ? "var(--color-primary)" : "#ef4444" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  {totalRevenue === 0 && <div className="text-xs text-text-tertiary text-center">Add revenue to see analysis</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Export actions */}
          <div className="bg-surface rounded-2xl border border-border p-5">
            <div className="text-xs font-semibold text-text-primary mb-3">Export</div>
            <div className="flex gap-3">
              <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors">
                ⬇ PDF
              </button>
              <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors">
                ⬇ CSV
              </button>
              <button onClick={exportXLSX} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 text-xs font-semibold hover:opacity-90 transition-all"
                style={{ background: "rgba(57,222,139,0.08)", color: "var(--color-primary)" }}>
                ⬇ Excel (XLSX)
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
