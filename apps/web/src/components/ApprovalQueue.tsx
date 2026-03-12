"use client";

import { useCallback, useEffect, useState } from "react";
import type { Draft, DraftStatus } from "@/lib/api";
import { approveDraft, fetchDrafts, rejectDraft, returnToDraft, submitForReview } from "@/lib/api";
import DraftStatusBadge from "@/components/DraftStatusBadge";
import SchedulePanel from "@/components/SchedulePanel";

const STATUS_FILTERS: { label: string; value: DraftStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "In Review", value: "in_review" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Scheduled", value: "scheduled" },
];

export default function ApprovalQueue() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filter, setFilter] = useState<DraftStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filter === "all" ? {} : { status: filter };
      const res = await fetchDrafts(params);
      setDrafts(res.drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: (id: string) => Promise<Draft>, draftId: string) => {
    try {
      const updated = await action(draftId);
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  };

  const handleScheduled = (updated: Draft) => {
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const btnStyle = (bg: string): React.CSSProperties => ({
    padding: "4px 12px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.75rem",
  });

  return (
    <div>
      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "1rem", flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "6px 14px",
              background: filter === f.value ? "#0070f3" : "#eee",
              color: filter === f.value ? "#fff" : "#333",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: filter === f.value ? 600 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "0.75rem", background: "#fdecea", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem", color: "#d32f2f" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "8px", cursor: "pointer", background: "none", border: "none", color: "#d32f2f" }}>&times;</button>
        </div>
      )}

      {loading && <div style={{ color: "#888", padding: "2rem", textAlign: "center" }}>Loading...</div>}

      {!loading && drafts.length === 0 && (
        <div style={{ color: "#888", padding: "2rem", textAlign: "center" }}>No drafts found.</div>
      )}

      {!loading && drafts.map((draft) => (
        <div
          key={draft.id}
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div>
              <strong style={{ fontSize: "0.95rem" }}>{draft.title}</strong>
              <span style={{ marginLeft: "8px", fontSize: "0.75rem", color: "#888" }}>{draft.format}</span>
            </div>
            <DraftStatusBadge status={draft.status} />
          </div>

          {draft.status === "scheduled" && draft.scheduled_for && (
            <div style={{ fontSize: "0.8rem", color: "#004085", marginBottom: "0.5rem" }}>
              Scheduled: {new Date(draft.scheduled_for).toLocaleString()}
              {draft.schedule_notes && <span style={{ marginLeft: "8px", color: "#666" }}>— {draft.schedule_notes}</span>}
            </div>
          )}

          {/* Schedule panel for approved drafts */}
          {draft.status === "approved" && <SchedulePanel draft={draft} onScheduled={handleScheduled} />}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {draft.status === "draft" && (
              <button style={btnStyle("#0070f3")} onClick={() => handleAction(submitForReview, draft.id)}>
                Submit for Review
              </button>
            )}
            {draft.status === "in_review" && (
              <>
                <button style={btnStyle("#28a745")} onClick={() => handleAction(approveDraft, draft.id)}>Approve</button>
                <button style={btnStyle("#dc3545")} onClick={() => handleAction(rejectDraft, draft.id)}>Reject</button>
                <button style={btnStyle("#6c757d")} onClick={() => handleAction(returnToDraft, draft.id)}>Return to Draft</button>
              </>
            )}
            {draft.status === "rejected" && (
              <button style={btnStyle("#6c757d")} onClick={() => handleAction(returnToDraft, draft.id)}>Return to Draft</button>
            )}
          </div>

          <div style={{ fontSize: "0.7rem", color: "#aaa", marginTop: "0.5rem" }}>
            {draft.id.slice(0, 8)}... &middot; Updated {new Date(draft.updated_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
