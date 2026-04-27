"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  tags: string[];
  visibility: string;
  category: string;
  thumbnail_asset_id: string | null;
  video_url: string | null;
  status: string;
  hook_score: number;
  scheduled_time: string | null;
  published_time: string | null;
  updated_at: string;
}

export interface YouTubeListResponse {
  videos: YouTubeVideo[];
  total: number;
  draft_count: number;
  scheduled_count: number;
  published_count: number;
}

interface Props {
  data: YouTubeListResponse;
  onEdit: () => void;
  onRefresh: () => void;
}

function scoreColor(v: number) {
  if (v >= 70) return "#39de8b";
  if (v >= 40) return "#f59e0b";
  return "#ef4444";
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
      <svg width="14" height="10" viewBox="0 0 461 334" fill="rgba(255,0,51,0.25)" xmlns="http://www.w3.org/2000/svg">
        <path d="M451.046,52.06C445.468,31.07,429.025,14.555,408.122,8.958C372.357,0,230.5,0,230.5,0S88.643,0,52.878,8.515C32.418,14.109,15.532,31.069,9.954,52.061C1.455,87.96,1.455,167,1.455,167s0,79.483,8.499,115.383c5.578,20.989,22.021,36.949,42.924,42.547C88.643,334,230.5,334,230.5,334s141.857,0,177.622-8.516c20.903-5.597,37.346-22.113,42.924-43.1C459.545,246.483,459.545,167,459.545,167S459.988,87.96,451.046,52.06z M185.57,238.5l0.002-143L303.822,167L185.57,238.5z"/>
      </svg>
    </div>
  );
}

export default function DraftsTab({ data, onEdit, onRefresh }: Props) {
  const drafts = data.videos.filter((v) => v.status === "draft" || v.status === "pending");

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft?")) return;
    await fetch(`${API_BASE}/youtube/${id}`, { method: "DELETE" }).catch(() => {});
    onRefresh();
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-5xl mb-3 opacity-15">▶</div>
        <p className="text-sm text-white/30 font-medium">No drafts yet</p>
        <p className="text-xs text-white/20 mt-1">Compose a video to save your first draft</p>
        <button
          onClick={onEdit}
          className="mt-4 px-4 py-2 rounded-xl bg-[#ff0033]/15 text-[#ff0033] text-xs font-semibold border border-[#ff0033]/20 hover:bg-[#ff0033]/25 transition-colors"
        >
          New Video
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white/80">Drafts</h2>
          <p className="text-xs text-white/30 mt-0.5">
            {drafts.length} video{drafts.length !== 1 ? "s" : ""} in progress
          </p>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff0033] hover:bg-[#cc0026] text-xs font-bold text-white transition-colors"
        >
          + New Video
        </button>
      </div>

      <div className="space-y-2">
        {drafts.map((video) => (
          <div
            key={video.id}
            className="flex items-start gap-4 p-4 rounded-xl bg-white/3 border border-white/6 hover:border-white/12 transition-colors group"
          >
            <div
              className="w-24 shrink-0 rounded-lg overflow-hidden"
              style={{ aspectRatio: "16/9" }}
            >
              <YtThumb assetId={video.thumbnail_asset_id} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/80 leading-snug truncate">
                    {video.title || <span className="text-white/25 italic font-normal">Untitled</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                        video.status === "pending"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-white/5 border-white/10 text-white/35"
                      }`}
                    >
                      {video.status}
                    </span>
                    <span className="text-[10px] text-white/25">
                      {video.tags.length} tag{video.tags.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono">
                      {new Date(video.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span
                    className="text-[13px] font-black font-mono tabular-nums"
                    style={{ color: scoreColor(video.hook_score) }}
                  >
                    {video.hook_score}
                  </span>
                  <span className="text-[9px] text-white/20">SEO</span>
                </div>
              </div>

              {video.description && (
                <p className="text-[11px] text-white/30 line-clamp-1 mt-1.5 leading-snug">
                  {video.description}
                </p>
              )}

              {video.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {video.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ff0033]/8 border border-[#ff0033]/15 text-[#ff0033]/60"
                    >
                      {tag}
                    </span>
                  ))}
                  {video.tags.length > 5 && (
                    <span className="text-[9px] text-white/20">+{video.tags.length - 5}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={onEdit}
                className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-[10px] font-medium text-white/60 border border-white/10 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(video.id)}
                className="px-3 py-1.5 rounded-lg bg-red-500/8 hover:bg-red-500/15 text-[10px] font-medium text-red-400/70 border border-red-500/12 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
