interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "success" | "warning" | "danger" | "info";
}

const ACCENT = {
  default: "text-text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export default function KpiCard({ label, value, sub, accent = "default" }: KpiCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
      <div className="text-xs font-medium text-text-tertiary uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${ACCENT[accent]}`}>{value}</div>
      {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
    </div>
  );
}
