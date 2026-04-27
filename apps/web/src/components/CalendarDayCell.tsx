"use client";

import type { Draft, ContentFormat, DraftStatus, XPost, LinkedInPost, PinterestPin } from "@/lib/api";

// ---------------------------------------------------------------------------
// IG format config
// ---------------------------------------------------------------------------

const FORMAT_DOT: Record<ContentFormat, string> = {
  reel:     "bg-emerald-500",
  story:    "bg-blue-500",
  carousel: "bg-amber-500",
};

const FORMAT_PILL_BG: Record<ContentFormat, string> = {
  reel:     "bg-emerald-50 text-emerald-700",
  story:    "bg-blue-50 text-blue-700",
  carousel: "bg-amber-50 text-amber-700",
};

const STATUS_RING: Record<DraftStatus, string> = {
  draft:          "",
  in_review:      "ring-1 ring-offset-[1px] ring-amber-400/70",
  approved:       "ring-1 ring-offset-[1px] ring-emerald-500/70",
  rejected:       "ring-1 ring-offset-[1px] ring-red-400/70",
  scheduled:      "",
  publishing:     "ring-1 ring-offset-[1px] ring-blue-400/70",
  published:      "ring-1 ring-offset-[1px] ring-emerald-500/70",
  publish_failed: "ring-1 ring-offset-[1px] ring-red-400/70",
  failed:         "ring-1 ring-offset-[1px] ring-red-400/70",
};

// ---------------------------------------------------------------------------
// Pills
// ---------------------------------------------------------------------------

function DraftPill({ draft, onDragStart, sourceDate, onMouseEnter, onMouseLeave }: {
  draft: Draft;
  onDragStart: (id: string, date: string) => void;
  sourceDate: string;
  onMouseEnter: (d: Draft, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const dot  = FORMAT_DOT[draft.format]     ?? "bg-gray-400";
  const pill = FORMAT_PILL_BG[draft.format] ?? "bg-gray-50 text-gray-700";
  const ring = STATUS_RING[draft.status]    ?? "";

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", draft.id); e.dataTransfer.effectAllowed = "move"; onDragStart(draft.id, sourceDate); }}
      onMouseEnter={(e) => onMouseEnter(draft, e)}
      onMouseLeave={onMouseLeave}
      title={`${draft.title} · ${draft.format} · ${draft.status}`}
      className={`flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-medium leading-none cursor-grab active:cursor-grabbing select-none truncate w-full min-w-0 hover:brightness-95 transition-[filter] duration-100 ${pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot} ${ring}`} aria-hidden="true" />
      <span className="truncate min-w-0 flex-1">{draft.title}</span>
    </div>
  );
}

function XPostPill({ xPost, onMouseEnter, onMouseLeave }: {
  xPost: XPost;
  onMouseEnter: (p: XPost, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const preview = xPost.post_type === "thread" && xPost.thread_posts?.length
    ? xPost.thread_posts[0]?.text : xPost.content;
  return (
    <div
      onMouseEnter={(e) => onMouseEnter(xPost, e)}
      onMouseLeave={onMouseLeave}
      title={preview || "X post"}
      className="flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-medium leading-none select-none truncate w-full min-w-0 bg-gray-900 text-white/90 hover:bg-gray-700 transition-colors duration-100"
    >
      <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-70">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
      <span className="truncate min-w-0 flex-1">{preview || "X post"}</span>
    </div>
  );
}

function LinkedInPill({ post, onMouseEnter, onMouseLeave }: {
  post: LinkedInPost;
  onMouseEnter: (p: LinkedInPost, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={(e) => onMouseEnter(post, e)}
      onMouseLeave={onMouseLeave}
      title={post.content?.slice(0, 80) || "LinkedIn post"}
      className="flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-medium leading-none select-none truncate w-full min-w-0 bg-[#0A66C2] text-white/90 hover:bg-[#004182] transition-colors duration-100"
    >
      <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-80">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
      <span className="truncate min-w-0 flex-1">{post.content?.slice(0, 40) || "LinkedIn post"}</span>
    </div>
  );
}

function PinterestPill({ pin, onMouseEnter, onMouseLeave }: {
  pin: PinterestPin;
  onMouseEnter: (p: PinterestPin, e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={(e) => onMouseEnter(pin, e)}
      onMouseLeave={onMouseLeave}
      title={pin.title || pin.description?.slice(0, 80) || "Pinterest pin"}
      className="flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-medium leading-none select-none truncate w-full min-w-0 bg-[#E60023] text-white/90 hover:bg-[#c0001d] transition-colors duration-100"
    >
      <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-80">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
      </svg>
      <span className="truncate min-w-0 flex-1">{pin.title || "Pinterest pin"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CalendarDayCellProps {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  drafts: Draft[];
  xPosts: XPost[];
  linkedInPosts: LinkedInPost[];
  pinterestPins: PinterestPin[];
  isSelected: boolean;
  isDragOver: boolean;
  onDragStart: (draftId: string, sourceDate: string) => void;
  onDrop: (targetDateKey: string) => void;
  onDragOver: (dateKey: string) => void;
  onDragLeave: () => void;
  onClick: () => void;
  onDraftMouseEnter: (draft: Draft, e: React.MouseEvent) => void;
  onDraftMouseLeave: () => void;
  onXPostMouseEnter: (p: XPost, e: React.MouseEvent) => void;
  onXPostMouseLeave: () => void;
  onLinkedInMouseEnter: (p: LinkedInPost, e: React.MouseEvent) => void;
  onLinkedInMouseLeave: () => void;
  onPinterestMouseEnter: (p: PinterestPin, e: React.MouseEvent) => void;
  onPinterestMouseLeave: () => void;
}

const MAX_VISIBLE = 4;

// ---------------------------------------------------------------------------
// CalendarDayCell
// ---------------------------------------------------------------------------

export default function CalendarDayCell({
  date, dateKey, isCurrentMonth, isToday,
  drafts, xPosts, linkedInPosts, pinterestPins,
  isSelected, isDragOver,
  onDragStart, onDrop, onDragOver, onDragLeave, onClick,
  onDraftMouseEnter, onDraftMouseLeave,
  onXPostMouseEnter, onXPostMouseLeave,
  onLinkedInMouseEnter, onLinkedInMouseLeave,
  onPinterestMouseEnter, onPinterestMouseLeave,
}: CalendarDayCellProps) {
  type Item =
    | { type: "draft";     draft: Draft }
    | { type: "xpost";     xPost: XPost }
    | { type: "linkedin";  post: LinkedInPost }
    | { type: "pinterest"; pin: PinterestPin };

  const allItems: Item[] = [
    ...drafts.map((d): Item          => ({ type: "draft",     draft: d })),
    ...xPosts.map((p): Item          => ({ type: "xpost",     xPost: p })),
    ...linkedInPosts.map((p): Item   => ({ type: "linkedin",  post: p })),
    ...pinterestPins.map((p): Item   => ({ type: "pinterest", pin: p })),
  ];

  const totalCount    = allItems.length;
  const overflow      = totalCount > MAX_VISIBLE;
  const visibleItems  = overflow ? allItems.slice(0, MAX_VISIBLE - 1) : allItems.slice(0, MAX_VISIBLE);
  const overflowCount = totalCount - visibleItems.length;

  let borderClass: string, bgClass: string;
  if      (isDragOver) { borderClass = "border-2 border-dashed border-primary"; bgClass = "bg-blue-50/60"; }
  else if (isSelected) { borderClass = "border-2 border-primary";               bgClass = "bg-blue-50/30"; }
  else if (isToday)    { borderClass = "border border-primary/30";               bgClass = "bg-blue-50/20"; }
  else                 { borderClass = "border border-transparent";              bgClass = "bg-surface";    }

  return (
    <div
      role="button" tabIndex={0}
      aria-label={`${date.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" })}${totalCount > 0 ? `, ${totalCount} item${totalCount !== 1 ? "s" : ""}` : ""}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(dateKey); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(dateKey); }}
      className={`relative flex flex-col gap-0.5 p-1.5 min-h-[80px] cursor-pointer select-none transition-colors duration-100 rounded-[3px] ${borderClass} ${bgClass} ${!isCurrentMonth ? "opacity-40" : ""} ${!isDragOver ? "hover:bg-surface-secondary" : ""}`}
    >
      {/* Day number + count */}
      <div className="flex items-start justify-between mb-0.5">
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-[11px] leading-none ${isToday ? "font-bold text-primary" : "font-medium text-text-tertiary"}`}>
            {date.getDate()}
          </span>
          {isToday && <span className="block w-1 h-1 rounded-full bg-primary" aria-hidden="true" />}
        </div>
        {totalCount > 0 && (
          <span className="text-[9px] font-semibold text-text-tertiary leading-none tabular-nums" aria-hidden="true">
            {totalCount}
          </span>
        )}
      </div>

      {/* Pills */}
      <div className="flex flex-col gap-[3px] min-w-0 w-full">
        {visibleItems.map((item, i) => {
          if (item.type === "draft")     return <DraftPill     key={item.draft.id}  draft={item.draft}  sourceDate={dateKey} onDragStart={onDragStart} onMouseEnter={onDraftMouseEnter}     onMouseLeave={onDraftMouseLeave} />;
          if (item.type === "xpost")     return <XPostPill     key={item.xPost.id}  xPost={item.xPost}  onMouseEnter={onXPostMouseEnter}     onMouseLeave={onXPostMouseLeave} />;
          if (item.type === "linkedin")  return <LinkedInPill  key={item.post.id}   post={item.post}    onMouseEnter={onLinkedInMouseEnter}  onMouseLeave={onLinkedInMouseLeave} />;
          if (item.type === "pinterest") return <PinterestPill key={item.pin.id}    pin={item.pin}      onMouseEnter={onPinterestMouseEnter} onMouseLeave={onPinterestMouseLeave} />;
          return null;
        })}
        {overflow && overflowCount > 0 && (
          <div className="text-[9px] font-semibold text-text-secondary px-1.5 py-[3px] rounded-md leading-none bg-gray-100 hover:bg-gray-200 transition-colors w-full text-center">
            +{overflowCount} more
          </div>
        )}
      </div>

      {isDragOver && (
        <div aria-hidden="true" className="absolute inset-0 rounded-[3px] flex items-center justify-center pointer-events-none">
          <span className="text-primary/40 text-lg leading-none">+</span>
        </div>
      )}
    </div>
  );
}
