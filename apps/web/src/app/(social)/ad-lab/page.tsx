"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdCreative, AdCreativeStatus } from "@/lib/api";
import { createAdCreative, fetchAdCreatives } from "@/lib/api";
import AdCreativeList from "@/components/AdCreativeList";
import AdCreativeEditor from "@/components/AdCreativeEditor";
import VariantBuilder from "@/components/VariantBuilder";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

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
    <div className="p-8">
      <PageHeader
        title="Ad Creative Lab"
        description="Create, test, and manage ad creative variants"
        actions={
          <div className="flex gap-2">
            <Button onClick={handleCreateManual} disabled={creating}>
              {creating ? "Creating..." : "New Ad Creative"}
            </Button>
            <Button variant="secondary" onClick={() => setShowVariantBuilder(true)}>
              From Asset / Draft
            </Button>
          </div>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-white"
                : "bg-surface text-text-secondary border border-border hover:bg-surface-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {loading && <div className="text-sm text-text-tertiary py-12 text-center">Loading...</div>}

      {!loading && (
        <div className="flex gap-6 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <AdCreativeList creatives={creatives} selectedId={selected?.id ?? null} onSelect={setSelected} />
          </div>
          <div className="flex-1 min-w-[320px]">
            {selected && (
              <AdCreativeEditor
                key={selected.id}
                creative={selected}
                onSaved={handleSaved}
                onClose={() => setSelected(null)}
              />
            )}
            {!selected && creatives.length > 0 && (
              <div className="border-2 border-dashed border-border rounded-xl py-10 text-center">
                <div className="text-sm text-text-secondary">Select an ad creative to edit</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showVariantBuilder && (
        <VariantBuilder onCreated={handleVariantCreated} onClose={() => setShowVariantBuilder(false)} />
      )}
    </div>
  );
}
