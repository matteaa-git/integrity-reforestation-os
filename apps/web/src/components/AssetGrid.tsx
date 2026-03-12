"use client";

import type { Asset } from "@/lib/api";

interface AssetGridProps {
  assets: Asset[];
  selectedId: string | null;
  onSelect: (asset: Asset) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetGrid({ assets, selectedId, onSelect }: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
        No assets found. Index a directory to get started.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "12px",
      }}
    >
      {assets.map((asset) => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset)}
          style={{
            border: selectedId === asset.id ? "2px solid #0070f3" : "1px solid #ddd",
            borderRadius: "8px",
            padding: "8px",
            background: selectedId === asset.id ? "#f0f7ff" : "#fff",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "1",
              background: "#f5f5f5",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              color: "#aaa",
              overflow: "hidden",
            }}
          >
            {asset.media_type === "video" ? "\u25B6" : "\u{1F5BC}"}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {asset.filename}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#888" }}>
            {asset.media_type} &middot; {formatBytes(asset.file_size)}
          </div>
        </button>
      ))}
    </div>
  );
}
