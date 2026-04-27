"use client";

import { useState, useCallback } from "react";
import XPostPreview from "./XPostPreview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface XPost {
  id: string;
  content: string;
  post_type: string;
  thread_posts: { position: number; text: string; char_count: number }[];
  status: string;
  hook_score: number;
  estimated_reach: number;
  topic_signal: string | null;
  scheduled_time: string | null;
  updated_at: string;
}

interface XPostListResponse {
  posts: XPost[];
  total: number;
  draft_count: number;
  pending_count: number;
  scheduled_count: number;
  published_count: number;
}

interface Props {
  data: XPostListResponse;
  onEdit: (post?: XPost) => void;
  onRefresh: () => void;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  draft:            { color: "#64748b", bg: "bg-[#64748b]/10 border-[#64748b]/25", label: "Draft" },
  pending_approval: { color: "#fbbf24", bg: "bg-[#fbbf24]/10 border-[#fbbf24]/30", label: "Pending" },
  approved:         { color: "#00d4ff", bg: "bg-[#00d4ff]/10 border-[#00d4ff]/30", label: "Approved" },
  scheduled:        { color: "#00ff88", bg: "bg-[#00ff88]/10 border-[#00ff88]/30", label: "Scheduled" },
  published:        { color: "#a78bfa", bg: "bg-[#a78bfa]/10 border-[#a78bfa]/30", label: "Published" },
};

export default function DraftsTab({ data, onEdit, onRefresh }: Props) {
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState<Record<string, string>>({});
  const [previewId, setPreviewId]     = useState<string | null>(null);

  const filtered = filterStatus === "all" ? data.posts : data.posts.filter((p) => p.status === filterStatus);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/x/${id}`, { method: "DELETE" });
      onRefresh();
    } finally { setDeleting(null); }
  }, [onRefresh]);

  const handleSubmitApproval = useCallback(async (id: string) => {
    setSubmitting(id);
    try {
      await fetch(`${API_BASE}/x/${id}/submit-approval`, { method: "POST" });
      onRefresh();
    } finally { setSubmitting(null); }
  }, [onRefresh]);

  const handleSchedule = useCallback(async (id: string) => {
    const time = scheduleTime[id];
    if (!time) return;
    setSchedulingId(id);
    try {
      await fetch(`${API_BASE}/x/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_time: time }),
      });
      setScheduleTime((prev) => { const next = { ...prev }; delete next[id]; return next; });
      onRefresh();
    } finally { setSchedulingId(null); }
  }, [scheduleTime, onRefresh]);

  const preview = (post: XPost) => {
    if (post.post_type === "thread" && post.thread_posts.length > 0) {
      return post.thread_posts[0]?.text || post.content;
    }
    return post.content;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Total", value: data.total, color: "#e2e8f0" },
          { label: "Drafts", value: data.draft_count, color: "#64748b" },
          { label: "Pending", value: data.pending_count, color: "#fbbf24" },
          { label: "Scheduled", value: data.scheduled_count, color: "#00ff88" },
          { label: "Published", value: data.published_count, color: "#a78bfa" },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => setFilterStatus(s.label === "Total" ? "all" : s.label.toLowerCase().replace(" ", "_"))}
            className={`rounded-lg border p-3 text-center transition-all ${
              (filterStatus === "all" && s.label === "Total") ||
              filterStatus === s.label.toLowerCase().replace(" ", "_")
                ? "border-white/20 bg-white/6"
                : "border-white/8 bg-white/3 hover:bg-white/5"
            }`}
          >
            <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-mono text-white/30 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="text-white/10 text-4xl">◻</div>
          <div className="text-white/30 text-sm font-mono uppercase tracking-widest">No posts found</div>
          <div className="text-white/15 text-xs font-mono">Create a post in the composer to get started</div>
        </div>
      )}

      {/* Posts list */}
      <div className="space-y-2">
        {filtered.map((post) => {
          const st = STATUS_STYLES[post.status] ?? STATUS_STYLES.draft;
          const previewText = preview(post);
          const isThread = post.post_type === "thread";

          return (
            <div key={post.id} className="rounded-lg border border-white/8 bg-white/3 overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${st.bg}`} style={{ color: st.color }}>
                      {st.label}
                    </span>
                    {isThread && (
                      <span className="text-[10px] font-mono text-[#00d4ff]/60 bg-[#00d4ff]/8 px-1.5 py-0.5 rounded">
                        THREAD · {post.thread_posts.length} posts
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-white/25 ml-auto">
                      {new Date(post.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Preview */}
                  <p className="text-sm text-white/70 leading-relaxed line-clamp-2 mb-2">
                    {previewText || <span className="text-white/20 italic">Empty post</span>}
                  </p>

                  {/* Scores */}
                  <div className="flex items-center gap-4 text-[10px] font-mono text-white/30">
                    {post.hook_score > 0 && (
                      <span>Hook <span className="text-[#00ff88]">{post.hook_score}</span></span>
                    )}
                    {post.estimated_reach > 0 && (
                      <span>Est. Reach <span className="text-[#00d4ff]">
                        {post.estimated_reach >= 1000 ? `${(post.estimated_reach / 1000).toFixed(1)}K` : post.estimated_reach}
                      </span></span>
                    )}
                    {post.scheduled_time && (
                      <span className="flex items-center gap-1">
                        <span className="text-[#a78bfa]">▦</span>
                        <span className="text-[#a78bfa]">
                          {new Date(post.scheduled_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {" "}
                          {new Date(post.scheduled_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0 min-w-[88px]">
                  <button
                    onClick={() => onEdit(post)}
                    className="px-2.5 py-1 rounded border border-white/12 text-[10px] font-mono text-white/40 hover:border-white/22 hover:text-white/60 transition-all"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => setPreviewId((id) => id === post.id ? null : post.id)}
                    className={`px-2.5 py-1 rounded border text-[10px] font-mono transition-all ${
                      previewId === post.id
                        ? "border-[#1d9bf0]/40 text-[#1d9bf0]/80 bg-[#1d9bf0]/8"
                        : "border-white/12 text-white/40 hover:border-white/22 hover:text-white/60"
                    }`}
                  >
                    {previewId === post.id ? "HIDE" : "PREVIEW"}
                  </button>
                  {(post.status === "draft" || post.status === "approved") && (
                    <button
                      onClick={() => handleSubmitApproval(post.id)}
                      disabled={submitting === post.id}
                      className="px-2.5 py-1 rounded border border-[#ff9500]/25 text-[10px] font-mono text-[#ff9500]/60 hover:bg-[#ff9500]/10 transition-all disabled:opacity-40"
                    >
                      {submitting === post.id ? "..." : "APPROVE"}
                    </button>
                  )}
                  {/* Schedule inline */}
                  {post.status !== "scheduled" && post.status !== "published" && (
                    <div className="flex flex-col gap-1">
                      <input
                        type="datetime-local"
                        value={scheduleTime[post.id] ?? ""}
                        onChange={(e) => setScheduleTime((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        className="w-full bg-white/6 border border-white/10 rounded px-1.5 py-1 text-[9px] text-white/55 font-mono focus:outline-none focus:border-[#a78bfa]/40"
                      />
                      <button
                        onClick={() => handleSchedule(post.id)}
                        disabled={!scheduleTime[post.id] || schedulingId === post.id}
                        className="px-2.5 py-1 rounded border border-[#a78bfa]/25 text-[10px] font-mono text-[#a78bfa]/60 hover:bg-[#a78bfa]/10 transition-all disabled:opacity-30"
                      >
                        {schedulingId === post.id ? "..." : "SCHEDULE"}
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deleting === post.id}
                    className="px-2.5 py-1 rounded border border-[#ff2d55]/15 text-[10px] font-mono text-[#ff2d55]/40 hover:bg-[#ff2d55]/10 transition-all disabled:opacity-40"
                  >
                    {deleting === post.id ? "..." : "DELETE"}
                  </button>
                </div>
              </div>

              {/* Inline post preview */}
              {previewId === post.id && (
                <div className="border-t border-white/6 p-4 bg-[#080d12]">
                  <XPostPreview
                    content={post.content}
                    postType={post.post_type}
                    threadPosts={post.thread_posts.map((tp) => ({ position: tp.position, text: tp.text }))}
                    hookScore={post.hook_score}
                    estimatedReach={post.estimated_reach}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
