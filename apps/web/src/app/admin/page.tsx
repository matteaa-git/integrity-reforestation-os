"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { seedEmployeesData, getAllEmployees, saveRecord, deleteRecord } from "@/lib/adminDb";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import EmployeeTable from "@/components/admin/EmployeeTable";
import EmployeeProfile from "@/components/admin/EmployeeProfile";
import DocumentCenter from "@/components/admin/DocumentCenter";
import SignatureCenter from "@/components/admin/SignatureCenter";
import TrainingSafetyCenter from "@/components/admin/TrainingSafetyCenter";
import ComplianceCenter from "@/components/admin/ComplianceCenter";
import PayrollTaxCenter from "@/components/admin/PayrollTaxCenter";
import AccountingCenter from "@/components/admin/AccountingCenter";
import ProjectsCenter from "@/components/admin/ProjectsCenter";
import MediaLibrary from "@/components/admin/MediaLibrary";
import OperationsCenter from "@/components/admin/OperationsCenter";
import DailyProductionReport from "@/components/admin/DailyProductionReport";
import AssetsCenter from "@/components/admin/AssetsCenter";
import TrainingGuidesCenter from "@/components/admin/TrainingGuidesCenter";
import InsuranceCenter from "@/components/admin/InsuranceCenter";
import ReceiptsCenter from "@/components/admin/ReceiptsCenter";
import ProjectCashFlowCenter from "@/components/admin/ProjectCashFlowCenter";
import UserManagement from "@/components/admin/UserManagement";
import PlanterPortal from "@/components/admin/PlanterPortal";
import HSProgramCenter from "@/components/admin/HSProgramCenter";
import FileIngest from "@/components/admin/FileIngest";
import { type UserRole, type AdminSection, ROLE_PERMISSIONS } from "@/lib/roles";

export type { UserRole, AdminSection };

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "onleave";
  startDate: string;
  avatar: string;
  streetAddress?: string;
  city?: string;
  province?: string;
  crewBoss?: string;
  firstAid?: string;
  dlClass?: string;
  sin?: string;
  workPermit?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  bankAccountNumber?: string;
  bankTransitNumber?: string;
  bankInstitutionNumber?: string;
  bankName?: string;
  employeeNumber?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRole, setUserRole] = useState<UserRole>("crew_boss");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  // Load auth session and role
  useEffect(() => {
    async function loadSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      // Use security-definer function to bypass RLS recursion issues
      const { data: roleData } = await supabase.rpc("get_my_role");
      const role = (roleData as UserRole) ?? "crew_boss";

      // Fetch display name/email separately
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      setUserRole(role);
      setUserEmail(profile?.email ?? user.email ?? "");
      setUserName(profile?.full_name ?? user.email ?? "");

      // Redirect mobile/tablet users to mobile view
      if (window.innerWidth < 1024) {
        router.replace("/admin/mobile");
        return;
      }

      // Default section based on role
      const allowed = ROLE_PERMISSIONS[role];
      if (!allowed.includes("dashboard")) setActiveSection(allowed[0]);

      setAuthLoading(false);
    }
    loadSession();
  }, []);

  // Redirect if user navigates to a forbidden section
  function handleNavigate(section: AdminSection) {
    const allowed = ROLE_PERMISSIONS[userRole];
    if (allowed.includes(section)) setActiveSection(section);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  useEffect(() => {
    seedEmployeesData().then(() =>
      getAllEmployees().then((all) =>
        setEmployees((all as Employee[]).sort((a, b) => a.name.localeCompare(b.name)))
      )
    );
  }, []);

  function handleSelectEmployee(emp: Employee) {
    if (ROLE_PERMISSIONS[userRole].includes("employees")) {
      setSelectedEmployee(emp);
      setActiveSection("employees");
    }
  }

  function handleBackToList() {
    setSelectedEmployee(null);
  }

  function handleAddEmployee(emp: Employee) {
    setEmployees((prev) => [...prev, emp].sort((a, b) => a.name.localeCompare(b.name)));
    saveRecord("employees", emp);
  }

  function handleDeleteEmployee(id: string) {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    deleteRecord("employees", id);
  }

  function handleUpdateEmployee(updated: Employee) {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    if (selectedEmployee?.id === updated.id) setSelectedEmployee(updated);
    saveRecord("employees", updated);
  }

  function renderContent() {
    if (activeSection === "employees" && selectedEmployee) {
      return (
        <EmployeeProfile
          employee={selectedEmployee}
          employees={employees}
          onBack={handleBackToList}
          onUpdateEmployee={handleUpdateEmployee}
        />
      );
    }

    switch (activeSection) {
      case "dashboard":
        return (
          <AdminDashboard
            employees={employees}
            onNavigate={setActiveSection}
            onSelectEmployee={handleSelectEmployee}
          />
        );
      case "employees":
        return (
          <EmployeeTable
            employees={employees}
            searchQuery={searchQuery}
            onSelectEmployee={handleSelectEmployee}
            onAddEmployee={handleAddEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onUpdateEmployee={handleUpdateEmployee}
          />
        );
      case "documents":
        return <DocumentCenter employees={employees} />;
      case "signatures":
        return <SignatureCenter employees={employees} />;
      case "training":
        return <TrainingSafetyCenter employees={employees} />;
      case "compliance":
        return <ComplianceCenter employees={employees} />;
      case "payroll":
        return <PayrollTaxCenter employees={employees} />;
      case "accounting":
        return <AccountingCenter />;
      case "projects":
        return <ProjectsCenter />;
      case "cashflow":
        return <ProjectCashFlowCenter />;
      case "media":
        return <MediaLibrary employees={employees} />;
      case "operations":
        return <OperationsCenter employees={employees} />;
      case "production":
        return <DailyProductionReport employees={employees} userRole={userRole} />;
      case "assets":
        return <AssetsCenter />;
      case "training-guides":
        return <TrainingGuidesCenter />;
      case "insurance":
        return <InsuranceCenter />;
      case "receipts":
        return <ReceiptsCenter userRole={userRole} userName={userName} />;
      case "users":
        return <UserManagement />;
      case "my-production":
        return <PlanterPortal tab="production" />;
      case "my-earnings":
        return <PlanterPortal tab="earnings" />;
      case "health-safety":
        return <HSProgramCenter />;
      case "file-ingest":
        return <FileIngest />;
      default:
        return null;
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-secondary">
        <div className="text-xs text-text-tertiary">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-surface-secondary">
      <AdminSidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        userRole={userRole}
        userName={userName}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminTopbar
          activeSection={activeSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <div className="flex-1 overflow-y-auto">{renderContent()}</div>
      </div>
    </div>
  );
}
