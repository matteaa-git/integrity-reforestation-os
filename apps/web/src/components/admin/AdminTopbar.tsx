"use client";

import type { AdminSection } from "@/app/admin/page";

const SECTION_META: Record<AdminSection, {
  title: string;
  description: string;
  group: string;
  action?: string;
  actionIcon?: string;
}> = {
  dashboard:         { group: "Overview",            title: "Dashboard",           description: "Company operations at a glance" },
  employees:         { group: "People",              title: "Employees",           description: "Profiles, roles, and employment records",       action: "Add Employee",       actionIcon: "+" },
  payroll:           { group: "People",              title: "Payroll & Tax",       description: "Pay stubs, tax forms, and payroll runs",         action: "New Stub",           actionIcon: "+" },
  operations:        { group: "Field Operations",    title: "Operations",          description: "Camps, crews, calendar, and logistics",          action: "Add Camp",           actionIcon: "+" },
  production:        { group: "Field Operations",    title: "Daily Production",    description: "Planting entries by crew and species",           action: "New Entry",          actionIcon: "+" },
  projects:          { group: "Field Operations",    title: "Projects",            description: "Site plans, maps, assessments, and tender packages", action: "New Project",     actionIcon: "+" },
  compliance:        { group: "Compliance & Safety", title: "Health & Safety",     description: "Compliance register, H&S forms, and incident records", action: "Add Item",     actionIcon: "+" },
  training:          { group: "Compliance & Safety", title: "CVOR Program",        description: "Driver certifications, logs, and violations",    action: "Add Record",         actionIcon: "+" },
  "training-guides": { group: "Compliance & Safety", title: "Training Guides",     description: "Camp and field training reference library",      action: "Upload Guide",       actionIcon: "↑" },
  "health-safety":   { group: "Compliance & Safety", title: "H&S Program",         description: "Health and safety documents, forms, and submissions" },
  accounting:        { group: "Finance",             title: "Accounting",          description: "Transactions, expenses, and account balances",   action: "Add Transaction",    actionIcon: "+" },
  documents:         { group: "Records",             title: "Documents",           description: "Agreements, forms, and employment records",      action: "Upload Doc",         actionIcon: "↑" },
  signatures:        { group: "Records",             title: "Signatures",          description: "E-signature workflows and audit trail",          action: "Send for Signature", actionIcon: "✦" },
  media:             { group: "Records",             title: "Media Library",       description: "Photos and videos from field operations",        action: "Upload Media",       actionIcon: "↑" },
  assets:            { group: "Fleet",               title: "Fleet & Assets",      description: "Vehicles, trailers, and equipment registry",     action: "Add Asset",          actionIcon: "+" },
  insurance:         { group: "Fleet",               title: "Insurance",           description: "Policy coverage and exclusions summary" },
  receipts:          { group: "Finance",             title: "Receipts",            description: "Fuel, groceries, and expense receipts",          action: "Add Receipt",        actionIcon: "+" },
  cashflow:          { group: "Finance",             title: "Cash Flow",           description: "Project pricing, revenue, expenses, and cash flow projections" },
  users:             { group: "Admin",               title: "User Management",     description: "Manage user accounts and role permissions",     action: "Invite User",        actionIcon: "+" },
  "my-production":   { group: "My Records",          title: "My Production",       description: "Your planting entries and tree totals by date range" },
  "my-earnings":     { group: "My Records",          title: "My Earnings",         description: "Your pay summary, species breakdown, and vacation pay" },
  "file-ingest":     { group: "Records",             title: "File Ingest",         description: "Drop files to extract data with AI and save to the right place" },
};

interface AdminTopbarProps {
  activeSection: AdminSection;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function AdminTopbar({ activeSection, searchQuery, onSearchChange }: AdminTopbarProps) {
  const meta = SECTION_META[activeSection];
  const today = new Date().toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

  return (
    <header className="shrink-0 bg-surface border-b border-border flex flex-col" style={{ minHeight: "56px" }}>
      <div className="flex items-center h-14 px-6 gap-3">

        {/* ── Breadcrumb + title ─────────────────────────────── */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary hidden sm:block">
            {meta.group}
          </span>
          <span className="text-text-tertiary opacity-30 text-xs hidden sm:block">/</span>
          <span className="text-[13.5px] font-semibold text-text-primary truncate">
            {meta.title}
          </span>
        </div>

        {/* Separator dot */}
        <span className="text-border hidden lg:block">·</span>

        {/* Description */}
        <span className="text-[11px] text-text-tertiary hidden lg:block truncate max-w-xs">
          {meta.description}
        </span>

        <div className="flex-1" />

        {/* Date */}
        <span className="text-[11px] text-text-tertiary hidden md:block font-medium shrink-0">
          {today}
        </span>

        {/* Search */}
        <div className="relative hidden sm:block shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[11px]">⌕</span>
          <input
            type="text"
            placeholder={`Search…`}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs bg-surface-secondary border border-border rounded-lg w-44 text-text-primary placeholder:text-text-tertiary focus:outline-none transition-colors"
            style={{ outline: "none" }}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = "var(--color-primary)"}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = ""}
          />
        </div>

        {/* Notification */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-secondary transition-colors text-text-secondary shrink-0">
          <span className="text-sm">◔</span>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />
        </button>

        {/* Export */}
        <button className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors shrink-0">
          <span className="text-[10px]">↓</span>
          Export
        </button>

        {/* Primary CTA */}
        {meta.action && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all hover:opacity-90 active:scale-[0.98] shrink-0"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
          >
            <span className="text-[11px]">{meta.actionIcon}</span>
            <span className="hidden sm:block whitespace-nowrap">{meta.action}</span>
          </button>
        )}
      </div>

      {/* Brand accent line */}
      <div className="h-[2px]"
        style={{ background: "linear-gradient(90deg, var(--color-primary) 0%, transparent 45%)", opacity: 0.4 }} />
    </header>
  );
}
