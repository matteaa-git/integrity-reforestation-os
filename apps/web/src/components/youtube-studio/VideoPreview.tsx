"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Asset {
  id: string;
  filename: string;
  media_type: "image" | "video" | "audio";
}

type PreviewMode = "desktop" | "mobile" | "suggested";

interface VideoPreviewProps {
  title: string;
  thumbnail: Asset | null;
  channelName?: string;
  mode: PreviewMode;
}

function ThumbBox({ asset }: { asset: Asset | null }) {
  if (asset) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${API_BASE}/assets/${asset.id}/thumb?size=480`}
        alt="thumbnail"
        className="w-full h-full object-cover"
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a]">
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-8 h-8 rounded-full bg-[#ff0033]/20 flex items-center justify-center">
          <YtIcon size={13} color="#ff0033" />
        </div>
        <span className="text-[8px] text-white/20">thumbnail</span>
      </div>
    </div>
  );
}

function YtIcon({ size = 14, color = "#ff0033" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 461 334" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M451.046,52.06C445.468,31.07,429.025,14.555,408.122,8.958C372.357,0,230.5,0,230.5,0S88.643,0,52.878,8.515C32.418,14.109,15.532,31.069,9.954,52.061C1.455,87.96,1.455,167,1.455,167s0,79.483,8.499,115.383c5.578,20.989,22.021,36.949,42.924,42.547C88.643,334,230.5,334,230.5,334s141.857,0,177.622-8.516c20.903-5.597,37.346-22.113,42.924-43.1C459.545,246.483,459.545,167,459.545,167S459.988,87.96,451.046,52.06z M185.57,238.5l0.002-143L303.822,167L185.57,238.5z"/>
    </svg>
  );
}

function PlayOverlay({ size = 48 }: { size?: number }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="rounded-full bg-black/60 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div
          className="border-t-transparent border-b-transparent border-l-white"
          style={{
            width: 0, height: 0,
            borderTopWidth: size * 0.18,
            borderBottomWidth: size * 0.18,
            borderLeftWidth: size * 0.3,
            borderStyle: "solid",
            borderTopColor: "transparent",
            borderBottomColor: "transparent",
            marginLeft: size * 0.06,
          }}
        />
      </div>
    </div>
  );
}

export default function VideoPreview({
  title,
  thumbnail,
  channelName = "Integrity Reforestation",
  mode,
}: VideoPreviewProps) {
  const displayTitle = title || "Your video title will appear here…";

  // ── Mobile phone frame ──────────────────────────────────────────────────────
  if (mode === "mobile") {
    return (
      <div className="w-[220px] rounded-[24px] border-2 border-white/15 bg-[#0f0f0f] overflow-hidden shadow-2xl">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
          <span className="text-[8px] text-white/50 font-mono">9:41</span>
          <div className="flex items-center gap-0.5">
            {[3, 5, 7].map((h, i) => (
              <div key={i} className="w-0.5 rounded-sm bg-white/60" style={{ height: h }} />
            ))}
          </div>
        </div>
        {/* YT header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
          <YtIcon size={14} />
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#1a6b3c] to-[#0d4a7a]" />
        </div>
        {/* Thumbnail */}
        <div className="relative" style={{ aspectRatio: "16/9" }}>
          <ThumbBox asset={thumbnail} />
          <PlayOverlay size={28} />
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 rounded px-1 py-0.5 text-[7px] text-white font-mono">5:24</span>
        </div>
        {/* Meta */}
        <div className="p-2.5">
          <p className="text-[9px] font-semibold text-white/80 leading-snug line-clamp-2 mb-1.5">{displayTitle}</p>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#1a6b3c] to-[#0d4a7a] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[8px] text-white/40 truncate">{channelName}</p>
              <p className="text-[8px] text-white/25">24K views · 2 days ago</p>
            </div>
            <span className="text-white/25 text-xs">⋮</span>
          </div>
        </div>
        {/* Ghost feed items */}
        {[0, 1].map((i) => (
          <div key={i} className="px-2.5 pb-2 opacity-20">
            <div className="h-11 rounded bg-white/5 mb-1" />
            <div className="h-2 bg-white/8 rounded w-3/4 mb-0.5" />
            <div className="h-1.5 bg-white/5 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // ── Suggested sidebar list ──────────────────────────────────────────────────
  if (mode === "suggested") {
    return (
      <div className="space-y-2 w-full">
        <div className="flex gap-2 p-1.5 rounded-xl bg-white/5 border border-white/10">
          <div className="relative w-[88px] shrink-0 rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <ThumbBox asset={thumbnail} />
            <span className="absolute bottom-0.5 right-0.5 bg-black/80 rounded px-0.5 text-[7px] text-white font-mono">5:24</span>
          </div>
          <div className="flex-1 min-w-0 py-0.5">
            <p className="text-[10px] font-semibold text-white/80 leading-snug line-clamp-2 mb-1">{displayTitle}</p>
            <p className="text-[9px] text-white/35">{channelName}</p>
            <p className="text-[9px] text-white/25">24K views</p>
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-2 p-1.5 opacity-20 pointer-events-none">
            <div className="w-[88px] shrink-0 rounded-lg bg-white/5" style={{ aspectRatio: "16/9" }} />
            <div className="flex-1 py-0.5 space-y-1">
              <div className="h-2.5 bg-white/10 rounded" />
              <div className="h-2 bg-white/8 rounded w-2/3" />
              <div className="h-2 bg-white/5 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Desktop feed ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 w-full">
      {/* Fake search bar chrome */}
      <div className="flex items-center gap-1.5">
        <YtIcon size={16} />
        <div className="flex-1 h-6 rounded-full bg-white/5 border border-white/8" />
        <div className="w-6 h-6 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-[9px] text-white/30">
          ⊕
        </div>
      </div>
      {/* Active card */}
      <div>
        <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: "16/9" }}>
          <ThumbBox asset={thumbnail} />
          <PlayOverlay size={44} />
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 rounded px-1.5 py-0.5 text-[8px] text-white font-mono">5:24</span>
        </div>
        <div className="flex gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1a6b3c] to-[#0d4a7a] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/80 leading-snug line-clamp-2 mb-0.5">{displayTitle}</p>
            <p className="text-[10px] text-white/40">{channelName}</p>
            <p className="text-[10px] text-white/25">24,891 views · 2 days ago</p>
          </div>
          <span className="text-white/25 text-sm shrink-0">⋮</span>
        </div>
      </div>
      {/* Ghost feed cards */}
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-2.5 opacity-20 pointer-events-none">
          <div className="w-[96px] shrink-0 rounded-lg bg-white/5" style={{ aspectRatio: "16/9" }} />
          <div className="flex-1 space-y-1.5 py-0.5">
            <div className="h-2.5 bg-white/10 rounded" />
            <div className="h-2 bg-white/8 rounded w-3/4" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
