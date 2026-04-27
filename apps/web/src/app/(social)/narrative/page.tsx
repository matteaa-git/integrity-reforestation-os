"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchNarrativeArcs,
  fetchNarrativeThreads,
  fetchPlanters,
  fetchWarRoomMetrics,
  fetchRecommendedActions,
  fetchNarrativeTopics,
  reclusterTopics,
  fetchResponseQueue,
  addToResponseQueue,
  type ArcListResponse,
  type ThreadListResponse,
  type PlanterListResponse,
  type WarRoomMetrics,
  type ActionPanelResponse,
  type NarrativeTopicListResponse,
  type ResponseQueueListResponse,
} from "@/lib/api";

import NarrativeRadar, { type NarrativeTopic } from "@/components/narrative/NarrativeRadar";
import ResponsePanel from "@/components/narrative/ResponsePanel";
import ResponseQueue from "@/components/narrative/ResponseQueue";
import OpportunityEngine from "@/components/narrative/OpportunityEngine";
import NarrativeBuilder from "@/components/narrative/NarrativeBuilder";
import ThreadStudio from "@/components/narrative/ThreadStudio";
import MediaIntelligence from "@/components/narrative/MediaIntelligence";
import WildfireMap from "@/components/narrative/WildfireMap";
import ContentWarRoom from "@/components/narrative/ContentWarRoom";
import CrossPlatform from "@/components/narrative/CrossPlatform";
import PlanterEngine from "@/components/narrative/PlanterEngine";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

type TabKey =
  | "radar"
  | "queue"
  | "opportunities"
  | "builder"
  | "threads"
  | "media"
  | "map"
  | "warroom"
  | "multiply"
  | "planters";

const TABS: { key: TabKey; label: string; icon: string; color: string }[] = [
  { key: "radar",         label: "Narrative Radar",    icon: "◉",  color: "#ff2d55" },
  { key: "queue",         label: "Response Queue",     icon: "≡",  color: "#00ff88" },
  { key: "opportunities", label: "Opportunity Engine", icon: "⬡",  color: "#ff9500" },
  { key: "builder",       label: "Narrative Builder",  icon: "◧",  color: "#00ff88" },
  { key: "threads",       label: "Thread Studio",      icon: "≡",  color: "#00d4ff" },
  { key: "media",         label: "Media Intelligence", icon: "▤",  color: "#f472b6" },
  { key: "map",           label: "Wildfire Intel",     icon: "◉",  color: "#ff6b35" },
  { key: "warroom",       label: "War Room",           icon: "⊛",  color: "#ff2d55" },
  { key: "multiply",      label: "Cross-Platform",     icon: "⊕",  color: "#a78bfa" },
  { key: "planters",      label: "Planter Stories",    icon: "◍",  color: "#fbbf24" },
];

// ---------------------------------------------------------------------------
// Empty fallbacks
// ---------------------------------------------------------------------------

const EMPTY_ARCS:    ArcListResponse    = { arcs: [], total: 0 };
const EMPTY_THREADS: ThreadListResponse = { threads: [], total: 0 };
const EMPTY_PLANTERS:PlanterListResponse= { planters: [], total: 0 };
const EMPTY_WARROOM: WarRoomMetrics = {
  narrative_velocity: 0, active_narratives: 0, narrative_reach_7d: 0,
  top_narrative: "—", signals_detected: 0, opportunities_open: 0,
  content_pipeline: { drafts: 0, in_review: 0, approved: 0, scheduled: 0 },
  signal_alerts: [], narrative_performance: [],
};
const EMPTY_TOPICS: NarrativeTopicListResponse = {
  topics: [], total: 0, respond_now_count: 0, good_opportunity_count: 0,
  last_clustered: new Date().toISOString(),
};
const EMPTY_QUEUE: ResponseQueueListResponse = {
  items: [], total: 0, draft_count: 0, review_count: 0, approved_count: 0, scheduled_count: 0,
};

// ---------------------------------------------------------------------------
// Page entry
// ---------------------------------------------------------------------------

export default function NarrativePage() {
  return (
    <Suspense fallback={null}>
      <NarrativeDashboard />
    </Suspense>
  );
}

function NarrativeDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") ?? "radar") as TabKey;

  const [loading,    setLoading]    = useState(true);
  const [arcs,       setArcs]       = useState<ArcListResponse>(EMPTY_ARCS);
  const [threads,    setThreads]    = useState<ThreadListResponse>(EMPTY_THREADS);
  const [planters,   setPlanters]   = useState<PlanterListResponse>(EMPTY_PLANTERS);
  const [warroom,    setWarroom]    = useState<WarRoomMetrics>(EMPTY_WARROOM);
  const [actions,    setActions]    = useState<ActionPanelResponse | null>(null);
  const [topics,     setTopics]     = useState<NarrativeTopicListResponse>(EMPTY_TOPICS);
  const [queue,      setQueue]      = useState<ResponseQueueListResponse>(EMPTY_QUEUE);
  const [lastRefresh,setLastRefresh]= useState<Date>(new Date());

  // Panel state
  const [selectedTopic, setSelectedTopic] = useState<NarrativeTopic | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [a, th, pl, wr, ac, tp, q] = await Promise.all([
      fetchNarrativeArcs().catch(() => EMPTY_ARCS),
      fetchNarrativeThreads().catch(() => EMPTY_THREADS),
      fetchPlanters().catch(() => EMPTY_PLANTERS),
      fetchWarRoomMetrics().catch(() => EMPTY_WARROOM),
      fetchRecommendedActions().catch(() => null),
      fetchNarrativeTopics({ limit: 30 }).catch(() => EMPTY_TOPICS),
      fetchResponseQueue().catch(() => EMPTY_QUEUE),
    ]);
    setArcs(a);
    setThreads(th);
    setPlanters(pl);
    setWarroom(wr);
    setActions(ac);
    setTopics(tp);
    setQueue(q);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  const loadQueue = useCallback(async () => {
    const q = await fetchResponseQueue().catch(() => EMPTY_QUEUE);
    setQueue(q);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const setTab = (tab: TabKey) => router.replace(`/narrative?tab=${tab}`);

  const handleRecluster = useCallback(async () => {
    const tp = await reclusterTopics().catch(() => EMPTY_TOPICS);
    setTopics(tp);
  }, []);

  const handleSendToQueue = useCallback(async (
    topicId: string,
    platform: string,
    contentType: string,
    content: object,
  ) => {
    const topic = topics.topics.find((t) => t.topic_id === topicId);
    await addToResponseQueue({
      topic_id: topicId,
      topic_title: topic?.title ?? "Narrative",
      platform,
      content_type: contentType,
      content: content as Record<string, unknown>,
    }).catch(() => null);
    await loadQueue();
  }, [topics.topics, loadQueue]);

  const queueBadge = queue.draft_count + queue.review_count;

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: "#05050f", color: "#e2e8f0" }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0 border-b sticky top-0 z-20"
        style={{ borderColor: "rgba(0,255,136,0.08)", background: "rgba(5,5,15,0.95)", backdropFilter: "blur(12px)" }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#00ff88] text-xs font-mono animate-pulse">●</span>
            <span className="text-sm font-bold tracking-tight text-white">NARRATIVE DOMINANCE ENGINE</span>
            <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">v2.0</span>
          </div>
          <div className="text-[10px] text-white/25 font-mono">
            Integrity Reforestation · Narrative Response Engine
          </div>
        </div>

        <div className="flex items-center gap-4">
          {[
            { label: "NARRATIVES",   value: topics.total,                color: "#ff2d55", urgent: topics.respond_now_count },
            { label: "RESPOND NOW",  value: topics.respond_now_count,    color: "#ff9500" },
            { label: "QUEUE",        value: queue.total,                  color: "#00ff88", urgent: queueBadge },
            { label: "7D REACH",     value: warroom.narrative_reach_7d >= 1000
              ? `${(warroom.narrative_reach_7d / 1000).toFixed(0)}K`
              : warroom.narrative_reach_7d,                               color: "#a78bfa" },
          ].map((kpi) => (
            <div key={kpi.label} className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-base font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</span>
                {kpi.urgent ? (
                  <span className="text-[10px] font-mono bg-[#ff2d55]/20 text-[#ff2d55] px-1 py-0.5 rounded">
                    {kpi.urgent}
                  </span>
                ) : null}
              </div>
              <div className="text-[9px] text-white/20 font-mono uppercase tracking-wider">{kpi.label}</div>
            </div>
          ))}

          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono text-white/40 hover:border-white/20 hover:text-white/60 transition-all disabled:opacity-40"
          >
            <span className={loading ? "animate-spin" : ""}>⟳</span>
            {loading ? "SYNCING" : "REFRESH"}
          </button>
        </div>
      </header>

      {/* ── Tab Nav ──────────────────────────────────────────────────────── */}
      <nav
        className="flex items-center gap-0.5 px-4 py-1.5 shrink-0 overflow-x-auto border-b sticky top-[52px] z-10"
        style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(5,5,15,0.95)", backdropFilter: "blur(12px)" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const hasBadge =
            (tab.key === "radar" && topics.respond_now_count > 0) ||
            (tab.key === "queue" && queueBadge > 0) ||
            (tab.key === "warroom" && warroom.signal_alerts.filter((a) => a.level === "critical").length > 0);

          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all relative ${
                isActive ? "text-white bg-white/8" : "text-white/35 hover:text-white/60 hover:bg-white/4"
              }`}
              style={isActive ? { color: tab.color } : undefined}
            >
              <span>{tab.icon}</span>
              <span className="uppercase tracking-wider">{tab.label}</span>
              {hasBadge && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse absolute top-1 right-1 bg-[#ff2d55]" />
              )}
            </button>
          );
        })}

        <div className="ml-auto text-[10px] text-white/15 font-mono whitespace-nowrap pl-3">
          {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <main
        className="flex-1 p-4"
        style={{
          background: "#05050f",
          // Shrink content when panel is open so it doesn't go behind it
          marginRight: selectedTopic && activeTab === "radar" ? "480px" : "0",
          transition: "margin-right 0.2s ease",
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-10 h-10 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: "#00ff88", borderRightColor: "#00d4ff" }}
              />
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">
                LOADING INTELLIGENCE
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "radar" && (
              <NarrativeRadar
                data={topics}
                onSelectTopic={(t) => setSelectedTopic(selectedTopic?.topic_id === t.topic_id ? null : t)}
                selectedTopicId={selectedTopic?.topic_id ?? null}
                onRecluster={handleRecluster}
              />
            )}
            {activeTab === "queue" && (
              <ResponseQueue
                data={queue}
                apiBase={API_BASE}
                onRefresh={loadQueue}
              />
            )}
            {activeTab === "opportunities" && <OpportunityEngine data={{ opportunities: [], total: 0, critical_count: 0, high_count: 0 }} />}
            {activeTab === "builder"       && <NarrativeBuilder data={arcs} />}
            {activeTab === "threads"       && <ThreadStudio data={threads} />}
            {activeTab === "media"         && <MediaIntelligence />}
            {activeTab === "map"           && <WildfireMap />}
            {activeTab === "warroom"       && <ContentWarRoom data={warroom} actions={actions} signalStats={null} />}
            {activeTab === "multiply"      && <CrossPlatform />}
            {activeTab === "planters"      && <PlanterEngine data={planters} />}
          </>
        )}
      </main>

      {/* ── Response Panel (slide in from right) ─────────────────────────── */}
      {selectedTopic && activeTab === "radar" && (
        <ResponsePanel
          topic={selectedTopic}
          apiBase={API_BASE}
          onClose={() => setSelectedTopic(null)}
          onSendToQueue={handleSendToQueue}
        />
      )}
    </div>
  );
}
