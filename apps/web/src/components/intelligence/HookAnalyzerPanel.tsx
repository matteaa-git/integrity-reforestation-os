"use client";

import { useState, useRef } from "react";
import type { HookAnalysis } from "@/lib/api";
import { analyzeHook } from "@/lib/api";

const FORMAT_OPTIONS = [
  { value: "universal", label: "Any format" },
  { value: "reel", label: "Reel" },
  { value: "carousel", label: "Carousel" },
  { value: "story", label: "Story" },
];

const CATEGORY_COLORS: Record<string, string> = {
  curiosity: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  contrarian: "text-red-400 bg-red-500/10 border-red-500/20",
  authority: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  transformation: "text-[#39de8b] bg-[#39de8b]/10 border-[#39de8b]/20",
  shock: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  story: "text-pink-400 bg-pink-500/10 border-pink-500/20",
};

function ScoreRing({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" className="-rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#ffffff08" strokeWidth="5" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[14px] font-bold text-white">{Math.round(value)}</span>
        </div>
      </div>
      <div className="text-[9px] text-white/35 text-center">{label}</div>
    </div>
  );
}

export default function HookAnalyzerPanel() {
  const [hookText, setHookText] = useState("");
  const [format, setFormat] = useState("universal");
  const [analysis, setAnalysis] = useState<HookAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = async () => {
    const trimmed = hookText.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeHook(trimmed, format);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const applyHook = (text: string) => {
    setHookText(text);
    setAnalysis(null);
    textareaRef.current?.focus();
  };

  const scoreColor = analysis
    ? analysis.overall_score >= 75 ? "#39de8b" : analysis.overall_score >= 55 ? "#f59e0b" : "#ef4444"
    : "#ffffff30";

  return (
    <div className="space-y-5">
      {/* Input panel */}
      <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-bold text-white">AI Hook Analyzer</h3>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="text-[10px] bg-white/5 border border-white/10 text-white/60 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white/20"
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <textarea
          ref={textareaRef}
          value={hookText}
          onChange={(e) => setHookText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAnalyze(); }}
          placeholder="Paste your hook or opening line here...&#10;&#10;e.g. 'Three years ago this land was barren. Look at it now.'"
          rows={4}
          className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors"
        />

        <div className="flex items-center justify-between mt-3">
          <div className="text-[10px] text-white/25">
            {hookText.trim().split(/\s+/).filter(Boolean).length} words
            {hookText.trim() && (
              <span className={` ml-2 ${
                hookText.trim().split(/\s+/).filter(Boolean).length >= 6 &&
                hookText.trim().split(/\s+/).filter(Boolean).length <= 15
                  ? "text-[#39de8b]" : "text-amber-400"
              }`}>
                {hookText.trim().split(/\s+/).filter(Boolean).length >= 6 &&
                 hookText.trim().split(/\s+/).filter(Boolean).length <= 15
                  ? "✓ optimal length" : "aim for 6-15 words"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hookText.trim() && (
              <button onClick={() => { setHookText(""); setAnalysis(null); }} className="text-[10px] text-white/30 hover:text-white/60">
                Clear
              </button>
            )}
            <button
              onClick={handleAnalyze}
              disabled={!hookText.trim() || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#39de8b]/15 hover:bg-[#39de8b]/25 disabled:opacity-40 text-[#39de8b] text-[11px] font-bold border border-[#39de8b]/20 transition-colors"
            >
              {loading ? (
                <><span className="w-3 h-3 border-2 border-[#39de8b]/40 border-t-[#39de8b] rounded-full animate-spin" /> Analyzing...</>
              ) : "⚗ Analyze Hook"}
            </button>
          </div>
        </div>

        {error && <div className="mt-3 text-[11px] text-red-400">{error}</div>}
        <p className="text-[9px] text-white/20 mt-2">Tip: ⌘+Enter to analyze</p>
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Score overview */}
          <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
            <div className="flex items-start gap-5">
              {/* Main score */}
              <div className="shrink-0 flex flex-col items-center gap-1">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" className="-rotate-90">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="#ffffff08" strokeWidth="7" />
                    <circle
                      cx="48" cy="48" r="40" fill="none"
                      stroke={scoreColor}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${(analysis.overall_score / 100) * (2 * Math.PI * 40)} ${2 * Math.PI * 40}`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[28px] font-bold text-white leading-none">{Math.round(analysis.overall_score)}</span>
                    <span className="text-[9px] text-white/30">/ 100</span>
                  </div>
                </div>
                <div className="text-[10px] font-semibold" style={{ color: scoreColor }}>
                  {analysis.overall_score >= 75 ? "Strong" : analysis.overall_score >= 55 ? "Average" : "Weak"}
                </div>
              </div>

              {/* Component scores */}
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { label: "Curiosity", value: analysis.curiosity_score, color: "#a78bfa" },
                    { label: "Clarity", value: analysis.clarity_score, color: "#60a5fa" },
                    { label: "Urgency", value: analysis.urgency_score, color: "#f59e0b" },
                    { label: "Emotion", value: analysis.emotional_pull, color: "#f472b6" },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-white/40">{m.label}</span>
                        <span className="text-[11px] font-semibold" style={{ color: m.color }}>{Math.round(m.value)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${m.value}%`, backgroundColor: m.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${analysis.optimal_length ? "text-[#39de8b] bg-[#39de8b]/10 border-[#39de8b]/20" : "text-amber-400 bg-amber-400/10 border-amber-400/20"}`}>
                    {analysis.word_count} words — {analysis.optimal_length ? "optimal" : "not optimal"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#39de8b]/15 bg-[#39de8b]/5 p-4">
              <div className="text-[10px] font-bold text-[#39de8b] uppercase tracking-widest mb-3">✓ Strengths</div>
              {analysis.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-[11px] text-white/60 leading-relaxed flex items-start gap-2">
                      <span className="text-[#39de8b] shrink-0 mt-0.5">·</span>{s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-white/30">No notable strengths detected</p>
              )}
            </div>
            <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-4">
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">✕ Weaknesses</div>
              {analysis.weaknesses.length > 0 ? (
                <ul className="space-y-2">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-[11px] text-white/60 leading-relaxed flex items-start gap-2">
                      <span className="text-red-400 shrink-0 mt-0.5">·</span>{w}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-white/30">No major weaknesses found</p>
              )}
            </div>
          </div>

          {/* Alternative suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-[#12121f] p-5">
              <div className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-4">Stronger Alternatives</div>
              <div className="space-y-2.5">
                {analysis.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[s.category] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                          {s.category}
                        </span>
                        <span className="text-[9px] text-[#39de8b] font-semibold">
                          +{s.estimated_score_delta.toFixed(0)} pts
                        </span>
                      </div>
                      <p className="text-[12px] text-white/70">{s.text}</p>
                    </div>
                    <button
                      onClick={() => applyHook(s.text)}
                      className="shrink-0 text-[10px] text-white/30 hover:text-[#39de8b] border border-white/10 hover:border-[#39de8b]/30 px-2.5 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Use this
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
