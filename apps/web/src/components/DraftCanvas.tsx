"use client";

import { useCallback, useEffect, useState } from "react";
import type { Asset, ContentFormat, Draft, DraftAssetEntry } from "@/lib/api";
import { addDraftAsset, createDraft, fetchDraft, removeDraftAsset, updateDraft } from "@/lib/api";
import AssetPicker from "@/components/AssetPicker";
import DraftAssetList from "@/components/DraftAssetList";

type UIState = "empty" | "ready" | "loading" | "error";

interface DraftCanvasProps {
  format: ContentFormat;
  formatLabel: string;
  draftId?: string;
}

export default function DraftCanvas({ format, formatLabel, draftId: initialDraftId }: DraftCanvasProps) {
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [title, setTitle] = useState("");
  const [assets, setAssets] = useState<DraftAssetEntry[]>([]);
  const [state, setState] = useState<UIState>("empty");
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Load existing draft
  const loadDraft = useCallback(async (id: string) => {
    setState("loading");
    try {
      const draft = await fetchDraft(id);
      setTitle(draft.title);
      setAssets(draft.assets ?? []);
      setState(draft.assets && draft.assets.length > 0 ? "ready" : "empty");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load draft");
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (initialDraftId) {
      loadDraft(initialDraftId);
    }
  }, [initialDraftId, loadDraft]);

  // Create draft if it doesn't exist, then save title
  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      if (!draftId) {
        const draft = await createDraft({ title: title || `Untitled ${formatLabel}`, format });
        setDraftId(draft.id);
        setSavedMsg("Draft created");
      } else {
        await updateDraft(draftId, { title });
        setSavedMsg("Saved");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Ensure draft exists before adding asset
  const ensureDraft = async (): Promise<string> => {
    if (draftId) return draftId;
    const draft = await createDraft({ title: title || `Untitled ${formatLabel}`, format });
    setDraftId(draft.id);
    return draft.id;
  };

  const handleAddAsset = async (asset: Asset) => {
    setShowPicker(false);
    try {
      const id = await ensureDraft();
      const result = await addDraftAsset(id, asset.id);
      setAssets(result.assets);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add asset");
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!draftId) return;
    try {
      const result = await removeDraftAsset(draftId, assetId);
      setAssets(result.assets);
      if (result.assets.length === 0) setState("empty");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove asset");
    }
  };

  const excludeIds = assets.map((e) => e.asset_id);

  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>New {formatLabel}</h1>
        <a href="/" style={{ fontSize: "0.85rem", color: "#0070f3" }}>&larr; Home</a>
      </div>

      {/* Title */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder={`${formatLabel} title...`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: "1rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
        <button
          onClick={() => setShowPicker(true)}
          style={{
            padding: "8px 16px",
            background: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Add Asset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 16px",
            background: saving ? "#ccc" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: saving ? "default" : "pointer",
            fontSize: "0.85rem",
          }}
        >
          {saving ? "Saving..." : "Save Draft"}
        </button>
        {savedMsg && <span style={{ fontSize: "0.85rem", color: "#4caf50", alignSelf: "center" }}>{savedMsg}</span>}
        {draftId && <span style={{ fontSize: "0.75rem", color: "#888", alignSelf: "center", marginLeft: "auto" }}>ID: {draftId.slice(0, 8)}...</span>}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "0.75rem", background: "#fdecea", border: "1px solid #f5c6cb", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem", color: "#d32f2f" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "8px", cursor: "pointer", background: "none", border: "none", color: "#d32f2f" }}>&times;</button>
        </div>
      )}

      {/* State: loading */}
      {state === "loading" && <div style={{ padding: "2rem", color: "#888", textAlign: "center" }}>Loading draft...</div>}

      {/* Asset list */}
      {state !== "loading" && <DraftAssetList entries={assets} onRemove={handleRemoveAsset} />}

      {/* Picker modal */}
      {showPicker && (
        <AssetPicker
          onSelect={handleAddAsset}
          onClose={() => setShowPicker(false)}
          excludeIds={excludeIds}
        />
      )}
    </main>
  );
}
