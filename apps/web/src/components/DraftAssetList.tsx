"use client";

import type { DraftAssetEntry } from "@/lib/api";
import Badge from "@/components/ui/Badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DraftAssetListProps {
  entries: DraftAssetEntry[];
  onRemove: (assetId: string) => void;
}

export default function DraftAssetList({ entries, onRemove }: DraftAssetListProps) {
  if (entries.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-xl py-10 text-center">
        <div className="text-2xl opacity-30 mb-2">◫</div>
        <div className="text-sm text-text-secondary">No assets added yet. Click &quot;Add Asset&quot; to get started.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface hover:border-primary/20 transition-colors"
        >
          <div className="w-6 text-center text-xs font-semibold text-text-tertiary">
            {entry.position + 1}
          </div>
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100">
            {entry.asset.media_type === "image" ? (
              <img
                src={`${API_BASE}/assets/${entry.asset_id}/file`}
                alt={entry.asset.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-purple-50 text-purple-300 text-lg">
                ▶
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary truncate">{entry.asset.filename}</div>
            <Badge variant={entry.asset.media_type === "video" ? "info" : "default"}>{entry.asset.media_type}</Badge>
          </div>
          <button
            onClick={() => onRemove(entry.asset_id)}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
