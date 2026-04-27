"use client";

interface XPost {
  id: string;
  content: string;
  post_type: string;
  thread_posts: { position: number; text: string; char_count: number }[];
  status: string;
  hook_score: number;
  estimated_reach: number;
  scheduled_time: string | null;
  updated_at: string;
}

interface Props {
  posts: XPost[];
  onEdit: (post?: XPost) => void;
  onRefresh: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatScheduleTime(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (d.getTime() - now.getTime()) / 3600000;
  const relative = diffH < 0
    ? "Past due"
    : diffH < 1
    ? `${Math.round(diffH * 60)}m`
    : diffH < 24
    ? `${Math.round(diffH)}h`
    : `${Math.round(diffH / 24)}d`;
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    relative,
  };
}

export default function ScheduledTab({ posts, onEdit, onRefresh }: Props) {
  const scheduled = posts.filter((p) => p.status === "scheduled" && p.scheduled_time)
    .sort((a, b) => new Date(a.scheduled_time!).getTime() - new Date(b.scheduled_time!).getTime());

  const upcoming = scheduled.filter((p) => new Date(p.scheduled_time!).getTime() > Date.now());
  const overdue  = scheduled.filter((p) => new Date(p.scheduled_time!).getTime() <= Date.now());

  if (scheduled.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="text-white/10 text-5xl">▦</div>
        <div className="text-white/30 text-sm font-mono uppercase tracking-widest">No scheduled posts</div>
        <div className="text-white/15 text-xs font-mono text-center">
          Schedule a post from the composer using the Schedule button
        </div>
      </div>
    );
  }

  const PostRow = ({ post }: { post: XPost }) => {
    const t = formatScheduleTime(post.scheduled_time!);
    const preview = post.post_type === "thread"
      ? (post.thread_posts[0]?.text ?? post.content)
      : post.content;
    const isOverdue = new Date(post.scheduled_time!).getTime() <= Date.now();

    return (
      <div className={`rounded-lg border p-4 ${isOverdue ? "border-[#ff2d55]/30 bg-[#ff2d55]/5" : "border-white/8 bg-white/3"}`}>
        <div className="flex items-start gap-4">
          {/* Time block */}
          <div className="text-center shrink-0 w-16">
            <div className="text-lg font-bold font-mono" style={{ color: isOverdue ? "#ff2d55" : "#00ff88" }}>
              {t.relative}
            </div>
            <div className="text-[10px] font-mono text-white/35">{t.date}</div>
            <div className="text-[10px] font-mono text-white/25">{t.time}</div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {post.post_type === "thread" && (
                <span className="text-[10px] font-mono text-[#00d4ff]/60 bg-[#00d4ff]/8 px-1.5 py-0.5 rounded">
                  THREAD · {post.thread_posts.length}
                </span>
              )}
              {isOverdue && (
                <span className="text-[10px] font-mono text-[#ff2d55] bg-[#ff2d55]/10 px-1.5 py-0.5 rounded animate-pulse">
                  OVERDUE
                </span>
              )}
            </div>
            <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">{preview}</p>
            {post.hook_score > 0 && (
              <div className="mt-1.5 text-[10px] font-mono text-white/25">
                Hook <span className="text-[#00ff88]">{post.hook_score}</span>
                {" · "}Est. Reach <span className="text-[#00d4ff]">
                  {post.estimated_reach >= 1000 ? `${(post.estimated_reach / 1000).toFixed(1)}K` : post.estimated_reach}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => onEdit(post)}
              className="px-2.5 py-1 rounded border border-white/12 text-[10px] font-mono text-white/40 hover:border-white/22 transition-all"
            >
              EDIT
            </button>
            <button
              onClick={async () => {
                await fetch(`${API_BASE}/x/${post.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "draft", scheduled_time: null }),
                });
                onRefresh();
              }}
              className="px-2.5 py-1 rounded border border-[#ff9500]/20 text-[10px] font-mono text-[#ff9500]/50 hover:bg-[#ff9500]/10 transition-all"
            >
              UNSCHEDULE
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-[#ff2d55] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="animate-pulse">●</span> OVERDUE ({overdue.length})
          </div>
          <div className="space-y-2">{overdue.map((p) => <PostRow key={p.id} post={p} />)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">
            UPCOMING ({upcoming.length})
          </div>
          <div className="space-y-2">{upcoming.map((p) => <PostRow key={p.id} post={p} />)}</div>
        </div>
      )}
    </div>
  );
}
