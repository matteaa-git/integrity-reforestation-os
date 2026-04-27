"use client";

import { useRouter } from "next/navigation";
import type { Asset } from "@/lib/api";
import Badge from "@/components/ui/Badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AssetPreviewProps {
  asset: Asset | null;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetPreview({ asset, onClose }: AssetPreviewProps) {
  const router = useRouter();
  if (!asset) return null;

  const useIn = (path: string) => {
    router.push(`${path}?asset=${asset.id}`);
  };

  const rows: { label: string; value: string }[] = [
    { label: "Filename", value: asset.filename },
    { label: "Type", value: asset.media_type },
    ...(asset.extension ? [{ label: "Extension", value: asset.extension }] : []),
    { label: "Size", value: formatBytes(asset.file_size) },
    ...(asset.width && asset.height ? [{ label: "Dimensions", value: `${asset.width} × ${asset.height}` }] : []),
    ...(asset.duration != null ? [{ label: "Duration", value: `${asset.duration.toFixed(1)}s` }] : []),
  ];

  const libraryRows: { label: string; value: string }[] = [
    ...(asset.relative_path ? [{ label: "Relative Path", value: asset.relative_path }] : []),
    ...(asset.category ? [{ label: "Category", value: asset.category }] : []),
    ...(asset.project ? [{ label: "Project", value: asset.project }] : []),
    ...(asset.pillar ? [{ label: "Pillar", value: asset.pillar }] : []),
    ...(asset.subject ? [{ label: "Subject", value: asset.subject }] : []),
    ...(asset.action ? [{ label: "Action", value: asset.action }] : []),
    ...(asset.orientation ? [{ label: "Orientation", value: asset.orientation }] : []),
    ...(asset.content_type ? [{ label: "Content Type", value: asset.content_type.replace("_", " ") }] : []),
    ...(asset.description ? [{ label: "Description", value: asset.description }] : []),
    ...(asset.ai_confidence != null ? [{ label: "AI Confidence", value: `${(asset.ai_confidence * 100).toFixed(0)}%` }] : []),
  ];

  return (
    <div className="w-80 shrink-0 border-l border-border bg-surface p-5 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Preview</h3>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">&times;</button>
      </div>

      <div className="aspect-square rounded-xl overflow-hidden mb-4 bg-gray-100">
        {asset.media_type === "image" ? (
          <img
            src={`${API_BASE}/assets/${asset.id}/file`}
            alt={asset.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-purple-50">
            <div className="text-center">
              <div className="text-4xl text-purple-300 mb-1">▶</div>
              <div className="text-xs text-purple-400">
                {asset.duration != null ? `${asset.duration.toFixed(1)}s` : "Video"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge variant={asset.media_type === "video" ? "info" : "default"}>{asset.media_type}</Badge>
        <span className="text-xs text-text-tertiary">{formatBytes(asset.file_size)}</span>
        {asset.project && <Badge variant="success">{asset.project}</Badge>}
        {asset.category && <Badge variant="muted">{asset.category}</Badge>}
      </div>

      {/* File details */}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{row.label}</div>
            <div className="text-sm text-text-primary mt-0.5 break-all">{row.value}</div>
          </div>
        ))}
      </div>

      {/* Library metadata */}
      {libraryRows.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">Library Metadata</div>
          <div className="space-y-2.5">
            {libraryRows.map((row) => (
              <div key={row.label}>
                <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{row.label}</div>
                <div className="text-sm text-text-primary mt-0.5 break-all">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Keywords */}
      {asset.ai_keywords && asset.ai_keywords.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">AI Keywords</div>
          <div className="flex flex-wrap gap-1">
            {asset.ai_keywords.map((kw) => (
              <span key={kw} className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full capitalize border border-purple-100">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Absolute path */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">Full Path</div>
        <div className="text-[11px] text-text-tertiary mt-0.5 break-all font-mono">{asset.path}</div>
      </div>

      <div className="mt-3">
        <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">ID</div>
        <div className="text-[11px] text-text-tertiary mt-0.5 break-all font-mono">{asset.id}</div>
      </div>

      {/* Use in content */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-2">Use In</div>
        <div className="flex flex-col gap-1.5">
          {(asset.media_type === "video" || asset.media_type === "image") && (
            <button
              onClick={() => useIn("/reels/new")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold border border-emerald-200/60 transition-colors text-left"
            >
              <span className="text-base leading-none">▶</span>
              New Reel
            </button>
          )}
          <button
            onClick={() => useIn("/stories/new")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold border border-blue-200/60 transition-colors text-left"
          >
            <span className="text-base leading-none">◻</span>
            New Story
          </button>
          <button
            onClick={() => useIn("/carousels/new")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-semibold border border-amber-200/60 transition-colors text-left"
          >
            <span className="text-base leading-none">⊞</span>
            New Carousel
          </button>
        </div>
      </div>
    </div>
  );
}
