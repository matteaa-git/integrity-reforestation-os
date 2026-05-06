"use client";

import { useState } from "react";
import type { Employee } from "@/app/admin/page";
import { saveRecord } from "@/lib/adminDb";
import { EMPLOYEES_2026, assignCrewBosses2026 } from "@/lib/employeeSeed2026";

type SortField = "name" | "role" | "department" | "startDate" | "status";

const STATUS_BADGE: Record<Employee["status"], { label: string; style: React.CSSProperties }> = {
  active:   { label: "Active",   style: { background: "rgba(57,222,139,0.12)", color: "var(--color-primary)" } },
  inactive: { label: "Inactive", style: { background: "rgba(0,0,0,0.05)", color: "var(--color-text-tertiary)" } },
  onleave:  { label: "On Leave", style: { background: "rgba(251,183,0,0.12)", color: "var(--color-warning)" } },
};

const DEPT_STYLE: Record<string, React.CSSProperties> = {
  "Operations":       { background: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  "Health & Safety":  { background: "rgba(239,68,68,0.1)",  color: "#ef4444" },
  "Field Operations": { background: "rgba(57,222,139,0.1)", color: "var(--color-primary)" },
  "Human Resources":  { background: "rgba(168,85,247,0.1)", color: "#a855f7" },
  "Logistics":        { background: "rgba(249,115,22,0.1)", color: "#f97316" },
  "Camp Services":    { background: "rgba(20,184,166,0.1)", color: "#14b8a6" },
};

const DEPARTMENTS = ["Operations", "Field Operations", "Health & Safety", "Human Resources", "Logistics", "Camp Services"];

function genId(employees: Employee[]) {
  const nums = employees.map((e) => parseInt(e.id.replace("emp-", ""), 10)).filter(Boolean);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `emp-${String(next).padStart(3, "0")}`;
}

function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

interface EmployeeFormState {
  name: string; role: string; department: string;
  email: string; phone: string; status: Employee["status"];
  streetAddress: string; city: string; province: string;
  crewBoss: string; dlClass: string; sin: string; workPermit: string;
  emergencyContactName: string; emergencyContactPhone: string; emergencyContactEmail: string;
  bankAccountNumber: string; bankTransitNumber: string; bankInstitutionNumber: string; bankName: string;
  employeeNumber: string;
}

const EMPTY_FORM: EmployeeFormState = {
  name: "", role: "", department: "Field Operations",
  email: "", phone: "", status: "active",
  streetAddress: "", city: "", province: "ON",
  crewBoss: "", dlClass: "", sin: "", workPermit: "",
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactEmail: "",
  bankAccountNumber: "", bankTransitNumber: "", bankInstitutionNumber: "", bankName: "",
  employeeNumber: "",
};

interface EmployeeTableProps {
  employees: Employee[];
  searchQuery: string;
  onSelectEmployee: (emp: Employee) => void;
  onAddEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onUpdateEmployee: (emp: Employee) => void;
  userRole?: string;
  userName?: string;
}

export default function EmployeeTable({
  employees, searchQuery, onSelectEmployee,
  onAddEmployee, onDeleteEmployee, onUpdateEmployee,
  userRole = "admin", userName = "",
}: EmployeeTableProps) {
  const isCrewBoss = userRole === "crew_boss";
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<Employee["status"] | "all">("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(emp: Employee, e: React.MouseEvent) {
    e.stopPropagation();
    setEditTarget(emp);
    setForm({
      name: emp.name, role: emp.role, department: emp.department,
      email: emp.email, phone: emp.phone, status: emp.status,
      streetAddress: emp.streetAddress ?? "", city: emp.city ?? "", province: emp.province ?? "ON",
      crewBoss: emp.crewBoss ?? "", dlClass: emp.dlClass ?? "",
      sin: emp.sin ?? "", workPermit: emp.workPermit ?? "",
      emergencyContactName: emp.emergencyContactName ?? "",
      emergencyContactPhone: emp.emergencyContactPhone ?? "",
      emergencyContactEmail: emp.emergencyContactEmail ?? "",
      bankAccountNumber: emp.bankAccountNumber ?? "",
      bankTransitNumber: emp.bankTransitNumber ?? "",
      bankInstitutionNumber: emp.bankInstitutionNumber ?? "",
      bankName: emp.bankName ?? "",
      employeeNumber: emp.employeeNumber ?? "",
    });
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) return;
    if (editTarget) {
      onUpdateEmployee({ ...editTarget, ...form, avatar: initials(form.name) });
      showToast(`${form.name} updated`);
    } else {
      onAddEmployee({
        id: genId(employees), ...form,
        avatar: initials(form.name), startDate: new Date().toISOString().slice(0, 10),
      });
      showToast(`${form.name} added`);
    }
    setShowModal(false);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteConfirm(id);
  }

  function confirmDelete() {
    if (deleteConfirm) {
      const emp = employees.find((e) => e.id === deleteConfirm);
      onDeleteEmployee(deleteConfirm);
      showToast(`${emp?.name ?? "Employee"} removed`);
      setDeleteConfirm(null);
    }
  }

  async function handleImport2026() {
    setImporting(true);
    const existingEmails = new Set(employees.map(e => e.email.toLowerCase()));
    const existingIds    = new Set(employees.map(e => e.id));
    let added = 0;

    // Full roster import (deduped by email)
    for (const emp of EMPLOYEES_2026) {
      if (!existingEmails.has(emp.email.toLowerCase())) {
        await saveRecord("employees", emp);
        onAddEmployee(emp);
        existingEmails.add(emp.email.toLowerCase());
        existingIds.add(emp.id);
        added++;
      }
    }

    // Hard-coded patch for the 8 employees that were added after the original import.
    // Uses ID check so it works even if email dedup above missed them.
    const patch: import("@/app/admin/page").Employee[] = [
      { id: "s26-056", name: "Brendan Donald McKenzie", role: "Tree Planter", department: "Field Operations", email: "brendanmckenzie95@gmail.com", phone: "2896962991", status: "active", startDate: "2026-05-01", avatar: "BM", city: "St. Catharines", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "529876583", dlClass: "", firstAid: "No", emergencyContactName: "Tafean Williston", emergencyContactPhone: "2896962991", emergencyContactEmail: "", bankName: "Tangerine", bankInstitutionNumber: "614", bankTransitNumber: "00152", bankAccountNumber: "4016978907", streetAddress: "111 Fourth Ave #12" },
      { id: "s26-057", name: "Benjamin Richard Leigh Ruben Mitchell", role: "Tree Planter", department: "Field Operations", email: "footballben02@gmail.com", phone: "3439989232", status: "active", startDate: "2026-05-01", avatar: "BM", city: "Carleton Place", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "566602470", dlClass: "G2", firstAid: "No", emergencyContactName: "Melissa Mitchell", emergencyContactPhone: "6132579232", emergencyContactEmail: "missym_8@hotmail.com", bankName: "Royal Bank of Canada", bankInstitutionNumber: "003", bankTransitNumber: "00842", bankAccountNumber: "5098215", streetAddress: "124 William Street" },
      { id: "s26-058", name: "James Stephen Samhaber", role: "Tree Planter", department: "Field Operations", email: "james.samhaber@gmail.com", phone: "6137255987", status: "active", startDate: "2026-05-01", avatar: "JS", city: "Ottawa", province: "ON", crewBoss: "Adam Deruyte", sin: "533074936", dlClass: "G", firstAid: "No", emergencyContactName: "Bruce Samhaber", emergencyContactPhone: "6132976961", emergencyContactEmail: "Bruce.samhaber@gmail.com", bankName: "Scotiabank", bankInstitutionNumber: "002", bankTransitNumber: "20396", bankAccountNumber: "0279927", streetAddress: "112 Kenora Street" },
      { id: "s26-059", name: "Matthew Byrne Colas", role: "Tree Planter", department: "Field Operations", email: "matthewcolas777@gmail.com", phone: "6479695268", status: "active", startDate: "2026-05-01", avatar: "MC", city: "Mississauga", province: "ON", crewBoss: "Richard Jackson Gattesco", sin: "551437353", dlClass: "G", firstAid: "No", emergencyContactName: "Rosemary Colas", emergencyContactPhone: "4169045268", emergencyContactEmail: "roseandalexcolas@gmail.com", bankName: "Wealthsimple", bankInstitutionNumber: "703", bankTransitNumber: "00001", bankAccountNumber: "31260821", streetAddress: "448 Aqua Drive" },
      { id: "s26-060", name: "Mouhamadoul Moustapha Ndoye", role: "Tree Planter", department: "Field Operations", email: "moustaphandoye737@gmail.com", phone: "2638812093", status: "active", startDate: "2026-05-01", avatar: "MN", city: "Gatineau", province: "QC", crewBoss: "Richard Jackson Gattesco", sin: "969205913", dlClass: "", firstAid: "No", emergencyContactName: "Abdoul Aziz Lam", emergencyContactPhone: "3435532104", emergencyContactEmail: "Axiloc2003@gmail.com", bankName: "Desjardins", bankInstitutionNumber: "829", bankTransitNumber: "00107", bankAccountNumber: "0619213", streetAddress: "A-18 Rue Demontigny" },
      { id: "s26-061", name: "Noah Doell", role: "Tree Planter", department: "Field Operations", email: "noahdoell041@gmail.com", phone: "6132502743", status: "active", startDate: "2026-05-01", avatar: "ND", city: "Peterborough", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "599315157", dlClass: "G", firstAid: "No", emergencyContactName: "Carley Doell", emergencyContactPhone: "6138594881", emergencyContactEmail: "cdoell44@gmail.com", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "01672", bankAccountNumber: "5185707", streetAddress: "28A Springbrook Drive" },
      { id: "s26-062", name: "Real Bain", role: "Tree Planter", department: "Field Operations", email: "rayraybain001@gmail.com", phone: "6477248941", status: "active", startDate: "2026-05-01", avatar: "RB", city: "Toronto", province: "ON", crewBoss: "Richard Jackson Gattesco", sin: "552450926", dlClass: "", firstAid: "No", emergencyContactName: "Nancy Patel", emergencyContactPhone: "6476808784", emergencyContactEmail: "Onsitehealth@rogers.com", bankName: "RBC", bankInstitutionNumber: "003", bankTransitNumber: "06352", bankAccountNumber: "5094370", streetAddress: "225 Gladstone Avenue" },
      { id: "s26-063", name: "Sebastian Candela", role: "Tree Planter", department: "Field Operations", email: "sebicand@gmail.com", phone: "6138934636", status: "active", startDate: "2026-05-01", avatar: "SC", city: "Kingston", province: "ON", crewBoss: "Jolissa Lonsberry", sin: "569796881", dlClass: "G", firstAid: "No", emergencyContactName: "Rudy Candela", emergencyContactPhone: "6135442658", emergencyContactEmail: "candelar@limestone.on.ca", bankName: "TD Bank", bankInstitutionNumber: "004", bankTransitNumber: "01392", bankAccountNumber: "6710220", streetAddress: "46 Mowat Ave" },
    ];
    for (const emp of patch) {
      if (!existingIds.has(emp.id)) {
        await saveRecord("employees", emp);
        onAddEmployee(emp);
        added++;
      }
    }

    setImporting(false);
    showToast(added > 0 ? `Imported ${added} employee${added !== 1 ? "s" : ""} from 2026 onboarding forms` : `All employees already in the system (prop count: ${employees.length}, ids checked: ${existingIds.size})`);
  }

  async function handleAssignCrews() {
    setAssigning(true);
    // Build email → crew boss map from CREW_ASSIGNMENTS
    const emailToBoss: Record<string, string> = {
      // Jolissa Lonsberry
      "scoutbroughton@gmail.com": "Jolissa Lonsberry",
      "emapab@gmail.com": "Jolissa Lonsberry",
      "calebgonsalves222@gmail.com": "Jolissa Lonsberry",
      "gaetaneallepuz@gmail.com": "Jolissa Lonsberry",
      "qamemmer@gmail.com": "Jolissa Lonsberry",
      "aidancliche@gmail.com": "Jolissa Lonsberry",
      "sebjag1504@gmail.com": "Jolissa Lonsberry",
      "antoyne1234@gmail.com": "Jolissa Lonsberry",
      "jordantay203@gmail.com": "Jolissa Lonsberry",
      "cheelijahjames@gmail.com": "Jolissa Lonsberry",
      "keona8@rocketmail.com": "Jolissa Lonsberry",
      "brandyw0399@gmail.com": "Jolissa Lonsberry",
      "brendanmckenzie95@gmail.com": "Jolissa Lonsberry",
      "footballben02@gmail.com": "Jolissa Lonsberry",
      "noahdoell041@gmail.com": "Jolissa Lonsberry",
      "sebicand@gmail.com": "Jolissa Lonsberry",
      // Richard Jackson Gattesco
      "malcolmcowley005@gmail.com": "Richard Jackson Gattesco",
      "fanshiko@gmail.com": "Richard Jackson Gattesco",
      "05dipper@gmail.com": "Richard Jackson Gattesco",
      "blusimon78@gmail.com": "Richard Jackson Gattesco",
      "legenderdan@gmail.com": "Richard Jackson Gattesco",
      "brounath772@gmail.com": "Richard Jackson Gattesco",
      "stephaniemcgee160@gmail.com": "Richard Jackson Gattesco",
      "jamesgattesco6@gmail.com": "Richard Jackson Gattesco",
      "chloemenard24@gmail.com": "Richard Jackson Gattesco",
      "forrestcurrie.fc@gmail.com": "Richard Jackson Gattesco",
      "cheansley5@gmail.com": "Richard Jackson Gattesco",
      "matthewcolas777@gmail.com": "Richard Jackson Gattesco",
      "moustaphandoye737@gmail.com": "Richard Jackson Gattesco",
      "rayraybain001@gmail.com": "Richard Jackson Gattesco",
      "neulandchristoph@gmail.com": "Richard Jackson Gattesco",
      // Lucas James Watson
      "aidan.mcdonald21@gmail.com": "Lucas James Watson",
      "ginger.anne.72@gmail.com": "Lucas James Watson",
      "orlykanyinda@gmail.com": "Lucas James Watson",
      "mawauwany@gmail.com": "Lucas James Watson",
      "michaelgrivich6@gmail.com": "Lucas James Watson",
      "haydenhudsoncox@gmail.com": "Lucas James Watson",
      "charliesylver@gmail.com": "Lucas James Watson",
      "watson14finn@gmail.com": "Lucas James Watson",
      "zachdurham80@icloud.com": "Lucas James Watson",
      "benben.starman@gmail.com": "Lucas James Watson",
      "mattbellmrb@gmail.com": "Lucas James Watson",
      // Adam Deruyte
      "davente563@gmail.com": "Adam Deruyte",
      "miahtretter46@gmail.com": "Adam Deruyte",
      "evan.macdougall6@gmail.com": "Adam Deruyte",
      "tylergallant2858@gmail.com": "Adam Deruyte",
      "ali.ga010203@gmail.com": "Adam Deruyte",
      "1diego.gonz@gmail.com": "Adam Deruyte",
      "brittneyshanks432@gmail.com": "Adam Deruyte",
      "bentholmes05@gmail.com": "Adam Deruyte",
      "fpd.cameron@gmail.com": "Adam Deruyte",
      "ellawilliamson03@gmail.com": "Adam Deruyte",
      "djorbobakhit@gmail.com": "Adam Deruyte",
      "ethanwildrobin@gmail.com": "Adam Deruyte",
      "speicherjoey@gmail.com": "Adam Deruyte",
      "james.samhaber@gmail.com": "Adam Deruyte",
    };

    let updated = 0;
    for (const emp of employees) {
      const bossName = emailToBoss[emp.email.toLowerCase()];
      if (bossName && emp.crewBoss !== bossName) {
        const updatedEmp = { ...emp, crewBoss: bossName };
        await saveRecord("employees", updatedEmp);
        onUpdateEmployee(updatedEmp);
        updated++;
      }
    }
    setAssigning(false);
    showToast(updated > 0 ? `Assigned crew bosses for ${updated} employee${updated !== 1 ? "s" : ""}` : "All crew assignments already up to date");
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const departments = Array.from(new Set(employees.map((e) => e.department)));

  const filtered = employees
    .filter((e) => {
      if (isCrewBoss && e.crewBoss?.trim().toLowerCase() !== userName.trim().toLowerCase()) return false;
      const q = searchQuery.toLowerCase();
      if (q && !e.name.toLowerCase().includes(q) && !e.role.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (deptFilter !== "all" && e.department !== deptFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      return a[sortField] < b[sortField] ? -mult : a[sortField] > b[sortField] ? mult : 0;
    });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-text-tertiary opacity-30 ml-1">↕</span>;
    return <span className="text-primary ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const fieldCls = "w-full text-xs border border-border rounded-lg px-3 py-2 bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50";

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total",   value: employees.length,                                         style: { color: "var(--color-text-primary)" } },
          { label: "Active",  value: employees.filter(e => e.status === "active").length,       style: { color: "var(--color-primary)" } },
          { label: "On Leave",value: employees.filter(e => e.status === "onleave").length,      style: { color: "var(--color-warning)" } },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">{s.label}</div>
            <div className="text-xl font-bold mt-0.5" style={s.style}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="text-xs text-text-tertiary">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
        <div className="flex-1" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Employee["status"] | "all")}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="onleave">On Leave</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-surface text-text-secondary focus:outline-none">
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {!isCrewBoss && (
          <>
            <button onClick={handleImport2026} disabled={importing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-primary/40 transition-all disabled:opacity-50">
              {importing ? "Importing…" : "↓ Import 2026 Roster"}
            </button>
            <button onClick={handleAssignCrews} disabled={assigning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-primary/40 transition-all disabled:opacity-50">
              {assigning ? "Assigning…" : "◉ Assign Crew Bosses"}
            </button>
            <button onClick={openAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:opacity-90"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
              + Add Employee
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {([
                { field: "name" as SortField, label: "Employee" },
                { field: "role" as SortField, label: "Role" },
                { field: "department" as SortField, label: "Department" },
                { field: "startDate" as SortField, label: "Location" },
                { field: "status" as SortField, label: "Status" },
              ] as { field: SortField; label: string }[]).map((col) => (
                <th key={col.field} onClick={() => handleSort(col.field)}
                  className="text-left px-4 py-2.5 font-semibold text-text-tertiary uppercase tracking-wide text-[10px] cursor-pointer hover:text-text-secondary select-none">
                  {col.label}<SortIcon field={col.field} />
                </th>
              ))}
              <th className="px-4 py-2.5 text-left font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">Crew Boss</th>
              <th className="px-4 py-2.5 text-right font-semibold text-text-tertiary uppercase tracking-wide text-[10px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {filtered.map((emp) => {
              const badge = STATUS_BADGE[emp.status];
              const deptStyle = DEPT_STYLE[emp.department] ?? { background: "rgba(0,0,0,0.05)", color: "var(--color-text-secondary)" };
              return (
                <tr key={emp.id} onClick={() => onSelectEmployee(emp)}
                  className="hover:bg-surface-secondary transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0"
                        style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
                        {emp.avatar}
                      </div>
                      <div>
                        <div className="font-semibold text-text-primary">{emp.name}</div>
                        <div className="text-[11px] text-text-tertiary">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{emp.role}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={deptStyle}>
                      {emp.department}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{emp.city ? `${emp.city}, ${emp.province}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={badge.style}>
                      {badge.label}
                    </span>
                  </td>
                  {!isCrewBoss && (
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {(() => {
                        const crewBosses = employees.filter(e =>
                          e.role.toLowerCase().includes("crew boss") || e.role.toLowerCase().includes("supervisor")
                        );
                        return (
                          <select
                            value={emp.crewBoss ?? ""}
                            onChange={e => {
                              e.stopPropagation();
                              onUpdateEmployee({ ...emp, crewBoss: e.target.value });
                            }}
                            className="text-[11px] border border-border rounded-lg px-2 py-1 bg-surface-secondary text-text-secondary focus:outline-none focus:border-primary/50 max-w-[140px]"
                          >
                            <option value="">— unassigned —</option>
                            {crewBosses.map(cb => (
                              <option key={cb.id} value={cb.name}>{cb.name}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => onSelectEmployee(emp)} className="text-[11px] text-primary hover:underline font-medium">View</button>
                      {!isCrewBoss && (
                        <>
                          <span className="text-border">|</span>
                          <button onClick={(e) => openEdit(emp, e)} className="text-[11px] text-text-secondary hover:text-text-primary">Edit</button>
                          <span className="text-border">|</span>
                          <button onClick={(e) => handleDelete(emp.id, e)} className="text-[11px] text-danger hover:underline">Remove</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-2xl mb-2 opacity-20">◫</div>
            <div className="text-sm font-medium text-text-secondary">No employees found</div>
            <div className="text-xs text-text-tertiary mt-1">Try adjusting your filters or add an employee</div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface">
              <div className="text-sm font-semibold text-text-primary">{editTarget ? "Edit Employee" : "Add Employee"}</div>
              <button onClick={() => setShowModal(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">×</button>
            </div>
            <div className="p-6 space-y-6">

              {/* Personal */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Personal Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Legal Name *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Elizabeth Smith" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Employee ID #</label>
                    <input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} placeholder="e.g. EMP-001" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">SIN</label>
                    <input value={form.sin} onChange={(e) => setForm({ ...form, sin: e.target.value })} placeholder="000-000-000" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Work Permit #</label>
                    <input value={form.workPermit} onChange={(e) => setForm({ ...form, workPermit: e.target.value })} placeholder="If applicable" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Driver's Licence Class</label>
                    <input value={form.dlClass} onChange={(e) => setForm({ ...form, dlClass: e.target.value })} placeholder="G, G2, DZ…" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Employee["status"] })} className={fieldCls}>
                      <option value="active">Active</option>
                      <option value="onleave">On Leave</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Contact Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Email *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone Number</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="416-555-0100" className={fieldCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Street Address</label>
                    <input value={form.streetAddress} onChange={(e) => setForm({ ...form, streetAddress: e.target.value })} placeholder="123 Main St" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">City</label>
                    <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Toronto" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Province</label>
                    <input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="ON" className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* Employment */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Employment Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Job Title *</label>
                    <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Tree Planter" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Department</label>
                    <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={fieldCls}>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Reports To</label>
                    <input value={form.crewBoss} onChange={(e) => setForm({ ...form, crewBoss: e.target.value })} placeholder="Supervisor or crew boss name" className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Emergency Contact</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name</label>
                    <input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="John Smith" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Phone Number</label>
                    <input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="416-555-0199" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Email Address</label>
                    <input type="email" value={form.emergencyContactEmail} onChange={(e) => setForm({ ...form, emergencyContactEmail: e.target.value })} placeholder="contact@example.com" className={fieldCls} />
                  </div>
                </div>
              </div>

              {/* Banking */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">Banking Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Name of Bank</label>
                    <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="TD Bank, RBC…" className={fieldCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Account Number</label>
                    <input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} placeholder="7-digit account number" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Transit Number</label>
                    <input value={form.bankTransitNumber} onChange={(e) => setForm({ ...form, bankTransitNumber: e.target.value })} placeholder="5 digits" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Institution Number</label>
                    <input value={form.bankInstitutionNumber} onChange={(e) => setForm({ ...form, bankInstitutionNumber: e.target.value })} placeholder="3 digits" className={fieldCls} />
                  </div>
                </div>
              </div>

            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={!form.name.trim() || !form.email.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                {editTarget ? "Save Changes" : "Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="text-sm font-semibold text-text-primary mb-2">Remove Employee</div>
            <div className="text-xs text-text-secondary mb-5">
              Are you sure you want to remove <span className="font-semibold text-text-primary">{employees.find((e) => e.id === deleteConfirm)?.name}</span>? This cannot be undone.
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-xs font-medium bg-danger text-white rounded-lg hover:bg-red-600 transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-success text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
