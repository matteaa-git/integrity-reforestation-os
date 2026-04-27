"use client";

import { useState, useEffect, useCallback } from "react";
import type { Asset, AssetListResponse } from "@/lib/api";
import { fetchAssets } from "@/lib/api";

const CONTENT_TYPE_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  drone:        { color: "#00d4ff", label: "Drone Aerial",    icon: "◈" },
  video:        { color: "#f472b6", label: "Video",           icon: "▶" },
  talking_head: { color: "#fbbf24", label: "Talking Head",    icon: "◎" },
  photo:        { color: "#00ff88", label: "Photography",     icon: "◫" },
  timelapse:    { color: "#a78bfa", label: "Timelapse",       icon: "⊙" },
};

const NARRATIVE_ASSET_MAP: Record<string, { content_types: string[]; subjects: string[]; label: string }> = {
  "planter_story":   { content_types: ["talking_head", "video", "photo"], subjects: ["planter", "hands", "seedling"], label: "Planter Story" },
  "crisis_response": { content_types: ["drone", "video", "timelapse"],    subjects: ["forest", "canopy", "restoration"], label: "Crisis Response" },
  "impact_data":     { content_types: ["drone", "timelapse", "photo"],     subjects: ["aerial", "before_after", "growth"], label: "Impact Data" },
  "field_diary":     { content_types: ["video", "photo", "talking_head"],  subjects: ["field", "work", "team"], label: "Field Diary" },
  "education":       { content_types: ["talking_head", "photo", "video"],  subjects: ["species", "process", "science"], label: "Education" },
};

function AssetCard({ asset, onSelect, selected }: { asset: Asset; onSelect: (a: Asset) => void; selected: boolean }) {
  const ctCfg = asset.content_type ? CONTENT_TYPE_CONFIG[asset.content_type] : null;

  return (
    <button
      onClick={() => onSelect(asset)}
      className={`rounded-lg border text-left overflow-hidden transition-all ${
        selected
          ? "border-[#00ff88]/50 ring-1 ring-[#00ff88]/30"
          : "border-white/8 hover:border-white/15"
      }`}
    >
      {/* Thumbnail placeholder */}
      <div
        className="aspect-video flex items-center justify-center relative"
        style={{
          background: `linear-gradient(135deg, ${ctCfg?.color ?? "#00ff88"}15, rgba(0,0,0,0.4))`,
        }}
      >
        <span className="text-3xl opacity-30">{ctCfg?.icon ?? "◫"}</span>
        {asset.media_type === "video" && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/60 rounded px-1.5 py-0.5 text-[9px] font-mono text-white/60">
            {asset.duration ? `${Math.round(asset.duration)}s` : "VIDEO"}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="text-[11px] text-white/70 font-medium truncate">{asset.filename}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {ctCfg && (
            <span
              className="text-[9px] font-mono uppercase px-1 py-0.5 rounded"
              style={{ color: ctCfg.color, backgroundColor: `${ctCfg.color}15` }}
            >
              {ctCfg.label}
            </span>
          )}
          {asset.pillar && (
            <span className="text-[9px] text-white/25 font-mono">{asset.pillar}</span>
          )}
        </div>
        {asset.ai_keywords && asset.ai_keywords.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {asset.ai_keywords.slice(0, 3).map((kw) => (
              <span key={kw} className="text-[9px] text-[#00d4ff]/50 font-mono">#{kw}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export default function MediaIntelligence() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [narrativeFilter, setNarrativeFilter] = useState<string>("all");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (mediaTypeFilter !== "all") params.media_type = mediaTypeFilter;
      if (searchQuery) params.search = searchQuery;
      const res: AssetListResponse = await fetchAssets({ ...params, limit: 50 });
      setAssets(res.assets);
    } catch {
      // demo fallback
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [mediaTypeFilter, searchQuery]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const filteredAssets = assets.filter((a) => {
    if (narrativeFilter === "all") return true;
    const mapping = NARRATIVE_ASSET_MAP[narrativeFilter];
    if (!mapping) return true;
    return (
      (a.content_type && mapping.content_types.includes(a.content_type)) ||
      mapping.subjects.some((s) => (a.subject ?? "").toLowerCase().includes(s) || (a.description ?? "").toLowerCase().includes(s))
    );
  });

  return (
    <div className="flex gap-4 h-full">
      {/* Filters + Grid */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadAssets()}
            placeholder="Search assets..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#00ff88]/40 transition-all w-48"
          />
          <div className="flex gap-1.5">
            {["all", "image", "video"].map((t) => (
              <button
                key={t}
                onClick={() => { setMediaTypeFilter(t); }}
                className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase border transition-all ${
                  mediaTypeFilter === t
                    ? "border-[#00ff88]/50 text-[#00ff88] bg-[#00ff88]/10"
                    : "border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-white/30 font-mono ml-auto">{filteredAssets.length} assets</div>
        </div>

        {/* Narrative Filter Row */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setNarrativeFilter("all")}
            className={`px-3 py-1 rounded-lg text-[10px] font-mono border transition-all ${
              narrativeFilter === "all"
                ? "border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10"
                : "border-white/8 text-white/30 hover:border-white/15"
            }`}
          >
            ALL ASSETS
          </button>
          {Object.entries(NARRATIVE_ASSET_MAP).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setNarrativeFilter(key)}
              className={`px-3 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                narrativeFilter === key
                  ? "border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/10"
                  : "border-white/8 text-white/30 hover:border-white/15"
              }`}
            >
              {val.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Asset Grid */}
        {loading ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-white/3 border border-white/5 animate-pulse aspect-video" />
            ))}
          </div>
        ) : filteredAssets.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onSelect={setSelected}
                selected={selected?.id === asset.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-3xl mb-3 opacity-30">◫</div>
            <div className="text-sm text-white/30 font-mono">
              {assets.length === 0
                ? "ASSET LIBRARY NOT CONNECTED — SYNC TO VIEW MEDIA"
                : "NO ASSETS MATCH THIS NARRATIVE FILTER"}
            </div>
            <div className="text-[11px] text-white/20 font-mono mt-1">
              {assets.length === 0 ? "Go to Asset Library to sync your media" : "Try a different narrative type"}
            </div>
          </div>
        )}
      </div>

      {/* Asset Detail + Recommendations */}
      <div className="w-60 shrink-0 space-y-3">
        {selected ? (
          <>
            <div className="rounded-lg border border-white/10 bg-white/3 p-4">
              <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3">SELECTED ASSET</div>
              <div
                className="aspect-video rounded-lg flex items-center justify-center mb-3"
                style={{ background: "linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,0,0,0.5))" }}
              >
                <span className="text-4xl opacity-20">
                  {CONTENT_TYPE_CONFIG[selected.content_type ?? ""]?.icon ?? "◫"}
                </span>
              </div>
              <div className="text-sm font-medium text-white/80 mb-1 truncate">{selected.filename}</div>
              <div className="space-y-1.5 text-[11px]">
                {selected.content_type && (
                  <div className="flex justify-between">
                    <span className="text-white/30">Type</span>
                    <span className="text-white/60">{selected.content_type}</span>
                  </div>
                )}
                {selected.subject && (
                  <div className="flex justify-between">
                    <span className="text-white/30">Subject</span>
                    <span className="text-white/60">{selected.subject}</span>
                  </div>
                )}
                {selected.pillar && (
                  <div className="flex justify-between">
                    <span className="text-white/30">Pillar</span>
                    <span className="text-white/60">{selected.pillar}</span>
                  </div>
                )}
                {selected.media_type === "image" && selected.width && (
                  <div className="flex justify-between">
                    <span className="text-white/30">Dimensions</span>
                    <span className="text-white/60">{selected.width}×{selected.height}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[#00ff88]/20 bg-[#00ff88]/5 p-4">
              <div className="text-[10px] text-[#00ff88] font-mono uppercase tracking-wider mb-2">NARRATIVE FIT</div>
              <ul className="space-y-1.5">
                {Object.entries(NARRATIVE_ASSET_MAP).map(([key, val]) => {
                  const fits = selected.content_type && val.content_types.includes(selected.content_type);
                  if (!fits) return null;
                  return (
                    <li key={key} className="flex items-center gap-2 text-xs text-white/60">
                      <span className="text-[#00ff88]">✓</span>
                      {val.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-white/8 bg-white/3 p-4">
            <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-3">CONTENT TYPE MATRIX</div>
            <div className="space-y-2">
              {Object.entries(CONTENT_TYPE_CONFIG).map(([key, cfg]) => {
                const count = assets.filter((a) => a.content_type === key).length;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span className="text-[11px] text-white/50 flex-1">{cfg.label}</span>
                    <span className="text-[11px] font-mono text-white/30">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
