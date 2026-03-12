"use client";

import { useCallback, useEffect, useState } from "react";
import type { Asset } from "@/lib/api";
import { fetchAssets } from "@/lib/api";

interface AssetPickerProps {
  onSelect: (asset: Asset) => void;
  onClose: () => void;
  excludeIds?: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetPicker({ onSelect, onClose, excludeIds = [] }: AssetPickerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { media_type?: string; search?: string } = {};
      if (mediaFilter) params.media_type = mediaFilter;
      if (search) params.search = search;
      const data = await fetchAssets(params);
      setAssets(data.assets.filter((a) => !excludeIds.includes(a.id)));
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [mediaFilter, search, excludeIds]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "640px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "1rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Select Asset</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>&times;</button>
        </div>

        <div style={{ padding: "0.75rem 1rem", display: "flex", gap: "8px", borderBottom: "1px solid #eee" }}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "0.85rem", flex: 1 }}
          />
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "0.85rem" }}
          >
            <option value="">All</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0.75rem 1rem" }}>
          {loading && <div style={{ color: "#888", padding: "1rem" }}>Loading...</div>}
          {!loading && assets.length === 0 && (
            <div style={{ color: "#888", padding: "1rem", textAlign: "center" }}>No assets available.</div>
          )}
          {!loading && assets.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset)}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    padding: "6px",
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ aspectRatio: "1", background: "#f5f5f5", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", color: "#aaa" }}>
                    {asset.media_type === "video" ? "\u25B6" : "\u{1F5BC}"}
                  </div>
                  <div style={{ fontSize: "0.75rem", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {asset.filename}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#888" }}>{formatBytes(asset.file_size)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
