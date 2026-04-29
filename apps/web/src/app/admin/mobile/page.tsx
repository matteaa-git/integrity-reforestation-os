"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { seedEmployeesData, getAllEmployees, saveRecord, deleteRecord } from "@/lib/adminDb";
import { type UserRole, ROLE_PERMISSIONS } from "@/lib/roles";

import MobileAdminShell      from "@/components/admin/MobileAdminShell";
import AdminDashboard         from "@/components/admin/AdminDashboard";
import EmployeeTable          from "@/components/admin/EmployeeTable";
import EmployeeProfile        from "@/components/admin/EmployeeProfile";
import DocumentCenter         from "@/components/admin/DocumentCenter";
import SignatureCenter        from "@/components/admin/SignatureCenter";
import TrainingSafetyCenter   from "@/components/admin/TrainingSafetyCenter";
import ComplianceCenter       from "@/components/admin/ComplianceCenter";
import PayrollTaxCenter       from "@/components/admin/PayrollTaxCenter";
import AccountingCenter       from "@/components/admin/AccountingCenter";
import ProjectsCenter         from "@/components/admin/ProjectsCenter";
import MediaLibrary           from "@/components/admin/MediaLibrary";
import OperationsCenter       from "@/components/admin/OperationsCenter";
import DailyProductionReport  from "@/components/admin/DailyProductionReport";
import AssetsCenter           from "@/components/admin/AssetsCenter";
import TrainingGuidesCenter   from "@/components/admin/TrainingGuidesCenter";
import InsuranceCenter        from "@/components/admin/InsuranceCenter";
import ReceiptsCenter         from "@/components/admin/ReceiptsCenter";
import ProjectCashFlowCenter  from "@/components/admin/ProjectCashFlowCenter";
import HSProgramCenter        from "@/components/admin/HSProgramCenter";

import type { AdminSection, Employee } from "@/app/admin/page";

export default function MobileAdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userRole, setUserRole] = useState<UserRole>("crew_boss");
  const [userName, setUserName] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("production");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    async function loadSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: roleData } = await supabase.rpc("get_my_role");
      const role = (roleData as UserRole) ?? "crew_boss";
      setUserRole(role);
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      setUserName((profile?.full_name as string | null) ?? user.email ?? "");
      const allowed = ROLE_PERMISSIONS[role];
      if (!allowed.includes(activeSection)) setActiveSection(allowed[0]);
      setAuthLoading(false);
    }
    loadSession();
  }, []);

  useEffect(() => {
    seedEmployeesData().then(() =>
      getAllEmployees().then(all =>
        setEmployees((all as Employee[]).sort((a, b) => a.name.localeCompare(b.name)))
      )
    );
  }, []);

  function handleSelectEmployee(emp: Employee) {
    setSelectedEmployee(emp);
    setActiveSection("employees");
  }

  function handleBackToList() {
    setSelectedEmployee(null);
  }

  function handleAddEmployee(emp: Employee) {
    setEmployees(prev => [...prev, emp].sort((a, b) => a.name.localeCompare(b.name)));
    saveRecord("employees", emp);
  }

  function handleDeleteEmployee(id: string) {
    setEmployees(prev => prev.filter(e => e.id !== id));
    deleteRecord("employees", id);
  }

  function handleUpdateEmployee(updated: Employee) {
    setEmployees(prev => prev.map(e => (e.id === updated.id ? updated : e)));
    if (selectedEmployee?.id === updated.id) setSelectedEmployee(updated);
    saveRecord("employees", updated);
  }

  function handleNavigate(section: AdminSection) {
    setActiveSection(section);
    // Clear employee selection when leaving the section
    if (section !== "employees") setSelectedEmployee(null);
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
            onNavigate={handleNavigate}
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
      case "documents":        return <DocumentCenter employees={employees} userRole={userRole} />;
      case "signatures":       return <SignatureCenter employees={employees} />;
      case "training":         return <TrainingSafetyCenter employees={employees} />;
      case "compliance":       return <ComplianceCenter employees={employees} />;
      case "payroll":          return <PayrollTaxCenter employees={employees} />;
      case "accounting":       return <AccountingCenter />;
      case "projects":         return <ProjectsCenter userRole={userRole} />;
      case "media":            return <MediaLibrary employees={employees} />;
      case "operations":       return <OperationsCenter employees={employees} />;
      case "production":       return <DailyProductionReport employees={employees} userRole={userRole} />;
      case "assets":           return <AssetsCenter />;
      case "training-guides":  return <TrainingGuidesCenter />;
      case "insurance":        return <InsuranceCenter />;
      case "receipts":         return <ReceiptsCenter userRole={userRole} userName={userName} />;
      case "cashflow":         return <ProjectCashFlowCenter />;
      case "health-safety":    return <HSProgramCenter userRole={userRole} />;
      default:                 return null;
    }
  }

  if (authLoading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#0d0d0d" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Loading…</div>
      </div>
    );
  }

  return (
    <MobileAdminShell activeSection={activeSection} onNavigate={handleNavigate} userRole={userRole}>
      {renderContent()}
    </MobileAdminShell>
  );
}
