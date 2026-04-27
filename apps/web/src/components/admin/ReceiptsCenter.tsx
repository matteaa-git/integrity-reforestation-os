"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  getReceipts, saveReceipt, deleteReceipt,
  saveReceiptImage, getReceiptImage,
  type Receipt,
} from "@/lib/adminDb";
import { RECEIPT_SEED } from "./receiptSeedData";

// ── Constants ───────────────────────────────────────────────────────────────

const EXPENSE_TYPES = ["Gas - Regular", "Gas - Supreme", "Diesel", "Groceries", "Supplies", "FCRP", "Other"];
const EMPLOYEES = [
  "Chuck Leblanc", "DJ David Dunn", "Daniel Lascelles", "Gabrielle Voelzing",
  "Jess Rose McColum", 'Jolissa "Jo" Lonsbury', "Josiah Whaley", "Lucas Watson",
  "Matt McKernan", "Monica McKernan", "Ocean Windsong", "Tristan Hardy",
];
const CREDIT_CARDS = [
  "VISA **1229", "VISA **0924", "VISA **1013", "VISA **1047",
  "VISA **1377", "VISA **1526", "VISA **9637", "VISA**0056",
  "Matt's Credit Card", "Personal Card",
];

const TYPE_COLORS: Record<string, string> = {
  "Diesel":        "rgba(59,130,246,0.15)",
  "Gas - Regular": "rgba(34,197,94,0.12)",
  "Gas - Supreme": "rgba(16,185,129,0.12)",
  "Groceries":     "rgba(251,191,36,0.15)",
  "Supplies":      "rgba(139,92,246,0.15)",
  "FCRP":          "rgba(236,72,153,0.15)",
  "Other":         "rgba(107,114,128,0.15)",
};
const TYPE_TEXT: Record<string, string> = {
  "Diesel":        "#60a5fa",
  "Gas - Regular": "var(--color-primary)",
  "Gas - Supreme": "#34d399",
  "Groceries":     "#fbbf24",
  "Supplies":      "#a78bfa",
  "FCRP":          "#f472b6",
  "Other":         "#9ca3af",
};

function uid() { return `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function fmtC(n: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

const EMPTY_FORM: Omit<Receipt, "id"> = {
  employee: "", cost: null, date: todayStr(), time: "",
  expenseType: "Gas - Regular", litres: null, pricePerLitre: null, total: null,
  vehicle: "", items: "", creditCard: "", odometer: "", location: "",
  notes: "", receiptProvided: "Yes", imageUrl: "",
};

// ── Types ───────────────────────────────────────────────────────────────────

type SortKey = "date" | "employee" | "cost" | "expenseType" | "location";
type SortDir = "asc" | "desc";

// ── Component ───────────────────────────────────────────────────────────────

export default function ReceiptsCenter() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Receipt, "id">>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [viewImage, setViewImage]   = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  // Filters
  const [filterEmployee, setFilterEmployee]   = useState("all");
  const [filterType, setFilterType]           = useState("all");
  const [filterCard, setFilterCard]           = useState("all");
  const [filterReceipt, setFilterReceipt]     = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState<SortKey>("date");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load + seed ──────────────────────────────────────────────────────────

  useEffect(() => {
    getReceipts().then(existing => {
      if (existing.length === 0) {
        const seeded = (RECEIPT_SEED as unknown as Omit<Receipt, never>[]).map(r => ({ ...r })) as Receipt[];
        Promise.all(seeded.map(r => saveReceipt(r))).then(() => {
          setReceipts(seeded.sort((a, b) => b.date.localeCompare(a.date)));
        });
      } else {
        setReceipts(existing.sort((a, b) => b.date.localeCompare(a.date)));
      }
      setLoading(false);
    });
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let r = receipts;
    if (filterEmployee !== "all") r = r.filter(x => x.employee === filterEmployee);
    if (filterType     !== "all") r = r.filter(x => x.expenseType === filterType);
    if (filterCard     !== "all") r = r.filter(x => x.creditCard === filterCard);
    if (filterReceipt  !== "all") r = r.filter(x => x.receiptProvided?.toLowerCase().startsWith(filterReceipt));
    if (dateFrom) r = r.filter(x => x.date >= dateFrom);
    if (dateTo)   r = r.filter(x => x.date <= dateTo);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x =>
        x.employee.toLowerCase().includes(q) ||
        x.location.toLowerCase().includes(q) ||
        x.items.toLowerCase().includes(q) ||
        x.notes.toLowerCase().includes(q) ||
        x.vehicle.toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => {
      let av: string | number = a[sortKey] ?? "";
      let bv: string | number = b[sortKey] ?? "";
      if (sortKey === "cost") { av = a.cost ?? 0; bv = b.cost ?? 0; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [receipts, filterEmployee, filterType, filterCard, filterReceipt, dateFrom, dateTo, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    const total   = filtered.reduce((s, r) => s + (r.cost ?? 0), 0);
    const byType  = EXPENSE_TYPES.map(t => ({
      type: t,
      amount: filtered.filter(r => r.expenseType === t).reduce((s, r) => s + (r.cost ?? 0), 0),
      count: filtered.filter(r => r.expenseType === t).length,
    })).filter(t => t.count > 0);
    const missing = filtered.filter(r => r.receiptProvided?.toLowerCase().startsWith("no")).length;
    const totalL  = filtered.reduce((s, r) => s + (r.litres ?? 0), 0);
    return { total, byType, missing, totalL };
  }, [filtered]);

  // ── Sort toggle ──────────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ── Image handling ───────────────────────────────────────────────────────

  async function handleImageFile(file: File) {
    setExtracting(true);
    setExtractMsg("Converting image…");

    let blob: Blob = file;
    let mimeType: string = file.type;

    // Convert HEIC/HEIF → JPEG client-side
    const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      try {
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.88 });
        blob = Array.isArray(converted) ? converted[0] : converted;
        mimeType = "image/jpeg";
      } catch {
        setExtractMsg("HEIC conversion failed — please use JPG or PNG");
        setExtracting(false);
        return;
      }
    }

    const previewUrl = URL.createObjectURL(blob);
    setImagePreview(previewUrl);
    setPendingBlob(blob);

    // Convert blob → base64 for Claude Vision API
    setExtractMsg("Reading receipt with AI…");
    try {
      const arrayBuf = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const res = await fetch("/api/extract-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: mimeType }),
      });
      const body = await res.json();
      if (res.ok) {
        const data = body.data;
        setForm(f => ({
          ...f,
          ...(data.date          ? { date: data.date }                           : {}),
          ...(data.time          ? { time: data.time }                           : {}),
          ...(data.expenseType   ? { expenseType: data.expenseType }             : {}),
          ...(data.cost != null  ? { cost: data.cost }                           : {}),
          ...(data.litres != null        ? { litres: data.litres }               : {}),
          ...(data.pricePerLitre != null ? { pricePerLitre: data.pricePerLitre } : {}),
          ...(data.total != null         ? { total: data.total }                 : {}),
          ...(data.location      ? { location: data.location }                   : {}),
          ...(data.vehicle       ? { vehicle: data.vehicle }                     : {}),
          ...(data.items         ? { items: data.items }                         : {}),
          ...(data.odometer      ? { odometer: data.odometer }                   : {}),
          ...(data.creditCard    ? { creditCard: data.creditCard }               : {}),
          ...(data.notes         ? { notes: data.notes }                         : {}),
        }));
        setExtractMsg("Fields filled from receipt ✓");
      } else {
        setExtractMsg(`Could not read receipt: ${body.error ?? res.status}`);
      }
    } catch (err) {
      setExtractMsg(`Extraction error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setExtracting(false);
    }
  }

  function onFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }

  async function loadImageForReceipt(id: string) {
    const blob = await getReceiptImage(id);
    if (blob) setViewImage(URL.createObjectURL(blob));
    else setViewImage(null);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImagePreview(null);
    setPendingBlob(null);
    setExtractMsg(null);
    setShowModal(true);
  }

  function openEdit(r: Receipt) {
    setEditingId(r.id);
    setForm({ ...r });
    setImagePreview(null);
    setPendingBlob(null);
    setExtractMsg(null);
    setShowModal(true);
    if (r.imageUrl) loadImageForReceipt(r.id);
  }

  async function handleSave() {
    if (!form.employee || !form.date) return;
    setSaving(true);
    const id = editingId ?? uid();
    const rec: Receipt = { ...form, id, cost: form.cost ?? null };
    if (pendingBlob) {
      await saveReceiptImage(id, pendingBlob);
    }
    await saveReceipt(rec);
    setReceipts(prev =>
      editingId
        ? prev.map(r => r.id === id ? rec : r)
        : [rec, ...prev]
    );
    setSaving(false);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    await deleteReceipt(id);
    setReceipts(prev => prev.filter(r => r.id !== id));
  }

  function setField(field: keyof Omit<Receipt, "id">, value: string | number | null) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const inputCls = "w-full px-2.5 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";
  const labelCls = "block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1";

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap cursor-pointer select-none hover:text-text-secondary transition-colors"
      >
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </th>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border space-y-4">

        {/* KPI strip */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-surface border border-border rounded-xl px-4 py-3 col-span-2 md:col-span-1">
              <div className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold mb-0.5">Total Spend</div>
              <div className="text-lg font-black" style={{ color: "var(--color-primary)" }}>{fmtC(totals.total)}</div>
              <div className="text-[10px] text-text-tertiary mt-0.5">{filtered.length} receipts</div>
            </div>
            {totals.byType.slice(0, 4).map(t => (
              <div key={t.type} className="bg-surface border border-border rounded-xl px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold mb-0.5 truncate">{t.type}</div>
                <div className="text-sm font-bold text-text-primary">{fmtC(t.amount)}</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">{t.count} txns</div>
              </div>
            ))}
            {totals.missing > 0 && (
              <div className="bg-surface border rounded-xl px-4 py-3" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
                <div className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: "var(--color-danger)" }}>Missing Receipts</div>
                <div className="text-sm font-bold text-text-primary">{totals.missing}</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">no receipt on file</div>
              </div>
            )}
          </div>
        )}

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text" placeholder="Search employee, location, items…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 w-56"
          />
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="px-2.5 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50">
            <option value="all">All Employees</option>
            {EMPLOYEES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-2.5 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50">
            <option value="all">All Types</option>
            {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterCard} onChange={e => setFilterCard(e.target.value)} className="px-2.5 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50">
            <option value="all">All Cards</option>
            {CREDIT_CARDS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterReceipt} onChange={e => setFilterReceipt(e.target.value)} className="px-2.5 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50">
            <option value="all">All Receipts</option>
            <option value="yes">Receipt On File</option>
            <option value="no">Missing Receipt</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2.5 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50" />
          <span className="text-text-tertiary text-xs">–</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2.5 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50" />
          {(filterEmployee !== "all" || filterType !== "all" || filterCard !== "all" || filterReceipt !== "all" || dateFrom || dateTo || search) && (
            <button onClick={() => { setFilterEmployee("all"); setFilterType("all"); setFilterCard("all"); setFilterReceipt("all"); setDateFrom(""); setDateTo(""); setSearch(""); }} className="px-2.5 py-1.5 text-xs text-text-tertiary hover:text-text-primary border border-border rounded-lg hover:bg-surface-secondary transition-colors">
              Clear
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90 shrink-0"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
          >
            + Add Receipt
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm">Loading receipts…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-tertiary">
            <div className="text-4xl opacity-20">🧾</div>
            <div className="text-sm">No receipts match your filters</div>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-secondary border-b border-border">
              <tr>
                <SortTh label="Date" k="date" />
                <SortTh label="Employee" k="employee" />
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Type</th>
                <SortTh label="Amount" k="cost" />
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Litres</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">$/L</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Vehicle</th>
                <SortTh label="Location" k="location" />
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Items</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Card</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Odometer</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Receipt</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Notes</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map(r => {
                const hasReceipt = r.receiptProvided?.toLowerCase().startsWith("yes");
                return (
                  <tr key={r.id} className="hover:bg-surface-secondary/30 group">
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{r.date}{r.time ? ` ${r.time}` : ""}</td>
                    <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">{r.employee || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.expenseType ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: TYPE_COLORS[r.expenseType] ?? "rgba(107,114,128,0.15)", color: TYPE_TEXT[r.expenseType] ?? "#9ca3af" }}>
                          {r.expenseType}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 font-semibold text-text-primary whitespace-nowrap">{fmtC(r.cost)}</td>
                    <td className="px-3 py-2 text-text-secondary">{r.litres != null ? r.litres.toFixed(3) : "—"}</td>
                    <td className="px-3 py-2 text-text-secondary">{r.pricePerLitre != null ? `$${r.pricePerLitre.toFixed(3)}` : "—"}</td>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{r.vehicle || "—"}</td>
                    <td className="px-3 py-2 text-text-secondary max-w-[140px] truncate">{r.location || "—"}</td>
                    <td className="px-3 py-2 text-text-secondary max-w-[120px] truncate">{r.items || "—"}</td>
                    <td className="px-3 py-2 text-text-tertiary whitespace-nowrap text-[11px]">{r.creditCard || "—"}</td>
                    <td className="px-3 py-2 text-text-tertiary whitespace-nowrap">{r.odometer || "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={hasReceipt
                          ? { background: "rgba(34,197,94,0.12)", color: "var(--color-primary)" }
                          : { background: "rgba(239,68,68,0.12)", color: "var(--color-danger)" }
                        }
                      >
                        {hasReceipt ? "On File" : "Missing"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-tertiary max-w-[160px] truncate text-[11px]">{r.notes || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)} className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="text-[11px] font-medium text-text-tertiary hover:text-red-400 transition-colors">Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals footer */}
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-secondary/60 sticky bottom-0">
                <td colSpan={3} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{filtered.length} receipts</td>
                <td className="px-3 py-2.5 font-black text-sm" style={{ color: "var(--color-primary)" }}>{fmtC(totals.total)}</td>
                <td className="px-3 py-2.5 text-text-secondary font-semibold">{totals.totalL > 0 ? totals.totalL.toFixed(1) + " L" : "—"}</td>
                <td colSpan={9} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="text-sm font-semibold text-text-primary">{editingId ? "Edit Receipt" : "Add Receipt"}</div>
              <button onClick={() => setShowModal(false)} className="text-text-tertiary hover:text-text-primary text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Receipt image upload / drop zone */}
              <div>
                <label className={labelCls}>Receipt Image</label>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/50 transition-colors relative"
                  style={{ minHeight: 120 }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={onFileDrop}
                  onClick={() => !extracting && fileRef.current?.click()}
                >
                  <input
                    ref={fileRef} type="file"
                    accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                  />
                  {extracting ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-2" style={{ color: "var(--color-primary)" }}>
                      <div className="text-xl animate-spin">⟳</div>
                      <div className="text-xs font-medium">{extractMsg}</div>
                    </div>
                  ) : imagePreview ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="receipt" className="max-h-48 mx-auto rounded-lg object-contain" />
                      {extractMsg && (
                        <div className="text-[11px] font-medium" style={{ color: extractMsg.includes("✓") ? "var(--color-primary)" : "var(--color-danger)" }}>
                          {extractMsg}
                        </div>
                      )}
                      <div className="text-[10px] text-text-tertiary">Click to replace image</div>
                    </div>
                  ) : (
                    <div className="text-text-tertiary">
                      <div className="text-2xl mb-1">🧾</div>
                      <div className="text-xs">Drag & drop receipt image here, or click to upload</div>
                      <div className="text-[10px] mt-1 opacity-60">HEIC · JPG · PNG · Fields will be auto-filled using AI</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Employee *</label>
                  <select value={form.employee} onChange={e => setField("employee", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {EMPLOYEES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={form.date} onChange={e => setField("date", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Time</label>
                  <input type="time" value={form.time} onChange={e => setField("time", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Expense Type</label>
                  <select value={form.expenseType} onChange={e => setField("expenseType", e.target.value)} className={inputCls}>
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount ($)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={form.cost ?? ""} onChange={e => setField("cost", parseFloat(e.target.value) || null)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Credit Card</label>
                  <select value={form.creditCard} onChange={e => setField("creditCard", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {CREDIT_CARDS.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="Personal Card">Personal Card</option>
                    <option value="not visible">Not Visible</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Litres</label>
                  <input type="number" step="0.001" placeholder="0.000" value={form.litres ?? ""} onChange={e => setField("litres", parseFloat(e.target.value) || null)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>$ / Litre</label>
                  <input type="number" step="0.001" placeholder="0.000" value={form.pricePerLitre ?? ""} onChange={e => setField("pricePerLitre", parseFloat(e.target.value) || null)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vehicle / Plate</label>
                  <input type="text" placeholder="e.g. BX 14252" value={form.vehicle} onChange={e => setField("vehicle", e.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Location</label>
                  <input type="text" placeholder="e.g. White River Esso" value={form.location} onChange={e => setField("location", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Odometer</label>
                  <input type="text" placeholder="e.g. 82006" value={form.odometer} onChange={e => setField("odometer", e.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-3">
                  <label className={labelCls}>Items Purchased</label>
                  <input type="text" placeholder="e.g. DEF Fluid x 2" value={form.items} onChange={e => setField("items", e.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input type="text" placeholder="Any notes…" value={form.notes} onChange={e => setField("notes", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Receipt Provided</label>
                  <select value={form.receiptProvided} onChange={e => setField("receiptProvided", e.target.value)} className={inputCls}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || extracting || !form.employee || !form.date}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image viewer ──────────────────────────────────────────── */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setViewImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewImage} alt="receipt" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl" />
        </div>
      )}

    </div>
  );
}
