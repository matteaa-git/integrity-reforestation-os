"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdCreative, Asset, Draft } from "@/lib/api";
import { createAdCreativeFromAsset, createAdCreativeFromDraft, fetchAssets, fetchDrafts } from "@/lib/api";

interface VariantBuilderProps {
  onCreated: (creative: AdCreative) => void;
  onClose: () => void;
}

type SourceType = "asset" | "draft";

export default function VariantBuilder({ onCreated, onClose }: VariantBuilderProps) {
  const [sourceType, setSourceType] = useState<SourceType>("asset");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hookText, setHookText] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [thumbnailLabel, setThumbnailLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setSelectedId(null);
    try {
      if (sourceType === "asset") {
        const res = await fetchAssets();
        setAssets(res.assets);
      } else {
        const res = await fetchDrafts();
        setDrafts(res.drafts);
      }
    } catch {
      setError("Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, [sourceType]);

  useEffect(() => { loadSources(); }, [loadSources]);

  const handleCreate = async () => {
    if (!selectedId) return;
    setCreating(true);
    setError(null);
    try {
      const data = {
        hook_text: hookText,
        cta_text: ctaText,
        thumbnail_label: thumbnailLabel,
      };
      const creative = sourceType === "asset"
        ? await createAdCreativeFromAsset(selectedId, data)
        : await createAdCreativeFromDraft(selectedId, data);
      onCreated(creative);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creation failed");
    } finally {
      setCreating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "0.85rem",
    boxSizing: "border-box",
  };

  const items = sourceType === "asset"
    ? assets.map((a) => ({ id: a.id, label: a.filename, sub: a.media_type }))
    : drafts.map((d) => ({ id: d.id, label: d.title, sub: `${d.format} — ${d.status}` }));

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "1.5rem",
        width: "500px",
        maxHeight: "80vh",
        overflow: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Create Ad Variant</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#888" }}>&times;</button>
        </div>

        {/* Source type toggle */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "1rem" }}>
          {(["asset", "draft"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSourceType(t)}
              style={{
                padding: "6px 16px",
                background: sourceType === t ? "#0070f3" : "#eee",
                color: sourceType === t ? "#fff" : "#333",
                border: "none",
                borderRadius: "20px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: sourceType === t ? 600 : 400,
              }}
            >
              From {t === "asset" ? "Asset" : "Draft"}
            </button>
          ))}
        </div>

        {/* Source list */}
        {loading && <div style={{ color: "#888", padding: "1rem", textAlign: "center" }}>Loading...</div>}
        {!loading && items.length === 0 && (
          <div style={{ color: "#888", padding: "1rem", textAlign: "center" }}>
            No {sourceType === "asset" ? "assets" : "drafts"} available.
          </div>
        )}
        {!loading && items.length > 0 && (
          <div style={{ maxHeight: "150px", overflow: "auto", border: "1px solid #e0e0e0", borderRadius: "6px", marginBottom: "1rem" }}>
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: selectedId === item.id ? "#e8f4ff" : "transparent",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: "0.7rem", color: "#888" }}>{item.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Creative fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          <input style={inputStyle} placeholder="Hook text..." value={hookText} onChange={(e) => setHookText(e.target.value)} />
          <input style={inputStyle} placeholder="CTA text..." value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
          <input style={inputStyle} placeholder="Thumbnail / variant label..." value={thumbnailLabel} onChange={(e) => setThumbnailLabel(e.target.value)} />
        </div>

        {error && <div style={{ color: "#d32f2f", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{error}</div>}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleCreate}
            disabled={!selectedId || creating}
            style={{
              padding: "8px 20px",
              background: !selectedId || creating ? "#ccc" : "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: !selectedId || creating ? "default" : "pointer",
              fontSize: "0.85rem",
            }}
          >
            {creating ? "Creating..." : "Create Variant"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#eee",
              color: "#333",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
