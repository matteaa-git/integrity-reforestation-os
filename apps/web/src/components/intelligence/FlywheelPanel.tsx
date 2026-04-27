"use client";

import type { FlywheelMetrics, FlywheelStage } from "@/lib/api";

interface Props {
  data: FlywheelMetrics | null;
  loading: boolean;
}

function statusColor(status: FlywheelStage["status"]) {
  if (status === "healthy") return "text-[#39de8b] border-[#39de8b]/30 bg-[#39de8b]/10";
  if (status === "warning") return "text-amber-400 border-amber-400/30 bg-amber-400/10";
  return "text-red-400 border-red-400/30 bg-red-400/10";
}

function statusDot(status: FlywheelStage["status"]) {
  if (status === "healthy") return "bg-[#39de8b]";
  if (status === "warning") return "bg-amber-400";
  return "bg-red-400 animate-pulse";
}

export default function FlywheelPanel({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
        <div className="h-48 rounded-2xl bg-white/5" />
      </div>
    );
  }
  if (!data) return null;

  const pct = Math.round(data.pipeline_health);
  const circumference = 2 * Math.PI * 44;
  const dash = (pct / 100) * circumference;

  return (
    <div className="space-y-5">
      {/* ── Pipeline stages ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-[#12121f] overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-bold text-white">Growth Pipeline</h2>
            <p className="text-[10px] text-white/35 mt-0.5">Content → Reach → Followers → Revenue</p>
          </div>
          <div className="flex items-center gap-2">
            <svg width="48" height="48" className="-rotate-90">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#ffffff10" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke={pct >= 70 ? "#39de8b" : pct >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * (2 * Math.PI * 20)} ${2 * Math.PI * 20}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="text-right">
              <div className="text-[18px] font-bold text-white leading-none">{pct}%</div>
              <div className="text-[9px] text-white/30 mt-0.5">health</div>
            </div>
          </div>
        </div>

        {/* Stage arrows */}
        <div className="px-5 pb-5">
          <div className="flex items-stretch gap-0 overflow-x-auto">
            {data.stages.map((stage, idx) => (
              <div key={stage.key} className="flex items-center flex-1 min-w-0">
                <div className={`flex-1 rounded-xl border px-3 py-3 min-w-[80px] ${statusColor(stage.status)}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(stage.status)}`} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest opacity-70">{stage.label}</span>
                  </div>
                  <div className="text-[20px] font-bold leading-none">
                    {stage.value >= 1000 ? `${(stage.value / 1000).toFixed(1)}K` : stage.value}
                  </div>
                  <div className="text-[9px] opacity-60 mt-0.5">{stage.unit}</div>
                  {stage.delta && (
                    <div className="text-[8px] opacity-50 mt-1 truncate">{stage.delta}</div>
                  )}
                </div>
                {idx < data.stages.length - 1 && (
                  <div className="px-1 text-white/15 text-[10px] shrink-0">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottleneck alert */}
        {data.bottleneck && (
          <div className="mx-5 mb-5 rounded-xl bg-amber-400/8 border border-amber-400/20 px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-sm mt-0.5 shrink-0">⚠</span>
            <div>
              <div className="text-[11px] font-semibold text-amber-400">Bottleneck: {data.bottleneck}</div>
              <div className="text-[11px] text-white/50 mt-0.5">{data.bottleneck_tip}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Recommendation ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#39de8b]/15 bg-[#39de8b]/5 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#39de8b]/15 border border-[#39de8b]/25 flex items-center justify-center text-[#39de8b] text-sm shrink-0 mt-0.5">◎</div>
          <div>
            <div className="text-[10px] font-bold text-[#39de8b] uppercase tracking-widest mb-1">AI Recommendation</div>
            <p className="text-[12px] text-white/70 leading-relaxed">{data.ai_recommendation}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-[10px] font-semibold text-white/40">Next action →</div>
              <span className="text-[11px] font-semibold text-[#39de8b] bg-[#39de8b]/10 border border-[#39de8b]/20 px-3 py-1 rounded-full">
                {data.next_action}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Velocity metrics ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Content Velocity" value={`${data.content_velocity}/wk`} sub="pieces per week" />
        <MetricCard label="Avg Viral Score" value={`${data.avg_viral_score}`} sub="out of 100" accent={data.avg_viral_score >= 65} />
        <MetricCard label="Pipeline Health" value={`${pct}%`} sub="readiness score" accent={pct >= 60} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#12121f] px-4 py-3.5">
      <div className="text-[9px] font-semibold text-white/35 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-[22px] font-bold leading-none ${accent ? "text-[#39de8b]" : "text-white"}`}>{value}</div>
      <div className="text-[9px] text-white/30 mt-1">{sub}</div>
    </div>
  );
}
