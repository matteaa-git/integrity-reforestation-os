"use client";

import { useEffect, useState } from "react";
import type { ContentFormat, Draft, DraftStatus } from "@/lib/api";
import { fetchDraft, fetchDrafts } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_COLORS: Record<DraftStatus, string> = {
  draft:          "bg-gray-100 text-gray-600",
  in_review:      "bg-amber-100 text-amber-700",
  approved:       "bg-emerald-100 text-emerald-700",
  rejected:       "bg-red-100 text-red-700",
  scheduled:      "bg-blue-100 text-blue-700",
  publishing:     "bg-blue-100 text-blue-700",
  published:      "bg-emerald-100 text-emerald-700",
  publish_failed: "bg-red-100 text-red-700",
  failed:         "bg-red-100 text-red-700",
};

// Mini carousel slide colour preview from stored metadata
function CarouselThumb({ metadata }: { metadata: Record<string, unknown> | null }) {
  const slides = (metadata?.slides as unknown[] | undefined) ?? [];
  if (slides.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <span className="text-[10px] text-gray-400">No slides</span>
      </div>
    );
  }
  // Show up to 3 slide colour swatches
  const preview = slides.slice(0, 3) as Array<Record<string, unknown>>;
  return (
    <div className="w-full h-full flex">
      {preview.map((slide, i) => {
        const style = (slide.style ?? {}) as Record<string, unknown>;
        const content = (slide.content ?? {}) as Record<string, unknown>;
        const bg = (style.bgColor as string | undefined) ?? "#1a1a2e";
        const headlineColor = (style.headlineColor as string | undefined) ?? "#ffffff";
        const headline = (content.headline as string | undefined) ?? "";
        return (
          <div
            key={i}
            className="flex-1 flex items-center justify-center overflow-hidden p-1"
            style={{ backgroundColor: bg }}
          >
            {headline && (
              <span
                className="text-center leading-tight font-semibold line-clamp-2"
                style={{ color: headlineColor, fontSize: "7px" }}
              >
                {headline}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Asset thumbnail for story/reel
function AssetThumb({ draft }: { draft: Draft }) {
  const firstAsset = draft.assets?.[0];
  if (!firstAsset) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <span className="text-lg text-gray-300">◫</span>
      </div>
    );
  }
  if (firstAsset.asset.media_type === "image") {
    return (
      <img
        src={`${API_BASE}/assets/${firstAsset.asset_id}/thumb?size=120`}
        alt=""
        className="w-full h-full object-cover"
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-purple-50">
      <span className="text-xl text-purple-300">▶</span>
    </div>
  );
}

interface Props {
  format: ContentFormat;
  onSelect: (draft: Draft) => void;
  onClose: () => void;
}

export default function DraftPickerModal({ format, onSelect, onClose }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | "all">("all");

  useEffect(() => {
    fetchDrafts({ format })
      .then((res) => setDrafts(res.drafts))
      .catch(() => setDrafts([]))
      .finally(() => setLoading(false));
  }, [format]);

  const filtered = drafts.filter((d) => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleOpen = async (draft: Draft) => {
    setOpening(draft.id);
    try {
      // Load full detail (includes assets + metadata)
      const detail = await fetchDraft(draft.id);
      onSelect(detail);
    } catch {
      // fall back to list version
      onSelect(draft);
    } finally {
      setOpening(null);
    }
  };

  const formatLabel: Record<ContentFormat, string> = {
    story: "Story",
    reel: "Reel",
    carousel: "Carousel",
  };

  const STATUS_FILTERS: Array<{ label: string; value: DraftStatus | "all" }> = [
    { label: "All",            value: "all" },
    { label: "Draft",          value: "draft" },
    { label: "In Review",      value: "in_review" },
    { label: "Approved",       value: "approved" },
    { label: "Rejected",       value: "rejected" },
    { label: "Scheduled",      value: "scheduled" },
    { label: "Published",      value: "published" },
    { label: "Failed",         value: "publish_failed" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Open {formatLabel[format]}</h2>
            <p className="text-[11px] text-text-tertiary mt-0.5">Select a saved draft to continue editing</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-border-light shrink-0 space-y-2">
          <input
            type="text"
            placeholder="Search drafts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface-secondary"
          />
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Draft list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="text-3xl text-text-tertiary/20 mb-3">◫</div>
              <div className="text-sm font-medium text-text-secondary mb-1">No drafts found</div>
              <div className="text-[11px] text-text-tertiary">
                {drafts.length === 0
                  ? `Save a ${formatLabel[format].toLowerCase()} draft first to open it here.`
                  : "Try adjusting your search or status filter."}
              </div>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((draft) => {
                const assetCount = draft.assets?.length ?? 0;
                const slideCount =
                  format === "carousel"
                    ? ((draft.metadata?.slides as unknown[] | undefined)?.length ?? 0)
                    : 0;
                const isOpening = opening === draft.id;

                return (
                  <button
                    key={draft.id}
                    onClick={() => handleOpen(draft)}
                    disabled={!!opening}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/3 hover:shadow-sm transition-all group disabled:opacity-60"
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-border-light">
                      {format === "carousel" ? (
                        <CarouselThumb metadata={draft.metadata} />
                      ) : (
                        <AssetThumb draft={draft} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-text-primary truncate group-hover:text-primary transition-colors">
                          {draft.title || "Untitled"}
                        </span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[draft.status as DraftStatus] ?? STATUS_COLORS.draft}`}>
                          {draft.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                        {format === "carousel" && slideCount > 0 && (
                          <span>{slideCount} slide{slideCount !== 1 ? "s" : ""}</span>
                        )}
                        {format !== "carousel" && assetCount > 0 && (
                          <span>{assetCount} asset{assetCount !== 1 ? "s" : ""}</span>
                        )}
                        {format !== "carousel" && assetCount === 0 && (
                          <span className="text-text-tertiary/60">No assets</span>
                        )}
                        <span>·</span>
                        <span>Updated {new Date(draft.updated_at).toLocaleDateString()}</span>
                        {draft.scheduled_for && (
                          <>
                            <span>·</span>
                            <span className="text-info">Scheduled {new Date(draft.scheduled_for).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Open indicator */}
                    <div className="shrink-0 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      {isOpening ? (
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      ) : (
                        "Open →"
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-light bg-surface-secondary shrink-0">
          <div className="text-[10px] text-text-tertiary">
            {filtered.length} draft{filtered.length !== 1 ? "s" : ""} · Opening a draft replaces the current editor state
          </div>
        </div>
      </div>
    </div>
  );
}
