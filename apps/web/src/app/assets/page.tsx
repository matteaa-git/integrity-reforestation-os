"use client";

import { useCallback, useEffect, useState } from "react";
import type { Asset } from "@/lib/api";
import { fetchAssets, indexDirectory } from "@/lib/api";
import AssetGrid from "@/components/AssetGrid";
import AssetPreview from "@/components/AssetPreview";

type UIState = "loading" | "ready" | "empty" | "error";

export default function AssetBrowserPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [state, setState] = useState<UIState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [mediaFilter, setMediaFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [indexPath, setIndexPath] = useState<string>("");
  const [indexStatus, setIndexStatus] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const params: { media_type?: string; search?: string } = {};
      if (mediaFilter) params.media_type = mediaFilter;
      if (search) params.search = search;
      const data = await fetchAssets(params);
      setAssets(data.assets);
      setState(data.assets.length === 0 ? "empty" : "ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }, [mediaFilter, search]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleIndex = async () => {
    if (!indexPath.trim()) return;
    setIndexStatus("Indexing...");
    try {
      const result = await indexDirectory(indexPath.trim());
      setIndexStatus(`Indexed ${result.indexed} files, skipped ${result.skipped}.`);
      loadAssets();
    } catch (e) {
      setIndexStatus(e instanceof Error ? e.message : "Index failed");
    }
  };

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Asset Browser</h1>
        <a href="/" style={{ fontSize: "0.85rem", color: "#0070f3" }}>&larr; Home</a>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "0.85rem" }}
        />
        <select
          value={mediaFilter}
          onChange={(e) => setMediaFilter(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "0.85rem" }}
        >
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          <input
            type="text"
            placeholder="/path/to/assets"
            value={indexPath}
            onChange={(e) => setIndexPath(e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "0.85rem", width: "220px" }}
          />
          <button
            onClick={handleIndex}
            style={{
              padding: "6px 12px",
              background: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Index Directory
          </button>
        </div>
      </div>

      {indexStatus && (
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem" }}>{indexStatus}</div>
      )}

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, overflow: "auto" }}>
          {state === "loading" && <div style={{ padding: "2rem", color: "#888" }}>Loading assets...</div>}
          {state === "error" && (
            <div style={{ padding: "2rem", color: "#d32f2f" }}>
              Error: {error}
              <br />
              <button onClick={loadAssets} style={{ marginTop: "0.5rem", cursor: "pointer" }}>Retry</button>
            </div>
          )}
          {state === "empty" && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
              No assets found. Use &quot;Index Directory&quot; to scan a folder.
            </div>
          )}
          {state === "ready" && (
            <AssetGrid assets={assets} selectedId={selected?.id ?? null} onSelect={setSelected} />
          )}
        </div>
        <AssetPreview asset={selected} onClose={() => setSelected(null)} />
      </div>
    </main>
  );
}
