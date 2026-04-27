"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Employee } from "@/app/admin/page";
import {
  getAllRecords, saveRecord, deleteRecord,
  getAllProjects, saveProject, deleteProject as dbDeleteProject,
  type StoredProject, type ProjectStatus,
} from "@/lib/adminDb";

// ── Leaflet map loaded client-side only ──────────────────────────────────────
const OpsMap = dynamic(() => import("./OpsMap"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full bg-surface-secondary rounded-xl">
    <span className="text-xs text-text-tertiary animate-pulse">Loading map…</span>
  </div>
) });

// ── Types ────────────────────────────────────────────────────────────────────

interface Camp {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "active" | "next" | "planned" | "past";
  arrivalDate: string;
  departureDate: string;
  notes: string;
}

interface Hospital {
  name: string;
  city: string;
  lat: number;
  lng: number;
  phone: string;
  distanceKm: number;
}

interface Block {
  id: string;
  name: string;
  lat: number;
  lng: number;
  species: string;
  targetTrees: number;
  plantedTrees: number;
  crew: string;
  status: "planting" | "complete" | "upcoming";
}

interface CrewRow {
  bossName: string;
  members: Employee[];
  treesToday: number;
  treesSeason: number;
  target: number;
  block: string;
  status: "active" | "travel" | "standby";
}

// ── Static ops data ──────────────────────────────────────────────────────────

const INITIAL_CAMPS: Camp[] = [
  {
    id: "camp-1",
    name: "Camp Chapleau – Base",
    lat: 47.8400,
    lng: -83.3983,
    status: "active",
    arrivalDate: "2026-04-06",
    departureDate: "2026-05-10",
    notes: "Main spring camp. Road access via Hwy 129.",
  },
  {
    id: "camp-2",
    name: "Camp Foleyet",
    lat: 48.2167,
    lng: -82.4167,
    status: "next",
    arrivalDate: "2026-05-11",
    departureDate: "2026-05-31",
    notes: "Remote. Helicopter access only for first week.",
  },
  {
    id: "camp-3",
    name: "Camp Hearst North",
    lat: 49.6833,
    lng: -83.6667,
    status: "planned",
    arrivalDate: "2026-06-01",
    departureDate: "2026-06-28",
    notes: "Final push. Black fly season — ensure DEET supply.",
  },
];

const HOSPITALS: Hospital[] = [
  { name: "Chapleau Health Services",   city: "Chapleau, ON",  lat: 47.8381, lng: -83.3965, phone: "705-864-1520", distanceKm: 2   },
  { name: "Timmins & District Hospital",city: "Timmins, ON",   lat: 48.4732, lng: -81.3326, phone: "705-267-2131", distanceKm: 87  },
  { name: "Lady Dunn Health Centre",    city: "Wawa, ON",      lat: 47.9932, lng: -84.7748, phone: "705-856-2335", distanceKm: 114 },
];

const BLOCKS: Block[] = [
  { id: "blk-1", name: "Mississagi Block A",   lat: 47.72, lng: -83.15, species: "Jack Pine",    targetTrees: 45000, plantedTrees: 12400, crew: "Adam Deryute",     status: "planting"  },
  { id: "blk-2", name: "Mississagi Block B",   lat: 47.68, lng: -83.22, species: "Black Spruce", targetTrees: 32000, plantedTrees: 0,     crew: "Jolissa Lonsbury", status: "upcoming"  },
  { id: "blk-3", name: "Chapleau Crown East",  lat: 47.91, lng: -83.28, species: "White Pine",   targetTrees: 28000, plantedTrees: 28000, crew: "Lucas Watson",     status: "complete"  },
  { id: "blk-4", name: "Chapleau Crown West",  lat: 47.88, lng: -83.52, species: "Jack Pine",    targetTrees: 38000, plantedTrees: 8200,  crew: "Jackson Gattesco", status: "planting"  },
];

const SEASON_PHASES = [
  { label: "Pre-Season Prep",   start: "2026-03-01", end: "2026-04-05", bgColor: "var(--color-text-tertiary)" },
  { label: "Camp Chapleau",     start: "2026-04-06", end: "2026-05-10", bgColor: "var(--color-primary)" },
  { label: "Camp Foleyet",      start: "2026-05-11", end: "2026-05-31", bgColor: "var(--color-info)" },
  { label: "Camp Hearst North", start: "2026-06-01", end: "2026-06-28", bgColor: "#8b5cf6" },
  { label: "Post-Season",       start: "2026-06-29", end: "2026-07-15", bgColor: "var(--color-text-tertiary)" },
];

const SEASON_START = new Date("2026-03-01");
const SEASON_END   = new Date("2026-07-15");
const TODAY        = new Date("2026-03-20");
const SEASON_DAYS  = (SEASON_END.getTime() - SEASON_START.getTime()) / 86400000;

function dayOffset(dateStr: string) {
  return (new Date(dateStr).getTime() - SEASON_START.getTime()) / 86400000;
}
function pct(d: number) { return `${Math.max(0, Math.min(100, (d / SEASON_DAYS) * 100)).toFixed(2)}%`; }
function mapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir//${lat},${lng}`;
}

const LOGISTICS = [
  { item: "2016 Ford F-350 (ON·PLANT1)", status: "operational", note: "Full tank. Next service in 4,200 km." },
  { item: "2019 Ram 2500 (ON·PLANT2)",   status: "operational", note: "Oil change due April 3." },
  { item: "2014 Chevy 3500 (ON·PLANT3)", status: "maintenance", note: "At Chapleau Autoplex. Ready April 4." },
  { item: "Camp Trailer #1",             status: "operational", note: "At Camp Chapleau." },
  { item: "Camp Trailer #2",             status: "operational", note: "In transit – arriving April 5." },
  { item: "Hoedad Supply (2,400 units)", status: "operational", note: "Staged in Chapleau warehouse." },
  { item: "Seedling Order – Chapleau",   status: "operational", note: "143,000 plugs. Pickup April 6 from MNRF." },
  { item: "Seedling Order – Foleyet",    status: "pending",     note: "Confirmation awaited from Thunder Bay nursery." },
];

const STATUS_DOT: Record<string, string> = {
  operational: "var(--color-primary)",
  maintenance:  "var(--color-warning)",
  pending:      "var(--color-danger)",
};

const PROJECT_STATUS_BADGE: Record<ProjectStatus, { label: string; style: React.CSSProperties }> = {
  active:    { label: "Active",    style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  tendering: { label: "Tendering", style: { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" } },
  completed: { label: "Completed", style: { background: "rgba(59,130,246,0.12)", color: "var(--color-info)" } },
  archived:  { label: "Archived",  style: { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" } },
};

interface Props { employees: Employee[] }

const BLANK_CAMP    = { name: "", lat: "", lng: "", arrivalDate: "", departureDate: "", notes: "", status: "planned" as Camp["status"] };
const BLANK_MOVE    = { campId: "", newDepartureDate: "", nextArrivalDate: "", notes: "" };
const BLANK_PROJECT = { name: "", location: "", season: String(new Date().getFullYear()), status: "active" as ProjectStatus };

// ── Component ─────────────────────────────────────────────────────────────────

export default function OperationsCenter({ employees }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "crews" | "calendar" | "logistics">("overview");

  // ── Camps ──
  const [camps, setCamps] = useState<Camp[]>(INITIAL_CAMPS);
  const [selectedCamp, setSelectedCamp] = useState<Camp>(INITIAL_CAMPS[0]);
  const [today] = useState(TODAY);

  // ── Calendar ──
  const [calendarMonth, setCalendarMonth] = useState(new Date("2026-03-01"));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ── Projects ──
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<StoredProject | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectForm, setProjectForm] = useState(BLANK_PROJECT);
  const [editProject, setEditProject] = useState<StoredProject | null>(null);
  const [editProjectForm, setEditProjectForm] = useState(BLANK_PROJECT);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<StoredProject | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatus | "all">("all");

  // ── Camp modals ──
  const [showAddCamp, setShowAddCamp] = useState(false);
  const [campForm, setCampForm] = useState(BLANK_CAMP);
  const [editCamp, setEditCamp] = useState<Camp | null>(null);
  const [editForm, setEditForm] = useState(BLANK_CAMP);
  const [showMove, setShowMove] = useState(false);
  const [moveForm, setMoveForm] = useState(BLANK_MOVE);

  // ── Toast ──
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  // Load projects from IndexedDB
  useEffect(() => {
    getAllProjects().then(saved => {
      setProjects(saved);
      setSelectedProject(saved.find(p => p.status === "active") ?? saved[0] ?? null);
    });
  }, []);

  // Load camps from IndexedDB
  useEffect(() => {
    getAllRecords<Camp>("camps").then(saved => {
      if (saved.length === 0) {
        Promise.all(INITIAL_CAMPS.map(c => saveRecord("camps", c)));
      } else {
        const sorted = saved.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
        setCamps(sorted);
        setSelectedCamp(sorted.find(c => c.status === "active") ?? sorted[0]);
      }
    });
  }, []);

  // ── Project CRUD ──────────────────────────────────────────────────────────

  function handleAddProject() {
    if (!projectForm.name.trim() || !projectForm.location.trim()) return;
    const newProject: StoredProject = {
      id: `proj-${Date.now()}`,
      name: projectForm.name.trim(),
      location: projectForm.location.trim(),
      season: projectForm.season,
      status: projectForm.status,
      createdAt: new Date().toISOString().slice(0, 10),
      files: [],
    };
    saveProject(newProject);
    setProjects(prev => [...prev, newProject].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    setSelectedProject(newProject);
    setShowAddProject(false);
    setProjectForm(BLANK_PROJECT);
    showToast(`Project "${newProject.name}" created.`);
  }

  function openEditProject(p: StoredProject) {
    setEditProject(p);
    setEditProjectForm({ name: p.name, location: p.location, season: p.season, status: p.status });
  }

  function handleSaveEditProject() {
    if (!editProject || !editProjectForm.name.trim()) return;
    const updated: StoredProject = { ...editProject, ...editProjectForm, name: editProjectForm.name.trim(), location: editProjectForm.location.trim() };
    saveProject(updated);
    setProjects(prev => prev.map(p => p.id === editProject.id ? updated : p));
    if (selectedProject?.id === editProject.id) setSelectedProject(updated);
    setEditProject(null);
    showToast("Project updated.");
  }

  function handleDeleteProject() {
    if (!deleteProjectTarget) return;
    dbDeleteProject(deleteProjectTarget.id);
    const remaining = projects.filter(p => p.id !== deleteProjectTarget.id);
    setProjects(remaining);
    if (selectedProject?.id === deleteProjectTarget.id) setSelectedProject(remaining[0] ?? null);
    setDeleteProjectTarget(null);
    showToast(`"${deleteProjectTarget.name}" deleted.`);
  }

  // ── Camp CRUD ─────────────────────────────────────────────────────────────

  function handleAddCamp() {
    if (!campForm.name || !campForm.lat || !campForm.lng || !campForm.arrivalDate || !campForm.departureDate) return;
    const newCamp: Camp = {
      id: `camp-${Date.now()}`,
      name: campForm.name.trim(),
      lat: parseFloat(campForm.lat),
      lng: parseFloat(campForm.lng),
      status: campForm.status,
      arrivalDate: campForm.arrivalDate,
      departureDate: campForm.departureDate,
      notes: campForm.notes.trim(),
    };
    setCamps(prev => [...prev, newCamp].sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate)));
    saveRecord("camps", newCamp);
    setShowAddCamp(false);
    setCampForm(BLANK_CAMP);
    showToast(`Camp "${newCamp.name}" added.`);
  }

  function handleScheduleMove() {
    if (!moveForm.campId || !moveForm.newDepartureDate) return;
    setCamps(prev => prev.map(c => {
      if (c.id === moveForm.campId) {
        const updated = { ...c, departureDate: moveForm.newDepartureDate };
        saveRecord("camps", updated);
        return updated;
      }
      if (c.status === "next" && moveForm.nextArrivalDate) {
        const updated = { ...c, arrivalDate: moveForm.nextArrivalDate };
        saveRecord("camps", updated);
        return updated;
      }
      return c;
    }));
    setShowMove(false);
    setMoveForm(BLANK_MOVE);
    showToast("Move scheduled. Camp dates updated.");
  }

  function openEditCamp(camp: Camp) {
    setEditCamp(camp);
    setEditForm({ name: camp.name, lat: String(camp.lat), lng: String(camp.lng), arrivalDate: camp.arrivalDate, departureDate: camp.departureDate, notes: camp.notes, status: camp.status });
  }

  function handleSaveEditCamp() {
    if (!editCamp || !editForm.name || !editForm.lat || !editForm.lng || !editForm.arrivalDate || !editForm.departureDate) return;
    const updated: Camp = { ...editCamp, name: editForm.name.trim(), lat: parseFloat(editForm.lat), lng: parseFloat(editForm.lng), arrivalDate: editForm.arrivalDate, departureDate: editForm.departureDate, status: editForm.status, notes: editForm.notes.trim() };
    setCamps(prev => prev.map(c => c.id === editCamp.id ? updated : c).sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate)));
    saveRecord("camps", updated);
    setEditCamp(null);
    showToast(`"${updated.name}" updated.`);
  }

  function handleSetActive(id: string) {
    setCamps(prev => prev.map(c => {
      if (c.id === id) { const u = { ...c, status: "active" as const }; saveRecord("camps", u); return u; }
      if (c.status === "active") { const u = { ...c, status: "past" as const }; saveRecord("camps", u); return u; }
      return c;
    }));
    showToast("Active camp updated.");
  }

  function handleDeleteCamp(id: string) {
    setCamps(prev => prev.filter(c => c.id !== id));
    deleteRecord("camps", id);
    showToast("Camp removed.");
  }

  // ── Derived crew data ─────────────────────────────────────────────────────

  const crews = useMemo<CrewRow[]>(() => {
    const BOSS_MAP: Record<string, { treesToday: number; treesSeason: number; target: number; block: string }> = {
      "Jolissa Lonsbury":  { treesToday: 1840, treesSeason: 0,     target: 1800, block: "Mississagi Block B" },
      "Adam Deryute":      { treesToday: 2210, treesSeason: 8400,  target: 2000, block: "Mississagi Block A" },
      "Lucas Watson":      { treesToday: 0,    treesSeason: 28000, target: 1600, block: "Chapleau Crown East" },
      "Jackson Gattesco":  { treesToday: 1650, treesSeason: 8200,  target: 1800, block: "Chapleau Crown West" },
    };
    return Object.entries(BOSS_MAP).map(([boss, data]) => ({
      bossName: boss,
      members: employees.filter(e => e.crewBoss === boss),
      ...data,
      status: boss === "Lucas Watson" ? "standby" : "active",
    }));
  }, [employees]);

  const totalTreesSeason  = useMemo(() => crews.reduce((s, c) => s + c.treesSeason, 0), [crews]);
  const totalTodayTrees   = useMemo(() => crews.reduce((s, c) => s + c.treesToday,  0), [crews]);
  const totalTarget       = 143000;
  const activePlanters    = employees.filter(e => e.status === "active").length;
  const daysToSeasonStart = Math.ceil((new Date("2026-04-06").getTime() - today.getTime()) / 86400000);

  const nextCamp   = camps.find(c => c.status === "next")   ?? camps[1];
  const activeCamp = camps.find(c => c.status === "active") ?? camps[0];
  const distNextCamp = 115;

  // ── Calendar data ─────────────────────────────────────────────────────────

  const TAG_STYLES: Record<string, React.CSSProperties> = {
    today:      { background: "rgba(255,255,255,0.1)", color: "white" },
    milestone:  { background: "rgba(139,92,246,0.15)", color: "#8b5cf6" },
    logistics:  { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" },
    camp:       { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" },
    compliance: { background: "rgba(239,68,68,0.12)",  color: "var(--color-danger)" },
  };
  const TAG_ICON: Record<string, string> = {
    today: "◎", milestone: "★", logistics: "⚙", camp: "⛺", compliance: "⚑",
  };

  const KEY_DATES = useMemo(() => [
    { date: "2026-03-20", label: "Today — Pre-season planning",          tag: "today" },
    { date: "2026-04-03", label: "ON·PLANT3 back from service",          tag: "logistics" },
    { date: "2026-04-05", label: "Camp Trailer #2 arrives Chapleau",     tag: "logistics" },
    { date: "2026-04-06", label: "Season start — first planting day",    tag: "milestone" },
    { date: "2026-04-06", label: "MNRF seedling pickup — 143,000 plugs", tag: "logistics" },
    { date: "2026-04-30", label: "CVOR annual renewal deadline",         tag: "compliance" },
    { date: "2026-06-28", label: "Final planting day",                   tag: "milestone" },
    { date: "2026-07-15", label: "Season close — crew demob",            tag: "milestone" },
    ...camps.map(c => ({ date: c.arrivalDate,   label: `Arrive: ${c.name}`, tag: "camp" })),
    ...camps.map(c => ({ date: c.departureDate, label: `Depart: ${c.name}`, tag: "camp" })),
  ], [camps]);

  const calendarDays = useMemo(() => {
    const year  = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDow   = new Date(year, month, 1).getDay();
    const daysInMo   = new Date(year, month + 1, 0).getDate();
    const prevMoDays = new Date(year, month, 0).getDate();
    type CalDay = { dateStr: string; day: number; inMonth: boolean; events: { label: string; tag: string }[]; campPhase: { label: string; style: React.CSSProperties } | null; };
    const campStatusStyle: Record<Camp["status"], React.CSSProperties> = {
      active:  { background: "rgba(57,222,139,0.10)",  color: "var(--color-primary)" },
      next:    { background: "rgba(251,183,0,0.10)",   color: "var(--color-warning)" },
      planned: { background: "rgba(59,130,246,0.10)",  color: "var(--color-info)" },
      past:    { background: "rgba(0,0,0,0.05)",       color: "var(--color-text-tertiary)" },
    };
    function getCampPhase(dateStr: string) {
      for (const camp of camps) {
        if (dateStr >= camp.arrivalDate && dateStr <= camp.departureDate)
          return { label: camp.name.replace(/^Camp\s+/i, ""), style: campStatusStyle[camp.status] };
      }
      return null;
    }
    const days: CalDay[] = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = prevMoDays - i;
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      days.push({ dateStr: `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false, events: [], campPhase: null });
    }
    for (let d = 1; d <= daysInMo; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ dateStr, day: d, inMonth: true, events: KEY_DATES.filter(e => e.date === dateStr), campPhase: getCampPhase(dateStr) });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = month === 11 ? 0 : month + 1;
      const ny = month === 11 ? year + 1 : year;
      days.push({ dateStr: `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false, events: [], campPhase: null });
    }
    return days;
  }, [calendarMonth, KEY_DATES, camps]);

  // ── Filtered project list ─────────────────────────────────────────────────

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (projectStatusFilter !== "all" && p.status !== projectStatusFilter) return false;
      if (projectSearch) {
        const q = projectSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.location.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [projects, projectSearch, projectStatusFilter]);

  const TABS = [
    { key: "overview",  label: "Overview" },
    { key: "crews",     label: "Crews" },
    { key: "calendar",  label: "Calendar" },
    { key: "logistics", label: "Project Assets" },
  ] as const;

  // ── Input style ──────────────────────────────────────────────────────────
  const inputCls = "w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── KPI Strip ────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-border px-6 py-3">
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: "Active Projects",  value: projects.filter(p => p.status === "active").length,      sub: "in progress",            color: "text-text-primary" },
            { label: "Active Planters",  value: activePlanters,                                           sub: "on roster",              color: "text-text-primary" },
            { label: "Trees Today",      value: totalTodayTrees.toLocaleString(),                         sub: "est. by end of day",     cssColor: "var(--color-primary)" },
            { label: "Season Total",     value: totalTreesSeason.toLocaleString(),                        sub: `of ${totalTarget.toLocaleString()} target`, cssColor: "var(--color-info)" },
            { label: "Season Progress",  value: `${((totalTreesSeason / totalTarget) * 100).toFixed(1)}%`, sub: "to target",             cssColor: "#8b5cf6" },
            { label: "Days to Season",   value: daysToSeasonStart,                                        sub: "until first plant day",  cssColor: "var(--color-text-secondary)" },
          ].map(k => (
            <div key={k.label} className="bg-surface-secondary rounded-lg px-3 py-2.5 border border-border">
              <div className="text-[9px] font-semibold uppercase tracking-widest text-text-tertiary truncate">{k.label}</div>
              <div className="text-xl font-bold mt-0.5" style={{ color: k.cssColor }}>{k.value}</div>
              <div className="text-[9px] text-text-tertiary mt-0.5 truncate">{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Project list */}
        <div className="w-64 shrink-0 border-r border-border flex flex-col bg-surface overflow-hidden">
          {/* List header */}
          <div className="px-4 py-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary flex-1">Projects</span>
              <button
                onClick={() => setShowAddProject(true)}
                className="text-xs font-medium px-2.5 py-1 rounded-lg hover:opacity-90 transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                + New
              </button>
            </div>
            <input
              type="text"
              placeholder="Search projects…"
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              className="w-full text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
            />
            <select
              value={projectStatusFilter}
              onChange={e => setProjectStatusFilter(e.target.value as ProjectStatus | "all")}
              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-surface-secondary text-text-secondary focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="tendering">Tendering</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {filteredProjects.map(p => {
              const badge = PROJECT_STATUS_BADGE[p.status];
              const isActive = selectedProject?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProject(p); setActiveTab("overview"); }}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-surface-secondary/60 border-l-2 ${
                    isActive ? "bg-primary/8 border-primary" : "border-transparent"
                  }`}
                >
                  <div className="text-xs font-semibold text-text-primary truncate">{p.name}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5 truncate">{p.location} · {p.season}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={badge.style}>
                      {badge.label}
                    </span>
                    {p.files.length > 0 && (
                      <span className="text-[9px] text-text-tertiary">{p.files.length} file{p.files.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredProjects.length === 0 && (
              <div className="py-12 px-4 text-center">
                <div className="text-xs text-text-tertiary mb-3">
                  {projects.length === 0 ? "No projects yet." : "No projects match your filters."}
                </div>
                {projects.length === 0 && (
                  <button
                    onClick={() => setShowAddProject(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Create your first project
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Project detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedProject ? (
            <>
              {/* Project header + tabs */}
              <div className="shrink-0 bg-surface border-b border-border px-6 pt-4 pb-0">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-base font-bold text-text-primary">{selectedProject.name}</h2>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={PROJECT_STATUS_BADGE[selectedProject.status].style}>
                        {PROJECT_STATUS_BADGE[selectedProject.status].label}
                      </span>
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {selectedProject.location} · Season {selectedProject.season}
                      {selectedProject.files.length > 0 && ` · ${selectedProject.files.length} files`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setMoveForm({ campId: activeCamp?.id ?? "", newDepartureDate: activeCamp?.departureDate ?? "", nextArrivalDate: nextCamp?.arrivalDate ?? "", notes: "" }); setShowMove(true); }}
                      className="px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors"
                      style={{ background: "rgba(251,183,0,0.12)", color: "var(--color-warning)", borderColor: "rgba(251,183,0,0.3)" }}
                    >
                      ⇄ Schedule Move
                    </button>
                    <button
                      onClick={() => setShowAddCamp(true)}
                      className="px-3 py-1.5 text-xs font-medium bg-surface-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                    >
                      + Camp
                    </button>
                    <button
                      onClick={() => openEditProject(selectedProject)}
                      className="px-3 py-1.5 text-xs font-medium bg-surface-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteProjectTarget(selectedProject)}
                      className="px-3 py-1.5 text-xs font-medium border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex items-center gap-1">
                  {TABS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                        activeTab === t.key
                          ? "border-primary text-primary"
                          : "border-transparent text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">

                {/* OVERVIEW ──────────────────────────────────────────────── */}
                {activeTab === "overview" && (
                  <div className="p-6 space-y-5 max-w-7xl mx-auto">

                    <div className="grid grid-cols-3 gap-5">

                      {/* Active camp card */}
                      <div className="col-span-2 bg-surface rounded-xl border border-border p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1">Active Camp</div>
                            <div className="text-lg font-bold text-text-primary">{activeCamp.name}</div>
                            <div className="text-xs text-text-secondary mt-0.5">{activeCamp.notes}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditCamp(activeCamp)}
                              className="text-[11px] text-text-secondary hover:text-text-primary border border-border rounded-lg px-2.5 py-1 hover:bg-surface-secondary transition-colors"
                            >
                              Edit
                            </button>
                            <a
                              href={mapsDirectionsUrl(activeCamp.lat, activeCamp.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] border rounded-lg px-2.5 py-1 transition-colors"
                              style={{ color: "var(--color-info)", background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.25)" }}
                            >
                              ↗ Directions
                            </a>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-full" style={{ background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }}>
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-primary)" }} />
                              Live
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-surface-secondary rounded-lg p-3 border border-border">
                            <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">Arrival</div>
                            <div className="text-xs font-semibold text-text-primary">{activeCamp.arrivalDate}</div>
                          </div>
                          <div className="bg-surface-secondary rounded-lg p-3 border border-border">
                            <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">Departure</div>
                            <div className="text-xs font-semibold text-text-primary">{activeCamp.departureDate}</div>
                          </div>
                          <div className="bg-surface-secondary rounded-lg p-3 border border-border">
                            <div className="text-[9px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">Next Move</div>
                            <div className="text-xs font-semibold" style={{ color: "var(--color-warning)" }}>
                              {nextCamp ? `${nextCamp.name.replace("Camp ", "")} · ${distNextCamp} km` : "—"}
                            </div>
                          </div>
                        </div>
                        <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-red-400 text-sm">✚</span>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Nearest Emergency</span>
                          </div>
                          <div className="text-xs font-semibold text-text-primary">{HOSPITALS[0].name}</div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-[11px] text-text-secondary">{HOSPITALS[0].city}</span>
                            <span className="text-[11px] text-text-secondary">{HOSPITALS[0].distanceKm} km away</span>
                            <span className="text-[11px] font-medium text-text-primary">{HOSPITALS[0].phone}</span>
                          </div>
                        </div>
                      </div>

                      {/* Next camp card */}
                      <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Next Camp</div>
                        {nextCamp ? (
                          <>
                            <div className="text-base font-bold text-text-primary">{nextCamp.name}</div>
                            <div className="text-xs text-text-secondary mt-0.5 mb-4">{nextCamp.notes}</div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-text-tertiary">Arrival</span>
                                <span className="font-medium text-text-primary">{nextCamp.arrivalDate}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-text-tertiary">Departure</span>
                                <span className="font-medium text-text-primary">{nextCamp.departureDate}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-text-tertiary">Distance</span>
                                <span className="font-medium" style={{ color: "var(--color-warning)" }}>{distNextCamp} km from current</span>
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">Nearby Hospital</div>
                              <div className="text-xs font-medium text-text-primary">{HOSPITALS[1].name}</div>
                              <div className="text-[11px] text-text-secondary">{HOSPITALS[1].distanceKm} km · {HOSPITALS[1].phone}</div>
                            </div>
                            <a
                              href={mapsDirectionsUrl(nextCamp.lat, nextCamp.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
                              style={{ color: "var(--color-info)", background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.25)" }}
                            >
                              ↗ Get Driving Directions
                            </a>
                          </>
                        ) : (
                          <div className="text-xs text-text-tertiary">No next camp scheduled.</div>
                        )}
                      </div>
                    </div>

                    {/* All camp locations table */}
                    <div className="bg-surface rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                        <div className="text-xs font-semibold text-text-primary">Camp Locations</div>
                        <div className="text-[10px] text-text-tertiary">{camps.length} camp{camps.length !== 1 ? "s" : ""} scheduled</div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-surface-secondary">
                            {["Camp Name", "Arrival", "Departure", "Duration", "Status", "Notes", ""].map(h => (
                              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {camps.map(camp => {
                            const days = Math.ceil((new Date(camp.departureDate).getTime() - new Date(camp.arrivalDate).getTime()) / 86400000);
                            const campBadge: Record<Camp["status"], React.CSSProperties> = {
                              active:  { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" },
                              next:    { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" },
                              planned: { background: "rgba(59,130,246,0.12)", color: "var(--color-info)" },
                              past:    { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" },
                            };
                            return (
                              <tr
                                key={camp.id}
                                onClick={() => setSelectedCamp(camp)}
                                className={`transition-colors group cursor-pointer ${selectedCamp.id === camp.id ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-surface-secondary/60"}`}
                              >
                                <td className="px-4 py-3 font-medium text-text-primary">{camp.name}</td>
                                <td className="px-4 py-3 text-text-secondary">{camp.arrivalDate}</td>
                                <td className="px-4 py-3 text-text-secondary">{camp.departureDate}</td>
                                <td className="px-4 py-3 text-text-tertiary">{isNaN(days) ? "—" : `${days}d`}</td>
                                <td className="px-4 py-3">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={campBadge[camp.status]}>
                                    {camp.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-text-tertiary max-w-[180px] truncate">{camp.notes || "—"}</td>
                                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a href={mapsDirectionsUrl(camp.lat, camp.lng)} target="_blank" rel="noopener noreferrer" className="text-[11px] hover:underline" style={{ color: "var(--color-info)" }}>↗ Directions</a>
                                    <span className="text-border">|</span>
                                    <button onClick={() => openEditCamp(camp)} className="text-[11px] text-primary hover:underline">Edit</button>
                                    {camp.status !== "active" && (
                                      <>
                                        <span className="text-border">|</span>
                                        <button onClick={() => handleSetActive(camp.id)} className="text-[11px] hover:underline" style={{ color: "var(--color-primary)" }}>Set Active</button>
                                      </>
                                    )}
                                    <span className="text-border">|</span>
                                    <button onClick={() => handleDeleteCamp(camp.id)} className="text-[11px] text-text-tertiary hover:text-danger">Remove</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {camps.length === 0 && (
                        <div className="py-10 text-center text-xs text-text-tertiary">No camps added yet. Click "+ Camp" above to add one.</div>
                      )}
                    </div>

                    {/* Map */}
                    <div className="bg-surface rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                        <div className="text-xs font-semibold text-text-primary">Camp Locations Map</div>
                        <div className="text-[10px] text-text-tertiary">Click a row above or a pin to navigate</div>
                      </div>
                      <div className="flex" style={{ height: "420px" }}>
                        <div className="w-52 shrink-0 border-r border-border overflow-y-auto p-3 space-y-3">
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">Camps</div>
                            <div className="space-y-1.5">
                              {camps.map(camp => {
                                const campSidebarStyle: Record<Camp["status"], React.CSSProperties> = {
                                  active:  { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)",         borderColor: "rgba(57,222,139,0.3)" },
                                  next:    { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)",         borderColor: "rgba(251,183,0,0.3)" },
                                  planned: { background: "rgba(59,130,246,0.12)", color: "var(--color-info)",            borderColor: "rgba(59,130,246,0.3)" },
                                  past:    { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)",   borderColor: "rgba(0,0,0,0.1)" },
                                };
                                return (
                                  <div key={camp.id} className="rounded-lg border text-xs transition-colors" style={selectedCamp.id === camp.id ? campSidebarStyle[camp.status] : {}}>
                                    <button onClick={() => setSelectedCamp(camp)} className="w-full text-left p-2">
                                      <div className="font-semibold text-text-primary truncate">{camp.name}</div>
                                      <div className="text-[9px] text-text-tertiary mt-0.5 capitalize">{camp.status} · {camp.arrivalDate}</div>
                                    </button>
                                    <a href={mapsDirectionsUrl(camp.lat, camp.lng)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 pb-2 text-[9px] font-medium transition-colors" style={{ color: "var(--color-info)" }}>↗ Directions</a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">Hospitals</div>
                            <div className="space-y-1.5">
                              {HOSPITALS.map(h => (
                                <div key={h.name} className="p-2 rounded-lg border border-red-500/20 bg-red-500/5">
                                  <div className="text-[10px] font-semibold text-text-primary flex items-center gap-1"><span style={{ color: "var(--color-danger)" }}>✚</span><span className="truncate">{h.name}</span></div>
                                  <div className="text-[9px] text-text-tertiary mt-0.5">{h.distanceKm} km · {h.phone}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <OpsMap camps={camps} hospitals={HOSPITALS} blocks={BLOCKS} selectedCamp={selectedCamp} onSelectCamp={setSelectedCamp} />
                        </div>
                      </div>
                    </div>

                    {/* Season timeline */}
                    <div className="bg-surface rounded-xl border border-border p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-xs font-semibold text-text-primary">2026 Season Timeline</div>
                        <div className="text-[10px] text-text-tertiary">Mar 1 – Jul 15, 2026</div>
                      </div>
                      <div className="relative mb-1" style={{ height: "14px" }}>
                        {["Mar", "Apr", "May", "Jun", "Jul"].map((m, i) => {
                          const monthStarts = ["2026-03-01","2026-04-01","2026-05-01","2026-06-01","2026-07-01"];
                          return <span key={m} className="absolute text-[9px] text-text-tertiary font-medium" style={{ left: pct(dayOffset(monthStarts[i])) }}>{m}</span>;
                        })}
                      </div>
                      <div className="relative h-8 bg-surface-secondary rounded-lg overflow-hidden mb-3">
                        {[...camps].sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate)).map(camp => {
                          const barBg: Record<Camp["status"], string> = { active: "var(--color-primary)", next: "var(--color-warning)", planned: "var(--color-info)", past: "var(--color-text-tertiary)" };
                          return (
                            <div key={camp.id} title={`${camp.name}: ${camp.arrivalDate} → ${camp.departureDate}`}
                              className="absolute h-full opacity-85 flex items-center px-2 overflow-hidden"
                              style={{ background: barBg[camp.status], left: pct(dayOffset(camp.arrivalDate)), width: pct(dayOffset(camp.departureDate) - dayOffset(camp.arrivalDate)) }}>
                              <span className="text-[9px] font-semibold text-white truncate whitespace-nowrap">{camp.name.replace(/^Camp\s+/i, "")}</span>
                            </div>
                          );
                        })}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10 pointer-events-none" style={{ left: pct(dayOffset("2026-03-20")) }}>
                          <div className="absolute -top-5 -translate-x-1/2 text-[8px] font-bold text-white bg-gray-800 px-1 rounded whitespace-nowrap">Today</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        {(["active","next","planned","past"] as Camp["status"][]).map(s => {
                          const bg = { active: "var(--color-primary)", next: "var(--color-warning)", planned: "var(--color-info)", past: "var(--color-text-tertiary)" }[s];
                          const l  = { active: "Active", next: "Next", planned: "Planned", past: "Past" }[s];
                          return <div key={s} className="flex items-center gap-1.5 text-[10px] text-text-secondary"><div className="w-2.5 h-2.5 rounded" style={{ background: bg }} />{l}</div>;
                        })}
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary"><div className="w-0.5 h-3 bg-white/70" />Today</div>
                      </div>
                    </div>

                    {/* Production + Alerts */}
                    <div className="grid grid-cols-3 gap-5">
                      <div className="col-span-2 bg-surface rounded-xl border border-border p-5">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-4">Production by Block</div>
                        <div className="space-y-3">
                          {BLOCKS.map(blk => {
                            const pctDone = blk.targetTrees > 0 ? blk.plantedTrees / blk.targetTrees : 0;
                            const blockColors: Record<Block["status"], string> = { planting: "var(--color-primary)", complete: "var(--color-info)", upcoming: "var(--color-text-tertiary)" };
                            return (
                              <div key={blk.id}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-semibold" style={{ color: blockColors[blk.status] }}>
                                      {blk.status === "planting" ? "● Planting" : blk.status === "complete" ? "✓ Complete" : "○ Upcoming"}
                                    </span>
                                    <span className="text-xs font-medium text-text-primary">{blk.name}</span>
                                    <span className="text-[10px] text-text-tertiary">· {blk.species}</span>
                                  </div>
                                  <div className="text-xs text-text-secondary">{blk.plantedTrees.toLocaleString()} / {blk.targetTrees.toLocaleString()}</div>
                                </div>
                                <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pctDone * 100}%`, background: blockColors[blk.status] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Alerts</div>
                        <div className="space-y-2.5">
                          {[
                            { level: "warn", msg: "Vehicle ON·PLANT3 in maintenance – confirm return by Apr 4" },
                            { level: "warn", msg: "Seedling order confirmation pending for Foleyet" },
                            { level: "info", msg: `Season starts in ${daysToSeasonStart} days – confirm crew travel plans` },
                            { level: "info", msg: "CVOR annual renewal due April 30" },
                          ].map((a, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border text-xs" style={a.level === "warn" ? { background: "rgba(251,183,0,0.08)", borderColor: "rgba(251,183,0,0.2)", color: "var(--color-warning)" } : { background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)", color: "var(--color-info)" }}>
                              <span className="shrink-0 mt-0.5">{a.level === "warn" ? "⚠" : "ℹ"}</span>
                              <span>{a.msg}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* CREWS ──────────────────────────────────────────────────── */}
                {activeTab === "crews" && (
                  <div className="p-6 max-w-7xl mx-auto space-y-4">
                    {crews.map(crew => {
                      const pctToTarget = crew.target > 0 ? Math.min(crew.treesToday / crew.target, 1) : 0;
                      const crewBadge: Record<CrewRow["status"], React.CSSProperties> = {
                        active:  { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" },
                        travel:  { background: "rgba(251,183,0,0.12)",  color: "var(--color-warning)" },
                        standby: { background: "rgba(0,0,0,0.05)",      color: "var(--color-text-tertiary)" },
                      };
                      return (
                        <div key={crew.bossName} className="bg-surface rounded-xl border border-border">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
                                {crew.bossName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-text-primary">{crew.bossName}</div>
                                <div className="text-xs text-text-tertiary">Crew Boss · {crew.members.length} planters · {crew.block}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>{crew.treesToday.toLocaleString()}</div>
                                <div className="text-[10px] text-text-tertiary">today / {crew.target.toLocaleString()} target</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold" style={{ color: "var(--color-info)" }}>{crew.treesSeason.toLocaleString()}</div>
                                <div className="text-[10px] text-text-tertiary">season total</div>
                              </div>
                              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={crewBadge[crew.status]}>
                                {crew.status.charAt(0).toUpperCase() + crew.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <div className="px-5 py-2 border-b border-border">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pctToTarget * 100}%`, background: "var(--color-primary)" }} />
                              </div>
                              <span className="text-[10px] text-text-tertiary shrink-0">{(pctToTarget * 100).toFixed(0)}% of daily target</span>
                            </div>
                          </div>
                          <div className="divide-y divide-border/50">
                            {crew.members.length === 0 ? (
                              <div className="px-5 py-3 text-xs text-text-tertiary">No planters assigned to this crew yet.</div>
                            ) : (
                              crew.members.map(emp => (
                                <div key={emp.id} className="flex items-center px-5 py-2.5 text-xs hover:bg-surface-secondary/60 transition-colors">
                                  <div className="w-6 h-6 rounded-full bg-surface-secondary border border-border flex items-center justify-center text-[9px] font-bold text-text-secondary shrink-0 mr-3">{emp.avatar}</div>
                                  <div className="flex-1 font-medium text-text-primary">{emp.name}</div>
                                  <div className="w-32 text-text-tertiary">{emp.role}</div>
                                  <div className="w-28 text-text-tertiary">{emp.city}, {emp.province}</div>
                                  <div className="w-24 text-text-tertiary">DL: {emp.dlClass || "—"}</div>
                                  <div className="w-20 text-text-tertiary">FA: {emp.firstAid || "—"}</div>
                                  <div className="w-16 text-right font-semibold" style={{ color: emp.status === "active" ? "var(--color-primary)" : "var(--color-text-tertiary)" }}>
                                    {emp.status === "active" ? "Active" : emp.status}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {crews.length === 0 && (
                      <div className="py-12 text-center text-xs text-text-tertiary">No crew data available. Add employees and assign crew bosses to populate this view.</div>
                    )}
                  </div>
                )}

                {/* CALENDAR ───────────────────────────────────────────────── */}
                {activeTab === "calendar" && (
                  <div className="p-6 max-w-6xl mx-auto space-y-5">
                    {/* Season bar */}
                    <div className="bg-surface rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-text-primary">2026 Planting Season</div>
                        <div className="text-[10px] text-text-tertiary">Mar 1 – Jul 15, 2026</div>
                      </div>
                      <div className="relative h-6 bg-surface-secondary rounded overflow-hidden">
                        {SEASON_PHASES.map(phase => (
                          <div key={phase.label} className="absolute h-full opacity-80"
                            style={{ background: phase.bgColor, left: pct(dayOffset(phase.start)), width: pct(dayOffset(phase.end) - dayOffset(phase.start)) }}
                            title={phase.label} />
                        ))}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: pct(dayOffset("2026-03-20")) }}>
                          <div className="absolute top-0.5 left-1 text-[8px] font-bold text-white bg-gray-900/80 px-1 rounded whitespace-nowrap">Today</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {SEASON_PHASES.map(p => (
                          <div key={p.label} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                            <div className="w-2.5 h-2.5 rounded" style={{ background: p.bgColor }} />
                            {p.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Calendar grid */}
                    <div className="bg-surface rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-secondary">
                        <button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:bg-surface hover:text-text-primary transition-colors text-base font-bold">‹</button>
                        <div className="text-sm font-semibold text-text-primary">
                          {calendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                        </div>
                        <button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:bg-surface hover:text-text-primary transition-colors text-base font-bold">›</button>
                      </div>
                      <div className="grid grid-cols-7 border-b border-border">
                        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                          <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7">
                        {calendarDays.map((day, idx) => {
                          const isSelected = selectedDay === day.dateStr;
                          const isTodayCell = day.dateStr === "2026-03-20";
                          return (
                            <button key={idx} onClick={() => setSelectedDay(d => d === day.dateStr ? null : day.dateStr)}
                              className={`min-h-[80px] p-2 border-b border-r border-border/40 text-left transition-colors ${!day.inMonth ? "opacity-30" : ""} ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : day.inMonth ? "hover:bg-surface-secondary/60" : ""}`}>
                              <div className="text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-1" style={isTodayCell ? { background: "var(--color-primary)", color: "var(--color-primary-deep)", fontWeight: 700 } : { color: "var(--color-text-secondary)" }}>
                                {day.day}
                              </div>
                              {day.campPhase && <div className="text-[8px] px-1 py-0.5 rounded mb-0.5 font-medium truncate" style={day.campPhase.style}>⛺ {day.campPhase.label}</div>}
                              <div className="space-y-0.5">
                                {day.events.slice(0, 2).map((ev, i) => (
                                  <div key={i} className="text-[9px] px-1 py-0.5 rounded truncate font-medium leading-tight" style={TAG_STYLES[ev.tag]}>{ev.label}</div>
                                ))}
                                {day.events.length > 2 && <div className="text-[9px] text-text-tertiary pl-1">+{day.events.length - 2}</div>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Selected day detail */}
                    {selectedDay && (() => {
                      const dayData = calendarDays.find(d => d.dateStr === selectedDay);
                      if (!dayData || (dayData.events.length === 0 && !dayData.campPhase)) return null;
                      const label = new Date(selectedDay + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                      return (
                        <div className="bg-surface rounded-xl border border-primary/30 p-4">
                          <div className="text-xs font-semibold text-text-primary mb-3">{label}</div>
                          {dayData.campPhase && (
                            <div className="flex items-center gap-2 text-xs mb-2 px-3 py-2 rounded-lg" style={dayData.campPhase.style}>
                              <span className="font-semibold">⛺ {dayData.campPhase.label}</span>
                              <span className="opacity-60">active camp period</span>
                            </div>
                          )}
                          {dayData.events.map((ev, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-1.5" style={TAG_STYLES[ev.tag]}>
                              <span>{TAG_ICON[ev.tag]}</span>
                              <span className="font-medium">{ev.label}</span>
                              <span className="ml-auto text-[10px] opacity-60 capitalize">{ev.tag}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Key dates list */}
                    <div className="bg-surface rounded-xl border border-border overflow-hidden">
                      <div className="px-5 py-3 border-b border-border text-xs font-semibold text-text-primary">All Key Dates</div>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-border/50">
                          {KEY_DATES.slice().sort((a, b) => a.date.localeCompare(b.date)).map((row, i) => (
                            <tr key={i} onClick={() => { setCalendarMonth(new Date(row.date.slice(0, 7) + "-01")); setSelectedDay(row.date); }}
                              className="hover:bg-surface-secondary/60 transition-colors cursor-pointer">
                              <td className="px-5 py-2.5 text-text-tertiary w-32">{row.date}</td>
                              <td className="px-5 py-2.5 text-text-primary">{row.label}</td>
                              <td className="px-5 py-2.5 text-right">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={TAG_STYLES[row.tag]}>{row.tag}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* LOGISTICS ──────────────────────────────────────────────── */}
                {activeTab === "logistics" && (
                  <div className="p-6 max-w-5xl mx-auto">
                    <div className="bg-surface rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                        <div className="text-xs font-semibold text-text-primary">Logistics Tracker</div>
                        <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--color-primary)" }} />Operational</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--color-warning)" }} />Maintenance</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--color-danger)" }} />Pending</span>
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-surface-secondary">
                            <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary w-8" />
                            <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Item</th>
                            <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                            <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {LOGISTICS.map((row, i) => (
                            <tr key={i} className="hover:bg-surface-secondary/60 transition-colors">
                              <td className="px-5 py-3"><span className="inline-block w-2 h-2 rounded-full" style={{ background: STATUS_DOT[row.status] }} /></td>
                              <td className="px-5 py-3 font-medium text-text-primary">{row.item}</td>
                              <td className="px-5 py-3">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={row.status === "operational" ? { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } : row.status === "maintenance" ? { background: "rgba(251,183,0,0.12)", color: "var(--color-warning)" } : { background: "rgba(239,68,68,0.12)", color: "var(--color-danger)" }}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-text-secondary">{row.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </>
          ) : (
            /* No project selected */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-2xl opacity-30">⬡</div>
              <div className="text-sm font-semibold text-text-secondary">No project selected</div>
              <div className="text-xs text-text-tertiary text-center max-w-xs">
                {projects.length === 0
                  ? "Create your first project to start tracking operations."
                  : "Select a project from the list to view its operations."}
              </div>
              <button
                onClick={() => setShowAddProject(true)}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
              >
                + New Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Project Modal ─────────────────────────────────────────────── */}
      {showAddProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[460px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">New Project</div>
              <button onClick={() => { setShowAddProject(false); setProjectForm(BLANK_PROJECT); }} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Project Name *</label>
                <input type="text" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mississagi Block A" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Location *</label>
                <input type="text" value={projectForm.location} onChange={e => setProjectForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Chapleau, ON" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Season</label>
                  <input type="text" value={projectForm.season} onChange={e => setProjectForm(f => ({ ...f, season: e.target.value }))} placeholder="2026" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Status</label>
                  <select value={projectForm.status} onChange={e => setProjectForm(f => ({ ...f, status: e.target.value as ProjectStatus }))} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="tendering">Tendering</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowAddProject(false); setProjectForm(BLANK_PROJECT); }} className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleAddProject} disabled={!projectForm.name.trim() || !projectForm.location.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Project Modal ────────────────────────────────────────────── */}
      {editProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[460px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-text-primary">Edit Project</div>
              <button onClick={() => setEditProject(null)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Project Name *</label>
                <input type="text" value={editProjectForm.name} onChange={e => setEditProjectForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Location</label>
                <input type="text" value={editProjectForm.location} onChange={e => setEditProjectForm(f => ({ ...f, location: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Season</label>
                  <input type="text" value={editProjectForm.season} onChange={e => setEditProjectForm(f => ({ ...f, season: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Status</label>
                  <select value={editProjectForm.status} onChange={e => setEditProjectForm(f => ({ ...f, status: e.target.value as ProjectStatus }))} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="tendering">Tendering</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setEditProject(null)} className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleSaveEditProject} disabled={!editProjectForm.name.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Project Confirm ────────────────────────────────────────── */}
      {deleteProjectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[420px] p-6">
            <div className="text-sm font-semibold text-text-primary mb-2">Delete Project?</div>
            <div className="text-xs text-text-secondary mb-5">
              "{deleteProjectTarget.name}" will be permanently removed. This cannot be undone.
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteProjectTarget(null)} className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleDeleteProject} className="px-4 py-2 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Camp Modal ───────────────────────────────────────────────── */}
      {editCamp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[520px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <div className="text-sm font-semibold text-text-primary">Edit Camp Location</div>
                <div className="text-xs text-text-tertiary mt-0.5">{editCamp.name}</div>
              </div>
              <button onClick={() => setEditCamp(null)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Camp Name *</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Latitude *</label>
                  <input type="number" step="0.0001" value={editForm.lat} onChange={e => setEditForm(f => ({ ...f, lat: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Longitude *</label>
                  <input type="number" step="0.0001" value={editForm.lng} onChange={e => setEditForm(f => ({ ...f, lng: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Arrival Date *</label>
                  <input type="date" value={editForm.arrivalDate} onChange={e => setEditForm(f => ({ ...f, arrivalDate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Departure Date *</label>
                  <input type="date" value={editForm.departureDate} onChange={e => setEditForm(f => ({ ...f, departureDate: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Camp["status"] }))} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="next">Next</option>
                  <option value="planned">Planned</option>
                  <option value="past">Past</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setEditCamp(null)} className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleSaveEditCamp} disabled={!editForm.name || !editForm.lat || !editForm.lng || !editForm.arrivalDate || !editForm.departureDate}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Camp Modal ────────────────────────────────────────────────── */}
      {showAddCamp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[520px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <div className="text-sm font-semibold text-text-primary">Add Camp Location</div>
                <div className="text-xs text-text-tertiary mt-0.5">Add a new camp to the season schedule</div>
              </div>
              <button onClick={() => { setShowAddCamp(false); setCampForm(BLANK_CAMP); }} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Camp Name *</label>
                <input type="text" value={campForm.name} onChange={e => setCampForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Camp Hearst South" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Latitude *</label>
                  <input type="number" step="0.0001" value={campForm.lat} onChange={e => setCampForm(f => ({ ...f, lat: e.target.value }))} placeholder="e.g. 49.1234" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Longitude *</label>
                  <input type="number" step="0.0001" value={campForm.lng} onChange={e => setCampForm(f => ({ ...f, lng: e.target.value }))} placeholder="e.g. -83.4567" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Arrival Date *</label>
                  <input type="date" value={campForm.arrivalDate} onChange={e => setCampForm(f => ({ ...f, arrivalDate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">Departure Date *</label>
                  <input type="date" value={campForm.departureDate} onChange={e => setCampForm(f => ({ ...f, departureDate: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Status</label>
                <select value={campForm.status} onChange={e => setCampForm(f => ({ ...f, status: e.target.value as Camp["status"] }))} className={inputCls}>
                  <option value="planned">Planned</option>
                  <option value="next">Next</option>
                  <option value="active">Active</option>
                  <option value="past">Past</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Notes</label>
                <textarea value={campForm.notes} onChange={e => setCampForm(f => ({ ...f, notes: e.target.value }))} placeholder="Access route, special requirements, etc." rows={3}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => { setShowAddCamp(false); setCampForm(BLANK_CAMP); }} className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleAddCamp} disabled={!campForm.name || !campForm.lat || !campForm.lng || !campForm.arrivalDate || !campForm.departureDate}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Add Camp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Move Modal ───────────────────────────────────────────── */}
      {showMove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-xl w-[460px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <div className="text-sm font-semibold text-text-primary">Schedule Camp Move</div>
                <div className="text-xs text-text-tertiary mt-0.5">Update departure and next arrival dates</div>
              </div>
              <button onClick={() => setShowMove(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Camp to Move From</label>
                <select value={moveForm.campId} onChange={e => setMoveForm(f => ({ ...f, campId: e.target.value }))} className={inputCls}>
                  <option value="">Select camp…</option>
                  {camps.filter(c => c.status !== "past").map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">New Departure Date *</label>
                <input type="date" value={moveForm.newDepartureDate} onChange={e => setMoveForm(f => ({ ...f, newDepartureDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Next Camp Arrival Date <span className="text-text-tertiary font-normal">(optional)</span></label>
                <input type="date" value={moveForm.nextArrivalDate} onChange={e => setMoveForm(f => ({ ...f, nextArrivalDate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1">Move Notes</label>
                <textarea value={moveForm.notes} onChange={e => setMoveForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for change, crew instructions, etc." rows={2}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowMove(false)} className="px-4 py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleScheduleMove} disabled={!moveForm.campId || !moveForm.newDepartureDate}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--color-warning)", color: "var(--color-primary-deep)" }}>
                ⇄ Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-xs font-medium text-text-primary flex items-center gap-2">
          <span style={{ color: "var(--color-primary)" }}>✓</span>
          {toast}
        </div>
      )}

    </div>
  );
}
