import type { DraftStatus } from "@/lib/api";

const STATUS_STYLES: Record<DraftStatus, { bg: string; color: string; label: string }> = {
  draft: { bg: "#e3e8ef", color: "#333", label: "Draft" },
  in_review: { bg: "#fff3cd", color: "#856404", label: "In Review" },
  approved: { bg: "#d4edda", color: "#155724", label: "Approved" },
  rejected: { bg: "#f8d7da", color: "#721c24", label: "Rejected" },
  scheduled: { bg: "#cce5ff", color: "#004085", label: "Scheduled" },
};

export default function DraftStatusBadge({ status }: { status: DraftStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "12px",
        fontSize: "0.75rem",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}
