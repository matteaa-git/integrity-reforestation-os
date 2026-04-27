"use client";

import { useRef, useState } from "react";
import type { Asset } from "@/lib/api";
import Badge from "@/components/ui/Badge";

function VideoThumb({ src, duration }: { src: string; duration?: number | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    ref.current?.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (ref.current) {
      ref.current.pause();
      ref.current.currentTime = 0;
    }
  };

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />
      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center mx-auto">
              <span className="text-sm text-black ml-0.5">▶</span>
            </div>
            {duration != null && (
              <div className="text-[10px] text-white/90 mt-1">{duration.toFixed(1)}s</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AssetGridProps {
  assets: Asset[];
  selectedId: string | null;
  onSelect: (asset: Asset) => void;
}

export default function AssetGrid({ assets, selectedId, onSelect }: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-3xl mb-3 opacity-30">◫</div>
        <div className="text-sm text-text-secondary">No assets found. Index a directory to get started.</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {assets.map((asset) => {
        const isSelected = asset.id === selectedId;
        const isImage = asset.media_type === "image";
        const thumbUrl = isImage
          ? `${API_BASE}/assets/${asset.id}/thumb?size=300`
          : `${API_BASE}/assets/${asset.id}/file`;

        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={`rounded-xl border overflow-hidden text-left transition-all ${
              isSelected
                ? "border-primary ring-2 ring-primary/20 bg-blue-50/30"
                : "border-border bg-surface hover:border-primary/30 hover:shadow-md"
            }`}
          >
            <div className="aspect-square relative overflow-hidden bg-gray-100">
              {isImage ? (
                <img
                  src={thumbUrl}
                  alt={asset.filename}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <VideoThumb src={thumbUrl} duration={asset.duration} />
              )}
            </div>
            <div className="p-2.5">
              {asset.description ? (
                <div className="text-[11px] font-medium text-text-primary truncate capitalize">{asset.description}</div>
              ) : (
                <div className="text-[10px] text-text-tertiary truncate">{asset.filename}</div>
              )}
              <div className="flex items-center justify-between mt-1.5 gap-1 flex-wrap">
                <div className="flex items-center gap-1">
                  <Badge variant={asset.media_type === "video" ? "info" : "default"}>
                    {asset.media_type}
                  </Badge>
                  {asset.orientation && (
                    <span className="text-[8px] text-text-tertiary bg-gray-100 px-1 py-0.5 rounded">
                      {asset.orientation === "PORTRAIT" ? "9:16" : "16:9"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-text-tertiary">
                  {asset.file_size < 1024 * 1024
                    ? `${(asset.file_size / 1024).toFixed(0)}KB`
                    : `${(asset.file_size / (1024 * 1024)).toFixed(1)}MB`}
                </span>
              </div>
              {asset.ai_keywords && asset.ai_keywords.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1.5">
                  {asset.ai_keywords.slice(0, 3).map((kw) => (
                    <span key={kw} className="text-[7px] bg-purple-50 text-purple-500 px-1 py-0.5 rounded-full capitalize">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
