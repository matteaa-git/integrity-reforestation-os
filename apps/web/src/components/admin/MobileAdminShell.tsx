"use client";

import { useState } from "react";
import type { AdminSection } from "@/app/admin/page";

// ── Section titles ────────────────────────────────────────────────────────────

const SECTION_TITLES: Record<AdminSection, string> = {
  dashboard:         "Dashboard",
  employees:         "Employees",
  payroll:           "Payroll & Tax",
  operations:        "Operations",
  production:        "Daily Production",
  projects:          "Projects",
  cashflow:          "Cash Flow",
  compliance:        "Health & Safety",
  training:          "CVOR Program",
  "training-guides": "Training Guides",
  "health-safety":   "H&S Program",
  accounting:        "Accounting",
  receipts:          "Receipts",
  documents:         "Documents",
  signatures:        "Signatures",
  media:             "Media Library",
  assets:            "Fleet & Assets",
  insurance:         "Insurance",
  users:             "User Management",
  "my-production":   "My Production",
  "my-earnings":     "My Earnings",
};

// ── Bottom tab bar (primary 4 + More) ────────────────────────────────────────

const BOTTOM_TABS: { id: AdminSection; label: string; icon: string }[] = [
  { id: "dashboard",  label: "Home",    icon: "▦" },
  { id: "employees",  label: "People",  icon: "◉" },
  { id: "production", label: "Field",   icon: "⬡" },
  { id: "receipts",   label: "Finance", icon: "◱" },
];

const BOTTOM_TAB_IDS = new Set(BOTTOM_TABS.map(t => t.id));

// ── More drawer sections ──────────────────────────────────────────────────────

const MORE_GROUPS: { group: string; items: { id: AdminSection; label: string; icon: string }[] }[] = [
  {
    group: "People",
    items: [
      { id: "payroll",          label: "Payroll & Tax",    icon: "◎" },
    ],
  },
  {
    group: "Field Operations",
    items: [
      { id: "operations",       label: "Operations",       icon: "⊕" },
      { id: "projects",         label: "Projects",         icon: "◫" },
    ],
  },
  {
    group: "Compliance & Safety",
    items: [
      { id: "compliance",       label: "Health & Safety",  icon: "☑" },
      { id: "training",         label: "CVOR Program",     icon: "⚑" },
      { id: "training-guides",  label: "Training Guides",  icon: "◈" },
    ],
  },
  {
    group: "Finance",
    items: [
      { id: "accounting",       label: "Accounting",       icon: "▤" },
      { id: "cashflow",         label: "Cash Flow",        icon: "◫" },
    ],
  },
  {
    group: "Records",
    items: [
      { id: "documents",        label: "Documents",        icon: "◫" },
      { id: "signatures",       label: "Signatures",       icon: "✦" },
      { id: "media",            label: "Media Library",    icon: "▣" },
    ],
  },
  {
    group: "Fleet",
    items: [
      { id: "assets",           label: "Fleet & Assets",   icon: "◈" },
      { id: "insurance",        label: "Insurance",        icon: "◎" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  children: React.ReactNode;
}

export default function MobileAdminShell({ activeSection, onNavigate, children }: Props) {
  const [showMore, setShowMore] = useState(false);

  const isMoreSection = !BOTTOM_TAB_IDS.has(activeSection);
  const title = SECTION_TITLES[activeSection];

  function navigate(section: AdminSection) {
    onNavigate(section);
    setShowMore(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      WebkitFontSmoothing: "antialiased",
      background: "var(--color-surface-secondary)",
    }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 10,
        background: "var(--color-sidebar)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: 12, padding: "0 16px",
      }}>
        {/* Logo */}
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: "var(--color-primary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-primary-deep)", fontWeight: 800, fontSize: 13,
        }}>
          IR
        </div>

        {/* Section title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "white", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
            {title}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", marginTop: 2, letterSpacing: "0.04em" }}>
            INTEGRITY REFORESTATION
          </div>
        </div>

        {/* Desktop link */}
        <a
          href="/admin"
          style={{
            fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none",
            padding: "5px 10px", borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 13 }}>⇱</span> Desktop
        </a>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 56, left: 0, right: 0, bottom: 66,
        overflowY: "auto", overflowX: "hidden",
        background: "var(--color-surface-secondary)",
        WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
      }}>
        {children}
      </div>

      {/* ── Bottom navigation ─────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 66, zIndex: 10,
        background: "var(--color-sidebar)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "stretch",
        /* Safe area inset for iPhone home indicator */
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {BOTTOM_TABS.map(tab => {
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                border: "none", background: "none", cursor: "pointer",
                padding: "6px 4px 4px", WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Active indicator dot */}
              <div style={{
                width: 4, height: 4, borderRadius: "50%", marginBottom: 2,
                background: active ? "var(--color-primary)" : "transparent",
                transition: "all 0.15s",
              }} />
              <span style={{
                fontSize: 19,
                color: active ? "var(--color-primary)" : "rgba(255,255,255,0.3)",
                lineHeight: 1, transition: "color 0.15s",
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: "0.01em",
                color: active ? "var(--color-primary)" : "rgba(255,255,255,0.3)",
                transition: "color 0.15s",
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setShowMore(v => !v)}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 3,
            border: "none", background: "none", cursor: "pointer",
            padding: "6px 4px 4px", WebkitTapHighlightColor: "transparent",
          }}
        >
          <div style={{
            width: 4, height: 4, borderRadius: "50%", marginBottom: 2,
            background: isMoreSection || showMore ? "var(--color-primary)" : "transparent",
            transition: "all 0.15s",
          }} />
          <span style={{
            fontSize: 19,
            color: isMoreSection || showMore ? "var(--color-primary)" : "rgba(255,255,255,0.3)",
            lineHeight: 1, transition: "color 0.15s",
          }}>
            ≡
          </span>
          <span style={{
            fontSize: 10, fontWeight: isMoreSection || showMore ? 700 : 500,
            color: isMoreSection || showMore ? "var(--color-primary)" : "rgba(255,255,255,0.3)",
            transition: "color 0.15s",
          }}>
            More
          </span>
        </button>
      </div>

      {/* ── More drawer ───────────────────────────────────────────────────── */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowMore(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 20,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
            }}
          />

          {/* Sheet */}
          <div style={{
            position: "fixed", bottom: 66, left: 0, right: 0, zIndex: 30,
            background: "var(--color-surface)",
            borderRadius: "20px 20px 0 0",
            borderTop: "1px solid var(--color-border)",
            maxHeight: "72vh", overflowY: "auto",
            boxShadow: "0 -12px 40px rgba(0,0,0,0.2)",
            animation: "slideUp 0.22s ease-out",
          }}>
            {/* Drag handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: "var(--color-border)", margin: "12px auto 4px",
            }} />

            {/* Header */}
            <div style={{
              padding: "8px 20px 12px", display: "flex",
              alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid var(--color-border)",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>All Sections</span>
              <button
                onClick={() => setShowMore(false)}
                style={{ fontSize: 20, color: "var(--color-text-tertiary)", border: "none", background: "none", cursor: "pointer", lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>

            {/* Section groups */}
            {MORE_GROUPS.map(group => (
              <div key={group.group}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.1em", color: "var(--color-text-tertiary)",
                  padding: "12px 20px 4px",
                }}>
                  {group.group}
                </div>
                {group.items.map(item => {
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 14,
                        padding: "13px 20px", border: "none", cursor: "pointer",
                        background: active ? "rgba(57,222,139,0.06)" : "transparent",
                        textAlign: "left", WebkitTapHighlightColor: "transparent",
                        borderLeft: active ? "3px solid var(--color-primary)" : "3px solid transparent",
                      }}
                    >
                      <span style={{
                        fontSize: 17, width: 22, textAlign: "center", flexShrink: 0,
                        color: active ? "var(--color-primary)" : "var(--color-text-tertiary)",
                      }}>
                        {item.icon}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: active ? 600 : 400,
                        color: active ? "var(--color-primary)" : "var(--color-text-primary)",
                        flex: 1,
                      }}>
                        {item.label}
                      </span>
                      {active && (
                        <span style={{ fontSize: 11, color: "var(--color-primary)", fontWeight: 600 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Footer */}
            <div style={{
              padding: "16px 20px 24px",
              borderTop: "1px solid var(--color-border)",
              marginTop: 8,
            }}>
              <a
                href="/admin"
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  fontSize: 13, color: "var(--color-text-secondary)", textDecoration: "none",
                  padding: "10px 14px", borderRadius: 10,
                  background: "var(--color-surface-secondary)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span style={{ fontSize: 16 }}>⇱</span>
                Switch to Desktop View
              </a>
            </div>
          </div>
        </>
      )}

      {/* Slide-up animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
