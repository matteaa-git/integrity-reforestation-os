export type UserRole = "admin" | "supervisor" | "crew_boss" | "planter";

export type AdminSection =
  | "dashboard"
  | "employees"
  | "documents"
  | "signatures"
  | "training"
  | "compliance"
  | "payroll"
  | "accounting"
  | "projects"
  | "cashflow"
  | "media"
  | "operations"
  | "production"
  | "assets"
  | "training-guides"
  | "insurance"
  | "receipts"
  | "users"
  | "my-production"
  | "my-earnings"
  | "health-safety"
  | "file-ingest";

export const ROLE_PERMISSIONS: Record<UserRole, AdminSection[]> = {
  admin: [
    "dashboard", "employees", "documents", "signatures", "training", "compliance",
    "payroll", "accounting", "projects", "cashflow", "media", "operations",
    "production", "assets", "training-guides", "insurance", "receipts", "users",
    "health-safety", "file-ingest",
  ],
  supervisor: [
    "dashboard", "employees", "documents", "signatures", "training", "compliance",
    "projects", "media", "operations", "production", "assets", "training-guides",
    "insurance", "receipts", "health-safety", "file-ingest",
  ],
  crew_boss: ["production", "receipts", "compliance", "health-safety", "documents"],
  planter:   ["my-production", "my-earnings"],
};
