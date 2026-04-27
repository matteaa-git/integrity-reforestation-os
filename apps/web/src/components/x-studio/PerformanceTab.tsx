"use client";

interface XAnalytics {
  total_posts: number;
  total_impressions: number;
  total_engagements: number;
  total_reposts: number;
  total_replies: number;
  avg_hook_score: number;
  top_post_id: string | null;
  top_post_preview: string | null;
  top_post_impressions: number;
  followers_gained: number;
}

interface XPost {
  id: string;
  content: string;
  post_type: string;
  status: string;
  hook_score: number;
  estimated_reach: number;
  published_time: string | null;
  updated_at: string;
}

interface Props {
  analytics: XAnalytics;
  posts: XPost[];
}

function StatCard({ label, value, unit, color, sub }: { label: string; value: string | number; unit?: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 p-4">
      <div className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: color ?? "#fff" }}>
        {value}
        {unit && <span className="text-sm font-normal text-white/30 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] font-mono text-white/25 mt-0.5">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-[11px] font-mono text-white/50 truncate shrink-0">{label}</div>
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-12 text-[11px] font-mono text-white/40 text-right tabular-nums">
        {value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}
      </div>
    </div>
  );
}

export default function PerformanceTab({ analytics, posts }: Props) {
  const published = posts.filter((p) => p.status === "published");
  const maxReach = Math.max(...published.map((p) => p.estimated_reach), 1);
  const engRate = analytics.total_impressions > 0
    ? ((analytics.total_engagements / analytics.total_impressions) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Posts"     value={analytics.total_posts}       color="#e2e8f0" />
        <StatCard label="Impressions"     value={analytics.total_impressions >= 1000 ? `${(analytics.total_impressions / 1000).toFixed(1)}K` : analytics.total_impressions} color="#00ff88" />
        <StatCard label="Engagements"     value={analytics.total_engagements} color="#00d4ff" />
        <StatCard label="Eng. Rate"       value={`${engRate}%`}               color="#fbbf24" />
        <StatCard label="Reposts"         value={analytics.total_reposts}     color="#a78bfa" />
        <StatCard label="Followers ↑"     value={analytics.followers_gained}  color="#ff9500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Post */}
        {analytics.top_post_preview && (
          <div className="rounded-lg border border-[#00ff88]/20 bg-[#00ff88]/5 p-4 space-y-2">
            <div className="text-[10px] font-mono text-[#00ff88] uppercase tracking-wider">TOP PERFORMING POST</div>
            <p className="text-sm text-white/80 leading-relaxed">{analytics.top_post_preview}</p>
            <div className="flex gap-4 text-[10px] font-mono text-white/35">
              <span>Impressions <span className="text-[#00ff88]">{analytics.top_post_impressions >= 1000 ? `${(analytics.top_post_impressions / 1000).toFixed(1)}K` : analytics.top_post_impressions}</span></span>
              <span>Avg Hook <span className="text-[#ff9500]">{analytics.avg_hook_score}</span></span>
            </div>
          </div>
        )}

        {/* Hook score distribution */}
        <div className="rounded-lg border border-white/8 bg-white/3 p-4">
          <div className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-3">HOOK SCORE DISTRIBUTION</div>
          <div className="space-y-2">
            {[
              { label: "80–100 (Elite)", posts: published.filter((p) => p.hook_score >= 80), color: "#00ff88" },
              { label: "60–79 (Strong)", posts: published.filter((p) => p.hook_score >= 60 && p.hook_score < 80), color: "#ff9500" },
              { label: "40–59 (Average)", posts: published.filter((p) => p.hook_score >= 40 && p.hook_score < 60), color: "#fbbf24" },
              { label: "<40 (Weak)", posts: published.filter((p) => p.hook_score < 40), color: "#64748b" },
            ].map((row) => (
              <BarRow key={row.label} label={row.label} value={row.posts.length} max={published.length || 1} color={row.color} />
            ))}
          </div>
        </div>
      </div>

      {/* Published posts performance list */}
      {published.length > 0 && (
        <div className="rounded-lg border border-white/8 bg-white/3 p-4">
          <div className="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-3">PUBLISHED POSTS</div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[9px] font-mono text-white/20 uppercase px-2">
              <div className="col-span-6">PREVIEW</div>
              <div className="col-span-2 text-center">HOOK</div>
              <div className="col-span-2 text-center">EST. REACH</div>
              <div className="col-span-2 text-center">TYPE</div>
            </div>
            {published.slice(0, 10).map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded bg-white/2 hover:bg-white/4 transition-colors">
                <div className="col-span-6 text-xs text-white/65 truncate">{p.content.slice(0, 60)}</div>
                <div className="col-span-2 text-center">
                  <span className="text-[11px] font-mono font-bold" style={{ color: p.hook_score >= 70 ? "#00ff88" : p.hook_score >= 50 ? "#ff9500" : "#64748b" }}>
                    {p.hook_score}
                  </span>
                </div>
                <div className="col-span-2 text-center text-[11px] font-mono text-white/40">
                  {p.estimated_reach >= 1000 ? `${(p.estimated_reach / 1000).toFixed(1)}K` : p.estimated_reach}
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[9px] font-mono text-[#00d4ff]/50 uppercase">{p.post_type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {published.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-white/10 text-4xl">△</div>
          <div className="text-white/25 text-sm font-mono uppercase tracking-widest">No published posts yet</div>
          <div className="text-white/15 text-xs font-mono">Publish a post to start tracking performance</div>
        </div>
      )}
    </div>
  );
}
