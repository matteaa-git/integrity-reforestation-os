"use client";

import type { Asset } from "@/lib/api";

interface AssetPreviewProps {
  asset: Asset | null;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetPreview({ asset, onClose }: AssetPreviewProps) {
  if (!asset) return null;

  return (
    <div
      style={{
        borderLeft: "1px solid #ddd",
        padding: "1rem",
        width: "320px",
        flexShrink: 0,
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Preview</h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.2rem",
            padding: "4px",
          }}
        >
          &times;
        </button>
      </div>

      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          background: "#f5f5f5",
          borderRadius: "8px",
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "3rem",
          color: "#aaa",
        }}
      >
        {asset.media_type === "video" ? "\u25B6" : "\u{1F5BC}"}
      </div>

      <table style={{ marginTop: "1rem", fontSize: "0.85rem", width: "100%" }}>
        <tbody>
          <tr><td style={{ color: "#888", paddingRight: "1rem" }}>Filename</td><td>{asset.filename}</td></tr>
          <tr><td style={{ color: "#888" }}>Type</td><td>{asset.media_type}</td></tr>
          <tr><td style={{ color: "#888" }}>Size</td><td>{formatBytes(asset.file_size)}</td></tr>
          {asset.width && asset.height && (
            <tr><td style={{ color: "#888" }}>Dimensions</td><td>{asset.width} x {asset.height}</td></tr>
          )}
          {asset.duration != null && (
            <tr><td style={{ color: "#888" }}>Duration</td><td>{asset.duration.toFixed(1)}s</td></tr>
          )}
          <tr><td style={{ color: "#888" }}>Path</td><td style={{ wordBreak: "break-all", fontSize: "0.75rem" }}>{asset.path}</td></tr>
          <tr><td style={{ color: "#888" }}>ID</td><td style={{ wordBreak: "break-all", fontSize: "0.75rem" }}>{asset.id}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
