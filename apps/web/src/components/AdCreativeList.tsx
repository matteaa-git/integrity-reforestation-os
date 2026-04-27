"use client";

import type { AdCreative } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

interface AdCreativeListProps {
  creatives: AdCreative[];
  selectedId: string | null;
  onSelect: (creative: AdCreative) => void;
}

const STATUS_BADGE: Record<string, "default" | "success" | "muted"> = {
  draft: "default",
  ready: "success",
  archived: "muted",
};

export default function AdCreativeList({ creatives, selectedId, onSelect }: AdCreativeListProps) {
  if (creatives.length === 0) {
    return <EmptyState icon="◫" title="No ad creatives" description="Create one from an asset or draft." />;
  }

  return (
    <div className="space-y-2">
      {creatives.map((c) => {
        const isSelected = c.id === selectedId;
        return (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            className={`rounded-xl border p-3 cursor-pointer transition-all ${
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-surface hover:border-primary/20"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-text-primary">{c.title}</span>
              <Badge variant={STATUS_BADGE[c.status] ?? "default"}>
                {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
              </Badge>
            </div>
            {(c.hook_text || c.cta_text) && (
              <div className="text-xs text-text-tertiary mt-1">
                {c.hook_text && <span>Hook: {c.hook_text}</span>}
                {c.hook_text && c.cta_text && <span> &middot; </span>}
                {c.cta_text && <span>CTA: {c.cta_text}</span>}
              </div>
            )}
            {c.thumbnail_label && (
              <div className="text-[11px] text-text-tertiary mt-0.5">
                Variant: {c.thumbnail_label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
