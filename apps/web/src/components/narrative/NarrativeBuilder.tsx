"use client";

import { useState, useCallback } from "react";
import type { NarrativeArc, ArcListResponse } from "@/lib/api";
import { generateNarrativeArc } from "@/lib/api";

interface Props {
  data: ArcListResponse;
}

const FORMAT_COLORS: Record<string, string> = {
  reel: "#f472b6",
  carousel: "#00d4ff",
  story: "#a78bfa",
  post: "#fbbf24",
};

const NARRATIVE_TYPES = [
  { value: "story", label: "Story Arc", icon: "◎" },
  { value: "authority", label: "Authority", icon: "△" },
  { value: "education", label: "Education", icon: "◻" },
  { value: "crisis_response", label: "Crisis Response", icon: "⚡" },
  { value: "movement", label: "Movement", icon: "⬡" },
];

function BeatCard({ beat, index }: { beat: NarrativeArc["beats"][0]; index: number }) {
  const fmtColor = FORMAT_COLORS[beat.content_format] ?? "#00ff88";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0"
          style={{ backgroundColor: `${fmtColor}20`, color: fmtColor, border: `1px solid ${fmtColor}40` }}
        >
          {index + 1}
        </div>
        {index < 10 && <div className="w-px flex-1 bg-white/8 mt-1 mb-1 min-h-4" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: fmtColor, backgroundColor: `${fmtColor}15` }}
            >
              {beat.content_format}
            </span>
            {beat.asset_category && (
              <span className="text-[10px] font-mono text-white/30 uppercase">
                Asset: {beat.asset_category}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-white/85 mb-1">{beat.title}</div>
          <div className="text-xs text-white/50 leading-relaxed mb-2.5">{beat.description}</div>
          <div className="p-2.5 rounded bg-[#fbbf24]/5 border border-[#fbbf24]/20">
            <div className="text-[9px] text-[#fbbf24]/70 font-mono uppercase tracking-wider mb-1">HOOK SUGGESTION</div>
            <div className="text-xs text-white/70 italic">&ldquo;{beat.hook_suggestion}&rdquo;</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NarrativeBuilder({ data }: Props) {
  const [arcs, setArcs] = useState<NarrativeArc[]>(data.arcs);
  const [selected, setSelected] = useState<NarrativeArc | null>(data.arcs[0] ?? null);
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [narrativeType, setNarrativeType] = useState("story");
  const [arcLength, setArcLength] = useState(5);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const arc = await generateNarrativeArc({ topic, narrative_type: narrativeType, arc_length: arcLength });
      setArcs((prev) => [arc, ...prev]);
      setSelected(arc);
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  }, [topic, narrativeType, arcLength]);

  return (
    <div className="flex gap-4 h-full">
      {/* Arc List + Generator */}
      <div className="w-72 shrink-0 space-y-3 overflow-y-auto pr-1">
        {/* Generator */}
        <div className="rounded-lg border border-[#00ff88]/25 bg-[#00ff88]/5 p-4 space-y-3">
          <div className="text-[10px] text-[#00ff88] font-mono uppercase tracking-wider">GENERATE ARC</div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic or narrative trigger..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00ff88]/50 focus:bg-white/8 transition-all"
          />
          <div className="flex gap-2 flex-wrap">
            {NARRATIVE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setNarrativeType(t.value)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                  narrativeType === t.value
                    ? "border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10"
                    : "border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-mono">BEATS:</span>
            {[3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setArcLength(n)}
                className={`w-7 h-7 rounded text-xs font-mono border transition-all ${
                  arcLength === n ? "border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10" : "border-white/10 text-white/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: generating || !topic.trim() ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #00ff88, #00d4ff)",
              color: generating || !topic.trim() ? "rgba(255,255,255,0.3)" : "#000",
            }}
          >
            {generating ? "GENERATING..." : "GENERATE ARC"}
          </button>
        </div>

        {/* Arc List */}
        <div className="space-y-1.5">
          {arcs.map((arc) => (
            <button
              key={arc.id}
              onClick={() => setSelected(arc)}
              className={`w-full text-left rounded-lg border p-3 transition-all ${
                selected?.id === arc.id
                  ? "border-white/20 bg-white/5"
                  : "border-white/8 bg-white/2 hover:bg-white/4"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-[#00d4ff]/60 bg-[#00d4ff]/8 px-1.5 py-0.5 rounded uppercase">
                  {arc.narrative_type}
                </span>
                <span className="text-[10px] text-white/25 font-mono">{arc.arc_length} beats</span>
              </div>
              <div className="text-[13px] text-white/80 font-medium leading-tight">{arc.title}</div>
              <div className="text-[11px] text-white/30 mt-1">{arc.estimated_duration}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Arc Detail */}
      {selected ? (
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
          {/* Arc Header */}
          <div className="rounded-lg border border-white/10 bg-white/3 p-5">
            <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-2">
              {selected.narrative_type.replace("_", " ")} · {selected.arc_length} beats · {selected.estimated_duration}
            </div>
            <h2 className="text-xl font-bold text-white/90 mb-3">{selected.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-lg bg-white/3 border border-white/8">
                <div className="text-[10px] text-[#ff9500] font-mono uppercase tracking-wider mb-1">PROTAGONIST</div>
                <div className="text-sm text-white/70">{selected.protagonist}</div>
              </div>
              <div className="p-3 rounded-lg bg-white/3 border border-white/8">
                <div className="text-[10px] text-[#a78bfa] font-mono uppercase tracking-wider mb-1">EMOTIONAL ARC</div>
                <div className="text-sm text-white/70 font-mono">{selected.emotional_arc}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[#ff2d55]/5 border border-[#ff2d55]/20">
                <div className="text-[10px] text-[#ff2d55] font-mono uppercase tracking-wider mb-1">TENSION</div>
                <div className="text-xs text-white/60 leading-relaxed">{selected.tension}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#00ff88]/5 border border-[#00ff88]/20">
                <div className="text-[10px] text-[#00ff88] font-mono uppercase tracking-wider mb-1">RESOLUTION</div>
                <div className="text-xs text-white/60 leading-relaxed">{selected.resolution}</div>
              </div>
            </div>
          </div>

          {/* Beats */}
          <div className="rounded-lg border border-white/10 bg-white/3 p-5">
            <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-4">CONTENT BEATS</div>
            <div>
              {selected.beats.map((beat, i) => (
                <BeatCard key={beat.beat_number} beat={beat} index={i} />
              ))}
            </div>
          </div>

          {/* Key Messages + CTA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/10 bg-white/3 p-4">
              <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3">KEY MESSAGES</div>
              <ul className="space-y-2">
                {selected.key_messages.map((msg, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-[#00ff88] mt-0.5">→</span>
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[#fbbf24]/25 bg-[#fbbf24]/5 p-4">
              <div className="text-[10px] text-[#fbbf24] font-mono uppercase tracking-wider mb-2">CALL TO ACTION</div>
              <p className="text-sm text-white/75 leading-relaxed">{selected.cta}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/20 text-sm font-mono text-center">
            <div className="text-3xl mb-2">◧</div>
            SELECT OR GENERATE AN ARC
          </div>
        </div>
      )}
    </div>
  );
}
