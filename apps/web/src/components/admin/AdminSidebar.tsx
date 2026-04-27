"use client";

import type { AdminSection, UserRole } from "@/app/admin/page";
import { ROLE_PERMISSIONS } from "@/lib/roles";

interface NavItem {
  id: AdminSection;
  label: string;
  icon: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin:      "Admin",
  supervisor: "Supervisor",
  crew_boss:  "Crew Boss",
  planter:    "Planter",
};

// All nav groups — filtered per role at render time
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    icon: "⌘",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "▦" },
    ],
  },
  {
    label: "People",
    icon: "◉",
    items: [
      { id: "employees", label: "Employees",    icon: "◉" },
      { id: "payroll",   label: "Payroll & Tax", icon: "◎" },
    ],
  },
  {
    label: "Field Operations",
    icon: "⬡",
    items: [
      { id: "operations", label: "Operations",       icon: "⊕" },
      { id: "production", label: "Daily Production", icon: "⬡" },
      { id: "projects",   label: "Projects",         icon: "◫" },
    ],
  },
  {
    label: "Compliance & Safety",
    icon: "☑",
    items: [
      { id: "compliance",      label: "Health & Safety", icon: "☑" },
      { id: "health-safety",   label: "H&S Program",     icon: "⚕" },
      { id: "training",        label: "CVOR Program",    icon: "⚑" },
      { id: "training-guides", label: "Training Guides", icon: "◈" },
    ],
  },
  {
    label: "Finance",
    icon: "◎",
    items: [
      { id: "accounting", label: "Accounting", icon: "▤" },
      { id: "receipts",   label: "Receipts",   icon: "◱" },
      { id: "cashflow",   label: "Cash Flow",  icon: "◫" },
    ],
  },
  {
    label: "Records",
    icon: "◫",
    items: [
      { id: "file-ingest", label: "File Ingest",   icon: "⇓" },
      { id: "documents",   label: "Documents",     icon: "◫" },
      { id: "signatures",  label: "Signatures",    icon: "✦" },
      { id: "media",       label: "Media Library", icon: "▣" },
    ],
  },
  {
    label: "Fleet",
    icon: "◈",
    items: [
      { id: "assets",    label: "Fleet & Assets", icon: "◈" },
      { id: "insurance", label: "Insurance",      icon: "◎" },
    ],
  },
  {
    label: "Admin",
    icon: "⚙",
    items: [
      { id: "users", label: "User Management", icon: "◉" },
    ],
  },
  {
    label: "My Records",
    icon: "◉",
    items: [
      { id: "my-production", label: "My Production", icon: "⬡" },
      { id: "my-earnings",   label: "My Earnings",   icon: "◎" },
    ],
  },
];

interface AdminSidebarProps {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  userRole: UserRole;
  userName: string;
  userEmail: string;
  onSignOut: () => void;
}

export default function AdminSidebar({
  activeSection, onNavigate, userRole, userName, userEmail, onSignOut
}: AdminSidebarProps) {
  const allowed = ROLE_PERMISSIONS[userRole];
  const initials = userName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "??";

  // Filter groups to only show sections the role can access
  const visibleGroups = NAV_GROUPS
    .map(group => ({ ...group, items: group.items.filter(item => allowed.includes(item.id)) }))
    .filter(group => group.items.length > 0);

  return (
    <aside className="w-56 shrink-0 h-full flex flex-col overflow-hidden"
      style={{ background: "var(--color-sidebar)" }}>

      {/* ── Brand header ──────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 border-b border-white/6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-[13px]"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
            IR
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-white leading-tight tracking-tight">
              Integrity
            </div>
            <div className="text-[10px] font-medium tracking-wide"
              style={{ color: "var(--color-primary)" }}>
              REFORESTATION
            </div>
          </div>
        </div>
        <div className="mt-3 text-[9.5px] text-white/30 leading-relaxed">
          Admin Console · 2026 Season
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5 scrollbar-hide">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] px-2 mb-1.5"
              style={{ color: "var(--color-primary)", opacity: 0.55 }}>
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12.5px] transition-all text-left group"
                    style={isActive ? {
                      background: "var(--color-primary-muted)",
                      color: "var(--color-primary)",
                      fontWeight: 600,
                    } : { color: "rgba(255,255,255,0.52)" }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.88)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.52)";
                      }
                    }}
                  >
                    <span className="w-0.5 h-3.5 rounded-full shrink-0 transition-all"
                      style={{ background: isActive ? "var(--color-primary)" : "transparent" }} />
                    <span className="text-[11px] w-3.5 text-center shrink-0 opacity-70">{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                        style={isActive
                          ? { background: "var(--color-primary)", color: "var(--color-primary-deep)" }
                          : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }
                        }>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Season status strip ───────────────────────────────── */}
      <div className="mx-3 mb-3 rounded-xl p-3 border border-white/6"
        style={{ background: "var(--color-primary-mid)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
            Season Status
          </span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-primary)" }} />
        </div>
        <div className="text-[11px] text-white/70 font-medium">Spring 2026</div>
        <div className="text-[10px] text-white/35 mt-0.5">Pre-season · Mobilizing</div>
      </div>

      {/* ── Mobile preview link ──────────────────────────────── */}
      <div className="mx-3 mb-2 flex gap-1.5">
        <a href="/admin/preview"
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/8"
          style={{ color: "rgba(255,255,255,0.38)" }}>
          <span className="text-[13px]">📱</span>
          <span>Phone Preview</span>
        </a>
        <a href="/admin/mobile"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[11px] transition-colors hover:bg-white/8"
          style={{ color: "rgba(255,255,255,0.25)" }}
          title="Open mobile view">
          ⇗
        </a>
      </div>

      {/* ── User footer ───────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-white/6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold text-white/85 truncate">{userName || userEmail}</div>
            <div className="text-[9px] text-white/35 font-medium uppercase tracking-wide">
              {ROLE_LABELS[userRole]}
            </div>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            className="w-6 h-6 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors text-xs">
            ⎋
          </button>
        </div>
      </div>
    </aside>
  );
}
