"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdCreative, Asset, Draft } from "@/lib/api";
import { createAdCreativeFromAsset, createAdCreativeFromDraft, fetchAssets, fetchDrafts } from "@/lib/api";
import Button from "@/components/ui/Button";

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

  const inputClass = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  const items = sourceType === "asset"
    ? assets.map((a) => ({ id: a.id, label: a.filename, sub: a.media_type }))
    : drafts.map((d) => ({ id: d.id, label: d.title, sub: `${d.format} — ${d.status}` }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl w-[500px] max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Create Ad Variant</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Source type toggle */}
          <div className="flex gap-1 mb-4">
            {(["asset", "draft"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSourceType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  sourceType === t
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-text-secondary border border-border hover:bg-surface"
                }`}
              >
                From {t === "asset" ? "Asset" : "Draft"}
              </button>
            ))}
          </div>

          {/* Source list */}
          {loading && <div className="text-sm text-text-tertiary py-6 text-center">Loading...</div>}
          {!loading && items.length === 0 && (
            <div className="text-sm text-text-tertiary py-6 text-center">
              No {sourceType === "asset" ? "assets" : "drafts"} available.
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="max-h-[150px] overflow-y-auto border border-border rounded-xl mb-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`px-3 py-2 cursor-pointer border-b border-border last:border-b-0 transition-colors ${
                    selectedId === item.id ? "bg-primary/5" : "hover:bg-surface-secondary"
                  }`}
                >
                  <div className="text-sm font-medium text-text-primary">{item.label}</div>
                  <div className="text-[11px] text-text-tertiary">{item.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Creative fields */}
          <div className="flex flex-col gap-2 mb-4">
            <input className={inputClass} placeholder="Hook text..." value={hookText} onChange={(e) => setHookText(e.target.value)} />
            <input className={inputClass} placeholder="CTA text..." value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            <input className={inputClass} placeholder="Thumbnail / variant label..." value={thumbnailLabel} onChange={(e) => setThumbnailLabel(e.target.value)} />
          </div>

          {error && <div className="text-sm text-danger mb-3">{error}</div>}

          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!selectedId || creating}>
              {creating ? "Creating..." : "Create Variant"}
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
