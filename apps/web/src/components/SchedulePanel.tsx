"use client";

import { useState } from "react";
import type { Draft } from "@/lib/api";
import { scheduleDraft } from "@/lib/api";
import Button from "@/components/ui/Button";

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

  if (draft.status === "rejected" || draft.status === "scheduled") return null;

  return (
    <div className="p-4 border border-info/30 rounded-xl bg-blue-50 mb-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Schedule Post</h3>
      <div className="flex gap-2 flex-wrap mb-2">
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 min-w-[120px] rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <Button onClick={handleSchedule} disabled={!datetime || submitting} size="sm">
          {submitting ? "Scheduling..." : "Schedule"}
        </Button>
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
    </div>
  );
}
