"use client";

import { useState } from "react";
import type { Draft } from "@/lib/api";
import { scheduleDraft } from "@/lib/api";

interface SchedulePanelProps {
  draft: Draft;
  onScheduled: (updated: Draft) => void;
}

export default function SchedulePanel({ draft, onScheduled }: SchedulePanelProps) {
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSchedule = async () => {
    if (!datetime) return;
    setSubmitting(true);
    setError(null);
    try {
      const isoDate = new Date(datetime).toISOString();
      const updated = await scheduleDraft(draft.id, {
        scheduled_for: isoDate,
        notes: notes || undefined,
      });
      onScheduled(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setSubmitting(false);
    }
  };

  if (draft.status !== "approved") return null;

  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid #b8daff",
        borderRadius: "8px",
        background: "#f0f7ff",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Schedule Post</h3>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "0.85rem" }}
        />
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "0.85rem", flex: 1, minWidth: "120px" }}
        />
        <button
          onClick={handleSchedule}
          disabled={!datetime || submitting}
          style={{
            padding: "6px 16px",
            background: !datetime || submitting ? "#ccc" : "#004085",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: !datetime || submitting ? "default" : "pointer",
            fontSize: "0.85rem",
          }}
        >
          {submitting ? "Scheduling..." : "Schedule"}
        </button>
      </div>
      {error && <div style={{ color: "#d32f2f", fontSize: "0.8rem" }}>{error}</div>}
    </div>
  );
}
