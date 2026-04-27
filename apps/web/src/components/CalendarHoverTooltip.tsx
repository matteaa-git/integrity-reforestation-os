"use client";

import type { Draft, ContentFormat, DraftStatus, XPost, LinkedInPost, PinterestPin } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TooltipData {
  draft?: Draft;
  xPost?: XPost;
  linkedInPost?: LinkedInPost;
  pinterestPin?: PinterestPin;
  x: number;
  y: number;
}

interface CalendarHoverTooltipProps {
  data: TooltipData | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORMAT_CONFIG: Record<ContentFormat, { label: string; className: string }> = {
  reel:     { label: "Reel",     className: "bg-emerald-50 text-emerald-700" },
  story:    { label: "Story",    className: "bg-blue-50 text-blue-700"       },
  carousel: { label: "Carousel", className: "bg-amber-50 text-amber-700"     },
};

const STATUS_CONFIG: Record<DraftStatus, { label: string; className: string }> = {
  draft:          { label: "Draft",          className: "text-gray-400"    },
  in_review:      { label: "In Review",      className: "text-amber-600"   },
  approved:       { label: "Approved",       className: "text-emerald-600" },
  rejected:       { label: "Rejected",       className: "text-red-500"     },
  scheduled:      { label: "Scheduled",      className: "text-blue-600"    },
  publishing:     { label: "Publishing…",    className: "text-blue-500"    },
  published:      { label: "Published",      className: "text-emerald-600" },
  publish_failed: { label: "Publish Failed", className: "text-red-500"     },
  failed:         { label: "Failed",         className: "text-red-500"     },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const CURSOR_OFFSET = 12;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarHoverTooltip({ data }: CalendarHoverTooltipProps) {
  const visible = data !== null;
  const x = data?.x ?? 0;
  const y = data?.y ?? 0;

  const vw = typeof window !== "undefined" ? window.innerWidth  : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  const anchorRight  = x > vw / 2;
  const anchorBottom = y > vh / 2;

  const style: React.CSSProperties = {
    position: "fixed", zIndex: 50, pointerEvents: "none",
    ...(anchorRight  ? { right: vw - x + CURSOR_OFFSET, left: "auto"  } : { left: x  + CURSOR_OFFSET, right: "auto"   }),
    ...(anchorBottom ? { bottom: vh - y + CURSOR_OFFSET, top: "auto"  } : { top:  y  + CURSOR_OFFSET, bottom: "auto"  }),
  };

  const baseClass = "bg-white border border-border rounded-lg shadow-lg p-2.5 w-[220px] transition-opacity duration-150";

  // ── Instagram draft ──
  if (data?.draft) {
    const { draft } = data;
    const fmt    = FORMAT_CONFIG[draft.format] ?? FORMAT_CONFIG.reel;
    const status = STATUS_CONFIG[draft.status] ?? STATUS_CONFIG.draft;
    const time   = draft.scheduled_for ? formatTime(draft.scheduled_for) : null;
    return (
      <div style={style} className={`${baseClass} ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
        <div className="mb-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${fmt.className}`}>{fmt.label}</span>
        </div>
        <p className="text-xs font-medium text-text-primary truncate mb-1 leading-snug">{draft.title}</p>
        {time && <p className="text-xs text-text-secondary mb-0.5">{time}</p>}
        <p className={`text-[11px] ${status.className}`}>{status.label}</p>
      </div>
    );
  }

  // ── X post ──
  if (data?.xPost) {
    const { xPost } = data;
    const preview = xPost.post_type === "thread" && xPost.thread_posts?.length
      ? xPost.thread_posts[0]?.text : xPost.content;
    const time = xPost.scheduled_time ? formatTime(xPost.scheduled_time) : null;
    return (
      <div style={style} className={`${baseClass} ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-gray-800 shrink-0">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
            {xPost.post_type === "thread" ? `Thread · ${xPost.thread_posts?.length ?? 0}` : "Post"}
          </span>
        </div>
        <p className="text-xs font-medium text-text-primary line-clamp-2 mb-1 leading-snug">{preview || "Empty post"}</p>
        {time && <p className="text-xs text-text-secondary mb-0.5">{time}</p>}
        <p className="text-[11px] text-blue-600">Scheduled</p>
      </div>
    );
  }

  // ── LinkedIn post ──
  if (data?.linkedInPost) {
    const { linkedInPost } = data;
    const time = linkedInPost.scheduled_time ? formatTime(linkedInPost.scheduled_time) : null;
    return (
      <div style={style} className={`${baseClass} ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#0A66C2" className="shrink-0">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <span className="text-[11px] font-semibold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full capitalize">
            {linkedInPost.post_type}
          </span>
        </div>
        <p className="text-xs font-medium text-text-primary line-clamp-2 mb-1 leading-snug">
          {linkedInPost.content?.slice(0, 100) || "Empty post"}
        </p>
        {time && <p className="text-xs text-text-secondary mb-0.5">{time}</p>}
        <p className="text-[11px] text-blue-600">Scheduled</p>
      </div>
    );
  }

  // ── Pinterest pin ──
  if (data?.pinterestPin) {
    const { pinterestPin } = data;
    const time = pinterestPin.scheduled_time ? formatTime(pinterestPin.scheduled_time) : null;
    return (
      <div style={style} className={`${baseClass} ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#E60023" className="shrink-0">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
          </svg>
          <span className="text-[11px] font-semibold bg-red-50 text-red-700 px-2 py-0.5 rounded-full capitalize">
            {pinterestPin.pin_type}
          </span>
        </div>
        <p className="text-xs font-medium text-text-primary truncate mb-0.5 leading-snug">
          {pinterestPin.title || "Untitled pin"}
        </p>
        <p className="text-[11px] text-text-tertiary line-clamp-1 mb-1">
          {pinterestPin.description?.slice(0, 80)}
        </p>
        {time && <p className="text-xs text-text-secondary mb-0.5">{time}</p>}
        <p className="text-[11px] text-blue-600">Scheduled</p>
      </div>
    );
  }

  return (
    <div style={style} className={`${baseClass} opacity-0 pointer-events-none`} aria-hidden="true" />
  );
}
