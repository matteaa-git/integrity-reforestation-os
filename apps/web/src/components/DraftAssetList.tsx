"use client";

import type { DraftAssetEntry } from "@/lib/api";

interface DraftAssetListProps {
  entries: DraftAssetEntry[];
  onRemove: (assetId: string) => void;
}

export default function DraftAssetList({ entries, onRemove }: DraftAssetListProps) {
  if (entries.length === 0) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center", color: "#888", border: "2px dashed #ddd", borderRadius: "8px" }}>
        No assets added yet. Click &quot;Add Asset&quot; to get started.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          <div style={{ width: "24px", textAlign: "center", color: "#888", fontSize: "0.85rem", fontWeight: 600 }}>
            {entry.position + 1}
          </div>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "#eee",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              color: "#aaa",
              flexShrink: 0,
            }}
          >
            {entry.asset.media_type === "video" ? "\u25B6" : "\u{1F5BC}"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.asset.filename}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#888" }}>{entry.asset.media_type}</div>
          </div>
          <button
            onClick={() => onRemove(entry.asset_id)}
            style={{
              background: "none",
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: "0.75rem",
              color: "#d32f2f",
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
