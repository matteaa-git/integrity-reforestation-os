"use client";

import { useEffect, useState } from "react";

interface Pin {
  id: string;
  title: string;
  description: string;
  board_name: string;
  pin_type: string;
  status: string;
  pin_score: number;
  estimated_monthly_views: number;
  scheduled_time: string | null;
  created_at: string;
}

interface PinListResponse {
  pins: Pin[];
  total: number;
  draft_count: number;
  pending_count: number;
  scheduled_count: number;
  published_count: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_STYLES: Record<string, string> = {
  draft:            "bg-gray-100 text-gray-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved:         "bg-blue-100 text-blue-700",
  scheduled:        "bg-purple-100 text-purple-700",
  published:        "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${accent ? "border-[#E60023]/20 bg-[#E60023]/5" : "border-gray-200 bg-white"}`}>
      <div className={`text-xl font-bold ${accent ? "text-[#E60023]" : "text-gray-800"}`}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

export default function DraftsTab() {
  const [data, setData]     = useState<PinListResponse | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`${API_BASE}/pinterest/drafts?limit=100`);
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await fetch(`${API_BASE}/pinterest/${id}`, { method: "DELETE" });
    load();
  };

  const handleApprove = async (id: string) => {
    await fetch(`${API_BASE}/pinterest/${id}/submit-approval`, { method: "POST" });
    load();
  };

  const handlePublish = async (id: string) => {
    await fetch(`${API_BASE}/pinterest/${id}/publish`, { method: "POST" });
    load();
  };

  if (loading) return <div className="p-8 text-center text-gray-400 text-[13px]">Loading…</div>;
  if (!data)   return null;

  const pins = data.pins.filter(p => filter === "all" || p.status === filter);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total" value={data.total} />
        <StatCard label="Drafts" value={data.draft_count} />
        <StatCard label="Pending" value={data.pending_count} />
        <StatCard label="Scheduled" value={data.scheduled_count} />
        <StatCard label="Published" value={data.published_count} accent />
      </div>

      {/* Filter */}
      <div className="flex gap-1.5">
        {["all", "draft", "pending_approval", "scheduled", "published"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              filter === f
                ? "bg-[#E60023] text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All" : f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Pins list */}
      {pins.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <div className="text-3xl mb-3 opacity-30">📌</div>
          <div className="text-[13px] font-medium">No pins yet</div>
          <div className="text-[11px] mt-1">Create your first pin in the Compose tab.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {pins.map((pin) => (
            <div key={pin.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                {/* Color block standing in for image */}
                <div className="w-10 h-12 rounded-lg bg-[#E60023]/10 border border-[#E60023]/20 flex items-center justify-center shrink-0 text-[#E60023] text-sm">
                  📌
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[13px] font-semibold text-gray-900 truncate">
                      {pin.title || <span className="text-gray-400 italic">Untitled</span>}
                    </span>
                    <StatusBadge status={pin.status} />
                    {pin.pin_type !== "standard" && (
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase">
                        {pin.pin_type}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 line-clamp-1 mb-1.5">
                    {pin.description || <span className="text-gray-300 italic">No description</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    {pin.board_name && <span>📋 {pin.board_name}</span>}
                    <span>Score: <span className={`font-semibold ${pin.pin_score >= 70 ? "text-emerald-600" : pin.pin_score >= 45 ? "text-amber-600" : "text-gray-500"}`}>{pin.pin_score}</span></span>
                    <span>{(pin.estimated_monthly_views / 1000).toFixed(1)}K est. views/mo</span>
                    {pin.scheduled_time && (
                      <span className="text-purple-600">⏰ {new Date(pin.scheduled_time).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === pin.id ? null : pin.id)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {expanded === pin.id ? "Hide" : "Preview"}
                  </button>
                  {pin.status === "draft" && (
                    <button
                      onClick={() => handleApprove(pin.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      Submit
                    </button>
                  )}
                  {(pin.status === "approved" || pin.status === "pending_approval") && (
                    <button
                      onClick={() => handlePublish(pin.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#E60023] text-white hover:bg-[#ad081b] transition-colors"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(pin.id)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {expanded === pin.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {pin.description || <span className="text-gray-300 italic">No description</span>}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
