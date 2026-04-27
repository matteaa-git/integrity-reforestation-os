"use client";

import { useEffect, useState } from "react";
import type { AdminSection, Employee } from "@/app/admin/page";
import {
  getAllAssets,
  getAllDocuments,
  getAllProjects,
  getAllRecords,
} from "@/lib/adminDb";

interface AdminDashboardProps {
  employees: Employee[];
  onNavigate: (section: AdminSection) => void;
  onSelectEmployee: (emp: Employee) => void;
}

interface LiveData {
  assetCount: number;
  operationalAssets: number;
  activeProjects: number;
  totalProjects: number;
  totalDocuments: number;
  pendingDocs: number;
  pendingSignatures: number;
  complianceItems: number;
  trainingCerts: number;
  transactions: number;
  camps: number;
}

const SECTION_CARDS: Array<{
  id: AdminSection;
  label: string;
  icon: string;
  group: string;
  desc: string;
  accent?: string;
}> = [
  { id: "employees",      label: "Employees",       icon: "◉", group: "People",            desc: "Profiles & employment records" },
  { id: "payroll",        label: "Payroll & Tax",   icon: "◎", group: "People",            desc: "Pay stubs & tax forms" },
  { id: "operations",     label: "Operations",      icon: "⊕", group: "Field Ops",         desc: "Camps, crews & logistics" },
  { id: "production",     label: "Daily Production",icon: "⬡", group: "Field Ops",         desc: "Planting by crew & species" },
  { id: "projects",       label: "Projects",        icon: "◫", group: "Field Ops",         desc: "Site plans & tender packages" },
  { id: "compliance",     label: "Health & Safety", icon: "☑", group: "Compliance",        desc: "H&S register & incident records" },
  { id: "training",       label: "CVOR Program",    icon: "⚑", group: "Compliance",        desc: "Driver certs & violations" },
  { id: "training-guides",label: "Training Guides", icon: "◈", group: "Compliance",        desc: "Camp & field reference library" },
  { id: "accounting",     label: "Accounting",      icon: "▤", group: "Finance",           desc: "Transactions & expenses" },
  { id: "documents",      label: "Documents",       icon: "◫", group: "Records",           desc: "Agreements & employment records" },
  { id: "signatures",     label: "Signatures",      icon: "✦", group: "Records",           desc: "E-signature workflows" },
  { id: "media",          label: "Media Library",   icon: "▣", group: "Records",           desc: "Field photos & videos" },
  { id: "assets",         label: "Fleet & Assets",  icon: "◈", group: "Fleet",             desc: "Vehicles, trailers & equipment", accent: "primary" },
];

const STATUS_ITEMS = [
  { label: "Season",    value: "Spring 2026",     note: "Pre-season" },
  { label: "Phase",     value: "Mobilizing",      note: "Crew assembly underway" },
  { label: "Region",    value: "BC Interior",     note: "Primary operating area" },
];

export default function AdminDashboard({ employees, onNavigate, onSelectEmployee }: AdminDashboardProps) {
  const [live, setLive] = useState<LiveData | null>(null);

  useEffect(() => {
    async function load() {
      const [assets, docs, projects, sigs, compliance, certs, transactions, camps] = await Promise.all([
        getAllAssets(),
        getAllDocuments(),
        getAllProjects(),
        getAllRecords<{ id: string; status?: string }>("signature_requests"),
        getAllRecords<{ id: string }>("compliance_items"),
        getAllRecords<{ id: string }>("training_certs"),
        getAllRecords<{ id: string }>("transactions"),
        getAllRecords<{ id: string }>("camps"),
      ]);

      setLive({
        assetCount: assets.length,
        operationalAssets: assets.filter(a => a.status === "operational").length,
        activeProjects: projects.filter(p => p.status === "active" || p.status === "tendering").length,
        totalProjects: projects.length,
        totalDocuments: docs.length,
        pendingDocs: docs.filter(d => d.status === "pending" || d.status === "draft").length,
        pendingSignatures: sigs.filter(s => s.status === "pending" || !s.status).length,
        complianceItems: compliance.length,
        trainingCerts: certs.length,
        transactions: transactions.length,
        camps: camps.length,
      });
    }
    load();
  }, []);

  const activeEmployees = employees.filter(e => e.status === "active");
  const onLeaveEmployees = employees.filter(e => e.status === "onleave");
  const totalEmps = employees.length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const kpis = [
    {
      label: "Total Employees",
      value: totalEmps === 0 ? "—" : totalEmps.toString(),
      sub: totalEmps === 0 ? "No records yet" : `${activeEmployees.length} active · ${onLeaveEmployees.length} on leave`,
      icon: "◉",
      section: "employees" as AdminSection,
      color: "var(--color-primary)",
    },
    {
      label: "Fleet Assets",
      value: live ? live.assetCount.toString() : "…",
      sub: live ? `${live.operationalAssets} operational` : "Loading…",
      icon: "◈",
      section: "assets" as AdminSection,
      color: "var(--color-accent-gold)",
    },
    {
      label: "Active Projects",
      value: live ? (live.activeProjects || "—").toString() : "…",
      sub: live ? (live.totalProjects > 0 ? `${live.totalProjects} total projects` : "No projects yet") : "Loading…",
      icon: "◫",
      section: "projects" as AdminSection,
      color: "var(--color-info)",
    },
    {
      label: "Documents",
      value: live ? (live.totalDocuments || "—").toString() : "…",
      sub: live ? (live.pendingDocs > 0 ? `${live.pendingDocs} pending` : "All current") : "Loading…",
      icon: "◫",
      section: "documents" as AdminSection,
      color: "var(--color-text-secondary)",
    },
    {
      label: "Pending Signatures",
      value: live ? (live.pendingSignatures > 0 ? live.pendingSignatures.toString() : "—") : "…",
      sub: live ? (live.pendingSignatures > 0 ? "Awaiting review" : "None outstanding") : "Loading…",
      icon: "✦",
      section: "signatures" as AdminSection,
      color: live && live.pendingSignatures > 0 ? "var(--color-warning)" : "var(--color-text-secondary)",
    },
    {
      label: "Compliance Items",
      value: live ? (live.complianceItems || "—").toString() : "…",
      sub: live ? (live.complianceItems > 0 ? `${live.complianceItems} on register` : "Register empty") : "Loading…",
      icon: "☑",
      section: "compliance" as AdminSection,
      color: "var(--color-text-secondary)",
    },
  ];

  // Build alert list from live data
  const alerts: Array<{ type: "warn" | "info" | "ok"; text: string; section: AdminSection }> = [];
  if (live) {
    if (live.pendingSignatures > 0) alerts.push({ type: "warn", text: `${live.pendingSignatures} signature request${live.pendingSignatures > 1 ? "s" : ""} pending review`, section: "signatures" });
    if (live.pendingDocs > 0) alerts.push({ type: "warn", text: `${live.pendingDocs} document${live.pendingDocs > 1 ? "s" : ""} in pending or draft status`, section: "documents" });
    if (live.totalDocuments === 0) alerts.push({ type: "info", text: "No documents on file — upload employment agreements to get started", section: "documents" });
    if (totalEmps === 0) alerts.push({ type: "info", text: "No employee records — add employees before the season begins", section: "employees" });
    if (live.complianceItems === 0) alerts.push({ type: "info", text: "H&S compliance register is empty — add items before field operations", section: "compliance" });
    if (live.camps === 0) alerts.push({ type: "info", text: "No camp assignments on record — configure operations before mobilizing", section: "operations" });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header greeting ───────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] text-text-tertiary font-medium uppercase tracking-widest mb-0.5">{today}</div>
          <h1 className="text-[22px] font-bold text-text-primary leading-tight">
            {greeting}, Matt
          </h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Here's what's happening at Integrity Reforestation.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg border border-border bg-surface text-[11px] font-medium text-text-secondary flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-primary)" }} />
            Spring 2026 · Pre-season
          </div>
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => onNavigate(kpi.section)}
            className="bg-surface rounded-xl border border-border shadow-sm p-4 text-left hover:shadow-md hover:border-border-light transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide leading-tight pr-1">{kpi.label}</span>
              <span className="text-[13px] opacity-40 shrink-0" style={{ color: kpi.color }}>{kpi.icon}</span>
            </div>
            <div className="text-[22px] font-bold leading-none" style={{ color: kpi.color !== "var(--color-text-secondary)" ? kpi.color : "var(--color-text-primary)" }}>
              {kpi.value}
            </div>
            <div className="text-[11px] text-text-tertiary mt-1.5 leading-tight">{kpi.sub}</div>
          </button>
        ))}
      </div>

      {/* ── Alerts + Season Status ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Alerts panel */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">Active Alerts</div>
            <span className="text-[11px] text-text-tertiary">{alerts.length} item{alerts.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="bg-surface rounded-xl border border-border shadow-sm divide-y divide-border-light overflow-hidden">
            {alerts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="text-xl opacity-20 mb-2">☑</div>
                <div className="text-xs font-medium text-text-secondary">No active alerts</div>
                <div className="text-[11px] text-text-tertiary mt-1">Compliance and signature alerts will appear here</div>
              </div>
            ) : alerts.map((alert, i) => (
              <button
                key={i}
                onClick={() => onNavigate(alert.section)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-secondary transition-colors group"
              >
                <span
                  className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                  style={{ background: alert.type === "warn" ? "var(--color-warning)" : alert.type === "ok" ? "var(--color-success)" : "var(--color-info)" }}
                />
                <span className="text-[12px] text-text-secondary flex-1 leading-snug group-hover:text-text-primary transition-colors">{alert.text}</span>
                <span className="text-text-tertiary text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
              </button>
            ))}
          </div>
        </div>

        {/* Season status */}
        <div>
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-3">Season Overview</div>
          <div className="rounded-xl overflow-hidden border border-white/5 shadow-sm"
            style={{ background: "linear-gradient(145deg, var(--color-primary-deep), var(--color-sidebar))" }}>
            <div className="p-4 space-y-3">
              {STATUS_ITEMS.map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">{item.label}</span>
                  <div className="text-right">
                    <div className="text-[12px] font-semibold text-white/85">{item.value}</div>
                    <div className="text-[10px] text-white/40">{item.note}</div>
                  </div>
                </div>
              ))}
              <div className="border-t border-white/8 pt-3 mt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-white/40 font-medium">Season readiness</span>
                  <span className="text-[10px] font-bold" style={{ color: "var(--color-primary)" }}>
                    {live ? Math.round(((live.operationalAssets / Math.max(live.assetCount, 1)) * 100)) : "…"}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: live ? `${(live.operationalAssets / Math.max(live.assetCount, 1)) * 100}%` : "0%",
                      background: "var(--color-primary)"
                    }}
                  />
                </div>
                <div className="text-[10px] text-white/30 mt-1.5">
                  {live ? `${live.operationalAssets} of ${live.assetCount} assets operational` : "Loading fleet data…"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section Quick Access ───────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-3">All Sections</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {SECTION_CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className="bg-surface border border-border rounded-xl p-3.5 text-left hover:border-border-light hover:shadow-md transition-all group"
              style={card.accent === "primary" ? { borderColor: "rgba(57,222,139,0.25)", background: "rgba(57,222,139,0.03)" } : {}}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[14px]"
                  style={{ color: card.accent === "primary" ? "var(--color-primary)" : "var(--color-text-tertiary)", opacity: card.accent === "primary" ? 0.8 : 0.5 }}
                >
                  {card.icon}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-text-tertiary opacity-60">{card.group}</span>
              </div>
              <div className="text-[12px] font-semibold text-text-primary leading-tight">{card.label}</div>
              <div className="text-[10.5px] text-text-tertiary mt-0.5 leading-snug hidden sm:block">{card.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Employee Roster snapshot ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">Employee Roster</div>
          <button
            onClick={() => onNavigate("employees")}
            className="text-[11px] font-medium hover:underline"
            style={{ color: "var(--color-primary)" }}
          >
            View all →
          </button>
        </div>

        {employees.length === 0 ? (
          <div className="bg-surface rounded-xl border border-border shadow-sm px-5 py-8 text-center">
            <div className="text-xl opacity-20 mb-2">◉</div>
            <div className="text-xs font-medium text-text-secondary">No employees on file</div>
            <div className="text-[11px] text-text-tertiary mt-1">Add your first employee to see the roster here</div>
            <button
              onClick={() => onNavigate("employees")}
              className="mt-4 px-4 py-1.5 text-[11px] font-semibold rounded-lg transition-all"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
            >
              + Add Employee
            </button>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="divide-y divide-border-light">
              {employees.slice(0, 10).map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors text-left group"
                >
                  <div
                    className="w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                    style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}
                  >
                    {emp.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-text-primary">{emp.name}</div>
                    <div className="text-[11px] text-text-tertiary">{emp.role}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                      style={
                        emp.status === "active"
                          ? { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" }
                          : emp.status === "onleave"
                          ? { background: "rgba(251,183,0,0.12)", color: "var(--color-warning)" }
                          : { background: "rgba(0,0,0,0.06)", color: "var(--color-text-tertiary)" }
                      }
                    >
                      {emp.status === "onleave" ? "On Leave" : emp.status}
                    </span>
                    {emp.city && (
                      <span className="text-[11px] text-text-tertiary hidden md:block">{emp.city}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {employees.length > 10 && (
              <button
                onClick={() => onNavigate("employees")}
                className="w-full text-center py-3 text-[11px] font-medium hover:bg-surface-secondary transition-colors"
                style={{ color: "var(--color-primary)" }}
              >
                View {employees.length - 10} more employees →
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
