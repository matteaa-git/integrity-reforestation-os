import type { DraftStatus } from "@/lib/api";
import Badge from "@/components/ui/Badge";

const STATUS_MAP: Record<DraftStatus, { variant: "default" | "success" | "warning" | "danger" | "info" | "muted"; label: string }> = {
  draft:          { variant: "default", label: "Draft" },
  in_review:      { variant: "warning", label: "In Review" },
  approved:       { variant: "success", label: "Approved" },
  rejected:       { variant: "danger",  label: "Rejected" },
  scheduled:      { variant: "info",    label: "Scheduled" },
  publishing:     { variant: "info",    label: "Publishing…" },
  published:      { variant: "success", label: "Published" },
  publish_failed: { variant: "danger",  label: "Publish Failed" },
  failed:         { variant: "danger",  label: "Failed" },
};

export default function DraftStatusBadge({ status }: { status: DraftStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
