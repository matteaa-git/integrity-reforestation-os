"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface MultiplyResult {
  linkedin_post: { title: string; body: string; word_count: number; cta: string };
  instagram_carousel: { slide_count: number; slides: string[]; caption: string; hashtags: string[] };
  substack_outline: { title: string; subtitle: string; sections: { section: string; description: string }[] };
  youtube_script: { title: string; format: string; hook: string; beats: { time: string; content: string }[]; cta: string };
  instagram_caption: { caption: string; hashtag_count: number; cta: string };
}

interface Props {
  postId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const PLATFORM_TABS = [
  { key: "linkedin",           label: "LinkedIn",    color: "#0a66c2", icon: "in" },
  { key: "instagram_carousel", label: "IG Carousel", color: "#e1306c", icon: "◫" },
  { key: "substack_outline",   label: "Substack",    color: "#ff6719", icon: "S"  },
  { key: "youtube_script",     label: "YouTube",     color: "#ff0000", icon: "▶" },
  { key: "instagram_caption",  label: "IG Caption",  color: "#833ab4", icon: "◈" },
];

export default function MultiplyPanel({ postId, onClose, onSaved }: Props) {
  const [result, setResult]     = useState<MultiplyResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState("linkedin");
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<Set<string>>(new Set());

  const generate = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/x/${postId}/multiply`, { method: "POST" });
      if (res.ok) setResult(await res.json());
    } finally { setLoading(false); }
  }, [postId]);

  // Auto-generate on open
  useState(() => { if (postId) generate(); });

  const handleSaveDraft = useCallback(async (platform: string, content: object) => {
    setSaving(platform);
    try {
      // Save as a narrative response queue item
      await fetch(`${API_BASE}/narrative-response/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: postId,
          topic_title: `Multiplied from X post`,
          platform: platform.replace("_outline", "").replace("_carousel", "").replace("_caption", "").replace("_script", ""),
          content_type: platform.includes("carousel") ? "carousel" : platform.includes("outline") ? "article_outline" : platform.includes("script") ? "video_script" : "post",
          content,
        }),
      });
      setSaved((s) => new Set([...s, platform]));
      onSaved();
    } finally { setSaving(null); }
  }, [postId, onSaved]);

  if (!postId) return null;

  return (
    <div
      className="fixed right-0 top-0 h-full w-[520px] z-30 flex flex-col border-l shadow-2xl"
      style={{ background: "#08080f", borderColor: "rgba(167,139,250,0.15)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div>
          <div className="text-sm font-bold text-white/90">⊕ MULTIPLY CONTENT</div>
          <div className="text-[10px] font-mono text-white/25 mt-0.5">
            Adapt this X post for 5 platforms
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all">✕</button>
      </div>

      {/* Platform tabs */}
      <div className="flex items-center gap-0 px-3 py-2 border-b overflow-x-auto" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {PLATFORM_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all relative ${
              tab === t.key ? "bg-white/8" : "text-white/30 hover:text-white/50 hover:bg-white/4"
            }`}
            style={tab === t.key ? { color: t.color } : undefined}
          >
            <span className="font-bold">{t.icon}</span>
            <span>{t.label}</span>
            {saved.has(t.key) && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] ml-0.5" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#a78bfa", borderRightColor: "#00d4ff" }} />
            <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">MULTIPLYING...</div>
          </div>
        )}

        {!loading && result && (
          <>
            {tab === "linkedin" && (
              <div className="space-y-3">
                <div className="text-[10px] font-mono text-white/25 uppercase">{result.linkedin_post.word_count} words</div>
                <div className="rounded-lg border border-white/8 bg-white/3 p-4">
                  <div className="text-xs font-semibold text-white/65 mb-2 pb-2 border-b border-white/8">{result.linkedin_post.title}</div>
                  <pre className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap font-sans">{result.linkedin_post.body}</pre>
                </div>
                <div className="text-[11px] text-[#00ff88]/60 font-mono">CTA: {result.linkedin_post.cta}</div>
              </div>
            )}

            {tab === "instagram_carousel" && (
              <div className="space-y-3">
                <div className="text-[10px] font-mono text-white/25 uppercase">{result.instagram_carousel.slide_count} slides</div>
                <div className="space-y-2">
                  {result.instagram_carousel.slides.map((slide, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-white/8 bg-white/3 p-3">
                      <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono shrink-0" style={{ background: "rgba(225,48,108,0.15)", color: "#e1306c", border: "1px solid rgba(225,48,108,0.3)" }}>{i + 1}</div>
                      <div className="text-xs text-white/65 leading-relaxed">{slide}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded bg-white/3 border border-white/8 p-3">
                  <div className="text-[9px] font-mono text-white/25 mb-1">CAPTION</div>
                  <div className="text-xs text-white/60 leading-relaxed">{result.instagram_carousel.caption}</div>
                </div>
              </div>
            )}

            {tab === "substack_outline" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#ff6719]/20 bg-[#ff6719]/5 p-4">
                  <div className="text-sm font-semibold text-white/85 mb-1">{result.substack_outline.title}</div>
                  <div className="text-xs text-white/40 italic">{result.substack_outline.subtitle}</div>
                </div>
                {result.substack_outline.sections.map((s, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border border-white/8 bg-white/2 p-3">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono shrink-0" style={{ background: "rgba(255,103,25,0.15)", color: "#ff6719" }}>{i + 1}</div>
                    <div><div className="text-[11px] font-semibold text-white/70 mb-0.5">{s.section}</div><div className="text-[10px] text-white/40">{s.description}</div></div>
                  </div>
                ))}
              </div>
            )}

            {tab === "youtube_script" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#ff0000]/20 bg-[#ff0000]/5 p-3">
                  <div className="text-sm font-semibold text-white/80">{result.youtube_script.title}</div>
                  <div className="text-[10px] font-mono text-[#ff0000]/60 mt-1">{result.youtube_script.format}</div>
                </div>
                <div className="rounded bg-white/3 border border-white/8 p-3">
                  <div className="text-[9px] font-mono text-white/25 mb-1">HOOK</div>
                  <div className="text-xs text-white/65">{result.youtube_script.hook}</div>
                </div>
                {result.youtube_script.beats.map((beat, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-[10px] font-mono text-[#ff0000]/50 shrink-0 w-16">{beat.time}</span>
                    <span className="text-xs text-white/60">{beat.content}</span>
                  </div>
                ))}
                <div className="text-[11px] font-mono text-[#ff0000]/60">CTA: {result.youtube_script.cta}</div>
              </div>
            )}

            {tab === "instagram_caption" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#833ab4]/20 bg-[#833ab4]/5 p-4">
                  <pre className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap font-sans">{result.instagram_caption.caption}</pre>
                </div>
                <div className="text-[11px] font-mono text-[#833ab4]/60">CTA: {result.instagram_caption.cta}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {result && !loading && (
        <div className="flex items-center gap-2 px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <button onClick={generate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono text-white/40 hover:border-white/20 transition-all">
            ⟳ REGENERATE
          </button>
          <button
            onClick={() => {
              const content = tab === "linkedin" ? result.linkedin_post
                : tab === "instagram_carousel" ? result.instagram_carousel
                : tab === "substack_outline" ? result.substack_outline
                : tab === "youtube_script" ? result.youtube_script
                : result.instagram_caption;
              handleSaveDraft(tab, content);
            }}
            disabled={saving === tab || saved.has(tab)}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all disabled:opacity-50"
            style={!saved.has(tab) ? { background: "linear-gradient(135deg,#a78bfa,#00d4ff)", color: "#000" } : { background: "rgba(0,255,136,0.1)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)" }}
          >
            {saved.has(tab) ? "✓ SAVED AS DRAFT" : saving === tab ? "SAVING..." : "→ SAVE AS DRAFT"}
          </button>
        </div>
      )}
    </div>
  );
}
