"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdCreative, AdCreativeStatus } from "@/lib/api";
import { createAdCreative, fetchAdCreatives } from "@/lib/api";
import AdCreativeList from "@/components/AdCreativeList";
import AdCreativeEditor from "@/components/AdCreativeEditor";
import VariantBuilder from "@/components/VariantBuilder";

const STATUS_FILTERS: { label: string; value: AdCreativeStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Ready", value: "ready" },
  { label: "Archived", value: "archived" },
];

export default function AdLabPage() {
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [filter, setFilter] = useState<AdCreativeStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdCreative | null>(null);
  const [showVariantBuilder, setShowVariantBuilder] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filter === "all" ? {} : { status: filter };
      const res = await fetchAdCreatives(params);
      setCreatives(res.ad_creatives);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleCreateManual = async () => {
    setCreating(true);
    setError(null);
    try {
      const creative = await createAdCreative({ title: "Untitled Ad" });
      setCreatives((prev) => [creative, ...prev]);
      setSelected(creative);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setCreating(false);
    }
  };

  const handleVariantCreated = (creative: AdCreative) => {
    setShowVariantBuilder(false);
    setCreatives((prev) => [creative, ...prev]);
    setSelected(creative);
  };

  const handleSaved = (updated: AdCreative) => {
    setCreatives((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
  };

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Ad Creative Lab</h1>
        <a href="/" style={{ fontSize: "0.85rem", color: "#0070f3" }}>&larr; Home</a>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={handleCreateManual}
          disabled={creating}
          style={{
            padding: "8px 16px",
            background: creating ? "#ccc" : "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: creating ? "default" : "pointer",
            fontSize: "0.85rem",
          }}
        >
          New Ad Creative
        </button>
        <button
          onClick={() => setShowVariantBuilder(true)}
          style={{
            padding: "8px 16px",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          From Asset / Draft
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "1rem", flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "6px 14px",
              background: filter === f.value ? "#0070f3" : "#eee",
              color: filter === f.value ? "#fff" : "#333",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: filter === f.value ? 600 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fdecea", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem", color: "#d32f2f" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "8px", cursor: "pointer", background: "none", border: "none", color: "#d32f2f" }}>&times;</button>
        </div>
      )}

      {loading && <div style={{ color: "#888", padding: "2rem", textAlign: "center" }}>Loading...</div>}

      {/* Main content: list + editor side-by-side on wider screens */}
      {!loading && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", minWidth: "250px" }}>
            <AdCreativeList
              creatives={creatives}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
          </div>
          <div style={{ flex: "1 1 350px", minWidth: "300px" }}>
            {selected && (
              <AdCreativeEditor
                key={selected.id}
                creative={selected}
                onSaved={handleSaved}
                onClose={() => setSelected(null)}
              />
            )}
            {!selected && creatives.length > 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#888", border: "1px dashed #ddd", borderRadius: "8px" }}>
                Select an ad creative to edit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variant builder modal */}
      {showVariantBuilder && (
        <VariantBuilder
          onCreated={handleVariantCreated}
          onClose={() => setShowVariantBuilder(false)}
        />
      )}
    </main>
  );
}
