"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { fetchAssets, fetchDrafts, fetchAdCreatives } from "@/lib/api";

interface DashboardData {
  assetsReady: number;
  draftsWaiting: number;
  storiesToday: number;
  reelsToday: number;
  carouselsToday: number;
  adCreatives: number;
  scheduledCount: number;
}

export default function GrowthCommandPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [assets, drafts, scheduled, adCreatives] = await Promise.all([
          fetchAssets().catch(() => ({ assets: [], total: 0 })),
          fetchDrafts({ status: "in_review" }).catch(() => ({ drafts: [], total: 0 })),
          fetchDrafts({ status: "scheduled" }).catch(() => ({ drafts: [], total: 0 })),
          fetchAdCreatives().catch(() => ({ ad_creatives: [], total: 0 })),
        ]);

        const scheduledDrafts = scheduled.drafts;
        const stories = scheduledDrafts.filter((d) => d.format === "story").length;
        const reels = scheduledDrafts.filter((d) => d.format === "reel").length;
        const carousels = scheduledDrafts.filter((d) => d.format === "carousel").length;

        setData({
          assetsReady: assets.total,
          draftsWaiting: drafts.total,
          storiesToday: stories,
          reelsToday: reels,
          carouselsToday: carousels,
          adCreatives: adCreatives.total,
          scheduledCount: scheduled.total,
        });
      } catch {
        setData({
          assetsReady: 0, draftsWaiting: 0, storiesToday: 0,
          reelsToday: 0, carouselsToday: 0, adCreatives: 0, scheduledCount: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Growth Command"
        description="Content production and paid-growth dashboard"
      />

      {loading ? (
        <div className="text-sm text-text-tertiary py-12 text-center">Loading dashboard...</div>
      ) : data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <KpiCard label="Assets Ready" value={data.assetsReady} accent="info" />
            <KpiCard label="Awaiting Review" value={data.draftsWaiting} accent={data.draftsWaiting > 0 ? "warning" : "default"} />
            <KpiCard label="Stories Scheduled" value={data.storiesToday} sub="Target: 10/day" />
            <KpiCard label="Reels Scheduled" value={data.reelsToday} sub="Target: 3/day" />
            <KpiCard label="Carousels Scheduled" value={data.carouselsToday} sub="Target: 1/day" />
          </div>

          {/* System Health */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Asset Indexing</span>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="text-2xl font-bold">{data.assetsReady}</div>
              <div className="text-xs text-text-secondary mt-1">assets in library</div>
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Draft Queue</span>
                <Badge variant={data.draftsWaiting > 0 ? "warning" : "success"}>
                  {data.draftsWaiting > 0 ? `${data.draftsWaiting} pending` : "Clear"}
                </Badge>
              </div>
              <div className="text-2xl font-bold">{data.scheduledCount}</div>
              <div className="text-xs text-text-secondary mt-1">scheduled for publishing</div>
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Ad Lab</span>
                <Badge variant="info">Active</Badge>
              </div>
              <div className="text-2xl font-bold">{data.adCreatives}</div>
              <div className="text-xs text-text-secondary mt-1">ad creatives</div>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <div className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-4">Quick Actions</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { href: "/stories/new", label: "New Story", icon: "▣" },
                { href: "/reels/new", label: "New Reel", icon: "▶" },
                { href: "/carousels/new", label: "New Carousel", icon: "⊞" },
                { href: "/ad-lab", label: "Ad Lab", icon: "◈" },
              ].map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-blue-50/50 transition-colors text-sm font-medium text-text-primary"
                >
                  <span className="opacity-50">{a.icon}</span>
                  {a.label}
                </a>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
