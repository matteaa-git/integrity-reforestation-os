"use client";

import { useState, useCallback } from "react";
import type { NarrativeThread, ThreadListResponse } from "@/lib/api";
import { buildNarrativeThread } from "@/lib/api";

interface Props {
  data: ThreadListResponse;
}

const PLATFORM_CONFIG = {
  twitter:  { label: "X / Twitter", color: "#00d4ff", limit: 280 },
  linkedin: { label: "LinkedIn", color: "#0a66c2", limit: 3000 },
  threads:  { label: "Threads", color: "#a78bfa", limit: 500 },
};

function TweetCard({ tweet, index }: { tweet: NarrativeThread["tweets"][0]; index: number }) {
  const pct = (tweet.char_count / 280) * 100;
  const barColor = pct > 90 ? "#ff2d55" : pct > 70 ? "#ff9500" : "#00ff88";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/40 shrink-0">
          {index + 1}
        </div>
        {index < 20 && <div className="w-px flex-1 bg-white/8 mt-1 mb-1 min-h-4" />}
      </div>
      <div className="flex-1 pb-3">
        <div className="rounded-lg border border-white/8 bg-white/3 p-3">
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{tweet.text}</p>
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/5">
            <div className="flex items-center gap-3">
              {tweet.engagement_hook && (
                <span className="text-[10px] text-[#00d4ff]/60 font-mono">{tweet.engagement_hook}</span>
              )}
              {tweet.media_suggestion && (
                <span className="text-[10px] text-[#a78bfa]/60 font-mono">📷 {tweet.media_suggestion}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
              </div>
              <span className="text-[10px] font-mono" style={{ color: barColor }}>{tweet.char_count}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThreadStudio({ data }: Props) {
  const [threads, setThreads] = useState<NarrativeThread[]>(data.threads);
  const [selected, setSelected] = useState<NarrativeThread | null>(data.threads[0] ?? null);
  const [building, setBuilding] = useState(false);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<"twitter" | "linkedin" | "threads">("twitter");
  const [threadLength, setThreadLength] = useState(7);

  const handleBuild = useCallback(async () => {
    if (!topic.trim()) return;
    setBuilding(true);
    try {
      const thread = await buildNarrativeThread({ topic, platform, thread_length: threadLength });
      setThreads((prev) => [thread, ...prev]);
      setSelected(thread);
    } catch {
      // ignore
    } finally {
      setBuilding(false);
    }
  }, [topic, platform, threadLength]);

  return (
    <div className="flex gap-4 h-full">
      {/* Thread List */}
      <div className="w-72 shrink-0 space-y-3 overflow-y-auto pr-1">
        {/* Builder */}
        <div className="rounded-lg border border-[#00d4ff]/25 bg-[#00d4ff]/5 p-4 space-y-3">
          <div className="text-[10px] text-[#00d4ff] font-mono uppercase tracking-wider">BUILD THREAD</div>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Thread topic or narrative..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00d4ff]/50 transition-all"
          />
          <div className="flex gap-1.5">
            {(Object.keys(PLATFORM_CONFIG) as Array<keyof typeof PLATFORM_CONFIG>).map((p) => {
              const cfg = PLATFORM_CONFIG[p];
              return (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-mono uppercase border transition-all ${
                    platform === p
                      ? "bg-[#00d4ff]/10 border-[#00d4ff]/40 text-[#00d4ff]"
                      : "border-white/10 text-white/30 hover:border-white/20"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 font-mono">LENGTH:</span>
            {[3, 5, 7, 10].map((n) => (
              <button
                key={n}
                onClick={() => setThreadLength(n)}
                className={`w-8 h-7 rounded text-xs font-mono border transition-all ${
                  threadLength === n
                    ? "border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10"
                    : "border-white/10 text-white/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={handleBuild}
            disabled={building || !topic.trim()}
            className="w-full py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              background: building || !topic.trim() ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #00d4ff, #a78bfa)",
              color: building || !topic.trim() ? "rgba(255,255,255,0.3)" : "#000",
            }}
          >
            {building ? "BUILDING..." : "BUILD THREAD"}
          </button>
        </div>

        <div className="space-y-1.5">
          {threads.map((thread) => {
            const cfg = PLATFORM_CONFIG[thread.platform as keyof typeof PLATFORM_CONFIG];
            return (
              <button
                key={thread.id}
                onClick={() => setSelected(thread)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  selected?.id === thread.id
                    ? "border-white/20 bg-white/5"
                    : "border-white/8 bg-white/2 hover:bg-white/4"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                    style={{ color: cfg?.color ?? "#fff", backgroundColor: `${cfg?.color ?? "#fff"}15` }}
                  >
                    {thread.platform}
                  </span>
                  <span className="text-[10px] text-white/30 font-mono">{thread.thread_length} tweets</span>
                  <span className="text-[10px] text-[#00ff88] font-mono ml-auto">{thread.hook_score}</span>
                </div>
                <div className="text-[13px] text-white/80 font-medium leading-tight">{thread.title}</div>
                <div className="text-[11px] text-white/30 mt-1 truncate">{thread.hook_tweet.slice(0, 60)}...</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread Preview */}
      {selected ? (
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="rounded-lg border border-white/10 bg-white/3 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = PLATFORM_CONFIG[selected.platform as keyof typeof PLATFORM_CONFIG];
                  return (
                    <span
                      className="text-[11px] font-mono uppercase px-2 py-0.5 rounded"
                      style={{ color: cfg?.color, backgroundColor: `${cfg?.color}15` }}
                    >
                      {cfg?.label ?? selected.platform}
                    </span>
                  );
                })()}
                <span className="text-[11px] text-white/30 font-mono">{selected.thread_length} posts</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-white/30 font-mono">HOOK SCORE</div>
                  <div className="text-lg font-bold font-mono text-[#00ff88]">{selected.hook_score}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/30 font-mono">EST. IMPRESSIONS</div>
                  <div className="text-sm font-semibold text-white/70">{selected.estimated_impressions}</div>
                </div>
              </div>
            </div>
            <h2 className="text-base font-semibold text-white/85">{selected.title}</h2>
          </div>

          {/* Tweets */}
          <div className="space-y-0">
            {selected.tweets.map((tweet, i) => (
              <TweetCard key={tweet.position} tweet={tweet} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/20 text-sm font-mono text-center">
            <div className="text-3xl mb-2">≡</div>
            SELECT OR BUILD A THREAD
          </div>
        </div>
      )}
    </div>
  );
}
