"use client";

import { useState } from "react";

interface ForestRegion {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  trees_planted: number;
  hectares_restored: number;
  status: "active" | "monitoring" | "completed";
  narrative_opportunities: string[];
  signal_level: "high" | "medium" | "low";
  lead_planter: string;
}

const REGIONS: ForestRegion[] = [
  {
    id: "reg-01",
    name: "Chiapas Highlands",
    country: "Mexico",
    lat: 16.75,
    lng: -92.6,
    trees_planted: 248000,
    hectares_restored: 124,
    status: "active",
    narrative_opportunities: ["Marcos milestone", "Indigenous land restoration", "Water table recovery"],
    signal_level: "high",
    lead_planter: "Marcos Rodriguez",
  },
  {
    id: "reg-02",
    name: "Sahel Zone — Mopti",
    country: "Mali",
    lat: 14.5,
    lng: -4.2,
    trees_planted: 89000,
    hectares_restored: 44,
    status: "active",
    narrative_opportunities: ["Women-led restoration", "Desertification reversal", "Community water access"],
    signal_level: "high",
    lead_planter: "Amara Diallo",
  },
  {
    id: "reg-03",
    name: "Mekong Delta",
    country: "Vietnam",
    lat: 10.2,
    lng: 105.8,
    trees_planted: 312000,
    hectares_restored: 89,
    status: "active",
    narrative_opportunities: ["Flood protection", "Rice farmer transformation", "Coastal resilience"],
    signal_level: "medium",
    lead_planter: "Bui Thi Lan",
  },
  {
    id: "reg-04",
    name: "Andes Foothills — Nariño",
    country: "Colombia",
    lat: 1.2,
    lng: -77.3,
    trees_planted: 134000,
    hectares_restored: 67,
    status: "monitoring",
    narrative_opportunities: ["Drone monitoring technology", "Youth-led reforestation", "Biodiversity recovery"],
    signal_level: "medium",
    lead_planter: "Diego Fuentes",
  },
  {
    id: "reg-05",
    name: "Central Kalimantan",
    country: "Indonesia",
    lat: -1.5,
    lng: 113.8,
    trees_planted: 178000,
    hectares_restored: 98,
    status: "active",
    narrative_opportunities: ["Indigenous knowledge", "Orangutan habitat", "Peatland restoration"],
    signal_level: "high",
    lead_planter: "Fatimah Hassan",
  },
  {
    id: "reg-06",
    name: "Western Ghats",
    country: "India",
    lat: 11.8,
    lng: 76.2,
    trees_planted: 95000,
    hectares_restored: 52,
    status: "monitoring",
    narrative_opportunities: ["Tiger corridor restoration", "Coffee farming agroforestry", "Monsoon forest recovery"],
    signal_level: "low",
    lead_planter: "Priya Nair",
  },
];

const STATUS_CONFIG = {
  active:     { color: "#00ff88", label: "Active", dot: "bg-[#00ff88] animate-pulse" },
  monitoring: { color: "#fbbf24", label: "Monitoring", dot: "bg-[#fbbf24]" },
  completed:  { color: "#00d4ff", label: "Completed", dot: "bg-[#00d4ff]" },
};

const SIGNAL_CONFIG = {
  high:   { color: "#ff2d55", label: "HIGH SIGNAL" },
  medium: { color: "#ff9500", label: "MED SIGNAL" },
  low:    { color: "#64748b", label: "LOW SIGNAL" },
};

// Simplified pseudo-map with positioned dots
function MapDot({
  region,
  onClick,
  selected,
}: {
  region: ForestRegion;
  onClick: () => void;
  selected: boolean;
}) {
  const sig = SIGNAL_CONFIG[region.signal_level];
  const st = STATUS_CONFIG[region.status];

  // Map lat/lng to approximate SVG percentage positions
  // Rough bounding box: lat -35 to 55, lng -120 to 145
  const x = ((region.lng + 120) / 265) * 100;
  const y = ((55 - region.lat) / 90) * 100;

  return (
    <g
      transform={`translate(${x}%, ${y}%)`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      <circle
        r={selected ? "2.5%" : "1.8%"}
        fill={sig.color}
        opacity={selected ? 0.9 : 0.6}
        style={{ filter: `drop-shadow(0 0 ${selected ? 8 : 4}px ${sig.color})` }}
      />
      {selected && (
        <circle
          r="4%"
          fill="none"
          stroke={sig.color}
          strokeWidth="0.5%"
          opacity={0.4}
        />
      )}
    </g>
  );
}

export default function ForestMap() {
  const [selected, setSelected] = useState<ForestRegion | null>(REGIONS[0]);

  const totalTrees = REGIONS.reduce((s, r) => s + r.trees_planted, 0);
  const totalHa = REGIONS.reduce((s, r) => s + r.hectares_restored, 0);

  return (
    <div className="flex gap-4 h-full">
      {/* Map */}
      <div className="flex-1 min-w-0">
        <div className="relative rounded-xl border border-white/8 bg-[#040411] overflow-hidden" style={{ height: "440px" }}>
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="10%" height="10%" patternUnits="objectBoundingBox">
                <path d="M 10% 0 L 0 0 0 10%" fill="none" stroke="#00ff88" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {/* Latitude lines */}
            {[0, 20, 40, 60, 80, 100].map((y) => (
              <line key={y} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke="#00ff88" strokeWidth="0.3" opacity="0.3" />
            ))}
            {[0, 25, 50, 75, 100].map((x) => (
              <line key={x} x1={`${x}%`} y1="0" x2={`${x}%`} y2="100%" stroke="#00ff88" strokeWidth="0.3" opacity="0.2" />
            ))}
          </svg>

          {/* Region dots */}
          <svg className="absolute inset-0 w-full h-full">
            {REGIONS.map((region) => {
              const x = ((region.lng + 120) / 265) * 100;
              const y = ((55 - region.lat) / 90) * 100;
              const sig = SIGNAL_CONFIG[region.signal_level];
              const isSelected = selected?.id === region.id;

              return (
                <g key={region.id} onClick={() => setSelected(region)} style={{ cursor: "pointer" }}>
                  {isSelected && (
                    <circle
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="24"
                      fill="none"
                      stroke={sig.color}
                      strokeWidth="1"
                      opacity="0.3"
                    />
                  )}
                  <circle
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r={isSelected ? "10" : "7"}
                    fill={sig.color}
                    opacity={isSelected ? 0.9 : 0.6}
                    style={{ filter: `drop-shadow(0 0 ${isSelected ? 10 : 5}px ${sig.color})` }}
                  />
                  <circle
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r={isSelected ? "12" : "9"}
                    fill="none"
                    stroke={sig.color}
                    strokeWidth="1"
                    opacity={isSelected ? 0.5 : 0.2}
                  />
                  <text
                    x={`${x}%`}
                    y={`${y + 4.5}%`}
                    textAnchor="middle"
                    className="text-[10px]"
                    fill="rgba(255,255,255,0.6)"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {region.name.split(" ")[0]}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Overlay header */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="bg-[#040411]/80 backdrop-blur rounded-lg border border-white/10 px-3 py-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[11px] font-mono text-[#00ff88]">FOREST INTELLIGENCE MAP</span>
            </div>
            <div className="bg-[#040411]/80 backdrop-blur rounded-lg border border-white/10 px-3 py-1.5 flex items-center gap-4">
              {Object.entries(SIGNAL_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-[10px] font-mono text-white/40">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="absolute bottom-3 left-3 right-3 flex gap-3">
            {[
              { label: "TOTAL TREES", value: `${(totalTrees / 1000).toFixed(0)}K` },
              { label: "HECTARES", value: `${totalHa.toFixed(0)}ha` },
              { label: "REGIONS", value: REGIONS.length },
              { label: "ACTIVE SITES", value: REGIONS.filter((r) => r.status === "active").length },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#040411]/80 backdrop-blur rounded-lg border border-white/10 px-3 py-1.5 flex flex-col">
                <span className="text-[9px] font-mono text-white/30 uppercase">{stat.label}</span>
                <span className="text-sm font-bold font-mono text-[#00ff88]">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Region Detail */}
      <div className="w-64 shrink-0 space-y-3 overflow-y-auto">
        {selected ? (
          <>
            <div className="rounded-lg border border-white/10 bg-white/3 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CONFIG[selected.status].dot}`} />
                <span className="text-[10px] font-mono uppercase" style={{ color: STATUS_CONFIG[selected.status].color }}>
                  {STATUS_CONFIG[selected.status].label}
                </span>
                <span className="text-[10px] font-mono ml-auto" style={{ color: SIGNAL_CONFIG[selected.signal_level].color }}>
                  {SIGNAL_CONFIG[selected.signal_level].label}
                </span>
              </div>
              <h3 className="text-base font-bold text-white/90">{selected.name}</h3>
              <div className="text-xs text-white/40 mb-3">{selected.country}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/3 rounded-lg p-2">
                  <div className="text-[9px] text-white/25 font-mono">TREES</div>
                  <div className="text-sm font-bold font-mono text-[#00ff88]">
                    {(selected.trees_planted / 1000).toFixed(0)}K
                  </div>
                </div>
                <div className="bg-white/3 rounded-lg p-2">
                  <div className="text-[9px] text-white/25 font-mono">HECTARES</div>
                  <div className="text-sm font-bold font-mono text-[#00d4ff]">{selected.hectares_restored}ha</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/8">
                <div className="text-[10px] text-white/25 font-mono mb-1">LEAD PLANTER</div>
                <div className="text-sm text-white/70">{selected.lead_planter}</div>
              </div>
            </div>

            <div className="rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/5 p-4">
              <div className="text-[10px] text-[#fbbf24] font-mono uppercase tracking-wider mb-2">NARRATIVE OPPORTUNITIES</div>
              <ul className="space-y-1.5">
                {selected.narrative_opportunities.map((opp, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="text-[#fbbf24] mt-0.5">→</span>
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {/* Region List */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-white/25 font-mono uppercase tracking-wider px-1">ALL REGIONS</div>
          {REGIONS.map((region) => (
            <button
              key={region.id}
              onClick={() => setSelected(region)}
              className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                selected?.id === region.id
                  ? "border-white/20 bg-white/5"
                  : "border-white/8 bg-white/2 hover:bg-white/4"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: SIGNAL_CONFIG[region.signal_level].color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white/75 font-medium truncate">{region.name}</div>
                  <div className="text-[10px] text-white/30 font-mono">{region.country}</div>
                </div>
                <div className="text-[11px] font-mono text-[#00ff88]">
                  {(region.trees_planted / 1000).toFixed(0)}K
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
