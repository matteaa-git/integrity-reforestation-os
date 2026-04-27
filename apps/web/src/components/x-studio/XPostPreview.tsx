"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ThreadPost {
  position?: number;
  text: string;
  char_count?: number;
}

interface AttachedMedia {
  asset_id: string;
  filename: string;
  media_type: string;
  url: string;
}

interface XPostPreviewProps {
  content: string;
  postType: "single" | "thread" | string;
  threadPosts?: ThreadPost[];
  attachedMedia?: AttachedMedia[];
  hookScore?: number;
  estimatedReach?: number;
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((word, i) => {
        if (word.startsWith("#") && word.length > 1)
          return <span key={i} className="text-[#1d9bf0]">{word}</span>;
        if (word.startsWith("@") && word.length > 1)
          return <span key={i} className="text-[#1d9bf0]">{word}</span>;
        if (/^https?:\/\//.test(word))
          return <span key={i} className="text-[#1d9bf0] underline">{word}</span>;
        return <span key={i}>{word}</span>;
      })}
    </>
  );
}

function MediaGrid({ media }: { media: AttachedMedia[] }) {
  const count = Math.min(media.length, 4);
  if (count === 0) return null;

  const gridClass =
    count === 1 ? "grid-cols-1" :
    count === 2 ? "grid-cols-2" :
    count === 3 ? "grid-cols-2" :
    "grid-cols-2";

  return (
    <div className={`mt-2.5 rounded-2xl overflow-hidden border border-white/10 grid gap-0.5 ${gridClass}`}
         style={{ maxHeight: 220 }}>
      {media.slice(0, 4).map((m, i) => {
        // 3-image layout: first image spans full height on left
        const isSpanning = count === 3 && i === 0;
        return (
          <div
            key={m.asset_id}
            className={`bg-[#1a2030] overflow-hidden ${isSpanning ? "row-span-2" : ""}`}
            style={{ aspectRatio: count === 1 ? "16/9" : "1/1" }}
          >
            {m.media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_BASE}/assets/${m.asset_id}/thumb?size=320`}
                alt={m.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-white/70 text-lg ml-0.5">▶</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EngagementRow({ estimatedReach }: { estimatedReach?: number }) {
  return (
    <div className="flex items-center gap-5 mt-3 pt-0">
      {/* Reply */}
      <button className="flex items-center gap-1.5 group">
        <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-[#1d9bf0]/10 transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               className="text-white/30 group-hover:text-[#1d9bf0] transition-colors">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <span className="text-[11px] text-white/25 group-hover:text-[#1d9bf0] transition-colors">—</span>
      </button>

      {/* Repost */}
      <button className="flex items-center gap-1.5 group">
        <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-[#00ba7c]/10 transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               className="text-white/30 group-hover:text-[#00ba7c] transition-colors">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </div>
        <span className="text-[11px] text-white/25 group-hover:text-[#00ba7c] transition-colors">—</span>
      </button>

      {/* Like */}
      <button className="flex items-center gap-1.5 group">
        <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:bg-[#f91880]/10 transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               className="text-white/30 group-hover:text-[#f91880] transition-colors">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <span className="text-[11px] text-white/25 group-hover:text-[#f91880] transition-colors">—</span>
      </button>

      {/* Views / estimated reach */}
      {estimatedReach !== undefined && estimatedReach > 0 && (
        <div className="ml-auto flex items-center gap-1 text-[11px] text-white/25">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>
            {estimatedReach >= 1000
              ? `${(estimatedReach / 1000).toFixed(1)}K est.`
              : `${estimatedReach} est.`}
          </span>
        </div>
      )}
    </div>
  );
}

export default function XPostPreview({
  content,
  postType,
  threadPosts = [],
  attachedMedia = [],
  hookScore,
  estimatedReach,
}: XPostPreviewProps) {
  const isThread = postType === "thread" && threadPosts.length > 0;
  const posts: { text: string }[] = isThread
    ? threadPosts.map((p) => ({ text: p.text }))
    : [{ text: content }];

  const isEmpty = posts.every((p) => !p.text.trim());

  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1923] overflow-hidden">
      {/* Label bar */}
      <div className="px-3 py-2 border-b border-white/6 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-white/25">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span className="text-[9px] font-mono text-white/25 uppercase tracking-wider">Preview</span>
        </div>
        {isThread && (
          <span className="text-[9px] font-mono text-[#1d9bf0]/60 bg-[#1d9bf0]/8 px-1.5 py-0.5 rounded-full">
            Thread · {posts.length} posts
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        {isEmpty ? (
          <div className="py-6 text-center text-[11px] font-mono text-white/15 italic">
            Start typing to see preview...
          </div>
        ) : (
          <div>
            {posts.map((post, i) => {
              const text = post.text.trim();
              const isLast = i === posts.length - 1;
              return (
                <div key={i} className="flex gap-2.5">
                  {/* Avatar + thread line */}
                  <div className="flex flex-col items-center shrink-0" style={{ width: 36 }}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1a6b3c] to-[#0d4a7a] border border-white/15 flex items-center justify-center text-[11px] font-bold text-white/80 shrink-0">
                      IR
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-white/10 mt-1 min-h-3" />
                    )}
                  </div>

                  {/* Post content */}
                  <div className={`flex-1 min-w-0 ${!isLast ? "pb-4" : ""}`}>
                    {/* Author line */}
                    <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[12px] font-bold text-white/90">Integrity Reforestation</span>
                      <span className="text-[11px] text-white/35">@integrityreforest</span>
                      <span className="text-[11px] text-white/25">·</span>
                      <span className="text-[11px] text-white/25">now</span>
                      {isThread && (
                        <span className="ml-auto text-[9px] font-mono text-white/20">{i + 1}/{posts.length}</span>
                      )}
                    </div>

                    {/* Text */}
                    {text ? (
                      <div className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap break-words">
                        <FormattedText text={text} />
                      </div>
                    ) : (
                      <div className="text-[12px] text-white/20 italic">Empty post...</div>
                    )}

                    {/* Media — only on first post */}
                    {i === 0 && attachedMedia.length > 0 && (
                      <MediaGrid media={attachedMedia} />
                    )}

                    {/* Engagement row — only on last post */}
                    {isLast && (
                      <EngagementRow estimatedReach={estimatedReach} />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Hook score badge */}
            {hookScore !== undefined && hookScore > 0 && (
              <div className="mt-2 pt-2 border-t border-white/6 flex items-center gap-2">
                <span className="text-[9px] font-mono text-white/20">HOOK SCORE</span>
                <div className="h-1 flex-1 bg-white/6 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${hookScore}%`,
                      backgroundColor: hookScore >= 70 ? "#00ff88" : hookScore >= 45 ? "#ff9500" : "#64748b",
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-mono font-bold tabular-nums"
                  style={{ color: hookScore >= 70 ? "#00ff88" : hookScore >= 45 ? "#ff9500" : "#64748b" }}
                >
                  {hookScore}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
