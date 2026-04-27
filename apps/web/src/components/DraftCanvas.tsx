"use client";

import { useCallback, useEffect, useState } from "react";
import type { Asset, ContentFormat, DraftAssetEntry } from "@/lib/api";
import { addDraftAsset, createDraft, fetchDraft, removeDraftAsset, updateDraft } from "@/lib/api";
import AssetPicker from "@/components/AssetPicker";
import DraftAssetList from "@/components/DraftAssetList";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
    if (initialDraftId) loadDraft(initialDraftId);
  }, [initialDraftId, loadDraft]);

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
    <div className="max-w-2xl mx-auto">
      <Card>
        {/* Title */}
        <div className="mb-4">
          <label className="text-xs font-medium text-text-secondary mb-1 block">{formatLabel} Title</label>
          <input
            type="text"
            placeholder={`${formatLabel} title...`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mb-5">
          <Button onClick={() => setShowPicker(true)}>Add Asset</Button>
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          {savedMsg && <span className="text-xs text-success ml-1">{savedMsg}</span>}
          {draftId && (
            <span className="text-[11px] text-text-tertiary ml-auto font-mono">
              {draftId.slice(0, 8)}...
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
          </div>
        )}

        {/* Loading */}
        {state === "loading" && (
          <div className="text-sm text-text-tertiary py-8 text-center">Loading draft...</div>
        )}

        {/* Asset list */}
        {state !== "loading" && <DraftAssetList entries={assets} onRemove={handleRemoveAsset} />}
      </Card>

      {/* Picker modal */}
      {showPicker && (
        <AssetPicker onSelect={handleAddAsset} onClose={() => setShowPicker(false)} excludeIds={excludeIds} />
      )}
    </div>
  );
}
