"use client";

import { useState, useEffect, useMemo } from "react";
import type { Employee } from "@/app/admin/page";
import { createClient } from "@/lib/supabase/client";
import { getAllRecords, saveRecord, deleteRecord, getSupervisorDeliveries, saveSupervisorDelivery, deleteSupervisorDelivery, getTreeOrders, saveTreeOrder, deleteTreeOrder, getUpcomingBlockPlans, saveUpcomingBlockPlan, deleteUpcomingBlockPlan, getTreeTransfers, saveTreeTransfer, deleteTreeTransfer, getDeliveryPlans, saveDeliveryPlan, deleteDeliveryPlan, getAllBlockAdjustments, saveBlockAdjustment, deleteBlockAdjustment, getAllBlockTargets, saveBlockTarget, REEFER_STORAGE, migrateFromIndexedDB, type SupervisorDelivery, type SupervisorDeliveryLine, type NurseryLoad, type TreeOrder, type ProjectBlock, type UpcomingBlockPlan, type TreeTransfer, type TreeTransferLine, type DeliveryPlan, type DeliveryPlanLine, type BlockAdjustment, type BlockTarget } from "@/lib/productionDb";

// ── Types ──────────────────────────────────────────────────────────────────

interface SpeciesRate {
  id: string;
  species: string;
  code: string;
  rateBucket: string;
  rateType: "flat" | "tiered";
  ratePerTree: number;          // used when rateType === "flat"
  tierThreshold?: number;       // e.g. 1500 — trees < this → rateBelow, else → rateAbove
  rateBelowThreshold?: number;
  rateAboveThreshold?: number;
  treesPerBox?: number;         // optional: enables box-based entry (trees = boxes × treesPerBox)
}

interface ProductionLine {
  speciesId: string;
  species: string;
  code: string;
  trees: number;
  rateBucket: string;
  ratePerTree: number;
  earnings: number;
}

interface ProductionEntry {
  id: string;
  date: string;
  crewBoss: string;
  project: string;
  block: string;
  camp: string;
  shift: string;
  notes: string;
  employeeId: string;
  employeeName: string;
  role: string;
  production: ProductionLine[];
  totalTrees: number;
  totalEarnings: number;
  avgPricePerTree: number;
  hoursWorked: number;
  vacPay: number;
  totalWithVac: number;
}

interface DraftLine {
  id: string;
  speciesId: string;
  trees: string;
  boxes?: string;
}

interface DraftPlanter {
  id: string;
  employeeId: string;
  employeeName: string;
  hoursWorked: string;
  lines: DraftLine[];
}

interface SessionForm {
  date: string;
  crewBoss: string;
  project: string;
  block: string;
  camp: string;
  shift: string;
  notes: string;
  equipmentOnBlock: string;
  equipmentFuelLevel: string;
  vehicleFuelLevel: string;
  planForTomorrow: string;
  needsNotes: string;
}

// ── Seed rates ─────────────────────────────────────────────────────────────

const INITIAL_RATES: SpeciesRate[] = [
  { id: "sr-001", species: "Jack Pine",    code: "PJ", rateBucket: "", rateType: "flat", ratePerTree: 0.16 },
  { id: "sr-002", species: "Black Spruce", code: "SB", rateBucket: "", rateType: "flat", ratePerTree: 0.18 },
  { id: "sr-003", species: "White Spruce", code: "SW", rateBucket: "", rateType: "flat", ratePerTree: 0.20 },
  { id: "sr-004", species: "White Pine",   code: "PW", rateBucket: "", rateType: "flat", ratePerTree: 0.22 },
  { id: "sr-005", species: "Red Pine",     code: "PR", rateBucket: "", rateType: "flat", ratePerTree: 0.19 },
  { id: "sr-006", species: "Larch",        code: "LA", rateBucket: "", rateType: "flat", ratePerTree: 0.21 },
  { id: "sr-007", species: "Poplar",       code: "PP", rateBucket: "", rateType: "flat", ratePerTree: 0.14 },
  { id: "sr-008", species: "Other",        code: "OT", rateBucket: "", rateType: "flat", ratePerTree: 0.15 },
];

const EMPTY_SESSION: SessionForm = {
  date: todayStr(),
  crewBoss: "", project: "", block: "", camp: "", shift: "Day", notes: "",
  equipmentOnBlock: "", equipmentFuelLevel: "", vehicleFuelLevel: "",
  planForTomorrow: "", needsNotes: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmt(n: number) { return n.toLocaleString("en-CA"); }
function fmtC(n: number) {
  return "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function resolveRate(rate: SpeciesRate, trees: number, sessionTotal?: number): number {
  if (rate.rateType === "tiered" && rate.tierThreshold != null && rate.rateBelowThreshold != null && rate.rateAboveThreshold != null) {
    // Use session-level combined total when available (crew boss entry pricing)
    const checkTrees = sessionTotal ?? trees;
    return checkTrees < rate.tierThreshold ? rate.rateBelowThreshold : rate.rateAboveThreshold;
  }
  return rate.ratePerTree;
}

/** Sum trees per speciesId across all draft planters — used for session-level tiered pricing */
function sessionSpeciesTotals(planterList: { lines: { speciesId: string; trees: string }[] }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of planterList) {
    for (const l of p.lines) {
      if (!l.speciesId) continue;
      const t = parseInt(l.trees) || 0;
      map.set(l.speciesId, (map.get(l.speciesId) ?? 0) + t);
    }
  }
  return map;
}
function newLine(): DraftLine { return { id: uid(), speciesId: "", trees: "" }; }
function newDraftPlanter(): DraftPlanter {
  return { id: uid(), employeeId: "", employeeName: "", hoursWorked: "9", lines: [newLine()] };
}

type Tab = "entry" | "supervisor" | "daily" | "reconcile" | "quality" | "log" | "summary" | "rates" | "blocks" | "client" | "oversight" | "payroll" | "manual-changes";

interface QualityInfractions {
  openHole: number;
  tooDeep: number;
  multiples: number;
  droppedTrees: number;
  leaner: number;
  improperSpacing: number;
  tooShallow: number;
  tooLoose: number;
  poorSite: number;
  missedSpot: number;
  jRoot: number;
  other: number;
}

interface QualityPlot {
  id: string;
  date: string;
  project: string;
  block: string;
  plotNumber: string;
  surveyor: string;
  crewBoss: string;
  gpsLat?: string;
  gpsLng?: string;
  plantableSpots: number;
  treesPlanted: number;
  goodTrees: number;
  infractions: QualityInfractions;
  notes?: string;
  createdAt: string;
}

const INFRACTION_LABELS: Array<{ key: keyof QualityInfractions; label: string; code: string }> = [
  { key: "openHole",        label: "Open Hole",        code: "1" },
  { key: "tooDeep",         label: "Too Deep",         code: "2" },
  { key: "multiples",       label: "Multiples",        code: "3" },
  { key: "droppedTrees",    label: "Dropped Trees",    code: "4" },
  { key: "leaner",          label: "Leaner",           code: "5" },
  { key: "improperSpacing", label: "Improper Spacing", code: "6" },
  { key: "tooShallow",      label: "Too Shallow",      code: "7" },
  { key: "missedSpot",      label: "Missed Spot",      code: "8" },
  { key: "tooLoose",        label: "Too Loose",        code: "9" },
  { key: "poorSite",        label: "Poor Site",        code: "10" },
  { key: "jRoot",           label: "J-Root",           code: "11" },
  { key: "other",           label: "Other",            code: "12" },
];

const EMPTY_INFRACTIONS: QualityInfractions = {
  openHole: 0, tooDeep: 0, multiples: 0, droppedTrees: 0,
  leaner: 0, improperSpacing: 0, tooShallow: 0, tooLoose: 0,
  poorSite: 0, missedSpot: 0, jRoot: 0, other: 0,
};

interface SavedSession {
  id: string;
  name: string;
  savedAt: string;
  session: SessionForm;
  planters: DraftPlanter[];
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props { employees: Employee[]; userRole?: string; userName?: string }

export default function DailyProductionReport({ employees, userRole = "admin", userName = "" }: Props) {
  const isCrewBoss = userRole === "crew_boss";
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("entry");
  const [rates, setRates]     = useState<SpeciesRate[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [toast, setToast]     = useState<string | null>(null);

  // Entry tab
  const [session, setSession]   = useState<SessionForm>({ ...EMPTY_SESSION, crewBoss: isCrewBoss ? userName : "" });
  const [planters, setPlanters] = useState<DraftPlanter[]>([newDraftPlanter()]);
  const [saving, setSaving]     = useState(false);

  // Log / Summary shared filters
  const [dateFrom, setDateFrom]         = useState(todayStr());
  const [dateTo, setDateTo]             = useState(todayStr());
  const [crewFilter, setCrewFilter]     = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [planterFilter, setPlanterFilter] = useState("all");

  // Saved sessions (Save As / Open)
  const [savedSessions, setSavedSessions]     = useState<SavedSession[]>([]);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showOpenModal, setShowOpenModal]     = useState(false);
  const [saveAsName, setSaveAsName]           = useState("");

  // Inline cell editing (Daily Log)
  const [editingCell, setEditingCell] = useState<{
    entryId: string;
    field: "date" | "block" | "project" | "hoursWorked" | "trees";
    lineIdx?: number;
  } | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Export dropdown
  const [openExport, setOpenExport] = useState<"log" | "blocks" | "client" | null>(null);

  // Client Summary tab
  const [clientDateFrom, setClientDateFrom] = useState(todayStr());
  const [clientDateTo,   setClientDateTo]   = useState(todayStr());
  const [generateForDate, setGenerateForDate] = useState(todayStr());
  const [showGenerate, setShowGenerate] = useState(false);
  const [clientSelectedProjects, setClientSelectedProjects] = useState<Set<string>>(new Set());
  const [clientSelectedBlocks,   setClientSelectedBlocks]   = useState<Set<string>>(new Set());

  // Daily Summary tab
  const [nurseryLoads, setNurseryLoads]       = useState<NurseryLoad[]>([]);
  const [projectBlocks, setProjectBlocks]     = useState<ProjectBlock[]>([]);
  const [upcomingPlans, setUpcomingPlans]     = useState<UpcomingBlockPlan[]>([]);
  const [upcomingBlockSel, setUpcomingBlockSel] = useState("");
  const [upcomingCrew, setUpcomingCrew]       = useState("");
  const [upcomingNotes, setUpcomingNotes]     = useState("");
  const [dsDateFrom, setDsDateFrom]     = useState(todayStr());
  const [dsDateTo, setDsDateTo]         = useState(todayStr());

  // Delivery Planning state
  const [deliveryPlans, setDeliveryPlans]   = useState<DeliveryPlan[]>([]);
  const [dpDate, setDpDate]                 = useState(todayStr());
  const [dpBlock, setDpBlock]               = useState("");
  const [dpDriver, setDpDriver]             = useState("");
  const [dpTruck, setDpTruck]               = useState("");
  const [dpBlockNotes, setDpBlockNotes]     = useState("");
  const [dpNotes, setDpNotes]               = useState("");
  const [dpLines, setDpLines]               = useState<{ id: string; speciesId: string; boxes: string; treesPerBox: string }[]>(
    [{ id: uid(), speciesId: "", boxes: "", treesPerBox: "" }]
  );
  const [dpSaving, setDpSaving]             = useState(false);

  // Supervisor Entry tab
  const [deliveries, setDeliveries] = useState<SupervisorDelivery[]>([]);
  const [supDate, setSupDate]       = useState(todayStr());
  const [supProject, setSupProject] = useState("");
  const [supBlock, setSupBlock]     = useState("");
  const [supLoadNum, setSupLoadNum] = useState("");
  const [supBy, setSupBy]           = useState("");
  const [supNotes, setSupNotes]     = useState("");
  const [supLines, setSupLines]     = useState<{ id: string; speciesId: string; trees: string; boxes?: string }[]>(
    [{ id: uid(), speciesId: "", trees: "" }]
  );
  const [supSaving, setSupSaving]       = useState(false);
  const [supBlockFilter, setSupBlockFilter] = useState("all");
  const [editDeliveryId, setEditDeliveryId] = useState<string | null>(null);

  // Planter report modal
  const [reportPlanterKey, setReportPlanterKey] = useState<string | null>(null);

  // Payroll report
  interface PayrollSnapshot {
    type: "planter" | "crew" | "hourly";
    name: string; employeeNumber: string; role: string; crewBoss: string; period: string;
    // Earnings
    totalTrees: number; crewTrees?: number; planterCount?: number;
    earnings: number; vacPay: number; totalWithVac: number; days: number;
    speciesRows: { code: string; species: string; trees: number; earnings: number; ratePerTree: number }[];
    dailyLog: { date: string; block: string; project: string; trees: number; hours: number; earnings: number }[];
    // Hourly/crew-boss specific
    rateType?: string; rate?: number; quantity?: number;
    // Deductions
    campCosts: number; equipDeduction: number; other: number; gross: number;
    // Hours & compliance
    hours: number; hourlyEarned: number | null; topUp: number; ytd: number;
    // Overtime
    otHours: number; otPay: number | null; prevAvgHourly: number | null;
    // Statutory
    cpp: number; ei: number; incomeTax: number; net: number;
    // Allocation
    special: number; regular: number;
    // Additional
    additionalEarnings: number; notes: string;
  }
  const [payrollReport, setPayrollReport] = useState<PayrollSnapshot | null>(null);

  // Payroll tab — saved totals reports
  interface PayrollDoc { id: string; name: string; date_added: string; storage_path: string; employee: string; }
  const [payrollDocs, setPayrollDocs]         = useState<PayrollDoc[]>([]);
  const [payrollDocsLoaded, setPayrollDocsLoaded] = useState(false);

  // Block adjustments
  const [blockAdjustments, setBlockAdjustments] = useState<BlockAdjustment[]>([]);
  const [adjProject, setAdjProject] = useState("");
  const [adjBlock,   setAdjBlock]   = useState("");
  const [adjEdits,   setAdjEdits]   = useState<Record<string, string>>({});
  const [adjReason,  setAdjReason]  = useState("");
  const [viewProject, setViewProject] = useState("");
  const [blockTargets, setBlockTargets] = useState<Map<string, BlockTarget>>(new Map());

  // Expanded species breakdown rows in Planter Summary
  const [expandedPlanters, setExpandedPlanters] = useState<Set<string>>(new Set());

  // Supervisor Overview tab
  const [oversightDate, setOversightDate] = useState(todayStr());

  // Quality Reports tab
  const [qualityPlots, setQualityPlots]       = useState<QualityPlot[]>([]);
  const [qpDate, setQpDate]                   = useState(todayStr());
  const [qpProject, setQpProject]             = useState("");
  const [qpBlock, setQpBlock]                 = useState("");
  const [qpPlotNumber, setQpPlotNumber]       = useState("");
  const [qpSurveyor, setQpSurveyor]           = useState("");
  const [qpCrewBoss, setQpCrewBoss]           = useState("");
  const [qpGpsLat, setQpGpsLat]               = useState("");
  const [qpGpsLng, setQpGpsLng]               = useState("");
  const [qpPlantableSpots, setQpPlantableSpots] = useState<string>("");
  const [qpTreesPlanted, setQpTreesPlanted]     = useState<string>("");
  const [qpGoodTrees, setQpGoodTrees]           = useState<string>("");
  const [qpInfractions, setQpInfractions]     = useState<QualityInfractions>({ ...EMPTY_INFRACTIONS });
  const [qpNotes, setQpNotes]                 = useState("");
  const [qpEditingId, setQpEditingId]         = useState<string | null>(null);
  const [qpSaving, setQpSaving]               = useState(false);
  const [qpReportBlock, setQpReportBlock]     = useState<string>("all");
  const [qpReportDateFrom, setQpReportDateFrom] = useState("");
  const [qpReportDateTo, setQpReportDateTo]     = useState("");
  const [qpLogBlockFilter, setQpLogBlockFilter] = useState<string>("all");
  const [qpLogCrewFilter,  setQpLogCrewFilter]  = useState<string>("all");

  // Reconciliation tab
  const [reconcileTolerance, setReconcileTolerance] = useState<number>(3);
  const [reconcileProjectFilter, setReconcileProjectFilter] = useState<string>("all");
  const [reconcileShowOnlyVariance, setReconcileShowOnlyVariance] = useState<boolean>(false);
  const [reconcileExpanded, setReconcileExpanded] = useState<Set<string>>(new Set());
  const [reconcileClosedBlocks, setReconcileClosedBlocks] = useState<Set<string>>(new Set());
  function toggleBlockClosed(blockKey: string) {
    setReconcileClosedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockKey)) {
        next.delete(blockKey);
        deleteRecord("reconcile_closed_blocks", blockKey).catch(err => console.error("[reconcile] delete:", err));
      } else {
        next.add(blockKey);
        saveRecord("reconcile_closed_blocks", { id: blockKey }).catch(err => console.error("[reconcile] save:", err));
      }
      return next;
    });
  }

  // Camp cost rate ($/day per planter) — persisted to localStorage
  const [campCostRate, setCampCostRate] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const v = localStorage.getItem("campCostRate");
    return v ? parseFloat(v) : 0;
  });

  // Planter deductions (keyed by planter name, persisted in component state per session)
  const [planterDeds, setPlanterDeds] = useState<Record<string, {
    campCosts: string; equipDeduction: string; other: string;
    cpp: string; ei: string; incomeTax: string;
    additionalEarnings: string; notes: string;
  }>>({});

  // Crew Boss deductions (keyed by crew boss name)
  const [crewDeds, setCrewDeds] = useState<Record<string, {
    campCosts: string; equipDeduction: string; other: string; incomeTax: string; hours: string;
    additionalEarnings: string; notes: string;
  }>>({});

  // Hourly / Day Rate employees
  const [hourlyEmps, setHourlyEmps] = useState<{
    id: string; name: string; rateType: "hourly" | "dayrate";
    rate: string; quantity: string; hours: string;
    campCosts: string; equipDeduction: string; other: string; incomeTax: string;
    additionalEarnings: string; notes: string;
  }[]>([]);

  // Tree transfers
  const [transfers, setTransfers]       = useState<TreeTransfer[]>([]);
  const [xfrDate, setXfrDate]           = useState(todayStr());
  const [xfrFrom, setXfrFrom]           = useState("");
  const [xfrTo, setXfrTo]               = useState("");
  const [xfrNotes, setXfrNotes]         = useState("");
  const [xfrLines, setXfrLines]         = useState<{ id: string; speciesId: string; trees: string }[]>(
    [{ id: uid(), speciesId: "", trees: "" }]
  );
  const [xfrSaving, setXfrSaving]       = useState(false);

  // Crew Boss Entry Tree Transfer (separate form state)
  const [cbXfrDate, setCbXfrDate]       = useState(todayStr());
  const [cbXfrFrom, setCbXfrFrom]       = useState("");
  const [cbXfrTo, setCbXfrTo]           = useState("");
  const [cbXfrNotes, setCbXfrNotes]     = useState("");
  const [cbXfrLines, setCbXfrLines]     = useState<{ id: string; speciesId: string; trees: string }[]>(
    [{ id: uid(), speciesId: "", trees: "" }]
  );
  const [cbXfrSaving, setCbXfrSaving]   = useState(false);

  // Tree orders
  const [treeOrders, setTreeOrders]         = useState<TreeOrder[]>([]);
  const [orderLines, setOrderLines]         = useState<{ id: string; speciesId: string; quantity: string }[]>(
    [{ id: uid(), speciesId: "", quantity: "" }]
  );
  const [orderSaving, setOrderSaving]       = useState(false);

  // Rates tab
  const [showRateModal, setShowRateModal]   = useState(false);
  const [editingRateId, setEditingRateId]   = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<Omit<SpeciesRate, "id">>({
    species: "", code: "", rateBucket: "", rateType: "flat", ratePerTree: 0,
    tierThreshold: undefined, rateBelowThreshold: undefined, rateAboveThreshold: undefined, treesPerBox: undefined,
  });

  // ── Load from IndexedDB ────────────────────────────────────────────────

  // When crew boss userName resolves, lock the session crewBoss and trigger planter auto-populate
  useEffect(() => {
    if (isCrewBoss && userName) {
      handleCrewBossChange(userName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  useEffect(() => {
    // Migrate any locally-stored IndexedDB data to Supabase on first load.
    // On devices with no local data this is a fast no-op.
    migrateFromIndexedDB().catch(e => console.warn("[migrate]", e));

    getAllRecords<SpeciesRate>("species_rates").then(saved => {
      if (saved.length === 0) {
        INITIAL_RATES.forEach(r => saveRecord("species_rates", r));
        setRates(INITIAL_RATES);
      } else {
        setRates(saved.sort((a, b) => a.species.localeCompare(b.species)));
      }
    });
    getAllRecords<ProductionEntry>("production_entries").then(saved => {
      setEntries(saved.sort((a, b) => b.date.localeCompare(a.date)));
    });
    getAllRecords<SavedSession>("session_drafts").then(saved => {
      setSavedSessions(saved.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    });
    getSupervisorDeliveries().then(saved => {
      setDeliveries(saved.sort((a, b) => b.date.localeCompare(a.date)));
    });
    getAllRecords<NurseryLoad>("nursery_loads").then(saved => {
      setNurseryLoads(saved);
    });
    getAllRecords<ProjectBlock>("project_blocks").then(saved => {
      setProjectBlocks(saved);
    });
    getUpcomingBlockPlans().then(saved => {
      setUpcomingPlans(saved.sort((a, b) => a.sortOrder - b.sortOrder));
    });
    getDeliveryPlans().then(saved => {
      setDeliveryPlans(saved.sort((a, b) => a.planDate.localeCompare(b.planDate)));
    });
    getTreeOrders().then(saved => {
      setTreeOrders(saved.sort((a, b) => b.orderDate.localeCompare(a.orderDate)));
    });
    getTreeTransfers().then(saved => {
      setTransfers(saved.sort((a, b) => b.date.localeCompare(a.date)));
    });
    getAllBlockAdjustments().then(saved => {
      setBlockAdjustments(saved);
    });
    getAllBlockTargets().then(saved => {
      const map = new Map<string, BlockTarget>();
      for (const t of saved) map.set(t.id, t);
      setBlockTargets(map);
    });
    getAllRecords<QualityPlot>("quality_plots").then(saved => {
      setQualityPlots(saved.sort((a, b) => b.date.localeCompare(a.date)));
    });
    getAllRecords<{ id: string }>("reconcile_closed_blocks").then(saved => {
      const remote = new Set(saved.map(r => r.id));
      if (typeof window !== "undefined") {
        try {
          const localRaw = localStorage.getItem("reconcile_closed_blocks");
          if (localRaw) {
            const local = JSON.parse(localRaw) as string[];
            for (const b of local) {
              if (!remote.has(b)) {
                remote.add(b);
                saveRecord("reconcile_closed_blocks", { id: b }).catch(err => console.error("[reconcile] migrate:", err));
              }
            }
            localStorage.removeItem("reconcile_closed_blocks");
          }
        } catch { /* ignore */ }
      }
      setReconcileClosedBlocks(remote);
    });
  }, []);

  useEffect(() => {
    if (!openExport) return;
    function close() { setOpenExport(null); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openExport]);

  useEffect(() => {
    if (tab !== "payroll" || payrollDocsLoaded) return;
    fetch("/api/admin/employee-documents?employee=Payroll")
      .then(r => r.json())
      .then(data => {
        console.log("[PayrollTab] fetched docs:", data);
        if (Array.isArray(data)) setPayrollDocs(data as PayrollDoc[]);
        setPayrollDocsLoaded(true);
      })
      .catch(err => { console.error("[PayrollTab] fetch error:", err); setPayrollDocsLoaded(true); });
  }, [tab, payrollDocsLoaded]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Save As / Open ─────────────────────────────────────────────────────

  async function handleSaveAs() {
    if (!saveAsName.trim()) return;
    const draft: SavedSession = {
      id: `sd-${uid()}`,
      name: saveAsName.trim(),
      savedAt: new Date().toISOString(),
      session,
      planters,
    };
    await saveRecord("session_drafts", draft);
    setSavedSessions(prev => [draft, ...prev]);
    setShowSaveAsModal(false);
    setSaveAsName("");
    showToast(`Saved as "${draft.name}"`);
  }

  function handleOpenSession(draft: SavedSession) {
    setSession(draft.session);
    setPlanters(draft.planters);
    setShowOpenModal(false);
    showToast(`Loaded "${draft.name}"`);
  }

  async function handleDeleteSavedSession(id: string) {
    await deleteRecord("session_drafts", id);
    setSavedSessions(prev => prev.filter(s => s.id !== id));
  }

  // ── Export ─────────────────────────────────────────────────────────────

  function downloadCSV(rows: string[][], filename: string) {
    const csv = rows.map(r =>
      r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportLogCSV() {
    const headers = ["Date","Crew Boss","Planter","Project","Block","Camp","Shift","Species","Code","Trees","Hours"];
    const rows: string[][] = [headers];
    for (const e of filtered) {
      for (const l of e.production) {
        rows.push([e.date, e.crewBoss, e.employeeName, e.project, e.block, e.camp, e.shift,
          l.species, l.code, String(l.trees), ""]);
      }
      rows.push([e.date, e.crewBoss, e.employeeName, e.project, e.block, e.camp, e.shift,
        "TOTAL", "", String(e.totalTrees), String(e.hoursWorked)]);
    }
    downloadCSV(rows, `production-log-${dateFrom}-to-${dateTo}.csv`);
    setOpenExport(null);
  }

  function printLog() {
    const crews = [...new Set(filtered.map(e => e.crewBoss))].sort();
    let body = `<h1 style="font-size:16px;margin-bottom:4px">Daily Production Log</h1>
<p style="font-size:11px;color:#666;margin-bottom:16px">${dateFrom} – ${dateTo}</p>`;
    for (const crew of crews) {
      const ce = filtered.filter(e => e.crewBoss === crew);
      const ct = ce.reduce((s, e) => s + e.totalTrees, 0);
      body += `<h2 style="font-size:13px;margin:16px 0 6px">${crew} — ${fmt(ct)} trees</h2>
<table style="width:100%;border-collapse:collapse;font-size:11px">
<thead><tr style="background:#f3f4f6">${["Planter","Date","Block","Project","Species","Trees","Hrs"].map(h => `<th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e5e7eb">${h}</th>`).join("")}</tr></thead>
<tbody>`;
      for (const e of ce) {
        const sp = e.production.map(l => `${l.code} ${fmt(l.trees)}`).join(", ");
        body += `<tr><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${e.employeeName}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${e.date}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${e.block||"—"}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${e.project||"—"}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${sp}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${fmt(e.totalTrees)}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${e.hoursWorked}h</td></tr>`;
      }
      body += `</tbody></table>`;
    }
    openPrintWindow(body, `Production Log ${dateFrom} – ${dateTo}`);
    setOpenExport(null);
  }

  function exportBlockCSV() {
    const allSpeciesList = [...new Set(allBlockSummary.flatMap(b => [...b.species.keys()]))].sort();
    const headers = ["Block","Planters","Total Trees","Total Earnings",
      ...allSpeciesList.map(s => `${s} Trees`),
      ...allSpeciesList.map(s => `${s} Earnings ($)`)];
    const rows: string[][] = [headers];
    for (const b of allBlockSummary) {
      rows.push([
        b.block, String(b.planters.size), String(b.totalTrees), b.totalEarnings.toFixed(2),
        ...allSpeciesList.map(s => String(b.species.get(s)?.trees ?? 0)),
        ...allSpeciesList.map(s => (b.species.get(s)?.earnings ?? 0).toFixed(2)),
      ]);
    }
    downloadCSV(rows, `block-summary.csv`);
    setOpenExport(null);
  }

  // ── ADP Payroll Export ──────────────────────────────────────────────────
  function generateADPCSV() {
    function p(s: string) { return parseFloat(s) || 0; }
    const CREW_RATE = 0.02;
    const rows: string[][] = [
      ["Position ID", "Payment Type", "Earnings Code", "Earnings Amount", "Hours", "Deduction Code", "Deduction Amount"],
    ];

    function addEmployee(empId: string, regular: number, special: number, camp: number, equip: number) {
      rows.push([empId, "CPA", "1",  regular.toFixed(2), "", "", ""]);
      rows.push([empId, "CPA", "A0", special.toFixed(2), "", "", ""]);
      rows.push([empId, "CPA", "", "", "", "47", camp > 0 ? camp.toFixed(2) : ""]);
      rows.push([empId, "CPA", "", "", "", "48", equip > 0 ? equip.toFixed(2) : ""]);
    }

    // Planters
    for (const pl of planterSummary) {
      const empEnt = employees.find(e => e.name === pl.name);
      const empId  = empEnt?.employeeNumber ?? pl.name;
      const d      = planterDeds[pl.name] ?? { campCosts: "", equipDeduction: "", other: "", cpp: "", ei: "", incomeTax: "", additionalEarnings: "", notes: "" };
      const camp   = p(d.campCosts);
      const equip  = p(d.equipDeduction);
      const other  = p(d.other);
      const gross  = pl.totalWithVac - camp - equip - other;
      const cpp    = gross > 0 ? gross * 0.0595 : 0;
      const ei     = gross > 0 ? gross * 0.0166 : 0;
      const tax    = p(d.incomeTax);
      const addl   = p(d.additionalEarnings);
      const net    = gross + addl - cpp - ei - tax;
      addEmployee(empId, net * 0.75, net * 0.25, camp, equip);
    }

    // Crew Bosses
    for (const c of crewSummary) {
      const empEnt   = employees.find(e => e.name === c.crew);
      const empId    = empEnt?.employeeNumber ?? c.crew;
      const d        = crewDeds[c.crew] ?? { campCosts: "", equipDeduction: "", other: "", incomeTax: "", hours: "", additionalEarnings: "", notes: "" };
      const earnings = c.totalTrees * CREW_RATE;
      const camp     = p(d.campCosts);
      const equip    = p(d.equipDeduction);
      const other    = p(d.other);
      const gross    = earnings - camp - equip - other;
      const cpp      = gross > 0 ? gross * 0.0595 : 0;
      const ei       = gross > 0 ? gross * 0.0166 : 0;
      const tax      = p(d.incomeTax);
      const addl     = p(d.additionalEarnings);
      const net      = gross + addl - cpp - ei - tax;
      addEmployee(empId, net * 0.75, net * 0.25, camp, equip);
    }

    // Hourly / Day Rate
    for (const emp of hourlyEmps) {
      const empEnt  = employees.find(e => e.name === emp.name);
      const empId   = empEnt?.employeeNumber ?? emp.name;
      const earnings = p(emp.rate) * p(emp.quantity);
      const camp    = p(emp.campCosts);
      const equip   = p(emp.equipDeduction);
      const other   = p(emp.other);
      const gross   = earnings - camp - equip - other;
      const cpp     = gross > 0 ? gross * 0.0595 : 0;
      const ei      = gross > 0 ? gross * 0.0166 : 0;
      const tax     = p(emp.incomeTax);
      const addl    = p(emp.additionalEarnings);
      const net     = gross + addl - cpp - ei - tax;
      addEmployee(empId, net * 0.75, net * 0.25, camp, equip);
    }

    downloadCSV(rows, `ADP-payroll-${dateFrom}-to-${dateTo}.csv`);
    generatePayrollTotalsReport();
  }

  async function generatePayrollTotalsReport() {
    function p(s: string) { return parseFloat(s) || 0; }
    const CREW_RATE = 0.02;
    const period = dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`;
    const generated = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

    type Row = { name: string; empId: string; role: string; trees: number; gross: number; camp: number; equip: number; other: number; cpp: number; ei: number; tax: number; addl: number; net: number; };
    const empRows: Row[] = [];

    for (const pl of planterSummary) {
      const empEnt = employees.find(e => e.name === pl.name);
      const empId  = empEnt?.employeeNumber ?? "—";
      const d      = planterDeds[pl.name] ?? { campCosts: "", equipDeduction: "", other: "", cpp: "", ei: "", incomeTax: "", additionalEarnings: "", notes: "" };
      const camp   = p(d.campCosts); const equip = p(d.equipDeduction); const other = p(d.other);
      const gross  = pl.totalWithVac - camp - equip - other;
      const cpp    = gross > 0 ? gross * 0.0595 : 0;
      const ei     = gross > 0 ? gross * 0.0166 : 0;
      const tax    = p(d.incomeTax); const addl = p(d.additionalEarnings);
      empRows.push({ name: pl.name, empId, role: "Planter", trees: pl.totalTrees, gross: pl.totalWithVac, camp, equip, other, cpp, ei, tax, addl, net: gross + addl - cpp - ei - tax });
    }

    for (const c of crewSummary) {
      const empEnt   = employees.find(e => e.name === c.crew);
      const empId    = empEnt?.employeeNumber ?? "—";
      const d        = crewDeds[c.crew] ?? { campCosts: "", equipDeduction: "", other: "", incomeTax: "", hours: "", additionalEarnings: "", notes: "" };
      const earnings = c.totalTrees * CREW_RATE;
      const camp     = p(d.campCosts); const equip = p(d.equipDeduction); const other = p(d.other);
      const gross    = earnings - camp - equip - other;
      const cpp      = gross > 0 ? gross * 0.0595 : 0;
      const ei       = gross > 0 ? gross * 0.0166 : 0;
      const tax      = p(d.incomeTax); const addl = p(d.additionalEarnings);
      empRows.push({ name: c.crew, empId, role: "Crew Boss", trees: c.totalTrees, gross: earnings, camp, equip, other, cpp, ei, tax, addl, net: gross + addl - cpp - ei - tax });
    }

    for (const emp of hourlyEmps) {
      const empEnt  = employees.find(e => e.name === emp.name);
      const empId   = empEnt?.employeeNumber ?? "—";
      const earnings = p(emp.rate) * p(emp.quantity);
      const camp    = p(emp.campCosts); const equip = p(emp.equipDeduction); const other = p(emp.other);
      const gross   = earnings - camp - equip - other;
      const cpp     = gross > 0 ? gross * 0.0595 : 0;
      const ei      = gross > 0 ? gross * 0.0166 : 0;
      const tax     = p(emp.incomeTax); const addl = p(emp.additionalEarnings);
      empRows.push({ name: emp.name, empId, role: emp.rateType === "dayrate" ? "Day Rate" : "Hourly", trees: 0, gross: earnings, camp, equip, other, cpp, ei, tax, addl, net: gross + addl - cpp - ei - tax });
    }

    const totGross = empRows.reduce((s, r) => s + r.gross, 0);
    const totCamp  = empRows.reduce((s, r) => s + r.camp, 0);
    const totEquip = empRows.reduce((s, r) => s + r.equip, 0);
    const totOther = empRows.reduce((s, r) => s + r.other, 0);
    const totCpp   = empRows.reduce((s, r) => s + r.cpp, 0);
    const totEi    = empRows.reduce((s, r) => s + r.ei, 0);
    const totTax   = empRows.reduce((s, r) => s + r.tax, 0);
    const totAddl  = empRows.reduce((s, r) => s + r.addl, 0);
    const totNet   = empRows.reduce((s, r) => s + r.net, 0);

    const tdStyle = `padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;`;
    const thStyle = `padding:6px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb;background:#f9fafb;`;
    const cols = ["Employee","ID","Role","Trees","Gross","Camp","Equip","Other","CPP","EI","Tax","Addl","Net Pay"];

    const bodyRows = empRows.map(r => `<tr>
      <td style="${tdStyle}">${r.name}</td>
      <td style="${tdStyle};font-family:monospace">${r.empId}</td>
      <td style="${tdStyle};color:#6b7280">${r.role}</td>
      <td style="${tdStyle};text-align:right">${r.trees > 0 ? fmt(r.trees) : "—"}</td>
      <td style="${tdStyle};text-align:right">${fmtC(r.gross)}</td>
      <td style="${tdStyle};text-align:right;color:${r.camp > 0 ? "#dc2626" : "#9ca3af"}">${r.camp > 0 ? fmtC(r.camp) : "—"}</td>
      <td style="${tdStyle};text-align:right;color:${r.equip > 0 ? "#dc2626" : "#9ca3af"}">${r.equip > 0 ? fmtC(r.equip) : "—"}</td>
      <td style="${tdStyle};text-align:right;color:${r.other > 0 ? "#dc2626" : "#9ca3af"}">${r.other > 0 ? fmtC(r.other) : "—"}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(r.cpp)}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(r.ei)}</td>
      <td style="${tdStyle};text-align:right;color:${r.tax > 0 ? "#dc2626" : "#9ca3af"}">${r.tax > 0 ? fmtC(r.tax) : "—"}</td>
      <td style="${tdStyle};text-align:right;color:${r.addl > 0 ? "#16a34a" : "#9ca3af"}">${r.addl > 0 ? fmtC(r.addl) : "—"}</td>
      <td style="${tdStyle};text-align:right;font-weight:700">${fmtC(r.net)}</td>
    </tr>`).join("");

    const totalRow = `<tr style="background:#f0fdf4;font-weight:700">
      <td style="${tdStyle}" colspan="4">TOTALS (${empRows.length} employees)</td>
      <td style="${tdStyle};text-align:right">${fmtC(totGross)}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(totCamp)}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(totEquip)}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(totOther)}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(totCpp)}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(totEi)}</td>
      <td style="${tdStyle};text-align:right;color:#dc2626">${fmtC(totTax)}</td>
      <td style="${tdStyle};text-align:right;color:#16a34a">${fmtC(totAddl)}</td>
      <td style="${tdStyle};text-align:right;font-size:13px;color:#14532d">${fmtC(totNet)}</td>
    </tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payroll Totals – ${period}</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#111;background:#fff}@media print{body{padding:20px}@page{margin:16mm 14mm}}</style>
</head><body>
<div style="max-width:1100px;margin:0 auto">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:16px;border-bottom:3px solid #14532d">
    <div>
      <div style="font-size:18px;font-weight:800;color:#14532d">Integrity Reforestation Inc.</div>
      <div style="font-size:11px;color:#6b7280;margin-top:3px">Payroll Totals Report</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;font-weight:700;color:#14532d;background:#f0fdf4;border:1px solid #bbf7d0;padding:4px 12px;border-radius:6px;display:inline-block;margin-bottom:6px">Pay Period: ${period}</div>
      <div style="font-size:10px;color:#9ca3af">Generated ${generated}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px"><div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4ade80;margin-bottom:4px">Employees</div><div style="font-size:24px;font-weight:800;color:#14532d">${empRows.length}</div></div>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px"><div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4ade80;margin-bottom:4px">Total Gross</div><div style="font-size:24px;font-weight:800;color:#14532d">${fmtC(totGross)}</div></div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px"><div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f87171;margin-bottom:4px">Total Deductions</div><div style="font-size:24px;font-weight:800;color:#dc2626">${fmtC(totCamp+totEquip+totOther+totCpp+totEi+totTax)}</div></div>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 16px"><div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4ade80;margin-bottom:4px">Total Net Pay</div><div style="font-size:24px;font-weight:800;color:#14532d">${fmtC(totNet)}</div></div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>${cols.map(h => `<th style="${thStyle}">${h}</th>`).join("")}</tr></thead>
    <tbody>${bodyRows}${totalRow}</tbody>
  </table>
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
    <span>Integrity Reforestation Inc. · Confidential Payroll Document</span>
    <span>Generated ${generated}</span>
  </div>
</div></body></html>`;

    const fileName = `Payroll_Totals_${period.replace(/\s/g,"_")}.html`;
    const sizeKb   = Math.ceil(new Blob([html]).size / 1024);

    console.log("[PayrollReport] starting save, rows:", empRows.length, "dateTo:", dateTo);
    try {
      const payload = {
        html, fileName, crewBoss: "Payroll", date: dateTo,
        sizeKb, category: "other",
        storagePath: `payroll-reports/${Date.now()}-payroll-${dateTo}.html`,
      };
      console.log("[PayrollReport] POST payload keys:", Object.keys(payload), "html length:", html.length);
      const res = await fetch("/api/admin/save-production-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("[PayrollReport] response status:", res.status);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[PayrollReport] save error:", body);
        showToast(`Save failed: ${body.error ?? res.status}`);
        return;
      }
      const result = await res.json();
      console.log("[PayrollReport] saved ok:", result);
      showToast("Payroll totals report saved");
      setPayrollDocsLoaded(false);
    } catch (err) {
      console.error("[PayrollReport] fetch threw:", err);
      showToast(`Save failed: ${err instanceof Error ? err.message : "network error"}`);
    }
  }

  function printBlockSummary() {
    let body = `<h1 style="font-size:16px;margin-bottom:16px">Block Summary</h1>`;
    for (const b of allBlockSummary) {
      const speciesRows = [...b.species.entries()].sort((a, bv) => bv[1].trees - a[1].trees);
      body += `<h2 style="font-size:13px;margin:16px 0 6px">${b.block} — ${b.planters.size} planters · ${fmt(b.totalTrees)} trees · ${fmtC(b.totalEarnings)}</h2>
<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
<thead><tr style="background:#f3f4f6">${["Species","Code","Trees","Earnings"].map(h => `<th style="padding:4px 8px;text-align:left;border-bottom:1px solid #e5e7eb">${h}</th>`).join("")}</tr></thead>
<tbody>`;
      for (const [species, s] of speciesRows) {
        body += `<tr><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${species}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;font-family:monospace">${s.code}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${fmt(s.trees)}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;text-align:right">${fmtC(s.earnings)}</td></tr>`;
      }
      body += `<tr style="font-weight:600;background:#f9fafb"><td colspan="2" style="padding:4px 8px">Total</td><td style="padding:4px 8px;text-align:right">${fmt(b.totalTrees)}</td><td style="padding:4px 8px;text-align:right">${fmtC(b.totalEarnings)}</td></tr></tbody></table>`;
    }
    openPrintWindow(body, "Block Summary");
    setOpenExport(null);
  }

  function buildClientBlocks(forDate?: string) {
    if (forDate) {
      type CrewBreakdown = { totalTrees: number; planters: Set<string>; species: Map<string, { code: string; trees: number }> };
      const map = new Map<string, { project: string; block: string; totalTrees: number; planters: Set<string>; dates: Set<string>; species: Map<string, { code: string; trees: number }>; crews: Map<string, CrewBreakdown> }>();
      for (const e of entries) {
        if (e.date !== forDate) continue;
        const proj = e.project || "(No Project)";
        const blk  = e.block   || "(No Block)";
        const key  = `${proj}|${blk}`;
        if (!map.has(key)) map.set(key, { project: proj, block: blk, totalTrees: 0, planters: new Set(), dates: new Set(), species: new Map(), crews: new Map() });
        const rec = map.get(key)!;
        rec.totalTrees += e.totalTrees;
        rec.planters.add(e.employeeId || e.employeeName);
        rec.dates.add(e.date);
        for (const l of e.production) {
          const s = rec.species.get(l.species) ?? { code: l.code, trees: 0 };
          s.trees += l.trees;
          rec.species.set(l.species, s);
        }
        const crewName = (e.crewBoss || "").trim() || "(No Crew)";
        const crew = rec.crews.get(crewName) ?? { totalTrees: 0, planters: new Set<string>(), species: new Map<string, { code: string; trees: number }>() };
        crew.totalTrees += e.totalTrees;
        crew.planters.add(e.employeeId || e.employeeName);
        for (const l of e.production) {
          const cs = crew.species.get(l.species) ?? { code: l.code, trees: 0 };
          cs.trees += l.trees;
          crew.species.set(l.species, cs);
        }
        rec.crews.set(crewName, crew);
      }
      return [...map.values()].sort((a, b) => (a.project + a.block).localeCompare(b.project + b.block));
    }
    return clientBlockSummary.filter(b =>
      (clientSelectedProjects.size === 0 || clientSelectedProjects.has(b.project)) &&
      (clientSelectedBlocks.size === 0   || clientSelectedBlocks.has(`${b.project}|${b.block}`))
    );
  }

  function printClientSummary(forDate?: string) {
    const logoUrl = `${window.location.origin}/integrity-logo.png`;
    const blocks = buildClientBlocks(forDate);
    const totalTrees = blocks.reduce((s, b) => s + b.totalTrees, 0);
    const allDates   = [...new Set(blocks.flatMap(b => [...b.dates]))].sort();
    const dateLabel  = forDate
      ? forDate
      : clientDateFrom === clientDateTo
        ? clientDateFrom
        : `${clientDateFrom} — ${clientDateTo}`;

    const blockRows = blocks.map(b => {
      const speciesRows = [...b.species.entries()].sort((a, bv) => bv[1].trees - a[1].trees);
      const chips = speciesRows.map(([species, s]) => `
        <div style="display:inline-flex;flex-direction:column;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;min-width:90px;margin:4px">
          <span style="font-family:monospace;font-size:11px;font-weight:700;color:#166534;margin-bottom:4px">${s.code}</span>
          <span style="font-size:18px;font-weight:800;color:#14532d;line-height:1">${fmt(s.trees)}</span>
          <span style="font-size:10px;color:#4ade80;margin-top:3px">${species}</span>
        </div>`).join("");
      const totalChip = `
        <div style="display:inline-flex;flex-direction:column;background:#14532d;border-radius:10px;padding:10px 14px;min-width:90px;margin:4px">
          <span style="font-size:10px;font-weight:700;color:#4ade80;letter-spacing:.08em;margin-bottom:4px">TOTAL</span>
          <span style="font-size:18px;font-weight:800;color:#ffffff;line-height:1">${fmt(b.totalTrees)}</span>
          <span style="font-size:10px;color:#86efac;margin-top:3px">${b.planters.size} planter${b.planters.size !== 1 ? "s" : ""}</span>
        </div>`;

      const crewRows = [...b.crews.entries()].sort((a, bv) => bv[1].totalTrees - a[1].totalTrees);
      const crewSection = crewRows.length === 0 ? "" : `
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #dcfce7">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:#4ade80;text-transform:uppercase;margin-bottom:8px">By Crew</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
              <tr style="background:#f0fdf4;color:#166534">
                <th style="text-align:left;padding:6px 8px;font-weight:700;border-bottom:1px solid #bbf7d0">Crew Boss</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700;border-bottom:1px solid #bbf7d0">Planters</th>
                <th style="text-align:right;padding:6px 8px;font-weight:700;border-bottom:1px solid #bbf7d0">Total Trees</th>
                <th style="text-align:left;padding:6px 8px;font-weight:700;border-bottom:1px solid #bbf7d0">By Species</th>
              </tr>
            </thead>
            <tbody>
              ${crewRows.map(([crewName, c]) => {
                const cs = [...c.species.entries()].sort((a, bv) => bv[1].trees - a[1].trees);
                const speciesText = cs.map(([, ss]) => `<span style="font-family:monospace"><b>${ss.code}</b> ${fmt(ss.trees)}</span>`).join(" &nbsp; ");
                return `
                  <tr style="border-bottom:1px solid #f0fdf4">
                    <td style="padding:6px 8px;color:#111827;font-weight:600">${crewName}</td>
                    <td style="padding:6px 8px;text-align:right;color:#374151;font-variant-numeric:tabular-nums">${c.planters.size}</td>
                    <td style="padding:6px 8px;text-align:right;color:#14532d;font-weight:700;font-variant-numeric:tabular-nums">${fmt(c.totalTrees)}</td>
                    <td style="padding:6px 8px;color:#4b5563">${speciesText}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;

      return `
        <div style="margin-bottom:28px;page-break-inside:avoid">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #dcfce7">
            <div style="background:#14532d;color:#4ade80;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:.06em">${b.block}</div>
            <div style="font-size:12px;color:#6b7280">${b.planters.size} planter${b.planters.size !== 1 ? "s" : ""} · ${fmt(b.totalTrees)} trees · ${[...b.dates].sort().join(", ")}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:0">${chips}${totalChip}</div>
          ${crewSection}
        </div>`;
    }).join("");

    const body = `
      <div style="max-width:900px;margin:0 auto">
        <!-- Header -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #14532d">
          <div style="display:flex;align-items:center;gap:16px">
            <img src="${logoUrl}" alt="Integrity Reforestation" style="height:60px;width:auto;object-fit:contain" />
            <div>
              <div style="font-size:18px;font-weight:800;color:#14532d;letter-spacing:-.02em">Integrity Reforestation Inc.</div>
              <div style="font-size:11px;color:#6b7280;margin-top:3px">integrity-reforestation.com</div>
              <div style="font-size:10px;color:#9ca3af;margin-top:2px">info@integrity-reforestation.com</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:#4ade80;text-transform:uppercase;background:#14532d;padding:4px 10px;border-radius:6px;margin-bottom:8px;display:inline-block">Client Production Summary</div>
            <div style="font-size:12px;color:#374151;font-weight:600">${dateLabel}</div>
            <div style="font-size:10px;color:#9ca3af;margin-top:3px">Generated ${new Date().toLocaleDateString("en-CA", { year:"numeric", month:"long", day:"numeric" })}</div>
          </div>
        </div>

        <!-- KPI strip -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:#4ade80;text-transform:uppercase;margin-bottom:4px">Blocks Reported</div>
            <div style="font-size:28px;font-weight:800;color:#14532d">${blocks.length}</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:#4ade80;text-transform:uppercase;margin-bottom:4px">Total Trees Planted</div>
            <div style="font-size:28px;font-weight:800;color:#14532d">${fmt(totalTrees)}</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px">
            <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:#4ade80;text-transform:uppercase;margin-bottom:4px">Days of Production</div>
            <div style="font-size:28px;font-weight:800;color:#14532d">${allDates.length}</div>
          </div>
        </div>

        <!-- Block-by-block -->
        <div style="font-size:13px;font-weight:700;color:#14532d;margin-bottom:16px;text-transform:uppercase;letter-spacing:.08em">Block Breakdown</div>
        ${blockRows || `<div style="color:#9ca3af;font-size:12px;padding:24px 0">No blocks match the selected filters.</div>`}

        <!-- Footer -->
        <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:10px;color:#9ca3af">Integrity Reforestation Inc. · Confidential Client Report</div>
          <div style="font-size:10px;color:#9ca3af">This report contains tree planting production data only. Pricing information is not included.</div>
        </div>
      </div>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Client Production Summary – ${dateLabel}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #111; background: #fff; }
  @media print {
    body { padding: 20px; }
    @page { margin: 16mm 14mm; }
  }
</style>
</head><body>${body}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
    setOpenExport(null);
  }

  function openPrintWindow(body: string, title: string) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}@media print{body{padding:0}}</style>
</head><body>${body}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  // ── Entry helpers ──────────────────────────────────────────────────────

  function handleCrewBossChange(name: string) {
    setSession(s => ({ ...s, crewBoss: name }));
    const trimmed = name.trim().toLowerCase();

    // Clear to single blank planter when crew boss is erased
    if (!trimmed) {
      setPlanters([newDraftPlanter()]);
      return;
    }

    const crewPlanters = employees.filter(e =>
      e.crewBoss?.trim().toLowerCase() === trimmed
    );

    if (crewPlanters.length === 0) return;

    // Only auto-populate if all current planters are still blank
    const allBlank = planters.every(p => !p.employeeId && p.lines.every(l => !l.speciesId && !l.trees));
    if (!allBlank) return;

    setPlanters(crewPlanters.map(emp => ({
      id: uid(),
      employeeId: emp.id,
      employeeName: emp.name,
      hoursWorked: "9",
      lines: [newLine()],
    })));
  }

  function updatePlanter(id: string, patch: Partial<DraftPlanter>) {
    setPlanters(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  function updateLine(planterId: string, lineId: string, patch: Partial<DraftLine>) {
    setPlanters(prev => prev.map(p =>
      p.id !== planterId ? p : { ...p, lines: p.lines.map(l => l.id === lineId ? { ...l, ...patch } : l) }
    ));
  }

  function planterCalc(p: DraftPlanter, sst?: Map<string, number>) {
    let totalTrees = 0, totalEarnings = 0;
    for (const l of p.lines) {
      const rate = rates.find(r => r.id === l.speciesId);
      const trees = parseInt(l.trees) || 0;
      totalTrees    += trees;
      totalEarnings += rate ? trees * resolveRate(rate, trees, sst?.get(rate.id)) : 0;
    }
    const vacPay = totalEarnings * 0.04;
    return { totalTrees, totalEarnings, vacPay, totalWithVac: totalEarnings };
  }

  async function handleSaveSession() {
    if (!session.date || !session.crewBoss) return;
    setSaving(true);
    const newEntries: ProductionEntry[] = [];
    const sst = sessionSpeciesTotals(planters);

    for (const p of planters) {
      if (!p.employeeId && !p.employeeName.trim()) continue;
      const production: ProductionLine[] = p.lines
        .map(l => {
          const rate = rates.find(r => r.id === l.speciesId);
          const trees = parseInt(l.trees) || 0;
          if (!rate || trees === 0) return null;
          const rpt = resolveRate(rate, trees, sst.get(rate.id));
          return {
            speciesId: rate.id, species: rate.species, code: rate.code,
            trees, rateBucket: rate.rateBucket,
            ratePerTree: rpt, earnings: trees * rpt,
          };
        })
        .filter(Boolean) as ProductionLine[];

      if (production.length === 0) continue;

      const totalTrees    = production.reduce((s, l) => s + l.trees, 0);
      const totalEarnings = production.reduce((s, l) => s + l.earnings, 0);
      const vacPay        = totalEarnings * 0.04;
      const entry: ProductionEntry = {
        id: `pe-${uid()}`,
        ...session,
        employeeId: p.employeeId,
        employeeName: p.employeeName,
        role: employees.find(e => e.id === p.employeeId)?.role ?? "Tree Planter",
        production,
        totalTrees,
        totalEarnings,
        avgPricePerTree: totalTrees > 0 ? totalEarnings / totalTrees : 0,
        hoursWorked: parseFloat(p.hoursWorked) || 9,
        vacPay,
        totalWithVac: totalEarnings,
      };
      await saveRecord("production_entries", entry);
      newEntries.push(entry);
    }

    setEntries(prev => [...newEntries, ...prev]);
    setPlanters([newDraftPlanter()]);
    // Keep date/crew/project/camp for next session, clear block/notes
    setSession(s => ({ ...s, block: "", notes: "" }));
    setSaving(false);
    showToast(`Saved ${newEntries.length} entr${newEntries.length !== 1 ? "ies" : "y"}`);
    if (newEntries.length > 0) {
      setDateFrom(session.date);
      setDateTo(session.date);
      setTab("log");
      await generateCrewBossReport(session, newEntries);
    }
  }

  async function generateCrewBossReport(sess: SessionForm, entries: ProductionEntry[]) {
    const crewBossSlug = sess.crewBoss.replace(/\s+/g, "_");
    const fileName = `Production_Report_${crewBossSlug}_${sess.date}.html`;

    const fmtC = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
    const fmt  = (n: number) => n.toLocaleString();

    const crewTotal = entries.reduce((s, e) => s + e.totalTrees, 0);
    const crewEarnings = entries.reduce((s, e) => s + e.totalEarnings, 0);

    const thS = `padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#9ca3af;border-bottom:1px solid #e5e7eb;background:#f9fafb`;
    const thR = thS + ";text-align:right";

    const planterRows = entries.map(e => {
      const specChips = e.production.map(l =>
        `<span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;font-family:monospace;color:#166534;margin:1px">${l.code} ${fmt(l.trees)}</span>`
      ).join(" ");
      return `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:8px 10px;font-weight:600;color:#111827">${e.employeeName}</td>
        <td style="padding:8px 10px">${specChips}</td>
        <td style="padding:8px 10px;text-align:right;font-weight:700;color:#111827">${fmt(e.totalTrees)}</td>
        <td style="padding:8px 10px;text-align:right;color:#6b7280">${e.hoursWorked}h</td>
        <td style="padding:8px 10px;text-align:right;font-weight:600;color:#111827">${fmtC(e.totalEarnings)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${fileName.replace(".html", "")}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#111827; background:#fff; padding:40px 48px; max-width:860px; margin:0 auto; }
  @media print { body { padding:0; max-width:100%; } @page { margin:16mm 14mm; } }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:24px; }
  .footer { margin-top:32px; padding-top:14px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:9px; color:#9ca3af; }
</style>
</head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #111827;margin-bottom:28px">
  <div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;color:#9ca3af;margin-bottom:6px">Daily Production Report</div>
    <div style="font-size:28px;font-weight:900;letter-spacing:-.5px;color:#111827">${sess.crewBoss}</div>
    <div style="margin-top:8px;font-size:12px;color:#6b7280">
      Date: <strong style="color:#374151">${sess.date}</strong>
      ${sess.block ? `&nbsp;&nbsp;·&nbsp;&nbsp;Block: <strong style="color:#374151">${sess.block}</strong>` : ""}
      ${sess.project ? `&nbsp;&nbsp;·&nbsp;&nbsp;Project: <strong style="color:#374151">${sess.project}</strong>` : ""}
      ${sess.camp ? `&nbsp;&nbsp;·&nbsp;&nbsp;Camp: <strong style="color:#374151">${sess.camp}</strong>` : ""}
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;font-weight:700;color:#9ca3af">Integrity Reforestation</div>
    <div style="font-size:10px;color:#9ca3af;margin-top:3px">Generated ${new Date().toLocaleDateString("en-CA")}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px">
  <div style="border-radius:10px;padding:14px 16px;background:#111827;border:1px solid #111827">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:#6b7280;margin-bottom:4px">Total Trees</div>
    <div style="font-size:20px;font-weight:900;color:#fff">${fmt(crewTotal)}</div>
  </div>
  <div style="border-radius:10px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:#9ca3af;margin-bottom:4px">Crew Earnings</div>
    <div style="font-size:20px;font-weight:900;color:#111827">${fmtC(crewEarnings)}</div>
  </div>
  <div style="border-radius:10px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:#9ca3af;margin-bottom:4px">Planters</div>
    <div style="font-size:20px;font-weight:900;color:#111827">${entries.length}</div>
  </div>
</div>

<div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;font-weight:700;color:#9ca3af;margin-bottom:10px">Planter Production</div>
<table>
  <thead><tr>
    <th style="${thS}">Planter</th>
    <th style="${thS}">Species</th>
    <th style="${thR}">Trees</th>
    <th style="${thR}">Hours</th>
    <th style="${thR}">Earnings</th>
  </tr></thead>
  <tbody>${planterRows}</tbody>
  <tfoot><tr style="background:#f9fafb;border-top:2px solid #d1d5db;font-weight:700">
    <td colspan="2" style="padding:8px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280">Crew Total — ${entries.length} planters</td>
    <td style="padding:8px 10px;text-align:right">${fmt(crewTotal)}</td>
    <td style="padding:8px 10px;text-align:right;color:#6b7280">—</td>
    <td style="padding:8px 10px;text-align:right">${fmtC(crewEarnings)}</td>
  </tr></tfoot>
</table>

${sess.notes ? `<div style="margin-bottom:24px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;font-weight:700;color:#9ca3af;margin-bottom:8px">Notes</div><div style="font-size:12px;color:#374151;padding:10px 14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">${sess.notes}</div></div>` : ""}
${sess.planForTomorrow ? `<div style="margin-bottom:24px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;font-weight:700;color:#9ca3af;margin-bottom:8px">Plan for Tomorrow</div><div style="font-size:12px;color:#374151;padding:10px 14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">${sess.planForTomorrow}</div></div>` : ""}

<div class="footer">
  <span>Integrity Reforestation · Daily Production Report</span>
  <span>${sess.crewBoss} · ${sess.date}</span>
</div>

</body></html>`;

    // ── Auto-open print window ──────────────────────────────────────────────
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
    }

    // ── Save copy to Documents via server route (uses service role, bypasses RLS) ──
    try {
      const sizeKb = (new Blob([html]).size / 1024).toFixed(1);
      const res = await fetch("/api/admin/save-production-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          fileName: fileName.replace(".html", ""),
          crewBoss: sess.crewBoss,
          date: sess.date,
          sizeKb,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(`Documents save failed: ${data.error ?? res.statusText}`);
      } else {
        showToast(`Report saved to ${sess.crewBoss}'s Documents`);
      }
    } catch (e) {
      showToast(`Documents save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function deleteEntry(id: string) {
    await deleteRecord("production_entries", id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  // ── Quality Reports helpers ─────────────────────────────────────────────
  function resetQualityForm() {
    setQpDate(todayStr());
    setQpPlotNumber("");
    setQpPlantableSpots("");
    setQpTreesPlanted("");
    setQpGoodTrees("");
    setQpInfractions({ ...EMPTY_INFRACTIONS });
    setQpGpsLat("");
    setQpGpsLng("");
    setQpNotes("");
    setQpEditingId(null);
  }

  async function saveQualityPlot() {
    const planted = parseInt(qpTreesPlanted) || 0;
    const good = parseInt(qpGoodTrees) || 0;
    if (!qpBlock.trim()) { alert("Block is required."); return; }
    if (!qpCrewBoss.trim()) { alert("Crew boss is required."); return; }
    if (planted <= 0) { alert("Trees Planted must be greater than 0."); return; }
    if (good > planted) { alert("Good Trees cannot exceed Trees Planted."); return; }
    const missed = qpInfractions.missedSpot || 0;
    const plantable = parseInt(qpPlantableSpots) || (planted + missed);
    setQpSaving(true);
    try {
      const existing = qpEditingId ? qualityPlots.find(p => p.id === qpEditingId) : null;
      const plot: QualityPlot = {
        id: qpEditingId ?? uid(),
        date: qpDate,
        project: qpProject.trim(),
        block: qpBlock.trim(),
        plotNumber: qpPlotNumber.trim(),
        surveyor: qpSurveyor.trim(),
        crewBoss: qpCrewBoss.trim(),
        gpsLat: qpGpsLat.trim() || undefined,
        gpsLng: qpGpsLng.trim() || undefined,
        plantableSpots: plantable,
        treesPlanted: planted,
        goodTrees: good,
        infractions: { ...qpInfractions },
        notes: qpNotes.trim() || undefined,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await saveRecord("quality_plots", plot);
      setQualityPlots(prev => {
        const idx = prev.findIndex(p => p.id === plot.id);
        const next = idx >= 0 ? prev.map((p, i) => i === idx ? plot : p) : [plot, ...prev];
        return next.sort((a, b) => b.date.localeCompare(a.date));
      });
      resetQualityForm();
    } catch (err) {
      console.error("[quality] save:", err);
      alert("Failed to save plot.");
    } finally {
      setQpSaving(false);
    }
  }

  function editQualityPlot(p: QualityPlot) {
    setQpEditingId(p.id);
    setQpDate(p.date);
    setQpProject(p.project);
    setQpBlock(p.block);
    setQpPlotNumber(p.plotNumber);
    setQpSurveyor(p.surveyor);
    setQpCrewBoss(p.crewBoss);
    setQpGpsLat(p.gpsLat ?? "");
    setQpGpsLng(p.gpsLng ?? "");
    setQpPlantableSpots(String(p.plantableSpots));
    setQpTreesPlanted(String(p.treesPlanted));
    setQpGoodTrees(String(p.goodTrees));
    setQpInfractions({ ...EMPTY_INFRACTIONS, ...p.infractions });
    setQpNotes(p.notes ?? "");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteQualityPlot(id: string) {
    if (!confirm("Delete this quality plot?")) return;
    await deleteRecord("quality_plots", id);
    setQualityPlots(prev => prev.filter(p => p.id !== id));
    if (qpEditingId === id) resetQualityForm();
  }

  function generateQualityReport() {
    const filtered = qualityPlots.filter(p =>
      (qpReportBlock === "all" || p.block === qpReportBlock) &&
      (!qpReportDateFrom || p.date >= qpReportDateFrom) &&
      (!qpReportDateTo   || p.date <= qpReportDateTo)
    );
    if (filtered.length === 0) {
      alert("No plots match the selected filters.");
      return;
    }
    const logoUrl = `${window.location.origin}/integrity-logo.png`;

    const byBlock = new Map<string, QualityPlot[]>();
    for (const p of filtered) {
      if (!byBlock.has(p.block)) byBlock.set(p.block, []);
      byBlock.get(p.block)!.push(p);
    }
    const blocks = [...byBlock.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const totalPlanted   = filtered.reduce((s, p) => s + p.treesPlanted, 0);
    const totalGood      = filtered.reduce((s, p) => s + p.goodTrees, 0);
    const totalPlantable = filtered.reduce((s, p) => s + p.plantableSpots, 0);
    const overallQ = totalPlanted > 0 ? (totalGood / totalPlanted) * 100 : 0;
    const overallS = totalPlantable > 0 ? (totalGood / totalPlantable) * 100 : 0;
    const avgDensity = filtered.length > 0 ? Math.round((totalGood * 200) / filtered.length) : 0;

    const dates = filtered.map(p => p.date).sort();
    const dateFrom = qpReportDateFrom || dates[0];
    const dateTo   = qpReportDateTo   || dates[dates.length - 1];
    const project = [...new Set(filtered.map(p => p.project).filter(Boolean))].join(", ") || "—";

    const blockSummaryRows = blocks.map(([block, plots]) => {
      const tPlanted   = plots.reduce((s, p) => s + p.treesPlanted, 0);
      const tGood      = plots.reduce((s, p) => s + p.goodTrees, 0);
      const tPlantable = plots.reduce((s, p) => s + p.plantableSpots, 0);
      const q = tPlanted > 0 ? (tGood / tPlanted) * 100 : 0;
      const ss = tPlantable > 0 ? (tGood / tPlantable) * 100 : 0;
      const d = plots.length > 0 ? Math.round((tGood * 200) / plots.length) : 0;
      return `<tr>
        <td><b>${block}</b></td>
        <td class="r">${plots.length}</td>
        <td class="r">${fmt(tPlanted)}</td>
        <td class="r">${fmt(tGood)}</td>
        <td class="r"><b>${q.toFixed(1)}%</b></td>
        <td class="r">${ss.toFixed(1)}%</td>
        <td class="r">${fmt(d)}</td>
      </tr>`;
    }).join("");

    const blockSections = blocks.map(([block, plots]) => {
      const tPlanted   = plots.reduce((s, p) => s + p.treesPlanted, 0);
      const tGood      = plots.reduce((s, p) => s + p.goodTrees, 0);
      const tPlantable = plots.reduce((s, p) => s + p.plantableSpots, 0);
      const q = tPlanted > 0 ? (tGood / tPlanted) * 100 : 0;
      const ss = tPlantable > 0 ? (tGood / tPlantable) * 100 : 0;
      const d = plots.length > 0 ? Math.round((tGood * 200) / plots.length) : 0;
      const infrTotals: Record<string, number> = {};
      for (const p of plots) {
        for (const { key, label } of INFRACTION_LABELS) {
          const v = p.infractions[key] ?? 0;
          if (v > 0) infrTotals[label] = (infrTotals[label] ?? 0) + v;
        }
      }
      const infrChips = Object.entries(infrTotals).sort((a, b) => b[1] - a[1])
        .map(([label, count]) => `<span class="chip">${label}: <b>${count}</b></span>`).join("");
      const plotRows = plots.slice().sort((a, b) => a.date.localeCompare(b.date) || a.plotNumber.localeCompare(b.plotNumber))
        .map(p => {
          const pq = p.treesPlanted > 0 ? (p.goodTrees / p.treesPlanted) * 100 : 0;
          const pd = p.goodTrees * 200;
          return `<tr>
            <td>${p.date}</td>
            <td>${p.plotNumber || "—"}</td>
            <td>${p.crewBoss}</td>
            <td>${p.surveyor || "—"}</td>
            <td class="r">${fmt(p.treesPlanted)}</td>
            <td class="r">${fmt(p.goodTrees)}</td>
            <td class="r"><b>${pq.toFixed(1)}%</b></td>
            <td class="r">${fmt(pd)}</td>
            <td style="font-size:11px;color:#6b7280">${p.notes ?? ""}</td>
          </tr>`;
        }).join("");
      return `
        <div class="block-section">
          <div class="block-header">
            <div class="title">${block}</div>
            <div class="stats">${plots.length} plot${plots.length !== 1 ? "s" : ""} &middot; ${fmt(tGood)}/${fmt(tPlanted)} good (${q.toFixed(1)}%) &middot; Density ${fmt(d)} stems/ha &middot; Stocking ${ss.toFixed(1)}%</div>
          </div>
          ${infrChips ? `<div class="infraction-chips">${infrChips}</div>` : ""}
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Plot #</th><th>Crew Boss</th><th>Surveyor</th>
                <th class="r">Planted</th><th class="r">Good</th>
                <th class="r">Quality %</th><th class="r">Density (s/ha)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${plotRows}</tbody>
          </table>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Quality Assessment Report — ${project}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; max-width: 1100px; margin: 24px auto; padding: 0 24px; }
  .report-header { display: flex; align-items: center; gap: 20px; padding-bottom: 16px; margin-bottom: 24px; border-bottom: 2px solid #14532d; }
  .report-header img { height: 64px; width: auto; }
  .report-header .head-text { flex: 1; }
  .report-header h1 { color: #14532d; font-size: 22px; margin: 0 0 4px; }
  .report-header .subtitle { color: #6b7280; font-size: 12px; }
  .report-header .company { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.5; }
  .report-header .company b { color: #14532d; font-size: 12px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 14px; border-radius: 8px; }
  .kpi .label { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #166534; }
  .kpi .value { font-size: 22px; font-weight: 800; color: #14532d; margin-top: 4px; }
  .kpi .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  thead th { background: #14532d; color: #ffffff; padding: 8px 10px; text-align: left; font-weight: 700; font-size: 11px; letter-spacing: .04em; }
  thead th.r { text-align: right; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
  tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .block-header { background: #f0fdf4; padding: 10px 14px; margin-top: 28px; margin-bottom: 0; border-left: 4px solid #14532d; }
  .block-header .title { font-size: 14px; font-weight: 800; color: #14532d; }
  .block-header .stats { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .infraction-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 16px; }
  .chip { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 10px; font-size: 11px; }
  .chip b { color: #14532d; }
  .sign-block { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 40px; }
  .sign-line { flex: 1; }
  .sign-line .line { border-bottom: 1px solid #111827; height: 36px; }
  .sign-line .label { font-size: 11px; color: #6b7280; margin-top: 4px; }
  @media print {
    body { margin: 0; padding: 0 16px; }
    .block-section { page-break-inside: avoid; }
    .no-print { display: none; }
  }
</style></head><body>
<div class="no-print" style="margin-bottom:16px;text-align:right">
  <button onclick="window.print()" style="padding:8px 16px;background:#14532d;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">Print / Save as PDF</button>
</div>
<div class="report-header">
  <img src="${logoUrl}" alt="Integrity Reforestation" crossorigin="anonymous" />
  <div class="head-text">
    <h1>Tree Plant Quality Assessment Report</h1>
    <div class="subtitle">
      ${project}${qpReportBlock !== "all" ? ` &middot; Block: ${qpReportBlock}` : ""} &middot; ${dateFrom} → ${dateTo} &middot; ${filtered.length} plot${filtered.length !== 1 ? "s" : ""}
    </div>
  </div>
  <div class="company">
    <b>Integrity Reforestation</b><br/>
    Quality Assessment<br/>
    Generated ${new Date().toISOString().slice(0, 10)}
  </div>
</div>
<div class="kpi-grid">
  <div class="kpi"><div class="label">Quality %</div><div class="value">${overallQ.toFixed(1)}%</div><div class="sub">${fmt(totalGood)} good / ${fmt(totalPlanted)} planted</div></div>
  <div class="kpi"><div class="label">Stocking %</div><div class="value">${overallS.toFixed(1)}%</div><div class="sub">${fmt(totalGood)} good / ${fmt(totalPlantable)} plantable</div></div>
  <div class="kpi"><div class="label">Avg Density</div><div class="value">${fmt(avgDensity)}</div><div class="sub">stems/ha (good × 200)</div></div>
  <div class="kpi"><div class="label">Plots Surveyed</div><div class="value">${filtered.length}</div><div class="sub">across ${byBlock.size} block${byBlock.size !== 1 ? "s" : ""}</div></div>
</div>
<table>
  <thead><tr><th>Block</th><th class="r">Plots</th><th class="r">Planted</th><th class="r">Good</th><th class="r">Quality %</th><th class="r">Stocking %</th><th class="r">Density (s/ha)</th></tr></thead>
  <tbody>${blockSummaryRows}</tbody>
</table>
${blockSections}
<div class="sign-block">
  <div class="sign-line"><div class="line"></div><div class="label">Contractor / Foreman</div></div>
  <div class="sign-line"><div class="line"></div><div class="label">Client Representative</div></div>
  <div class="sign-line"><div class="line"></div><div class="label">Date</div></div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      URL.revokeObjectURL(url);
      alert("Popup blocked. Please allow popups for this site.");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function startEdit(entryId: string, field: NonNullable<typeof editingCell>["field"], value: string, lineIdx?: number) {
    setEditingCell({ entryId, field, lineIdx });
    setEditingValue(value);
  }

  async function commitEdit() {
    if (!editingCell) return;
    const { entryId, field, lineIdx } = editingCell;
    const entry = entries.find(e => e.id === entryId);
    if (!entry) { setEditingCell(null); return; }

    let updated: ProductionEntry = { ...entry };

    if (field === "date") {
      updated.date = editingValue || entry.date;
    } else if (field === "block") {
      updated.block = editingValue;
    } else if (field === "project") {
      updated.project = editingValue;
    } else if (field === "hoursWorked") {
      updated.hoursWorked = parseFloat(editingValue) || entry.hoursWorked;
    } else if (field === "trees" && lineIdx !== undefined) {
      const newTrees = Math.max(0, parseInt(editingValue) || 0);
      const production = entry.production.map((l, i) =>
        i !== lineIdx ? l : { ...l, trees: newTrees, earnings: newTrees * l.ratePerTree }
      );
      const totalTrees    = production.reduce((s, l) => s + l.trees, 0);
      const totalEarnings = production.reduce((s, l) => s + l.earnings, 0);
      updated = {
        ...updated,
        production,
        totalTrees,
        totalEarnings,
        vacPay: totalEarnings * 0.04,
        totalWithVac: totalEarnings,
        avgPricePerTree: totalTrees > 0 ? totalEarnings / totalTrees : 0,
      };
    }

    await saveRecord("production_entries", updated);
    setEntries(prev => prev.map(e => e.id === entryId ? updated : e));
    setEditingCell(null);
  }

  function cancelEdit() { setEditingCell(null); }

  // ── Derived filter data ───────────────────────────────────────────────

  const uniqueCrews    = useMemo(() => [...new Set(entries.map(e => e.crewBoss))].sort(), [entries]);
  const uniqueProjects = useMemo(() => [...new Set(entries.map(e => e.project).filter(Boolean))].sort(), [entries]);
  const uniquePlanters = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach(e => map.set(e.employeeId || e.employeeName, e.employeeName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = useMemo(() => entries.filter(e => {
    if (isCrewBoss && e.crewBoss !== userName) return false;
    if (e.date < dateFrom || e.date > dateTo) return false;
    if (crewFilter    !== "all" && e.crewBoss !== crewFilter) return false;
    if (projectFilter !== "all" && e.project  !== projectFilter) return false;
    if (planterFilter !== "all" && e.employeeId !== planterFilter && e.employeeName !== planterFilter) return false;
    return true;
  }), [entries, dateFrom, dateTo, crewFilter, projectFilter, planterFilter, isCrewBoss, userName]);

  // ── Summary aggregations ──────────────────────────────────────────────

  const planterSummary = useMemo(() => {
    const map = new Map<string, {
      name: string; totalTrees: number; totalEarnings: number; totalWithVac: number; totalHours: number; overtimeHours: number;
      days: Set<string>; speciesMap: Map<string, { code: string; trees: number; earnings: number }>;
    }>();
    for (const e of filtered) {
      const key = e.employeeId || e.employeeName;
      if (!map.has(key)) map.set(key, { name: e.employeeName, totalTrees: 0, totalEarnings: 0, totalWithVac: 0, totalHours: 0, overtimeHours: 0, days: new Set(), speciesMap: new Map() });
      const rec = map.get(key)!;
      rec.totalTrees    += e.totalTrees;
      rec.totalEarnings += e.totalEarnings;
      rec.totalWithVac  += e.totalWithVac;
      rec.totalHours    += e.hoursWorked;
      rec.overtimeHours += Math.max(0, e.hoursWorked - 8);
      rec.days.add(e.date);
      for (const l of e.production) {
        const s = rec.speciesMap.get(l.species) ?? { code: l.code, trees: 0, earnings: 0 };
        s.trees += l.trees; s.earnings += l.earnings;
        rec.speciesMap.set(l.species, s);
      }
    }
    return [...map.values()].sort((a, b) => b.totalTrees - a.totalTrees);
  }, [filtered]);

  const crewSummary = useMemo(() => {
    const map = new Map<string, { crew: string; totalTrees: number; totalEarnings: number; totalWithVac: number; crewHours: number; overtimeHours: number; planters: Set<string> }>();
    for (const e of filtered) {
      if (!map.has(e.crewBoss)) map.set(e.crewBoss, { crew: e.crewBoss, totalTrees: 0, totalEarnings: 0, totalWithVac: 0, crewHours: 0, overtimeHours: 0, planters: new Set() });
      const rec = map.get(e.crewBoss)!;
      rec.totalTrees += e.totalTrees; rec.totalEarnings += e.totalEarnings; rec.totalWithVac += e.totalWithVac;
      rec.crewHours     += e.hoursWorked;
      rec.overtimeHours += Math.max(0, e.hoursWorked - 8);
      rec.planters.add(e.employeeId || e.employeeName);
    }
    return [...map.values()].sort((a, b) => b.totalTrees - a.totalTrees);
  }, [filtered]);

  // YTD hours per employee — all entries in the current calendar year, unaffected by date filter
  const ytdHours = useMemo(() => {
    const year = new Date().getFullYear().toString();
    const map = new Map<string, number>();
    for (const e of entries) {
      if (!e.date.startsWith(year)) continue;
      const key = e.employeeId || e.employeeName;
      map.set(key, (map.get(key) ?? 0) + e.hoursWorked);
    }
    return map;
  }, [entries]);

  // Previous 4-week period data — used to compute avg hourly wage for overtime pay calculation.
  // "Previous 4-week period" = the 28 days immediately before dateFrom.
  const prevPeriodData = useMemo(() => {
    const fromDate = new Date(dateFrom);
    const prevTo = new Date(fromDate);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(fromDate);
    prevFrom.setDate(prevFrom.getDate() - 28);
    const prevToStr   = prevTo.toISOString().slice(0, 10);
    const prevFromStr = prevFrom.toISOString().slice(0, 10);
    const map = new Map<string, { hours: number; withVac: number }>();
    for (const e of entries) {
      if (e.date < prevFromStr || e.date > prevToStr) continue;
      const key = e.employeeId || e.employeeName;
      const rec = map.get(key) ?? { hours: 0, withVac: 0 };
      rec.hours   += e.hoursWorked;
      rec.withVac += e.totalWithVac;
      map.set(key, rec);
    }
    return map;
  }, [entries, dateFrom]);

  const speciesSummary = useMemo(() => {
    const map = new Map<string, { species: string; code: string; trees: number; earnings: number }>();
    for (const e of filtered) {
      for (const l of e.production) {
        const s = map.get(l.species) ?? { species: l.species, code: l.code, trees: 0, earnings: 0 };
        s.trees += l.trees; s.earnings += l.earnings;
        map.set(l.species, s);
      }
    }
    return [...map.values()].sort((a, b) => b.trees - a.trees);
  }, [filtered]);

  const blockSummary = useMemo(() => {
    const map = new Map<string, {
      block: string;
      totalTrees: number;
      totalEarnings: number;
      planters: Set<string>;
      species: Map<string, { code: string; trees: number; earnings: number }>;
    }>();
    for (const e of filtered) {
      const key = e.block || "(No Block)";
      if (!map.has(key)) map.set(key, { block: key, totalTrees: 0, totalEarnings: 0, planters: new Set(), species: new Map() });
      const rec = map.get(key)!;
      rec.totalTrees    += e.totalTrees;
      rec.totalEarnings += e.totalEarnings;
      rec.planters.add(e.employeeId || e.employeeName);
      for (const l of e.production) {
        const s = rec.species.get(l.species) ?? { code: l.code, trees: 0, earnings: 0 };
        s.trees += l.trees; s.earnings += l.earnings;
        rec.species.set(l.species, s);
      }
    }
    return [...map.values()].sort((a, b) => b.totalTrees - a.totalTrees);
  }, [filtered]);

  // All-entries block summary (no date filter) — used on the Rates tab
  const allBlockSummary = useMemo(() => {
    const map = new Map<string, {
      block: string; totalTrees: number; totalEarnings: number;
      planters: Set<string>;
      species: Map<string, { code: string; trees: number; earnings: number }>;
    }>();
    for (const e of entries) {
      const key = e.block || "(No Block)";
      if (!map.has(key)) map.set(key, { block: key, totalTrees: 0, totalEarnings: 0, planters: new Set(), species: new Map() });
      const rec = map.get(key)!;
      rec.totalTrees    += e.totalTrees;
      rec.totalEarnings += e.totalEarnings;
      rec.planters.add(e.employeeId || e.employeeName);
      for (const l of e.production) {
        const s = rec.species.get(l.species) ?? { code: l.code, trees: 0, earnings: 0 };
        s.trees += l.trees; s.earnings += l.earnings;
        rec.species.set(l.species, s);
      }
    }
    return [...map.values()].sort((a, b) => b.totalTrees - a.totalTrees);
  }, [entries]);

  // Latest adjustment per project|block|species key
  const latestAdjMap = useMemo(() => {
    const map = new Map<string, BlockAdjustment>();
    for (const adj of blockAdjustments) {
      const key = `${adj.project}|${adj.block}|${adj.species}`;
      const existing = map.get(key);
      if (!existing || adj.timestamp > existing.timestamp) map.set(key, adj);
    }
    return map;
  }, [blockAdjustments]);

  // Block summary grouped by project + block, with manual adjustments applied
  const blockSummaryByProject = useMemo(() => {
    const map = new Map<string, {
      project: string; block: string; totalTrees: number; totalEarnings: number;
      planters: Set<string>;
      species: Map<string, { code: string; trees: number; earnings: number; baseTrees: number }>;
    }>();
    for (const e of entries) {
      const proj = e.project || "(No Project)";
      const blk  = e.block   || "(No Block)";
      const key  = `${proj}|${blk}`;
      if (!map.has(key)) map.set(key, { project: proj, block: blk, totalTrees: 0, totalEarnings: 0, planters: new Set(), species: new Map() });
      const rec = map.get(key)!;
      rec.planters.add(e.employeeId || e.employeeName);
      for (const l of e.production) {
        const s = rec.species.get(l.species) ?? { code: l.code, trees: 0, earnings: 0, baseTrees: 0 };
        s.trees     += l.trees;
        s.baseTrees += l.trees;
        s.earnings  += l.earnings;
        rec.species.set(l.species, s);
      }
    }
    // Apply latest adjustments
    for (const [adjKey, adj] of latestAdjMap) {
      const [proj, blk] = adjKey.split("|");
      const rec = map.get(`${proj}|${blk}`);
      if (!rec) continue;
      const s = rec.species.get(adj.species);
      if (s) s.trees = adj.newTrees;
    }
    // Recompute totals
    for (const rec of map.values()) {
      rec.totalTrees    = [...rec.species.values()].reduce((s, sp) => s + sp.trees, 0);
      rec.totalEarnings = [...rec.species.values()].reduce((s, sp) => s + sp.earnings, 0);
    }
    return [...map.values()].sort((a, b) => (a.project + a.block).localeCompare(b.project + b.block));
  }, [entries, latestAdjMap]);

  // Client Summary: date-filtered block summary (no pricing)
  const clientBlockSummary = useMemo(() => {
    const clientFiltered = entries.filter(e =>
      (!clientDateFrom || e.date >= clientDateFrom) &&
      (!clientDateTo   || e.date <= clientDateTo)
    );
    type CrewBreakdown = {
      totalTrees: number;
      planters: Set<string>;
      species: Map<string, { code: string; trees: number }>;
    };
    const map = new Map<string, {
      project: string; block: string; totalTrees: number;
      planters: Set<string>;
      dates: Set<string>;
      species: Map<string, { code: string; trees: number }>;
      crews: Map<string, CrewBreakdown>;
    }>();
    for (const e of clientFiltered) {
      const proj = e.project || "(No Project)";
      const blk  = e.block   || "(No Block)";
      const key  = `${proj}|${blk}`;
      if (!map.has(key)) map.set(key, { project: proj, block: blk, totalTrees: 0, planters: new Set(), dates: new Set(), species: new Map(), crews: new Map() });
      const rec = map.get(key)!;
      rec.totalTrees += e.totalTrees;
      rec.planters.add(e.employeeId || e.employeeName);
      rec.dates.add(e.date);
      for (const l of e.production) {
        const s = rec.species.get(l.species) ?? { code: l.code, trees: 0 };
        s.trees += l.trees;
        rec.species.set(l.species, s);
      }
      const crewName = (e.crewBoss || "").trim() || "(No Crew)";
      const crew = rec.crews.get(crewName) ?? { totalTrees: 0, planters: new Set<string>(), species: new Map<string, { code: string; trees: number }>() };
      crew.totalTrees += e.totalTrees;
      crew.planters.add(e.employeeId || e.employeeName);
      for (const l of e.production) {
        const cs = crew.species.get(l.species) ?? { code: l.code, trees: 0 };
        cs.trees += l.trees;
        crew.species.set(l.species, cs);
      }
      rec.crews.set(crewName, crew);
    }
    return [...map.values()].sort((a, b) => (a.project + a.block).localeCompare(b.project + b.block));
  }, [entries, clientDateFrom, clientDateTo]);

  const totals = useMemo(() => {
    const totalTrees    = filtered.reduce((s, e) => s + e.totalTrees, 0);
    const totalEarnings = filtered.reduce((s, e) => s + e.totalEarnings, 0);
    const totalWithVac  = filtered.reduce((s, e) => s + e.totalWithVac, 0);
    const days          = new Set(filtered.map(e => e.date)).size;
    const planterCount  = new Set(filtered.map(e => e.employeeId || e.employeeName)).size;
    const avgPerDay     = days > 0 && planterCount > 0 ? Math.round(totalTrees / days / planterCount) : 0;
    const avgPrice      = totalTrees > 0 ? totalEarnings / totalTrees : 0;
    return { totalTrees, totalEarnings, totalWithVac, days, planterCount, avgPerDay, avgPrice };
  }, [filtered]);

  // Persist camp cost rate to localStorage
  useEffect(() => {
    localStorage.setItem("campCostRate", String(campCostRate));
  }, [campCostRate]);

  // Auto-seed planter camp costs from campCostRate × days (only if not already set)
  useEffect(() => {
    if (campCostRate <= 0) return;
    setPlanterDeds(prev => {
      const updates: typeof prev = {};
      for (const p of planterSummary) {
        const existing = prev[p.name];
        if (!existing?.campCosts) {
          updates[p.name] = {
            campCosts:          (campCostRate * p.days.size).toFixed(2),
            equipDeduction:     existing?.equipDeduction ?? "",
            other:              existing?.other ?? "",
            cpp:                existing?.cpp ?? "",
            ei:                 existing?.ei ?? "",
            incomeTax:          existing?.incomeTax ?? "",
            additionalEarnings: existing?.additionalEarnings ?? "",
            notes:              existing?.notes ?? "",
          };
        }
      }
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, [planterSummary, campCostRate]);

  // ── Rates CRUD ────────────────────────────────────────────────────────

  function openAddRate() {
    setEditingRateId(null);
    setRateForm({ species: "", code: "", rateBucket: "", rateType: "flat", ratePerTree: 0, tierThreshold: undefined, rateBelowThreshold: undefined, rateAboveThreshold: undefined, treesPerBox: undefined });
    setShowRateModal(true);
  }

  function openEditRate(r: SpeciesRate) {
    setEditingRateId(r.id);
    setRateForm({
      species: r.species, code: r.code, rateBucket: r.rateBucket,
      rateType: r.rateType ?? "flat", ratePerTree: r.ratePerTree,
      tierThreshold: r.tierThreshold, rateBelowThreshold: r.rateBelowThreshold, rateAboveThreshold: r.rateAboveThreshold, treesPerBox: r.treesPerBox,
    });
    setShowRateModal(true);
  }

  async function saveRate() {
    if (!rateForm.species.trim()) return;
    if (rateForm.rateType === "flat" && rateForm.ratePerTree <= 0) return;
    if (rateForm.rateType === "tiered" && (
      !rateForm.tierThreshold || rateForm.tierThreshold <= 0 ||
      !rateForm.rateBelowThreshold || rateForm.rateBelowThreshold <= 0 ||
      !rateForm.rateAboveThreshold || rateForm.rateAboveThreshold <= 0
    )) return;
    if (editingRateId) {
      const updated = { id: editingRateId, ...rateForm };
      await saveRecord("species_rates", updated);
      setRates(prev => prev.map(r => r.id === editingRateId ? updated : r));
    } else {
      const newRate: SpeciesRate = { id: `sr-${uid()}`, ...rateForm };
      await saveRecord("species_rates", newRate);
      setRates(prev => [...prev, newRate].sort((a, b) => a.species.localeCompare(b.species)));
    }
    setShowRateModal(false);
  }

  async function handleDeleteRate(id: string) {
    await deleteRecord("species_rates", id);
    setRates(prev => prev.filter(r => r.id !== id));
  }

  // ── Shared styles ─────────────────────────────────────────────────────

  const inputCls = "w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";
  const labelCls = "block text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1";
  const filterInputCls = "px-3 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50";

  const crewBossOptions = employees.filter(e =>
    e.role.toLowerCase().includes("crew boss") || e.role.toLowerCase().includes("supervisor")
  );

  const FilterBar = () => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-text-tertiary font-medium">From</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={filterInputCls} />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-text-tertiary font-medium">To</label>
        <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} className={filterInputCls} />
      </div>
      <select value={crewFilter} onChange={e => setCrewFilter(e.target.value)} className={filterInputCls}>
        <option value="all">All Crews</option>
        {uniqueCrews.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className={filterInputCls}>
        <option value="all">All Projects</option>
        {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={planterFilter} onChange={e => setPlanterFilter(e.target.value)} className={filterInputCls}>
        <option value="all">All Planters</option>
        {uniquePlanters.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <div className="flex-1" />
      <div className="text-xs text-text-tertiary">{filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}</div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* Tab bar */}
      <div className="flex items-center border-b border-border px-6 bg-surface shrink-0 overflow-x-auto no-scrollbar">
        {(["entry", "supervisor", "daily", "reconcile", "quality", "log", "summary", "rates", "blocks", "client", "oversight", "payroll", "manual-changes"] as Tab[])
          .filter(t => userRole === "crew_boss" ? t === "entry" : true)
          .map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t === "entry" ? "Crew Boss Entry" : t === "supervisor" ? "Tree Deliveries" : t === "daily" ? "Inventory Tracking" : t === "reconcile" ? "Reconciliation" : t === "quality" ? "Quality Reports" : t === "log" ? "Production Reports" : t === "summary" ? "Earnings & Deductions" : t === "rates" ? "Species Rates" : t === "blocks" ? "Block Summary" : t === "client" ? "Client Summary" : t === "payroll" ? "Payroll" : t === "manual-changes" ? "Manual Changes" : "Supervisor Overview"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ────────────────────────────── ENTRY ────────────────────────────── */}
        {tab === "entry" && (
          <div className="max-w-5xl mx-auto space-y-5">

            {/* Entry toolbar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSaveAsName(""); setShowSaveAsModal(true); }}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors"
              >
                Save As…
              </button>
              <button
                onClick={() => setShowOpenModal(true)}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors flex items-center gap-1.5"
              >
                Open
                {savedSessions.length > 0 && (
                  <span className="text-[10px] bg-surface-secondary border border-border rounded-full px-1.5 py-0.5 text-text-tertiary font-semibold">
                    {savedSessions.length}
                  </span>
                )}
              </button>
            </div>

            {/* Session context */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className={`${labelCls} mb-4`}>Session Details</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Date *</label>
                  <input type="date" value={session.date} onChange={e => setSession(s => ({ ...s, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Crew Boss *</label>
                  {isCrewBoss ? (
                    <div className={`${inputCls} text-text-secondary bg-surface-secondary cursor-not-allowed`}>{userName || "—"}</div>
                  ) : (
                    <select value={session.crewBoss} onChange={e => handleCrewBossChange(e.target.value)} className={inputCls}>
                      <option value="">Select crew boss…</option>
                      {crewBossOptions.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Project</label>
                  <input list="proj-list" value={session.project} onChange={e => setSession(s => ({ ...s, project: e.target.value }))} placeholder="Project name…" className={inputCls} />
                  <datalist id="proj-list">{uniqueProjects.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <label className={labelCls}>Block</label>
                  <input value={session.block} onChange={e => setSession(s => ({ ...s, block: e.target.value }))} placeholder="e.g. Block 3A" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Camp</label>
                  <input value={session.camp} onChange={e => setSession(s => ({ ...s, camp: e.target.value }))} placeholder="Camp name…" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Shift</label>
                  <select value={session.shift} onChange={e => setSession(s => ({ ...s, shift: e.target.value }))} className={inputCls}>
                    <option>Day</option><option>Night</option><option>Split</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Planter cards */}
            {planters.map((planter, pi) => {
              const sst = sessionSpeciesTotals(planters);
              const calc = planterCalc(planter, sst);
              return (
                <div key={planter.id} className="bg-surface border border-border rounded-xl overflow-hidden">

                  {/* Planter header */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-surface-secondary/40 border-b border-border">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary shrink-0">
                      Planter {pi + 1}
                    </span>
                    <select
                      value={planter.employeeId}
                      onChange={e => {
                        const emp = employees.find(x => x.id === e.target.value);
                        updatePlanter(planter.id, { employeeId: e.target.value, employeeName: emp?.name ?? "" });
                      }}
                      className="flex-1 text-xs bg-surface border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50"
                    >
                      <option value="">Select employee…</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                    </select>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-[10px] text-text-tertiary">Hrs</label>
                      <input
                        type="number" step="0.5" min="0" value={planter.hoursWorked}
                        onChange={e => updatePlanter(planter.id, { hoursWorked: e.target.value })}
                        className="w-16 px-2 py-1.5 text-xs bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    {planters.length > 1 && (
                      <button onClick={() => setPlanters(prev => prev.filter(p => p.id !== planter.id))}
                        className="text-text-tertiary hover:text-red-400 text-sm font-bold shrink-0 transition-colors">×</button>
                    )}
                  </div>

                  {/* Species lines */}
                  <div className="px-5 py-4 space-y-2">
                    <div className="grid grid-cols-[1fr_80px_110px_70px_90px_24px] gap-2 mb-1">
                      {["Species", "Boxes", "Trees", "$/Tree", "Earnings", ""].map(h => (
                        <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary text-right first:text-left">{h}</div>
                      ))}
                    </div>
                    {planter.lines.map(line => {
                      const rate  = rates.find(r => r.id === line.speciesId);
                      const trees = parseInt(line.trees) || 0;
                      const rpt   = rate ? resolveRate(rate, trees, sst.get(rate.id)) : 0;
                      const earnings = rate ? trees * rpt : 0;
                      const hasBoxRate = (rate?.treesPerBox ?? 0) > 0;
                      return (
                        <div key={line.id} className="grid grid-cols-[1fr_80px_110px_70px_90px_24px] gap-2 items-center">
                          <select value={line.speciesId} onChange={e => updateLine(planter.id, line.id, { speciesId: e.target.value, boxes: undefined })}
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50">
                            <option value="">Species…</option>
                            {rates.map(r => (
                              <option key={r.id} value={r.id}>{r.code} – {r.species}{r.rateBucket ? ` (${r.rateBucket})` : ""}</option>
                            ))}
                          </select>
                          {hasBoxRate ? (
                            <input type="number" min="0" value={line.boxes ?? ""}
                              onChange={e => {
                                const boxes = e.target.value;
                                const computed = boxes !== "" ? String(Math.round(Number(boxes) * (rate!.treesPerBox ?? 0))) : "";
                                updateLine(planter.id, line.id, { boxes, trees: computed });
                              }}
                              placeholder="0"
                              title={`× ${rate!.treesPerBox} trees/box`}
                              className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                          ) : (
                            <div className="text-right text-xs text-text-tertiary">—</div>
                          )}
                          <input type="number" min="0" value={line.trees}
                            onChange={e => updateLine(planter.id, line.id, { trees: e.target.value, boxes: undefined })}
                            placeholder="0"
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                          <div className="text-right text-xs text-text-tertiary">
                            {rate ? `$${rpt.toFixed(3)}` : "—"}
                          </div>
                          <div className="text-right text-xs font-medium text-text-primary">
                            {earnings > 0 ? fmtC(earnings) : "—"}
                          </div>
                          <button onClick={() => setPlanters(prev => prev.map(p =>
                            p.id !== planter.id ? p : { ...p, lines: p.lines.filter(l => l.id !== line.id) }
                          ))} className={`text-text-tertiary hover:text-red-400 text-sm font-bold transition-colors ${planter.lines.length < 2 ? "opacity-0 pointer-events-none" : ""}`}>×</button>
                        </div>
                      );
                    })}
                    <button onClick={() => setPlanters(prev => prev.map(p => p.id !== planter.id ? p : { ...p, lines: [...p.lines, newLine()] }))}
                      className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                      + Add Species
                    </button>
                  </div>

                  {/* Planter live totals */}
                  {calc.totalTrees > 0 && (
                    <div className="flex items-center gap-6 px-5 py-2.5 bg-surface-secondary/30 border-t border-border text-xs">
                      <div><span className="text-text-tertiary">Trees: </span><span className="font-semibold text-text-primary">{fmt(calc.totalTrees)}</span></div>
                      <div><span className="text-text-tertiary">Earnings: </span><span className="font-semibold text-text-primary">{fmtC(calc.totalEarnings)}</span></div>
                      <div><span className="text-text-tertiary">Incl. Vac (4%): </span><span className="text-text-secondary">{fmtC(calc.vacPay)}</span></div>
                      <div><span className="text-text-tertiary">Total: </span><span className="font-bold" style={{ color: "var(--color-primary)" }}>{fmtC(calc.totalEarnings)}</span></div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Session totals */}
            {(() => {
              const sst = sessionSpeciesTotals(planters);
              const calcs = planters.map(p => planterCalc(p, sst));
              const sessionTrees    = calcs.reduce((s, c) => s + c.totalTrees, 0);
              const sessionEarnings = calcs.reduce((s, c) => s + c.totalEarnings, 0);
              const sessionVac      = sessionEarnings * 0.04;
              const activePlanters  = calcs.filter(c => c.totalTrees > 0).length;
              if (sessionTrees === 0) return null;

              // Per-species rollup across all planters
              const speciesMap = new Map<string, { label: string; trees: number; earnings: number }>();
              for (const planter of planters) {
                for (const line of planter.lines) {
                  const rate  = rates.find(r => r.id === line.speciesId);
                  const trees = parseInt(line.trees) || 0;
                  if (!rate || trees === 0) continue;
                  const rpt = resolveRate(rate, trees, sst.get(rate.id));
                  const existing = speciesMap.get(rate.id) ?? { label: `${rate.code} – ${rate.species}`, trees: 0, earnings: 0 };
                  existing.trees    += trees;
                  existing.earnings += trees * rpt;
                  speciesMap.set(rate.id, existing);
                }
              }
              const speciesRows = [...speciesMap.values()].sort((a, b) => b.trees - a.trees);

              return (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-secondary/40">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Session Totals</div>
                    <div className="text-[11px] text-text-tertiary">{activePlanters} planter{activePlanters !== 1 ? "s" : ""} with data</div>
                  </div>
                  {/* KPI strip */}
                  <div className="grid grid-cols-4 divide-x divide-border">
                    {[
                      { label: "Total Trees",    value: fmt(sessionTrees) },
                      { label: "Gross Earnings", value: fmtC(sessionEarnings) },
                      { label: "Vac Pay (4%)",   value: fmtC(sessionVac) },
                      { label: "Total Payable",  value: fmtC(sessionEarnings + sessionVac) },
                    ].map(k => (
                      <div key={k.label} className="px-5 py-4">
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">{k.label}</div>
                        <div className="text-lg font-bold text-text-primary">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Per-species breakdown */}
                  {speciesRows.length > 0 && (
                    <div className="px-5 py-3 border-t border-border/50">
                      <div className="grid grid-cols-[1fr_90px_100px] gap-2 mb-2">
                        {["Species", "Trees", "Earnings"].map(h => (
                          <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary text-right first:text-left">{h}</div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {speciesRows.map(s => (
                          <div key={s.label} className="grid grid-cols-[1fr_90px_100px] gap-2 items-center text-xs">
                            <div className="text-text-secondary">{s.label}</div>
                            <div className="text-right font-medium text-text-primary">{fmt(s.trees)}</div>
                            <div className="text-right text-text-secondary">{fmtC(s.earnings)}</div>
                          </div>
                        ))}
                        <div className="grid grid-cols-[1fr_90px_100px] gap-2 items-center text-xs border-t border-border/50 pt-1.5 mt-1.5">
                          <div className="font-semibold text-text-primary">Total</div>
                          <div className="text-right font-bold text-text-primary">{fmt(sessionTrees)}</div>
                          <div className="text-right font-bold" style={{ color: "var(--color-primary)" }}>{fmtC(sessionEarnings)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trees Remaining on Block */}
                  {(() => {
                    if (!session.block) return null;

                    // Delivered to this block by supervisor
                    const deliveredMap = new Map<string, { species: string; code: string; trees: number }>();
                    for (const d of deliveries.filter(d => d.block === session.block)) {
                      for (const l of d.lines) {
                        const ex = deliveredMap.get(l.speciesId) ?? { species: l.species, code: l.code, trees: 0 };
                        ex.trees += l.trees;
                        deliveredMap.set(l.speciesId, ex);
                      }
                    }

                    // Already planted on this block (saved entries only — draft is current session)
                    const savedPlantedMap = new Map<string, number>();
                    for (const e of entries.filter(e => e.block === session.block)) {
                      for (const l of e.production) {
                        savedPlantedMap.set(l.speciesId, (savedPlantedMap.get(l.speciesId) ?? 0) + l.trees);
                      }
                    }

                    // Add current draft session planted
                    const draftPlantedMap = new Map<string, number>();
                    for (const p of planters) {
                      for (const line of p.lines) {
                        const trees = parseInt(line.trees) || 0;
                        if (!line.speciesId || !trees) continue;
                        draftPlantedMap.set(line.speciesId, (draftPlantedMap.get(line.speciesId) ?? 0) + trees);
                      }
                    }

                    if (deliveredMap.size === 0 && savedPlantedMap.size === 0 && draftPlantedMap.size === 0) return null;

                    const allSpeciesIds = new Set([...deliveredMap.keys(), ...savedPlantedMap.keys(), ...draftPlantedMap.keys()]);
                    const remainRows = [...allSpeciesIds].map(sid => {
                      const rate     = rates.find(r => r.id === sid);
                      const delivered = deliveredMap.get(sid)?.trees ?? 0;
                      const planted   = (savedPlantedMap.get(sid) ?? 0) + (draftPlantedMap.get(sid) ?? 0);
                      const remaining = delivered - planted;
                      return {
                        label: rate ? `${rate.code} – ${rate.species}` : (deliveredMap.get(sid)?.species ?? sid),
                        delivered, planted, remaining,
                      };
                    }).sort((a, b) => b.delivered - a.delivered);

                    const totalDelivered  = remainRows.reduce((s, r) => s + r.delivered, 0);
                    const totalPlanted    = remainRows.reduce((s, r) => s + r.planted, 0);
                    const totalRemaining  = totalDelivered - totalPlanted;

                    return (
                      <div className="border-t border-border/50">
                        <div className="flex items-center justify-between px-5 py-2.5 bg-surface-secondary/20">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                            Trees Remaining on Block — {session.block}
                          </div>
                          <div className="text-[11px] font-bold" style={{ color: totalRemaining >= 0 ? "var(--color-primary)" : "var(--color-danger)" }}>
                            {fmt(Math.abs(totalRemaining))} {totalRemaining < 0 ? "over" : "left"}
                          </div>
                        </div>
                        <div className="px-5 py-3 space-y-1.5">
                          <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 mb-1.5">
                            {["Species", "Delivered", "Planted", "Remaining"].map(h => (
                              <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary text-right first:text-left">{h}</div>
                            ))}
                          </div>
                          {remainRows.map(r => {
                            const rc = r.remaining > 0 ? "var(--color-primary)" : r.remaining < 0 ? "var(--color-danger)" : "var(--color-text-tertiary)";
                            return (
                              <div key={r.label} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center text-xs">
                                <div className="text-text-secondary truncate">{r.label}</div>
                                <div className="text-right text-text-secondary">{r.delivered > 0 ? fmt(r.delivered) : "—"}</div>
                                <div className="text-right text-text-secondary">{r.planted > 0 ? fmt(r.planted) : "—"}</div>
                                <div className="text-right font-semibold" style={{ color: rc }}>
                                  {r.remaining < 0 ? "−" : ""}{fmt(Math.abs(r.remaining))}
                                </div>
                              </div>
                            );
                          })}
                          <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center text-xs border-t border-border/50 pt-1.5 mt-0.5">
                            <div className="font-semibold text-text-primary">Total</div>
                            <div className="text-right font-bold text-text-primary">{fmt(totalDelivered)}</div>
                            <div className="text-right font-bold text-text-primary">{fmt(totalPlanted)}</div>
                            <div className="text-right font-bold" style={{ color: totalRemaining >= 0 ? "var(--color-primary)" : "var(--color-danger)" }}>
                              {totalRemaining < 0 ? "−" : ""}{fmt(Math.abs(totalRemaining))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              );
            })()}

            {/* Add Planter */}
            <button onClick={() => setPlanters(prev => [...prev, newDraftPlanter()])}
              className="w-full px-4 py-2 text-xs font-medium border border-dashed border-border rounded-xl text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors">
              + Add Planter
            </button>

            {/* Notes */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className={`${labelCls} mb-3`}>Notes</div>
              <input value={session.notes} onChange={e => setSession(s => ({ ...s, notes: e.target.value }))} placeholder="Optional notes…" className={inputCls} />
            </div>

            {/* Equipment & Fuel */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className={`${labelCls} mb-3`}>Equipment &amp; Fuel</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Equipment on Block</label>
                  <input value={session.equipmentOnBlock} onChange={e => setSession(s => ({ ...s, equipmentOnBlock: e.target.value }))} placeholder="e.g. D6T, Excavator" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Equipment Fuel Level</label>
                  <input value={session.equipmentFuelLevel} onChange={e => setSession(s => ({ ...s, equipmentFuelLevel: e.target.value }))} placeholder="e.g. ¾ full, 80%" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vehicle Fuel Level</label>
                  <input value={session.vehicleFuelLevel} onChange={e => setSession(s => ({ ...s, vehicleFuelLevel: e.target.value }))} placeholder="e.g. ½ tank" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Planning */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className={`${labelCls} mb-3`}>Planning</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Plan for Tomorrow</label>
                  <textarea value={session.planForTomorrow} onChange={e => setSession(s => ({ ...s, planForTomorrow: e.target.value }))} placeholder="Describe tomorrow's plan…" rows={3} className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className={labelCls}>Needs / Notes</label>
                  <textarea value={session.needsNotes} onChange={e => setSession(s => ({ ...s, needsNotes: e.target.value }))} placeholder="Supplies needed, issues, observations…" rows={3} className={`${inputCls} resize-none`} />
                </div>
              </div>
            </div>

            {/* Tree Transfer */}
            {(() => {
              const knownBlocks = [
                REEFER_STORAGE,
                ...Array.from(new Set([
                  ...deliveries.map(d => d.block),
                  ...projectBlocks.map(b => b.blockName),
                  session.block ? [session.block] : [],
                ].flat())).filter(Boolean).sort(),
              ];

              async function handleCbSaveTransfer() {
                if (!cbXfrDate || !cbXfrFrom || !cbXfrTo || cbXfrFrom === cbXfrTo) return;
                const lines: TreeTransferLine[] = cbXfrLines
                  .filter(l => l.speciesId && Number(l.trees) > 0)
                  .map(l => {
                    const rate = rates.find(r => r.id === l.speciesId)!;
                    return { id: l.id, speciesId: rate.id, species: rate.species, code: rate.code, trees: Number(l.trees) };
                  });
                if (lines.length === 0) return;
                setCbXfrSaving(true);
                const transfer: TreeTransfer = {
                  id: `xfr-${uid()}`,
                  date: cbXfrDate,
                  fromBlock: cbXfrFrom,
                  toBlock: cbXfrTo,
                  lines,
                  totalTrees: lines.reduce((s, l) => s + l.trees, 0),
                  notes: cbXfrNotes || undefined,
                };
                await saveTreeTransfer(transfer);
                setTransfers(prev => [transfer, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
                setCbXfrLines([{ id: uid(), speciesId: "", trees: "" }]);
                setCbXfrFrom(""); setCbXfrTo(""); setCbXfrNotes("");
                setCbXfrSaving(false);
                showToast("Transfer recorded");
              }

              const cbCanSave = !!cbXfrDate && !!cbXfrFrom && !!cbXfrTo && cbXfrFrom !== cbXfrTo
                && cbXfrLines.some(l => l.speciesId && Number(l.trees) > 0);

              const crewTransfers = transfers.filter(t =>
                t.fromBlock === session.block || t.toBlock === session.block
              );

              return (
                <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Tree Transfer</div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Date *</label>
                      <input type="date" value={cbXfrDate} onChange={e => setCbXfrDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>From *</label>
                      <input list="cb-xfr-from-list" value={cbXfrFrom}
                        onChange={e => setCbXfrFrom(e.target.value)}
                        placeholder="Block or Reefer Storage" className={inputCls} />
                      <datalist id="cb-xfr-from-list">
                        {knownBlocks.map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className={labelCls}>To *</label>
                      <input list="cb-xfr-to-list" value={cbXfrTo}
                        onChange={e => setCbXfrTo(e.target.value)}
                        placeholder="Block or Reefer Storage" className={inputCls} />
                      <datalist id="cb-xfr-to-list">
                        {knownBlocks.filter(b => b !== cbXfrFrom).map(b => <option key={b} value={b} />)}
                      </datalist>
                    </div>
                    <div className="col-span-3">
                      <label className={labelCls}>Notes</label>
                      <input value={cbXfrNotes} onChange={e => setCbXfrNotes(e.target.value)} placeholder="Optional…" className={inputCls} />
                    </div>
                  </div>

                  {cbXfrFrom && cbXfrTo && cbXfrFrom === cbXfrTo && (
                    <div className="text-[11px] text-red-400">"From" and "To" must be different.</div>
                  )}
                  {cbXfrFrom && cbXfrTo && cbXfrFrom !== cbXfrTo && (
                    <div className="flex items-center gap-2 text-[11px] text-text-secondary px-3 py-2 bg-surface-secondary border border-border rounded-lg">
                      <span className="font-semibold text-text-primary truncate">{cbXfrFrom}</span>
                      <span className="shrink-0">→</span>
                      <span className="font-semibold text-text-primary truncate">{cbXfrTo}</span>
                    </div>
                  )}

                  <div>
                    <div className="grid grid-cols-[1fr_110px_24px] gap-2 mb-1.5">
                      {["Species", "Trees to Transfer", ""].map(h => (
                        <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {cbXfrLines.map(line => (
                        <div key={line.id} className="grid grid-cols-[1fr_110px_24px] gap-2 items-center">
                          <select value={line.speciesId}
                            onChange={e => setCbXfrLines(prev => prev.map(l => l.id === line.id ? { ...l, speciesId: e.target.value } : l))}
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50">
                            <option value="">Species…</option>
                            {rates.map(r => <option key={r.id} value={r.id}>{r.code} – {r.species}</option>)}
                          </select>
                          <input type="number" min="0" value={line.trees} placeholder="0"
                            onChange={e => setCbXfrLines(prev => prev.map(l => l.id === line.id ? { ...l, trees: e.target.value } : l))}
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                          <button
                            onClick={() => setCbXfrLines(prev => prev.filter(l => l.id !== line.id))}
                            disabled={cbXfrLines.length === 1}
                            className="text-text-tertiary hover:text-red-400 text-sm font-bold disabled:opacity-20 disabled:cursor-not-allowed transition-colors">×</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <button
                        onClick={() => setCbXfrLines(prev => [...prev, { id: uid(), speciesId: "", trees: "" }])}
                        className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                        + Add Species
                      </button>
                      {cbXfrLines.some(l => Number(l.trees) > 0) && (
                        <div className="text-xs text-text-tertiary">
                          Total: <span className="font-bold text-text-primary">
                            {fmt(cbXfrLines.reduce((s, l) => s + (Number(l.trees) || 0), 0))} trees
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-border">
                    <button onClick={handleCbSaveTransfer}
                      disabled={!cbCanSave || cbXfrSaving}
                      className="px-6 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                      {cbXfrSaving ? "Saving…" : "Record Transfer"}
                    </button>
                  </div>

                  {crewTransfers.length > 0 && (
                    <div className="border-t border-border pt-4 space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">
                        Transfer Log{session.block ? ` — ${session.block}` : ""}
                      </div>
                      {crewTransfers.map(t => (
                        <div key={t.id} className="flex items-start justify-between px-3 py-2.5 bg-surface-secondary border border-border rounded-lg">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-text-tertiary">{t.date}</span>
                              <span className="text-xs font-semibold text-text-primary">{t.fromBlock}</span>
                              <span className="text-[10px] text-text-tertiary">→</span>
                              <span className="text-xs font-semibold text-text-primary">{t.toBlock}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {t.lines.map(l => (
                                <span key={l.id} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
                                  <span className="font-mono font-semibold text-text-primary">{l.code}</span> {fmt(l.trees)}
                                </span>
                              ))}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--color-primary-deep)" }}>
                                {fmt(t.totalTrees)} total
                              </span>
                            </div>
                            {t.notes && <div className="text-[10px] text-text-tertiary italic">{t.notes}</div>}
                          </div>
                          <button
                            onClick={async () => { await deleteTreeTransfer(t.id); setTransfers(prev => prev.filter(x => x.id !== t.id)); }}
                            className="text-text-tertiary hover:text-red-400 text-sm font-bold shrink-0 ml-4 transition-colors">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tree Order — Next Day */}
            {(() => {
              const nextDay = session.date
                ? new Date(new Date(session.date).getTime() + 86400000).toISOString().slice(0, 10)
                : "";
              const blockOrders = treeOrders.filter(o => o.block === session.block);
              const handleSaveOrder = async () => {
                const validLines = orderLines.filter(l => l.speciesId && Number(l.quantity) > 0);
                if (!validLines.length || !session.block) return;
                setOrderSaving(true);
                const order: TreeOrder = {
                  id: `to-${uid()}`,
                  orderDate:   nextDay,
                  createdDate: session.date,
                  block:       session.block,
                  project:     session.project,
                  crewBoss:    session.crewBoss,
                  lines: validLines.map(l => {
                    const rate = rates.find(r => r.id === l.speciesId)!;
                    return { id: l.id, speciesId: rate.id, species: rate.species, code: rate.code, quantity: Number(l.quantity) };
                  }),
                };
                await saveTreeOrder(order);
                setTreeOrders(prev => [order, ...prev].sort((a, b) => b.orderDate.localeCompare(a.orderDate)));
                setOrderLines([{ id: uid(), speciesId: "", quantity: "" }]);
                setOrderSaving(false);
                showToast("Tree order saved");
              };
              return (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-secondary/40">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Tree Order — Next Day</div>
                      {nextDay && <div className="text-[10px] text-text-tertiary mt-0.5">For {nextDay}{session.block ? ` · ${session.block}` : ""}</div>}
                    </div>
                    {blockOrders.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-secondary border border-border text-text-tertiary">
                        {blockOrders.length} saved order{blockOrders.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-[1fr_110px_24px] gap-2 mb-1">
                      {["Species", "Quantity", ""].map(h => (
                        <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {orderLines.map(line => (
                        <div key={line.id} className="grid grid-cols-[1fr_110px_24px] gap-2 items-center">
                          <select value={line.speciesId}
                            onChange={e => setOrderLines(prev => prev.map(l => l.id === line.id ? { ...l, speciesId: e.target.value } : l))}
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50">
                            <option value="">Species…</option>
                            {rates.map(r => <option key={r.id} value={r.id}>{r.code} – {r.species}</option>)}
                          </select>
                          <input type="number" min="0" value={line.quantity} placeholder="0"
                            onChange={e => setOrderLines(prev => prev.map(l => l.id === line.id ? { ...l, quantity: e.target.value } : l))}
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                          <button
                            onClick={() => setOrderLines(prev => prev.filter(l => l.id !== line.id))}
                            disabled={orderLines.length === 1}
                            className="text-text-tertiary hover:text-red-400 text-sm font-bold disabled:opacity-20 disabled:cursor-not-allowed transition-colors">×</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button onClick={() => setOrderLines(prev => [...prev, { id: uid(), speciesId: "", quantity: "" }])}
                        className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                        + Add species
                      </button>
                      {orderLines.some(l => Number(l.quantity) > 0) && (
                        <div className="text-xs text-text-tertiary">
                          Total: <span className="font-bold text-text-primary">
                            {fmt(orderLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0))} trees
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      {!session.block && (
                        <span className="text-[11px] text-text-tertiary italic">Enter a block in Session Details to save an order</span>
                      )}
                      <div className="ml-auto">
                        <button onClick={handleSaveOrder}
                          disabled={orderSaving || !session.block || !orderLines.some(l => l.speciesId && Number(l.quantity) > 0)}
                          className="px-4 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                          {orderSaving ? "Saving…" : "Save Order"}
                        </button>
                      </div>
                    </div>

                    {/* Saved orders for this block */}
                    {blockOrders.length > 0 && (
                      <div className="border-t border-border/50 pt-3 space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Saved Orders{session.block ? ` — ${session.block}` : ""}</div>
                        {blockOrders.slice(0, 5).map(order => (
                          <div key={order.id} className="flex items-start justify-between gap-3 py-1.5">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-text-primary">For {order.orderDate}</span>
                                <span className="text-[10px] text-text-tertiary">· created {order.createdDate}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {order.lines.map(l => (
                                  <span key={l.id} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-secondary border border-border">
                                    <span className="font-mono font-semibold text-text-tertiary">{l.code}</span>{" "}
                                    <span className="font-medium text-text-primary">{fmt(l.quantity)}</span>
                                  </span>
                                ))}
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ background: "var(--color-primary-deep)" }}>
                                  {fmt(order.lines.reduce((s, l) => s + l.quantity, 0))} total
                                </span>
                              </div>
                            </div>
                            <button onClick={async () => { await deleteTreeOrder(order.id); setTreeOrders(prev => prev.filter(o => o.id !== order.id)); }}
                              className="text-text-tertiary hover:text-red-400 text-sm shrink-0 transition-colors">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Performance */}
            {(() => {
              const ranked = planters
                .map(p => {
                  const calc = planterCalc(p);
                  return { name: p.employeeName || `Planter ${planters.indexOf(p) + 1}`, trees: calc.totalTrees };
                })
                .filter(p => p.trees > 0)
                .sort((a, b) => b.trees - a.trees);
              if (ranked.length === 0) return null;
              const crewTotal   = ranked.reduce((s, p) => s + p.trees, 0);
              const crewAvg     = Math.round(crewTotal / ranked.length);
              const hiBaller    = ranked[0];
              return (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Performance</div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border">
                    {/* Hi-Baller */}
                    <div className="px-5 py-4">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-2">Crew Hi-Baller</div>
                      <div className="text-base font-bold text-text-primary truncate">{hiBaller.name}</div>
                      <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--color-primary)" }}>{fmt(hiBaller.trees)} trees</div>
                      {ranked.length > 1 && (
                        <div className="mt-3 space-y-1.5">
                          {ranked.slice(1).map((p, i) => (
                            <div key={p.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-text-tertiary shrink-0">#{i + 2}</span>
                                <span className="text-text-secondary truncate">{p.name}</span>
                              </div>
                              <span className="text-text-secondary font-medium shrink-0 ml-2">{fmt(p.trees)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Crew Total */}
                    <div className="px-5 py-4">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-2">Crew Total</div>
                      <div className="text-2xl font-bold text-text-primary">{fmt(crewTotal)}</div>
                      <div className="text-[10px] text-text-tertiary mt-1">trees planted today</div>
                      <div className="text-[10px] text-text-tertiary mt-0.5">{ranked.length} planter{ranked.length !== 1 ? "s" : ""} active</div>
                    </div>
                    {/* Crew Average */}
                    <div className="px-5 py-4">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-2">Crew Average</div>
                      <div className="text-2xl font-bold text-text-primary">{fmt(crewAvg)}</div>
                      <div className="text-[10px] text-text-tertiary mt-1">trees per planter</div>
                      {hiBaller.trees > crewAvg && (
                        <div className="text-[10px] mt-1" style={{ color: "var(--color-primary)" }}>
                          Hi-baller +{fmt(hiBaller.trees - crewAvg)} above avg
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Save */}
            <div className="flex justify-end">
              <button onClick={handleSaveSession} disabled={!session.date || !session.crewBoss || saving}
                className="px-6 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {saving ? "Saving…" : "Submit Report"}
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────── SUPERVISOR ─────────────────────────── */}
        {tab === "supervisor" && (() => {
          const uniqueBlocks   = [...new Set(deliveries.map(d => d.block).filter(Boolean))].sort();
          const uniqueProjects = [...new Set(deliveries.map(d => d.project).filter(Boolean))].sort();

          // Per-block inventory: sum all deliveries for each block by species
          const blockInventory = new Map<string, Map<string, { species: string; code: string; trees: number }>>();
          for (const d of deliveries) {
            if (!blockInventory.has(d.block)) blockInventory.set(d.block, new Map());
            const bMap = blockInventory.get(d.block)!;
            for (const l of d.lines) {
              const existing = bMap.get(l.speciesId) ?? { species: l.species, code: l.code, trees: 0 };
              existing.trees += l.trees;
              bMap.set(l.speciesId, existing);
            }
          }

          const visibleDeliveries = supBlockFilter === "all"
            ? deliveries
            : deliveries.filter(d => d.block === supBlockFilter);

          function handleEditDelivery(d: SupervisorDelivery) {
            setEditDeliveryId(d.id);
            setSupDate(d.date);
            setSupBlock(d.block);
            setSupProject(d.project ?? "");
            setSupLoadNum(d.loadNumber ?? "");
            setSupBy(d.deliveredBy ?? "");
            setSupNotes(d.notes ?? "");
            setSupLines(d.lines.map(l => ({ id: l.id, speciesId: l.speciesId, trees: String(l.trees), boxes: undefined })));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }

          function handleCancelEdit() {
            setEditDeliveryId(null);
            setSupLines([{ id: uid(), speciesId: "", trees: "" }]);
            setSupLoadNum(""); setSupBy(""); setSupNotes(""); setSupBlock("");
          }

          async function handleSaveDelivery() {
            if (!supDate || !supBlock) return;
            setSupSaving(true);
            const lines: SupervisorDeliveryLine[] = supLines
              .filter(l => l.speciesId && Number(l.trees) > 0)
              .map(l => {
                const rate = rates.find(r => r.id === l.speciesId)!;
                return { id: l.id, speciesId: rate.id, species: rate.species, code: rate.code, trees: Number(l.trees) };
              });
            if (lines.length === 0) { setSupSaving(false); return; }
            const delivery: SupervisorDelivery = {
              id: editDeliveryId ?? `sd-sup-${uid()}`,
              date: supDate, project: supProject, block: supBlock,
              loadNumber: supLoadNum || undefined,
              deliveredBy: supBy || undefined,
              notes: supNotes || undefined,
              lines,
              totalTrees: lines.reduce((s, l) => s + l.trees, 0),
            };
            await saveSupervisorDelivery(delivery);
            if (editDeliveryId) {
              setDeliveries(prev => prev.map(x => x.id === editDeliveryId ? delivery : x));
              setEditDeliveryId(null);
              showToast("Delivery updated");
            } else {
              setDeliveries(prev => [delivery, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
              showToast("Delivery recorded");
            }
            setSupLines([{ id: uid(), speciesId: "", trees: "" }]);
            setSupLoadNum(""); setSupBy(""); setSupNotes(""); setSupBlock("");
            setSupSaving(false);
          }

          return (
            <div className="max-w-5xl mx-auto space-y-6">

              {/* ── Entry form ── */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                    {editDeliveryId ? "Edit Delivery" : "Record Tree Delivery"}
                  </div>
                  {editDeliveryId && (
                    <button onClick={handleCancelEdit} className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors">
                      ✕ Cancel Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" value={supDate} onChange={e => setSupDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Block *</label>
                    <input list="sup-block-list" value={supBlock}
                      onChange={e => setSupBlock(e.target.value)}
                      placeholder="e.g. Block 3A" className={inputCls} />
                    <datalist id="sup-block-list">{uniqueBlocks.map(b => <option key={b} value={b} />)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Project</label>
                    <input list="sup-proj-list" value={supProject}
                      onChange={e => setSupProject(e.target.value)}
                      placeholder="Project name…" className={inputCls} />
                    <datalist id="sup-proj-list">{uniqueProjects.map(p => <option key={p} value={p} />)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Load #</label>
                    <input value={supLoadNum} onChange={e => setSupLoadNum(e.target.value)} placeholder="e.g. Load 1" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Delivered By</label>
                    <input value={supBy} onChange={e => setSupBy(e.target.value)} placeholder="Driver / supervisor" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <input value={supNotes} onChange={e => setSupNotes(e.target.value)} placeholder="Optional…" className={inputCls} />
                  </div>
                </div>

                {/* Species lines */}
                <div>
                  <div className="grid grid-cols-[1fr_80px_110px_24px] gap-2 mb-1.5">
                    {["Species", "Boxes", "Trees Delivered", ""].map(h => (
                      <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {supLines.map(line => {
                      const rate = rates.find(r => r.id === line.speciesId);
                      const hasBoxRate = (rate?.treesPerBox ?? 0) > 0;
                      return (
                        <div key={line.id} className="grid grid-cols-[1fr_80px_110px_24px] gap-2 items-center">
                          <select value={line.speciesId}
                            onChange={e => setSupLines(prev => prev.map(l => l.id === line.id ? { ...l, speciesId: e.target.value, boxes: undefined, trees: "" } : l))}
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50">
                            <option value="">Species…</option>
                            {rates.map(r => <option key={r.id} value={r.id}>{r.code} – {r.species}</option>)}
                          </select>
                          {hasBoxRate ? (
                            <input type="number" min="0" value={line.boxes ?? ""}
                              onChange={e => {
                                const boxes = e.target.value;
                                const computed = boxes !== "" ? String(Math.round(Number(boxes) * (rate!.treesPerBox ?? 0))) : "";
                                setSupLines(prev => prev.map(l => l.id === line.id ? { ...l, boxes, trees: computed } : l));
                              }}
                              placeholder="0"
                              title={`× ${rate!.treesPerBox} trees/box`}
                              className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                          ) : (
                            <div className="text-right text-xs text-text-tertiary">—</div>
                          )}
                          <input type="number" min="0" value={line.trees} placeholder="0"
                            onChange={e => setSupLines(prev => prev.map(l => l.id === line.id ? { ...l, trees: e.target.value, boxes: undefined } : l))}
                            className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                          <button
                            onClick={() => setSupLines(prev => prev.filter(l => l.id !== line.id))}
                            disabled={supLines.length === 1}
                            className="text-text-tertiary hover:text-red-400 text-sm font-bold disabled:opacity-20 disabled:cursor-not-allowed transition-colors">×</button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => setSupLines(prev => [...prev, { id: uid(), speciesId: "", trees: "" }])}
                      className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                      + Add Species
                    </button>
                    {supLines.some(l => Number(l.trees) > 0) && (
                      <div className="text-xs text-text-tertiary">
                        Total: <span className="font-bold text-text-primary">
                          {fmt(supLines.reduce((s, l) => s + (Number(l.trees) || 0), 0))} trees
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <button onClick={handleSaveDelivery}
                    disabled={!supDate || !supBlock || supSaving}
                    className="px-6 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                    {supSaving ? "Saving…" : editDeliveryId ? "Update Delivery" : "Record Delivery"}
                  </button>
                </div>
              </div>

              {/* ── Tree Transfer ── */}
              {(() => {
                // All known block names from deliveries + project blocks, plus Reefer Storage
                const knownBlocks = [
                  REEFER_STORAGE,
                  ...Array.from(new Set([
                    ...deliveries.map(d => d.block),
                    ...projectBlocks.map(b => b.blockName),
                  ])).filter(Boolean).sort(),
                ];

                async function handleSaveTransfer() {
                  if (!xfrDate || !xfrFrom || !xfrTo || xfrFrom === xfrTo) return;
                  const lines: TreeTransferLine[] = xfrLines
                    .filter(l => l.speciesId && Number(l.trees) > 0)
                    .map(l => {
                      const rate = rates.find(r => r.id === l.speciesId)!;
                      return { id: l.id, speciesId: rate.id, species: rate.species, code: rate.code, trees: Number(l.trees) };
                    });
                  if (lines.length === 0) return;
                  setXfrSaving(true);
                  const transfer: TreeTransfer = {
                    id: `xfr-${uid()}`,
                    date: xfrDate,
                    fromBlock: xfrFrom,
                    toBlock: xfrTo,
                    lines,
                    totalTrees: lines.reduce((s, l) => s + l.trees, 0),
                    notes: xfrNotes || undefined,
                  };
                  await saveTreeTransfer(transfer);
                  setTransfers(prev => [transfer, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
                  setXfrLines([{ id: uid(), speciesId: "", trees: "" }]);
                  setXfrFrom(""); setXfrTo(""); setXfrNotes("");
                  setXfrSaving(false);
                  showToast("Transfer recorded");
                }

                const canSave = !!xfrDate && !!xfrFrom && !!xfrTo && xfrFrom !== xfrTo
                  && xfrLines.some(l => l.speciesId && Number(l.trees) > 0);

                return (
                  <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Tree Transfer</div>

                    {/* From / To / Date */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelCls}>Date *</label>
                        <input type="date" value={xfrDate} onChange={e => setXfrDate(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>From *</label>
                        <input list="xfr-from-list" value={xfrFrom}
                          onChange={e => setXfrFrom(e.target.value)}
                          placeholder="Block or Reefer Storage" className={inputCls} />
                        <datalist id="xfr-from-list">
                          {knownBlocks.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className={labelCls}>To *</label>
                        <input list="xfr-to-list" value={xfrTo}
                          onChange={e => setXfrTo(e.target.value)}
                          placeholder="Block or Reefer Storage" className={inputCls} />
                        <datalist id="xfr-to-list">
                          {knownBlocks.filter(b => b !== xfrFrom).map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                      <div className="col-span-3">
                        <label className={labelCls}>Notes</label>
                        <input value={xfrNotes} onChange={e => setXfrNotes(e.target.value)} placeholder="Optional…" className={inputCls} />
                      </div>
                    </div>

                    {/* Validation hint */}
                    {xfrFrom && xfrTo && xfrFrom === xfrTo && (
                      <div className="text-[11px] text-red-400">"From" and "To" must be different.</div>
                    )}

                    {/* Direction indicator */}
                    {xfrFrom && xfrTo && xfrFrom !== xfrTo && (
                      <div className="flex items-center gap-2 text-[11px] text-text-secondary px-3 py-2 bg-surface-secondary border border-border rounded-lg">
                        <span className="font-semibold text-text-primary truncate">{xfrFrom}</span>
                        <span className="shrink-0">→</span>
                        <span className="font-semibold text-text-primary truncate">{xfrTo}</span>
                      </div>
                    )}

                    {/* Species lines */}
                    <div>
                      <div className="grid grid-cols-[1fr_110px_24px] gap-2 mb-1.5">
                        {["Species", "Trees to Transfer", ""].map(h => (
                          <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {xfrLines.map(line => (
                          <div key={line.id} className="grid grid-cols-[1fr_110px_24px] gap-2 items-center">
                            <select value={line.speciesId}
                              onChange={e => setXfrLines(prev => prev.map(l => l.id === line.id ? { ...l, speciesId: e.target.value } : l))}
                              className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50">
                              <option value="">Species…</option>
                              {rates.map(r => <option key={r.id} value={r.id}>{r.code} – {r.species}</option>)}
                            </select>
                            <input type="number" min="0" value={line.trees} placeholder="0"
                              onChange={e => setXfrLines(prev => prev.map(l => l.id === line.id ? { ...l, trees: e.target.value } : l))}
                              className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                            <button
                              onClick={() => setXfrLines(prev => prev.filter(l => l.id !== line.id))}
                              disabled={xfrLines.length === 1}
                              className="text-text-tertiary hover:text-red-400 text-sm font-bold disabled:opacity-20 disabled:cursor-not-allowed transition-colors">×</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <button
                          onClick={() => setXfrLines(prev => [...prev, { id: uid(), speciesId: "", trees: "" }])}
                          className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                          + Add Species
                        </button>
                        {xfrLines.some(l => Number(l.trees) > 0) && (
                          <div className="text-xs text-text-tertiary">
                            Total: <span className="font-bold text-text-primary">
                              {fmt(xfrLines.reduce((s, l) => s + (Number(l.trees) || 0), 0))} trees
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border">
                      <button onClick={handleSaveTransfer}
                        disabled={!canSave || xfrSaving}
                        className="px-6 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                        {xfrSaving ? "Saving…" : "Record Transfer"}
                      </button>
                    </div>

                    {/* Transfer log */}
                    {transfers.length > 0 && (
                      <div className="border-t border-border pt-4 space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">Transfer Log</div>
                        {transfers.map(t => (
                          <div key={t.id} className="flex items-start justify-between px-3 py-2.5 bg-surface-secondary border border-border rounded-lg hover:bg-surface-secondary/80 transition-colors">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-text-tertiary">{t.date}</span>
                                <span className="text-xs font-semibold text-text-primary">{t.fromBlock}</span>
                                <span className="text-[10px] text-text-tertiary">→</span>
                                <span className="text-xs font-semibold text-text-primary">{t.toBlock}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {t.lines.map(l => (
                                  <span key={l.id} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
                                    <span className="font-mono font-semibold text-text-primary">{l.code}</span> {fmt(l.trees)}
                                  </span>
                                ))}
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--color-primary-deep)" }}>
                                  {fmt(t.totalTrees)} total
                                </span>
                              </div>
                              {t.notes && <div className="text-[10px] text-text-tertiary italic">{t.notes}</div>}
                            </div>
                            <button
                              onClick={async () => { await deleteTreeTransfer(t.id); setTransfers(prev => prev.filter(x => x.id !== t.id)); }}
                              className="text-text-tertiary hover:text-red-400 text-sm font-bold shrink-0 ml-4 transition-colors">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Block Inventory ── */}
              {blockInventory.size > 0 && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Delivered Inventory by Block</div>
                  </div>
                  <div className="divide-y divide-border">
                    {[...blockInventory.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([block, sMap]) => {
                      const blockTotal = [...sMap.values()].reduce((s, v) => s + v.trees, 0);
                      return (
                        <div key={block} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-semibold text-text-primary">{block}</div>
                            <div className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>{fmt(blockTotal)} trees</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[...sMap.values()].sort((a, b) => b.trees - a.trees).map(s => (
                              <div key={s.code} className="bg-surface-secondary border border-border rounded-lg px-3 py-2 min-w-[80px]">
                                <div className="text-[10px] font-mono font-semibold text-text-tertiary">{s.code}</div>
                                <div className="text-sm font-bold text-text-primary mt-0.5">{fmt(s.trees)}</div>
                                <div className="text-[10px] text-text-tertiary truncate">{s.species}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Delivery Log ── */}
              {deliveries.length > 0 && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-secondary/40">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                      Delivery Log
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={supBlockFilter} onChange={e => setSupBlockFilter(e.target.value)}
                        className="text-[11px] border border-border rounded-lg px-2 py-1 bg-surface text-text-secondary focus:outline-none">
                        <option value="all">All blocks</option>
                        {uniqueBlocks.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {visibleDeliveries.map(d => (
                      <div key={d.id} className="flex items-start justify-between px-5 py-3 hover:bg-surface-secondary/30 transition-colors">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-text-primary">{d.block}</span>
                            <span className="text-[10px] text-text-tertiary">{d.date}</span>
                            {d.loadNumber && <span className="text-[10px] px-1.5 py-0.5 bg-surface-secondary border border-border rounded font-mono text-text-tertiary">{d.loadNumber}</span>}
                            {d.project && <span className="text-[10px] text-text-tertiary">· {d.project}</span>}
                            {d.deliveredBy && <span className="text-[10px] text-text-tertiary">· {d.deliveredBy}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {d.lines.map(l => (
                              <span key={l.id} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-secondary border border-border text-text-secondary">
                                <span className="font-mono font-semibold text-text-primary">{l.code}</span> {fmt(l.trees)}
                              </span>
                            ))}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--color-primary-deep)" }}>
                              {fmt(d.totalTrees)} total
                            </span>
                          </div>
                          {d.notes && <div className="text-[10px] text-text-tertiary italic">{d.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <button
                            onClick={() => handleEditDelivery(d)}
                            className="text-[11px] text-text-tertiary hover:text-primary transition-colors font-medium"
                          >✎ Edit</button>
                          <button onClick={async () => { await deleteSupervisorDelivery(d.id); setDeliveries(prev => prev.filter(x => x.id !== d.id)); }}
                            className="text-text-tertiary hover:text-red-400 text-sm font-bold transition-colors">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deliveries.length === 0 && (
                <div className="text-center py-16 text-text-tertiary">
                  <div className="text-3xl opacity-20 mb-2">🌲</div>
                  <div className="text-sm">No deliveries recorded yet.</div>
                  <div className="text-xs mt-1">Record a tree delivery above to set block inventory.</div>
                </div>
              )}

            </div>
          );
        })()}

        {/* ─────────────────────────── DAILY SUMMARY ───────────────────────── */}
        {tab === "daily" && (() => {
          // ── Filtered slices ──────────────────────────────────────────────
          const dsLoads      = nurseryLoads.filter(l => l.loadDate >= dsDateFrom && l.loadDate <= dsDateTo);
          const dsDeliveries = deliveries.filter(d => d.date >= dsDateFrom && d.date <= dsDateTo);
          const dsEntries    = entries.filter(e => e.date >= dsDateFrom && e.date <= dsDateTo);
          const dsTransfers  = transfers.filter(t => t.date >= dsDateFrom && t.date <= dsDateTo);

          // ── Reefer Inventory: trees that arrived from nursery ────────────
          // Group by species across all loads in date range
          const reeferBySpecies = new Map<string, { species: string; code: string; trees: number }>();
          for (const load of dsLoads) {
            for (const sp of load.species) {
              const total = sp.treesPerBox * sp.numberOfBoxes;
              if (!total) continue;
              const key = sp.species.toLowerCase().trim();
              const ex  = reeferBySpecies.get(key) ?? { species: sp.species, code: sp.species.slice(0, 2).toUpperCase(), trees: 0 };
              ex.trees += total;
              reeferBySpecies.set(key, ex);
            }
          }
          const reeferTotal = [...reeferBySpecies.values()].reduce((s, v) => s + v.trees, 0);

          // ── Deliveries to blocks: per-block per-species ───────────────────
          const deliveryByBlock = new Map<string, Map<string, { species: string; code: string; trees: number }>>();
          for (const d of dsDeliveries) {
            if (!deliveryByBlock.has(d.block)) deliveryByBlock.set(d.block, new Map());
            const bMap = deliveryByBlock.get(d.block)!;
            for (const l of d.lines) {
              const ex = bMap.get(l.speciesId) ?? { species: l.species, code: l.code, trees: 0 };
              ex.trees += l.trees;
              bMap.set(l.speciesId, ex);
            }
          }
          const deliveryTotal = dsDeliveries.reduce((s, d) => s + d.totalTrees, 0);

          // ── Planted by block: per-block per-species ───────────────────────
          const plantedByBlock = new Map<string, Map<string, { species: string; code: string; trees: number }>>();
          for (const e of dsEntries) {
            if (!plantedByBlock.has(e.block)) plantedByBlock.set(e.block, new Map());
            const bMap = plantedByBlock.get(e.block)!;
            for (const l of e.production) {
              const ex = bMap.get(l.speciesId) ?? { species: l.species, code: l.code, trees: 0 };
              ex.trees += l.trees;
              bMap.set(l.speciesId, ex);
            }
          }
          const plantedTotal = dsEntries.reduce((s, e) => s + e.totalTrees, 0);

          // Per-crew planted trees per block
          const plantedByBlockByCrew = new Map<string, Map<string, number>>();
          for (const e of dsEntries) {
            if (!plantedByBlockByCrew.has(e.block)) plantedByBlockByCrew.set(e.block, new Map());
            const crewMap = plantedByBlockByCrew.get(e.block)!;
            const boss = e.crewBoss || "Unknown";
            crewMap.set(boss, (crewMap.get(boss) ?? 0) + e.totalTrees);
          }

          // ── Transfers: per-block per-species adjustments ──────────────────
          const transferInByBlock  = new Map<string, Map<string, { species: string; code: string; trees: number }>>();
          const transferOutByBlock = new Map<string, Map<string, { species: string; code: string; trees: number }>>();
          for (const t of dsTransfers) {
            if (!transferOutByBlock.has(t.fromBlock)) transferOutByBlock.set(t.fromBlock, new Map());
            const outMap = transferOutByBlock.get(t.fromBlock)!;
            for (const l of t.lines) {
              const ex = outMap.get(l.speciesId) ?? { species: l.species, code: l.code, trees: 0 };
              ex.trees += l.trees; outMap.set(l.speciesId, ex);
            }
            if (!transferInByBlock.has(t.toBlock)) transferInByBlock.set(t.toBlock, new Map());
            const inMap = transferInByBlock.get(t.toBlock)!;
            for (const l of t.lines) {
              const ex = inMap.get(l.speciesId) ?? { species: l.species, code: l.code, trees: 0 };
              ex.trees += l.trees; inMap.set(l.speciesId, ex);
            }
          }
          const transferTotal = dsTransfers.reduce((s, t) => s + t.totalTrees, 0);

          // ── Block balance ─────────────────────────────────────────────────
          const allBlocks = [...new Set([
            ...deliveryByBlock.keys(),
            ...plantedByBlock.keys(),
            ...transferInByBlock.keys(),
            ...transferOutByBlock.keys(),
          ])].filter(b => b !== REEFER_STORAGE).sort();

          const blockBalances = allBlocks.map(block => {
            const delivered = [...(deliveryByBlock.get(block)?.values() ?? [])].reduce((s, v) => s + v.trees, 0);
            const planted   = [...(plantedByBlock.get(block)?.values() ?? [])].reduce((s, v) => s + v.trees, 0);
            const xfrIn     = [...(transferInByBlock.get(block)?.values() ?? [])].reduce((s, v) => s + v.trees, 0);
            const xfrOut    = [...(transferOutByBlock.get(block)?.values() ?? [])].reduce((s, v) => s + v.trees, 0);
            const remaining = delivered + xfrIn - xfrOut - planted;

            // Per-species detail
            const allSpeciesIds = new Set([
              ...(deliveryByBlock.get(block)?.keys() ?? []),
              ...(plantedByBlock.get(block)?.keys() ?? []),
              ...(transferInByBlock.get(block)?.keys() ?? []),
              ...(transferOutByBlock.get(block)?.keys() ?? []),
            ]);
            const speciesRows = [...allSpeciesIds].map(sid => {
              const dSp   = deliveryByBlock.get(block)?.get(sid);
              const pSp   = plantedByBlock.get(block)?.get(sid);
              const inSp  = transferInByBlock.get(block)?.get(sid);
              const outSp = transferOutByBlock.get(block)?.get(sid);
              return {
                species: dSp?.species ?? inSp?.species ?? outSp?.species ?? pSp?.species ?? sid,
                code:    dSp?.code    ?? inSp?.code    ?? outSp?.code    ?? pSp?.code    ?? "?",
                delivered:  dSp?.trees  ?? 0,
                xfrIn:      inSp?.trees  ?? 0,
                xfrOut:     outSp?.trees ?? 0,
                planted:    pSp?.trees   ?? 0,
                remaining:  (dSp?.trees ?? 0) + (inSp?.trees ?? 0) - (outSp?.trees ?? 0) - (pSp?.trees ?? 0),
              };
            }).sort((a, b) => b.delivered - a.delivered);

            return { block, delivered, xfrIn, xfrOut, planted, remaining, speciesRows };
          });

          const reeferXfrOut    = [...(transferOutByBlock.get(REEFER_STORAGE)?.values() ?? [])].reduce((s, v) => s + v.trees, 0);
          const reeferXfrIn     = [...(transferInByBlock.get(REEFER_STORAGE)?.values() ?? [])].reduce((s, v) => s + v.trees, 0);
          const reeferRemaining = reeferTotal - deliveryTotal - reeferXfrOut + reeferXfrIn;

          return (
            <div className="max-w-5xl mx-auto space-y-6">

              {/* Date range filter */}
              <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary shrink-0">Date Range</div>
                <input type="date" value={dsDateFrom} onChange={e => setDsDateFrom(e.target.value)}
                  className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                <span className="text-text-tertiary text-xs">→</span>
                <input type="date" value={dsDateTo} onChange={e => setDsDateTo(e.target.value)}
                  className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: "Reefer In",           value: fmt(reeferTotal),      sub: `${dsLoads.length} load${dsLoads.length !== 1 ? "s" : ""}` },
                  { label: "Delivered to Blocks", value: fmt(deliveryTotal),    sub: `${dsDeliveries.length} delivery${dsDeliveries.length !== 1 ? "ies" : "y"}` },
                  { label: "Transferred",          value: fmt(transferTotal),    sub: `${dsTransfers.length} transfer${dsTransfers.length !== 1 ? "s" : ""}` },
                  { label: "Trees Planted",        value: fmt(plantedTotal),     sub: `${new Set(dsEntries.map(e => e.employeeName)).size} planters` },
                  { label: "Remaining in Reefer",  value: fmt(Math.max(0, reeferRemaining)), sub: reeferTotal > 0 ? `${Math.round((Math.max(0, reeferRemaining) / reeferTotal) * 100)}% of stock` : "No reefer data" },
                ].map(k => (
                  <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                    <div className="text-2xl font-bold text-text-primary mt-1">{k.value}</div>
                    <div className="text-[10px] text-text-tertiary mt-1">{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Reefer Inventory */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Reefer Inventory</div>
                  <div className="text-xs font-bold text-text-primary">{fmt(reeferTotal)} trees</div>
                </div>
                {reeferBySpecies.size === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No nursery loads recorded for this date range.</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {[...reeferBySpecies.values()].sort((a, b) => b.trees - a.trees).map(s => (
                      <div key={s.species} className="flex items-center justify-between px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold text-text-tertiary w-6">{s.code}</span>
                          <span className="text-xs text-text-primary">{s.species}</span>
                        </div>
                        <span className="text-xs font-semibold text-text-primary">{fmt(s.trees)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-2.5 bg-surface-secondary/30">
                      <span className="text-xs font-bold text-text-primary">Total</span>
                      <span className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>{fmt(reeferTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tree Deliveries to Blocks */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Tree Deliveries to Blocks</div>
                  <div className="text-xs font-bold text-text-primary">{fmt(deliveryTotal)} trees</div>
                </div>
                {deliveryByBlock.size === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No deliveries recorded for this date range.</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {[...deliveryByBlock.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([block, sMap]) => {
                      const blockTotal = [...sMap.values()].reduce((s, v) => s + v.trees, 0);
                      return (
                        <div key={block} className="px-5 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-text-primary">{block}</span>
                            <span className="text-xs font-semibold text-text-primary">{fmt(blockTotal)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[...sMap.values()].sort((a, b) => b.trees - a.trees).map(s => (
                              <span key={s.code} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-secondary border border-border font-medium">
                                <span className="font-mono font-semibold text-text-tertiary">{s.code}</span>{" "}
                                <span className="text-text-primary">{fmt(s.trees)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Planted Trees by Block */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Planted Trees by Block</div>
                  <div className="text-xs font-bold text-text-primary">{fmt(plantedTotal)} trees</div>
                </div>
                {plantedByBlock.size === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No production entries for this date range.</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {[...plantedByBlock.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([block, sMap]) => {
                      const blockTotal = [...sMap.values()].reduce((s, v) => s + v.trees, 0);
                      const planterCount = new Set(dsEntries.filter(e => e.block === block).map(e => e.employeeName)).size;
                      const crewMap = plantedByBlockByCrew.get(block);
                      const crewEntries = crewMap ? [...crewMap.entries()].sort((a, b) => b[1] - a[1]) : [];
                      return (
                        <div key={block} className="px-5 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="text-xs font-semibold text-text-primary">{block}</span>
                              <span className="text-[10px] text-text-tertiary ml-2">{planterCount} planter{planterCount !== 1 ? "s" : ""}</span>
                            </div>
                            <span className="text-xs font-semibold text-text-primary">{fmt(blockTotal)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[...sMap.values()].sort((a, b) => b.trees - a.trees).map(s => (
                              <span key={s.code} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-secondary border border-border font-medium">
                                <span className="font-mono font-semibold text-text-tertiary">{s.code}</span>{" "}
                                <span className="text-text-primary">{fmt(s.trees)}</span>
                              </span>
                            ))}
                          </div>
                          {crewEntries.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/40">
                              {crewEntries.map(([crew, trees]) => (
                                <span key={crew} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 border border-primary/20 font-medium">
                                  <span className="text-text-tertiary">{crew}:</span>{" "}
                                  <span className="text-text-primary font-semibold">{fmt(trees)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Trees Remaining on Block */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Trees Remaining on Block</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">Delivered + Transfer In − Transfer Out − Planted = Remaining</div>
                </div>
                {allBlocks.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No block data for this date range.</div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_100px_80px_80px_80px] gap-2 px-5 py-2 border-b border-border/50 bg-surface-secondary/20">
                      {["Block", "Prescription", "Delivered", "Planted", "Remaining"].map(h => (
                        <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary text-right first:text-left">{h}</div>
                      ))}
                    </div>
                    <div className="divide-y divide-border/40">
                      {blockBalances.map(b => {
                        const isDeficit = b.remaining < 0;
                        const remainColor = b.remaining > 0
                          ? "var(--color-primary)"
                          : b.remaining < 0
                          ? "var(--color-danger)"
                          : "var(--color-text-tertiary)";
                        const blockCrewBosses = [...new Set(dsEntries.filter(e => e.block === b.block).map(e => e.crewBoss))].filter(Boolean).sort();
                        const blockOrders = treeOrders.filter(o => o.block === b.block && o.createdDate >= dsDateFrom && o.createdDate <= dsDateTo);

                        // Match prescription from Projects → Add Block (case-insensitive name match)
                        const prescription = projectBlocks.find(
                          pb => pb.blockName.trim().toLowerCase() === b.block.trim().toLowerCase()
                        );
                        const prescriptionTotal = prescription
                          ? prescription.allocations.reduce((s, a) => s + a.trees, 0)
                          : null;
                        // Build a lookup from species name → prescribed trees for the species breakdown
                        const prescriptionBySpecies = prescription
                          ? new Map(prescription.allocations.map(a => [a.species.trim().toLowerCase(), a.trees]))
                          : new Map<string, number>();

                        return (
                          <div key={b.block}>
                            {/* Block summary row */}
                            <div className="grid grid-cols-[1fr_100px_80px_80px_80px] gap-2 px-5 py-3 items-start">
                              <div>
                                <div className="text-xs font-semibold text-text-primary">{b.block}</div>
                                {blockCrewBosses.length > 0 && (
                                  <div className="text-[10px] text-text-tertiary mt-0.5">
                                    {blockCrewBosses.join(", ")}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                {prescriptionTotal != null ? (
                                  <div className="text-xs font-semibold" style={{ color: "var(--color-info)" }}>
                                    {fmt(prescriptionTotal)}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-text-tertiary">—</div>
                                )}
                                {prescription && (
                                  <div className="flex flex-col items-end gap-0.5 mt-1">
                                    {prescription.allocations.map(a => (
                                      <span key={a.id} className="text-[9px] text-text-tertiary">
                                        {a.species.slice(0, 2).toUpperCase()} {fmt(a.trees)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-right text-text-secondary pt-0.5">
                                {fmt(b.delivered)}
                                {(b.xfrIn > 0 || b.xfrOut > 0) && (
                                  <div className="text-[9px] text-text-tertiary leading-tight">
                                    {b.xfrIn > 0 && <span className="text-emerald-500">+{fmt(b.xfrIn)}</span>}
                                    {b.xfrIn > 0 && b.xfrOut > 0 && " "}
                                    {b.xfrOut > 0 && <span className="text-red-400">−{fmt(b.xfrOut)}</span>}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-right text-text-secondary pt-0.5">{fmt(b.planted)}</div>
                              <div className="text-xs font-bold text-right pt-0.5" style={{ color: remainColor }}>
                                {isDeficit ? "−" : ""}{fmt(Math.abs(b.remaining))}
                              </div>
                            </div>
                            {/* Species breakdown */}
                            {b.speciesRows.length > 1 && (
                              <div className="px-5 pb-3 space-y-1">
                                {b.speciesRows.map(s => {
                                  const sRemainColor = s.remaining > 0 ? "var(--color-primary)" : s.remaining < 0 ? "var(--color-danger)" : "var(--color-text-tertiary)";
                                  const prescribed = prescriptionBySpecies.get(s.species.trim().toLowerCase()) ?? null;
                                  return (
                                    <div key={s.code} className="grid grid-cols-[1fr_100px_80px_80px_80px] gap-2 items-center">
                                      <div className="flex items-center gap-1.5 pl-4">
                                        <span className="text-[10px] font-mono font-semibold text-text-tertiary">{s.code}</span>
                                        <span className="text-[10px] text-text-tertiary">{s.species}</span>
                                      </div>
                                      <div className="text-[10px] text-right" style={{ color: prescribed != null ? "var(--color-info)" : undefined }}>
                                        {prescribed != null ? fmt(prescribed) : "—"}
                                      </div>
                                      <div className="text-[10px] text-right text-text-tertiary">
                                        {s.delivered > 0 ? fmt(s.delivered) : "—"}
                                        {(s.xfrIn > 0 || s.xfrOut > 0) && (
                                          <div className="text-[9px] leading-tight">
                                            {s.xfrIn > 0 && <span className="text-emerald-500">+{fmt(s.xfrIn)}</span>}
                                            {s.xfrIn > 0 && s.xfrOut > 0 && " "}
                                            {s.xfrOut > 0 && <span className="text-red-400">−{fmt(s.xfrOut)}</span>}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-right text-text-tertiary">{s.planted > 0 ? fmt(s.planted) : "—"}</div>
                                      <div className="text-[10px] font-semibold text-right" style={{ color: sRemainColor }}>
                                        {s.remaining < 0 ? "−" : ""}{fmt(Math.abs(s.remaining))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {/* Crew breakdown */}
                            {(() => {
                              const crewMap = plantedByBlockByCrew.get(b.block);
                              if (!crewMap || crewMap.size === 0) return null;
                              const crewList = [...crewMap.entries()].sort((a, bv) => bv[1] - a[1]);
                              return (
                                <div className="px-5 pb-3">
                                  <div className="text-[9px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">Planted by Crew</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {crewList.map(([crew, trees]) => (
                                      <span key={crew} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 border border-primary/20 font-medium">
                                        <span className="text-text-tertiary">{crew}:</span>{" "}
                                        <span className="text-text-primary font-semibold">{fmt(trees)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Tree Orders for next day */}
                            {blockOrders.length > 0 && (
                              <div className="mx-5 mb-3 rounded-lg border border-border overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary/60 border-b border-border/50">
                                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-warning)" }}>Tree Order — Next Day</span>
                                </div>
                                {blockOrders.map(order => {
                                  const orderTotal = order.lines.reduce((s, l) => s + l.quantity, 0);
                                  return (
                                    <div key={order.id} className="px-3 py-2.5 border-b border-border/30 last:border-b-0">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-semibold text-text-primary">For {order.orderDate}</span>
                                          {order.crewBoss && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-text-secondary font-medium">
                                              {order.crewBoss}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] font-bold text-text-primary">{fmt(orderTotal)} trees</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {order.lines.map(l => (
                                          <span key={l.id} className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-border">
                                            <span className="font-mono font-semibold text-text-tertiary">{l.code}</span>{" "}
                                            <span className="font-medium text-text-primary">{fmt(l.quantity)}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Grand total row */}
                      <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-5 py-3 bg-surface-secondary/30 border-t border-border">
                        <div className="text-xs font-bold text-text-primary">Total</div>
                        <div className="text-xs font-bold text-right text-text-primary">{fmt(deliveryTotal)}</div>
                        <div className="text-xs font-bold text-right text-text-primary">{fmt(plantedTotal)}</div>
                        <div className="text-xs font-bold text-right" style={{ color: deliveryTotal - plantedTotal >= 0 ? "var(--color-primary)" : "var(--color-danger)" }}>
                          {deliveryTotal - plantedTotal < 0 ? "−" : ""}{fmt(Math.abs(deliveryTotal - plantedTotal))}
                        </div>
                        <div className="text-xs font-bold text-right" style={{ color: "var(--color-info)" }}>
                          {(() => {
                            const t = projectBlocks
                              .filter(pb => allBlocks.some(b => b.trim().toLowerCase() === pb.blockName.trim().toLowerCase()))
                              .reduce((s, pb) => s + pb.allocations.reduce((ss, a) => ss + a.trees, 0), 0);
                            return t > 0 ? fmt(t) : "—";
                          })()}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Upcoming Blocks */}
              {(() => {
                const handleAddPlan = async () => {
                  if (!upcomingBlockSel) return;
                  const plan: UpcomingBlockPlan = {
                    id: `ubp-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                    blockName: upcomingBlockSel,
                    crewName: upcomingCrew.trim(),
                    notes: upcomingNotes.trim() || undefined,
                    sortOrder: upcomingPlans.length,
                  };
                  await saveUpcomingBlockPlan(plan);
                  setUpcomingPlans(prev => [...prev, plan]);
                  setUpcomingBlockSel(""); setUpcomingCrew(""); setUpcomingNotes("");
                };

                const handleRemovePlan = async (id: string) => {
                  await deleteUpcomingBlockPlan(id);
                  setUpcomingPlans(prev => prev.filter(p => p.id !== id));
                };

                const handleUpdateCrew = async (plan: UpcomingBlockPlan, crewName: string) => {
                  const updated = { ...plan, crewName };
                  await saveUpcomingBlockPlan(updated);
                  setUpcomingPlans(prev => prev.map(p => p.id === plan.id ? updated : p));
                };

                // All known block names: from project_blocks + blocks already active
                const knownBlocks = [...new Set([
                  ...projectBlocks.map(pb => pb.blockName),
                  ...allBlocks,
                ])].sort();

                return (
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Upcoming Blocks</div>
                      <div className="text-[10px] text-text-tertiary mt-0.5">Plan upcoming blocks with crew assignments and species prescriptions</div>
                    </div>

                    {/* Add form */}
                    <div className="px-5 py-4 border-b border-border/50 bg-surface-secondary/20">
                      <div className="flex items-end gap-2 flex-wrap">
                        <div className="flex-1 min-w-[160px]">
                          <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">Block</label>
                          <input
                            list="upcoming-block-list"
                            value={upcomingBlockSel}
                            onChange={e => setUpcomingBlockSel(e.target.value)}
                            placeholder="Select or type block name…"
                            className="w-full text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
                          />
                          <datalist id="upcoming-block-list">
                            {knownBlocks.map(b => <option key={b} value={b} />)}
                          </datalist>
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">Crew</label>
                          <input
                            value={upcomingCrew}
                            onChange={e => setUpcomingCrew(e.target.value)}
                            placeholder="Crew boss name…"
                            className="w-full text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
                          />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">Notes</label>
                          <input
                            value={upcomingNotes}
                            onChange={e => setUpcomingNotes(e.target.value)}
                            placeholder="Optional notes…"
                            className="w-full text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
                          />
                        </div>
                        <button
                          onClick={handleAddPlan}
                          disabled={!upcomingBlockSel.trim()}
                          className="px-4 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                        >
                          + Add Block
                        </button>
                      </div>
                    </div>

                    {/* Upcoming block list */}
                    {upcomingPlans.length === 0 ? (
                      <div className="px-5 py-8 text-center text-xs text-text-tertiary">No upcoming blocks planned yet.</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {upcomingPlans.map((plan, idx) => {
                          const prescription = projectBlocks.find(
                            pb => pb.blockName.trim().toLowerCase() === plan.blockName.trim().toLowerCase()
                          );
                          const prescTotal = prescription
                            ? prescription.allocations.reduce((s, a) => s + a.trees, 0)
                            : null;

                          return (
                            <div key={plan.id} className="px-5 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  {/* Rank badge */}
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                                    style={{ background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }}>
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0 flex-1 space-y-2">
                                    {/* Block name + crew inline edit */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-bold text-text-primary">{plan.blockName}</span>
                                      <input
                                        value={plan.crewName}
                                        onChange={e => handleUpdateCrew(plan, e.target.value)}
                                        placeholder="Assign crew…"
                                        className="text-[11px] border border-border rounded-lg px-2 py-0.5 bg-surface-secondary text-text-secondary focus:outline-none focus:border-primary/50 w-36"
                                      />
                                      {plan.notes && (
                                        <span className="text-[10px] text-text-tertiary italic">{plan.notes}</span>
                                      )}
                                    </div>

                                    {/* Prescription species */}
                                    {prescription ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Prescription:</span>
                                        {prescription.allocations.map(a => (
                                          <span key={a.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border bg-surface-secondary">
                                            <span className="font-mono font-semibold text-text-tertiary">{a.species.slice(0,2).toUpperCase()}</span>
                                            <span className="font-semibold text-text-primary">{fmt(a.trees)}</span>
                                            <span className="text-text-tertiary truncate max-w-[60px]">{a.species}</span>
                                          </span>
                                        ))}
                                        {prescTotal != null && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                            style={{ background: "var(--color-primary-deep)" }}>
                                            {fmt(prescTotal)} total
                                          </span>
                                        )}
                                        {prescription.area != null && (
                                          <span className="text-[10px] text-text-tertiary">{prescription.area} ha</span>
                                        )}
                                        {prescription.density != null && (
                                          <span className="text-[10px] text-text-tertiary">{prescription.density} sph</span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-text-tertiary italic">No prescription found — add one in Projects → Add Block</div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemovePlan(plan.id)}
                                  className="text-text-tertiary hover:text-red-400 text-sm shrink-0 transition-colors mt-0.5">×</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Planning ── */}
              {(() => {
                const allPlanBlocks = [
                  ...Array.from(new Set([
                    ...upcomingPlans.map(p => p.blockName),
                    ...projectBlocks.map(b => b.blockName),
                    ...deliveries.map(d => d.block),
                  ])).filter(Boolean).sort(),
                ];

                const dpLineTotal = dpLines.reduce((s, l) => {
                  const boxes = Number(l.boxes) || 0;
                  const tpb   = Number(l.treesPerBox) || 0;
                  return s + boxes * tpb;
                }, 0);

                const dpCanSave = !!dpDate && !!dpBlock && !!dpDriver
                  && dpLines.some(l => l.speciesId && Number(l.boxes) > 0 && Number(l.treesPerBox) > 0);

                async function handleSaveDp() {
                  if (!dpCanSave) return;
                  setDpSaving(true);
                  const lines: DeliveryPlanLine[] = dpLines
                    .filter(l => l.speciesId && Number(l.boxes) > 0 && Number(l.treesPerBox) > 0)
                    .map(l => {
                      const rate = rates.find(r => r.id === l.speciesId)!;
                      const boxes = Number(l.boxes);
                      const tpb   = Number(l.treesPerBox);
                      return {
                        id: uid(),
                        speciesId: rate.id,
                        species:   rate.species,
                        code:      rate.code,
                        boxes,
                        treesPerBox: tpb,
                        trees: boxes * tpb,
                      };
                    });
                  const plan: DeliveryPlan = {
                    id:          `dp-${uid()}`,
                    planDate:    dpDate,
                    blockName:   dpBlock,
                    driverName:  dpDriver,
                    truckId:     dpTruck || undefined,
                    blockNotes:  dpBlockNotes || undefined,
                    notes:       dpNotes || undefined,
                    lines,
                    totalTrees:  lines.reduce((s, l) => s + l.trees, 0),
                    status:      "planned",
                  };
                  await saveDeliveryPlan(plan);
                  setDeliveryPlans(prev => [...prev, plan].sort((a, b) => a.planDate.localeCompare(b.planDate)));
                  setDpBlock(""); setDpDriver(""); setDpTruck(""); setDpBlockNotes(""); setDpNotes("");
                  setDpLines([{ id: uid(), speciesId: "", boxes: "", treesPerBox: "" }]);
                  setDpSaving(false);
                  showToast("Delivery scheduled");
                }

                async function handleUpdateDpStatus(id: string, status: DeliveryPlan["status"]) {
                  const plan = deliveryPlans.find(p => p.id === id);
                  if (!plan) return;
                  const updated = { ...plan, status };
                  await saveDeliveryPlan(updated);
                  setDeliveryPlans(prev => prev.map(p => p.id === id ? updated : p));
                }

                async function handleDeleteDp(id: string) {
                  await deleteDeliveryPlan(id);
                  setDeliveryPlans(prev => prev.filter(p => p.id !== id));
                }

                const STATUS_CONFIG: Record<DeliveryPlan["status"], { label: string; color: string; bg: string }> = {
                  planned:    { label: "Planned",    color: "#6b7280", bg: "#f3f4f6" },
                  dispatched: { label: "Dispatched", color: "#d97706", bg: "#fef3c7" },
                  delivered:  { label: "Delivered",  color: "#059669", bg: "#d1fae5" },
                };

                const pendingPlans    = deliveryPlans.filter(p => p.status !== "delivered");
                const completedPlans  = deliveryPlans.filter(p => p.status === "delivered");

                return (
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Planning</div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">Schedule tree deliveries — assign drivers, trucks, species quantities, and block locations</div>
                      </div>
                      {pendingPlans.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--color-primary-deep)" }}>
                            {pendingPlans.length} pending
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Schedule Delivery Form */}
                    <div className="p-5 border-b border-border space-y-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Schedule a Delivery</div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>Delivery Date *</label>
                          <input type="date" value={dpDate} onChange={e => setDpDate(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Block *</label>
                          <input list="dp-block-list" value={dpBlock} onChange={e => setDpBlock(e.target.value)} placeholder="Select block…" className={inputCls} />
                          <datalist id="dp-block-list">
                            {allPlanBlocks.map(b => <option key={b} value={b} />)}
                          </datalist>
                        </div>
                        <div>
                          <label className={labelCls}>Driver *</label>
                          <input value={dpDriver} onChange={e => setDpDriver(e.target.value)} placeholder="Driver name" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Truck / Vehicle ID</label>
                          <input value={dpTruck} onChange={e => setDpTruck(e.target.value)} placeholder="e.g. Truck #3" className={inputCls} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>Block Location / Access Notes</label>
                          <input value={dpBlockNotes} onChange={e => setDpBlockNotes(e.target.value)} placeholder="GPS coords, road name, gate code…" className={inputCls} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>General Notes</label>
                          <input value={dpNotes} onChange={e => setDpNotes(e.target.value)} placeholder="Special instructions…" className={inputCls} />
                        </div>
                      </div>

                      {/* Species / Boxes lines */}
                      <div>
                        <div className="grid grid-cols-[1fr_100px_110px_80px_20px] gap-2 mb-2">
                          {["Species", "Boxes", "Trees / Box", "Total", ""].map(h => (
                            <div key={h} className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {dpLines.map(line => {
                            const trees = (Number(line.boxes) || 0) * (Number(line.treesPerBox) || 0);
                            return (
                              <div key={line.id} className="grid grid-cols-[1fr_100px_110px_80px_20px] gap-2 items-center">
                                <select value={line.speciesId}
                                  onChange={e => setDpLines(prev => prev.map(l => l.id === line.id ? { ...l, speciesId: e.target.value } : l))}
                                  className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50">
                                  <option value="">Species…</option>
                                  {rates.map(r => <option key={r.id} value={r.id}>{r.code} – {r.species}</option>)}
                                </select>
                                <input type="number" min="0" value={line.boxes} placeholder="0"
                                  onChange={e => setDpLines(prev => prev.map(l => l.id === line.id ? { ...l, boxes: e.target.value } : l))}
                                  className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                                <input type="number" min="0" value={line.treesPerBox} placeholder="e.g. 250"
                                  onChange={e => setDpLines(prev => prev.map(l => l.id === line.id ? { ...l, treesPerBox: e.target.value } : l))}
                                  className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary text-right focus:outline-none focus:border-primary/50" />
                                <div className="text-xs text-right text-text-secondary font-medium">
                                  {trees > 0 ? fmt(trees) : "—"}
                                </div>
                                <button
                                  onClick={() => setDpLines(prev => prev.filter(l => l.id !== line.id))}
                                  disabled={dpLines.length === 1}
                                  className="text-text-tertiary hover:text-red-400 text-sm font-bold disabled:opacity-20 disabled:cursor-not-allowed transition-colors">×</button>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <button
                            onClick={() => setDpLines(prev => [...prev, { id: uid(), speciesId: "", boxes: "", treesPerBox: "" }])}
                            className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                            + Add Species
                          </button>
                          {dpLineTotal > 0 && (
                            <div className="text-xs text-text-tertiary">
                              Total: <span className="font-bold text-text-primary">{fmt(dpLineTotal)} trees</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button onClick={handleSaveDp}
                          disabled={!dpCanSave || dpSaving}
                          className="px-6 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                          {dpSaving ? "Saving…" : "Schedule Delivery"}
                        </button>
                      </div>
                    </div>

                    {/* Delivery Queue */}
                    {deliveryPlans.length === 0 ? (
                      <div className="px-5 py-10 text-center text-[11px] text-text-tertiary">
                        No deliveries scheduled. Use the form above to plan your first run.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {/* Pending */}
                        {pendingPlans.length > 0 && (
                          <div>
                            <div className="px-5 py-2.5 bg-surface-secondary/30 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                              Upcoming Deliveries
                            </div>
                            {pendingPlans.map(plan => {
                              const sc = STATUS_CONFIG[plan.status];
                              const upcomingPlan = upcomingPlans.find(u => u.blockName === plan.blockName);
                              return (
                                <div key={plan.id} className="px-5 py-4 border-b border-border/50 last:border-b-0 hover:bg-surface-secondary/20 transition-colors">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-2">
                                      {/* Row 1: date · status · block */}
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                                          style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
                                          {plan.planDate}
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                          style={{ background: sc.bg, color: sc.color }}>
                                          {sc.label}
                                        </span>
                                        <span className="text-sm font-bold text-text-primary">{plan.blockName}</span>
                                        {upcomingPlan && (
                                          <span className="text-[10px] text-text-tertiary">Crew: {upcomingPlan.crewName}</span>
                                        )}
                                      </div>

                                      {/* Row 2: driver · truck */}
                                      <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
                                        <span>🚛 <span className="font-medium text-text-primary">{plan.driverName}</span></span>
                                        {plan.truckId && <span className="text-text-tertiary">· {plan.truckId}</span>}
                                      </div>

                                      {/* Row 3: location notes */}
                                      {plan.blockNotes && (
                                        <div className="flex items-start gap-1.5 text-[11px] text-text-secondary">
                                          <span className="shrink-0 mt-0.5">📍</span>
                                          <span>{plan.blockNotes}</span>
                                        </div>
                                      )}

                                      {/* Row 4: species breakdown */}
                                      <div className="flex flex-wrap gap-2">
                                        {plan.lines.map(l => (
                                          <div key={l.id} className="flex items-center gap-1 px-2.5 py-1 bg-surface-secondary border border-border rounded-lg text-[10px]">
                                            <span className="font-mono font-bold text-text-primary">{l.code}</span>
                                            <span className="text-text-tertiary">·</span>
                                            <span className="text-text-secondary">{l.boxes} box{l.boxes !== 1 ? "es" : ""}</span>
                                            <span className="text-text-tertiary">×</span>
                                            <span className="text-text-secondary">{fmt(l.treesPerBox)}</span>
                                            <span className="text-text-tertiary">=</span>
                                            <span className="font-semibold text-text-primary">{fmt(l.trees)}</span>
                                          </div>
                                        ))}
                                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "var(--color-primary-deep)" }}>
                                          {fmt(plan.totalTrees)} total
                                        </div>
                                      </div>

                                      {/* Row 5: notes */}
                                      {plan.notes && (
                                        <div className="text-[11px] text-text-tertiary italic">{plan.notes}</div>
                                      )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                      {plan.status === "planned" && (
                                        <button
                                          onClick={() => handleUpdateDpStatus(plan.id, "dispatched")}
                                          className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap">
                                          Mark Dispatched
                                        </button>
                                      )}
                                      {plan.status === "dispatched" && (
                                        <button
                                          onClick={() => handleUpdateDpStatus(plan.id, "delivered")}
                                          className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors whitespace-nowrap">
                                          Mark Delivered
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteDp(plan.id)}
                                        className="px-3 py-1.5 text-[10px] font-medium rounded-lg border border-border text-text-tertiary hover:text-red-400 hover:border-red-300 transition-colors">
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Completed */}
                        {completedPlans.length > 0 && (
                          <div>
                            <div className="px-5 py-2.5 bg-surface-secondary/30 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                              Completed Deliveries
                            </div>
                            {completedPlans.map(plan => (
                              <div key={plan.id} className="px-5 py-3 border-b border-border/30 last:border-b-0 opacity-60 hover:opacity-80 transition-opacity">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className="text-[10px] text-text-tertiary">{plan.planDate}</span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                      style={{ background: STATUS_CONFIG.delivered.bg, color: STATUS_CONFIG.delivered.color }}>
                                      Delivered
                                    </span>
                                    <span className="font-medium text-text-primary">{plan.blockName}</span>
                                    <span className="text-text-tertiary">·</span>
                                    <span className="text-text-secondary">{plan.driverName}</span>
                                    {plan.truckId && <span className="text-text-tertiary">· {plan.truckId}</span>}
                                    <span className="text-text-tertiary">·</span>
                                    <span className="font-semibold text-text-primary">{fmt(plan.totalTrees)} trees</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteDp(plan.id)}
                                    className="text-text-tertiary hover:text-red-400 text-sm font-bold transition-colors shrink-0">×</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          );
        })()}

        {/* ───────────────────────── RECONCILIATION ──────────────────────── */}
        {tab === "reconcile" && (() => {
          const filteredEntries    = entries.filter(e => reconcileProjectFilter === "all" || e.project === reconcileProjectFilter);
          const filteredDeliveries = deliveries.filter(d => reconcileProjectFilter === "all" || d.project === reconcileProjectFilter);

          interface SpeciesAgg { species: string; code: string; trees: number }
          interface BlockAgg {
            block: string;
            delivered: Map<string, SpeciesAgg>;
            xferIn:    Map<string, SpeciesAgg>;
            xferOut:   Map<string, SpeciesAgg>;
            planted:   Map<string, SpeciesAgg>;
            crewPlanted: Map<string, number>;
          }
          const blockMap = new Map<string, BlockAgg>();
          function getBlock(b: string): BlockAgg {
            if (!blockMap.has(b)) blockMap.set(b, {
              block: b,
              delivered: new Map(), xferIn: new Map(), xferOut: new Map(), planted: new Map(),
              crewPlanted: new Map(),
            });
            return blockMap.get(b)!;
          }
          function bump(m: Map<string, SpeciesAgg>, l: { speciesId: string; species: string; code: string; trees: number }) {
            const ex = m.get(l.speciesId) ?? { species: l.species, code: l.code, trees: 0 };
            ex.trees += l.trees;
            m.set(l.speciesId, ex);
          }
          for (const d of filteredDeliveries) {
            const rec = getBlock(d.block);
            for (const l of d.lines) bump(rec.delivered, l);
          }
          for (const e of filteredEntries) {
            const rec = getBlock(e.block);
            for (const l of e.production) bump(rec.planted, l);
            const crew = (e.crewBoss || "").trim() || "(No Crew)";
            rec.crewPlanted.set(crew, (rec.crewPlanted.get(crew) ?? 0) + e.totalTrees);
          }
          for (const t of transfers) {
            const outRec = getBlock(t.fromBlock);
            for (const l of t.lines) bump(outRec.xferOut, l);
            const inRec = getBlock(t.toBlock);
            for (const l of t.lines) bump(inRec.xferIn, l);
          }

          const blockRows = [...blockMap.values()]
            .filter(b => b.block !== REEFER_STORAGE && b.block !== "")
            .map(b => {
              const delivered = [...b.delivered.values()].reduce((s, v) => s + v.trees, 0);
              const xferIn    = [...b.xferIn.values()].reduce((s, v) => s + v.trees, 0);
              const xferOut   = [...b.xferOut.values()].reduce((s, v) => s + v.trees, 0);
              const planted   = [...b.planted.values()].reduce((s, v) => s + v.trees, 0);
              const net       = delivered + xferIn - xferOut;
              const variance  = planted - net;
              const variancePct = net > 0 ? (variance / net) * 100 : 0;
              const isClosed  = reconcileClosedBlocks.has(b.block);
              let flag: "clean" | "overclaim" | "underclaim" | "active" = "clean";
              if (Math.abs(variancePct) <= reconcileTolerance) flag = "clean";
              else if (variancePct > 0) flag = "overclaim";
              else if (isClosed) flag = "underclaim";
              else flag = "active";

              const allSpeciesIds = new Set([
                ...b.delivered.keys(), ...b.xferIn.keys(), ...b.xferOut.keys(), ...b.planted.keys(),
              ]);
              const speciesRows = [...allSpeciesIds].map(sid => {
                const dSp = b.delivered.get(sid);
                const iSp = b.xferIn.get(sid);
                const oSp = b.xferOut.get(sid);
                const pSp = b.planted.get(sid);
                const dTrees = dSp?.trees ?? 0;
                const iTrees = iSp?.trees ?? 0;
                const oTrees = oSp?.trees ?? 0;
                const pTrees = pSp?.trees ?? 0;
                const spNet  = dTrees + iTrees - oTrees;
                const spVar  = pTrees - spNet;
                const spVarPct = spNet > 0 ? (spVar / spNet) * 100 : 0;
                return {
                  speciesId: sid,
                  species: dSp?.species ?? iSp?.species ?? oSp?.species ?? pSp?.species ?? sid,
                  code:    dSp?.code    ?? iSp?.code    ?? oSp?.code    ?? pSp?.code    ?? "?",
                  delivered: dTrees, xferIn: iTrees, xferOut: oTrees, planted: pTrees,
                  net: spNet, variance: spVar, variancePct: spVarPct,
                };
              }).sort((a, x) => Math.abs(x.variance) - Math.abs(a.variance));

              return {
                block: b.block, delivered, xferIn, xferOut, planted, net,
                variance, variancePct, flag, isClosed, speciesRows,
                crewPlanted: b.crewPlanted,
              };
            });

          const visibleBlocks = (reconcileShowOnlyVariance
            ? blockRows.filter(b => b.flag === "overclaim" || b.flag === "underclaim")
            : blockRows
          ).slice().sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct));

          const totalDelivered = blockRows.reduce((s, b) => s + b.delivered, 0);
          const totalPlanted   = blockRows.reduce((s, b) => s + b.planted, 0);
          const totalVariance  = blockRows.reduce((s, b) => s + b.variance, 0);
          const flaggedCount   = blockRows.filter(b => b.flag === "overclaim" || b.flag === "underclaim").length;

          const crewMap = new Map<string, { crew: string; planted: number; attributedVariance: number; blocks: number }>();
          for (const b of blockRows) {
            if (b.planted === 0) continue;
            for (const [crew, trees] of b.crewPlanted) {
              const share = trees / b.planted;
              const attributed = b.variance * share;
              const ex = crewMap.get(crew) ?? { crew, planted: 0, attributedVariance: 0, blocks: 0 };
              ex.planted += trees;
              ex.attributedVariance += attributed;
              ex.blocks += 1;
              crewMap.set(crew, ex);
            }
          }
          const crewRows = [...crewMap.values()].sort((a, b) => b.attributedVariance - a.attributedVariance);

          const projectsForFilter = [...new Set([
            ...entries.map(e => e.project),
            ...deliveries.map(d => d.project),
          ].filter(Boolean))].sort();

          const gridCols = "grid-cols-[1fr_repeat(5,90px)_120px_28px]";

          return (
            <div className="max-w-7xl mx-auto space-y-5">

              {/* Filters */}
              <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-5 py-3 flex-wrap">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary shrink-0">Filters</div>
                <select value={reconcileProjectFilter} onChange={e => setReconcileProjectFilter(e.target.value)}
                  className="text-xs border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                  <option value="all">All Projects</option>
                  {projectsForFilter.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-tertiary uppercase tracking-widest">Tolerance</span>
                  <input type="number" min="0" max="50" step="0.5" value={reconcileTolerance}
                    onChange={e => setReconcileTolerance(Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 text-xs border border-border rounded-lg px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-primary/50" />
                  <span className="text-[10px] text-text-tertiary">%</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer ml-2">
                  <input type="checkbox" checked={reconcileShowOnlyVariance}
                    onChange={e => setReconcileShowOnlyVariance(e.target.checked)} className="accent-primary" />
                  <span className="text-xs text-text-secondary">Only show blocks outside tolerance</span>
                </label>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Delivered to Blocks", value: fmt(totalDelivered), sub: `${blockRows.length} block${blockRows.length !== 1 ? "s" : ""}` },
                  { label: "Trees Planted",       value: fmt(totalPlanted),   sub: totalDelivered > 0 ? `${((totalPlanted / totalDelivered) * 100).toFixed(1)}% of delivered` : "—" },
                  { label: "Net Variance",        value: (totalVariance >= 0 ? "+" : "") + fmt(totalVariance), sub: totalDelivered > 0 ? `${((totalVariance / totalDelivered) * 100).toFixed(2)}% of delivered` : "—" },
                  { label: "Blocks Flagged",      value: String(flaggedCount), sub: `tolerance ±${reconcileTolerance}%` },
                ].map(k => (
                  <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                    <div className="text-2xl font-bold text-text-primary mt-1">{k.value}</div>
                    <div className="text-[10px] text-text-tertiary mt-1">{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Block reconciliation */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Block Reconciliation</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">All-time. Click a row to see species breakdown · mark closed blocks to apply strict tolerance.</div>
                </div>
                {visibleBlocks.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No blocks to reconcile.</div>
                ) : (
                  <>
                    <div className={`grid ${gridCols} gap-3 px-5 py-2 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary bg-surface-secondary/20 border-b border-border/50`}>
                      <div>Block</div>
                      <div className="text-right">Delivered</div>
                      <div className="text-right">Xfer In</div>
                      <div className="text-right">Xfer Out</div>
                      <div className="text-right">Planted</div>
                      <div className="text-right">Variance</div>
                      <div className="text-center">Status</div>
                      <div></div>
                    </div>
                    <div className="divide-y divide-border/50">
                      {visibleBlocks.map(b => {
                        const flagColor = b.flag === "overclaim" ? "bg-red-500/10 border-red-500/40 text-red-400"
                          : b.flag === "underclaim" ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                          : b.flag === "active" ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                          : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400";
                        const flagLabel = b.flag === "overclaim" ? "Overclaim"
                          : b.flag === "underclaim" ? "Underclaim"
                          : b.flag === "active" ? "In Progress"
                          : "Clean";
                        const isExpanded = reconcileExpanded.has(b.block);
                        return (
                          <div key={b.block}>
                            <button
                              onClick={() => setReconcileExpanded(prev => {
                                const next = new Set(prev);
                                if (next.has(b.block)) next.delete(b.block); else next.add(b.block);
                                return next;
                              })}
                              className="w-full px-5 py-3 hover:bg-surface-secondary/30 transition-colors text-left"
                            >
                              <div className={`grid ${gridCols} gap-3 items-center text-xs`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold text-text-primary truncate">{b.block || "(No Block)"}</span>
                                  {b.isClosed && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-text-tertiary uppercase tracking-wider shrink-0">Closed</span>
                                  )}
                                </div>
                                <div className="text-right tabular-nums text-text-secondary">{fmt(b.delivered)}</div>
                                <div className="text-right tabular-nums text-text-secondary">{b.xferIn === 0 ? "—" : `+${fmt(b.xferIn)}`}</div>
                                <div className="text-right tabular-nums text-text-secondary">{b.xferOut === 0 ? "—" : `−${fmt(b.xferOut)}`}</div>
                                <div className="text-right tabular-nums text-text-primary font-semibold">{fmt(b.planted)}</div>
                                <div className={`text-right tabular-nums font-bold ${b.variance > 0 ? "text-red-400" : b.variance < 0 ? "text-amber-400" : "text-text-secondary"}`}>
                                  {b.variance === 0 ? "0" : (b.variance > 0 ? "+" : "") + fmt(b.variance)}
                                  {b.net > 0 && <span className="text-[10px] font-normal ml-1">({b.variancePct >= 0 ? "+" : ""}{b.variancePct.toFixed(1)}%)</span>}
                                </div>
                                <div className={`text-center text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border ${flagColor}`}>{flagLabel}</div>
                                <div className="text-text-tertiary text-center">{isExpanded ? "▾" : "▸"}</div>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="px-5 py-3 bg-surface-secondary/20 border-t border-border/40">
                                <div className={`grid ${gridCols} gap-3 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-2`}>
                                  <div>Species</div>
                                  <div className="text-right">Delivered</div>
                                  <div className="text-right">Xfer In</div>
                                  <div className="text-right">Xfer Out</div>
                                  <div className="text-right">Planted</div>
                                  <div className="text-right">Variance</div>
                                  <div></div><div></div>
                                </div>
                                <div className="space-y-1">
                                  {b.speciesRows.map(s => (
                                    <div key={s.speciesId} className={`grid ${gridCols} gap-3 text-xs items-center`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono font-semibold text-text-tertiary w-6 shrink-0">{s.code}</span>
                                        <span className="text-text-primary truncate">{s.species}</span>
                                      </div>
                                      <div className="text-right tabular-nums text-text-secondary">{fmt(s.delivered)}</div>
                                      <div className="text-right tabular-nums text-text-secondary">{s.xferIn === 0 ? "—" : `+${fmt(s.xferIn)}`}</div>
                                      <div className="text-right tabular-nums text-text-secondary">{s.xferOut === 0 ? "—" : `−${fmt(s.xferOut)}`}</div>
                                      <div className="text-right tabular-nums text-text-primary">{fmt(s.planted)}</div>
                                      <div className={`text-right tabular-nums font-semibold ${s.variance > 0 ? "text-red-400" : s.variance < 0 ? "text-amber-400" : "text-text-secondary"}`}>
                                        {s.variance === 0 ? "0" : (s.variance > 0 ? "+" : "") + fmt(s.variance)}
                                        {s.net > 0 && <span className="text-[10px] font-normal ml-1">({s.variancePct >= 0 ? "+" : ""}{s.variancePct.toFixed(1)}%)</span>}
                                      </div>
                                      <div></div><div></div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-3">
                                  <div className="text-[10px] text-text-tertiary truncate">
                                    {b.crewPlanted.size > 0 && (
                                      <>Crews: {[...b.crewPlanted.entries()].sort((a, x) => x[1] - a[1]).map(([c, t]) => `${c} (${fmt(t)})`).join(" · ")}</>
                                    )}
                                  </div>
                                  <button
                                    onClick={ev => { ev.stopPropagation(); toggleBlockClosed(b.block); }}
                                    className="text-[10px] px-3 py-1 rounded border border-border text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors shrink-0"
                                  >
                                    {b.isClosed ? "Reopen Block" : "Mark Closed"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* By Crew variance attribution */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Crew Variance Attribution</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">Each crew&apos;s share of block planting × block variance. Positive = overclaim suspect.</div>
                </div>
                {crewRows.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No crew data.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_120px_80px_140px_120px] gap-3 px-5 py-2 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary bg-surface-secondary/20 border-b border-border/50">
                      <div>Crew Boss</div>
                      <div className="text-right">Planted</div>
                      <div className="text-right">Blocks</div>
                      <div className="text-right">Attributed Var</div>
                      <div className="text-right">% of Planted</div>
                    </div>
                    <div className="divide-y divide-border/50">
                      {crewRows.map(c => {
                        const pct = c.planted > 0 ? (c.attributedVariance / c.planted) * 100 : 0;
                        const flagged = Math.abs(pct) > reconcileTolerance;
                        return (
                          <div key={c.crew} className="grid grid-cols-[1fr_120px_80px_140px_120px] gap-3 px-5 py-2.5 text-xs items-center">
                            <div className="font-medium text-text-primary truncate">{c.crew}</div>
                            <div className="text-right tabular-nums text-text-secondary">{fmt(c.planted)}</div>
                            <div className="text-right tabular-nums text-text-tertiary">{c.blocks}</div>
                            <div className={`text-right tabular-nums font-semibold ${c.attributedVariance > 0 ? "text-red-400" : c.attributedVariance < 0 ? "text-amber-400" : "text-text-secondary"}`}>
                              {Math.round(c.attributedVariance) === 0 ? "0" : (c.attributedVariance > 0 ? "+" : "") + fmt(Math.round(c.attributedVariance))}
                            </div>
                            <div className={`text-right tabular-nums ${flagged ? (pct > 0 ? "text-red-400 font-bold" : "text-amber-400 font-bold") : "text-text-secondary"}`}>
                              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ─────────────────────────── QUALITY REPORTS ─────────────────────── */}
        {tab === "quality" && (() => {
          const planted = parseInt(qpTreesPlanted) || 0;
          const good    = parseInt(qpGoodTrees)    || 0;
          const missed  = qpInfractions.missedSpot || 0;
          const computedPlantable = planted + missed;
          const plantableNum = parseInt(qpPlantableSpots) || computedPlantable;
          const qualityPct  = planted > 0 ? (good / planted) * 100 : 0;
          const stockingPct = plantableNum > 0 ? (good / plantableNum) * 100 : 0;
          const density     = good * 200;

          const logPlots = qualityPlots.filter(p =>
            (qpLogBlockFilter === "all" || p.block === qpLogBlockFilter) &&
            (qpLogCrewFilter  === "all" || p.crewBoss === qpLogCrewFilter)
          );

          interface BlockRollup {
            block: string;
            plots: QualityPlot[];
            totalPlanted: number;
            totalGood: number;
            totalPlantable: number;
          }
          const blockMap = new Map<string, BlockRollup>();
          for (const p of qualityPlots) {
            if (!blockMap.has(p.block)) blockMap.set(p.block, {
              block: p.block, plots: [], totalPlanted: 0, totalGood: 0, totalPlantable: 0,
            });
            const rec = blockMap.get(p.block)!;
            rec.plots.push(p);
            rec.totalPlanted += p.treesPlanted;
            rec.totalGood += p.goodTrees;
            rec.totalPlantable += p.plantableSpots;
          }
          const blockRollup = [...blockMap.values()].sort((a, b) => a.block.localeCompare(b.block));

          const knownProjects = [...new Set([
            ...qualityPlots.map(p => p.project),
            ...entries.map(e => e.project),
            ...deliveries.map(d => d.project),
          ].filter(Boolean))].sort();
          const knownBlocks = [...new Set([
            ...qualityPlots.map(p => p.block),
            ...entries.map(e => e.block),
            ...deliveries.map(d => d.block),
          ].filter(Boolean))].sort();
          const knownSurveyors = [...new Set(qualityPlots.map(p => p.surveyor).filter(Boolean))].sort();
          const knownCrews = [...new Set([
            ...qualityPlots.map(p => p.crewBoss),
            ...entries.map(e => e.crewBoss),
          ].filter(Boolean))].sort();

          return (
            <div className="max-w-6xl mx-auto space-y-5">

              {/* Plot Entry Form */}
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                      {qpEditingId ? "Edit Quality Plot" : "New Quality Plot"}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">3.99 m radius plot · area = 50 m² (1/200 ha) · density = good × 200 stems/ha</div>
                  </div>
                  {qpEditingId && (
                    <button onClick={resetQualityForm} className="text-[10px] text-text-tertiary hover:text-text-primary underline">
                      Cancel edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>Date *</label>
                    <input type="date" value={qpDate} onChange={e => setQpDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Project</label>
                    <input list="qp-projects" value={qpProject} onChange={e => setQpProject(e.target.value)} placeholder="Project…" className={inputCls} />
                    <datalist id="qp-projects">{knownProjects.map(p => <option key={p} value={p} />)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Block *</label>
                    <input list="qp-blocks" value={qpBlock} onChange={e => setQpBlock(e.target.value)} placeholder="e.g. Block 3A" className={inputCls} />
                    <datalist id="qp-blocks">{knownBlocks.map(b => <option key={b} value={b} />)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Plot #</label>
                    <input value={qpPlotNumber} onChange={e => setQpPlotNumber(e.target.value)} placeholder="e.g. P1" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>Surveyor</label>
                    <input list="qp-surveyors" value={qpSurveyor} onChange={e => setQpSurveyor(e.target.value)} placeholder="Name…" className={inputCls} />
                    <datalist id="qp-surveyors">{knownSurveyors.map(s => <option key={s} value={s} />)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Crew Boss *</label>
                    <input list="qp-crews" value={qpCrewBoss} onChange={e => setQpCrewBoss(e.target.value)} placeholder="Name…" className={inputCls} />
                    <datalist id="qp-crews">{knownCrews.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>GPS Lat</label>
                    <input value={qpGpsLat} onChange={e => setQpGpsLat(e.target.value)} placeholder="optional" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>GPS Lng</label>
                    <input value={qpGpsLng} onChange={e => setQpGpsLng(e.target.value)} placeholder="optional" className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className={labelCls}>Trees Planted in Plot *</label>
                    <input type="number" min="0" value={qpTreesPlanted}
                      onChange={e => setQpTreesPlanted(e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Good Trees</label>
                    <input type="number" min="0" value={qpGoodTrees}
                      onChange={e => setQpGoodTrees(e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Plantable Spots</label>
                    <input type="number" min="0" value={qpPlantableSpots}
                      onChange={e => setQpPlantableSpots(e.target.value)}
                      placeholder={`auto: ${computedPlantable}`} className={inputCls} />
                  </div>
                </div>

                {/* Infractions grid */}
                <div className="bg-surface-secondary/30 border border-border rounded-lg p-4 mb-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Infractions — count of trees with this defect</div>
                  <div className="grid grid-cols-4 gap-3">
                    {INFRACTION_LABELS.map(({ key, label, code }) => (
                      <div key={key}>
                        <label className="block text-[10px] text-text-secondary mb-1">
                          <span className="font-mono text-text-tertiary mr-1">{code}.</span>{label}
                        </label>
                        <input
                          type="number" min="0"
                          value={qpInfractions[key] === 0 ? "" : qpInfractions[key]}
                          onChange={e => setQpInfractions(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-xs bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-text-tertiary mt-2">
                    A tree with multiple infractions still counts as one not-good tree — set Good Trees accordingly.
                  </div>
                </div>

                <div className="mb-4">
                  <label className={labelCls}>Notes</label>
                  <textarea value={qpNotes} onChange={e => setQpNotes(e.target.value)} rows={2}
                    placeholder="Optional comments…" className={inputCls} />
                </div>

                {/* Live metrics + save */}
                <div className="flex items-center justify-between gap-4 bg-surface-secondary/30 border border-border rounded-lg px-4 py-3">
                  <div className="grid grid-cols-3 gap-4 flex-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">Quality %</div>
                      <div className="text-lg font-bold" style={{ color: planted === 0 ? "var(--color-text-tertiary)" : qualityPct >= 95 ? "var(--color-primary)" : qualityPct >= 85 ? "#fbbf24" : "#f87171" }}>
                        {planted > 0 ? qualityPct.toFixed(1) + "%" : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">Density (stems/ha)</div>
                      <div className="text-lg font-bold text-text-primary">{good > 0 ? fmt(density) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-text-tertiary">Stocking %</div>
                      <div className="text-lg font-bold text-text-primary">{plantableNum > 0 ? stockingPct.toFixed(1) + "%" : "—"}</div>
                    </div>
                  </div>
                  <button
                    onClick={saveQualityPlot}
                    disabled={qpSaving || !qpBlock.trim() || !qpCrewBoss.trim() || planted <= 0}
                    className="px-5 py-2 text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ background: "var(--color-primary)", color: "#fff" }}
                  >
                    {qpSaving ? "Saving…" : qpEditingId ? "Update Plot" : "Save Plot"}
                  </button>
                </div>
              </div>

              {/* Block Rollup */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Block Quality Rollup</div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">Weighted across all plots in each block.</div>
                  </div>
                  <div className="text-xs font-semibold text-text-primary">{blockRollup.length} block{blockRollup.length !== 1 ? "s" : ""}</div>
                </div>
                {blockRollup.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No quality plots saved yet.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_70px_90px_90px_110px_90px_100px] gap-3 px-5 py-2 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary bg-surface-secondary/20 border-b border-border/50">
                      <div>Block</div>
                      <div className="text-right">Plots</div>
                      <div className="text-right">Planted</div>
                      <div className="text-right">Good</div>
                      <div className="text-right">Avg Density</div>
                      <div className="text-right">Quality %</div>
                      <div className="text-right">Stocking %</div>
                    </div>
                    <div className="divide-y divide-border/50">
                      {blockRollup.map(b => {
                        const q = b.totalPlanted > 0 ? (b.totalGood / b.totalPlanted) * 100 : 0;
                        const ss = b.totalPlantable > 0 ? (b.totalGood / b.totalPlantable) * 100 : 0;
                        const d = b.plots.length > 0 ? Math.round((b.totalGood * 200) / b.plots.length) : 0;
                        return (
                          <div key={b.block} className="grid grid-cols-[1fr_70px_90px_90px_110px_90px_100px] gap-3 px-5 py-2.5 text-xs items-center">
                            <div className="font-medium text-text-primary truncate">{b.block}</div>
                            <div className="text-right tabular-nums text-text-secondary">{b.plots.length}</div>
                            <div className="text-right tabular-nums text-text-secondary">{fmt(b.totalPlanted)}</div>
                            <div className="text-right tabular-nums text-text-primary font-semibold">{fmt(b.totalGood)}</div>
                            <div className="text-right tabular-nums text-text-secondary">{fmt(d)}</div>
                            <div className="text-right tabular-nums font-semibold" style={{ color: q >= 95 ? "var(--color-primary)" : q >= 85 ? "#fbbf24" : "#f87171" }}>
                              {q.toFixed(1)}%
                            </div>
                            <div className="text-right tabular-nums text-text-secondary">{ss.toFixed(1)}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Generate Report */}
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Generate Client Report</div>
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div>
                    <label className={labelCls}>Block</label>
                    <select value={qpReportBlock} onChange={e => setQpReportBlock(e.target.value)} className={inputCls}>
                      <option value="all">All Blocks</option>
                      {[...new Set(qualityPlots.map(p => p.block))].sort().map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>From</label>
                    <input type="date" value={qpReportDateFrom} onChange={e => setQpReportDateFrom(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>To</label>
                    <input type="date" value={qpReportDateTo} onChange={e => setQpReportDateTo(e.target.value)} className={inputCls} />
                  </div>
                  <button
                    onClick={generateQualityReport}
                    disabled={qualityPlots.length === 0}
                    className="px-4 py-2 text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "var(--color-primary)", color: "#fff" }}
                  >
                    Generate Report
                  </button>
                </div>
              </div>

              {/* Plots Log */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center gap-3 flex-wrap">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mr-2">Plot Log</div>
                  <select value={qpLogBlockFilter} onChange={e => setQpLogBlockFilter(e.target.value)}
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                    <option value="all">All Blocks</option>
                    {[...new Set(qualityPlots.map(p => p.block))].sort().map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select value={qpLogCrewFilter} onChange={e => setQpLogCrewFilter(e.target.value)}
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-text-primary focus:outline-none focus:border-primary/50">
                    <option value="all">All Crews</option>
                    {[...new Set(qualityPlots.map(p => p.crewBoss))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="ml-auto text-xs text-text-tertiary">{logPlots.length} plot{logPlots.length !== 1 ? "s" : ""}</div>
                </div>
                {logPlots.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No plots match the filters.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-[90px_1fr_60px_140px_80px_80px_90px_80px] gap-3 px-5 py-2 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary bg-surface-secondary/20 border-b border-border/50">
                      <div>Date</div>
                      <div>Block</div>
                      <div className="text-right">Plot</div>
                      <div>Crew</div>
                      <div className="text-right">Planted</div>
                      <div className="text-right">Good</div>
                      <div className="text-right">Quality</div>
                      <div></div>
                    </div>
                    <div className="divide-y divide-border/50">
                      {logPlots.map(p => {
                        const q = p.treesPlanted > 0 ? (p.goodTrees / p.treesPlanted) * 100 : 0;
                        return (
                          <div key={p.id} className="grid grid-cols-[90px_1fr_60px_140px_80px_80px_90px_80px] gap-3 px-5 py-2 text-xs items-center group">
                            <div className="text-text-secondary">{p.date}</div>
                            <div className="text-text-primary truncate">{p.block}</div>
                            <div className="text-right text-text-tertiary">{p.plotNumber || "—"}</div>
                            <div className="text-text-secondary truncate">{p.crewBoss}</div>
                            <div className="text-right tabular-nums text-text-secondary">{fmt(p.treesPlanted)}</div>
                            <div className="text-right tabular-nums text-text-primary">{fmt(p.goodTrees)}</div>
                            <div className="text-right tabular-nums font-semibold" style={{ color: q >= 95 ? "var(--color-primary)" : q >= 85 ? "#fbbf24" : "#f87171" }}>
                              {q.toFixed(1)}%
                            </div>
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => editQualityPlot(p)} className="text-[10px] text-text-tertiary hover:text-text-primary underline">edit</button>
                              <button onClick={() => deleteQualityPlot(p.id)} className="text-[10px] text-text-tertiary hover:text-red-400">×</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ────────────────────────────── LOG ──────────────────────────────── */}
        {tab === "log" && (
          <div className="max-w-7xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex-1"><FilterBar /></div>
              <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setOpenExport(v => v === "log" ? null : "log")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors"
                >
                  Export as
                  <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                {openExport === "log" && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                    <button onClick={exportLogCSV} className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary transition-colors flex items-center gap-2">
                      <span className="text-text-tertiary">↓</span> Export CSV
                    </button>
                    <button onClick={printLog} className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary transition-colors flex items-center gap-2">
                      <span className="text-text-tertiary">⎙</span> Print / PDF
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Trees", value: fmt(totals.totalTrees) },
                { label: "Planters",    value: String(totals.planterCount) },
              ].map(k => (
                <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                  <div className="text-xl font-bold text-text-primary mt-1">{k.value}</div>
                </div>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20 text-text-tertiary">
                <div className="text-3xl opacity-20 mb-2">⬡</div>
                <div className="text-sm">No production entries for this range.</div>
                <button onClick={() => setTab("entry")} className="mt-3 text-xs text-primary hover:underline">Log production →</button>
              </div>
            ) : (
              [...new Set(filtered.map(e => e.crewBoss))].sort().map(crew => {
                const ce = filtered.filter(e => e.crewBoss === crew);
                const ct = ce.reduce((s, e) => s + e.totalTrees, 0);
                // Unique planters in this crew: key → name
                const crewPlanters = [...new Map(ce.map(e => [e.employeeId || e.employeeName, e.employeeName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
                return (
                  <div key={crew} className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 bg-surface-secondary/40 border-b border-border flex items-center gap-3">
                      <div className="text-sm font-semibold text-text-primary">{crew}</div>
                      <div className="text-[11px] text-text-tertiary">
                        {crewPlanters.length} planters · {fmt(ct)} trees
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            {["Planter","Date","Block","Project","Species","Trees","Hrs",""].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ce.map(e => {
                            const isEditing = (field: NonNullable<typeof editingCell>["field"], lineIdx?: number) =>
                              editingCell?.entryId === e.id && editingCell.field === field && editingCell.lineIdx === lineIdx;
                            const cellInput = (type: string, extraCls = "") => (
                              <input
                                type={type}
                                value={editingValue}
                                autoFocus
                                onChange={ev => setEditingValue(ev.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={ev => { if (ev.key === "Enter") commitEdit(); if (ev.key === "Escape") cancelEdit(); }}
                                className={`bg-surface border border-primary/60 rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/40 ${extraCls}`}
                              />
                            );
                            return (
                            <tr key={e.id} className="border-b border-border/40 hover:bg-surface-secondary/40 group">
                              <td className="px-3 py-2.5 font-medium text-text-primary whitespace-nowrap">{e.employeeName}</td>

                              {/* Date */}
                              <td className="px-3 py-2.5 whitespace-nowrap" onClick={() => !isEditing("date") && startEdit(e.id, "date", e.date)}>
                                {isEditing("date") ? cellInput("date", "w-32") : (
                                  <span className="text-text-secondary cursor-text hover:text-text-primary">{e.date}</span>
                                )}
                              </td>

                              {/* Block */}
                              <td className="px-3 py-2.5" onClick={() => !isEditing("block") && startEdit(e.id, "block", e.block)}>
                                {isEditing("block") ? cellInput("text", "w-24") : (
                                  <span className="text-text-secondary cursor-text hover:text-text-primary">{e.block || <span className="text-text-tertiary/50">—</span>}</span>
                                )}
                              </td>

                              {/* Project */}
                              <td className="px-3 py-2.5" onClick={() => !isEditing("project") && startEdit(e.id, "project", e.project)}>
                                {isEditing("project") ? cellInput("text", "w-28") : (
                                  <span className="text-text-secondary cursor-text hover:text-text-primary">{e.project || <span className="text-text-tertiary/50">—</span>}</span>
                                )}
                              </td>

                              {/* Species chips — click tree count to edit */}
                              <td className="px-3 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {e.production.map((l, li) => (
                                    <span key={l.speciesId} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-surface-secondary border border-border rounded font-medium text-text-secondary whitespace-nowrap">
                                      {l.code}
                                      {isEditing("trees", li) ? (
                                        <input
                                          type="number" min="0" value={editingValue} autoFocus
                                          onChange={ev => setEditingValue(ev.target.value)}
                                          onBlur={commitEdit}
                                          onKeyDown={ev => { ev.stopPropagation(); if (ev.key === "Enter") commitEdit(); if (ev.key === "Escape") cancelEdit(); }}
                                          onClick={ev => ev.stopPropagation()}
                                          className="w-16 bg-surface border border-primary/60 rounded px-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                                        />
                                      ) : (
                                        <span
                                          className="cursor-text hover:text-text-primary hover:underline decoration-dotted"
                                          onClick={ev => { ev.stopPropagation(); startEdit(e.id, "trees", String(l.trees), li); }}
                                        >{fmt(l.trees)}</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </td>

                              <td className="px-3 py-2.5 text-right font-semibold text-text-primary whitespace-nowrap">{fmt(e.totalTrees)}</td>

                              {/* Hours */}
                              <td className="px-3 py-2.5 text-right" onClick={() => !isEditing("hoursWorked") && startEdit(e.id, "hoursWorked", String(e.hoursWorked))}>
                                {isEditing("hoursWorked") ? cellInput("number", "w-14 text-right") : (
                                  <span className="text-text-secondary cursor-text hover:text-text-primary">{e.hoursWorked}h</span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-right">
                                <button onClick={() => deleteEntry(e.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-red-400 font-bold text-sm">×</button>
                              </td>
                            </tr>
                            );
                          })}
                          <tr className="bg-surface-secondary/20 font-semibold text-xs">
                            <td className="px-3 py-2 text-[11px] text-text-tertiary uppercase tracking-widest" colSpan={5}>Totals</td>
                            <td className="px-3 py-2 text-right text-text-primary">{fmt(ct)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Planter report buttons */}
                    <div className="px-5 py-3 border-t border-border bg-surface-secondary/20 flex items-center flex-wrap gap-2">
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mr-1">Reports:</span>
                      {crewPlanters.map(([key, name]) => (
                        <button
                          key={key}
                          onClick={() => setReportPlanterKey(key)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border hover:border-primary/60 hover:text-primary text-text-secondary transition-colors"
                        >
                          <svg className="w-3 h-3 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ────────────────────────────── SUMMARY ─────────────────────────── */}
        {tab === "summary" && (
          <div className="max-w-7xl mx-auto space-y-5">
            <FilterBar />

            {/* ADP Export */}
            <div className="flex justify-end">
              <button
                onClick={generateADPCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary bg-surface transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export ADP CSV
              </button>
            </div>

            {/* Global KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: "Total Trees",    value: fmt(totals.totalTrees) },
                { label: "Gross Earnings", value: fmtC(totals.totalEarnings) },
                { label: "With Vac Pay",   value: fmtC(totals.totalWithVac) },
                { label: "Avg Trees/Day",  value: fmt(totals.avgPerDay) },
                { label: "Avg $/Tree",     value: `$${totals.avgPrice.toFixed(4)}` },
                { label: "Planting Days",  value: String(totals.days) },
              ].map(k => (
                <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                  <div className="text-lg font-bold text-text-primary mt-1">{k.value}</div>
                </div>
              ))}
            </div>

            {/* Planter summary — full-width with deduction columns */}
            {(() => {
              function getDed(name: string) {
                return planterDeds[name] ?? { campCosts: "", equipDeduction: "", other: "", cpp: "", ei: "", incomeTax: "", additionalEarnings: "", notes: "" };
              }
              function setDedField(name: string, field: string, value: string) {
                setPlanterDeds(prev => ({ ...prev, [name]: { ...getDed(name), [field]: value } }));
              }
              function parseNum(s: string) { return parseFloat(s) || 0; }
              const MIN_WAGE = 17.20; // Ontario minimum wage (update annually)

              const dedInputCls = "w-20 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-right text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface";

              return (
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4">
                  <div className="text-xs font-semibold text-text-primary">Planter Summary</div>
                  <div className="flex items-center gap-4 text-[10px] text-text-tertiary flex-wrap">
                    <span><span className="font-semibold text-text-secondary">Gross</span> = Earnings − Camp − Equip − Other</span>
                    <span className="text-border/80">|</span>
                    <span><span className="font-semibold text-text-secondary">Net</span> = Gross − CPP − EI − Income Tax</span>
                    <span className="text-border/80">|</span>
                    <span className="italic">▶ Click planter name to expand $/tree breakdown</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary">
                        {/* Fixed columns */}
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Emp. ID</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Planter</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Days</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Trees</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Earnings</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Total w/Vac</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Avg/Day</th>
                        {/* Deduction separator */}
                        <th className="px-1 py-2.5 border-l border-border/60" />
                        {/* Editable deduction columns */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Camp Costs</div>
                          {campCostRate > 0 && <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">${campCostRate}/day × days</div>}
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Equip. Deduction</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Other</th>
                        {/* Computed gross */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>Gross</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">Earnings − deductions</div>
                        </th>
                        {/* Hours / min wage columns */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Hours</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Hourly Earned</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">Total w/Vac ÷ Hours</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Min Wage Top-Up</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">${MIN_WAGE.toFixed(2)}/hr floor</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Total Hrs (YTD)</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">This calendar year</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Overtime Pay</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">&gt;178h/4-wk · 1.5× prev avg</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Additional Earnings</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Notes</th>
                        {/* Statutory deductions */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>CPP</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">5.95% of Gross</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>EI</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">1.66% of Gross</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Income Tax</th>
                        {/* Net */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold whitespace-nowrap" style={{ color: "var(--color-primary)" }}>
                          <div>Net</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-70">Gross − statutory</div>
                        </th>
                        {/* Allocation columns */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap border-l border-border/60">25% Special Worksite</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">75% Regular Income</th>
                        <th className="px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {planterSummary.length === 0
                        ? <tr><td colSpan={26} className="px-3 py-8 text-center text-text-tertiary">No data for this range</td></tr>
                        : planterSummary.map(p => {
                            const empKey = employees.find(e => e.name === p.name)?.id || p.name;
                            const d = getDed(p.name);
                            const camp   = parseNum(d.campCosts);
                            const equip  = parseNum(d.equipDeduction);
                            const other  = parseNum(d.other);
                            const gross  = p.totalWithVac - camp - equip - other;
                            const hours  = p.totalHours;
                            const hourlyEarned = hours > 0 ? p.totalWithVac / hours : null;
                            const topUp  = hours > 0 && p.totalWithVac < MIN_WAGE * hours ? MIN_WAGE * hours - p.totalWithVac : 0;
                            const ytd    = ytdHours.get(empKey) ?? ytdHours.get(p.name) ?? 0;
                            // Overtime: >178h in 4-week period @ 1.5× prev-period avg hourly
                            const OT_THRESHOLD = 178;
                            const otHours = Math.max(0, hours - OT_THRESHOLD);
                            const prev    = prevPeriodData.get(empKey) ?? prevPeriodData.get(p.name);
                            const prevAvgHourly = prev && prev.hours > 0 ? prev.withVac / prev.hours : null;
                            const otPay   = otHours > 0 && prevAvgHourly != null ? otHours * 1.5 * prevAvgHourly : null;
                            const cpp    = gross > 0 ? gross * 0.0595 : 0;
                            const ei     = gross > 0 ? gross * 0.0166 : 0;
                            const tax    = parseNum(d.incomeTax);
                            const addl   = parseNum(d.additionalEarnings);
                            const net    = gross + addl - cpp - ei - tax;
                            const avgDay = p.days.size > 0 ? Math.round(p.totalTrees / p.days.size) : 0;
                            const isExpanded = expandedPlanters.has(p.name);
                            const speciesRows = [...p.speciesMap.entries()].map(([species, s]) => ({
                              species,
                              code: s.code,
                              trees: s.trees,
                              earnings: s.earnings,
                              ratePerTree: s.trees > 0 ? s.earnings / s.trees : 0,
                            })).sort((a, b) => b.trees - a.trees);

                            function toggleExpand() {
                              setExpandedPlanters(prev => {
                                const next = new Set(prev);
                                next.has(p.name) ? next.delete(p.name) : next.add(p.name);
                                return next;
                              });
                            }

                            return (
                              <>
                              <tr key={p.name} className="hover:bg-surface-secondary/30 group">
                                {/* Fixed cols */}
                                <td className="px-3 py-2 font-mono text-[10px] text-text-tertiary whitespace-nowrap">
                                  {employees.find(e => e.name === p.name)?.employeeNumber ?? "—"}
                                </td>
                                <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">
                                  <button
                                    onClick={toggleExpand}
                                    className="flex items-center gap-1.5 hover:text-primary transition-colors text-left"
                                    title="Click to toggle species breakdown">
                                    <span className="text-[10px] text-text-tertiary transition-transform duration-150" style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                                    {p.name}
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-text-secondary">{p.days.size}</td>
                                <td className="px-3 py-2 font-semibold text-text-primary">{fmt(p.totalTrees)}</td>
                                <td className="px-3 py-2 text-text-secondary">{fmtC(p.totalEarnings)}</td>
                                <td className="px-3 py-2 font-semibold" style={{ color: "var(--color-primary)" }}>{fmtC(p.totalWithVac)}</td>
                                <td className="px-3 py-2 text-text-secondary">{avgDay > 0 ? fmt(avgDay) : "—"}</td>
                                {/* Separator */}
                                <td className="px-1 border-l border-border/60" />
                                {/* Editable deductions */}
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.campCosts}
                                    onChange={e => setDedField(p.name, "campCosts", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.equipDeduction}
                                    onChange={e => setDedField(p.name, "equipDeduction", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.other}
                                    onChange={e => setDedField(p.name, "other", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                {/* Gross (computed: Total w/Vac − camp − equip − other) */}
                                <td className="px-3 py-2 text-right font-bold bg-surface-secondary/40" style={{ color: gross < 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {fmtC(gross)}
                                </td>
                                {/* Hours */}
                                <td className="px-3 py-2 text-right text-text-secondary">
                                  {hours > 0 ? `${hours}h` : "—"}
                                </td>
                                {/* Hourly Earned */}
                                <td className="px-3 py-2 text-right font-medium" style={{ color: hourlyEarned != null && hourlyEarned < MIN_WAGE ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {hourlyEarned != null ? `$${hourlyEarned.toFixed(2)}/h` : "—"}
                                </td>
                                {/* Min Wage Top-Up */}
                                <td className="px-3 py-2 text-right font-semibold" style={{ color: topUp > 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {topUp > 0 ? fmtC(topUp) : <span className="text-text-tertiary font-normal">—</span>}
                                </td>
                                {/* Total Hours YTD */}
                                <td className="px-3 py-2 text-right text-text-secondary">
                                  {ytd > 0 ? `${ytd}h` : "—"}
                                </td>
                                {/* Overtime Pay */}
                                <td className="px-3 py-2 text-right font-medium" style={{ color: otHours > 0 ? "rgba(251,191,36,1)" : undefined }}>
                                  {otHours > 0
                                    ? <div>
                                        <div className="font-semibold">{otPay != null ? fmtC(otPay) : "—"}</div>
                                        <div className="text-[10px] opacity-70">{otHours}h OT{prevAvgHourly != null ? ` · $${prevAvgHourly.toFixed(2)}/h` : " · no prev data"}</div>
                                      </div>
                                    : <span className="text-text-tertiary font-normal">—</span>
                                  }
                                </td>
                                {/* Additional Earnings */}
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.additionalEarnings}
                                    onChange={e => setDedField(p.name, "additionalEarnings", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                {/* Notes */}
                                <td className="px-2 py-1.5">
                                  <input type="text" placeholder="Notes…"
                                    value={d.notes}
                                    onChange={e => setDedField(p.name, "notes", e.target.value)}
                                    className="w-32 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface" />
                                </td>
                                {/* Statutory deductions — CPP & EI auto-calculated */}
                                <td className="px-3 py-2 text-right bg-surface-secondary/40 text-text-secondary font-medium">
                                  {fmtC(cpp)}
                                </td>
                                <td className="px-3 py-2 text-right bg-surface-secondary/40 text-text-secondary font-medium">
                                  {fmtC(ei)}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.incomeTax}
                                    onChange={e => setDedField(p.name, "incomeTax", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                {/* Net (computed: Gross + Addl − CPP − EI − tax) */}
                                <td className="px-3 py-2 text-right font-black text-sm" style={{ color: net < 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {fmtC(net)}
                                </td>
                                {/* Allocation columns */}
                                <td className="px-3 py-2 text-right font-semibold text-text-secondary border-l border-border/60">
                                  {fmtC(net * 0.25)}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-text-secondary">
                                  {fmtC(net * 0.75)}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    onClick={() => {
                                      const planterEntries = filtered.filter(e => e.employeeName === p.name || e.employeeId === empKey);
                                      const dailyLogRows = [...planterEntries].sort((a,b) => a.date.localeCompare(b.date)).map(e => ({
                                        date: e.date, block: e.block, project: e.project, trees: e.totalTrees, hours: e.hoursWorked, earnings: e.totalEarnings,
                                      }));
                                      const empObj = employees.find(e => e.name === p.name);
                                      setPayrollReport({
                                        type: "planter", name: p.name,
                                        employeeNumber: empObj?.employeeNumber ?? "—",
                                        role: empObj?.role ?? "Planter",
                                        crewBoss: planterEntries[0]?.crewBoss ?? "—",
                                        period: `${dateFrom} – ${dateTo}`,
                                        totalTrees: p.totalTrees, earnings: p.totalEarnings,
                                        vacPay: p.totalWithVac - p.totalEarnings,
                                        totalWithVac: p.totalWithVac, days: p.days.size,
                                        speciesRows: speciesRows.map(s => ({ code: s.code, species: s.species, trees: s.trees, earnings: s.earnings, ratePerTree: s.ratePerTree })),
                                        dailyLog: dailyLogRows,
                                        campCosts: camp, equipDeduction: equip, other, gross,
                                        hours, hourlyEarned, topUp, ytd,
                                        otHours, otPay, prevAvgHourly,
                                        cpp, ei, incomeTax: tax, net,
                                        special: net * 0.25, regular: net * 0.75,
                                        additionalEarnings: addl, notes: d.notes,
                                      });
                                    }}
                                    className="px-2 py-1 text-[10px] font-semibold rounded border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                                    title="Generate payroll report">
                                    ⎙ Payroll
                                  </button>
                                </td>
                              </tr>

                              {/* Species breakdown sub-rows */}
                              {isExpanded && (
                                <tr key={`${p.name}-breakdown`} className="bg-surface-secondary/20 border-b border-border/40">
                                  <td colSpan={26} className="px-4 py-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">
                                      Price per Tree Breakdown — {p.name}
                                    </div>
                                    <table className="w-full max-w-xl text-xs">
                                      <thead>
                                        <tr className="border-b border-border/60">
                                          {["Code","Species","Trees","$/Tree","Earnings (incl. Vac Pay)"].map(h => (
                                            <th key={h} className="pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary text-right first:text-left">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {speciesRows.map(s => (
                                          <tr key={s.species} className="border-b border-border/30 last:border-b-0">
                                            <td className="py-1 pr-4 font-mono font-bold text-text-primary">{s.code}</td>
                                            <td className="py-1 pr-4 text-text-secondary">{s.species}</td>
                                            <td className="py-1 pr-4 text-right font-semibold text-text-primary">{fmt(s.trees)}</td>
                                            <td className="py-1 pr-4 text-right text-text-secondary">${s.ratePerTree.toFixed(4)}</td>
                                            <td className="py-1 text-right font-bold" style={{ color: "var(--color-primary)" }}>{fmtC(s.earnings)}</td>
                                          </tr>
                                        ))}
                                        <tr className="border-t border-border font-bold">
                                          <td colSpan={2} className="pt-1.5 text-[10px] uppercase tracking-wide text-text-tertiary">Total</td>
                                          <td className="pt-1.5 text-right text-text-primary">{fmt(p.totalTrees)}</td>
                                          <td className="pt-1.5 text-right text-text-tertiary">
                                            {p.totalTrees > 0 ? `$${(p.totalEarnings / p.totalTrees).toFixed(4)}` : "—"}
                                            <div className="text-[9px] font-normal text-text-tertiary/70">avg $/tree</div>
                                          </td>
                                          <td className="pt-1.5 text-right" style={{ color: "var(--color-primary)" }}>{fmtC(p.totalEarnings)}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                              </>
                            );
                          })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* spacer — keep crew summary in its own row below */}

              {/* ── Crew Summary ── full deduction columns, matching Planter Summary ── */}
              {(() => {
                const CREW_BOSS_RATE = 0.02; // $0.02 per tree planted by their crew

                const MIN_WAGE = 17.20;
                function getCrewDed(name: string) {
                  return crewDeds[name] ?? { campCosts: "", equipDeduction: "", other: "", incomeTax: "", hours: "", additionalEarnings: "", notes: "" };
                }
                function setCrewDedField(name: string, field: string, value: string) {
                  setCrewDeds(prev => ({ ...prev, [name]: { ...getCrewDed(name), [field]: value } }));
                }
                function parseNum(s: string) { return parseFloat(s) || 0; }
                const dedInputCls = "w-20 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-right text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface";

                return (
                <div className="bg-surface border border-border rounded-xl overflow-x-auto lg:col-span-2">
                  <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-xs font-semibold text-text-primary">Crew Summary</div>
                    <div className="flex items-center gap-4 text-[10px] text-text-tertiary flex-wrap">
                      <span>Crew Boss earns <span className="font-semibold text-text-secondary">$0.02 / tree</span> planted by their crew</span>
                      <span className="text-border/80">|</span>
                      <span><span className="font-semibold text-text-secondary">Gross</span> = Earnings − Camp − Equip − Other</span>
                      <span className="text-border/80">|</span>
                      <span><span className="font-semibold text-text-secondary">Net</span> = Gross − CPP − EI − Income Tax</span>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary">
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Emp. ID</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Crew Boss</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Planters</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Crew Trees</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Earnings</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap" style={{ color: "var(--color-primary)" }}>Total w/Vac</th>
                        {/* separator */}
                        <th className="px-1 border-l border-border/60" />
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Camp Costs</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Equip. Deduction</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Other</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>Gross</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">Earnings − deductions</div>
                        </th>
                        {/* Hours / min wage columns */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Hours</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Hourly Earned</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">Earnings ÷ Hours</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Min Wage Top-Up</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">${MIN_WAGE.toFixed(2)}/hr floor</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Total Hrs (YTD)</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">This calendar year</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Overtime Pay</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">&gt;178h/4-wk · 1.5× prev avg</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Additional Earnings</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Notes</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>CPP</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">5.95% of Gross</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>EI</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">1.66% of Gross</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Income Tax</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold whitespace-nowrap" style={{ color: "var(--color-primary)" }}>
                          <div>Net</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-70">Gross − statutory</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap border-l border-border/60">25% Special Worksite</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">75% Regular Income</th>
                        <th className="px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {crewSummary.length === 0
                        ? <tr><td colSpan={26} className="px-3 py-8 text-center text-text-tertiary">No data for this range</td></tr>
                        : crewSummary.map(c => {
                            const earnings     = c.totalTrees * CREW_BOSS_RATE;
                            const totalWithVac = earnings; // vac already included in rate
                            const d            = getCrewDed(c.crew);
                            const camp         = parseNum(d.campCosts);
                            const equip        = parseNum(d.equipDeduction);
                            const other        = parseNum(d.other);
                            const gross        = totalWithVac - camp - equip - other;
                            const hours        = parseNum(d.hours);
                            const hourlyEarned = hours > 0 ? earnings / hours : null;
                            const topUp        = hours > 0 && earnings < MIN_WAGE * hours ? MIN_WAGE * hours - earnings : 0;
                            const crewEmp      = employees.find(e => e.name === c.crew);
                            const crewKey      = crewEmp?.id ?? c.crew;
                            const ytd          = ytdHours.get(crewKey) ?? ytdHours.get(c.crew) ?? 0;
                            // Overtime: >178h in 4-week period @ 1.5× prev-period avg hourly
                            const OT_THRESHOLD = 178;
                            const otHours      = Math.max(0, hours - OT_THRESHOLD);
                            const prevCrew     = prevPeriodData.get(crewKey) ?? prevPeriodData.get(c.crew);
                            const prevAvgHourly = prevCrew && prevCrew.hours > 0 ? prevCrew.withVac / prevCrew.hours : null;
                            const otPay        = otHours > 0 && prevAvgHourly != null ? otHours * 1.5 * prevAvgHourly : null;
                            const cpp          = gross > 0 ? gross * 0.0595 : 0;
                            const ei           = gross > 0 ? gross * 0.0166 : 0;
                            const tax          = parseNum(d.incomeTax);
                            const addl         = parseNum(d.additionalEarnings);
                            const net          = gross + addl - cpp - ei - tax;
                            const empId        = crewEmp?.employeeNumber ?? "—";
                            return (
                              <tr key={c.crew} className="hover:bg-surface-secondary/30">
                                <td className="px-3 py-2 font-mono text-[10px] text-text-tertiary whitespace-nowrap">{empId}</td>
                                <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">{c.crew}</td>
                                <td className="px-3 py-2 text-text-secondary">{c.planters.size}</td>
                                <td className="px-3 py-2 font-semibold text-text-primary">{fmt(c.totalTrees)}</td>
                                <td className="px-3 py-2 text-text-secondary">{fmtC(earnings)}</td>
                                <td className="px-3 py-2 font-semibold" style={{ color: "var(--color-primary)" }}>{fmtC(totalWithVac)}</td>
                                <td className="px-1 border-l border-border/60" />
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.campCosts}
                                    onChange={e => setCrewDedField(c.crew, "campCosts", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.equipDeduction}
                                    onChange={e => setCrewDedField(c.crew, "equipDeduction", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.other}
                                    onChange={e => setCrewDedField(c.crew, "other", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                <td className="px-3 py-2 text-right font-bold bg-surface-secondary/40" style={{ color: gross < 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {fmtC(gross)}
                                </td>
                                {/* Hours (editable — crew bosses enter their own hours) */}
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.5" placeholder="hrs"
                                    value={d.hours}
                                    onChange={e => setCrewDedField(c.crew, "hours", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                {/* Hourly Earned */}
                                <td className="px-3 py-2 text-right font-medium" style={{ color: hourlyEarned != null && hourlyEarned < MIN_WAGE ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {hourlyEarned != null ? `$${hourlyEarned.toFixed(2)}/h` : "—"}
                                </td>
                                {/* Min Wage Top-Up */}
                                <td className="px-3 py-2 text-right font-semibold" style={{ color: topUp > 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {topUp > 0 ? fmtC(topUp) : <span className="text-text-tertiary font-normal">—</span>}
                                </td>
                                {/* Total Hours YTD */}
                                <td className="px-3 py-2 text-right text-text-secondary">
                                  {ytd > 0 ? `${ytd}h` : "—"}
                                </td>
                                {/* Overtime Pay */}
                                <td className="px-3 py-2 text-right font-medium" style={{ color: otHours > 0 ? "rgba(251,191,36,1)" : undefined }}>
                                  {otHours > 0
                                    ? <div>
                                        <div className="font-semibold">{otPay != null ? fmtC(otPay) : "—"}</div>
                                        <div className="text-[10px] opacity-70">{otHours}h OT{prevAvgHourly != null ? ` · $${prevAvgHourly.toFixed(2)}/h` : " · no prev data"}</div>
                                      </div>
                                    : <span className="text-text-tertiary font-normal">—</span>
                                  }
                                </td>
                                {/* Additional Earnings */}
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.additionalEarnings}
                                    onChange={e => setCrewDedField(c.crew, "additionalEarnings", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                {/* Notes */}
                                <td className="px-2 py-1.5">
                                  <input type="text" placeholder="Notes…"
                                    value={d.notes}
                                    onChange={e => setCrewDedField(c.crew, "notes", e.target.value)}
                                    className="w-32 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface" />
                                </td>
                                <td className="px-3 py-2 text-right bg-surface-secondary/40 text-text-secondary font-medium">
                                  {fmtC(cpp)}
                                </td>
                                <td className="px-3 py-2 text-right bg-surface-secondary/40 text-text-secondary font-medium">
                                  {fmtC(ei)}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input type="number" min="0" step="0.01" placeholder="0.00"
                                    value={d.incomeTax}
                                    onChange={e => setCrewDedField(c.crew, "incomeTax", e.target.value)}
                                    className={dedInputCls} />
                                </td>
                                <td className="px-3 py-2 text-right font-black text-sm" style={{ color: net < 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                                  {fmtC(net)}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-text-secondary border-l border-border/60">
                                  {fmtC(net * 0.25)}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-text-secondary">
                                  {fmtC(net * 0.75)}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    onClick={() => {
                                      setPayrollReport({
                                        type: "crew", name: c.crew,
                                        employeeNumber: empId,
                                        role: "Crew Boss",
                                        crewBoss: "—",
                                        period: `${dateFrom} – ${dateTo}`,
                                        totalTrees: c.totalTrees, crewTrees: c.totalTrees, planterCount: c.planters.size,
                                        earnings, vacPay: 0, totalWithVac,
                                        days: 0, speciesRows: [], dailyLog: [],
                                        campCosts: camp, equipDeduction: equip, other, gross,
                                        hours, hourlyEarned, topUp, ytd,
                                        otHours, otPay, prevAvgHourly,
                                        cpp, ei, incomeTax: tax, net,
                                        special: net * 0.25, regular: net * 0.75,
                                        additionalEarnings: addl, notes: d.notes,
                                      });
                                    }}
                                    className="px-2 py-1 text-[10px] font-semibold rounded border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                                    title="Generate payroll report">
                                    ⎙ Payroll
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                      }
                    </tbody>
                  </table>
                </div>
                );
              })()}

              {/* ── Hourly & Day Rate Employees ─────────────────────────────────── */}
              {(() => {
                function parseNum(s: string) { return parseFloat(s) || 0; }
                const MIN_WAGE = 17.20;
                const dedInputCls = "w-20 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-right text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface";

                function addHourlyEmp() {
                  setHourlyEmps(prev => [...prev, {
                    id: `hr-${Date.now()}`, name: "", rateType: "hourly",
                    rate: "", quantity: "", hours: "",
                    campCosts: "", equipDeduction: "", other: "", incomeTax: "",
                    additionalEarnings: "", notes: "",
                  }]);
                }
                function removeHourlyEmp(id: string) {
                  setHourlyEmps(prev => prev.filter(e => e.id !== id));
                }
                function updateHourlyEmp(id: string, field: string, value: string) {
                  setHourlyEmps(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
                }

                return (
                <div className="bg-surface border border-border rounded-xl overflow-x-auto lg:col-span-2">
                  <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Hourly &amp; Day Rate Employees</div>
                      <div className="text-[10px] text-text-tertiary mt-0.5">Non-piece-rate employees — enter hours worked or days on-site</div>
                    </div>
                    <button
                      onClick={addHourlyEmp}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90"
                      style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                    >
                      + Add Employee
                    </button>
                  </div>
                  {hourlyEmps.length === 0 ? (
                    <div className="px-5 py-8 text-center text-xs text-text-tertiary">
                      No hourly or day rate employees added.{" "}
                      <button onClick={addHourlyEmp} className="text-primary hover:underline">Add one →</button>
                    </div>
                  ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary">
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Name</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Type</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Rate</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Hrs / Days</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap" style={{ color: "var(--color-primary)" }}>Earnings</th>
                        {/* separator */}
                        <th className="px-1 border-l border-border/60" />
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Camp Costs</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Equip. Deduction</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Other</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>Gross</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">Earnings − deductions</div>
                        </th>
                        {/* Hours / min wage columns */}
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Hours</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Hourly Earned</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">Earnings ÷ Hours</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Min Wage Top-Up</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">${MIN_WAGE.toFixed(2)}/hr floor</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Total Hrs (YTD)</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">This calendar year</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">
                          <div>Overtime Pay</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">&gt;178h/4-wk · 1.5× prev avg</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Additional Earnings</th>
                        <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Notes</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>CPP</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">5.95% of Gross</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap bg-surface-secondary/60">
                          <div>EI</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-60">1.66% of Gross</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">Income Tax</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold whitespace-nowrap" style={{ color: "var(--color-primary)" }}>
                          <div>Net</div>
                          <div className="text-[9px] font-normal normal-case tracking-normal opacity-70">Gross − statutory</div>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap border-l border-border/60">25% Special</th>
                        <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary whitespace-nowrap">75% Regular</th>
                        <th className="px-2 py-2.5" />
                        <th className="px-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {hourlyEmps.map(emp => {
                        const earnings = parseNum(emp.rate) * parseNum(emp.quantity);
                        const camp     = parseNum(emp.campCosts);
                        const equip    = parseNum(emp.equipDeduction);
                        const other    = parseNum(emp.other);
                        const gross    = earnings - camp - equip - other;
                        // Hours: for hourly type use quantity; for dayrate use explicit hours field
                        const hours    = emp.rateType === "hourly" ? parseNum(emp.quantity) : parseNum(emp.hours);
                        const hourlyEarned = hours > 0 ? earnings / hours : null;
                        const topUp    = hours > 0 && earnings < MIN_WAGE * hours ? MIN_WAGE * hours - earnings : 0;
                        // Overtime: >178h/4-wk @ 1.5× avg hourly (use entered rate as avg for hourly; day-rate uses gross/hours)
                        const OT_THRESHOLD  = 178;
                        const otHours       = Math.max(0, hours - OT_THRESHOLD);
                        const prevAvgHourly = hours > 0 ? gross / hours : null; // current period rate as proxy
                        const otPay         = otHours > 0 && prevAvgHourly != null ? otHours * 1.5 * prevAvgHourly : null;
                        const cpp      = gross > 0 ? gross * 0.0595 : 0;
                        const ei       = gross > 0 ? gross * 0.0166 : 0;
                        const tax      = parseNum(emp.incomeTax);
                        const addl     = parseNum(emp.additionalEarnings);
                        const net      = gross + addl - cpp - ei - tax;
                        return (
                          <tr key={emp.id} className="hover:bg-surface-secondary/30">
                            <td className="px-2 py-1.5">
                              <input
                                type="text" placeholder="Employee name"
                                value={emp.name}
                                onChange={e => updateHourlyEmp(emp.id, "name", e.target.value)}
                                className="w-32 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select
                                value={emp.rateType}
                                onChange={e => updateHourlyEmp(emp.id, "rateType", e.target.value)}
                                className="bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface">
                                <option value="hourly">Hourly</option>
                                <option value="dayrate">Day Rate</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={emp.rate}
                                onChange={e => updateHourlyEmp(emp.id, "rate", e.target.value)}
                                className={dedInputCls} />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min="0" step="0.5" placeholder={emp.rateType === "hourly" ? "hrs" : "days"}
                                value={emp.quantity}
                                onChange={e => updateHourlyEmp(emp.id, "quantity", e.target.value)}
                                className={dedInputCls} />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold" style={{ color: "var(--color-primary)" }}>
                              {fmtC(earnings)}
                            </td>
                            <td className="px-1 border-l border-border/60" />
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={emp.campCosts}
                                onChange={e => updateHourlyEmp(emp.id, "campCosts", e.target.value)}
                                className={dedInputCls} />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={emp.equipDeduction}
                                onChange={e => updateHourlyEmp(emp.id, "equipDeduction", e.target.value)}
                                className={dedInputCls} />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={emp.other}
                                onChange={e => updateHourlyEmp(emp.id, "other", e.target.value)}
                                className={dedInputCls} />
                            </td>
                            <td className="px-3 py-2 text-right font-bold bg-surface-secondary/40" style={{ color: gross < 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                              {fmtC(gross)}
                            </td>
                            {/* Hours: auto for hourly, editable for dayrate */}
                            <td className="px-2 py-1.5 text-right">
                              {emp.rateType === "hourly"
                                ? <span className="text-text-secondary px-1">{parseNum(emp.quantity) > 0 ? `${emp.quantity}h` : "—"}</span>
                                : <input type="number" min="0" step="0.5" placeholder="hrs"
                                    value={emp.hours}
                                    onChange={e => updateHourlyEmp(emp.id, "hours", e.target.value)}
                                    className={dedInputCls} />
                              }
                            </td>
                            {/* Hourly Earned */}
                            <td className="px-3 py-2 text-right font-medium" style={{ color: hourlyEarned != null && hourlyEarned < MIN_WAGE ? "var(--color-danger)" : "var(--color-primary)" }}>
                              {hourlyEarned != null ? `$${hourlyEarned.toFixed(2)}/h` : "—"}
                            </td>
                            {/* Min Wage Top-Up */}
                            <td className="px-3 py-2 text-right font-semibold" style={{ color: topUp > 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                              {topUp > 0 ? fmtC(topUp) : <span className="text-text-tertiary font-normal">—</span>}
                            </td>
                            {/* Total Hours YTD — not tracked for ad-hoc hourly entries */}
                            <td className="px-3 py-2 text-right text-text-tertiary">—</td>
                            {/* Overtime Pay */}
                            <td className="px-3 py-2 text-right font-medium" style={{ color: otHours > 0 ? "rgba(251,191,36,1)" : undefined }}>
                              {otHours > 0
                                ? <div>
                                    <div className="font-semibold">{otPay != null ? fmtC(otPay) : "—"}</div>
                                    <div className="text-[10px] opacity-70">{otHours}h OT</div>
                                  </div>
                                : <span className="text-text-tertiary font-normal">—</span>
                              }
                            </td>
                            {/* Additional Earnings */}
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={emp.additionalEarnings}
                                onChange={e => updateHourlyEmp(emp.id, "additionalEarnings", e.target.value)}
                                className={dedInputCls} />
                            </td>
                            {/* Notes */}
                            <td className="px-2 py-1.5">
                              <input type="text" placeholder="Notes…"
                                value={emp.notes}
                                onChange={e => updateHourlyEmp(emp.id, "notes", e.target.value)}
                                className="w-32 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 focus:bg-surface" />
                            </td>
                            <td className="px-3 py-2 text-right bg-surface-secondary/40 text-text-secondary font-medium">
                              {fmtC(cpp)}
                            </td>
                            <td className="px-3 py-2 text-right bg-surface-secondary/40 text-text-secondary font-medium">
                              {fmtC(ei)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={emp.incomeTax}
                                onChange={e => updateHourlyEmp(emp.id, "incomeTax", e.target.value)}
                                className={dedInputCls} />
                            </td>
                            <td className="px-3 py-2 text-right font-black text-sm" style={{ color: net < 0 ? "var(--color-danger)" : "var(--color-primary)" }}>
                              {fmtC(net)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-text-secondary border-l border-border/60">
                              {fmtC(net * 0.25)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-text-secondary">
                              {fmtC(net * 0.75)}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => {
                                  setPayrollReport({
                                    type: "hourly", name: emp.name || "—",
                                    employeeNumber: employees.find(e => e.name === emp.name)?.employeeNumber ?? "—",
                                    role: emp.rateType === "hourly" ? "Hourly Employee" : "Day Rate Employee",
                                    crewBoss: "—",
                                    period: `${dateFrom} – ${dateTo}`,
                                    totalTrees: 0, earnings, vacPay: 0, totalWithVac: earnings,
                                    days: emp.rateType === "dayrate" ? parseNum(emp.quantity) : 0,
                                    speciesRows: [], dailyLog: [],
                                    rateType: emp.rateType, rate: parseNum(emp.rate), quantity: parseNum(emp.quantity),
                                    campCosts: camp, equipDeduction: equip, other, gross,
                                    hours, hourlyEarned, topUp, ytd: 0,
                                    otHours, otPay, prevAvgHourly,
                                    cpp, ei, incomeTax: tax, net,
                                    special: net * 0.25, regular: net * 0.75,
                                    additionalEarnings: addl, notes: emp.notes,
                                  });
                                }}
                                className="px-2 py-1 text-[10px] font-semibold rounded border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                                title="Generate payroll report">
                                ⎙ Payroll
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => removeHourlyEmp(emp.id)}
                                className="text-text-tertiary hover:text-red-400 transition-colors text-sm leading-none"
                                title="Remove">
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
                );
              })()}

              {/* Species totals */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden lg:col-span-2">
                <div className="px-5 py-3 border-b border-border text-xs font-semibold text-text-primary">Species Totals</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary">
                      {["Species","Code","Total Trees","Total Earnings","% of Trees"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {speciesSummary.length === 0
                      ? <tr><td colSpan={5} className="px-3 py-8 text-center text-text-tertiary">No data for this range</td></tr>
                      : speciesSummary.map(s => (
                        <tr key={s.species} className="hover:bg-surface-secondary/40">
                          <td className="px-3 py-2.5 font-medium text-text-primary">{s.species}</td>
                          <td className="px-3 py-2.5 font-mono text-text-secondary">{s.code}</td>
                          <td className="px-3 py-2.5 font-semibold text-text-primary">{fmt(s.trees)}</td>
                          <td className="px-3 py-2.5 text-text-secondary">{fmtC(s.earnings)}</td>
                          <td className="px-3 py-2.5 text-text-secondary">
                            {totals.totalTrees > 0 ? `${((s.trees / totals.totalTrees) * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Block summary */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden lg:col-span-2">
                <div className="px-5 py-3 border-b border-border text-xs font-semibold text-text-primary">Block Summary</div>
                {blockSummary.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-text-tertiary">No data for this range</div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {blockSummary.map(b => {
                      const speciesRows = [...b.species.entries()].sort((a, b) => b[1].trees - a[1].trees);
                      return (
                        <div key={b.block} className="px-5 py-4">
                          {/* Block header row */}
                          <div className="flex items-center gap-4 mb-3">
                            <div className="text-xs font-semibold text-text-primary">{b.block}</div>
                            <div className="text-[11px] text-text-tertiary">
                              {b.planters.size} planter{b.planters.size !== 1 ? "s" : ""} · {fmt(b.totalTrees)} trees · {fmtC(b.totalEarnings)}
                            </div>
                          </div>
                          {/* Species chips grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {speciesRows.map(([species, s]) => (
                              <div key={species} className="bg-surface-secondary border border-border rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-bold text-text-secondary font-mono">{s.code}</span>
                                  <span className="text-[10px] text-text-tertiary">{fmtC(s.earnings)}</span>
                                </div>
                                <div className="text-sm font-bold text-text-primary">{fmt(s.trees)}</div>
                                <div className="text-[10px] text-text-tertiary mt-0.5">{species}</div>
                              </div>
                            ))}
                            {/* Block total chip */}
                            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                              <div className="text-[10px] font-bold text-primary mb-1">TOTAL</div>
                              <div className="text-sm font-bold text-text-primary">{fmt(b.totalTrees)}</div>
                              <div className="text-[10px] text-text-tertiary mt-0.5">{fmtC(b.totalEarnings)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ────────────────────────────── RATES ───────────────────────────── */}
        {tab === "rates" && (
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Camp Cost Rate card */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <div className="text-xs font-semibold text-text-primary">Camp Cost Rate</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">Pre-fills planter camp costs in Summary as rate × days worked — still editable per planter</div>
              </div>
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Rate Type</div>
                  <div className="text-sm font-semibold text-text-primary">Per Day (Per Planter)</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Auto-applied to Planter Summary · override per person as needed</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Rate ($/day)</div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xl font-black" style={{ color: "var(--color-primary)" }}>$</span>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={campCostRate || ""}
                      onChange={e => setCampCostRate(parseFloat(e.target.value) || 0)}
                      className="w-24 text-right text-xl font-black bg-surface-secondary border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary/50 focus:bg-surface"
                      style={{ color: "var(--color-primary)" }}
                    />
                  </div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">per planter per day</div>
                </div>
              </div>
              {campCostRate > 0 && (
                <div className="px-5 pb-4">
                  <div className="rounded-lg px-4 py-2.5 text-[11px] text-text-tertiary leading-relaxed"
                    style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
                    Example: A planter working <strong className="text-text-secondary">10 days</strong> will have camp costs of{" "}
                    <strong className="text-text-secondary">{fmtC(campCostRate * 10)}</strong> pre-filled. Clear the field in Summary to reset for a planter.
                  </div>
                </div>
              )}
            </div>

            {/* Crew Boss Rate card */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <div className="text-xs font-semibold text-text-primary">Crew Boss Rate</div>
                <div className="text-[10px] text-text-tertiary mt-0.5">Fixed company rate — applies to all crew bosses</div>
              </div>
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Rate Type</div>
                  <div className="text-sm font-semibold text-text-primary">Per Tree (Crew Plants)</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Crew boss earns for every tree their crew plants in the period</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-1">Rate</div>
                  <div className="text-2xl font-black" style={{ color: "var(--color-primary)" }}>$0.02</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">per tree planted by crew</div>
                </div>
              </div>
              <div className="px-5 pb-4">
                <div className="rounded-lg px-4 py-2.5 text-[11px] text-text-tertiary leading-relaxed"
                  style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
                  Example: A crew boss whose crew plants <strong className="text-text-secondary">10,000 trees</strong> earns{" "}
                  <strong className="text-text-secondary">$200.00</strong> for the period. CPP (5.95%) and EI (1.66%) are automatically deducted in Crew Summary.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-text-primary">Species Rates</div>
                <div className="text-xs text-text-tertiary mt-0.5">Per-tree rates used to calculate planter earnings</div>
              </div>
              <button onClick={openAddRate} className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">+ Add Rate</button>
            </div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary">
                    {["Species","Code","Rate Bucket","Rate","Trees/Box",""].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rates.map(r => (
                    <tr key={r.id} className="group hover:bg-surface-secondary/40">
                      <td className="px-4 py-3 font-medium text-text-primary">{r.species}</td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{r.code}</td>
                      <td className="px-4 py-3 text-text-secondary">{r.rateBucket || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {r.rateType === "tiered" && r.tierThreshold != null
                          ? <span className="text-[11px]">
                              <span className="text-text-tertiary">&lt;{fmt(r.tierThreshold)}: </span>
                              <span>${(r.rateBelowThreshold ?? 0).toFixed(4)}</span>
                              <span className="text-text-tertiary mx-1">|</span>
                              <span className="text-text-tertiary">≥{fmt(r.tierThreshold)}: </span>
                              <span>${(r.rateAboveThreshold ?? 0).toFixed(4)}</span>
                            </span>
                          : `$${r.ratePerTree.toFixed(4)}`
                        }
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.treesPerBox ? <span className="font-mono font-semibold text-text-primary">{r.treesPerBox}</span> : <span className="text-text-tertiary">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditRate(r)} className="text-[11px] text-primary hover:text-primary/80 font-medium">Edit</button>
                          <button onClick={() => handleDeleteRate(r.id)} className="text-[11px] text-text-tertiary hover:text-red-400 font-medium">Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ────────────────────────────── CLIENT SUMMARY ───────────────────── */}
        {tab === "client" && (() => {
          const allBlocks = clientBlockSummary;

          // Derived project list
          const allProjects = [...new Set(allBlocks.map(b => b.project))].sort();

          // Project-filtered blocks
          const projFilteredBlocks = clientSelectedProjects.size === 0
            ? allBlocks
            : allBlocks.filter(b => clientSelectedProjects.has(b.project));

          // Blocks available for block-level filter (only within selected projects)
          const availableBlocks = projFilteredBlocks;

          // Final visible blocks
          const visibleBlocks = availableBlocks.filter(b =>
            clientSelectedBlocks.size === 0 || clientSelectedBlocks.has(`${b.project}|${b.block}`)
          );

          const totalTrees   = visibleBlocks.reduce((s, b) => s + b.totalTrees, 0);
          const totalPlanters = new Set(visibleBlocks.flatMap(b => [...b.planters])).size;

          function isProjSelected(p: string) {
            return clientSelectedProjects.size === 0 || clientSelectedProjects.has(p);
          }
          function toggleProject(p: string) {
            setClientSelectedProjects(prev => {
              const base = prev.size === 0 ? new Set(allProjects) : new Set(prev);
              if (base.has(p)) base.delete(p); else base.add(p);
              // Clear block selections that no longer belong to a selected project
              setClientSelectedBlocks(new Set());
              return base;
            });
          }
          function allProjectsSelected() {
            return clientSelectedProjects.size === 0 || allProjects.every(p => clientSelectedProjects.has(p));
          }
          function toggleAllProjects() {
            setClientSelectedProjects(allProjectsSelected() ? new Set(allProjects.filter(() => false)) : new Set());
            setClientSelectedBlocks(new Set());
          }

          function isBlockSelected(key: string) {
            return clientSelectedBlocks.size === 0 || clientSelectedBlocks.has(key);
          }
          function toggleBlock(key: string) {
            setClientSelectedBlocks(prev => {
              const base = prev.size === 0 ? new Set(availableBlocks.map(b => `${b.project}|${b.block}`)) : new Set(prev);
              if (base.has(key)) base.delete(key); else base.add(key);
              return base;
            });
          }
          function allBlocksSelected() {
            return clientSelectedBlocks.size === 0 || availableBlocks.every(b => clientSelectedBlocks.has(`${b.project}|${b.block}`));
          }
          function toggleAllBlocks() {
            setClientSelectedBlocks(allBlocksSelected() ? new Set(availableBlocks.map(b => `${b.project}|${b.block}`).filter(() => false)) : new Set());
          }

          return (
            <div className="max-w-5xl mx-auto space-y-5">

              {/* Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-text-primary">Client Summary</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Production report for client delivery — pricing excluded</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                  {/* Generate for date */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowGenerate(v => !v); setOpenExport(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface hover:bg-surface-secondary transition-all text-text-primary"
                    >
                      Generate for date
                    </button>
                    {showGenerate && (
                      <div className="absolute right-0 top-full mt-1 w-64 bg-surface border border-border rounded-xl shadow-xl z-20 p-3 space-y-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Generate report for a single day</div>
                        <input
                          type="date"
                          value={generateForDate}
                          onChange={e => setGenerateForDate(e.target.value)}
                          className="w-full text-xs rounded-lg border border-border bg-surface-secondary px-3 py-2 text-text-primary focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => {
                            setShowGenerate(false);
                            printClientSummary(generateForDate);
                          }}
                          className="w-full py-2 text-xs font-semibold rounded-lg transition-all hover:opacity-90"
                          style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                        >
                          Generate &amp; Print
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Export as */}
                  {allBlocks.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => { setOpenExport(v => v === "client" ? null : "client"); setShowGenerate(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90"
                        style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                      >
                        Export as
                        <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                      </button>
                      {openExport === "client" && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                          <button onClick={printClientSummary} className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary transition-colors flex items-center gap-2">
                            <span className="text-text-tertiary">⎙</span> Print / Save PDF
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {allBlocks.length === 0 ? (
                <div className="bg-surface border border-border rounded-xl px-5 py-16 text-center">
                  <div className="text-3xl opacity-20 mb-2">⬡</div>
                  {entries.length === 0 ? (
                    <>
                      <div className="text-xs text-text-tertiary">No production entries logged yet.</div>
                      <button onClick={() => setTab("entry")} className="mt-3 text-xs text-primary hover:underline">Log production →</button>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-text-tertiary">No entries for this date range.</div>
                      <div className="text-[11px] text-text-tertiary mt-1 opacity-60">Try widening the From / To dates above.</div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Filters */}
                  <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
                    {/* Date range */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Date Range</span>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-text-tertiary">From</label>
                        <input type="date" value={clientDateFrom} onChange={e => setClientDateFrom(e.target.value)} className={filterInputCls} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-text-tertiary">To</label>
                        <input type="date" value={clientDateTo} min={clientDateFrom} onChange={e => setClientDateTo(e.target.value)} className={filterInputCls} />
                      </div>
                    </div>

                    {/* Project toggles */}
                    {allProjects.length > 1 && (
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Projects</span>
                          <button onClick={toggleAllProjects} className="text-[10px] text-primary hover:underline font-medium">
                            {allProjectsSelected() ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {allProjects.map(p => {
                            const sel = isProjSelected(p);
                            return (
                              <button
                                key={p}
                                onClick={() => toggleProject(p)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                                style={sel
                                  ? { background: "rgba(57,222,139,0.1)", borderColor: "rgba(57,222,139,0.4)", color: "var(--color-primary)" }
                                  : { background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text-tertiary)" }
                                }
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sel ? "var(--color-primary)" : "currentColor", opacity: sel ? 1 : 0.3 }} />
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Block toggles */}
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Blocks</span>
                        <button onClick={toggleAllBlocks} className="text-[10px] text-primary hover:underline font-medium">
                          {allBlocksSelected() ? "Deselect all" : "Select all"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableBlocks.map(b => {
                          const key = `${b.project}|${b.block}`;
                          const sel = isBlockSelected(key);
                          return (
                            <button
                              key={key}
                              onClick={() => toggleBlock(key)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                              style={sel
                                ? { background: "rgba(57,222,139,0.1)", borderColor: "rgba(57,222,139,0.4)", color: "var(--color-primary)" }
                                : { background: "transparent", borderColor: "var(--color-border)", color: "var(--color-text-tertiary)" }
                              }
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: sel ? "var(--color-primary)" : "currentColor", opacity: sel ? 1 : 0.3 }} />
                              {b.block}
                              {allProjects.length > 1 && <span className="opacity-50 text-[9px]">{b.project}</span>}
                              <span className="opacity-60">{fmt(b.totalTrees)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* KPI strip */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Blocks", value: visibleBlocks.length },
                      { label: "Total Trees", value: fmt(totalTrees) },
                      { label: "Planters", value: totalPlanters },
                    ].map(k => (
                      <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{k.label}</div>
                        <div className="text-2xl font-bold text-text-primary mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Block cards */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    {visibleBlocks.length === 0 ? (
                      <div className="px-5 py-12 text-center text-xs text-text-tertiary">No blocks match the selected filters.</div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {visibleBlocks.map(b => {
                          const speciesRows = [...b.species.entries()].sort((a, bv) => bv[1].trees - a[1].trees);
                          const crewRows = [...b.crews.entries()].sort((a, bv) => bv[1].totalTrees - a[1].totalTrees);
                          return (
                            <div key={`${b.project}|${b.block}`} className="px-5 py-4">
                              <div className="flex items-center gap-4 mb-3">
                                <div className="text-xs font-semibold text-text-primary">{b.block}</div>
                                <div className="text-[10px] text-text-tertiary">{b.project}</div>
                                <div className="text-[11px] text-text-tertiary">
                                  {b.planters.size} planter{b.planters.size !== 1 ? "s" : ""} · {fmt(b.totalTrees)} trees
                                </div>
                                <div className="text-[10px] text-text-tertiary ml-auto">{[...b.dates].sort().join(", ")}</div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {speciesRows.map(([species, s]) => (
                                  <div key={species} className="bg-surface-secondary border border-border rounded-lg px-3 py-2">
                                    <div className="text-[10px] font-bold text-text-secondary font-mono mb-1">{s.code}</div>
                                    <div className="text-sm font-bold text-text-primary">{fmt(s.trees)}</div>
                                    <div className="text-[10px] text-text-tertiary mt-0.5">{species}</div>
                                  </div>
                                ))}
                                <div className="rounded-lg px-3 py-2" style={{ background: "rgba(57,222,139,0.08)", border: "1px solid rgba(57,222,139,0.2)" }}>
                                  <div className="text-[10px] font-bold mb-1" style={{ color: "var(--color-primary)" }}>TOTAL</div>
                                  <div className="text-sm font-bold text-text-primary">{fmt(b.totalTrees)}</div>
                                  <div className="text-[10px] text-text-tertiary mt-0.5">{b.planters.size} planters</div>
                                </div>
                              </div>

                              {/* Per-crew breakdown */}
                              {crewRows.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">By Crew</div>
                                  <div className="space-y-1.5">
                                    {crewRows.map(([crewName, c]) => {
                                      const crewSpecies = [...c.species.entries()].sort((a, bv) => bv[1].trees - a[1].trees);
                                      return (
                                        <div key={crewName} className="flex items-center gap-3 text-[11px]">
                                          <div className="text-text-primary font-medium min-w-[120px] truncate">{crewName}</div>
                                          <div className="text-text-tertiary tabular-nums">{c.planters.size} planter{c.planters.size !== 1 ? "s" : ""}</div>
                                          <div className="text-text-primary font-semibold tabular-nums">{fmt(c.totalTrees)} trees</div>
                                          <div className="text-text-tertiary text-[10px] flex flex-wrap gap-x-2">
                                            {crewSpecies.map(([sp, ss]) => (
                                              <span key={sp} className="font-mono"><span className="font-bold">{ss.code}</span> {fmt(ss.trees)}</span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ────────────────────────────── BLOCKS ──────────────────────────── */}
        {tab === "blocks" && (() => {
          const projects = [...new Set(entries.map(e => e.project || "(No Project)"))].sort();

          // Default to first project if none selected
          const activeProject = viewProject && projects.includes(viewProject) ? viewProject : (projects[0] ?? "");

          const blocksForProject = adjProject
            ? [...new Set(entries.filter(e => (e.project || "(No Project)") === adjProject).map(e => e.block || "(No Block)"))].sort()
            : [];
          const selectedRec = adjProject && adjBlock
            ? blockSummaryByProject.find(r => r.project === adjProject && r.block === adjBlock)
            : null;

          const visibleBlocks = blockSummaryByProject.filter(b => b.project === activeProject);

          function openEditor(proj: string, blk: string) {
            setAdjProject(proj);
            setAdjBlock(blk);
            setAdjReason("");
            const rec = blockSummaryByProject.find(r => r.project === proj && r.block === blk);
            if (rec) {
              const edits: Record<string, string> = {};
              for (const [sp, s] of rec.species) edits[sp] = String(s.trees);
              setAdjEdits(edits);
            }
          }

          async function saveAdjustments() {
            if (!selectedRec) return;
            const now = new Date().toISOString();
            const newAdjs: BlockAdjustment[] = [];
            for (const [species, s] of selectedRec.species) {
              const newVal = parseInt(adjEdits[species] ?? String(s.trees), 10);
              if (isNaN(newVal) || newVal === s.trees) continue;
              const adj: BlockAdjustment = {
                id: `adj_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                timestamp: now,
                project: adjProject,
                block: adjBlock,
                species,
                speciesCode: s.code,
                originalTrees: s.baseTrees ?? s.trees,
                newTrees: newVal,
                delta: newVal - s.trees,
                reason: adjReason,
              };
              await saveBlockAdjustment(adj);
              newAdjs.push(adj);
            }
            if (newAdjs.length === 0) { showToast("No changes to save"); return; }
            setBlockAdjustments(prev => [...newAdjs, ...prev]);
            setAdjReason("");
            showToast(`Saved ${newAdjs.length} adjustment${newAdjs.length !== 1 ? "s" : ""}`);
          }

          return (
            <div className="max-w-5xl mx-auto space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-text-primary">Block Summary</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Select a project to view its blocks</div>
                </div>
                {blockSummaryByProject.length > 0 && (
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenExport(v => v === "blocks" ? null : "blocks")}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors"
                    >
                      Export as
                      <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    {openExport === "blocks" && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                        <button onClick={exportBlockCSV} className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary transition-colors flex items-center gap-2">
                          <span className="text-text-tertiary">↓</span> Export CSV
                        </button>
                        <button onClick={printBlockSummary} className="w-full text-left px-4 py-2.5 text-xs text-text-primary hover:bg-surface-secondary transition-colors flex items-center gap-2">
                          <span className="text-text-tertiary">⎙</span> Print / PDF
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Project tabs */}
              {projects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {projects.map(p => {
                    const projBlocks = blockSummaryByProject.filter(b => b.project === p);
                    const projTrees  = projBlocks.reduce((s, b) => s + b.totalTrees, 0);
                    const active = p === activeProject;
                    return (
                      <button
                        key={p}
                        onClick={() => setViewProject(p)}
                        className="flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition-all"
                        style={active
                          ? { background: "rgba(57,222,139,0.1)", borderColor: "rgba(57,222,139,0.4)", color: "var(--color-primary)" }
                          : { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }
                        }
                      >
                        <span className="text-xs font-semibold">{p}</span>
                        <span className="text-[10px] opacity-60 mt-0.5">{projBlocks.length} block{projBlocks.length !== 1 ? "s" : ""} · {fmt(projTrees)} trees</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Adjust panel */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Manual Adjustment</div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-text-tertiary uppercase tracking-wider">Project</label>
                    <select
                      value={adjProject}
                      onChange={e => { setAdjProject(e.target.value); setAdjBlock(""); setAdjEdits({}); }}
                      className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary min-w-[160px]"
                    >
                      <option value="">— Select project —</option>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-text-tertiary uppercase tracking-wider">Block</label>
                    <select
                      value={adjBlock}
                      onChange={e => openEditor(adjProject, e.target.value)}
                      disabled={!adjProject}
                      className="text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary min-w-[140px] disabled:opacity-40"
                    >
                      <option value="">— Select block —</option>
                      {blocksForProject.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                {selectedRec && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {[...selectedRec.species.entries()].sort((a, b) => b[1].trees - a[1].trees).map(([species, s]) => {
                        const adjKey = `${adjProject}|${adjBlock}|${species}`;
                        const hasAdj = latestAdjMap.has(adjKey);
                        const currentVal = parseInt(adjEdits[species] ?? String(s.trees), 10);
                        const delta = currentVal - s.baseTrees;
                        return (
                          <div key={species} className={`rounded-xl border px-3 py-3 space-y-1.5 ${hasAdj ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-surface-secondary"}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold font-mono text-text-secondary">{s.code}</span>
                              {hasAdj && <span className="text-[9px] text-amber-500 font-semibold">ADJUSTED</span>}
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={adjEdits[species] ?? String(s.trees)}
                              onChange={e => setAdjEdits(prev => ({ ...prev, [species]: e.target.value }))}
                              className="w-full text-sm font-bold text-text-primary bg-transparent border-b border-border focus:border-primary outline-none pb-0.5"
                            />
                            <div className="text-[10px] text-text-tertiary">{species}</div>
                            {delta !== 0 && !isNaN(delta) && (
                              <div className={`text-[10px] font-semibold ${delta > 0 ? "text-green-500" : "text-red-400"}`}>
                                {delta > 0 ? "+" : ""}{fmt(delta)} from base
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Reason for adjustment (optional)"
                        value={adjReason}
                        onChange={e => setAdjReason(e.target.value)}
                        className="flex-1 text-xs bg-surface-secondary border border-border rounded-lg px-3 py-1.5 text-text-primary placeholder-text-tertiary"
                      />
                      <button
                        onClick={saveAdjustments}
                        className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                        style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Block list for selected project */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                {blockSummaryByProject.length === 0 ? (
                  <div className="px-5 py-16 text-center text-xs text-text-tertiary">
                    <div className="text-3xl opacity-20 mb-2">⬡</div>
                    <div>No production entries logged yet.</div>
                    <button onClick={() => setTab("entry")} className="mt-3 text-xs text-primary hover:underline">Log production →</button>
                  </div>
                ) : visibleBlocks.length === 0 ? (
                  <div className="px-5 py-10 text-center text-xs text-text-tertiary">No blocks for this project.</div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {visibleBlocks.map(b => {
                      const speciesRows = [...b.species.entries()].sort((a, bv) => bv[1].trees - a[1].trees);
                      const hasAny = speciesRows.some(([sp]) => latestAdjMap.has(`${b.project}|${b.block}|${sp}`));
                      const targetKey = `${b.project}|${b.block}`;
                      const target = blockTargets.get(targetKey);
                      const prescription   = target?.prescription   ?? 0;
                      const treesDelivered = target?.treesDelivered ?? 0;
                      const treesPlanted   = b.totalTrees;
                      const remaining      = prescription > 0 ? prescription - treesPlanted : null;

                      const pbEntry = projectBlocks.find(pb => pb.blockName.trim().toLowerCase() === b.block.trim().toLowerCase());
                      const prescriptionBySpecies = pbEntry
                        ? new Map(pbEntry.allocations.map(a => [a.species.trim().toLowerCase(), a.trees]))
                        : new Map<string, number>();

                      async function updateTarget(field: "prescription" | "treesDelivered", raw: string) {
                        const val = parseInt(raw, 10);
                        const next: BlockTarget = {
                          id: targetKey,
                          project: b.project,
                          block: b.block,
                          prescription:   field === "prescription"   ? (isNaN(val) ? 0 : val) : (target?.prescription   ?? 0),
                          treesDelivered: field === "treesDelivered" ? (isNaN(val) ? 0 : val) : (target?.treesDelivered ?? 0),
                        };
                        await saveBlockTarget(next);
                        setBlockTargets(prev => new Map(prev).set(targetKey, next));
                      }

                      return (
                        <div key={targetKey} className="px-5 py-4 space-y-4">
                          {/* Block header */}
                          <div className="flex items-center gap-3">
                            <div className="text-xs font-semibold text-text-primary">{b.block}</div>
                            {hasAny && <span className="text-[9px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Adjusted</span>}
                            <div className="text-[11px] text-text-tertiary ml-auto">
                              {b.planters.size} planter{b.planters.size !== 1 ? "s" : ""}
                            </div>
                            <button onClick={() => openEditor(b.project, b.block)} className="text-[10px] text-primary hover:underline">Edit trees</button>
                          </div>

                          {/* 4 metric tiles */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* Prescription — editable */}
                            <div className="bg-surface-secondary border border-border rounded-xl px-4 py-3">
                              <div className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5">Prescription</div>
                              <input
                                type="number"
                                min={0}
                                defaultValue={prescription || ""}
                                placeholder="—"
                                onBlur={e => updateTarget("prescription", e.target.value)}
                                className="w-full text-lg font-bold text-text-primary bg-transparent border-b border-border focus:border-primary outline-none pb-0.5"
                              />
                              <div className="text-[9px] text-text-tertiary mt-1">trees target</div>
                            </div>

                            {/* Trees Delivered — editable */}
                            <div className="bg-surface-secondary border border-border rounded-xl px-4 py-3">
                              <div className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5">Delivered</div>
                              <input
                                type="number"
                                min={0}
                                defaultValue={treesDelivered || ""}
                                placeholder="—"
                                onBlur={e => updateTarget("treesDelivered", e.target.value)}
                                className="w-full text-lg font-bold text-text-primary bg-transparent border-b border-border focus:border-primary outline-none pb-0.5"
                              />
                              <div className="text-[9px] text-text-tertiary mt-1">trees delivered</div>
                            </div>

                            {/* Trees Planted — computed */}
                            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                              <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-primary)" }}>Planted</div>
                              <div className="text-lg font-bold text-text-primary">{fmt(treesPlanted)}</div>
                              <div className="text-[9px] text-text-tertiary mt-1">trees planted</div>
                            </div>

                            {/* Remaining */}
                            <div className={`rounded-xl px-4 py-3 border ${remaining === null ? "bg-surface-secondary border-border" : remaining > 0 ? "bg-surface-secondary border-border" : "bg-red-500/5 border-red-500/20"}`}>
                              <div className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5">Remaining</div>
                              <div className={`text-lg font-bold ${remaining === null ? "text-text-tertiary" : remaining > 0 ? "text-text-primary" : "text-red-400"}`}>
                                {remaining === null ? "—" : remaining > 0 ? fmt(remaining) : `+${fmt(Math.abs(remaining))}`}
                              </div>
                              <div className="text-[9px] text-text-tertiary mt-1">{remaining === null ? "set prescription" : remaining > 0 ? "to complete" : "over prescription"}</div>
                            </div>
                          </div>

                          {/* Species chips */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {speciesRows.map(([species, s]) => {
                              const isAdj = latestAdjMap.has(`${b.project}|${b.block}|${species}`);
                              const prescribed = prescriptionBySpecies.get(species.trim().toLowerCase()) ?? null;
                              const spRemaining = prescribed !== null ? prescribed - s.trees : null;
                              return (
                                <div key={species} className={`rounded-lg px-3 py-2 border ${isAdj ? "bg-amber-500/5 border-amber-500/30" : "bg-surface-secondary border-border"}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-text-secondary font-mono">{s.code}</span>
                                    {isAdj && <span className="text-[9px] text-amber-500">✎</span>}
                                  </div>
                                  <div className="text-sm font-bold text-text-primary">{fmt(s.trees)}</div>
                                  {prescribed !== null && (
                                    <div className="text-[9px] text-text-tertiary mt-0.5">
                                      of {fmt(prescribed)} prescribed
                                    </div>
                                  )}
                                  {prescribed === null && (
                                    <div className="text-[10px] text-text-tertiary mt-0.5">{species}</div>
                                  )}
                                  {spRemaining !== null && (
                                    <div className={`text-[9px] font-semibold mt-0.5 ${spRemaining > 0 ? "text-text-tertiary" : "text-red-400"}`}>
                                      {spRemaining > 0 ? `${fmt(spRemaining)} left` : `+${fmt(Math.abs(spRemaining))} over`}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ────────────────────────── SUPERVISOR OVERVIEW ─────────────────────── */}
        {tab === "oversight" && (() => {
          const tomorrow = new Date(new Date(oversightDate).getTime() + 86400000).toISOString().slice(0, 10);

          // All entries for the selected date
          const dayEntries = entries.filter(e => e.date === oversightDate);

          // Group entries by crew boss
          const crewMap = new Map<string, {
            crewBoss: string;
            totalTrees: number;
            planters: Set<string>;
            blocks: Set<string>;
            projects: Set<string>;
            species: Map<string, { code: string; trees: number }>;
            planForTomorrow: string;
            needsNotes: string;
            equipmentFuelLevel: string;
            vehicleFuelLevel: string;
          }>();
          for (const e of dayEntries) {
            const cb = e.crewBoss || "(No Crew Boss)";
            if (!crewMap.has(cb)) crewMap.set(cb, {
              crewBoss: cb, totalTrees: 0,
              planters: new Set(), blocks: new Set(), projects: new Set(),
              species: new Map(),
              planForTomorrow: ((e as unknown) as Record<string, unknown>).planForTomorrow as string ?? "",
              needsNotes: ((e as unknown) as Record<string, unknown>).needsNotes as string ?? "",
              equipmentFuelLevel: ((e as unknown) as Record<string, unknown>).equipmentFuelLevel as string ?? "",
              vehicleFuelLevel: ((e as unknown) as Record<string, unknown>).vehicleFuelLevel as string ?? "",
            });
            const rec = crewMap.get(cb)!;
            rec.totalTrees += e.totalTrees;
            rec.planters.add(e.employeeId || e.employeeName);
            if (e.block) rec.blocks.add(e.block);
            if (e.project) rec.projects.add(e.project);
            // Prefer the last non-empty planForTomorrow
            const pft = ((e as unknown) as Record<string, unknown>).planForTomorrow as string ?? "";
            if (pft) rec.planForTomorrow = pft;
            const nn = ((e as unknown) as Record<string, unknown>).needsNotes as string ?? "";
            if (nn) rec.needsNotes = nn;
            const efl = ((e as unknown) as Record<string, unknown>).equipmentFuelLevel as string ?? "";
            if (efl) rec.equipmentFuelLevel = efl;
            const vfl = ((e as unknown) as Record<string, unknown>).vehicleFuelLevel as string ?? "";
            if (vfl) rec.vehicleFuelLevel = vfl;
            for (const l of e.production) {
              const s = rec.species.get(l.species) ?? { code: l.code, trees: 0 };
              s.trees += l.trees;
              rec.species.set(l.species, s);
            }
          }
          const crewRows = [...crewMap.values()].sort((a, b) => b.totalTrees - a.totalTrees);

          // Block status: delivered vs planted
          const dayDeliveries = deliveries.filter(d => d.date === oversightDate);
          const allBlockNames = [...new Set([
            ...dayEntries.map(e => e.block).filter(Boolean),
            ...dayDeliveries.map(d => d.block).filter(Boolean),
          ])].sort();

          const blockStatusRows = allBlockNames.map(block => {
            const delivered = dayDeliveries
              .filter(d => d.block === block)
              .reduce((sum, d) => sum + d.totalTrees, 0);
            const planted = dayEntries
              .filter(e => e.block === block)
              .reduce((sum, e) => sum + e.totalTrees, 0);
            const remaining = delivered - planted;
            const pct = delivered > 0 ? Math.min(100, Math.round((planted / delivered) * 100)) : 0;
            // Crew bosses on this block
            const blockCrews = [...new Set(dayEntries.filter(e => e.block === block).map(e => e.crewBoss).filter(Boolean))];
            return { block, delivered, planted, remaining, pct, blockCrews };
          });

          // Tomorrow: collect plan notes + delivery plans + upcoming block plans
          const tomorrowDeliveries = deliveryPlans.filter(p => p.planDate === tomorrow);
          const tomorrowOrders = treeOrders.filter(o => o.orderDate === tomorrow);

          const grandTotalTrees = crewRows.reduce((s, c) => s + c.totalTrees, 0);
          const grandTotalPlanters = new Set(dayEntries.map(e => e.employeeId || e.employeeName)).size;

          return (
            <div className="max-w-6xl mx-auto space-y-6">

              {/* Header row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">Supervisor Overview</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Daily field summary — crew production, block status &amp; tomorrow's plan</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-text-tertiary">Date</label>
                  <input
                    type="date"
                    value={oversightDate}
                    onChange={e => setOversightDate(e.target.value)}
                    className="text-xs bg-surface border border-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Day KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Trees Planted", value: fmt(grandTotalTrees), accent: true },
                  { label: "Active Planters",      value: String(grandTotalPlanters) },
                  { label: "Crew Bosses",           value: String(crewRows.length) },
                  { label: "Blocks Worked",         value: String(allBlockNames.length) },
                ].map(k => (
                  <div key={k.label} className={`rounded-xl border p-4 ${k.accent ? "border-primary/30 bg-primary/5" : "border-border bg-surface"}`}>
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                    <div className={`text-xl font-bold mt-1 ${k.accent ? "text-primary" : "text-text-primary"}`}>{k.value}</div>
                  </div>
                ))}
              </div>

              {dayEntries.length === 0 ? (
                <div className="bg-surface border border-border rounded-xl px-6 py-16 text-center">
                  <div className="text-3xl opacity-20 mb-2">⬡</div>
                  <div className="text-xs text-text-tertiary">No production entries logged for {oversightDate}.</div>
                  <button onClick={() => setTab("entry")} className="mt-3 text-xs text-primary hover:underline">Log production →</button>
                </div>
              ) : (
                <>
                  {/* ── Crew Boss Cards ── */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Crew Reports</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {crewRows.map(crew => {
                        const speciesRows = [...crew.species.entries()].sort((a, b) => b[1].trees - a[1].trees);
                        return (
                          <div key={crew.crewBoss} className="bg-surface border border-border rounded-xl overflow-hidden">
                            {/* Card header */}
                            <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold text-text-primary">{crew.crewBoss}</div>
                                <div className="text-[10px] text-text-tertiary mt-0.5">
                                  {crew.planters.size} planter{crew.planters.size !== 1 ? "s" : ""}
                                  {crew.blocks.size > 0 && <> · {[...crew.blocks].join(", ")}</>}
                                  {crew.projects.size > 0 && <> · {[...crew.projects].join(", ")}</>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-base font-bold text-text-primary">{fmt(crew.totalTrees)}</div>
                                <div className="text-[10px] text-text-tertiary">trees today</div>
                              </div>
                            </div>

                            <div className="px-5 py-3 space-y-3">
                              {/* Species chips */}
                              {speciesRows.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {speciesRows.map(([species, s]) => (
                                    <span key={species} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-secondary border border-border text-[10px] font-medium text-text-secondary">
                                      <span className="font-mono font-bold text-text-primary">{s.code}</span>
                                      <span>{fmt(s.trees)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Fuel levels */}
                              {(crew.equipmentFuelLevel || crew.vehicleFuelLevel) && (
                                <div className="flex gap-3 text-[10px] text-text-tertiary">
                                  {crew.equipmentFuelLevel && (
                                    <span>Equipment fuel: <span className="font-semibold text-text-secondary">{crew.equipmentFuelLevel}</span></span>
                                  )}
                                  {crew.vehicleFuelLevel && (
                                    <span>Vehicle fuel: <span className="font-semibold text-text-secondary">{crew.vehicleFuelLevel}</span></span>
                                  )}
                                </div>
                              )}

                              {/* Needs / issues */}
                              {crew.needsNotes && (
                                <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                                  <div className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80 mb-0.5">Needs / Issues</div>
                                  <div className="text-xs text-text-secondary">{crew.needsNotes}</div>
                                </div>
                              )}

                              {/* Plan for tomorrow */}
                              <div className={`rounded-lg px-3 py-2 ${crew.planForTomorrow ? "bg-primary/5 border border-primary/20" : "bg-surface-secondary border border-border"}`}>
                                <div className="text-[9px] font-bold uppercase tracking-widest text-text-tertiary mb-0.5">Plan for Tomorrow</div>
                                <div className="text-xs text-text-secondary">
                                  {crew.planForTomorrow || <span className="italic opacity-50">No plan entered</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Block Status Table ── */}
                  {blockStatusRows.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">Block Status</div>
                      <div className="bg-surface border border-border rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-surface-secondary/50">
                                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">Block</th>
                                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">Crew Boss(es)</th>
                                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">Delivered</th>
                                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">Planted</th>
                                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">Remaining</th>
                                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-semibold text-text-tertiary w-36">Progress</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {blockStatusRows.map(row => (
                                <tr key={row.block} className="hover:bg-surface-secondary/30 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-text-primary">{row.block}</td>
                                  <td className="px-4 py-3 text-text-tertiary">
                                    {row.blockCrews.length > 0 ? row.blockCrews.join(", ") : <span className="italic opacity-40">—</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right text-text-secondary font-mono">{row.delivered > 0 ? fmt(row.delivered) : <span className="opacity-30">—</span>}</td>
                                  <td className="px-4 py-3 text-right font-mono font-semibold text-text-primary">{fmt(row.planted)}</td>
                                  <td className={`px-4 py-3 text-right font-mono font-semibold ${row.remaining < 0 ? "text-red-400" : row.remaining === 0 && row.delivered > 0 ? "text-green-400" : "text-text-primary"}`}>
                                    {row.delivered > 0 ? fmt(row.remaining) : <span className="text-text-tertiary opacity-40">—</span>}
                                  </td>
                                  <td className="px-4 py-3">
                                    {row.delivered > 0 ? (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${row.pct}%`,
                                              background: row.pct >= 100 ? "var(--color-success, #22c55e)" : row.pct >= 60 ? "var(--color-primary)" : "var(--color-warning, #f59e0b)"
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-text-tertiary w-8 text-right">{row.pct}%</span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-text-tertiary italic opacity-40">No delivery logged</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-border bg-surface-secondary/40">
                                <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary" colSpan={2}>Totals</td>
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-text-secondary text-xs">
                                  {fmt(blockStatusRows.reduce((s, r) => s + r.delivered, 0))}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-text-primary text-xs">
                                  {fmt(blockStatusRows.reduce((s, r) => s + r.planted, 0))}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-xs text-text-primary">
                                  {fmt(blockStatusRows.reduce((s, r) => s + (r.delivered > 0 ? r.remaining : 0), 0))}
                                </td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Tomorrow's Plan ── */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-3">
                  Tomorrow — {tomorrow}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Crew boss plans */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-secondary/40">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Crew Plans</div>
                    </div>
                    <div className="divide-y divide-border/40">
                      {crewRows.filter(c => c.planForTomorrow).length === 0 ? (
                        <div className="px-4 py-5 text-[11px] text-text-tertiary italic text-center opacity-50">No plans entered</div>
                      ) : (
                        crewRows.filter(c => c.planForTomorrow).map(crew => (
                          <div key={crew.crewBoss} className="px-4 py-3">
                            <div className="text-[10px] font-semibold text-text-secondary mb-0.5">{crew.crewBoss}</div>
                            <div className="text-xs text-text-primary">{crew.planForTomorrow}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Scheduled deliveries */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Deliveries Scheduled</div>
                      {tomorrowDeliveries.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{tomorrowDeliveries.length}</span>
                      )}
                    </div>
                    <div className="divide-y divide-border/40">
                      {tomorrowDeliveries.length === 0 ? (
                        <div className="px-4 py-5 text-[11px] text-text-tertiary italic text-center opacity-50">No deliveries planned</div>
                      ) : (
                        tomorrowDeliveries.map(plan => {
                          const totalTrees = plan.lines.reduce((s, l) => s + (l.boxes * l.treesPerBox), 0);
                          return (
                            <div key={plan.id} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="text-[10px] font-semibold text-text-secondary">{plan.blockName}</div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                  plan.status === "delivered" ? "bg-green-500/10 text-green-400" :
                                  plan.status === "dispatched" ? "bg-primary/10 text-primary" :
                                  "bg-surface-secondary text-text-tertiary border border-border"
                                }`}>{plan.status}</span>
                              </div>
                              <div className="text-[10px] text-text-tertiary">
                                {plan.driverName && <span>{plan.driverName}</span>}
                                {totalTrees > 0 && <span className="ml-2 font-mono text-text-secondary">{fmt(totalTrees)} trees</span>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Tree orders */}
                  <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Tree Orders</div>
                      {tomorrowOrders.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{tomorrowOrders.length}</span>
                      )}
                    </div>
                    <div className="divide-y divide-border/40">
                      {tomorrowOrders.length === 0 ? (
                        <div className="px-4 py-5 text-[11px] text-text-tertiary italic text-center opacity-50">No tree orders for tomorrow</div>
                      ) : (
                        tomorrowOrders.map(order => (
                          <div key={order.id} className="px-4 py-3">
                            <div className="text-[10px] font-semibold text-text-secondary mb-1">{order.block}{order.crewBoss ? ` · ${order.crewBoss}` : ""}</div>
                            <div className="flex flex-wrap gap-1">
                              {order.lines.map(l => (
                                <span key={l.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface-secondary border border-border text-[9px] font-medium text-text-secondary">
                                  <span className="font-mono font-bold text-text-primary">{l.code}</span>
                                  <span>{fmt(l.quantity)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* Upcoming block plans */}
                {upcomingPlans.length > 0 && (
                  <div className="mt-4 bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-surface-secondary/40">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Upcoming Block Assignments</div>
                    </div>
                    <div className="divide-y divide-border/40">
                      {upcomingPlans.map((plan, idx) => (
                        <div key={plan.id} className="px-4 py-3 flex items-center gap-4">
                          <span className="text-[10px] font-bold text-text-tertiary w-4 text-right opacity-40">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-text-primary">{plan.blockName}</div>
                            {plan.crewName && <div className="text-[10px] text-text-tertiary">{plan.crewName}</div>}
                          </div>
                          {plan.notes && <div className="text-[10px] text-text-tertiary italic truncate max-w-xs">{plan.notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })()}

        {/* ── Manual Changes Tab ── */}
        {tab === "manual-changes" && (
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-text-primary">Manual Changes</div>
                <div className="text-xs text-text-tertiary mt-0.5">Full history of manual tree count adjustments made on the Block Summary tab</div>
              </div>
              {blockAdjustments.length > 0 && (
                <span className="text-[10px] text-text-tertiary">{blockAdjustments.length} record{blockAdjustments.length !== 1 ? "s" : ""}</span>
              )}
            </div>

            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {blockAdjustments.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="text-xs text-text-tertiary">No manual adjustments recorded yet.</div>
                  <div className="text-xs text-text-tertiary mt-1">Use the Block Summary tab to adjust tree counts on a block.</div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary/40">
                      {["Date / Time","Project","Block","Species","Original","New","Change","Reason",""].map(h => (
                        <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary ${h === "" || h === "Change" || h === "Original" || h === "New" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {blockAdjustments.map(adj => {
                      const delta = adj.newTrees - adj.originalTrees;
                      return (
                        <tr key={adj.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-[11px] text-text-tertiary whitespace-nowrap">{new Date(adj.timestamp).toLocaleString("en-CA", { dateStyle: "short", timeStyle: "short" })}</td>
                          <td className="px-4 py-3 text-xs text-text-secondary">{adj.project}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-text-primary">{adj.block}</td>
                          <td className="px-4 py-3 text-xs text-text-secondary">
                            <span className="font-mono font-bold text-text-primary">{adj.speciesCode}</span>
                            <span className="text-text-tertiary ml-1">{adj.species}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-text-tertiary text-right">{fmt(adj.originalTrees)}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-text-primary text-right">{fmt(adj.newTrees)}</td>
                          <td className={`px-4 py-3 text-xs font-bold text-right ${delta > 0 ? "text-green-500" : "text-red-400"}`}>
                            {delta > 0 ? "+" : ""}{fmt(delta)}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-tertiary italic">{adj.reason || "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                await deleteBlockAdjustment(adj.id);
                                setBlockAdjustments(prev => prev.filter(a => a.id !== adj.id));
                              }}
                              className="text-[10px] text-text-tertiary hover:text-red-400 transition-colors"
                            >✕</button>
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

        {/* ── Payroll Tab ── */}
        {tab === "payroll" && (() => {
          return (
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-text-primary">Payroll Reports</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Totals reports generated when ADP CSV is exported from Earnings &amp; Deductions</div>
                </div>
                <button
                  onClick={() => { setPayrollDocsLoaded(false); }}
                  className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >↻ Refresh</button>
              </div>

              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                {!payrollDocsLoaded ? (
                  <div className="px-6 py-10 text-center text-xs text-text-tertiary">Loading…</div>
                ) : payrollDocs.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <div className="text-xs text-text-tertiary">No payroll reports yet.</div>
                    <div className="text-xs text-text-tertiary mt-1">Export an ADP CSV from the Earnings &amp; Deductions tab to generate one.</div>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-surface-secondary/40">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Report Name</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Generated</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollDocs.map(doc => (
                        <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-surface-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-text-primary font-medium">{doc.name}</td>
                          <td className="px-4 py-3 text-xs text-text-tertiary">{doc.date_added ? new Date(doc.date_added).toLocaleDateString("en-CA") : "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => window.open(`/api/admin/view-document?path=${encodeURIComponent(doc.storage_path)}`, "_blank")}
                              className="text-[11px] text-primary hover:underline"
                            >View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })()}

      </div>

      {/* ── Save As Modal ──────────────────────────────────────────────────── */}
      {showSaveAsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Save Session As</div>
              <button onClick={() => setShowSaveAsModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6">
              <label className={labelCls}>Session Name *</label>
              <input
                autoFocus
                value={saveAsName}
                onChange={e => setSaveAsName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveAs()}
                placeholder="e.g. Block 3A – Crew Watson"
                className={inputCls}
              />
              <div className="text-[11px] text-text-tertiary mt-2">
                Saves the current form state — session details and all planter rows — so you can reload it later.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowSaveAsModal(false)} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleSaveAs} disabled={!saveAsName.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Open Session Modal ─────────────────────────────────────────────── */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Open Saved Session</div>
              <button onClick={() => setShowOpenModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {savedSessions.length === 0 ? (
                <div className="px-6 py-10 text-center text-xs text-text-tertiary">No saved sessions yet</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {savedSessions.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-6 py-3 hover:bg-surface-secondary/40 group">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-text-primary truncate">{s.name}</div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          {s.session.date}{s.session.crewBoss ? ` · ${s.session.crewBoss}` : ""}{s.session.project ? ` · ${s.session.project}` : ""}
                          {s.planters.length > 0 && ` · ${s.planters.length} planter${s.planters.length !== 1 ? "s" : ""}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenSession(s)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all shrink-0" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleDeleteSavedSession(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 text-sm font-bold transition-all shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-border">
              <button onClick={() => setShowOpenModal(false)} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rate Modal ─────────────────────────────────────────────────────── */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">{editingRateId ? "Edit Rate" : "Add Species Rate"}</div>
              <button onClick={() => setShowRateModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Species Name *</label>
                <input value={rateForm.species} onChange={e => setRateForm(f => ({ ...f, species: e.target.value }))} placeholder="Black Spruce" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Code</label>
                  <input value={rateForm.code} onChange={e => setRateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SB" maxLength={4} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Rate Bucket</label>
                  <input value={rateForm.rateBucket} onChange={e => setRateForm(f => ({ ...f, rateBucket: e.target.value }))} placeholder="standard, premium…" className={inputCls} />
                </div>
              </div>

              {/* Pricing type toggle */}
              <div>
                <label className={labelCls}>Pricing Type</label>
                <div className="flex gap-2">
                  {(["flat", "tiered"] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setRateForm(f => ({ ...f, rateType: t }))}
                      className="flex-1 py-2 text-xs font-medium rounded-lg border transition-all"
                      style={rateForm.rateType === t
                        ? { background: "var(--color-primary)", color: "var(--color-primary-deep)", borderColor: "var(--color-primary)" }
                        : {}}>
                      {t === "flat" ? "Flat Rate" : "Tiered Rate"}
                    </button>
                  ))}
                </div>
              </div>

              {rateForm.rateType === "flat" ? (
                <div>
                  <label className={labelCls}>Rate Per Tree ($) *</label>
                  <input type="number" step="0.001" min="0"
                    value={rateForm.ratePerTree || ""}
                    onChange={e => setRateForm(f => ({ ...f, ratePerTree: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.180"
                    className={inputCls} />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Tree Threshold *</label>
                    <input type="number" min="1"
                      value={rateForm.tierThreshold ?? ""}
                      onChange={e => setRateForm(f => ({ ...f, tierThreshold: parseInt(e.target.value) || undefined }))}
                      placeholder="e.g. 1500"
                      className={inputCls} />
                    <div className="text-[10px] text-text-tertiary mt-1">Trees planted below this threshold use the lower rate</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Rate Below Threshold ($) *</label>
                      <input type="number" step="0.001" min="0"
                        value={rateForm.rateBelowThreshold ?? ""}
                        onChange={e => setRateForm(f => ({ ...f, rateBelowThreshold: parseFloat(e.target.value) || undefined }))}
                        placeholder="0.140"
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Rate At/Above Threshold ($) *</label>
                      <input type="number" step="0.001" min="0"
                        value={rateForm.rateAboveThreshold ?? ""}
                        onChange={e => setRateForm(f => ({ ...f, rateAboveThreshold: parseFloat(e.target.value) || undefined }))}
                        placeholder="0.180"
                        className={inputCls} />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className={labelCls}>Trees per Box (optional)</label>
                <input type="number" min="1" step="1"
                  value={rateForm.treesPerBox ?? ""}
                  onChange={e => setRateForm(f => ({ ...f, treesPerBox: parseInt(e.target.value) || undefined }))}
                  placeholder="e.g. 250"
                  className={inputCls} />
                <div className="text-[10px] text-text-tertiary mt-1">Enables box-based entry — trees = boxes × this number</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowRateModal(false)} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={saveRate} disabled={
                !rateForm.species.trim() ||
                (rateForm.rateType === "flat" && rateForm.ratePerTree <= 0) ||
                (rateForm.rateType === "tiered" && (!rateForm.tierThreshold || !rateForm.rateBelowThreshold || !rateForm.rateAboveThreshold))
              }
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {editingRateId ? "Save Changes" : "Add Rate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Planter Report Modal ── */}
      {reportPlanterKey && (() => {
        const planterEntries = filtered.filter(e => (e.employeeId || e.employeeName) === reportPlanterKey);
        if (planterEntries.length === 0) { setReportPlanterKey(null); return null; }

        const planterName  = planterEntries[0].employeeName;
        const crewBoss     = planterEntries[0].crewBoss;
        const sortedDates  = [...new Set(planterEntries.map(e => e.date))].sort();
        const rangeStart   = sortedDates[0];
        const rangeEnd     = sortedDates[sortedDates.length - 1];
        const totalTrees   = planterEntries.reduce((s, e) => s + e.totalTrees, 0);
        const totalEarnings = planterEntries.reduce((s, e) => s + e.totalEarnings, 0);
        const totalWithVac = planterEntries.reduce((s, e) => s + e.totalWithVac, 0);
        const daysWorked   = new Set(planterEntries.map(e => e.date)).size;
        const avgPerDay    = daysWorked > 0 ? Math.round(totalTrees / daysWorked) : 0;

        // Species breakdown
        const speciesBySp = new Map<string, { code: string; species: string; trees: number; earnings: number }>();
        for (const e of planterEntries) {
          for (const l of e.production) {
            const s = speciesBySp.get(l.species) ?? { code: l.code, species: l.species, trees: 0, earnings: 0 };
            s.trees += l.trees; s.earnings += l.earnings;
            speciesBySp.set(l.species, s);
          }
        }
        const speciesRows = [...speciesBySp.values()].sort((a, b) => b.trees - a.trees);

        // Block breakdown
        const blocksByBlk = new Map<string, { block: string; trees: number; earnings: number; days: Set<string> }>();
        for (const e of planterEntries) {
          const key = e.block || "(No Block)";
          const b = blocksByBlk.get(key) ?? { block: key, trees: 0, earnings: 0, days: new Set() };
          b.trees += e.totalTrees; b.earnings += e.totalEarnings; b.days.add(e.date);
          blocksByBlk.set(key, b);
        }
        const blockRows = [...blocksByBlk.values()].sort((a, b) => b.trees - a.trees);

        // Daily log
        const dailyLog = [...planterEntries].sort((a, b) => a.date.localeCompare(b.date));

        // Rate per species (best estimate: earnings / trees)
        function impliedRate(trees: number, earnings: number) {
          return trees > 0 ? (earnings / trees).toFixed(4) : "—";
        }

        function printPlanterReport() {
          const w = window.open("", "_blank");
          if (!w) return;

          const dailyTableRows = dailyLog.map(e => {
            const sp = e.production.map(l => `${l.code}&nbsp;${fmt(l.trees)}`).join(" &nbsp;·&nbsp; ");
            return `
            <tr>
              <td style="padding:6px 10px;color:#374151;white-space:nowrap">${e.date}</td>
              <td style="padding:6px 10px;color:#374151">${e.block || "—"}</td>
              <td style="padding:6px 10px;color:#374151;font-size:10px">${sp}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600">${fmt(e.totalTrees)}</td>
              <td style="padding:6px 10px;text-align:right;color:#6b7280">${e.hoursWorked}h</td>
              <td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(e.totalEarnings)}</td>
            </tr>`;
          }).join("");

          const thStyle = `padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#9ca3af;border-bottom:1px solid #e5e7eb;background:#f9fafb`;
          const thR     = thStyle + ";text-align:right";
          const tableStyle = `width:100%;border-collapse:collapse;font-size:12px;margin-bottom:28px`;

          const dateLabel = rangeStart === rangeEnd ? rangeStart : `${rangeStart} – ${rangeEnd}`;

          w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Production Report – ${planterName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; background: #fff; padding: 40px 48px; max-width: 860px; margin: 0 auto; }
  @media print {
    body { padding: 0; max-width: 100%; }
    @page { margin: 16mm 14mm; }
  }
  .section-label { font-size: 9px; text-transform: uppercase; letter-spacing: .15em; font-weight: 700; color: #9ca3af; margin-bottom: 10px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 28px; }
  .kpi { border-radius: 10px; padding: 14px 16px; border: 1px solid #e5e7eb; }
  .kpi.accent { background: #111827; border-color: #111827; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; color: #9ca3af; margin-bottom: 4px; }
  .kpi.accent .kpi-label { color: #6b7280; }
  .kpi-value { font-size: 20px; font-weight: 900; color: #111827; }
  .kpi.accent .kpi-value { color: #fff; }
  table { ${tableStyle} }
  tr:hover { background: #f9fafb; }
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
</style>
</head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #111827;margin-bottom:28px">
  <div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;color:#9ca3af;margin-bottom:6px">Production Report</div>
    <div style="font-size:28px;font-weight:900;letter-spacing:-.5px;color:#111827">${planterName}</div>
    <div style="margin-top:8px;font-size:12px;color:#6b7280">
      Crew Boss: <strong style="color:#374151">${crewBoss}</strong>
      &nbsp;&nbsp;·&nbsp;&nbsp;
      Period: <strong style="color:#374151">${dateLabel}</strong>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;font-weight:700;color:#9ca3af">Integrity Reforestation</div>
    <div style="font-size:10px;color:#9ca3af;margin-top:3px">Generated ${new Date().toLocaleDateString("en-CA")}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi accent"><div class="kpi-label">Total Trees</div><div class="kpi-value">${fmt(totalTrees)}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Earnings w/ Vac Pay</div><div class="kpi-value">${fmtC(totalWithVac)}</div></div>
  <div class="kpi"><div class="kpi-label">Days Worked</div><div class="kpi-value">${daysWorked}</div></div>
  <div class="kpi"><div class="kpi-label">Avg Trees / Day</div><div class="kpi-value">${fmt(avgPerDay)}</div></div>
  <div class="kpi"><div class="kpi-label">Avg $ / Tree</div><div class="kpi-value">${totalTrees > 0 ? "$" + (totalEarnings / totalTrees).toFixed(4) : "—"}</div></div>
</div>

<div class="section-label">Daily Production Log</div>
<table>
  <thead><tr>
    <th style="${thStyle}">Date</th><th style="${thStyle}">Block</th><th style="${thStyle}">Species</th>
    <th style="${thR}">Trees</th><th style="${thR}">Hours</th><th style="${thR}">Earnings</th>
  </tr></thead>
  <tbody>${dailyTableRows}</tbody>
  <tfoot><tr style="background:#f9fafb;border-top:2px solid #d1d5db">
    <td colspan="3" style="padding:6px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#6b7280">${daysWorked} day${daysWorked !== 1 ? "s" : ""}</td>
    <td style="padding:6px 10px;text-align:right;font-weight:700">${fmt(totalTrees)}</td>
    <td style="padding:6px 10px;text-align:right;color:#6b7280">—</td>
    <td style="padding:6px 10px;text-align:right;font-weight:700">${fmtC(totalEarnings)}</td>
  </tr></tfoot>
</table>

<div class="footer">
  <span>Integrity Reforestation · Planter Production Report</span>
  <span>${planterName} · ${dateLabel}</span>
</div>

</body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => w.print(), 500);
        }

        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">

            {/* Paper */}
            <div className="w-full max-w-3xl bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden mx-4">

              {/* Control bar */}
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="text-xs text-gray-500 font-medium">Planter Production Report</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={printPlanterReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-10 0h8m-8 4h8v-4H6v4z"/></svg>
                    Print / Save PDF
                  </button>
                  <button
                    onClick={() => setReportPlanterKey(null)}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 font-bold text-lg leading-none transition-colors"
                  >×</button>
                </div>
              </div>

              {/* Report body */}
              <div className="p-8 print:p-0 space-y-7">

                {/* ── Header ── */}
                <div className="flex items-start justify-between pb-6 border-b-2 border-gray-900">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 mb-1.5">Production Report</div>
                    <div className="text-3xl font-black text-gray-900 tracking-tight">{planterName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>Crew Boss: <span className="font-semibold text-gray-700">{crewBoss}</span></span>
                      {rangeStart === rangeEnd
                        ? <span>Date: <span className="font-semibold text-gray-700">{rangeStart}</span></span>
                        : <span>Period: <span className="font-semibold text-gray-700">{rangeStart}</span> – <span className="font-semibold text-gray-700">{rangeEnd}</span></span>
                      }
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Integrity Reforestation</div>
                    <div className="text-xs text-gray-500 mt-0.5">Generated {new Date().toLocaleDateString("en-CA")}</div>
                  </div>
                </div>

                {/* ── KPIs ── */}
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Total Trees", value: fmt(totalTrees), accent: true },
                    { label: "Gross Earnings w/ Vac Pay", value: fmtC(totalWithVac), accent: false },
                    { label: "Days Worked", value: String(daysWorked), accent: false },
                    { label: "Avg Trees / Day", value: fmt(avgPerDay), accent: false },
                    { label: "Avg $/Tree", value: totalTrees > 0 ? `$${(totalEarnings / totalTrees).toFixed(4)}` : "—", accent: false },
                  ].map(k => (
                    <div key={k.label} className={`rounded-xl p-4 border ${k.accent ? "bg-gray-900 border-gray-900 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}>
                      <div className={`text-[9px] uppercase tracking-[0.15em] font-bold mb-1 ${k.accent ? "text-gray-400" : "text-gray-400"}`}>{k.label}</div>
                      <div className={`text-xl font-black ${k.accent ? "text-white" : "text-gray-900"}`}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* ── Daily Production Log ── */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-gray-400 mb-2">Daily Log</div>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {["Date", "Block", "Species · Trees", "Total", "Hrs", "Earnings"].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dailyLog.map(e => (
                          <tr key={e.id} className="hover:bg-gray-50/60">
                            <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap tabular-nums">{e.date}</td>
                            <td className="px-3 py-2.5 text-gray-600">{e.block || <span className="text-gray-400">—</span>}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {e.production.map(l => (
                                  <span key={l.speciesId} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gray-100 rounded-full font-medium text-gray-700 whitespace-nowrap border border-gray-200">
                                    <span className="font-mono font-bold">{l.code}</span>
                                    <span className="text-gray-400">·</span>
                                    {fmt(l.trees)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-gray-900 tabular-nums">{fmt(e.totalTrees)}</td>
                            <td className="px-3 py-2.5 text-gray-500 tabular-nums">{e.hoursWorked}h</td>
                            <td className="px-3 py-2.5 font-semibold text-gray-800 tabular-nums">{fmtC(e.totalEarnings)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-bold border-t-2 border-gray-300 text-xs">
                          <td colSpan={3} className="px-3 py-2 text-[9px] uppercase tracking-widest text-gray-500">{daysWorked} day{daysWorked !== 1 ? "s" : ""}</td>
                          <td className="px-3 py-2 text-gray-900 tabular-nums">{fmt(totalTrees)}</td>
                          <td className="px-3 py-2 text-gray-500">—</td>
                          <td className="px-3 py-2 text-gray-900 tabular-nums">{fmtC(totalEarnings)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Footer ── */}
                <div className="pt-4 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Integrity Reforestation · Planter Production Report</span>
                  <span>{planterName} · {rangeStart}{rangeStart !== rangeEnd ? ` – ${rangeEnd}` : ""}</span>
                </div>

              </div>
            </div>
          </div>
        );
      })()}


      {/* ── Payroll Report Modal ── */}
      {payrollReport && (() => {
        const r = payrollReport;
        const thS = `padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#9ca3af;border-bottom:1px solid #e5e7eb;background:#f9fafb`;
        const thR = thS + ";text-align:right";

        function printPayrollReport() {
          const w = window.open("", "_blank");
          if (!w) return;

          const earningsSection = r.type === "planter"
            ? `<div class="section-label">Species Earnings Breakdown</div>
               <table>
                 <thead><tr>
                   <th style="${thS}">Code</th><th style="${thS}">Species</th>
                   <th style="${thR}">Trees</th><th style="${thR}">Rate/Tree</th><th style="${thR}">Earnings</th>
                 </tr></thead>
                 <tbody>${r.speciesRows.map(s => `<tr>
                   <td style="padding:6px 10px;font-family:monospace;font-weight:700;color:#374151">${s.code}</td>
                   <td style="padding:6px 10px">${s.species}</td>
                   <td style="padding:6px 10px;text-align:right;font-weight:600">${fmt(s.trees)}</td>
                   <td style="padding:6px 10px;text-align:right;color:#6b7280">$${s.ratePerTree.toFixed(4)}</td>
                   <td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(s.earnings)}</td>
                 </tr>`).join("")}</tbody>
                 <tfoot><tr style="background:#f9fafb;border-top:2px solid #d1d5db">
                   <td colspan="2" style="padding:6px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#6b7280">Total</td>
                   <td style="padding:6px 10px;text-align:right;font-weight:700">${fmt(r.totalTrees)}</td>
                   <td></td>
                   <td style="padding:6px 10px;text-align:right;font-weight:700">${fmtC(r.earnings)}</td>
                 </tr></tfoot>
               </table>`
            : r.type === "crew"
            ? `<div class="section-label">Crew Boss Earnings</div>
               <table><tbody>
                 <tr><td style="padding:6px 10px">Crew trees planted</td><td style="padding:6px 10px;text-align:right;font-weight:600">${fmt(r.crewTrees ?? 0)}</td></tr>
                 <tr><td style="padding:6px 10px">Planters supervised</td><td style="padding:6px 10px;text-align:right;font-weight:600">${r.planterCount ?? 0}</td></tr>
                 <tr><td style="padding:6px 10px">Rate per tree</td><td style="padding:6px 10px;text-align:right;font-weight:600">$0.0200</td></tr>
                 <tr style="border-top:2px solid #d1d5db;font-weight:700"><td style="padding:6px 10px">Earnings</td><td style="padding:6px 10px;text-align:right">${fmtC(r.earnings)}</td></tr>
               </tbody></table>`
            : `<div class="section-label">Earnings</div>
               <table><tbody>
                 <tr><td style="padding:6px 10px">Type</td><td style="padding:6px 10px;text-align:right;font-weight:600">${r.rateType === "hourly" ? "Hourly" : "Day Rate"}</td></tr>
                 <tr><td style="padding:6px 10px">Rate</td><td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(r.rate ?? 0)} ${r.rateType === "hourly" ? "/ hr" : "/ day"}</td></tr>
                 <tr><td style="padding:6px 10px">${r.rateType === "hourly" ? "Hours" : "Days"}</td><td style="padding:6px 10px;text-align:right;font-weight:600">${r.quantity ?? 0}</td></tr>
                 <tr style="border-top:2px solid #d1d5db;font-weight:700"><td style="padding:6px 10px">Earnings</td><td style="padding:6px 10px;text-align:right">${fmtC(r.earnings)}</td></tr>
               </tbody></table>`;

          const dailySection = r.type === "planter" && r.dailyLog.length > 0
            ? `<div class="section-label">Daily Production Log</div>
               <table>
                 <thead><tr>
                   <th style="${thS}">Date</th><th style="${thS}">Block</th><th style="${thS}">Project</th>
                   <th style="${thR}">Trees</th><th style="${thR}">Hours</th><th style="${thR}">Earnings</th>
                 </tr></thead>
                 <tbody>${r.dailyLog.map(d => `<tr>
                   <td style="padding:6px 10px;white-space:nowrap">${d.date}</td>
                   <td style="padding:6px 10px">${d.block || "—"}</td>
                   <td style="padding:6px 10px">${d.project || "—"}</td>
                   <td style="padding:6px 10px;text-align:right;font-weight:600">${fmt(d.trees)}</td>
                   <td style="padding:6px 10px;text-align:right;color:#6b7280">${d.hours}h</td>
                   <td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(d.earnings)}</td>
                 </tr>`).join("")}</tbody>
                 <tfoot><tr style="background:#f9fafb;border-top:2px solid #d1d5db;font-weight:700">
                   <td colspan="3" style="padding:6px 10px;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280">${r.days} day${r.days !== 1 ? "s" : ""}</td>
                   <td style="padding:6px 10px;text-align:right">${fmt(r.totalTrees)}</td>
                   <td style="padding:6px 10px;text-align:right;color:#6b7280">—</td>
                   <td style="padding:6px 10px;text-align:right">${fmtC(r.earnings)}</td>
                 </tr></tfoot>
               </table>`
            : "";

          w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Payroll Report – ${r.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; background: #fff; padding: 40px 48px; max-width: 860px; margin: 0 auto; }
  @media print { body { padding: 0; max-width: 100%; } @page { margin: 16mm 14mm; } }
  .section-label { font-size: 9px; text-transform: uppercase; letter-spacing: .15em; font-weight: 700; color: #9ca3af; margin: 22px 0 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
  .kpi { border-radius: 10px; padding: 14px 16px; border: 1px solid #e5e7eb; }
  .kpi.accent { background: #111827; border-color: #111827; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; color: #9ca3af; margin-bottom: 4px; }
  .kpi.accent .kpi-label { color: #6b7280; }
  .kpi-value { font-size: 18px; font-weight: 900; color: #111827; }
  .kpi.accent .kpi-value { color: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
  tr:nth-child(even) { background: #f9fafb; }
  .waterfall-row td:first-child { padding-left: 28px; color: #6b7280; font-size: 11px; }
  .waterfall-total td { font-weight: 700; border-top: 2px solid #d1d5db; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
  .sig-line { border-bottom: 1px solid #374151; height: 32px; margin-bottom: 6px; }
  .sig-label { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; font-weight: 600; color: #9ca3af; }
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .badge-ok { background: #d1fae5; color: #065f46; }
  .badge-ot { background: #fef3c7; color: #92400e; }
</style>
</head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #111827;margin-bottom:24px">
  <div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.2em;font-weight:700;color:#9ca3af;margin-bottom:6px">Payroll Statement</div>
    <div style="font-size:28px;font-weight:900;letter-spacing:-.5px;color:#111827">${r.name}</div>
    <div style="margin-top:6px;font-size:12px;color:#6b7280">
      ${r.role}&nbsp;&nbsp;·&nbsp;&nbsp;Emp. #: <strong style="color:#374151">${r.employeeNumber}</strong>
      ${r.crewBoss !== "—" ? `&nbsp;&nbsp;·&nbsp;&nbsp;Crew Boss: <strong style="color:#374151">${r.crewBoss}</strong>` : ""}
    </div>
    <div style="margin-top:4px;font-size:12px;color:#6b7280">Period: <strong style="color:#374151">${r.period}</strong></div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;font-weight:700;color:#9ca3af">Integrity Reforestation</div>
    <div style="font-size:10px;color:#9ca3af;margin-top:3px">Generated ${new Date().toLocaleDateString("en-CA")}</div>
    <div style="margin-top:8px;font-size:28px;font-weight:900;color:#111827">${fmtC(r.net)}</div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:#9ca3af">Net Pay</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi accent"><div class="kpi-label">Net Pay</div><div class="kpi-value">${fmtC(r.net)}</div></div>
  <div class="kpi"><div class="kpi-label">Gross</div><div class="kpi-value">${fmtC(r.gross)}</div></div>
  ${r.type === "planter" ? `<div class="kpi"><div class="kpi-label">Trees</div><div class="kpi-value">${fmt(r.totalTrees)}</div></div>` : `<div class="kpi"><div class="kpi-label">Earnings</div><div class="kpi-value">${fmtC(r.earnings)}</div></div>`}
  <div class="kpi"><div class="kpi-label">Hours</div><div class="kpi-value">${r.hours > 0 ? r.hours + "h" : "—"}</div></div>
</div>

${earningsSection}

<div class="section-label">Deduction Waterfall</div>
<table>
  <tbody>
    <tr><td style="padding:6px 10px;font-weight:600">Piece-Rate / Base Earnings</td><td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(r.earnings)}</td></tr>
    ${r.type === "planter" ? `<tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">Vacation Pay (4%)</td><td style="padding:6px 10px;text-align:right;color:#6b7280">+${fmtC(r.vacPay)}</td></tr>
    <tr><td style="padding:6px 10px;font-weight:600">Total w/ Vac Pay</td><td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(r.totalWithVac)}</td></tr>` : ""}
    ${r.campCosts > 0 ? `<tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">Camp Costs</td><td style="padding:6px 10px;text-align:right;color:#dc2626">−${fmtC(r.campCosts)}</td></tr>` : ""}
    ${r.equipDeduction > 0 ? `<tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">Equipment Deduction</td><td style="padding:6px 10px;text-align:right;color:#dc2626">−${fmtC(r.equipDeduction)}</td></tr>` : ""}
    ${r.other > 0 ? `<tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">Other</td><td style="padding:6px 10px;text-align:right;color:#dc2626">−${fmtC(r.other)}</td></tr>` : ""}
    <tr style="font-weight:700;border-top:2px solid #d1d5db"><td style="padding:8px 10px">Gross Taxable</td><td style="padding:8px 10px;text-align:right">${fmtC(r.gross)}</td></tr>
    ${r.otPay != null && r.otPay > 0 ? `<tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">Overtime Pay (${r.otHours}h × 1.5×)</td><td style="padding:6px 10px;text-align:right;color:#d97706">+${fmtC(r.otPay)}</td></tr>` : ""}
    ${r.topUp > 0 ? `<tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">Min. Wage Top-Up</td><td style="padding:6px 10px;text-align:right;color:#dc2626">+${fmtC(r.topUp)}</td></tr>` : ""}
    <tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">CPP (5.95%)</td><td style="padding:6px 10px;text-align:right;color:#dc2626">−${fmtC(r.cpp)}</td></tr>
    <tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">EI (1.66%)</td><td style="padding:6px 10px;text-align:right;color:#dc2626">−${fmtC(r.ei)}</td></tr>
    ${r.incomeTax > 0 ? `<tr class="waterfall-row"><td style="padding:6px 10px 6px 28px;color:#6b7280">Income Tax</td><td style="padding:6px 10px;text-align:right;color:#dc2626">−${fmtC(r.incomeTax)}</td></tr>` : ""}
    <tr style="font-weight:900;font-size:14px;border-top:2px solid #111827;background:#f9fafb"><td style="padding:10px">Net Pay</td><td style="padding:10px;text-align:right">${fmtC(r.net)}</td></tr>
  </tbody>
</table>

<div class="section-label">Compliance & Hours</div>
<table><tbody>
  <tr><td style="padding:6px 10px">Hours This Period</td><td style="padding:6px 10px;text-align:right;font-weight:600">${r.hours > 0 ? r.hours + "h" : "—"}</td></tr>
  <tr><td style="padding:6px 10px">Hourly Earned (Earnings ÷ Hours)</td><td style="padding:6px 10px;text-align:right;font-weight:600;color:${r.hourlyEarned != null && r.hourlyEarned < 17.20 ? "#dc2626" : "#059669"}">${r.hourlyEarned != null ? "$" + r.hourlyEarned.toFixed(2) + "/h" : "—"} ${r.hourlyEarned != null ? `<span class="badge ${r.hourlyEarned < 17.20 ? "badge-warn" : "badge-ok"}">${r.hourlyEarned < 17.20 ? "Below Min Wage" : "Above Min Wage"}</span>` : ""}</td></tr>
  ${r.topUp > 0 ? `<tr><td style="padding:6px 10px">Min. Wage Top-Up (ON $17.20/h floor)</td><td style="padding:6px 10px;text-align:right;font-weight:600;color:#dc2626">${fmtC(r.topUp)}</td></tr>` : ""}
  <tr><td style="padding:6px 10px">Total Hours (YTD)</td><td style="padding:6px 10px;text-align:right;font-weight:600">${r.ytd > 0 ? r.ytd + "h" : "—"}</td></tr>
  ${r.otHours > 0 ? `<tr><td style="padding:6px 10px">Overtime Hours (&gt;178h / 4-wk)</td><td style="padding:6px 10px;text-align:right;font-weight:600;color:#d97706">${r.otHours}h <span class="badge badge-ot">OT</span></td></tr>` : ""}
  ${r.otPay != null ? `<tr><td style="padding:6px 10px">Overtime Pay (1.5× prev. avg $${r.prevAvgHourly?.toFixed(2) ?? "—"}/h)</td><td style="padding:6px 10px;text-align:right;font-weight:600;color:#d97706">${fmtC(r.otPay)}</td></tr>` : ""}
</tbody></table>

<div class="section-label">Income Allocation</div>
<table><tbody>
  <tr><td style="padding:6px 10px">25% Special Worksite Allowance</td><td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(r.special)}</td></tr>
  <tr><td style="padding:6px 10px">75% Regular Employment Income</td><td style="padding:6px 10px;text-align:right;font-weight:600">${fmtC(r.regular)}</td></tr>
  <tr style="font-weight:700;border-top:2px solid #d1d5db"><td style="padding:6px 10px">Net Pay</td><td style="padding:6px 10px;text-align:right">${fmtC(r.net)}</td></tr>
</tbody></table>

${dailySection}

<div class="sig-grid">
  <div>
    <div class="sig-line"></div>
    <div class="sig-label">Employee Signature &amp; Date</div>
  </div>
  <div>
    <div class="sig-line"></div>
    <div class="sig-label">Authorized Signatory &amp; Date</div>
  </div>
</div>

<div class="footer">
  <span>Integrity Reforestation · Payroll Statement</span>
  <span>${r.name} · ${r.period}</span>
</div>
</body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => w.print(), 500);
        }

        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
            <div className="w-full max-w-2xl bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden mx-4">

              {/* Control bar */}
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="text-xs text-gray-500 font-medium">Payroll Statement</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={printPayrollReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-10 0h8m-8 4h8v-4H6v4z"/></svg>
                    Print / Save PDF
                  </button>
                  <button
                    onClick={() => setPayrollReport(null)}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 font-bold text-lg leading-none transition-colors">×</button>
                </div>
              </div>

              {/* Paper body */}
              <div className="p-8 space-y-6">

                {/* Header */}
                <div className="flex items-start justify-between pb-6 border-b-2 border-gray-900">
                  <div>
                    <div className="text-[9px] uppercase tracking-[.2em] font-bold text-gray-400 mb-1.5">Payroll Statement</div>
                    <div className="text-2xl font-black text-gray-900 tracking-tight">{r.name}</div>
                    <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                      <div>{r.role} · Emp. # <span className="font-semibold text-gray-700">{r.employeeNumber}</span>{r.crewBoss !== "—" && <span> · Crew: <span className="font-semibold text-gray-700">{r.crewBoss}</span></span>}</div>
                      <div>Period: <span className="font-semibold text-gray-700">{r.period}</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[.15em] font-bold text-gray-400">Integrity Reforestation</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{new Date().toLocaleDateString("en-CA")}</div>
                    <div className="text-3xl font-black text-gray-900 mt-2">{fmtC(r.net)}</div>
                    <div className="text-[9px] uppercase tracking-[.1em] font-bold text-gray-400">Net Pay</div>
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Net Pay", value: fmtC(r.net), accent: true },
                    { label: "Gross", value: fmtC(r.gross) },
                    { label: r.type === "planter" ? "Trees" : "Earnings", value: r.type === "planter" ? fmt(r.totalTrees) : fmtC(r.earnings) },
                    { label: "Hours", value: r.hours > 0 ? `${r.hours}h` : "—" },
                  ].map(k => (
                    <div key={k.label} className={`rounded-xl border px-4 py-3 ${k.accent ? "bg-gray-900 border-gray-900" : "border-gray-200"}`}>
                      <div className={`text-[9px] uppercase tracking-[.12em] font-bold mb-1 ${k.accent ? "text-gray-500" : "text-gray-400"}`}>{k.label}</div>
                      <div className={`text-lg font-black ${k.accent ? "text-white" : "text-gray-900"}`}>{k.value}</div>
                    </div>
                  ))}
                </div>

                {/* Deduction waterfall */}
                <div>
                  <div className="text-[9px] uppercase tracking-[.15em] font-bold text-gray-400 mb-2">Pay Calculation</div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-100">
                        <tr><td className="px-4 py-2 text-gray-700 font-medium">{r.type === "planter" ? "Piece-Rate Earnings" : r.type === "crew" ? `Crew Boss Earnings (${fmt(r.crewTrees ?? 0)} trees × $0.02)` : `${r.rateType === "hourly" ? "Hourly" : "Day Rate"} Earnings`}</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtC(r.earnings)}</td></tr>
                        {r.type === "planter" && r.vacPay > 0 && <tr className="bg-gray-50"><td className="px-4 py-2 text-gray-500 pl-8 text-[11px]">+ Vacation Pay (4%)</td><td className="px-4 py-2 text-right text-gray-500 tabular-nums">+{fmtC(r.vacPay)}</td></tr>}
                        {r.type === "planter" && <tr><td className="px-4 py-2 text-gray-700 font-medium">Total w/ Vac Pay</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtC(r.totalWithVac)}</td></tr>}
                        {r.campCosts > 0 && <tr className="bg-gray-50"><td className="px-4 py-2 text-gray-500 pl-8 text-[11px]">− Camp Costs</td><td className="px-4 py-2 text-right text-red-500 tabular-nums">−{fmtC(r.campCosts)}</td></tr>}
                        {r.equipDeduction > 0 && <tr className="bg-gray-50"><td className="px-4 py-2 text-gray-500 pl-8 text-[11px]">− Equipment Deduction</td><td className="px-4 py-2 text-right text-red-500 tabular-nums">−{fmtC(r.equipDeduction)}</td></tr>}
                        {r.other > 0 && <tr className="bg-gray-50"><td className="px-4 py-2 text-gray-500 pl-8 text-[11px]">− Other</td><td className="px-4 py-2 text-right text-red-500 tabular-nums">−{fmtC(r.other)}</td></tr>}
                        <tr className="border-t-2 border-gray-300 bg-gray-50"><td className="px-4 py-2.5 font-bold text-gray-900">Gross Taxable</td><td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtC(r.gross)}</td></tr>
                        {r.otPay != null && r.otPay > 0 && <tr className="bg-amber-50"><td className="px-4 py-2 text-amber-700 pl-8 text-[11px]">+ Overtime Pay ({r.otHours}h × 1.5 × ${r.prevAvgHourly?.toFixed(2) ?? "—"}/h)</td><td className="px-4 py-2 text-right font-semibold text-amber-700 tabular-nums">+{fmtC(r.otPay)}</td></tr>}
                        {r.topUp > 0 && <tr className="bg-red-50"><td className="px-4 py-2 text-red-600 pl-8 text-[11px]">+ Min. Wage Top-Up (ON $17.20/h floor)</td><td className="px-4 py-2 text-right font-semibold text-red-600 tabular-nums">+{fmtC(r.topUp)}</td></tr>}
                        <tr className="bg-gray-50"><td className="px-4 py-2 text-gray-500 pl-8 text-[11px]">− CPP (5.95%)</td><td className="px-4 py-2 text-right text-red-500 tabular-nums">−{fmtC(r.cpp)}</td></tr>
                        <tr className="bg-gray-50"><td className="px-4 py-2 text-gray-500 pl-8 text-[11px]">− EI (1.66%)</td><td className="px-4 py-2 text-right text-red-500 tabular-nums">−{fmtC(r.ei)}</td></tr>
                        {r.incomeTax > 0 && <tr className="bg-gray-50"><td className="px-4 py-2 text-gray-500 pl-8 text-[11px]">− Income Tax</td><td className="px-4 py-2 text-right text-red-500 tabular-nums">−{fmtC(r.incomeTax)}</td></tr>}
                        <tr className="border-t-2 border-gray-900"><td className="px-4 py-3 font-black text-gray-900 text-sm">Net Pay</td><td className="px-4 py-3 text-right font-black text-gray-900 text-sm tabular-nums">{fmtC(r.net)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Compliance */}
                <div>
                  <div className="text-[9px] uppercase tracking-[.15em] font-bold text-gray-400 mb-2">Compliance & Hours</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-gray-200 rounded-xl px-4 py-3 text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-500">Hours this period</span><span className="font-semibold">{r.hours > 0 ? `${r.hours}h` : "—"}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Hourly earned</span>
                        <span className={`font-semibold ${r.hourlyEarned != null && r.hourlyEarned < 17.20 ? "text-red-600" : "text-green-700"}`}>
                          {r.hourlyEarned != null ? `$${r.hourlyEarned.toFixed(2)}/h` : "—"}
                        </span>
                      </div>
                      {r.topUp > 0 && <div className="flex justify-between"><span className="text-red-500">Min. wage top-up</span><span className="font-semibold text-red-600">{fmtC(r.topUp)}</span></div>}
                      <div className="flex justify-between"><span className="text-gray-500">Total hrs (YTD)</span><span className="font-semibold">{r.ytd > 0 ? `${r.ytd}h` : "—"}</span></div>
                    </div>
                    <div className="border border-gray-200 rounded-xl px-4 py-3 text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-500">OT threshold</span><span className="font-semibold">178h / 4-wk</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">OT hours</span>
                        <span className={`font-semibold ${r.otHours > 0 ? "text-amber-600" : "text-gray-700"}`}>
                          {r.otHours > 0 ? `${r.otHours}h` : "None"}
                        </span>
                      </div>
                      {r.otPay != null && <div className="flex justify-between"><span className="text-gray-500">OT pay (1.5×)</span><span className="font-semibold text-amber-600">{fmtC(r.otPay)}</span></div>}
                      {r.prevAvgHourly != null && <div className="flex justify-between"><span className="text-gray-500">Prev. avg hourly</span><span className="font-semibold">${r.prevAvgHourly.toFixed(2)}/h</span></div>}
                    </div>
                  </div>
                </div>

                {/* Income allocation */}
                <div>
                  <div className="text-[9px] uppercase tracking-[.15em] font-bold text-gray-400 mb-2">Income Allocation</div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-100">
                        <tr><td className="px-4 py-2.5 text-gray-600">25% Special Worksite Allowance</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtC(r.special)}</td></tr>
                        <tr><td className="px-4 py-2.5 text-gray-600">75% Regular Employment Income</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtC(r.regular)}</td></tr>
                        <tr className="border-t-2 border-gray-300 bg-gray-50"><td className="px-4 py-2.5 font-bold text-gray-900">Net Pay</td><td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtC(r.net)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Species breakdown (planters only) */}
                {r.type === "planter" && r.speciesRows.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-[.15em] font-bold text-gray-400 mb-2">Species Breakdown</div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-gray-200 bg-gray-50">
                          {["Code","Species","Trees","$/Tree","Earnings"].map(h => <th key={h} className="px-3 py-2 text-[9px] uppercase tracking-widest font-semibold text-gray-400 text-right first:text-left">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {r.speciesRows.map(s => (
                            <tr key={s.code}>
                              <td className="px-3 py-2 font-mono font-bold text-gray-700">{s.code}</td>
                              <td className="px-3 py-2 text-gray-600">{s.species}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(s.trees)}</td>
                              <td className="px-3 py-2 text-right text-gray-500 tabular-nums">${s.ratePerTree.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtC(s.earnings)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Signature lines */}
                <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-200">
                  {["Employee Signature & Date", "Authorized Signatory & Date"].map(label => (
                    <div key={label}>
                      <div className="border-b border-gray-700 h-8 mb-1.5" />
                      <div className="text-[9px] uppercase tracking-[.1em] font-semibold text-gray-400">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[9px] text-gray-400 pt-2 border-t border-gray-200">
                  <span>Integrity Reforestation · Payroll Statement</span>
                  <span>{r.name} · {r.period}</span>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-xs font-medium text-text-primary flex items-center gap-2">
          <span style={{ color: "var(--color-primary)" }}>✓</span> {toast}
        </div>
      )}
    </div>
  );
}
