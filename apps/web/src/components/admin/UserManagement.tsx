"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type UserRole = "admin" | "supervisor" | "crew_boss" | "planter";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin:      "Admin",
  supervisor: "Supervisor",
  crew_boss:  "Crew Boss",
  planter:    "Planter",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin:      "bg-primary/10 text-primary border-primary/20",
  supervisor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  crew_boss:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  planter:    "bg-green-500/10 text-green-400 border-green-500/20",
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:      "Full access including payroll, accounting, and taxes.",
  supervisor: "Full access except Accounting, Payroll, and Cash Flow.",
  crew_boss:  "Daily Production, Receipts, and Health & Safety only.",
  planter:    "My Production and My Earnings — own records only, searchable by date range.",
};

export default function UserManagement() {
  const supabase = createClient();

  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteName, setInviteName]     = useState("");
  const [inviteRole, setInviteRole]     = useState<UserRole>("crew_boss");
  const [inviting, setInviting]         = useState(false);
  const [inviteError, setInviteError]   = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => { loadProfiles(); }, []);

  async function loadProfiles() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true });
    if (!error && data) setProfiles(data as Profile[]);
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole }),
    });
    const json = await res.json();

    if (!res.ok) {
      setInviteError(json.error ?? "Failed to send invite.");
    } else {
      setInviteSuccess(`Invite sent to ${inviteEmail}. They'll receive an email to set their password.`);
      setInviteEmail(""); setInviteName(""); setInviteRole("crew_boss");
      await loadProfiles();
    }
    setInviting(false);
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingId(userId);
    const res = await fetch("/api/admin/update-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    const json = await res.json();
    if (!res.ok) {
      showToast(json.error ?? "Failed to update role.", "error");
    } else {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
      showToast("Role updated successfully.");
    }
    setUpdatingId(null);
  }

  const inputCls = "w-full bg-surface-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary/50 transition-colors";
  const labelCls = "block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1.5";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-xs font-semibold shadow-xl transition-all ${
          toast.type === "success"
            ? "text-primary-deep"
            : "bg-red-500 text-white"
        }`}
          style={toast.type === "success" ? { background: "var(--color-primary)" } : {}}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="text-sm font-semibold text-text-primary">User Management</div>
        <div className="text-xs text-text-tertiary mt-0.5">
          Invite team members and manage their access level
        </div>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
          <div key={role} className="bg-surface border border-border rounded-xl p-4">
            <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border mb-2 ${ROLE_COLORS[role]}`}>
              {label}
            </span>
            <p className="text-[11px] text-text-tertiary leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      {/* Invite form */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface-secondary/40">
          <div className="text-xs font-semibold text-text-primary">Invite New User</div>
          <div className="text-[10px] text-text-tertiary mt-0.5">
            They&apos;ll receive an email with a link to set their password and access the console.
          </div>
        </div>
        <form onSubmit={handleInvite} className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Full Name</label>
              <input
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Jane Smith"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email Address *</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="jane@example.com"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Role *</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
                className={inputCls}
              >
                <option value="planter">Planter</option>
                <option value="crew_boss">Crew Boss</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {inviteError && (
            <div className="text-[11px] text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">
              {inviteError}
            </div>
          )}
          {inviteSuccess && (
            <div className="text-[11px] text-green-400 bg-green-400/8 border border-green-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>✓</span> {inviteSuccess}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="px-5 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
            >
              {inviting ? (
                <><span className="animate-spin">⟳</span> Sending…</>
              ) : (
                <><span>✉</span> Send Invite</>
              )}
            </button>
            <span className="text-[10px] text-text-tertiary">
              User will be created with the selected role immediately.
            </span>
          </div>
        </form>
      </div>

      {/* User list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-surface-secondary/40 flex items-center justify-between">
          <div className="text-xs font-semibold text-text-primary">Team Members</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-tertiary">{profiles.length} user{profiles.length !== 1 ? "s" : ""}</span>
            <button
              onClick={loadProfiles}
              className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors px-2 py-0.5 rounded border border-border hover:border-primary/40"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-xs text-text-tertiary">Loading users…</div>
        ) : profiles.length === 0 ? (
          <div className="px-5 py-12 text-center space-y-2">
            <div className="text-2xl opacity-20">◉</div>
            <div className="text-xs text-text-tertiary">No users yet. Invite your first team member above.</div>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {profiles.map(profile => (
              <div key={profile.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-secondary/20 transition-colors">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
                >
                  {(profile.full_name ?? profile.email).slice(0, 2).toUpperCase()}
                </div>

                {/* Name / email */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text-primary truncate">
                    {profile.full_name ?? <span className="text-text-tertiary italic">No name</span>}
                  </div>
                  <div className="text-[10px] text-text-tertiary truncate">{profile.email}</div>
                </div>

                {/* Joined date */}
                <div className="text-[10px] text-text-tertiary shrink-0 hidden md:block">
                  {new Date(profile.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                </div>

                {/* Role badge + selector */}
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROLE_COLORS[profile.role]}`}>
                    {ROLE_LABELS[profile.role]}
                  </span>
                  <select
                    value={profile.role}
                    onChange={e => handleRoleChange(profile.id, e.target.value as UserRole)}
                    disabled={updatingId === profile.id}
                    className="text-[11px] bg-surface-secondary border border-border rounded-lg px-2 py-1 text-text-secondary focus:outline-none focus:border-primary/50 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="planter">Planter</option>
                    <option value="crew_boss">Crew Boss</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                  {updatingId === profile.id && (
                    <span className="text-[10px] text-text-tertiary animate-spin">⟳</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
