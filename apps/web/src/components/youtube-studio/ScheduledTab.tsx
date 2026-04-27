"use client";

import type { YouTubeVideo } from "./DraftsTab";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Props {
  videos: YouTubeVideo[];
  onEdit: () => void;
  onRefresh: () => void;
}

function YtThumb({ assetId }: { assetId: string | null }) {
  if (assetId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${API_BASE}/assets/${assetId}/thumb?size=160`}
        alt="thumbnail"
        className="w-full h-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-white/5">
      <svg width="12" height="9" viewBox="0 0 461 334" fill="rgba(139,92,246,0.35)" xmlns="http://www.w3.org/2000/svg">
        <path d="M451.046,52.06C445.468,31.07,429.025,14.555,408.122,8.958C372.357,0,230.5,0,230.5,0S88.643,0,52.878,8.515C32.418,14.109,15.532,31.069,9.954,52.061C1.455,87.96,1.455,167,1.455,167s0,79.483,8.499,115.383c5.578,20.989,22.021,36.949,42.924,42.547C88.643,334,230.5,334,230.5,334s141.857,0,177.622-8.516c20.903-5.597,37.346-22.113,42.924-43.1C459.545,246.483,459.545,167,459.545,167S459.988,87.96,451.046,52.06z M185.57,238.5l0.002-143L303.822,167L185.57,238.5z"/>
      </svg>
    </div>
  );
}

function formatScheduled(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeUntil(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "overdue";
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `in ${d}d`;
  if (h > 0) return `in ${h}h`;
  return "soon";
}

export default function ScheduledTab({ videos, onEdit, onRefresh }: Props) {
  async function handleCancel(id: string) {
    if (!confirm("Cancel this scheduled video?")) return;
    await fetch(`${API_BASE}/youtube/${id}/unschedule`, { method: "POST" }).catch(() => {});
    onRefresh();
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-5xl mb-3 opacity-15">🕐</div>
        <p className="text-sm text-white/30 font-medium">No scheduled videos</p>
        <p className="text-xs text-white/20 mt-1">Schedule a draft to publish it automatically</p>
        <button
          onClick={onEdit}
          className="mt-4 px-4 py-2 rounded-xl bg-violet-500/15 text-violet-400 text-xs font-semibold border border-violet-500/20 hover:bg-violet-500/25 transition-colors"
        >
          Compose Video
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white/80">Scheduled</h2>
          <p className="text-xs text-white/30 mt-0.5">
            {videos.length} video{videos.length !== 1 ? "s" : ""} queued
          </p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/15 text-violet-400 text-xs font-semibold border border-violet-500/20 hover:bg-violet-500/25 transition-colors"
        >
          + Compose
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {videos
          .sort((a, b) => {
            const ta = a.scheduled_time ? new Date(a.scheduled_time).getTime() : 0;
            const tb = b.scheduled_time ? new Date(b.scheduled_time).getTime() : 0;
            return ta - tb;
          })
          .map((video) => {
            const until = timeUntil(video.scheduled_time);
            const isOverdue = until === "overdue";
            return (
              <div
                key={video.id}
                className="flex items-start gap-4 p-4 rounded-xl bg-white/3 border border-white/6 hover:border-white/12 transition-colors group"
              >
                <div
                  className="w-20 shrink-0 rounded-lg overflow-hidden"
                  style={{ aspectRatio: "16/9" }}
                >
                  <YtThumb assetId={video.thumbnail_asset_id} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/80 leading-snug truncate mb-1">
                    {video.title || <span className="text-white/25 italic font-normal">Untitled</span>}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px]">🕐</span>
                      <span className="text-[11px] text-white/50 font-mono">
                        {formatScheduled(video.scheduled_time)}
                      </span>
                    </div>
                    {until && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                          isOverdue
                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                            : "bg-violet-500/10 border-violet-500/20 text-violet-400"
                        }`}
                      >
                        {until}
                      </span>
                    )}
                    <span className="text-[10px] text-white/25">
                      {video.visibility}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={onEdit}
                    className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-[10px] font-medium text-white/60 border border-white/10 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleCancel(video.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/8 hover:bg-red-500/15 text-[10px] font-medium text-red-400/70 border border-red-500/12 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
