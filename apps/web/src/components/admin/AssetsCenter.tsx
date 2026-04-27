"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getAllAssets, saveAsset, deleteAsset,
  type StoredAsset, type MaintenanceRecord,
  type AssetType, type AssetStatus, type InspectionStatus,
} from "@/lib/adminDb";

// ── Helpers ────────────────────────────────────────────────────────────────

function calcCurrentValue(asset: StoredAsset): number {
  if (!asset.purchaseDate || asset.purchasePrice === 0) return 0;
  const years = (Date.now() - new Date(asset.purchaseDate).getTime()) / (365.25 * 86400000);
  return Math.round(asset.purchasePrice * Math.pow(1 - asset.depreciationRate, years));
}

function calcTotalDepreciation(asset: StoredAsset): number {
  return asset.purchasePrice - calcCurrentValue(asset);
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

// ── Category config ────────────────────────────────────────────────────────

type DisplayCategory = "all" | "trailer" | "atv" | "heavy" | "vehicle";

const DISPLAY_CATS: { key: DisplayCategory; label: string; icon: string; color: string; bg: string; border: string }[] = [
  { key: "all",     label: "All Assets",        icon: "◈",  color: "text-text-primary",   bg: "bg-surface-secondary",       border: "border-border" },
  { key: "trailer", label: "Trailers",           icon: "⬡",  color: "text-violet-400",     bg: "bg-violet-500/10",           border: "border-violet-500/30" },
  { key: "atv",     label: "ATVs & UTVs",        icon: "◎",  color: "text-amber-400",      bg: "bg-amber-500/10",            border: "border-amber-500/30" },
  { key: "heavy",   label: "Heavy Equipment",    icon: "⬟",  color: "text-orange-400",     bg: "bg-orange-500/10",           border: "border-orange-500/30" },
  { key: "vehicle", label: "Motor Vehicles",     icon: "◉",  color: "text-blue-400",       bg: "bg-blue-500/10",             border: "border-blue-500/30" },
];

function getDisplayCategory(asset: StoredAsset): DisplayCategory {
  if (asset.type === "trailer") return "trailer";
  if (asset.type === "vehicle") return "vehicle";
  if (asset.type === "equipment") {
    if (asset.subCategory === "excavator") return "heavy";
    if (asset.subCategory === "generator") return "heavy";
    return "atv";
  }
  return "vehicle";
}

function getCatConfig(key: DisplayCategory) {
  return DISPLAY_CATS.find(c => c.key === key)!;
}

function getAssetIcon(asset: StoredAsset): string {
  const sub = asset.subCategory;
  if (sub === "cargo")     return "📦";
  if (sub === "flatdeck")  return "🚛";
  if (sub === "dump")      return "🪣";
  if (sub === "utility")   return "🔧";
  if (sub === "camper")    return "🏕️";
  if (sub === "generator") return "⚡";
  if (sub === "atv")       return "🏍️";
  if (sub === "utv")       return "🚜";
  if (sub === "excavator") return "🏗️";
  if (sub === "pickup")    return "🛻";
  if (asset.type === "trailer")   return "🚚";
  if (asset.type === "vehicle")   return "🚗";
  if (asset.type === "equipment") return "⚙️";
  return "📋";
}

// ── Style maps ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AssetType, string> = {
  vehicle: "Vehicle", trailer: "Trailer", equipment: "Equipment", other: "Other",
};
const TYPE_COLORS: Record<AssetType, React.CSSProperties> = {
  vehicle:   { background: "rgba(59,130,246,0.12)",  color: "var(--color-info)" },
  trailer:   { background: "rgba(139,92,246,0.12)",  color: "#8b5cf6" },
  equipment: { background: "rgba(251,183,0,0.12)",   color: "var(--color-warning)" },
  other:     { background: "rgba(0,0,0,0.05)",       color: "var(--color-text-tertiary)" },
};
const STATUS_COLORS: Record<AssetStatus, string> = {
  operational:      "var(--color-primary)",
  maintenance:      "var(--color-warning)",
  "out-of-service": "var(--color-danger)",
  sold:             "var(--color-text-tertiary)",
};
const STATUS_BADGE: Record<AssetStatus, React.CSSProperties> = {
  operational:      { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" },
  maintenance:      { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" },
  "out-of-service": { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)"  },
  sold:             { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" },
};
const INSP_BADGE: Record<InspectionStatus, string> = {
  current:    "var(--color-primary)",
  "due-soon": "var(--color-warning)",
  overdue:    "var(--color-danger)",
  "n/a":      "var(--color-text-tertiary)",
};

const OWNERSHIP_BADGE: Record<string, React.CSSProperties> = {
  "Company Owned":  { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" },
  "Privately Owned":{ background: "rgba(14,165,233,0.12)", color: "#0ea5e9" },
  "Rented":         { background: "rgba(168,85,247,0.12)", color: "#a855f7" },
  "Owned":          { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" },
};

const INSURANCE_BADGE: Record<string, React.CSSProperties> = {
  "Collision":           { background: "rgba(59,130,246,0.12)", color: "var(--color-info)" },
  "Commercial Liability":{ background: "rgba(99,102,241,0.12)", color: "#6366f1" },
};

const FUEL_BADGE: Record<string, React.CSSProperties> = {
  "Gas":    { background: "rgba(239,68,68,0.1)",  color: "#ef4444" },
  "Diesel": { background: "rgba(251,183,0,0.12)", color: "var(--color-warning)" },
  "N/A":    { background: "rgba(0,0,0,0.05)",     color: "var(--color-text-tertiary)" },
};

const MAINTENANCE_TYPES = [
  "Oil Change", "Tire Rotation", "Tire Replacement", "Brake Service", "Transmission Service",
  "Coolant Flush", "Battery Replacement", "Suspension / Steering", "Exhaust Repair",
  "Electrical", "Body / Paint", "Annual Inspection", "Safety Inspection",
  "Roof Seal", "Hitch Service", "Generator Service", "Other",
];

const BLANK_ASSET: Omit<StoredAsset, "id" | "maintenanceRecords"> = {
  name: "", type: "vehicle", make: "", model: "", year: new Date().getFullYear(),
  vin: "", licensePlate: "", color: "", purchasePrice: 0, purchaseDate: "",
  depreciationRate: 0.18, grossWeight: "", hitchSize: "", towCapacity: "",
  status: "operational", location: "", assignedTo: "", notes: "",
  lastSafetyInspection: "", nextSafetyInspection: "", inspectionStatus: "current",
  fuelType: "", insuranceStatus: "", ownershipStatus: "Company Owned", permitNumber: "",
  numAxles: undefined, subCategory: "",
};

const BLANK_MR: Omit<MaintenanceRecord, "id"> = {
  date: "", type: "Oil Change", description: "", cost: 0,
  odometer: undefined, provider: "", nextDueDate: "", nextDueOdometer: undefined,
};

// ── Component ──────────────────────────────────────────────────────────────

export default function AssetsCenter() {
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StoredAsset | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "registry" | "maintenance" | "financial">("overview");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<DisplayCategory>("all");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");

  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetModalMode, setAssetModalMode] = useState<"add" | "edit">("add");
  const [assetForm, setAssetForm] = useState<Omit<StoredAsset, "id" | "maintenanceRecords">>(BLANK_ASSET);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showMrModal, setShowMrModal] = useState(false);
  const [mrForm, setMrForm] = useState<Omit<MaintenanceRecord, "id">>(BLANK_MR);

  const [deleteTarget, setDeleteTarget] = useState<StoredAsset | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    getAllAssets().then(stored => {
      setAssets(stored);
      setSelected(stored[0] ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selected) setSelected(a => assets.find(x => x.id === a?.id) ?? a);
  }, [assets]); // eslint-disable-line

  const filtered = assets.filter(a => {
    if (catFilter !== "all" && getDisplayCategory(a) !== catFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.make.toLowerCase().includes(q) && !a.model.toLowerCase().includes(q) && !(a.licensePlate ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // KPI totals
  const totalValue = assets.reduce((s, a) => s + calcCurrentValue(a), 0);
  const totalPurchase = assets.reduce((s, a) => s + a.purchasePrice, 0);
  const inMaintenance = assets.filter(a => a.status === "maintenance").length;
  const inspDue = assets.filter(a => a.inspectionStatus === "due-soon" || a.inspectionStatus === "overdue").length;

  // Category counts
  const catCounts: Record<DisplayCategory, number> = {
    all: assets.length,
    trailer: assets.filter(a => getDisplayCategory(a) === "trailer").length,
    atv: assets.filter(a => getDisplayCategory(a) === "atv").length,
    heavy: assets.filter(a => getDisplayCategory(a) === "heavy").length,
    vehicle: assets.filter(a => getDisplayCategory(a) === "vehicle").length,
  };

  // ── Asset CRUD ─────────────────────────────────────────────────────────

  function openAddAsset() {
    setAssetModalMode("add");
    setAssetForm(BLANK_ASSET);
    setEditingId(null);
    setShowAssetModal(true);
  }

  function openEditAsset(asset: StoredAsset) {
    setAssetModalMode("edit");
    setAssetForm({
      name: asset.name, type: asset.type, make: asset.make, model: asset.model,
      year: asset.year, vin: asset.vin ?? "", licensePlate: asset.licensePlate ?? "",
      color: asset.color ?? "", purchasePrice: asset.purchasePrice,
      purchaseDate: asset.purchaseDate, depreciationRate: asset.depreciationRate,
      grossWeight: asset.grossWeight ?? "", hitchSize: asset.hitchSize ?? "",
      towCapacity: asset.towCapacity ?? "", status: asset.status,
      location: asset.location ?? "", assignedTo: asset.assignedTo ?? "",
      notes: asset.notes ?? "", lastSafetyInspection: asset.lastSafetyInspection ?? "",
      nextSafetyInspection: asset.nextSafetyInspection ?? "",
      inspectionStatus: asset.inspectionStatus,
      fuelType: asset.fuelType ?? "", insuranceStatus: asset.insuranceStatus ?? "",
      ownershipStatus: asset.ownershipStatus ?? "Company Owned",
      permitNumber: asset.permitNumber ?? "", numAxles: asset.numAxles,
      subCategory: asset.subCategory ?? "",
    });
    setEditingId(asset.id);
    setShowAssetModal(true);
  }

  async function handleSaveAsset() {
    if (!assetForm.name || !assetForm.make || !assetForm.model) return;
    const id = assetModalMode === "edit" && editingId ? editingId : `asset-${Date.now()}`;
    const existing = assets.find(a => a.id === id);
    const updated: StoredAsset = {
      ...assetForm,
      id,
      year: Number(assetForm.year),
      purchasePrice: Number(assetForm.purchasePrice),
      depreciationRate: Number(assetForm.depreciationRate),
      numAxles: assetForm.numAxles ? Number(assetForm.numAxles) : undefined,
      maintenanceRecords: existing?.maintenanceRecords ?? [],
    };
    await saveAsset(updated);
    setAssets(prev => assetModalMode === "edit"
      ? prev.map(a => a.id === id ? updated : a)
      : [...prev, updated]);
    setShowAssetModal(false);
    if (selected?.id === id || assetModalMode === "add") setSelected(updated);
    showToast(assetModalMode === "edit" ? "Asset updated." : "Asset added.");
  }

  async function handleDeleteAsset(asset: StoredAsset) {
    await deleteAsset(asset.id);
    const next = assets.find(a => a.id !== asset.id) ?? null;
    setAssets(prev => prev.filter(a => a.id !== asset.id));
    setSelected(next);
    setDeleteTarget(null);
    showToast("Asset deleted.");
  }

  // ── Maintenance CRUD ───────────────────────────────────────────────────

  function openAddMaintenance() {
    setMrForm({ ...BLANK_MR, date: new Date().toISOString().slice(0, 10) });
    setShowMrModal(true);
  }

  async function handleSaveMaintenance() {
    if (!selected || !mrForm.date || !mrForm.description) return;
    const record: MaintenanceRecord = {
      ...mrForm,
      id: `mr-${Date.now()}`,
      cost: Number(mrForm.cost),
      odometer: mrForm.odometer ? Number(mrForm.odometer) : undefined,
      nextDueOdometer: mrForm.nextDueOdometer ? Number(mrForm.nextDueOdometer) : undefined,
    };
    const updated: StoredAsset = {
      ...selected,
      maintenanceRecords: [record, ...selected.maintenanceRecords],
    };
    await saveAsset(updated);
    setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
    setSelected(updated);
    setShowMrModal(false);
    setMrForm(BLANK_MR);
    showToast("Maintenance record added.");
  }

  async function handleDeleteMaintenance(mrId: string) {
    if (!selected) return;
    const updated: StoredAsset = {
      ...selected,
      maintenanceRecords: selected.maintenanceRecords.filter(r => r.id !== mrId),
    };
    await saveAsset(updated);
    setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
    setSelected(updated);
    showToast("Record deleted.");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-sm text-text-tertiary animate-pulse">Loading fleet…</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Fleet summary header ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-border px-6 py-4">
        {/* Category pills */}
        <div className="flex items-center gap-2 mb-4">
          {DISPLAY_CATS.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCatFilter(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                catFilter === cat.key
                  ? `${cat.bg} ${cat.color} ${cat.border}`
                  : "bg-surface-secondary text-text-secondary border-border hover:border-border/80"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className={`ml-0.5 text-[10px] font-bold ${catFilter === cat.key ? cat.color : "text-text-tertiary"}`}>
                {catCounts[cat.key]}
              </span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as AssetStatus | "all")}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-secondary text-text-secondary focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="operational">Operational</option>
              <option value="maintenance">Maintenance</option>
              <option value="out-of-service">Out of Service</option>
              <option value="sold">Sold</option>
            </select>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total Assets",        value: assets.length,                 sub: "tracked fleet items",    color: "text-text-primary" },
            { label: "Purchase Cost",        value: formatCurrency(totalPurchase), sub: "original acquisition",   color: "text-text-primary" },
            { label: "Current Fleet Value",  value: formatCurrency(totalValue),   sub: "after depreciation",     cssColor: "var(--color-info)" },
            { label: "In Maintenance",       value: inMaintenance,                sub: "currently down",         cssColor: inMaintenance > 0 ? "var(--color-warning)" : "var(--color-text-primary)" },
            { label: "Inspections Due",      value: inspDue,                      sub: "due soon or overdue",    cssColor: inspDue > 0 ? "var(--color-danger)" : "var(--color-primary)" },
          ].map(k => (
            <div key={k.label} className="bg-surface-secondary rounded-lg px-3 py-2.5 border border-border">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-text-tertiary truncate">{k.label}</div>
              <div className="text-xl font-bold mt-0.5" style={{ color: k.cssColor }}>{k.value}</div>
              <div className="text-[9px] text-text-tertiary mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-panel layout ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: asset list */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-surface">
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search assets…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={openAddAsset}
                className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:opacity-90 transition-all"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                + Add
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {filtered.map(asset => {
              const cat = getCatConfig(getDisplayCategory(asset));
              return (
                <button
                  key={asset.id}
                  onClick={() => { setSelected(asset); setDetailTab("overview"); }}
                  className={`w-full text-left px-3 py-3 transition-colors hover:bg-surface-secondary/60 ${
                    selected?.id === asset.id ? "bg-primary/8 border-l-2 border-primary" : "border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-base mt-0.5 shrink-0">{getAssetIcon(asset)}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text-primary truncate">{asset.name}</div>
                        <div className="text-[10px] text-text-tertiary mt-0.5 truncate">{asset.year} {asset.make} {asset.model}</div>
                        {asset.licensePlate && (
                          <div className="text-[9px] text-text-tertiary mt-0.5 font-mono tracking-wide">{asset.licensePlate}</div>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ background: STATUS_COLORS[asset.status] }} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cat.bg} ${cat.color} ${cat.border}`}>
                      {cat.label}
                    </span>
                    {asset.fuelType && asset.fuelType !== "N/A" && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={FUEL_BADGE[asset.fuelType] ?? { background: "rgba(0,0,0,0.05)", color: "var(--color-text-tertiary)" }}>
                        {asset.fuelType}
                      </span>
                    )}
                    {asset.purchasePrice > 0 && (
                      <span className="text-[10px] text-text-secondary font-medium ml-auto">
                        {formatCurrency(calcCurrentValue(asset))}
                      </span>
                    )}
                  </div>
                  {(asset.inspectionStatus === "overdue" || asset.inspectionStatus === "due-soon") && (
                    <div className="text-[9px] font-semibold mt-1" style={{ color: INSP_BADGE[asset.inspectionStatus] }}>
                      {asset.inspectionStatus === "overdue" ? "⚠ Inspection overdue" : "⚠ Inspection due soon"}
                    </div>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-xs text-text-tertiary">No assets found.</div>
            )}
          </div>
        </div>

        {/* RIGHT: detail panel */}
        <div className="flex-1 overflow-hidden flex flex-col bg-surface-secondary">
          {selected ? (
            <>
              {/* Detail header */}
              <div className="shrink-0 bg-surface border-b border-border px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl mt-0.5">{getAssetIcon(selected)}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-text-primary">{selected.name}</h2>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={TYPE_COLORS[selected.type]}>
                          {TYPE_LABELS[selected.type]}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={STATUS_BADGE[selected.status]}>
                          {selected.status}
                        </span>
                        {selected.ownershipStatus && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={OWNERSHIP_BADGE[selected.ownershipStatus] ?? { background: "rgba(0,0,0,0.05)", color: "var(--color-text-tertiary)" }}>
                            {selected.ownershipStatus}
                          </span>
                        )}
                        {selected.insuranceStatus && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={INSURANCE_BADGE[selected.insuranceStatus] ?? { background: "rgba(0,0,0,0.05)", color: "var(--color-text-tertiary)" }}>
                            {selected.insuranceStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        {selected.year} {selected.make} {selected.model}
                        {selected.licensePlate && <span className="font-mono ml-1.5 text-text-tertiary">· {selected.licensePlate}</span>}
                        {selected.location && ` · ${selected.location}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={openAddMaintenance}
                      className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors">
                      + Service
                    </button>
                    <button onClick={() => openEditAsset(selected)}
                      className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors">
                      Edit
                    </button>
                    <button onClick={() => setDeleteTarget(selected)}
                      className="px-3 py-1.5 text-xs font-medium border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {(["overview","registry","maintenance","financial"] as const).map(t => (
                    <button key={t} onClick={() => setDetailTab(t)}
                      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                        detailTab === t ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                      }`}>
                      {t === "maintenance" ? `Service (${selected.maintenanceRecords.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">

                {/* ── OVERVIEW TAB ──────────────────────────────────────── */}
                {detailTab === "overview" && (
                  <div className="space-y-5 max-w-4xl">
                    <div className="bg-surface rounded-xl border border-border p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-4">Specifications</div>
                      <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                        {[
                          { label: "Year",          value: selected.year },
                          { label: "Make",          value: selected.make },
                          { label: "Model",         value: selected.model },
                          { label: "Gross Weight",  value: selected.grossWeight || "—" },
                          { label: "Hitch / Hook",  value: selected.hitchSize || "—" },
                          { label: "Tow Capacity",  value: selected.towCapacity || "—" },
                          { label: "Fuel Type",     value: selected.fuelType || "—" },
                          { label: "Axles",         value: selected.numAxles != null ? String(selected.numAxles) : "—" },
                          { label: "Colour",        value: selected.color || "—" },
                          { label: "Status",        value: selected.status },
                          { label: "Location",      value: selected.location || "—" },
                          { label: "Assigned To",   value: selected.assignedTo || "—" },
                        ].map(f => (
                          <div key={f.label}>
                            <div className="text-[10px] text-text-tertiary font-medium mb-0.5">{f.label}</div>
                            <div className="text-xs text-text-primary font-medium capitalize">{String(f.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Safety inspection */}
                    {selected.inspectionStatus !== "n/a" && (
                      <div className={`rounded-xl border p-5 ${
                        selected.inspectionStatus === "overdue" ? "bg-red-500/8 border-red-500/25" :
                        selected.inspectionStatus === "due-soon" ? "bg-amber-500/8 border-amber-500/25" :
                        "bg-surface border-border"
                      }`}>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Annual Safety Inspection</div>
                        <div className="grid grid-cols-3 gap-6">
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-0.5">Last Inspection</div>
                            <div className="text-xs font-semibold text-text-primary">{selected.lastSafetyInspection || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-0.5">Next Due</div>
                            <div className="text-xs font-semibold" style={{ color: INSP_BADGE[selected.inspectionStatus] }}>
                              {selected.nextSafetyInspection || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-0.5">Status</div>
                            <div className="text-xs font-semibold capitalize" style={{ color: INSP_BADGE[selected.inspectionStatus] }}>
                              {selected.inspectionStatus}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selected.notes && (
                      <div className="bg-surface rounded-xl border border-border p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">Notes</div>
                        <p className="text-xs text-text-secondary leading-relaxed">{selected.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── REGISTRY TAB ──────────────────────────────────────── */}
                {detailTab === "registry" && (
                  <div className="space-y-5 max-w-4xl">
                    <div className="bg-surface rounded-xl border border-border p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-4">Identification & Registration</div>
                      <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                        {[
                          { label: "VIN / Serial #",         value: selected.vin || "—" },
                          { label: "Licence Plate",          value: selected.licensePlate || "—" },
                          { label: "Vehicle Permit #",       value: selected.permitNumber || "—" },
                          { label: "Year",                   value: String(selected.year) },
                          { label: "Make / Manufacturer",    value: selected.make },
                          { label: "Model",                  value: selected.model },
                        ].map(f => (
                          <div key={f.label} className="border-b border-border/50 pb-3">
                            <div className="text-[10px] text-text-tertiary font-medium mb-0.5">{f.label}</div>
                            <div className="text-sm font-semibold text-text-primary font-mono tracking-wide">{f.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-4">Ownership & Insurance</div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-1">Ownership Status</div>
                            {selected.ownershipStatus ? (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={OWNERSHIP_BADGE[selected.ownershipStatus] ?? { background: "rgba(0,0,0,0.05)", color: "var(--color-text-tertiary)" }}>
                                {selected.ownershipStatus}
                              </span>
                            ) : <span className="text-xs text-text-tertiary">—</span>}
                          </div>
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-1">Insurance Type</div>
                            {selected.insuranceStatus ? (
                              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={INSURANCE_BADGE[selected.insuranceStatus] ?? { background: "rgba(0,0,0,0.05)", color: "var(--color-text-tertiary)" }}>
                                {selected.insuranceStatus}
                              </span>
                            ) : <span className="text-xs text-text-tertiary">—</span>}
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-4">Physical Details</div>
                        <div className="space-y-3">
                          {[
                            { label: "Gross Weight", value: selected.grossWeight || "—" },
                            { label: "Hitch / Hook", value: selected.hitchSize || "—" },
                            { label: "No. of Axles", value: selected.numAxles != null ? String(selected.numAxles) : "—" },
                            { label: "Fuel Type",    value: selected.fuelType || "—" },
                          ].map(f => (
                            <div key={f.label} className="flex items-center justify-between">
                              <span className="text-[10px] text-text-tertiary">{f.label}</span>
                              <span className="text-xs font-medium text-text-primary">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-surface rounded-xl border border-border p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-4">Safety Inspection Record</div>
                      {selected.inspectionStatus === "n/a" ? (
                        <p className="text-xs text-text-tertiary">Safety inspection not required for this asset.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-6">
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-0.5">Last Inspection</div>
                            <div className="text-xs font-semibold text-text-primary">{selected.lastSafetyInspection || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-0.5">Next Due</div>
                            <div className="text-xs font-semibold" style={{ color: INSP_BADGE[selected.inspectionStatus] }}>
                              {selected.nextSafetyInspection || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-text-tertiary mb-0.5">Status</div>
                            <div className="text-xs font-semibold capitalize" style={{ color: INSP_BADGE[selected.inspectionStatus] }}>
                              {selected.inspectionStatus}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── MAINTENANCE TAB ──────────────────────────────────── */}
                {detailTab === "maintenance" && (
                  <div className="max-w-4xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs font-semibold text-text-primary">Service History</div>
                      <button onClick={openAddMaintenance}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg hover:opacity-90 transition-all"
                        style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                        + Add Record
                      </button>
                    </div>

                    {selected.maintenanceRecords.length === 0 ? (
                      <div className="bg-surface rounded-xl border border-border py-12 text-center">
                        <div className="text-2xl mb-2">🔧</div>
                        <div className="text-sm font-medium text-text-secondary">No service records yet</div>
                        <div className="text-xs text-text-tertiary mt-1">Add the first record with the button above</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {[...selected.maintenanceRecords]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map(mr => (
                            <div key={mr.id} className="bg-surface rounded-xl border border-border p-4 group">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <span className="text-xs font-bold text-text-primary">{mr.type}</span>
                                    <span className="text-[10px] text-text-tertiary">{mr.date}</span>
                                    {mr.odometer && <span className="text-[10px] text-text-tertiary">{mr.odometer.toLocaleString()} km</span>}
                                    {mr.provider && <span className="text-[10px] text-text-tertiary">· {mr.provider}</span>}
                                  </div>
                                  <p className="text-xs text-text-secondary">{mr.description}</p>
                                  {(mr.nextDueDate || mr.nextDueOdometer) && (
                                    <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: "var(--color-warning)" }}>
                                      <span>Next due:</span>
                                      {mr.nextDueDate && <span>{mr.nextDueDate}</span>}
                                      {mr.nextDueOdometer && <span>{mr.nextDueOdometer.toLocaleString()} km</span>}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-start gap-3">
                                  <span className="text-xs font-bold text-text-primary">{formatCurrency(mr.cost)}</span>
                                  <button onClick={() => handleDeleteMaintenance(mr.id)}
                                    className="text-[10px] text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                                    ×
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {selected.maintenanceRecords.length > 0 && (
                      <div className="mt-4 bg-surface rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-tertiary">Total service cost</span>
                          <span className="font-bold text-text-primary">
                            {formatCurrency(selected.maintenanceRecords.reduce((s, r) => s + r.cost, 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── FINANCIAL TAB ─────────────────────────────────────── */}
                {detailTab === "financial" && (
                  <div className="space-y-5 max-w-3xl">
                    {selected.purchasePrice === 0 ? (
                      <div className="bg-surface rounded-xl border border-border py-10 text-center">
                        <div className="text-2xl mb-2">💼</div>
                        <div className="text-sm font-medium text-text-secondary">No financial data</div>
                        <div className="text-xs text-text-tertiary mt-1">This asset is rented or has no purchase price set.</div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: "Purchase Price",     value: formatCurrency(selected.purchasePrice),         color: "text-text-primary" },
                            { label: "Current Value",      value: formatCurrency(calcCurrentValue(selected)),     cssColor: "var(--color-info)" },
                            { label: "Total Depreciation", value: formatCurrency(calcTotalDepreciation(selected)), cssColor: "var(--color-warning)" },
                          ].map(k => (
                            <div key={k.label} className="bg-surface rounded-xl border border-border p-4">
                              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{k.label}</div>
                              <div className="text-xl font-bold mt-1" style={{ color: k.cssColor }}>{k.value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-surface rounded-xl border border-border p-5">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-4">Depreciation Schedule</div>
                          <div className="grid grid-cols-2 gap-x-10 gap-y-3 mb-5">
                            <div>
                              <div className="text-[10px] text-text-tertiary mb-0.5">Purchase Date</div>
                              <div className="text-xs font-medium text-text-primary">{selected.purchaseDate || "—"}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-text-tertiary mb-0.5">Annual Depreciation Rate</div>
                              <div className="text-xs font-medium text-text-primary">{(selected.depreciationRate * 100).toFixed(0)}% (declining balance)</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-text-tertiary mb-0.5">Value Retained</div>
                              <div className="text-xs font-medium text-text-primary">
                                {((calcCurrentValue(selected) / selected.purchasePrice) * 100).toFixed(1)}% of original
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-text-tertiary mb-0.5">Depreciation to Date</div>
                              <div className="text-xs font-medium" style={{ color: "var(--color-warning)" }}>{formatCurrency(calcTotalDepreciation(selected))}</div>
                            </div>
                          </div>

                          <div className="mb-1 flex justify-between text-[9px] text-text-tertiary">
                            <span>Current value</span>
                            <span>Purchase price</span>
                          </div>
                          <div className="h-3 bg-surface-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ background: "var(--color-info)", width: `${Math.max(2, (calcCurrentValue(selected) / selected.purchasePrice) * 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-[9px] text-text-tertiary mt-1">
                            <span>{formatCurrency(calcCurrentValue(selected))}</span>
                            <span>{formatCurrency(selected.purchasePrice)}</span>
                          </div>
                        </div>

                        <div className="bg-surface rounded-xl border border-border overflow-hidden">
                          <div className="px-5 py-3 border-b border-border text-xs font-semibold text-text-primary">Projected Value</div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-surface-secondary">
                                {["Year","Projected Value","Annual Loss","Cumulative Loss"].map(h => (
                                  <th key={h} className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {[0,1,2,3,4,5].map(offset => {
                                const yr = new Date().getFullYear() + offset;
                                const base = new Date(selected.purchaseDate || `${selected.year}-01-01`).getFullYear();
                                const yrs = yr - base;
                                const val = Math.round(selected.purchasePrice * Math.pow(1 - selected.depreciationRate, yrs));
                                const prev = Math.round(selected.purchasePrice * Math.pow(1 - selected.depreciationRate, Math.max(0, yrs - 1)));
                                const annualLoss = offset === 0 ? 0 : prev - val;
                                const cumLoss = selected.purchasePrice - val;
                                return (
                                  <tr key={yr} className={`${offset === 0 ? "bg-primary/5 font-semibold" : ""} hover:bg-surface-secondary/60`}>
                                    <td className="px-4 py-2 text-text-primary">{yr}{offset === 0 ? " (now)" : ""}</td>
                                    <td className="px-4 py-2" style={{ color: "var(--color-info)" }}>{formatCurrency(Math.max(0, val))}</td>
                                    <td className="px-4 py-2" style={{ color: "var(--color-warning)" }}>{offset === 0 ? "—" : formatCurrency(annualLoss)}</td>
                                    <td className="px-4 py-2 text-text-secondary">{formatCurrency(Math.max(0, cumLoss))}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-text-tertiary">
              Select an asset to view details
            </div>
          )}
        </div>
      </div>

      {/* ── Asset Add/Edit Modal ──────────────────────────────────────────── */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">
                {assetModalMode === "add" ? "Add Asset" : `Edit — ${assetForm.name || "Asset"}`}
              </div>
              <button onClick={() => setShowAssetModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Identity */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Identity</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Asset Name *</label>
                    <input value={assetForm.name} onChange={e => setAssetForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Kitchen Trailer"
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                  {[
                    { key: "type",   label: "Type",   isSelect: true, options: ["vehicle","trailer","equipment","other"] },
                    { key: "status", label: "Status", isSelect: true, options: ["operational","maintenance","out-of-service","sold"] },
                    { key: "year",   label: "Year *", type: "number" },
                    { key: "make",   label: "Make *" },
                    { key: "model",  label: "Model *" },
                    { key: "color",  label: "Colour" },
                    { key: "vin",    label: "VIN / Serial" },
                    { key: "licensePlate", label: "Licence Plate" },
                  ].map((f: {key: string; label: string; type?: string; isSelect?: boolean; options?: string[]}) => (
                    <div key={f.key}>
                      <label className="block text-[11px] font-medium text-text-secondary mb-1">{f.label}</label>
                      {f.isSelect ? (
                        <select value={(assetForm as Record<string,unknown>)[f.key] as string}
                          onChange={e => setAssetForm(prev => ({...prev, [f.key]: e.target.value}))}
                          className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50 capitalize">
                          {f.options!.map(o => <option key={o} value={o} className="capitalize">{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.type || "text"}
                          value={(assetForm as Record<string,unknown>)[f.key] as string}
                          onChange={e => setAssetForm(prev => ({...prev, [f.key]: e.target.value}))}
                          className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                      )}
                    </div>
                  ))}
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Permit # (Ownership)</label>
                    <input value={assetForm.permitNumber ?? ""} onChange={e => setAssetForm(f => ({...f, permitNumber: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                </div>
              </div>

              {/* Ownership & Insurance */}
              <div className="border-t border-border pt-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Ownership & Insurance</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Ownership Status</label>
                    <select value={assetForm.ownershipStatus ?? "Company Owned"}
                      onChange={e => setAssetForm(f => ({...f, ownershipStatus: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                      <option>Company Owned</option>
                      <option>Privately Owned</option>
                      <option>Rented</option>
                      <option>Owned</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Insurance Type</label>
                    <select value={assetForm.insuranceStatus ?? ""}
                      onChange={e => setAssetForm(f => ({...f, insuranceStatus: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                      <option value="">—</option>
                      <option>Collision</option>
                      <option>Commercial Liability</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Physical specs */}
              <div className="border-t border-border pt-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Physical Specs</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {key:"grossWeight",  label:"Gross Weight"},
                    {key:"hitchSize",    label:"Hitch / Hook Size"},
                    {key:"towCapacity",  label:"Tow Capacity"},
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[11px] font-medium text-text-secondary mb-1">{f.label}</label>
                      <input value={(assetForm as Record<string,unknown>)[f.key] as string}
                        onChange={e => setAssetForm(prev => ({...prev, [f.key]: e.target.value}))}
                        className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Fuel Type</label>
                    <select value={assetForm.fuelType ?? ""}
                      onChange={e => setAssetForm(f => ({...f, fuelType: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                      <option value="">—</option>
                      <option>Gas</option>
                      <option>Diesel</option>
                      <option>N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Number of Axles</label>
                    <input type="number" min={0} max={10}
                      value={assetForm.numAxles ?? ""}
                      onChange={e => setAssetForm(f => ({...f, numAxles: e.target.value ? parseInt(e.target.value) : undefined}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div className="border-t border-border pt-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Financial</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Purchase Price (CAD)</label>
                    <input type="number" value={assetForm.purchasePrice}
                      onChange={e => setAssetForm(f => ({...f, purchasePrice: parseFloat(e.target.value) || 0}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Purchase Date</label>
                    <input type="date" value={assetForm.purchaseDate}
                      onChange={e => setAssetForm(f => ({...f, purchaseDate: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Depreciation Rate / yr</label>
                    <select value={assetForm.depreciationRate}
                      onChange={e => setAssetForm(f => ({...f, depreciationRate: parseFloat(e.target.value)}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                      <option value={0.30}>30% (heavy equip.)</option>
                      <option value={0.20}>20% (ATV / standard)</option>
                      <option value={0.18}>18% (truck / SUV)</option>
                      <option value={0.15}>15% (trailer)</option>
                      <option value={0.12}>12% (slow depreciation)</option>
                      <option value={0.10}>10% (minimal)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Inspection */}
              <div className="border-t border-border pt-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Safety Inspection</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Last Inspection</label>
                    <input type="date" value={assetForm.lastSafetyInspection}
                      onChange={e => setAssetForm(f => ({...f, lastSafetyInspection: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Next Due</label>
                    <input type="date" value={assetForm.nextSafetyInspection}
                      onChange={e => setAssetForm(f => ({...f, nextSafetyInspection: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Inspection Status</label>
                    <select value={assetForm.inspectionStatus}
                      onChange={e => setAssetForm(f => ({...f, inspectionStatus: e.target.value as InspectionStatus}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                      <option value="current">Current</option>
                      <option value="due-soon">Due Soon</option>
                      <option value="overdue">Overdue</option>
                      <option value="n/a">N/A</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Location / Notes */}
              <div className="border-t border-border pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Location</label>
                    <input value={assetForm.location} onChange={e => setAssetForm(f => ({...f, location: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Assigned To</label>
                    <input value={assetForm.assignedTo} onChange={e => setAssetForm(f => ({...f, assignedTo: e.target.value}))}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Notes</label>
                    <textarea value={assetForm.notes} onChange={e => setAssetForm(f => ({...f, notes: e.target.value}))} rows={2}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50 resize-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowAssetModal(false)}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveAsset}
                disabled={!assetForm.name || !assetForm.make || !assetForm.model}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {assetModalMode === "add" ? "Add Asset" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Maintenance Record Modal ──────────────────────────────────────── */}
      {showMrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[520px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Add Service Record</div>
              <button onClick={() => setShowMrModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Date *</label>
                  <input type="date" value={mrForm.date} onChange={e => setMrForm(f => ({...f, date: e.target.value}))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Service Type</label>
                  <select value={mrForm.type} onChange={e => setMrForm(f => ({...f, type: e.target.value}))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                    {MAINTENANCE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Description *</label>
                <textarea value={mrForm.description} onChange={e => setMrForm(f => ({...f, description: e.target.value}))} rows={2}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50 resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Cost (CAD)</label>
                  <input type="number" value={mrForm.cost} onChange={e => setMrForm(f => ({...f, cost: parseFloat(e.target.value) || 0}))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Odometer (km)</label>
                  <input type="number" value={mrForm.odometer ?? ""} onChange={e => setMrForm(f => ({...f, odometer: e.target.value ? parseInt(e.target.value) : undefined}))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Provider</label>
                  <input value={mrForm.provider} onChange={e => setMrForm(f => ({...f, provider: e.target.value}))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Next Due Date</label>
                  <input type="date" value={mrForm.nextDueDate} onChange={e => setMrForm(f => ({...f, nextDueDate: e.target.value}))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Next Due Odometer (km)</label>
                  <input type="number" value={mrForm.nextDueOdometer ?? ""} onChange={e => setMrForm(f => ({...f, nextDueOdometer: e.target.value ? parseInt(e.target.value) : undefined}))}
                    className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowMrModal(false)}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveMaintenance}
                disabled={!mrForm.date || !mrForm.description}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[380px] p-6">
            <div className="text-sm font-semibold text-text-primary mb-2">Delete Asset</div>
            <div className="text-xs text-text-secondary mb-5">
              Permanently delete <span className="font-medium text-text-primary">{deleteTarget.name}</span> and all its service records?
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDeleteAsset(deleteTarget)}
                className="px-4 py-2 text-xs font-medium bg-danger text-white rounded-lg hover:opacity-90 transition-opacity">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-5 py-3 rounded-xl shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
