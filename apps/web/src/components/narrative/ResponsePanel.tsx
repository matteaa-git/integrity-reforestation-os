"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types (inline — no import needed, matches backend shape)
// ---------------------------------------------------------------------------

interface XTweetItem {
  position: number;
  text: string;
  char_count: number;
  engagement_hook: string | null;
  media_suggestion: string | null;
}

interface LinkedInPost {
  title: string;
  body: string;
  word_count: number;
  suggested_image: string | null;
  suggested_cta: string | null;
}

interface SubstackSection {
  section: string;
  description: string;
}

interface SubstackOutline {
  title: string;
  subtitle: string;
  intro: string;
  sections: SubstackSection[];
  suggested_length: string;
  suggested_cta: string;
  tags: string[];
}

interface GeneratedResponse {
  response_id: string;
  topic_id: string;
  topic_title: string;
  x_thread: XTweetItem[];
  linkedin_post: LinkedInPost;
  substack_outline: SubstackOutline;
  generated_at: string;
  ai_enhanced: boolean;
}

interface NarrativeTopic {
  topic_id: string;
  title: string;
  summary: string;
  signal_count: number;
  sources: string[];
  keywords: string[];
  opportunity_score: number;
  conversation_velocity: number;
  controversy_score: number;
  engagement_potential: number;
  relevance_score: number;
  trend_direction: string;
  status: string;
  category: string;
  lifespan_estimate: string;
}

interface Props {
  topic: NarrativeTopic | null;
  apiBase: string;
  onClose: () => void;
  onSendToQueue: (topicId: string, platform: string, contentType: string, content: object) => void;
}

// ---------------------------------------------------------------------------
// Platform tab config
// ---------------------------------------------------------------------------

const PLATFORM_TABS = [
  { key: "x",         label: "X Thread",      icon: "𝕏",  color: "#e2e8f0" },
  { key: "linkedin",  label: "LinkedIn",       icon: "in", color: "#0a66c2" },
  { key: "substack",  label: "Substack",       icon: "S",  color: "#ff6719" },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  respond_now:      { label: "RESPOND NOW",     color: "#ff2d55" },
  good_opportunity: { label: "GOOD OPPORTUNITY",color: "#ff9500" },
  monitor:          { label: "MONITOR",         color: "#fbbf24" },
  low_priority:     { label: "LOW PRIORITY",    color: "#64748b" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResponsePanel({ topic, apiBase, onClose, onSendToQueue }: Props) {
  const [platform, setPlatform] = useState<"x" | "linkedin" | "substack">("x");
  const [response, setResponse] = useState<GeneratedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentPlatforms, setSentPlatforms] = useState<Set<string>>(new Set());

  const loadResponse = useCallback(async (topicId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/narrative-response/topics/${topicId}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setResponse(data);
    } catch (e) {
      setError("Failed to generate response. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const handleRegenerate = useCallback(async () => {
    if (!topic) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/narrative-response/topics/${topic.topic_id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setResponse(await res.json());
    } catch {
      setError("Regeneration failed.");
    } finally {
      setLoading(false);
    }
  }, [topic, apiBase]);

  useEffect(() => {
    if (topic) {
      setResponse(null);
      setSentPlatforms(new Set());
      loadResponse(topic.topic_id);
    }
  }, [topic?.topic_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendToQueue = useCallback((plt: string) => {
    if (!response || !topic) return;
    let contentType = "thread";
    let content: object = {};
    if (plt === "x") { contentType = "thread"; content = { tweets: response.x_thread }; }
    else if (plt === "linkedin") { contentType = "post"; content = response.linkedin_post; }
    else if (plt === "substack") { contentType = "article_outline"; content = response.substack_outline; }
    onSendToQueue(topic.topic_id, plt, contentType, content);
    setSentPlatforms((prev) => new Set([...prev, plt]));
  }, [response, topic, onSendToQueue]);

  if (!topic) return null;

  const st = STATUS_LABEL[topic.status] ?? STATUS_LABEL.monitor;

  return (
    <div
      className="fixed right-0 top-0 h-full w-[480px] z-30 flex flex-col border-l shadow-2xl"
      style={{ background: "#08080f", borderColor: "rgba(0,255,136,0.12)" }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-5 py-4 border-b shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded"
              style={{ color: st.color, backgroundColor: `${st.color}20` }}
            >
              {st.label}
            </span>
            <span className="text-[10px] font-mono text-white/25">{topic.signal_count} signals</span>
            {topic.trend_direction === "rising" && (
              <span className="text-[10px] font-mono text-[#00ff88]">↑ RISING</span>
            )}
          </div>
          <h2 className="text-sm font-bold text-white/90 leading-snug">{topic.title}</h2>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {topic.sources.slice(0, 4).map((s) => (
              <span key={s} className="text-[9px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Platform Tabs */}
      <div
        className="flex items-center gap-0 px-4 py-2 border-b shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        {PLATFORM_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPlatform(tab.key as "x" | "linkedin" | "substack")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wider transition-all ${
              platform === tab.key
                ? "bg-white/8 text-white"
                : "text-white/30 hover:text-white/50 hover:bg-white/4"
            }`}
            style={platform === tab.key ? { color: tab.color } : undefined}
          >
            <span className="text-[12px] font-bold">{tab.icon}</span>
            <span>{tab.label}</span>
            {sentPlatforms.has(tab.key) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] ml-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: "#00ff88", borderRightColor: "#00d4ff" }}
            />
            <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">
              GENERATING RESPONSE...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="text-white/20 text-3xl">⚠</div>
            <div className="text-[12px] text-white/40 font-mono text-center">{error}</div>
            <button
              onClick={() => topic && loadResponse(topic.topic_id)}
              className="px-4 py-1.5 rounded-lg border border-white/15 text-[11px] font-mono text-white/50 hover:border-white/25 transition-all"
            >
              RETRY
            </button>
          </div>
        )}

        {!loading && !error && response && (
          <>
            {/* X Thread */}
            {platform === "x" && (
              <div className="space-y-3">
                <div className="text-[10px] text-white/25 font-mono uppercase tracking-wider flex items-center gap-2">
                  {response.x_thread.length} TWEETS
                  {response.ai_enhanced && (
                    <span className="text-[#a78bfa] bg-[#a78bfa]/10 px-1.5 py-0.5 rounded">AI ENHANCED</span>
                  )}
                </div>
                {response.x_thread.map((tweet) => (
                  <div
                    key={tweet.position}
                    className="rounded-lg border border-white/8 bg-white/3 p-3.5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-white/25">#{tweet.position}</span>
                      <div className="flex items-center gap-2">
                        {tweet.engagement_hook && (
                          <span className="text-[9px] font-mono text-[#a78bfa]/70 bg-[#a78bfa]/10 px-1.5 py-0.5 rounded uppercase">
                            {tweet.engagement_hook.replace(/_/g, " ")}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-mono tabular-nums"
                          style={{ color: tweet.char_count > 260 ? "#ff2d55" : tweet.char_count > 220 ? "#ff9500" : "#00ff88" }}
                        >
                          {tweet.char_count}/280
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{tweet.text}</p>
                    {tweet.media_suggestion && (
                      <div className="mt-2 text-[10px] text-[#00d4ff]/60 font-mono">
                        📎 {tweet.media_suggestion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* LinkedIn */}
            {platform === "linkedin" && (
              <div className="space-y-3">
                <div className="text-[10px] text-white/25 font-mono uppercase tracking-wider">
                  {response.linkedin_post.word_count} WORDS
                </div>
                <div className="rounded-lg border border-white/8 bg-white/3 p-4">
                  <div className="text-xs font-semibold text-white/70 mb-3 pb-2 border-b border-white/8">
                    {response.linkedin_post.title}
                  </div>
                  <pre className="text-xs text-white/65 leading-relaxed whitespace-pre-wrap font-sans">
                    {response.linkedin_post.body}
                  </pre>
                </div>
                {response.linkedin_post.suggested_image && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-white/30">
                    <span>📸</span>
                    <span>{response.linkedin_post.suggested_image}</span>
                  </div>
                )}
                {response.linkedin_post.suggested_cta && (
                  <div className="p-2.5 rounded bg-[#00ff88]/5 border border-[#00ff88]/20 text-[11px] text-[#00ff88]/80">
                    CTA: {response.linkedin_post.suggested_cta}
                  </div>
                )}
              </div>
            )}

            {/* Substack */}
            {platform === "substack" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#ff6719]/20 bg-[#ff6719]/5 p-4 space-y-2">
                  <div className="text-sm font-semibold text-white/85">{response.substack_outline.title}</div>
                  <div className="text-xs text-white/45 italic">{response.substack_outline.subtitle}</div>
                  <div className="text-[11px] text-white/55 leading-relaxed pt-1 border-t border-white/8">
                    {response.substack_outline.intro}
                  </div>
                </div>
                <div className="space-y-2">
                  {response.substack_outline.sections.map((sec, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-white/8 bg-white/2 p-3">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono shrink-0"
                        style={{ background: "rgba(255,103,25,0.15)", color: "#ff6719", border: "1px solid rgba(255,103,25,0.3)" }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-white/75 mb-0.5">{sec.section}</div>
                        <div className="text-[10px] text-white/40 leading-relaxed">{sec.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-white/30">
                  <span>📏 {response.substack_outline.suggested_length}</span>
                  <span className="text-white/15">·</span>
                  <span>🏷 {response.substack_outline.tags.join(", ")}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      {response && !loading && (
        <div
          className="flex items-center gap-2 px-5 py-3 border-t shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono text-white/40 hover:border-white/20 hover:text-white/60 transition-all"
          >
            ⟳ REGENERATE
          </button>
          <button
            onClick={() => handleSendToQueue(platform)}
            disabled={sentPlatforms.has(platform)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all disabled:opacity-50 ${
              sentPlatforms.has(platform)
                ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30"
                : ""
            }`}
            style={
              !sentPlatforms.has(platform)
                ? { background: "linear-gradient(135deg,#00ff88,#00d4ff)", color: "#000" }
                : undefined
            }
          >
            {sentPlatforms.has(platform) ? "✓ IN QUEUE" : "→ SEND TO QUEUE"}
          </button>
        </div>
      )}
    </div>
  );
}
