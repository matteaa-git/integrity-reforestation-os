"use client";

// EXTENSIBILITY NOTES
// ===================
// Future hook shape (extract when multi-account or campaign filtering is needed):
//   useCalendarData({ accountId?: string; campaignId?: string; year: number; month: number })
//   → { drafts, xPosts, linkedInPosts, pinterestPins, byDate, xByDate, linkedInByDate, pinterestByDate, loading, error, load }
//
// byDate is Record<string, Draft[]> keyed by "YYYY-MM-DD". Each value is an ordered array
// supporting multiple content types per day. Extend with additional status filters or
// content-type discriminators without changing CalendarDayCell's prop contract.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentFormat, Draft, XPost, LinkedInPost, PinterestPin } from "@/lib/api";
import {
  deleteDraft,
  duplicateDraft,
  fetchDrafts,
  listXDrafts,
  rescheduleDraft,
  scheduleXPost,
  listLinkedInDrafts,
  scheduleLinkedInPost,
  listPinterestDrafts,
  schedulePinterestPin,
} from "@/lib/api";
import CalendarDayCell from "@/components/CalendarDayCell";
import CalendarPreviewPanel from "@/components/CalendarPreviewPanel";
import CalendarHoverTooltip, { type TooltipData } from "@/components/CalendarHoverTooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DragItem {
  draftId: string;
  sourceDate: string; // "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function toDateKey(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let i = 0; i < first.getDay(); i++) {
    days.push(new Date(year, month, -first.getDay() + i + 1));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  while (days.length % 7 !== 0) {
    days.push(new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1));
  }
  return days;
}

const FORMAT_ROUTES: Record<ContentFormat, string> = {
  reel:     "/reels/new",
  story:    "/stories/new",
  carousel: "/carousels/new",
};

const LEGEND = [
  { label: "Reel",     dotClass: "bg-emerald-500" },
  { label: "Story",    dotClass: "bg-blue-500"    },
  { label: "Carousel", dotClass: "bg-amber-500"   },
] as const;

// ---------------------------------------------------------------------------
// Week-view placeholder
// ---------------------------------------------------------------------------

function WeekViewPlaceholder() {
  return (
    <div className="flex items-center justify-center py-20 border border-dashed border-border rounded-xl">
      <div className="text-center">
        <div className="text-2xl text-text-tertiary/30 mb-2" aria-hidden="true">▦</div>
        <div className="text-sm font-medium text-text-secondary">Week View</div>
        <div className="text-xs text-text-tertiary mt-1">Coming soon</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export default function CalendarView() {
  const router = useRouter();
  const now    = new Date();

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [year,     setYear]     = useState(now.getFullYear());
  const [month,    setMonth]    = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  // ── Filter toggles ──────────────────────────────────────────────────────────
  const [showIG,        setShowIG]        = useState(true);
  const [showX,         setShowX]         = useState(true);
  const [showLinkedIn,  setShowLinkedIn]  = useState(true);
  const [showPinterest, setShowPinterest] = useState(true);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [drafts,        setDrafts]        = useState<Draft[]>([]);
  const [xPosts,        setXPosts]        = useState<XPost[]>([]);
  const [linkedInPosts, setLinkedInPosts] = useState<LinkedInPost[]>([]);
  const [pinterestPins, setPinterestPins] = useState<PinterestPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Interaction ────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [tooltipData,  setTooltipData]  = useState<TooltipData | null>(null);
  const [dragItem,     setDragItem]     = useState<DragItem | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const tooltipLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start    = new Date(year, month, 1).toISOString();
      const end      = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

      const [igRes, xRes, liRes, pinRes] = await Promise.all([
        fetchDrafts({ status: "scheduled", scheduled_after: start, scheduled_before: end }),
        listXDrafts({ status: "scheduled", limit: 200 }),
        listLinkedInDrafts({ status: "scheduled", limit: 200 }),
        listPinterestDrafts({ status: "scheduled", limit: 200 }),
      ]);

      setDrafts(igRes.drafts);

      // Filter X posts to the current month
      const monthXPosts = (xRes.posts ?? []).filter((p) => {
        if (!p.scheduled_time) return false;
        return p.scheduled_time.slice(0, 7) === monthKey;
      });
      setXPosts(monthXPosts);

      // Filter LinkedIn posts to the current month
      const monthLinkedIn = (liRes.posts ?? []).filter((p) => {
        if (!p.scheduled_time) return false;
        return p.scheduled_time.slice(0, 7) === monthKey;
      });
      setLinkedInPosts(monthLinkedIn);

      // Filter Pinterest pins to the current month
      const monthPinterest = (pinRes.pins ?? []).filter((p) => {
        if (!p.scheduled_time) return false;
        return p.scheduled_time.slice(0, 7) === monthKey;
      });
      setPinterestPins(monthPinterest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar");
      setDrafts([]);
      setXPosts([]);
      setLinkedInPosts([]);
      setPinterestPins([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // ── Derived: byDate maps ────────────────────────────────────────────────────
  const byDate = useMemo<Record<string, Draft[]>>(() => {
    if (!showIG) return {};
    const map: Record<string, Draft[]> = {};
    for (const draft of drafts) {
      if (!draft.scheduled_for) continue;
      const key = draft.scheduled_for.slice(0, 10);
      (map[key] ??= []).push(draft);
    }
    return map;
  }, [drafts, showIG]);

  const xByDate = useMemo<Record<string, XPost[]>>(() => {
    if (!showX) return {};
    const map: Record<string, XPost[]> = {};
    for (const post of xPosts) {
      if (!post.scheduled_time) continue;
      const key = post.scheduled_time.slice(0, 10);
      (map[key] ??= []).push(post);
    }
    return map;
  }, [xPosts, showX]);

  const linkedInByDate = useMemo<Record<string, LinkedInPost[]>>(() => {
    if (!showLinkedIn) return {};
    const map: Record<string, LinkedInPost[]> = {};
    for (const post of linkedInPosts) {
      if (!post.scheduled_time) continue;
      const key = post.scheduled_time.slice(0, 10);
      (map[key] ??= []).push(post);
    }
    return map;
  }, [linkedInPosts, showLinkedIn]);

  const pinterestByDate = useMemo<Record<string, PinterestPin[]>>(() => {
    if (!showPinterest) return {};
    const map: Record<string, PinterestPin[]> = {};
    for (const pin of pinterestPins) {
      if (!pin.scheduled_time) continue;
      const key = pin.scheduled_time.slice(0, 10);
      (map[key] ??= []).push(pin);
    }
    return map;
  }, [pinterestPins, showPinterest]);

  // ── Navigation handlers ─────────────────────────────────────────────────────
  const goToPrev = () => {
    setSelectedDate(null);
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else             { setMonth((m) => m - 1); }
  };

  const goToNext = () => {
    setSelectedDate(null);
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else              { setMonth((m) => m + 1); }
  };

  const goToToday = () => {
    setSelectedDate(null);
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const handleDragStart = useCallback((draftId: string, sourceDate: string) => {
    setDragItem({ draftId, sourceDate });
  }, []);

  const handleDrop = useCallback(async (targetDateKey: string) => {
    if (!dragItem) return;
    const { draftId, sourceDate } = dragItem;
    setDragItem(null);
    setDragOverDate(null);
    if (sourceDate === targetDateKey) return;

    const sourceDraft = drafts.find((d) => d.id === draftId);
    if (!sourceDraft) return;

    let timeComponent = "12:00:00.000Z";
    if (sourceDraft.scheduled_for) {
      const orig = new Date(sourceDraft.scheduled_for);
      const hh = String(orig.getUTCHours()).padStart(2, "0");
      const mm = String(orig.getUTCMinutes()).padStart(2, "0");
      const ss = String(orig.getUTCSeconds()).padStart(2, "0");
      timeComponent = `${hh}:${mm}:${ss}.000Z`;
    }

    try {
      await rescheduleDraft(draftId, `${targetDateKey}T${timeComponent}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to move draft");
    }
  }, [dragItem, drafts, load]);

  // ── Mutation handlers ───────────────────────────────────────────────────────
  const handleDelete = useCallback(async (draftId: string) => {
    try {
      await deleteDraft(draftId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete draft");
    }
  }, [load]);

  const handleDuplicate = useCallback(async (draft: Draft) => {
    try {
      await duplicateDraft(draft.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate draft");
    }
  }, [load]);

  const handleReschedule = useCallback(async (draftId: string, newDatetime: string) => {
    try {
      await rescheduleDraft(draftId, newDatetime);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule draft");
    }
  }, [load]);

  const handleRescheduleX = useCallback(async (postId: string, newDatetime: string) => {
    try {
      await scheduleXPost(postId, newDatetime);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule X post");
    }
  }, [load]);

  const handleRescheduleLinkedIn = useCallback(async (postId: string, newDatetime: string) => {
    try {
      await scheduleLinkedInPost(postId, newDatetime);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule LinkedIn post");
    }
  }, [load]);

  const handleReschedulePinterest = useCallback(async (pinId: string, newDatetime: string) => {
    try {
      await schedulePinterestPin(pinId, newDatetime);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule Pinterest pin");
    }
  }, [load]);

  const handleEdit = useCallback((draft: Draft) => {
    const route = FORMAT_ROUTES[draft.format] ?? "/reels/new";
    router.push(`${route}?draft=${draft.id}`);
  }, [router]);

  // ── Tooltip handlers ────────────────────────────────────────────────────────
  const handleDraftMouseEnter = useCallback((draft: Draft, event: React.MouseEvent) => {
    if (tooltipLeaveTimer.current) { clearTimeout(tooltipLeaveTimer.current); tooltipLeaveTimer.current = null; }
    setTooltipData({ draft, x: event.clientX, y: event.clientY });
  }, []);

  const handleDraftMouseLeave = useCallback(() => {
    tooltipLeaveTimer.current = setTimeout(() => setTooltipData(null), 120);
  }, []);

  const handleXPostMouseEnter = useCallback((xPost: XPost, event: React.MouseEvent) => {
    if (tooltipLeaveTimer.current) { clearTimeout(tooltipLeaveTimer.current); tooltipLeaveTimer.current = null; }
    setTooltipData({ xPost, x: event.clientX, y: event.clientY });
  }, []);

  const handleXPostMouseLeave = useCallback(() => {
    tooltipLeaveTimer.current = setTimeout(() => setTooltipData(null), 120);
  }, []);

  const handleLinkedInMouseEnter = useCallback((post: LinkedInPost, event: React.MouseEvent) => {
    if (tooltipLeaveTimer.current) { clearTimeout(tooltipLeaveTimer.current); tooltipLeaveTimer.current = null; }
    setTooltipData({ linkedInPost: post, x: event.clientX, y: event.clientY });
  }, []);

  const handleLinkedInMouseLeave = useCallback(() => {
    tooltipLeaveTimer.current = setTimeout(() => setTooltipData(null), 120);
  }, []);

  const handlePinterestMouseEnter = useCallback((pin: PinterestPin, event: React.MouseEvent) => {
    if (tooltipLeaveTimer.current) { clearTimeout(tooltipLeaveTimer.current); tooltipLeaveTimer.current = null; }
    setTooltipData({ pinterestPin: pin, x: event.clientX, y: event.clientY });
  }, []);

  const handlePinterestMouseLeave = useCallback(() => {
    tooltipLeaveTimer.current = setTimeout(() => setTooltipData(null), 120);
  }, []);

  // ── Derived calendar values ─────────────────────────────────────────────────
  const days       = getMonthDays(year, month);
  const todayKey   = toDateKey(now);
  const monthLabel = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });

  const selectedDateKey        = selectedDate ? toDateKey(selectedDate) : null;
  const selectedDateDrafts     = selectedDateKey ? (byDate[selectedDateKey]        ?? []) : [];
  const selectedDateXPosts     = selectedDateKey ? (xByDate[selectedDateKey]       ?? []) : [];
  const selectedDateLinkedIn   = selectedDateKey ? (linkedInByDate[selectedDateKey] ?? []) : [];
  const selectedDatePinterest  = selectedDateKey ? (pinterestByDate[selectedDateKey] ?? []) : [];

  const totalVisible = drafts.length + xPosts.length + linkedInPosts.length + pinterestPins.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-[11px] text-red-700 mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3 text-base leading-none">&times;</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={goToPrev} aria-label="Previous month"
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:bg-surface-secondary transition-colors text-sm">
            &larr;
          </button>
          <button onClick={goToToday}
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:bg-surface-secondary transition-colors text-xs font-medium">
            Today
          </button>
          <button onClick={goToNext} aria-label="Next month"
            className="px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:bg-surface-secondary transition-colors text-sm">
            &rarr;
          </button>
        </div>

        {/* Month label + counts */}
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-text-primary">{monthLabel}</span>
          {!loading && totalVisible > 0 && (
            <span className="text-xs text-text-tertiary bg-surface-secondary border border-border-light px-2 py-0.5 rounded-full">
              {totalVisible} post{totalVisible !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Legend + filter toggles + view toggle */}
        <div className="flex items-center gap-4">
          {/* IG legend + toggle */}
          <div className="flex items-center gap-3">
            {LEGEND.map(({ label, dotClass }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
                <span className="text-[11px] text-text-tertiary">{label}</span>
              </div>
            ))}
          </div>

          {/* Filter toggles */}
          <div className="flex items-center gap-1 bg-surface-secondary border border-border rounded-lg p-0.5">
            <button
              onClick={() => setShowIG((v) => !v)}
              title="Toggle Instagram drafts"
              className={["px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                showIG ? "bg-white text-text-primary shadow-sm border border-border-light" : "text-text-tertiary hover:text-text-secondary",
              ].join(" ")}
            >
              IG
            </button>
            <button
              onClick={() => setShowX((v) => !v)}
              title="Toggle X posts"
              className={["px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                showX ? "bg-gray-900 text-white shadow-sm" : "text-text-tertiary hover:text-text-secondary",
              ].join(" ")}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              X
            </button>
            <button
              onClick={() => setShowLinkedIn((v) => !v)}
              title="Toggle LinkedIn posts"
              className={["px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                showLinkedIn ? "bg-[#0A66C2] text-white shadow-sm" : "text-text-tertiary hover:text-text-secondary",
              ].join(" ")}
            >
              in
            </button>
            <button
              onClick={() => setShowPinterest((v) => !v)}
              title="Toggle Pinterest pins"
              className={["px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                showPinterest ? "bg-[#E60023] text-white shadow-sm" : "text-text-tertiary hover:text-text-secondary",
              ].join(" ")}
            >
              P
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 bg-surface-secondary border border-border rounded-lg p-0.5">
            {(["month", "week"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={[
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                  viewMode === mode
                    ? "bg-white text-text-primary shadow-sm border border-border-light"
                    : "text-text-secondary hover:text-text-primary",
                ].join(" ")}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Week view placeholder */}
      {!loading && viewMode === "week" && <WeekViewPlaceholder />}

      {/* Month grid */}
      {!loading && viewMode === "month" && (
        <>
          <div className="grid grid-cols-7 gap-px bg-border rounded-t-xl overflow-hidden border border-border border-b-0">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="bg-surface-secondary px-2 py-2 text-center text-[11px] font-semibold text-text-tertiary uppercase tracking-wide">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-b-xl overflow-hidden border border-border border-t-0">
            {days.map((day, i) => {
              const key = toDateKey(day);
              return (
                <CalendarDayCell
                  key={i}
                  date={day}
                  dateKey={key}
                  drafts={byDate[key] ?? []}
                  xPosts={xByDate[key] ?? []}
                  linkedInPosts={linkedInByDate[key] ?? []}
                  pinterestPins={pinterestByDate[key] ?? []}
                  isCurrentMonth={day.getMonth() === month}
                  isToday={key === todayKey}
                  isSelected={selectedDateKey === key}
                  isDragOver={dragOverDate === key}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDragOver={setDragOverDate}
                  onDragLeave={() => setDragOverDate(null)}
                  onClick={() => setSelectedDate(selectedDateKey === key ? null : day)}
                  onDraftMouseEnter={handleDraftMouseEnter}
                  onDraftMouseLeave={handleDraftMouseLeave}
                  onXPostMouseEnter={handleXPostMouseEnter}
                  onXPostMouseLeave={handleXPostMouseLeave}
                  onLinkedInMouseEnter={handleLinkedInMouseEnter}
                  onLinkedInMouseLeave={handleLinkedInMouseLeave}
                  onPinterestMouseEnter={handlePinterestMouseEnter}
                  onPinterestMouseLeave={handlePinterestMouseLeave}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Preview panel */}
      <CalendarPreviewPanel
        date={selectedDate}
        drafts={selectedDateDrafts}
        xPosts={selectedDateXPosts}
        linkedInPosts={selectedDateLinkedIn}
        pinterestPins={selectedDatePinterest}
        onClose={() => setSelectedDate(null)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReschedule={handleReschedule}
        onRescheduleX={handleRescheduleX}
        onRescheduleLinkedIn={handleRescheduleLinkedIn}
        onReschedulePinterest={handleReschedulePinterest}
        onEdit={handleEdit}
        onScheduled={load}
      />

      {/* Hover tooltip */}
      <CalendarHoverTooltip data={tooltipData} />
    </div>
  );
}
