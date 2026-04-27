"use client";

import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

const MOCK_KPIS = [
  { label: "Revenue", value: "$12,480", sub: "+18% vs last month", accent: "success" as const },
  { label: "ROAS", value: "3.2x", sub: "Target: 2.5x", accent: "success" as const },
  { label: "CPA", value: "$4.20", sub: "-12% vs last month", accent: "success" as const },
  { label: "CTR", value: "2.8%", sub: "Industry avg: 1.9%", accent: "info" as const },
  { label: "CVR", value: "4.1%", sub: "+0.3pp vs last month", accent: "info" as const },
];

const MOCK_TOP_CREATIVES = [
  { title: "Spring Planting Campaign", hook: "Plant 10 trees today", roas: "4.2x", status: "active" },
  { title: "Earth Day Reel", hook: "See the impact", roas: "3.8x", status: "active" },
  { title: "Before/After Forest", hook: "5 years of growth", roas: "3.1x", status: "active" },
  { title: "Volunteer Story", hook: "Join the movement", roas: "2.9x", status: "paused" },
];

const MOCK_ACTIONS = [
  { action: "Scale Spring Planting — ROAS above target at 4.2x", priority: "high" },
  { action: "Test new hook variant for Earth Day Reel", priority: "medium" },
  { action: "Archive underperforming Volunteer Story creative", priority: "low" },
  { action: "Create carousel variant of Before/After Forest", priority: "medium" },
];

export default function PerformancePage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Performance"
        description="Ad performance metrics and optimization insights"
        actions={
          <Badge variant="warning">Mock Data</Badge>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {MOCK_KPIS.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Creatives */}
        <Card>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">
            Top Performing Creatives
          </div>
          <div className="space-y-3">
            {MOCK_TOP_CREATIVES.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary truncate">{c.title}</div>
                  <div className="text-xs text-text-tertiary mt-0.5">Hook: {c.hook}</div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-sm font-semibold text-success">{c.roas}</span>
                  <Badge variant={c.status === "active" ? "success" : "muted"}>
                    {c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Next Best Actions */}
        <Card>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">
            Next Best Actions
          </div>
          <div className="space-y-3">
            {MOCK_ACTIONS.map((a, i) => {
              const priorityVariant = a.priority === "high" ? "danger" : a.priority === "medium" ? "warning" : "default";
              return (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border-light last:border-0">
                  <Badge variant={priorityVariant}>{a.priority}</Badge>
                  <div className="text-sm text-text-primary">{a.action}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Note */}
      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Performance data is mocked until the analytics engine is connected. KPIs will be populated from real Meta Ads and Instagram Insights data.
      </div>
    </div>
  );
}
