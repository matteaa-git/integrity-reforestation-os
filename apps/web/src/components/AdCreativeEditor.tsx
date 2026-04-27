"use client";

import { useState } from "react";
import type { AdCreative, AdCreativeStatus } from "@/lib/api";
import { updateAdCreative } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

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

  const inputClass = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Edit Ad Creative</h3>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">&times;</button>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">Title</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">Hook Text</label>
          <input className={inputClass} value={hookText} onChange={(e) => setHookText(e.target.value)} placeholder="Attention-grabbing opening..." />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">CTA Text</label>
          <input className={inputClass} value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Call to action..." />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">Thumbnail / Cover Label</label>
          <input className={inputClass} value={thumbnailLabel} onChange={(e) => setThumbnailLabel(e.target.value)} placeholder="Variant A, Cover B..." />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1 block">Status</label>
          <select
            className={`${inputClass} bg-white`}
            value={status}
            onChange={(e) => setStatus(e.target.value as AdCreativeStatus)}
          >
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-danger mt-2">{error}</div>}
      {saved && <div className="text-sm text-success mt-2">Saved</div>}

      <div className="flex gap-2 mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>

      <div className="text-[11px] text-text-tertiary mt-4 pt-3 border-t border-border font-mono">
        ID: {creative.id.slice(0, 8)}...
        {creative.asset_id && <span> &middot; Asset: {creative.asset_id.slice(0, 8)}...</span>}
        {creative.draft_id && <span> &middot; Draft: {creative.draft_id.slice(0, 8)}...</span>}
      </div>
    </Card>
  );
}
