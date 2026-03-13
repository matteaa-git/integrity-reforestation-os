"use client";

import { useState } from "react";
import type { AdCreative, AdCreativeStatus } from "@/lib/api";
import { updateAdCreative } from "@/lib/api";

interface AdCreativeEditorProps {
  creative: AdCreative;
  onSaved: (updated: AdCreative) => void;
  onClose: () => void;
}

export default function AdCreativeEditor({ creative, onSaved, onClose }: AdCreativeEditorProps) {
  const [title, setTitle] = useState(creative.title);
  const [hookText, setHookText] = useState(creative.hook_text);
  const [ctaText, setCtaText] = useState(creative.cta_text);
  const [thumbnailLabel, setThumbnailLabel] = useState(creative.thumbnail_label);
  const [status, setStatus] = useState<AdCreativeStatus>(creative.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateAdCreative(creative.id, {
        title,
        hook_text: hookText,
        cta_text: ctaText,
        thumbnail_label: thumbnailLabel,
        status,
      });
      onSaved(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
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

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#555",
    marginBottom: "4px",
  };

  return (
    <div style={{
      border: "1px solid #d0d0d0",
      borderRadius: "8px",
      padding: "1.25rem",
      background: "#fafafa",
      marginBottom: "1rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Edit Ad Creative</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#888" }}>&times;</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Hook Text</label>
          <input style={inputStyle} value={hookText} onChange={(e) => setHookText(e.target.value)} placeholder="Attention-grabbing opening..." />
        </div>
        <div>
          <label style={labelStyle}>CTA Text</label>
          <input style={inputStyle} value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Call to action..." />
        </div>
        <div>
          <label style={labelStyle}>Thumbnail / Cover Label</label>
          <input style={inputStyle} value={thumbnailLabel} onChange={(e) => setThumbnailLabel(e.target.value)} placeholder="Variant A, Cover B..." />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select
            style={{ ...inputStyle, background: "#fff" }}
            value={status}
            onChange={(e) => setStatus(e.target.value as AdCreativeStatus)}
          >
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error && <div style={{ color: "#d32f2f", fontSize: "0.8rem", marginTop: "0.5rem" }}>{error}</div>}
      {saved && <div style={{ color: "#4caf50", fontSize: "0.8rem", marginTop: "0.5rem" }}>Saved</div>}

      <div style={{ display: "flex", gap: "8px", marginTop: "1rem" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 20px",
            background: saving ? "#ccc" : "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: saving ? "default" : "pointer",
            fontSize: "0.85rem",
          }}
        >
          {saving ? "Saving..." : "Save"}
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

      <div style={{ fontSize: "0.7rem", color: "#aaa", marginTop: "0.75rem" }}>
        ID: {creative.id.slice(0, 8)}...
        {creative.asset_id && <span> &middot; Asset: {creative.asset_id.slice(0, 8)}...</span>}
        {creative.draft_id && <span> &middot; Draft: {creative.draft_id.slice(0, 8)}...</span>}
      </div>
    </div>
  );
}
