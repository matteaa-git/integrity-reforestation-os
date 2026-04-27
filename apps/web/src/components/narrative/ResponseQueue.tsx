"use client";

import { useState, useCallback } from "react";

interface ResponseQueueItem {
  item_id: string;
  topic_id: string;
  topic_title: string;
  platform: string;
  content_type: string;
  status: string;
  content: Record<string, unknown>;
  created_at: string;
  scheduled_for: string | null;
}

interface ResponseQueueListResponse {
  items: ResponseQueueItem[];
  total: number;
  draft_count: number;
  review_count: number;
  approved_count: number;
  scheduled_count: number;
}

interface Props {
  data: ResponseQueueListResponse;
  apiBase: string;
  onRefresh: () => void;
}

const PLATFORM_STYLES: Record<string, { label: string; color: string; icon: string }> = {
  x:        { label: "X",        color: "#e2e8f0", icon: "𝕏"  },
  linkedin: { label: "LinkedIn", color: "#0a66c2", icon: "in" },
  substack: { label: "Substack", color: "#ff6719", icon: "S"  },
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "#64748b", bg: "bg-[#64748b]/10 border-[#64748b]/30" },
  review:    { label: "In Review", color: "#fbbf24", bg: "bg-[#fbbf24]/10 border-[#fbbf24]/30" },
  approved:  { label: "Approved",  color: "#00d4ff", bg: "bg-[#00d4ff]/10 border-[#00d4ff]/30" },
  scheduled: { label: "Scheduled", color: "#00ff88", bg: "bg-[#00ff88]/10 border-[#00ff88]/30" },
};

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }> = {
  draft:    { next: "review",    label: "Submit for Review" },
  review:   { next: "approved",  label: "Approve" },
  approved: { next: "scheduled", label: "Schedule" },
};

export default function ResponseQueue({ data, apiBase, onRefresh }: Props) {
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const handleTransition = useCallback(async (item: ResponseQueueItem, newStatus: string) => {
    setTransitioning(item.item_id);
    try {
      await fetch(`${apiBase}/narrative-response/queue/${item.item_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setTransitioning(null);
    }
  }, [apiBase, onRefresh]);

  const handleDelete = useCallback(async (itemId: string) => {
    setDeleting(itemId);
    try {
      await fetch(`${apiBase}/narrative-response/queue/${itemId}`, { method: "DELETE" });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }, [apiBase, onRefresh]);

  const filtered = data.items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterPlatform !== "all" && item.platform !== filterPlatform) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "DRAFTS",     value: data.draft_count,     color: "#64748b" },
          { label: "IN REVIEW",  value: data.review_count,    color: "#fbbf24" },
          { label: "APPROVED",   value: data.approved_count,  color: "#00d4ff" },
          { label: "SCHEDULED",  value: data.scheduled_count, color: "#00ff88" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-white/8 bg-white/3 p-3 text-center">
            <div className="text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[10px] text-white/25 font-mono uppercase tracking-wider mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {["all", "draft", "review", "approved", "scheduled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                filterStatus === s
                  ? "border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10"
                  : "border-white/8 text-white/30 hover:border-white/15 hover:text-white/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {["all", "x", "linkedin", "substack"].map((p) => (
            <button
              key={p}
              onClick={() => setFilterPlatform(p)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                filterPlatform === p
                  ? "border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10"
                  : "border-white/8 text-white/30 hover:border-white/15 hover:text-white/50"
              }`}
            >
              {p === "all" ? "ALL" : (PLATFORM_STYLES[p]?.label ?? p)}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="text-white/10 text-5xl">≡</div>
          <div className="text-center">
            <div className="text-white/40 text-sm font-mono uppercase tracking-widest mb-1">
              No items in queue
            </div>
            <div className="text-white/20 text-xs font-mono">
              Generate a response from a narrative card and send it to queue
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/2 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-mono text-white/25 uppercase tracking-wider border-b border-white/6">
            <div className="col-span-4">NARRATIVE</div>
            <div className="col-span-2">PLATFORM</div>
            <div className="col-span-2">TYPE</div>
            <div className="col-span-2">STATUS</div>
            <div className="col-span-2">ACTIONS</div>
          </div>

          {filtered.map((item) => {
            const plt = PLATFORM_STYLES[item.platform] ?? { label: item.platform, color: "#64748b", icon: "?" };
            const st = STATUS_STYLES[item.status] ?? STATUS_STYLES.draft;
            const transition = STATUS_TRANSITIONS[item.status];
            const isExpanded = expandedItem === item.item_id;

            return (
              <div key={item.item_id} className="border-b border-white/6 last:border-0">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/3 transition-colors">
                  {/* Narrative */}
                  <div className="col-span-4">
                    <button
                      className="text-left"
                      onClick={() => setExpandedItem(isExpanded ? null : item.item_id)}
                    >
                      <div className="text-sm text-white/75 font-medium leading-tight hover:text-white/90 transition-colors">
                        {item.topic_title.slice(0, 50)}{item.topic_title.length > 50 ? "…" : ""}
                      </div>
                      <div className="text-[10px] text-white/25 font-mono mt-0.5">
                        {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </button>
                  </div>

                  {/* Platform */}
                  <div className="col-span-2">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold"
                      style={{ color: plt.color }}
                    >
                      <span>{plt.icon}</span>
                      <span>{plt.label}</span>
                    </span>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span className="text-[11px] font-mono text-white/40 capitalize">
                      {item.content_type.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${st.bg}`} style={{ color: st.color }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center gap-1">
                    {transition && (
                      <button
                        onClick={() => handleTransition(item, transition.next)}
                        disabled={transitioning === item.item_id}
                        className="px-2 py-1 rounded text-[10px] font-mono border border-white/10 text-white/40 hover:border-white/25 hover:text-white/60 transition-all disabled:opacity-40"
                      >
                        {transitioning === item.item_id ? "..." : transition.label.split(" ")[0]}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item.item_id)}
                      disabled={deleting === item.item_id}
                      className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-[#ff2d55] hover:bg-[#ff2d55]/10 transition-all disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Expanded content preview */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/6 pt-3">
                    <pre className="text-[11px] text-white/40 font-mono leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {JSON.stringify(item.content, null, 2).slice(0, 600)}
                      {JSON.stringify(item.content).length > 600 ? "\n..." : ""}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
