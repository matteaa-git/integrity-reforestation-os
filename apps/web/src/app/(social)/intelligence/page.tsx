"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type {
  FlywheelMetrics,
  ContentScoresResponse,
  TrendRadarResponse,
  PortfolioAnalysis,
  InstagramStatus,
} from "@/lib/api";
import {
  fetchFlywheelMetrics,
  fetchContentScores,
  fetchTrends,
  fetchPortfolioAnalysis,
  fetchInstagramStatus,
} from "@/lib/api";
import FlywheelPanel from "@/components/intelligence/FlywheelPanel";
import ContentScoreTable from "@/components/intelligence/ContentScoreTable";
import OpportunityRadar from "@/components/intelligence/OpportunityRadar";
import HookAnalyzerPanel from "@/components/intelligence/HookAnalyzerPanel";
import PortfolioPanel from "@/components/intelligence/PortfolioPanel";
import InstagramConnect from "@/components/intelligence/InstagramConnect";
import InstagramAnalyticsDashboard from "@/components/intelligence/InstagramAnalyticsDashboard";
import type { InstagramAnalytics } from "@/lib/api";
import { fetchInstagramAnalytics, syncInstagram } from "@/lib/api";

type Tab = "flywheel" | "radar" | "hook" | "portfolio" | "instagram";

const TABS: { key: Tab; label: string; icon: string; description: string }[] = [
  { key: "flywheel", label: "Growth Flywheel", icon: "◎", description: "Pipeline health & AI recommendations" },
  { key: "radar", label: "Opportunity Radar", icon: "⊙", description: "Emerging trends & content ideas" },
  { key: "hook", label: "Hook Analyzer", icon: "⚗", description: "Score & improve your opening lines" },
  { key: "portfolio", label: "Portfolio Mix", icon: "◑", description: "Format & narrative balance optimizer" },
  { key: "instagram", label: "Instagram", icon: "◈", description: "Account performance & real post data" },
];

function IntelligenceDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as Tab) ?? "flywheel";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const [flywheel, setFlywheel] = useState<FlywheelMetrics | null>(null);
  const [scores, setScores] = useState<ContentScoresResponse | null>(null);
  const [trends, setTrends] = useState<TrendRadarResponse | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioAnalysis | null>(null);
  const [igStatus, setIgStatus] = useState<InstagramStatus | null>(null);
  const [igAnalytics, setIgAnalytics] = useState<InstagramAnalytics | null>(null);
  const [igAnalyticsLoading, setIgAnalyticsLoading] = useState(false);
  const [igSyncing, setIgSyncing] = useState(false);

  const [flywheelLoading, setFlywheelLoading] = useState(false);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const loadFlywheel = useCallback(async () => {
    setFlywheelLoading(true);
    try { setFlywheel(await fetchFlywheelMetrics()); } catch { /* API offline */ } finally { setFlywheelLoading(false); }
  }, []);

  const loadScores = useCallback(async () => {
    setScoresLoading(true);
    try { setScores(await fetchContentScores()); } catch { /* API offline */ } finally { setScoresLoading(false); }
  }, []);

  const loadTrends = useCallback(async () => {
    setTrendsLoading(true);
    try { setTrends(await fetchTrends()); } catch { /* API offline */ } finally { setTrendsLoading(false); }
  }, []);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try { setPortfolio(await fetchPortfolioAnalysis()); } catch { /* API offline */ } finally { setPortfolioLoading(false); }
  }, []);

  const loadIgStatus = useCallback(async () => {
    try { setIgStatus(await fetchInstagramStatus()); } catch { /* API offline */ }
  }, []);

  const loadIgAnalytics = useCallback(async () => {
    setIgAnalyticsLoading(true);
    try { setIgAnalytics(await fetchInstagramAnalytics()); } catch { /* not connected */ } finally { setIgAnalyticsLoading(false); }
  }, []);

  useEffect(() => { loadFlywheel(); loadScores(); loadTrends(); loadPortfolio(); loadIgStatus(); }, [loadFlywheel, loadScores, loadTrends, loadPortfolio, loadIgStatus]);

  // Load analytics if starting on the instagram tab
  useEffect(() => {
    if (initialTab === "instagram") loadIgAnalytics();
  }, [initialTab, loadIgAnalytics]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFlywheel(), loadScores(), loadTrends(), loadPortfolio(), loadIgStatus()]);
    setRefreshing(false);
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    router.replace(`/intelligence${tab !== "flywheel" ? `?tab=${tab}` : ""}`, { scroll: false });
    if (tab === "instagram" && igStatus?.connected && !igAnalytics) {
      loadIgAnalytics();
    }
  };

  const handleIgSync = async () => {
    setIgSyncing(true);
    try { await syncInstagram(); await loadIgAnalytics(); await loadIgStatus(); } catch { /* silent */ } finally { setIgSyncing(false); }
  };

  const avgScore = scores?.items.length
    ? Math.round(scores.items.reduce((s, i) => s + i.viral_probability, 0) / scores.items.length)
    : null;

  return (
    <div className="h-screen flex flex-col bg-[#0e0e1a] text-white overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 px-6 py-4 border-b border-white/5 bg-[#12121f]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-bold text-white">Content Intelligence Engine</h1>
            <p className="text-[11px] text-white/35 mt-0.5">Predict performance before you post</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Summary stats */}
            {scores && flywheel && (
              <div className="flex items-center gap-5">
                {igStatus?.connected && igStatus.followers_count ? (
                  <Kpi
                    label="Followers"
                    value={igStatus.followers_count >= 1000 ? `${(igStatus.followers_count / 1000).toFixed(1)}K` : String(igStatus.followers_count)}
                    accent
                  />
                ) : null}
                <Kpi label="Avg Viral Score" value={avgScore !== null ? String(avgScore) : "—"} accent={avgScore !== null && avgScore >= 65} />
                <Kpi label="Pipeline Health" value={`${Math.round(flywheel.pipeline_health)}%`} accent={flywheel.pipeline_health >= 60} />
                <Kpi label="Drafts Scored" value={String(scores.total)} />
              </div>
            )}
            {/* Instagram connection pill */}
            <button
              onClick={() => switchTab("instagram")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-colors ${
                igStatus?.connected
                  ? "bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-pink-500/30 text-pink-300"
                  : "bg-white/5 border-white/10 text-white/30 hover:text-white/50"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${igStatus?.connected ? "bg-pink-400" : "bg-white/20"}`} />
              {igStatus?.connected ? `@${igStatus.username}` : "Connect IG"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white/60 text-[11px] border border-white/8 transition-colors"
            >
              <span className={refreshing ? "animate-spin" : ""}>↻</span>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="shrink-0 px-6 border-b border-white/5 bg-[#12121f]">
        <div className="flex gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#39de8b] text-[#39de8b]"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              <span className="text-[11px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "flywheel" && (
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
            <FlywheelPanel data={flywheel} loading={flywheelLoading} />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[13px] font-bold text-white">Content Score Forecast</h2>
                  <p className="text-[10px] text-white/35 mt-0.5">All drafts ranked by predicted viral probability</p>
                </div>
                {scores && scores.total > 0 && (
                  <div className="text-[10px] text-white/30">{scores.total} pieces scored</div>
                )}
              </div>
              <ContentScoreTable items={scores?.items ?? []} loading={scoresLoading} />
            </div>
          </div>
        )}

        {activeTab === "radar" && (
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="mb-5">
              <h2 className="text-[13px] font-bold text-white">Opportunity Radar</h2>
              <p className="text-[10px] text-white/35 mt-0.5">
                Trending topics across Instagram, TikTok, YouTube, Reddit, Google & News — ranked by brand relevance
              </p>
            </div>
            <OpportunityRadar data={trends} loading={trendsLoading} />
          </div>
        )}

        {activeTab === "hook" && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="mb-5">
              <h2 className="text-[13px] font-bold text-white">AI Hook Analyzer</h2>
              <p className="text-[10px] text-white/35 mt-0.5">
                Score any caption hook or opening line and get stronger AI-suggested alternatives
              </p>
            </div>
            <HookAnalyzerPanel />
          </div>
        )}

        {activeTab === "portfolio" && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="mb-5">
              <h2 className="text-[13px] font-bold text-white">Portfolio Optimizer</h2>
              <p className="text-[10px] text-white/35 mt-0.5">
                Weekly content mix analysis — format distribution, narrative balance, and growth recommendations
              </p>
            </div>
            <PortfolioPanel data={portfolio} loading={portfolioLoading} />
          </div>
        )}

        {activeTab === "instagram" && (
          <div className={`${igStatus?.connected && igAnalytics ? "max-w-5xl" : "max-w-2xl"} mx-auto px-6 py-6 space-y-6`}>
            {!igStatus?.connected ? (
              <>
                <div>
                  <h2 className="text-[13px] font-bold text-white">Instagram Account</h2>
                  <p className="text-[10px] text-white/35 mt-0.5">
                    Connect your account to feed real reach, saves, and follower data into all Intelligence panels
                  </p>
                </div>
                <InstagramConnect onStatusChange={(connected) => {
                  if (connected) {
                    loadFlywheel();
                    loadPortfolio();
                    loadIgStatus();
                    loadIgAnalytics();
                  }
                }} />
              </>
            ) : igAnalyticsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-white/8 bg-[#12121f] h-32 animate-pulse" />
                ))}
              </div>
            ) : igAnalytics ? (
              <InstagramAnalyticsDashboard
                data={igAnalytics}
                onSync={handleIgSync}
                syncing={igSyncing}
              />
            ) : (
              <>
                <InstagramConnect onStatusChange={(connected) => {
                  if (connected) {
                    loadFlywheel();
                    loadPortfolio();
                    loadIgStatus();
                    loadIgAnalytics();
                  }
                }} />
                <button
                  onClick={loadIgAnalytics}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-[12px] transition-colors"
                >
                  Load Analytics
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense fallback={null}>
      <IntelligenceDashboard />
    </Suspense>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`text-[16px] font-bold leading-none ${accent ? "text-[#39de8b]" : "text-white"}`}>{value}</div>
      <div className="text-[9px] text-white/30 mt-0.5">{label}</div>
    </div>
  );
}
