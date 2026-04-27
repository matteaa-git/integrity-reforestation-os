"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Draft, DraftStatus, ContentFormat, XPost, LinkedInPost, PinterestPin } from "@/lib/api";
import {
  fetchDrafts,
  scheduleDraft,
  listXDrafts,
  scheduleXPost,
  listLinkedInDrafts,
  scheduleLinkedInPost,
  listPinterestDrafts,
  schedulePinterestPin,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarPreviewPanelProps {
  date: Date | null;
  drafts: Draft[];
  xPosts: XPost[];
  linkedInPosts: LinkedInPost[];
  pinterestPins: PinterestPin[];
  onClose: () => void;
  onReschedule: (draftId: string, newDatetime: string) => Promise<void>;
  onRescheduleX: (postId: string, newDatetime: string) => Promise<void>;
  onRescheduleLinkedIn: (postId: string, newDatetime: string) => Promise<void>;
  onReschedulePinterest: (pinId: string, newDatetime: string) => Promise<void>;
  onDuplicate: (draft: Draft) => Promise<void>;
  onDelete: (draftId: string) => Promise<void>;
  onEdit: (draft: Draft) => void;
  onScheduled?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPanelDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });
}

function formatScheduledTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Format config
// ---------------------------------------------------------------------------

const FORMAT_COLORS: Record<
  ContentFormat,
  { bg: string; text: string; label: string; badgeBg: string; badgeText: string; icon: string }
> = {
  reel:     { bg: "#dcfce7", text: "#15803d", label: "Reel",     badgeBg: "#f0fdf4", badgeText: "#15803d", icon: "▶" },
  story:    { bg: "#dbeafe", text: "#1d4ed8", label: "Story",    badgeBg: "#eff6ff", badgeText: "#1d4ed8", icon: "◻" },
  carousel: { bg: "#fef3c7", text: "#b45309", label: "Carousel", badgeBg: "#fffbeb", badgeText: "#b45309", icon: "⊞" },
};

const STATUS_MAP: Record<DraftStatus, { bg: string; text: string; label: string }> = {
  draft:          { bg: "#f3f4f6", text: "#374151", label: "Draft"          },
  in_review:      { bg: "#fffbeb", text: "#b45309", label: "In Review"      },
  approved:       { bg: "#f0fdf4", text: "#15803d", label: "Approved"       },
  rejected:       { bg: "#fef2f2", text: "#b91c1c", label: "Rejected"       },
  scheduled:      { bg: "#eff6ff", text: "#1d4ed8", label: "Scheduled"      },
  publishing:     { bg: "#eff6ff", text: "#1d4ed8", label: "Publishing…"    },
  published:      { bg: "#f0fdf4", text: "#15803d", label: "Published"      },
  publish_failed: { bg: "#fef2f2", text: "#b91c1c", label: "Publish Failed" },
  failed:         { bg: "#fef2f2", text: "#b91c1c", label: "Failed"         },
};

function InlineStatusBadge({ status }: { status: DraftStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span style={{ backgroundColor: s.bg, color: s.text }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap">
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ReschedulePopover — inline datetime picker for drafts
// ---------------------------------------------------------------------------

function ReschedulePopover({
  currentIso,
  onReschedule,
  onClose,
}: {
  currentIso: string | null;
  onReschedule: (newDatetime: string) => Promise<void>;
  onClose: () => void;
}) {
  const initialValue = currentIso ? new Date(currentIso).toISOString().slice(0, 16) : "";
  const [value, setValue]   = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleSave = async () => {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await onReschedule(new Date(value).toISOString());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reschedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-xl border border-info/30 bg-blue-50 space-y-2">
      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Reschedule</p>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-lg border border-border px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
      />
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!value || saving}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? "Saving…" : "Confirm"}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-border text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DraftRow — single Instagram/content draft
// ---------------------------------------------------------------------------

function DraftRow({
  draft,
  onEdit,
  onReschedule,
  onDuplicate,
  onDelete,
}: {
  draft: Draft;
  onEdit: (d: Draft) => void;
  onReschedule: (draftId: string, newDatetime: string) => Promise<void>;
  onDuplicate: (d: Draft) => Promise<void>;
  onDelete: (draftId: string) => Promise<void>;
}) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [duplicating, setDuplicating]       = useState(false);
  const [deleting, setDeleting]             = useState(false);

  const fmt  = FORMAT_COLORS[draft.format] ?? FORMAT_COLORS.reel;
  const time = formatScheduledTime(draft.scheduled_for);

  return (
    <div className="rounded-xl border border-border bg-white p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-[13px] font-bold"
          style={{ backgroundColor: fmt.bg, color: fmt.text }}>
          {fmt.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-primary truncate leading-tight" title={draft.title}>
            {draft.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: fmt.badgeBg, color: fmt.badgeText }}>
              {fmt.label}
            </span>
            {draft.scheduled_for && (
              <span className="text-[11px] text-text-tertiary font-medium">{time}</span>
            )}
          </div>
        </div>
        <InlineStatusBadge status={draft.status} />
      </div>

      <div className="flex items-center gap-1 pt-1 border-t border-border-light">
        <button onClick={() => onEdit(draft)}
          className="flex-1 py-1 text-[11px] font-medium text-primary hover:bg-primary/5 rounded-md transition-colors">
          Edit
        </button>
        <button
          onClick={() => setShowReschedule((v) => !v)}
          className={["flex-1 py-1 text-[11px] font-medium rounded-md transition-colors",
            showReschedule ? "bg-info/10 text-info" : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
          ].join(" ")}>
          Reschedule
        </button>
        <button
          title="Duplicate draft"
          onClick={async () => { setDuplicating(true); try { await onDuplicate(draft); } finally { setDuplicating(false); } }}
          disabled={duplicating}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none">
          ⧉
        </button>
        <button
          title="Delete draft"
          onClick={async () => {
            if (!window.confirm(`Delete "${draft.title}"?`)) return;
            setDeleting(true);
            try { await onDelete(draft.id); } finally { setDeleting(false); }
          }}
          disabled={deleting}
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40 disabled:pointer-events-none">
          ✕
        </button>
      </div>

      {showReschedule && (
        <ReschedulePopover
          currentIso={draft.scheduled_for}
          onReschedule={(dt) => onReschedule(draft.id, dt)}
          onClose={() => setShowReschedule(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// XPostRow — single X post in the panel
// ---------------------------------------------------------------------------

function XPostRow({
  xPost,
  onReschedule,
}: {
  xPost: XPost;
  onReschedule: (postId: string, newDatetime: string) => Promise<void>;
}) {
  const router = useRouter();
  const [showReschedule, setShowReschedule] = useState(false);

  const preview = xPost.post_type === "thread" && xPost.thread_posts?.length
    ? xPost.thread_posts[0]?.text
    : xPost.content;
  const time = formatScheduledTime(xPost.scheduled_time);
  const typeLabel = xPost.post_type === "thread"
    ? `Thread · ${xPost.thread_posts?.length ?? 0}`
    : "Single";

  return (
    <div className="rounded-xl border border-gray-200 bg-[#f9f9f9] p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-3">
        {/* X icon square */}
        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center bg-black">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text-primary line-clamp-1 leading-tight">
            {preview || "Empty post"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-200 text-gray-700">
              {typeLabel}
            </span>
            <span className="text-[11px] text-text-tertiary font-medium">{time}</span>
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">
          Scheduled
        </span>
      </div>

      <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
        <button
          onClick={() => router.push("/x-studio")}
          className="flex-1 py-1 text-[11px] font-medium text-primary hover:bg-primary/5 rounded-md transition-colors">
          Edit in X Studio
        </button>
        <button
          onClick={() => setShowReschedule((v) => !v)}
          className={["flex-1 py-1 text-[11px] font-medium rounded-md transition-colors",
            showReschedule ? "bg-info/10 text-info" : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
          ].join(" ")}>
          Reschedule
        </button>
      </div>

      {showReschedule && (
        <ReschedulePopover
          currentIso={xPost.scheduled_time}
          onReschedule={(dt) => onReschedule(xPost.id, dt)}
          onClose={() => setShowReschedule(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedInPostRow — single LinkedIn post in the panel
// ---------------------------------------------------------------------------

function LinkedInPostRow({
  post,
  onReschedule,
}: {
  post: LinkedInPost;
  onReschedule: (postId: string, newDatetime: string) => Promise<void>;
}) {
  const router = useRouter();
  const [showReschedule, setShowReschedule] = useState(false);

  const preview = post.content?.slice(0, 100) || "Empty post";
  const time = formatScheduledTime(post.scheduled_time);

  return (
    <div className="rounded-xl border border-[#0A66C2]/20 bg-[#f0f7ff] p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-3">
        {/* LinkedIn icon square */}
        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center bg-[#0A66C2]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text-primary line-clamp-1 leading-tight">
            {preview}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0A66C2]/10 text-[#0A66C2] capitalize">
              {post.post_type}
            </span>
            <span className="text-[11px] text-text-tertiary font-medium">{time}</span>
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">
          Scheduled
        </span>
      </div>

      <div className="flex items-center gap-1 pt-1 border-t border-[#0A66C2]/10">
        <button
          onClick={() => router.push("/linkedin")}
          className="flex-1 py-1 text-[11px] font-medium text-[#0A66C2] hover:bg-[#0A66C2]/5 rounded-md transition-colors">
          Edit in LinkedIn Studio
        </button>
        <button
          onClick={() => setShowReschedule((v) => !v)}
          className={["flex-1 py-1 text-[11px] font-medium rounded-md transition-colors",
            showReschedule ? "bg-[#0A66C2]/10 text-[#0A66C2]" : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
          ].join(" ")}>
          Reschedule
        </button>
      </div>

      {showReschedule && (
        <ReschedulePopover
          currentIso={post.scheduled_time}
          onReschedule={(dt) => onReschedule(post.id, dt)}
          onClose={() => setShowReschedule(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PinterestPinRow — single Pinterest pin in the panel
// ---------------------------------------------------------------------------

function PinterestPinRow({
  pin,
  onReschedule,
}: {
  pin: PinterestPin;
  onReschedule: (pinId: string, newDatetime: string) => Promise<void>;
}) {
  const router = useRouter();
  const [showReschedule, setShowReschedule] = useState(false);

  const time = formatScheduledTime(pin.scheduled_time);

  return (
    <div className="rounded-xl border border-[#E60023]/20 bg-[#fff5f5] p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Pinterest icon square */}
        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center bg-[#E60023]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-primary truncate leading-tight" title={pin.title || "Untitled pin"}>
            {pin.title || "Untitled pin"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E60023]/10 text-[#E60023] capitalize">
              {pin.pin_type}
            </span>
            {pin.description && (
              <span className="text-[11px] text-text-tertiary font-medium truncate max-w-[120px]">
                {pin.description.slice(0, 40)}
              </span>
            )}
            <span className="text-[11px] text-text-tertiary font-medium">{time}</span>
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 whitespace-nowrap">
          Scheduled
        </span>
      </div>

      <div className="flex items-center gap-1 pt-1 border-t border-[#E60023]/10">
        <button
          onClick={() => router.push("/pinterest")}
          className="flex-1 py-1 text-[11px] font-medium text-[#E60023] hover:bg-[#E60023]/5 rounded-md transition-colors">
          Edit in Pinterest Studio
        </button>
        <button
          onClick={() => setShowReschedule((v) => !v)}
          className={["flex-1 py-1 text-[11px] font-medium rounded-md transition-colors",
            showReschedule ? "bg-[#E60023]/10 text-[#E60023]" : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
          ].join(" ")}>
          Reschedule
        </button>
      </div>

      {showReschedule && (
        <ReschedulePopover
          currentIso={pin.scheduled_time}
          onReschedule={(dt) => onReschedule(pin.id, dt)}
          onClose={() => setShowReschedule(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleDraftPicker — pick an IG draft and schedule it to a specific date
// ---------------------------------------------------------------------------

const FORMAT_ICONS: Record<ContentFormat, string> = {
  reel: "▶", story: "◻", carousel: "⊞",
};

function ScheduleDraftPicker({
  date,
  onScheduled,
  onCancel,
}: {
  date: Date;
  onScheduled: () => void;
  onCancel: () => void;
}) {
  const [candidates, setCandidates] = useState<Draft[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [time, setTime]               = useState("12:00");
  const [scheduling, setScheduling]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchDrafts({ status: "draft" }),
      fetchDrafts({ status: "in_review" }),
      fetchDrafts({ status: "approved" }),
    ])
      .then(([d, r, a]) => {
        const all = [...d.drafts, ...r.drafts, ...a.drafts];
        const seen = new Set<string>();
        const unique = all.filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
        unique.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        setCandidates(unique);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSchedule = async () => {
    if (!selectedId) return;
    setScheduling(true);
    setError(null);
    try {
      const [hh, mm] = time.split(":").map(Number);
      const dt = new Date(date);
      dt.setHours(hh, mm, 0, 0);
      await scheduleDraft(selectedId, { scheduled_for: dt.toISOString() });
      onScheduled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
      setScheduling(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/3 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Schedule IG Draft</p>
        <button onClick={onCancel} className="text-text-tertiary hover:text-text-primary text-base leading-none">&times;</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-text-tertiary shrink-0">Time</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-border px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-[11px] text-text-tertiary text-center py-3">No drafts available</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {candidates.map((d) => {
            const fmt = FORMAT_COLORS[d.format] ?? FORMAT_COLORS.reel;
            const statusBg    = STATUS_MAP[d.status as DraftStatus]?.bg    ?? "#f3f4f6";
            const statusText  = STATUS_MAP[d.status as DraftStatus]?.text  ?? "#374151";
            const statusLabel = STATUS_MAP[d.status as DraftStatus]?.label ?? d.status;
            return (
              <button key={d.id} onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                className={["w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all border",
                  selectedId === d.id ? "border-primary/30 bg-primary/5 shadow-sm" : "border-transparent hover:border-border hover:bg-surface-secondary",
                ].join(" ")}>
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
                  style={{ backgroundColor: fmt.bg, color: fmt.text }}>
                  {FORMAT_ICONS[d.format]}
                </span>
                <span className="flex-1 text-[12px] font-medium text-text-primary truncate">{d.title || "Untitled"}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusBg, color: statusText }}>
                  {statusLabel}
                </span>
                {selectedId === d.id && <span className="text-primary text-sm shrink-0">✓</span>}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <button onClick={handleSchedule} disabled={!selectedId || scheduling}
        className="w-full py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none">
        {scheduling ? "Scheduling…" : "Schedule to this day"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleXPostPicker — pick an X draft and schedule it to a specific date
// ---------------------------------------------------------------------------

function ScheduleXPostPicker({
  date,
  onScheduled,
  onCancel,
}: {
  date: Date;
  onScheduled: () => void;
  onCancel: () => void;
}) {
  const [candidates, setCandidates] = useState<XPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime]             = useState("12:00");
  const [scheduling, setScheduling] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listXDrafts({ status: "draft" }),
      listXDrafts({ status: "pending_approval" }),
    ])
      .then(([d, p]) => {
        const all = [...d.posts, ...p.posts];
        const seen = new Set<string>();
        const unique = all.filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
        unique.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        setCandidates(unique);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSchedule = async () => {
    if (!selectedId) return;
    setScheduling(true);
    setError(null);
    try {
      const [hh, mm] = time.split(":").map(Number);
      const dt = new Date(date);
      dt.setHours(hh, mm, 0, 0);
      await scheduleXPost(selectedId, dt.toISOString());
      onScheduled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
      setScheduling(false);
    }
  };

  const getPreview = (p: XPost) =>
    p.post_type === "thread" && p.thread_posts?.length
      ? p.thread_posts[0]?.text
      : p.content;

  return (
    <div className="rounded-xl border border-gray-300 bg-gray-50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-gray-700">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Schedule X Post</p>
        </div>
        <button onClick={onCancel} className="text-text-tertiary hover:text-text-primary text-base leading-none">&times;</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-text-tertiary shrink-0">Time</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-border px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-400/20 focus:border-gray-400 bg-white" />
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-[11px] text-text-tertiary text-center py-3">No X drafts available</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {candidates.map((p) => {
            const preview = getPreview(p);
            return (
              <button key={p.id} onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                className={["w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all border",
                  selectedId === p.id ? "border-gray-400 bg-gray-100 shadow-sm" : "border-transparent hover:border-gray-200 hover:bg-gray-100",
                ].join(" ")}>
                <span className="w-6 h-6 rounded-md bg-black flex items-center justify-center shrink-0">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </span>
                <span className="flex-1 text-[12px] font-medium text-text-primary truncate">{preview || "Empty post"}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 shrink-0 uppercase">
                  {p.post_type}
                </span>
                {selectedId === p.id && <span className="text-gray-700 text-sm shrink-0">✓</span>}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <button onClick={handleSchedule} disabled={!selectedId || scheduling}
        className="w-full py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:pointer-events-none">
        {scheduling ? "Scheduling…" : "Schedule to this day"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleLinkedInPicker — pick a LinkedIn draft and schedule it to a specific date
// ---------------------------------------------------------------------------

function ScheduleLinkedInPicker({
  date,
  onScheduled,
  onCancel,
}: {
  date: Date;
  onScheduled: () => void;
  onCancel: () => void;
}) {
  const [candidates, setCandidates] = useState<LinkedInPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime]             = useState("12:00");
  const [scheduling, setScheduling] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listLinkedInDrafts({ status: "draft" }),
      listLinkedInDrafts({ status: "pending_approval" }),
    ])
      .then(([d, p]) => {
        const all = [...d.posts, ...p.posts];
        const seen = new Set<string>();
        const unique = all.filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
        unique.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        setCandidates(unique);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSchedule = async () => {
    if (!selectedId) return;
    setScheduling(true);
    setError(null);
    try {
      const [hh, mm] = time.split(":").map(Number);
      const dt = new Date(date);
      dt.setHours(hh, mm, 0, 0);
      await scheduleLinkedInPost(selectedId, dt.toISOString());
      onScheduled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
      setScheduling(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#0A66C2]/30 bg-[#0A66C2]/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#0A66C2">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <p className="text-[11px] font-semibold text-[#0A66C2] uppercase tracking-wide">Schedule LinkedIn Post</p>
        </div>
        <button onClick={onCancel} className="text-text-tertiary hover:text-text-primary text-base leading-none">&times;</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-text-tertiary shrink-0">Time</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-border px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white" />
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-[#0A66C2]/30 border-t-[#0A66C2] rounded-full animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-[11px] text-text-tertiary text-center py-3">No LinkedIn drafts available</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {candidates.map((p) => (
            <button key={p.id} onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
              className={["w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all border",
                selectedId === p.id ? "border-[#0A66C2]/30 bg-[#0A66C2]/5 shadow-sm" : "border-transparent hover:border-[#0A66C2]/20 hover:bg-[#0A66C2]/5",
              ].join(" ")}>
              <span className="w-6 h-6 rounded-md bg-[#0A66C2] flex items-center justify-center shrink-0">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </span>
              <span className="flex-1 text-[12px] font-medium text-text-primary truncate">
                {p.content?.slice(0, 60) || "Empty post"}
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] shrink-0 capitalize">
                {p.post_type}
              </span>
              {selectedId === p.id && <span className="text-[#0A66C2] text-sm shrink-0">✓</span>}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <button onClick={handleSchedule} disabled={!selectedId || scheduling}
        className="w-full py-2 text-xs font-semibold rounded-lg bg-[#0A66C2] text-white hover:bg-[#004182] transition-colors disabled:opacity-40 disabled:pointer-events-none">
        {scheduling ? "Scheduling…" : "Schedule to this day"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SchedulePinterestPicker — pick a Pinterest draft and schedule it to a specific date
// ---------------------------------------------------------------------------

function SchedulePinterestPicker({
  date,
  onScheduled,
  onCancel,
}: {
  date: Date;
  onScheduled: () => void;
  onCancel: () => void;
}) {
  const [candidates, setCandidates] = useState<PinterestPin[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime]             = useState("12:00");
  const [scheduling, setScheduling] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listPinterestDrafts({ status: "draft" }),
      listPinterestDrafts({ status: "pending_approval" }),
    ])
      .then(([d, p]) => {
        const all = [...d.pins, ...p.pins];
        const seen = new Set<string>();
        const unique = all.filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
        unique.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        setCandidates(unique);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSchedule = async () => {
    if (!selectedId) return;
    setScheduling(true);
    setError(null);
    try {
      const [hh, mm] = time.split(":").map(Number);
      const dt = new Date(date);
      dt.setHours(hh, mm, 0, 0);
      await schedulePinterestPin(selectedId, dt.toISOString());
      onScheduled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
      setScheduling(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#E60023]/30 bg-[#E60023]/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#E60023">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
          </svg>
          <p className="text-[11px] font-semibold text-[#E60023] uppercase tracking-wide">Schedule Pinterest Pin</p>
        </div>
        <button onClick={onCancel} className="text-text-tertiary hover:text-text-primary text-base leading-none">&times;</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-text-tertiary shrink-0">Time</label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-border px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023] bg-white" />
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-[#E60023]/30 border-t-[#E60023] rounded-full animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-[11px] text-text-tertiary text-center py-3">No Pinterest drafts available</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {candidates.map((p) => (
            <button key={p.id} onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
              className={["w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all border",
                selectedId === p.id ? "border-[#E60023]/30 bg-[#E60023]/5 shadow-sm" : "border-transparent hover:border-[#E60023]/20 hover:bg-[#E60023]/5",
              ].join(" ")}>
              <span className="w-6 h-6 rounded-md bg-[#E60023] flex items-center justify-center shrink-0">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <span className="block text-[12px] font-medium text-text-primary truncate">
                  {p.title || "Untitled pin"}
                </span>
                {p.description && (
                  <span className="block text-[10px] text-text-tertiary truncate">
                    {p.description.slice(0, 50)}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E60023]/10 text-[#E60023] shrink-0 capitalize">
                {p.pin_type}
              </span>
              {selectedId === p.id && <span className="text-[#E60023] text-sm shrink-0">✓</span>}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <button onClick={handleSchedule} disabled={!selectedId || scheduling}
        className="w-full py-2 text-xs font-semibold rounded-lg bg-[#E60023] text-white hover:bg-[#c0001d] transition-colors disabled:opacity-40 disabled:pointer-events-none">
        {scheduling ? "Scheduling…" : "Schedule to this day"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarPreviewPanel
// ---------------------------------------------------------------------------

export default function CalendarPreviewPanel({
  date,
  drafts,
  xPosts,
  linkedInPosts,
  pinterestPins,
  onClose,
  onReschedule,
  onRescheduleX,
  onRescheduleLinkedIn,
  onReschedulePinterest,
  onDuplicate,
  onDelete,
  onEdit,
  onScheduled,
}: CalendarPreviewPanelProps) {
  const [showPicker, setShowPicker] = useState<"ig" | "x" | "linkedin" | "pinterest" | null>(null);
  const isOpen = date !== null;
  const totalCount = drafts.length + xPosts.length + linkedInPosts.length + pinterestPins.length;

  const handleClose = () => {
    setShowPicker(null);
    onClose();
  };

  const handleScheduled = () => {
    setShowPicker(null);
    onScheduled?.();
    onClose();
  };

  // Whether any two platform types have posts (for showing section labels)
  const platformCount = [drafts.length > 0, xPosts.length > 0, linkedInPosts.length > 0, pinterestPins.length > 0].filter(Boolean).length;
  const showSectionLabels = platformCount >= 2;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        aria-hidden="true"
        className={[
          "fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Slide-out panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={date ? `Posts for ${formatPanelDate(date)}` : "Calendar preview panel"}
        className={[
          "fixed inset-y-0 right-0 z-40",
          "w-full sm:w-80",
          "bg-white border-l border-border shadow-2xl",
          "flex flex-col",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest leading-none mb-0.5">
              Scheduled
            </p>
            <h2 className="text-[15px] font-semibold text-text-primary leading-tight">
              {date ? formatPanelDate(date) : ""}
            </h2>
          </div>
          <button
            aria-label="Close panel"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors text-lg leading-none"
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* Pickers */}
          {showPicker === "ig" && date && (
            <ScheduleDraftPicker date={date} onScheduled={handleScheduled} onCancel={() => setShowPicker(null)} />
          )}
          {showPicker === "x" && date && (
            <ScheduleXPostPicker date={date} onScheduled={handleScheduled} onCancel={() => setShowPicker(null)} />
          )}
          {showPicker === "linkedin" && date && (
            <ScheduleLinkedInPicker date={date} onScheduled={handleScheduled} onCancel={() => setShowPicker(null)} />
          )}
          {showPicker === "pinterest" && date && (
            <SchedulePinterestPicker date={date} onScheduled={handleScheduled} onCancel={() => setShowPicker(null)} />
          )}

          {/* Empty state */}
          {totalCount === 0 && !showPicker ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-4xl opacity-20 mb-3 select-none" aria-hidden="true">📅</div>
              <p className="text-sm font-medium text-text-secondary">No posts scheduled</p>
              <p className="text-xs text-text-tertiary mt-1 mb-4">Drag a post here or schedule one below.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={() => setShowPicker("ig")}
                  className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                  + IG Draft
                </button>
                <button onClick={() => setShowPicker("x")}
                  className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-colors flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X Post
                </button>
                <button onClick={() => setShowPicker("linkedin")}
                  className="px-3 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-semibold hover:bg-[#004182] transition-colors flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </button>
                <button onClick={() => setShowPicker("pinterest")}
                  className="px-3 py-2 rounded-xl bg-[#E60023] text-white text-xs font-semibold hover:bg-[#c0001d] transition-colors flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                  </svg>
                  Pinterest
                </button>
              </div>
            </div>
          ) : !showPicker && (
            <>
              {/* Count row + add buttons */}
              <div className="flex items-center justify-between pb-0.5">
                <p className="text-[11px] text-text-tertiary font-medium">
                  {totalCount} post{totalCount !== 1 ? "s" : ""} scheduled
                </p>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button onClick={() => setShowPicker("ig")}
                    className="text-[10px] font-semibold text-primary hover:text-primary-dark transition-colors">
                    + IG
                  </button>
                  <span className="text-text-tertiary text-[10px]">·</span>
                  <button onClick={() => setShowPicker("x")}
                    className="text-[10px] font-semibold text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-0.5">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X
                  </button>
                  <span className="text-text-tertiary text-[10px]">·</span>
                  <button onClick={() => setShowPicker("linkedin")}
                    className="text-[10px] font-semibold text-[#0A66C2] hover:text-[#004182] transition-colors">
                    + LinkedIn
                  </button>
                  <span className="text-text-tertiary text-[10px]">·</span>
                  <button onClick={() => setShowPicker("pinterest")}
                    className="text-[10px] font-semibold text-[#E60023] hover:text-[#c0001d] transition-colors">
                    + Pinterest
                  </button>
                </div>
              </div>

              {/* Instagram drafts section */}
              {drafts.length > 0 && (
                <div className="space-y-2">
                  {showSectionLabels && (
                    <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">Instagram</p>
                  )}
                  {drafts.map((draft) => (
                    <DraftRow key={draft.id} draft={draft} onEdit={onEdit}
                      onReschedule={onReschedule} onDuplicate={onDuplicate} onDelete={onDelete} />
                  ))}
                </div>
              )}

              {/* X posts section */}
              {xPosts.length > 0 && (
                <div className="space-y-2">
                  {showSectionLabels && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.855L1.254 2.25H8.08l4.259 5.629 5.9-5.629Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">X Posts</p>
                    </div>
                  )}
                  {xPosts.map((xPost) => (
                    <XPostRow key={xPost.id} xPost={xPost} onReschedule={onRescheduleX} />
                  ))}
                </div>
              )}

              {/* LinkedIn posts section */}
              {linkedInPosts.length > 0 && (
                <div className="space-y-2">
                  {showSectionLabels && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#0A66C2">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <p className="text-[10px] font-semibold text-[#0A66C2] uppercase tracking-widest">LinkedIn</p>
                    </div>
                  )}
                  {linkedInPosts.map((post) => (
                    <LinkedInPostRow key={post.id} post={post} onReschedule={onRescheduleLinkedIn} />
                  ))}
                </div>
              )}

              {/* Pinterest pins section */}
              {pinterestPins.length > 0 && (
                <div className="space-y-2">
                  {showSectionLabels && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#E60023">
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                      </svg>
                      <p className="text-[10px] font-semibold text-[#E60023] uppercase tracking-widest">Pinterest</p>
                    </div>
                  )}
                  {pinterestPins.map((pin) => (
                    <PinterestPinRow key={pin.id} pin={pin} onReschedule={onReschedulePinterest} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-border bg-surface-secondary">
          <button
            onClick={handleClose}
            className="w-full py-2 text-xs font-medium rounded-lg border border-border bg-white text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
