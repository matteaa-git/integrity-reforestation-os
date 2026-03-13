"use client";

import type { AdCreative, AdCreativeStatus } from "@/lib/api";

const STATUS_STYLES: Record<AdCreativeStatus, { bg: string; color: string; label: string }> = {
  draft: { bg: "#e3e8ef", color: "#333", label: "Draft" },
  ready: { bg: "#d4edda", color: "#155724", label: "Ready" },
  archived: { bg: "#f0f0f0", color: "#888", label: "Archived" },
};

interface AdCreativeListProps {
  creatives: AdCreative[];
  selectedId: string | null;
  onSelect: (creative: AdCreative) => void;
}

export default function AdCreativeList({ creatives, selectedId, onSelect }: AdCreativeListProps) {
  if (creatives.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
        No ad creatives yet. Create one from an asset or draft.
      </div>
    );
  }

  return (
    <div>
      {creatives.map((c) => {
        const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.draft;
        const isSelected = c.id === selectedId;
        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            style={{
              border: isSelected ? "2px solid #0070f3" : "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "0.5rem",
              cursor: "pointer",
              background: isSelected ? "#f0f7ff" : "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.9rem" }}>{c.title}</strong>
              <span style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: "12px",
                fontSize: "0.7rem",
                fontWeight: 600,
                background: s.bg,
                color: s.color,
              }}>
                {s.label}
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "4px" }}>
              {c.hook_text && <span>Hook: {c.hook_text}</span>}
              {c.hook_text && c.cta_text && <span> &middot; </span>}
              {c.cta_text && <span>CTA: {c.cta_text}</span>}
            </div>
            {c.thumbnail_label && (
              <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "2px" }}>
                Variant: {c.thumbnail_label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
