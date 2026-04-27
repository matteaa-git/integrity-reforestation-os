"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface LinkedInPreviewProps {
  content: string;
  postType: string;
  hashtags: string[];
  visibility: string;
  score: number;
  estimatedReach: number;
}

// ---------------------------------------------------------------------------
// Formatted text — linkifies #hashtags and @mentions
// ---------------------------------------------------------------------------
function FormattedContent({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("#"))
          return <span key={i} className="text-[#0a66c2] cursor-pointer hover:underline">{part}</span>;
        if (part.startsWith("@"))
          return <span key={i} className="text-[#0a66c2] cursor-pointer hover:underline">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// LinkedIn Post Preview Card
// ---------------------------------------------------------------------------
const POST_TYPE_LABELS: Record<string, string> = {
  text: "",
  article: "Article",
  poll: "Poll",
  document: "Document",
  image: "Photo",
  video: "Video",
};

const REACTION_EMOJIS = ["👍", "🎉", "❤️", "💡", "🤝"];

export default function LinkedInPreview({
  content,
  postType,
  hashtags,
  visibility,
  score,
  estimatedReach,
}: LinkedInPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [reacted, setReacted] = useState(false);

  const fullText = content + (hashtags.length ? "\n\n" + hashtags.join(" ") : "");
  const lines = fullText.split("\n");
  const isLong = lines.length > 4 || fullText.length > 280;
  const displayText = !isLong || expanded ? fullText : lines.slice(0, 4).join("\n");

  // Simulated engagement counts based on score
  const reactions = Math.round(estimatedReach * 0.025 + score * 0.4);
  const comments = Math.round(estimatedReach * 0.008 + score * 0.1);
  const reposts = Math.round(estimatedReach * 0.004 + score * 0.05);

  return (
    <div className="space-y-4">
      {/* Feed card */}
      <div className="bg-white rounded-xl border border-[#e0e0e0] shadow-sm overflow-hidden font-[system-ui,sans-serif]">
        {/* Post header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-[#002a27] flex items-center justify-center shrink-0 text-white text-lg font-bold">
            IR
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-[#191919] leading-tight">
              Integrity Reforestation
            </div>
            <div className="text-[12px] text-[#666666] leading-tight">
              Tree Planting Services · <span className="text-[#0a66c2]">1st</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[11px] text-[#666666]">1h</span>
              <span className="text-[11px] text-[#666666]">·</span>
              <span className="text-[11px] text-[#666666]">
                {visibility === "public" ? "🌍" : "👥"}
              </span>
              {POST_TYPE_LABELS[postType] && (
                <>
                  <span className="text-[11px] text-[#666666]">·</span>
                  <span className="text-[10px] font-medium text-[#0a66c2] border border-[#0a66c2]/30 rounded px-1">
                    {POST_TYPE_LABELS[postType]}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className="text-[#0a66c2] text-[13px] font-semibold hover:bg-[#0a66c2]/10 px-2 py-1 rounded-full transition-colors">
            + Follow
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          {content ? (
            <div className="text-[14px] text-[#191919] leading-[1.5] whitespace-pre-wrap">
              <FormattedContent text={displayText} />
              {isLong && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-[#666666] hover:text-[#0a66c2] ml-1 font-medium text-[13px]"
                >
                  {expanded ? "…show less" : "…see more"}
                </button>
              )}
            </div>
          ) : (
            <div className="text-[13px] text-[#999] italic">Start typing to see your post preview…</div>
          )}
        </div>

        {/* Document / Article / Poll placeholder */}
        {postType === "document" && content && (
          <div className="mx-4 mb-3 rounded-lg border border-[#e0e0e0] overflow-hidden bg-[#f9f9f9] flex items-center gap-3 p-3">
            <div className="w-10 h-10 bg-[#e8f4f1] rounded flex items-center justify-center text-[#002a27] text-lg">📄</div>
            <div>
              <div className="text-[12px] font-semibold text-[#191919]">Field Report</div>
              <div className="text-[11px] text-[#666666]">PDF · 1 page</div>
            </div>
          </div>
        )}
        {postType === "article" && content && (
          <div className="mx-4 mb-3 rounded-lg border border-[#e0e0e0] overflow-hidden bg-gradient-to-r from-[#002a27] to-[#348050] p-4">
            <div className="text-[11px] text-[#39de8b] font-semibold mb-1 uppercase tracking-wide">Article</div>
            <div className="text-[13px] font-bold text-white leading-snug line-clamp-2">
              {content.split("\n")[0] || "Untitled Article"}
            </div>
          </div>
        )}
        {postType === "poll" && (
          <div className="mx-4 mb-3 rounded-lg border border-[#e0e0e0] overflow-hidden p-3 space-y-2">
            {["Option 1", "Option 2", "Option 3"].map((opt, i) => (
              <div key={i} className="relative rounded-lg border border-[#0a66c2]/30 overflow-hidden cursor-pointer hover:border-[#0a66c2] transition-colors">
                <div
                  className="absolute inset-0 bg-[#0a66c2]/8"
                  style={{ width: `${[52, 30, 18][i]}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2">
                  <span className="text-[13px] text-[#191919]">{opt}</span>
                  <span className="text-[12px] text-[#666666]">{[52, 30, 18][i]}%</span>
                </div>
              </div>
            ))}
            <div className="text-[11px] text-[#666666]">128 votes · 3 days left</div>
          </div>
        )}

        {/* Engagement stats */}
        {content && (
          <div className="px-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="flex -space-x-0.5">
                {REACTION_EMOJIS.slice(0, 3).map((e, i) => (
                  <span key={i} className="text-[13px]">{e}</span>
                ))}
              </div>
              <span className="text-[12px] text-[#666666] ml-1 hover:text-[#0a66c2] cursor-pointer">
                {(reactions + (reacted ? 1 : 0)).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#666666]">
              <span className="hover:text-[#0a66c2] cursor-pointer">{comments} comments</span>
              <span>·</span>
              <span className="hover:text-[#0a66c2] cursor-pointer">{reposts} reposts</span>
            </div>
          </div>
        )}

        {/* Divider */}
        {content && <div className="mx-4 border-t border-[#e0e0e0]" />}

        {/* Action bar */}
        <div className="px-2 py-1 flex items-center">
          {[
            { icon: "👍", label: "Like", active: reacted },
            { icon: "💬", label: "Comment", active: false },
            { icon: "🔄", label: "Repost", active: false },
            { icon: "📤", label: "Send", active: false },
          ].map(({ icon, label, active }) => (
            <button
              key={label}
              onClick={label === "Like" ? () => setReacted(!reacted) : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-semibold transition-colors hover:bg-[#f0f0f0] ${
                active ? "text-[#0a66c2]" : "text-[#666666]"
              }`}
            >
              <span className="text-base">{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Thought Leadership Score */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wide">
            Thought Leadership Score
          </span>
          <span className={`text-sm font-bold ${
            score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-text-tertiary"
          }`}>
            {score}/100
          </span>
        </div>
        <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-gray-300"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="text-[10px] text-text-tertiary">
          {score >= 75
            ? "Elite thought leadership — high virality potential"
            : score >= 50
            ? "Strong professional content — good engagement expected"
            : score >= 25
            ? "Developing — add a stronger hook or data points"
            : "Draft stage — complete your post to score higher"}
        </div>

        {/* Est. reach */}
        <div className="pt-1 border-t border-border-light flex items-center justify-between">
          <span className="text-[10px] text-text-tertiary">Est. Reach</span>
          <span className="text-[11px] font-semibold text-primary">
            {estimatedReach.toLocaleString()} connections
          </span>
        </div>
      </div>
    </div>
  );
}
