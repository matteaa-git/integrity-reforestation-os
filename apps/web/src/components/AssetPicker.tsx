"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Asset } from "@/lib/api";
import { fetchAssets } from "@/lib/api";

const PAGE_SIZE = 100;

function VideoThumb({ src }: { src: string }) {
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
          <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
            <span className="text-xs text-black ml-0.5">▶</span>
          </div>
        </div>
      )}
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AssetPickerProps {
  onSelect: (asset: Asset) => void;
  onClose: () => void;
  excludeIds?: string[];
}

export default function AssetPicker({ onSelect, onClose, excludeIds = [] }: AssetPickerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState("");

  // Reset and reload from scratch when filters change
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setAssets([]);
    setOffset(0);
    try {
      const params: Parameters<typeof fetchAssets>[0] = {
        limit: PAGE_SIZE,
        offset: 0,
      };
      if (mediaFilter) params.media_type = mediaFilter;
      if (search) params.search = search;
      const data = await fetchAssets(params);
      setAssets(data.assets.filter((a) => !excludeIds.includes(a.id)));
      setTotal(data.total);
      setOffset(PAGE_SIZE);
    } catch {
      setAssets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [mediaFilter, search, excludeIds]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const params: Parameters<typeof fetchAssets>[0] = {
        limit: PAGE_SIZE,
        offset,
      };
      if (mediaFilter) params.media_type = mediaFilter;
      if (search) params.search = search;
      const data = await fetchAssets(params);
      const fresh = data.assets.filter((a) => !excludeIds.includes(a.id));
      setAssets((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        return [...prev, ...fresh.filter((a) => !existingIds.has(a.id))];
      });
      setTotal(data.total);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch {
      // keep existing assets
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = assets.length < total;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface rounded-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Select Asset</h3>
            {!loading && (
              <span className="text-[11px] text-text-tertiary font-mono">
                {assets.length}{total > assets.length ? `/${total}` : ""} shown
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg">&times;</button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-5 py-3 border-b border-border-light">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="text-sm text-text-tertiary py-8 text-center">Loading…</div>
          )}
          {!loading && assets.length === 0 && (
            <div className="text-sm text-text-tertiary py-8 text-center">No assets available.</div>
          )}
          {!loading && assets.length > 0 && (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onSelect(asset)}
                    className="rounded-lg border border-border overflow-hidden text-left hover:border-primary/40 hover:shadow-sm transition-all"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-100">
                      {asset.media_type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_BASE}/assets/${asset.id}/file`}
                          alt={asset.filename}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <VideoThumb src={`${API_BASE}/assets/${asset.id}/file`} />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-[11px] font-medium text-text-primary truncate">{asset.filename}</div>
                      <div className="text-[10px] text-text-tertiary">{asset.media_type}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="mt-5 flex flex-col items-center gap-1.5">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin" />
                        Loading…
                      </>
                    ) : (
                      `Load more (${total - assets.length} remaining)`
                    )}
                  </button>
                  <span className="text-[10px] text-text-tertiary">
                    Showing {assets.length} of {total}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
