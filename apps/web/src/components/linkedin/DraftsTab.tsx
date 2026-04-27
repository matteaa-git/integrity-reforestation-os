"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface LinkedInPost {
  id: string;
  content: string;
  post_type: string;
  hook_type: string;
  hashtags: string[];
  visibility: string;
  status: string;
  thought_leadership_score: number;
  estimated_reach: number;
  scheduled_time: string | null;
  published_time: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft:              "bg-gray-100 text-gray-600",
  pending_approval:   "bg-amber-100 text-amber-700",
  approved:           "bg-emerald-100 text-emerald-700",
  scheduled:          "bg-blue-100 text-blue-700",
  published:          "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft:            "Draft",
  pending_approval: "In Review",
  approved:         "Approved",
  scheduled:        "Scheduled",
  published:        "Published",
};

const FILTERS = [
  { label: "All",       value: "" },
  { label: "Drafts",    value: "draft" },
  { label: "In Review", value: "pending_approval" },
  { label: "Approved",  value: "approved" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Published", value: "published" },
];

async function apiFetch(path: string) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

async function apiPost(path: string) {
  const r = await fetch(`${API_BASE}${path}`, { method: "POST" });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

async function apiDelete(path: string) {
  const r = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

export default function DraftsTab() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ total: 0, draft: 0, pending: 0, scheduled: 0, published: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filter ? `/linkedin/drafts?status=${filter}` : "/linkedin/drafts";
      const data = await apiFetch(url);
      setPosts(data.posts);
      setCounts({
        total: data.total,
        draft: data.draft_count,
        pending: data.pending_count,
        scheduled: data.scheduled_count,
        published: data.published_count,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: "submit" | "publish" | "delete", postId: string) => {
    try {
      if (action === "delete") {
        await apiDelete(`/linkedin/${postId}`);
      } else if (action === "submit") {
        await apiPost(`/linkedin/${postId}/submit-approval`);
      } else {
        await apiPost(`/linkedin/${postId}/publish`);
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const scoreColor = (s: number) =>
    s >= 75 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-gray-400";

  return (
    <div className="p-6 max-w-4xl">
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: counts.total, color: "text-text-primary" },
          { label: "Drafts", value: counts.draft, color: "text-gray-500" },
          { label: "In Review", value: counts.pending, color: "text-amber-600" },
          { label: "Scheduled", value: counts.scheduled, color: "text-blue-600" },
          { label: "Published", value: counts.published, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              filter === f.value
                ? "bg-[#0a66c2] text-white shadow-sm"
                : "bg-white border border-border text-text-secondary hover:bg-surface-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-[11px] text-red-700 mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#0a66c2]/30 border-t-[#0a66c2] rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-16 text-text-tertiary">
          <div className="text-3xl mb-3 opacity-30">✍</div>
          <div className="text-sm font-medium">No posts yet</div>
          <div className="text-[11px] mt-1">Create your first LinkedIn post in the Compose tab.</div>
        </div>
      )}

      {/* Post list */}
      {!loading && (
        <div className="space-y-3">
          {posts.map((post) => {
            const isExpanded = expandedId === post.id;
            return (
              <div key={post.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Content preview */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[13px] text-text-primary leading-relaxed ${isExpanded ? "" : "line-clamp-2"} whitespace-pre-wrap`}
                      >
                        {post.content || <span className="text-text-tertiary italic">Empty draft</span>}
                      </div>
                      {post.content.length > 160 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : post.id)}
                          className="text-[11px] text-[#0a66c2] hover:underline mt-0.5"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>

                    {/* Score */}
                    <div className="shrink-0 text-center">
                      <div className={`text-lg font-bold ${scoreColor(post.thought_leadership_score)}`}>
                        {post.thought_leadership_score}
                      </div>
                      <div className="text-[9px] text-text-tertiary">TLS</div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[post.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[post.status] ?? post.status}
                    </span>
                    <span className="text-[10px] text-text-tertiary capitalize">
                      {post.post_type}
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      {post.visibility === "public" ? "🌍 Public" : "👥 Connections"}
                    </span>
                    {post.hashtags.length > 0 && (
                      <span className="text-[10px] text-[#0a66c2]">
                        {post.hashtags.slice(0, 3).join(" ")}
                        {post.hashtags.length > 3 && ` +${post.hashtags.length - 3}`}
                      </span>
                    )}
                    <span className="text-[10px] text-text-tertiary ml-auto">
                      {new Date(post.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Scheduled time */}
                  {post.scheduled_time && (
                    <div className="mt-1.5 text-[11px] text-blue-600">
                      Scheduled: {new Date(post.scheduled_time).toLocaleString()}
                    </div>
                  )}

                  {/* Action row */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border-light">
                    {post.status === "draft" && (
                      <button
                        onClick={() => handleAction("submit", post.id)}
                        className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 transition-colors"
                      >
                        Submit for Review
                      </button>
                    )}
                    {(post.status === "draft" || post.status === "approved") && (
                      <button
                        onClick={() => handleAction("publish", post.id)}
                        className="px-3 py-1 rounded-lg bg-[#0a66c2] text-white text-[10px] font-semibold hover:bg-[#004182] transition-colors"
                      >
                        Publish
                      </button>
                    )}
                    <div className="flex-1" />
                    <span className="text-[9px] text-text-tertiary font-mono">{post.id}</span>
                    <button
                      onClick={() => handleAction("delete", post.id)}
                      className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
