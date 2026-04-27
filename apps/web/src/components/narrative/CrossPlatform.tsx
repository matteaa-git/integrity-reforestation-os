"use client";

import { useState, useCallback } from "react";
import type { CrossPlatformPlan } from "@/lib/api";
import { multiplyNarrative } from "@/lib/api";

const PLATFORM_TABS = [
  { key: "twitter_thread",      label: "X Thread",    icon: "𝕏", color: "#00d4ff" },
  { key: "instagram_carousel",  label: "IG Carousel", icon: "⊞", color: "#f472b6" },
  { key: "instagram_reel",      label: "IG Reel",     icon: "▶", color: "#f472b6" },
  { key: "tiktok",              label: "TikTok",      icon: "♪", color: "#ff2d55" },
  { key: "youtube",             label: "YouTube",     icon: "▷", color: "#ff0000" },
  { key: "substack",            label: "Substack",    icon: "✉", color: "#ff9500" },
] as const;

type PlatformKey = typeof PLATFORM_TABS[number]["key"];

const NARRATIVE_EXAMPLES = [
  { title: "Marcos 10,000 Trees Milestone", message: "Lead planter Marcos Rodriguez has planted his 10,000th tree over 8 years of field work, rebuilding an entire ecosystem by hand." },
  { title: "Amazon Crisis Response", message: "Amazon deforestation hit a 15-year high. While others tweet, we plant — 847 trees today, every day." },
  { title: "Earth Day Is Every Day", message: "We don't plant trees for Earth Day. We plant 365 days a year because the planet can't afford to wait for a campaign." },
];

function PlatformContent({ plan, platform }: { plan: CrossPlatformPlan; platform: PlatformKey }) {
  const tab = PLATFORM_TABS.find((t) => t.key === platform)!;

  if (platform === "twitter_thread") {
    const data = plan.twitter_thread;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">EST. IMPRESSIONS</div>
          <div className="text-xl font-bold font-mono text-[#00d4ff]">{data.estimated_impressions}</div>
        </div>
        <div className="space-y-2">
          {data.posts.map((post, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/30 flex items-center justify-center text-[9px] font-mono text-[#00d4ff] shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 bg-white/3 border border-white/8 rounded-lg p-3 text-sm text-white/75 leading-relaxed">
                {post}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-3">
          <div className="text-[10px] text-[#00d4ff] font-mono uppercase mb-1">CTA</div>
          <div className="text-sm text-white/70">{data.cta}</div>
        </div>
      </div>
    );
  }

  if (platform === "instagram_carousel") {
    const data = plan.instagram_carousel;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-1">{data.slide_count} SLIDES</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.slides.map((slide, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg border border-white/8 bg-white/3 p-3 flex flex-col justify-between"
              style={{ background: `linear-gradient(135deg, ${["#f472b6", "#a78bfa", "#00d4ff", "#00ff88"][i % 4]}10, rgba(0,0,0,0.4))` }}
            >
              <div className="text-[9px] font-mono text-white/30">SLIDE {i + 1}</div>
              <div className="text-[11px] text-white/70 leading-tight">{slide}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">CAPTION</div>
          <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{data.caption}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.hashtags.map((tag) => (
            <span key={tag} className="text-[10px] font-mono text-[#f472b6]/60 bg-[#f472b6]/8 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (platform === "instagram_reel") {
    const data = plan.instagram_reel;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
            <div className="text-[10px] text-white/30 font-mono mb-1">DURATION</div>
            <div className="text-xl font-bold font-mono text-[#f472b6]">{data.recommended_duration}</div>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
            <div className="text-[10px] text-white/30 font-mono mb-1">SOUND</div>
            <div className="text-xs text-white/60">{data.sound_suggestion}</div>
          </div>
        </div>
        <div className="rounded-lg border border-[#f472b6]/20 bg-[#f472b6]/5 p-3">
          <div className="text-[10px] text-[#f472b6] font-mono mb-1">CONCEPT</div>
          <div className="text-sm text-white/70">{data.concept}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">HOOK</div>
          <div className="text-sm text-white/70 italic">&ldquo;{data.hook}&rdquo;</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">SCRIPT BEATS</div>
          <div className="space-y-1.5">
            {data.script_beats.map((beat, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                <span className="text-[#f472b6] shrink-0">→</span>
                {beat}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (platform === "tiktok") {
    const data = plan.tiktok;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[#ff2d55]/20 bg-[#ff2d55]/5 p-3">
          <div className="text-[10px] text-[#ff2d55] font-mono mb-1">CONCEPT</div>
          <div className="text-sm text-white/70">{data.concept}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
            <div className="text-[10px] text-white/30 font-mono mb-1">TREND ANGLE</div>
            <div className="text-xs text-white/60">{data.trend_angle}</div>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/3 p-3">
            <div className="text-[10px] text-white/30 font-mono mb-1">SOUND</div>
            <div className="text-xs text-white/60">{data.sound_suggestion}</div>
          </div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">HOOK</div>
          <div className="text-sm text-white/70 italic">&ldquo;{data.hook}&rdquo;</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">STRUCTURE</div>
          <div className="space-y-1.5">
            {data.structure.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                <span className="text-[#ff2d55] shrink-0">→</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (platform === "youtube") {
    const data = plan.youtube;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[#ff0000]/20 bg-[#ff0000]/5 p-3">
          <div className="text-[10px] text-[#ff0000]/80 font-mono mb-1">TITLE</div>
          <div className="text-sm font-semibold text-white/85">{data.title}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">THUMBNAIL CONCEPT</div>
          <div className="text-sm text-white/60 italic">{data.thumbnail_concept}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">CHAPTERS</div>
          <div className="space-y-1.5">
            {data.chapters.map((ch, i) => (
              <div key={i} className="text-xs text-white/60 font-mono">{ch}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (platform === "substack") {
    const data = plan.substack;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[#ff9500]/20 bg-[#ff9500]/5 p-3">
          <div className="text-[10px] text-[#ff9500] font-mono mb-1">TITLE</div>
          <div className="text-sm font-semibold text-white/85">{data.title}</div>
          <div className="text-xs text-white/40 mt-1 italic">{data.subtitle}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">INTRO</div>
          <div className="text-xs text-white/60 leading-relaxed">{data.intro}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-2">BODY OUTLINE</div>
          <div className="space-y-1.5">
            {data.body_outline.map((section, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                <span className="text-[#ff9500] shrink-0">{i + 1}.</span>
                {section}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <div className="text-[10px] text-white/30 font-mono mb-1">CONCLUSION</div>
          <div className="text-xs text-white/60 italic leading-relaxed">{data.conclusion}</div>
        </div>
        <div className="rounded-lg border border-[#ff9500]/20 bg-[#ff9500]/5 p-3">
          <div className="text-[10px] text-[#ff9500] font-mono mb-1">CTA</div>
          <div className="text-sm text-white/70">{data.cta}</div>
        </div>
      </div>
    );
  }

  return null;
}

export default function CrossPlatform() {
  const [plan, setPlan] = useState<CrossPlatformPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<PlatformKey>("twitter_thread");
  const [narrativeTitle, setNarrativeTitle] = useState("");
  const [coreMessage, setCoreMessage] = useState("");
  const [narrativeType, setNarrativeType] = useState("story");

  const handleMultiply = useCallback(async () => {
    if (!narrativeTitle.trim() || !coreMessage.trim()) return;
    setLoading(true);
    try {
      const result = await multiplyNarrative({
        narrative_title: narrativeTitle,
        core_message: coreMessage,
        narrative_type: narrativeType,
      });
      setPlan(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [narrativeTitle, coreMessage, narrativeType]);

  const loadExample = (ex: typeof NARRATIVE_EXAMPLES[0]) => {
    setNarrativeTitle(ex.title);
    setCoreMessage(ex.message);
  };

  return (
    <div className="space-y-4">
      {/* Input Panel */}
      {!plan && (
        <div className="rounded-xl border border-white/10 bg-white/3 p-5">
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-4">
            CROSS-PLATFORM MULTIPLICATION ENGINE
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/30 font-mono uppercase block mb-1.5">NARRATIVE TITLE</label>
                <input
                  value={narrativeTitle}
                  onChange={(e) => setNarrativeTitle(e.target.value)}
                  placeholder="e.g. Marcos 10,000 Trees Milestone"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00ff88]/50 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 font-mono uppercase block mb-1.5">CORE MESSAGE</label>
                <textarea
                  value={coreMessage}
                  onChange={(e) => setCoreMessage(e.target.value)}
                  placeholder="The central message or narrative in 1-3 sentences..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00ff88]/50 resize-none transition-all"
                />
              </div>
              <div className="flex gap-1.5">
                {["story", "authority", "crisis_response", "education"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setNarrativeType(t)}
                    className={`flex-1 py-1.5 rounded text-[10px] font-mono uppercase border transition-all ${
                      narrativeType === t
                        ? "border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10"
                        : "border-white/10 text-white/30"
                    }`}
                  >
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
              <button
                onClick={handleMultiply}
                disabled={loading || !narrativeTitle.trim() || !coreMessage.trim()}
                className="w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
                style={{
                  background:
                    loading || !narrativeTitle.trim() || !coreMessage.trim()
                      ? "rgba(255,255,255,0.05)"
                      : "linear-gradient(135deg, #00ff88, #00d4ff, #f472b6)",
                  color: loading || !narrativeTitle.trim() || !coreMessage.trim() ? "rgba(255,255,255,0.3)" : "#000",
                }}
              >
                {loading ? "MULTIPLYING NARRATIVE..." : "MULTIPLY ACROSS ALL PLATFORMS"}
              </button>
            </div>
            <div>
              <div className="text-[10px] text-white/30 font-mono uppercase mb-2">QUICK LOAD EXAMPLES</div>
              <div className="space-y-2">
                {NARRATIVE_EXAMPLES.map((ex) => (
                  <button
                    key={ex.title}
                    onClick={() => loadExample(ex)}
                    className="w-full text-left p-3 rounded-lg border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all"
                  >
                    <div className="text-[12px] font-medium text-white/75">{ex.title}</div>
                    <div className="text-[11px] text-white/35 mt-1 leading-relaxed line-clamp-2">{ex.message}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-lg border border-white/8 bg-white/2">
                <div className="text-[10px] text-white/30 font-mono uppercase mb-2">WHAT YOU GET</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PLATFORM_TABS.map((t) => (
                    <div key={t.key} className="flex items-center gap-1.5 text-[11px]">
                      <span style={{ color: t.color }}>{t.icon}</span>
                      <span className="text-white/50">{t.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-white/8 text-[10px] font-mono text-[#00ff88]">
                  21 content pieces · 1 narrative · Est. 350K–1.2M reach
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {plan && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white/90">{plan.narrative_title}</h2>
              <div className="text-sm text-white/40 mt-0.5">
                {plan.total_content_pieces} content pieces · Est. reach: {plan.estimated_total_reach}
              </div>
            </div>
            <button
              onClick={() => setPlan(null)}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/40 hover:border-white/20 hover:text-white/60 transition-all"
            >
              ← NEW NARRATIVE
            </button>
          </div>

          {/* Platform Tabs */}
          <div className="flex gap-1 flex-wrap">
            {PLATFORM_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                  activeTab === t.key
                    ? "border-opacity-50 text-white bg-white/8"
                    : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                }`}
                style={activeTab === t.key ? { borderColor: `${t.color}50`, color: t.color } : undefined}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Platform Content */}
          <PlatformContent plan={plan} platform={activeTab} />
        </div>
      )}
    </div>
  );
}
