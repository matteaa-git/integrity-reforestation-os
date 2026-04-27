"use client";

import type { WarRoomMetrics, ActionPanelResponse, SignalStatsResponse } from "@/lib/api";

interface Props {
  data: WarRoomMetrics;
  actions?: ActionPanelResponse | null;
  signalStats?: SignalStatsResponse | null;
}

const MOMENTUM_CONFIG = {
  rising:    { color: "#00ff88", icon: "↑", label: "RISING" },
  stable:    { color: "#fbbf24", icon: "→", label: "STABLE" },
  declining: { color: "#ff2d55", icon: "↓", label: "DECLINING" },
};

const ALERT_CONFIG = {
  critical: { color: "#ff2d55", bg: "bg-[#ff2d55]/10 border-[#ff2d55]/30", icon: "⚡" },
  warning:  { color: "#ff9500", bg: "bg-[#ff9500]/10 border-[#ff9500]/30", icon: "△" },
  info:     { color: "#00d4ff", bg: "bg-[#00d4ff]/10 border-[#00d4ff]/30", icon: "◎" },
};

function StatBlock({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 p-4">
      <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: color ?? "#fff" }}>
        {value}
        {unit && <span className="text-sm text-white/40 ml-1 font-normal">{unit}</span>}
      </div>
    </div>
  );
}

const URGENCY_COLORS: Record<string, string> = {
  critical: "#ff2d55",
  high:     "#ff9500",
  medium:   "#fbbf24",
  low:      "#00ff88",
};

export default function ContentWarRoom({ data, actions, signalStats }: Props) {
  const maxReach = Math.max(...data.narrative_performance.map((r) => r.reach), 1);

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBlock label="7-Day Reach" value={`${(data.narrative_reach_7d / 1000).toFixed(0)}K`} color="#00ff88" />
        <StatBlock label="Active Narratives" value={data.active_narratives} color="#00d4ff" />
        <StatBlock label="Signals Detected" value={data.signals_detected} color="#fbbf24" />
        <StatBlock label="Open Opportunities" value={data.opportunities_open} color="#ff9500" />
        <StatBlock label="Narrative Velocity" value={`${data.narrative_velocity}x`} color="#a78bfa" />
        <div className="rounded-lg border border-white/8 bg-white/3 p-4">
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-1">CONTENT PIPELINE</div>
          <div className="flex items-end gap-1.5">
            {[
              { label: "D", value: data.content_pipeline.drafts, color: "#64748b" },
              { label: "R", value: data.content_pipeline.in_review, color: "#fbbf24" },
              { label: "A", value: data.content_pipeline.approved, color: "#00d4ff" },
              { label: "S", value: data.content_pipeline.scheduled, color: "#00ff88" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1">
                <div className="text-sm font-bold font-mono" style={{ color: item.color }}>{item.value}</div>
                <div className="text-[9px] text-white/25 font-mono">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Signal Alerts */}
        <div className="rounded-lg border border-white/10 bg-white/3 p-4">
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3 flex items-center justify-between">
            SIGNAL ALERTS
            <span className="text-[#ff2d55] animate-pulse">● LIVE</span>
          </div>
          <div className="space-y-2">
            {data.signal_alerts.map((alert, i) => {
              const cfg = ALERT_CONFIG[alert.level as keyof typeof ALERT_CONFIG] ?? ALERT_CONFIG.info;
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg}`}>
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs text-white/70 leading-relaxed">{alert.message}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-1">
                      {new Date(alert.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Narrative */}
        <div className="rounded-lg border border-[#00ff88]/20 bg-[#00ff88]/5 p-4">
          <div className="text-[10px] text-[#00ff88] font-mono uppercase tracking-wider mb-2">TOP NARRATIVE</div>
          <div className="text-xl font-bold text-white/90 mb-3">{data.top_narrative}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-white/30 font-mono mb-1">7-DAY REACH</div>
              <div className="text-lg font-bold font-mono text-[#00ff88]">
                {(data.narrative_reach_7d / 1000).toFixed(0)}K
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/30 font-mono mb-1">VELOCITY</div>
              <div className="text-lg font-bold font-mono text-[#00d4ff]">{data.narrative_velocity}x</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-[10px] text-white/25 font-mono mb-1">PIPELINE</div>
            <div className="flex gap-3 text-xs">
              <span className="text-[#64748b]">{data.content_pipeline.drafts} drafts</span>
              <span className="text-[#fbbf24]">{data.content_pipeline.in_review} in review</span>
              <span className="text-[#00ff88]">{data.content_pipeline.scheduled} scheduled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Signal Intelligence Banner */}
      {(signalStats || actions) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {signalStats && (
            <div className="rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/5 p-4">
              <div className="text-[10px] text-[#fbbf24] font-mono uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="animate-pulse">●</span> LIVE SIGNAL INTELLIGENCE
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[10px] text-white/30 font-mono mb-1">TOTAL SIGNALS</div>
                  <div className="text-xl font-bold font-mono text-[#fbbf24]">{signalStats.total_signals}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/30 font-mono mb-1">AVG SCORE</div>
                  <div className="text-xl font-bold font-mono text-[#00ff88]">{signalStats.avg_opportunity_score.toFixed(0)}</div>
                </div>
              </div>
              <div className="text-[11px] text-white/50 leading-relaxed border-t border-white/8 pt-2">
                <span className="text-white/70 font-semibold">{signalStats.top_signal_title}</span>
                <span className="text-white/30"> · score {signalStats.top_signal_score}/100 · top category: </span>
                <span className="text-[#00d4ff]">{signalStats.top_category}</span>
              </div>
            </div>
          )}

          {actions && (
            <div className="rounded-lg border border-[#00ff88]/25 bg-[#00ff88]/5 p-4">
              <div className="text-[10px] text-[#00ff88] font-mono uppercase tracking-wider mb-3 flex items-center justify-between">
                PRIMARY RECOMMENDED ACTION
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                  style={{
                    color: URGENCY_COLORS[actions.primary_action.urgency_level] ?? "#00ff88",
                    backgroundColor: `${URGENCY_COLORS[actions.primary_action.urgency_level] ?? "#00ff88"}20`,
                  }}
                >
                  {actions.primary_action.urgency_level.toUpperCase()}
                </span>
              </div>
              <div className="text-sm font-semibold text-white/85 mb-2 leading-snug">
                {actions.primary_action.action}
              </div>
              <div className="flex gap-4 text-[10px] font-mono mb-3">
                <span><span className="text-white/25">PLATFORM </span><span className="text-white/60">{actions.primary_action.platform}</span></span>
                <span><span className="text-white/25">WINDOW </span><span className="text-[#ff9500]">{actions.primary_action.deadline_window}</span></span>
                <span><span className="text-white/25">FORMAT </span><span className="text-[#00d4ff]">{actions.primary_action.suggested_format}</span></span>
              </div>
              {actions.secondary_actions.length > 0 && (
                <div className="border-t border-white/8 pt-2 space-y-1.5">
                  <div className="text-[9px] text-white/20 font-mono uppercase tracking-wider">NEXT ACTIONS</div>
                  {actions.secondary_actions.slice(0, 2).map((a, i) => (
                    <div key={i} className="text-[11px] text-white/45 leading-snug">
                      → {a.action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Narrative Performance Table */}
      <div className="rounded-lg border border-white/10 bg-white/3 p-4">
        <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3">NARRATIVE PERFORMANCE MATRIX</div>
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 text-[10px] text-white/25 font-mono uppercase tracking-wider px-2">
            <div className="col-span-4">NARRATIVE</div>
            <div className="col-span-3">REACH</div>
            <div className="col-span-2 text-center">ENG%</div>
            <div className="col-span-2 text-center">POSTS</div>
            <div className="col-span-1 text-center">↑↓</div>
          </div>
          {data.narrative_performance.map((row, i) => {
            const mom = MOMENTUM_CONFIG[row.momentum] ?? MOMENTUM_CONFIG.stable;
            const reachPct = (row.reach / maxReach) * 100;
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded-lg bg-white/2 hover:bg-white/4 transition-colors">
                <div className="col-span-4 text-sm text-white/75 font-medium truncate">{row.narrative}</div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${reachPct}%`, backgroundColor: mom.color }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-white/50 tabular-nums w-12 shrink-0">
                      {row.reach >= 1000 ? `${(row.reach / 1000).toFixed(0)}K` : row.reach}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[12px] font-mono font-semibold" style={{ color: row.engagement >= 6 ? "#00ff88" : row.engagement >= 4 ? "#fbbf24" : "#ff9500" }}>
                    {row.engagement.toFixed(1)}%
                  </span>
                </div>
                <div className="col-span-2 text-center text-[12px] font-mono text-white/50">
                  {row.posts_count}
                </div>
                <div className="col-span-1 text-center">
                  <span className="text-sm font-bold" style={{ color: mom.color }}>{mom.icon}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
