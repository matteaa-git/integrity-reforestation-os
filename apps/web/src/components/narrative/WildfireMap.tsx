"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDraft } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FireIntensity = "low" | "medium" | "high" | "extreme";
type FireStatus    = "active" | "contained" | "extinguished";
type FireLayer     = "scars" | "hotspots" | "news" | "restoration";

interface FireTimelineEvent { date: string; event: string; }
interface MediaCoverage     { outlet: string; headline: string; date: string; reach: string; }
interface ContentSuggestion { format: string; hook: string; angle: string; cta: string; }

interface WildfireEvent {
  id: string;
  name: string;
  year: 2023 | 2024 | 2025;
  month: number;
  lat: number;
  lng: number;
  hectares: number;
  intensity: FireIntensity;
  status: FireStatus;
  province: string;
  cause: string;
  restoration_potential: number;
  integrity_relevance: "critical" | "high" | "medium" | "low";
  timeline: FireTimelineEvent[];
  media_coverage: MediaCoverage[];
  narrative_opportunities: string[];
  content_suggestions: ContentSuggestion[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Wildfire dataset — Canadian fires 2023–2025 based on satellite records
// ─────────────────────────────────────────────────────────────────────────────

const WILDFIRE_EVENTS: WildfireEvent[] = [
  {
    id: "wf-2023-01",
    name: "Donnie Creek Complex",
    year: 2023, month: 5,
    lat: 58.2, lng: -121.5,
    hectares: 589_580,
    intensity: "extreme",
    status: "extinguished",
    province: "British Columbia",
    cause: "Lightning",
    restoration_potential: 91,
    integrity_relevance: "critical",
    timeline: [
      { date: "2023-05-12", event: "Ignition detected via MODIS satellite" },
      { date: "2023-06-02", event: "Explosive growth — 100,000 ha breached" },
      { date: "2023-07-15", event: "Largest fire in BC recorded history" },
      { date: "2023-09-28", event: "Contained after 140 days of burning" },
    ],
    media_coverage: [
      { outlet: "CBC", headline: "BC's largest wildfire ever scorches nearly 600,000 ha", date: "2023-07-15", reach: "4.2M" },
      { outlet: "Globe and Mail", headline: "Canada's 2023 wildfire season smashes all records", date: "2023-08-01", reach: "2.8M" },
      { outlet: "BBC", headline: "Canada fires: Donnie Creek becomes country's biggest ever", date: "2023-07-16", reach: "11M" },
    ],
    narrative_opportunities: [
      "Largest BC fire in recorded history — reforestation scale opportunity",
      "Boreal forest carbon sink destruction narrative",
      "Indigenous land stewardship and fire management contrast",
      "Scale of Canada's 2023 season vs. historical baselines",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "BC just lost a forest the size of Prince Edward Island in a single fire 🔥", angle: "Scale & urgency", cta: "What happens to land this scarred? Thread →" },
      { format: "Instagram Carousel", hook: "Before and after: 589,000 hectares of boreal forest", angle: "Visual impact story", cta: "Swipe to see the restoration plan" },
      { format: "YouTube Script", hook: "Canada's most destructive wildfire — and what comes next", angle: "Documentary investigation", cta: "Subscribe for reforestation updates" },
      { format: "Substack", hook: "The Donnie Creek fires destroyed a carbon sink we spent decades building", angle: "Climate policy analysis", cta: "Read the full restoration brief" },
    ],
  },
  {
    id: "wf-2023-02",
    name: "NWT Hay River Complex",
    year: 2023, month: 5,
    lat: 61.0, lng: -115.7,
    hectares: 4_200_000,
    intensity: "extreme",
    status: "extinguished",
    province: "Northwest Territories",
    cause: "Lightning",
    restoration_potential: 78,
    integrity_relevance: "critical",
    timeline: [
      { date: "2023-05-29", event: "Fires surround Hay River — 5,000 evacuated" },
      { date: "2023-06-18", event: "NWT fire season exceeds 1M ha" },
      { date: "2023-08-14", event: "Yellowknife (pop. 20,000) ordered evacuated" },
      { date: "2023-09-30", event: "Season total: 4.2M ha — NWT record" },
    ],
    media_coverage: [
      { outlet: "Reuters", headline: "Wildfire forces evacuation of Canada's Yellowknife", date: "2023-08-14", reach: "22M" },
      { outlet: "NYT", headline: "A City of 20,000 Flees as Canadian Wildfire Closes In", date: "2023-08-15", reach: "18M" },
      { outlet: "CTV", headline: "NWT burns 4.2M hectares — territory forever changed", date: "2023-10-01", reach: "3.1M" },
    ],
    narrative_opportunities: [
      "Yellowknife evacuation — urban wildfire risk is real and growing",
      "NWT Indigenous communities displaced — land sovereignty narrative",
      "4.2M hectares of boreal = decades of carbon sequestration lost",
      "Reforestation at this scale requires industrial-level intervention",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "20,000 Canadians fled their city because of a wildfire. This is the NWT now 🌲🔥", angle: "Human impact", cta: "What happens to their land?" },
      { format: "Instagram Carousel", hook: "Yellowknife evacuation: what 4.2 million hectares of fire looks like", angle: "Crisis documentation", cta: "Follow for restoration updates" },
      { format: "YouTube Script", hook: "I drove through the NWT fire zone — what I found changes everything", angle: "First-person field report", cta: "See the restoration mission" },
      { format: "Substack", hook: "After the largest NWT fire season in history, what does reforestation actually look like?", angle: "Policy & practice deep dive", cta: "Subscribe for ground truth" },
    ],
  },
  {
    id: "wf-2023-03",
    name: "Northern Quebec Fires",
    year: 2023, month: 6,
    lat: 51.5, lng: -76.8,
    hectares: 5_800_000,
    intensity: "extreme",
    status: "extinguished",
    province: "Quebec",
    cause: "Lightning",
    restoration_potential: 85,
    integrity_relevance: "high",
    timeline: [
      { date: "2023-06-01", event: "Smoke blankets New York City — air quality hazardous" },
      { date: "2023-06-10", event: "Quebec fires exceed 1M ha" },
      { date: "2023-07-01", event: "Season total approaches 6M ha" },
      { date: "2023-09-15", event: "Final extent: 5.8M ha across northern Quebec" },
    ],
    media_coverage: [
      { outlet: "AP", headline: "Canadian wildfires send smoke to blanket New York City", date: "2023-06-07", reach: "45M" },
      { outlet: "CNN", headline: "New York turns apocalyptic orange as Canadian wildfires choke East Coast", date: "2023-06-08", reach: "31M" },
      { outlet: "Le Devoir", headline: "Les feux de forêt au Québec: une catastrophe historique", date: "2023-07-01", reach: "890K" },
    ],
    narrative_opportunities: [
      "NYC air quality crisis linked Canadian fires to global attention",
      "Quebec's boreal forest holds 15% of global carbon — its loss is everyone's problem",
      "Reforestation velocity needed to keep pace with fire expansion",
      "Indigenous fire stewardship knowledge vs. industrial forestry failure",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "When NYC's sky turned orange, it was Canadian forests burning. Here's the scale 🧵", angle: "Global impact hook", cta: "This is why reforestation is defense" },
      { format: "Instagram Carousel", hook: "5.8M hectares: Quebec's fire season vs. the size of countries", angle: "Data visualization", cta: "What gets planted after this?" },
      { format: "YouTube Script", hook: "The fires that turned New York orange — and the Canadian forests behind them", angle: "Global climate connection", cta: "Subscribe for the restoration story" },
      { format: "Substack", hook: "Quebec's boreal forest is the planet's second lung. It burned this summer.", angle: "Climate science narrative", cta: "Read the full analysis" },
    ],
  },
  {
    id: "wf-2023-04",
    name: "Northern Ontario — Kenora District",
    year: 2023, month: 7,
    lat: 50.2, lng: -93.8,
    hectares: 285_000,
    intensity: "high",
    status: "extinguished",
    province: "Ontario",
    cause: "Lightning",
    restoration_potential: 96,
    integrity_relevance: "critical",
    timeline: [
      { date: "2023-07-03", event: "Fire ignition near Kenora district" },
      { date: "2023-07-12", event: "Evacuation of remote First Nations communities" },
      { date: "2023-08-01", event: "Fire exceeds 200,000 ha" },
      { date: "2023-08-28", event: "Fire controlled — Integrity assessment begins" },
    ],
    media_coverage: [
      { outlet: "CBC North", headline: "Kenora district fires: First Nations face weeks of evacuation", date: "2023-07-14", reach: "420K" },
      { outlet: "TVO", headline: "Northern Ontario fire season devastating for communities, boreal ecosystem", date: "2023-08-05", reach: "280K" },
    ],
    narrative_opportunities: [
      "Integrity's work zone — direct restoration opportunity",
      "First Nations community displacement — land sovereignty & recovery",
      "Boreal carbon storage and the restoration imperative",
      "Planter crews working in fire-scarred landscapes",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "Our planters work in these forests. This is what 285,000 ha of fire means for Northern Ontario 🌲🔥", angle: "Insider field perspective", cta: "We plant into these scars" },
      { format: "Instagram Carousel", hook: "Before the fire vs. after the fire: Kenora's boreal forest", angle: "Before/after visual story", cta: "Meet the crew replanting it" },
      { format: "YouTube Script", hook: "I planted trees in the exact spot this fire burned. Here's what I found.", angle: "Personal witness account", cta: "Follow the restoration journey" },
      { format: "Substack", hook: "The Kenora fires burned through land our planters have spent years restoring", angle: "Ground-level field report", cta: "Read from the field" },
    ],
  },
  {
    id: "wf-2023-05",
    name: "Zama City — NE Alberta",
    year: 2023, month: 5,
    lat: 59.2, lng: -119.1,
    hectares: 43_200,
    intensity: "high",
    status: "extinguished",
    province: "Alberta",
    cause: "Human",
    restoration_potential: 72,
    integrity_relevance: "medium",
    timeline: [
      { date: "2023-05-04", event: "Fire ignition — dry lightning strike" },
      { date: "2023-05-09", event: "Evacuation orders for Zama City" },
      { date: "2023-05-17", event: "Fire controlled at 43,200 ha" },
    ],
    media_coverage: [
      { outlet: "Edmonton Journal", headline: "Zama City evacuation: NE Alberta fires burn 43,000 hectares", date: "2023-05-09", reach: "340K" },
    ],
    narrative_opportunities: [
      "Early-season fire signals earlier fire windows — climate signal",
      "Oil sands region fire risk meets boreal ecosystem fragility",
      "Community displacement and recovery in remote Alberta",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "This Alberta fire started May 4. Fire season is starting earlier every year. 🧵", angle: "Climate trend data", cta: "What earlier fires mean for reforestation" },
      { format: "Instagram Carousel", hook: "Early-season fire: Alberta's warning sign", angle: "Climate indicator story", cta: "See how we respond" },
      { format: "YouTube Script", hook: "Alberta's May wildfire — why early-season fires are the new normal", angle: "Climate science explainer", cta: "Subscribe for field updates" },
      { format: "Substack", hook: "When May becomes fire season, the entire reforestation calendar shifts", angle: "Industry analysis", cta: "Read the full impact report" },
    ],
  },
  {
    id: "wf-2024-01",
    name: "Parker Lake Complex — BC",
    year: 2024, month: 7,
    lat: 58.8, lng: -122.5,
    hectares: 155_000,
    intensity: "high",
    status: "contained",
    province: "British Columbia",
    cause: "Lightning",
    restoration_potential: 83,
    integrity_relevance: "high",
    timeline: [
      { date: "2024-07-08", event: "Ignition near Parker Lake, BC" },
      { date: "2024-07-22", event: "Rapid expansion — Fort Nelson area threatened" },
      { date: "2024-08-15", event: "Fire contained at 155,000 ha" },
    ],
    media_coverage: [
      { outlet: "Globe and Mail", headline: "BC wildfires: Fort Nelson under evacuation alert as flames advance", date: "2024-07-22", reach: "1.9M" },
    ],
    narrative_opportunities: [
      "2024 BC fire season — early-season ignitions trending",
      "Fort Nelson community at perpetual wildfire risk",
      "Boreal-to-temperate transition zone most vulnerable",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "2024 fire season started before the summer did. Fort Nelson on alert. 🧵", angle: "Real-time urgency", cta: "What the data tells us" },
      { format: "Instagram Carousel", hook: "Parker Lake Complex: 155,000 hectares and growing", angle: "Live satellite tracking", cta: "Follow for fire season updates" },
      { format: "YouTube Script", hook: "Tracking BC's 2024 fire season in real time — what changed?", angle: "Annual comparison", cta: "Subscribe for the full season debrief" },
      { format: "Substack", hook: "Fort Nelson has been under evacuation alert three years in a row now", angle: "Recurring crisis narrative", cta: "Read the pattern analysis" },
    ],
  },
  {
    id: "wf-2024-02",
    name: "Nagagami River Fires",
    year: 2024, month: 6,
    lat: 50.1, lng: -84.3,
    hectares: 67_500,
    intensity: "medium",
    status: "extinguished",
    province: "Ontario",
    cause: "Lightning",
    restoration_potential: 98,
    integrity_relevance: "critical",
    timeline: [
      { date: "2024-06-14", event: "Multiple ignitions in Nagagami region" },
      { date: "2024-06-28", event: "Fire merges into complex — 40,000 ha" },
      { date: "2024-07-20", event: "Fire extinguished — 67,500 ha total" },
    ],
    media_coverage: [
      { outlet: "CBC North", headline: "Northern Ontario fire season above average in Nagagami region", date: "2024-07-01", reach: "310K" },
    ],
    narrative_opportunities: [
      "Integrity's core operating territory — planters know this land",
      "Nagagami corridor connects multiple planting contracts",
      "Satellite-detected fire in Integrity's backyard",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "This fire burned in the exact forest where our crew plants trees 🌲 Real talk from the field 🧵", angle: "Raw authentic voice", cta: "Read what our lead planter said" },
      { format: "Instagram Carousel", hook: "Our forest burned. Here's what replanting 67,500 hectares actually looks like.", angle: "Mission documentation", cta: "Meet the crew" },
      { format: "YouTube Script", hook: "I planted trees here last year. This summer it burned. I went back.", angle: "Personal journey", cta: "Watch the full story" },
      { format: "Substack", hook: "When the forest you planted burns — a planter's perspective on fire and rebirth", angle: "Human story", cta: "Read from Nagagami" },
    ],
  },
  {
    id: "wf-2024-03",
    name: "Manitoba Peatland Fires",
    year: 2024, month: 5,
    lat: 54.8, lng: -100.2,
    hectares: 198_000,
    intensity: "high",
    status: "extinguished",
    province: "Manitoba",
    cause: "Lightning",
    restoration_potential: 69,
    integrity_relevance: "medium",
    timeline: [
      { date: "2024-05-19", event: "Peatland ignition near The Pas" },
      { date: "2024-06-05", event: "Peat fires extremely difficult to extinguish" },
      { date: "2024-07-08", event: "Fire declared out after significant rainfall" },
    ],
    media_coverage: [
      { outlet: "Winnipeg Free Press", headline: "Manitoba peat fires release stored carbon dating back 5,000 years", date: "2024-06-10", reach: "290K" },
    ],
    narrative_opportunities: [
      "Peatland fires release carbon accumulated over millennia — irreversible on human timescales",
      "Manitoba's carbon-dense north is increasingly at risk",
      "Peat restoration is the frontier of reforestation science",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "Peat fires burn carbon that's been stored since before the Roman Empire. Here's what that means 🧵", angle: "Deep time perspective", cta: "This is the carbon math no one wants to do" },
      { format: "Instagram Carousel", hook: "Manitoba's peatlands: 5,000 years of carbon released in one summer", angle: "Geological scale story", cta: "What restoration means here" },
      { format: "YouTube Script", hook: "The fires that burn underground — Manitoba's invisible wildfire crisis", angle: "Investigative science story", cta: "Subscribe for the deep dive" },
      { format: "Substack", hook: "Peat fires don't go out when the flame dies. They smoulder for months. Here's why that matters.", angle: "Science communication", cta: "Read the full analysis" },
    ],
  },
  {
    id: "wf-2025-01",
    name: "Pic River Basin Fire",
    year: 2025, month: 6,
    lat: 48.6, lng: -86.1,
    hectares: 112_000,
    intensity: "high",
    status: "active",
    province: "Ontario",
    cause: "Lightning",
    restoration_potential: 99,
    integrity_relevance: "critical",
    timeline: [
      { date: "2025-06-02", event: "Ignition detected via MODIS thermal anomaly" },
      { date: "2025-06-17", event: "Fire crosses 50,000 ha threshold" },
      { date: "2025-07-04", event: "Active — crews monitoring perimeter" },
    ],
    media_coverage: [
      { outlet: "CBC", headline: "Northern Ontario fires active near Pic River — crews monitoring", date: "2025-06-18", reach: "580K" },
    ],
    narrative_opportunities: [
      "ACTIVE fire in Integrity's operating zone — real-time narrative opportunity",
      "2025 fire season continues multi-year trend",
      "Pic Forest region — Integrity has active contracts here",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "🔴 LIVE: A fire is burning near our crew's planting site right now. Thread on what this means.", angle: "Real-time urgency", cta: "Follow for updates as this develops" },
      { format: "Instagram Carousel", hook: "🔴 Active: Pic River fire update from our crew in the field", angle: "Live field dispatch", cta: "Stories active — follow now" },
      { format: "YouTube Script", hook: "LIVE SITUATION: Northern Ontario fire season 2025 — update from our crew", angle: "Live field update", cta: "Subscribe for real-time fire coverage" },
      { format: "Substack", hook: "🔴 Field dispatch: The Pic River fire is burning near our planting sites. Here's what our crew is seeing.", angle: "On-the-ground dispatch", cta: "Get field dispatches direct to your inbox" },
    ],
  },
  {
    id: "wf-2025-02",
    name: "Lake Nipigon Complex",
    year: 2025, month: 7,
    lat: 49.8, lng: -88.5,
    hectares: 78_400,
    intensity: "medium",
    status: "active",
    province: "Ontario",
    cause: "Lightning",
    restoration_potential: 95,
    integrity_relevance: "critical",
    timeline: [
      { date: "2025-07-01", event: "Fire complex develops in Nipigon region" },
      { date: "2025-07-10", event: "Active — 78,400 ha and growing" },
    ],
    media_coverage: [
      { outlet: "MNRF", headline: "Lake Nipigon fire complex — aircraft support deployed", date: "2025-07-10", reach: "180K" },
    ],
    narrative_opportunities: [
      "Nipigon region — gateway to Ontario's boreal interior",
      "Trans-Canada corridor fire risk — infrastructure & ecosystem intersection",
      "Integrity's Nipigon planting contracts directly affected",
    ],
    content_suggestions: [
      { format: "X Thread", hook: "Fire at Lake Nipigon. We plant here. This is what it looks like 24 hours in. 🧵", angle: "Field transparency", cta: "Real talk from a planter" },
      { format: "Instagram Carousel", hook: "Lake Nipigon fire: what 78,000 ha of boreal burning looks like from the ground", angle: "Ground-level documentation", cta: "Follow for updates" },
      { format: "YouTube Script", hook: "Lake Nipigon is burning. We plant there. Here's our crew's response.", angle: "Mission activation story", cta: "Watch the full crew dispatch" },
      { format: "Substack", hook: "When your planting block becomes a burn scar: dispatch from Lake Nipigon", angle: "Intimate field narrative", cta: "Subscribe for dispatches from the field" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Map projection — Canada-focused
// Lat: 42°N – 84°N  |  Lng: −55°W – −142°W
// ─────────────────────────────────────────────────────────────────────────────

const MAP = { latMin: 42, latMax: 84, lngMin: -142, lngMax: -55 };

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MAP.lngMin) / (MAP.lngMax - MAP.lngMin)) * 100;
  const y = ((MAP.latMax - lat) / (MAP.latMax - MAP.latMin)) * 100;
  return { x, y };
}

// Scale fire circle size by hectares (log scale, capped)
function fireRadius(ha: number): number {
  return Math.min(Math.max(Math.log(ha / 1000) * 1.6 + 2, 2), 14);
}

// ─────────────────────────────────────────────────────────────────────────────
// Color maps
// ─────────────────────────────────────────────────────────────────────────────

const INTENSITY_COLORS: Record<FireIntensity, string> = {
  low:     "#fbbf24",
  medium:  "#f97316",
  high:    "#ef4444",
  extreme: "#ff1a1a",
};

const STATUS_GLOW: Record<FireStatus, string> = {
  active:      "#ff1a1a",
  contained:   "#f97316",
  extinguished:"#6b7280",
};

const RELEVANCE_RING: Record<string, string> = {
  critical: "#ff1a1a",
  high:     "#f97316",
  medium:   "#fbbf24",
  low:      "#6b7280",
};

// ─────────────────────────────────────────────────────────────────────────────
// Province outlines (simplified bounding polygons, SVG % coords)
// ─────────────────────────────────────────────────────────────────────────────

interface Province { id: string; label: string; points: string; x: number; y: number; }

function provincePoints(corners: [number, number][]): string {
  return corners.map(([lat, lng]) => {
    const { x, y } = project(lat, lng);
    return `${x},${y}`;
  }).join(" ");
}

const PROVINCES: Province[] = [
  {
    id: "bc", label: "BC",
    points: provincePoints([[49, -114], [49, -141], [60, -141], [60, -120], [60, -114]]),
    ...project(54.5, -127),
  },
  {
    id: "ab", label: "AB",
    points: provincePoints([[49, -110], [49, -114], [60, -114], [60, -110]]),
    ...project(54.5, -114.5),
  },
  {
    id: "sk", label: "SK",
    points: provincePoints([[49, -101.5], [49, -110], [60, -110], [60, -101.5]]),
    ...project(54, -106),
  },
  {
    id: "mb", label: "MB",
    points: provincePoints([[49, -95], [49, -101.5], [60, -101.5], [60, -95]]),
    ...project(54, -98.5),
  },
  {
    id: "on", label: "ON",
    points: provincePoints([[42, -74], [42, -84], [48, -84], [56, -90], [56, -80], [48, -74]]),
    ...project(50, -85),
  },
  {
    id: "qc", label: "QC",
    points: provincePoints([[45, -57], [45, -79], [62, -79], [62, -64], [52, -57]]),
    ...project(52, -70),
  },
  {
    id: "nwt", label: "NWT",
    points: provincePoints([[60, -101.5], [60, -141], [78, -141], [78, -101.5]]),
    ...project(67, -122),
  },
  {
    id: "yt", label: "YT",
    points: provincePoints([[60, -123], [60, -141], [70, -141], [70, -123]]),
    ...project(63, -135),
  },
  {
    id: "nu", label: "NU",
    points: provincePoints([[60, -61.5], [60, -101.5], [78, -101.5], [78, -61.5]]),
    ...project(68, -82),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Restoration opportunity zones — Integrity's active territory
// ─────────────────────────────────────────────────────────────────────────────

const RESTORATION_ZONES = [
  { id: "rz-01", name: "Kenora District", lat: 50.2, lng: -94.5, radius: 3 },
  { id: "rz-02", name: "Nagagami Corridor", lat: 50.1, lng: -84.3, radius: 2.5 },
  { id: "rz-03", name: "Pic Forest", lat: 48.6, lng: -86.0, radius: 2 },
  { id: "rz-04", name: "Ogoki Basin", lat: 51.5, lng: -86.2, radius: 2.5 },
  { id: "rz-05", name: "White River", lat: 48.6, lng: -85.3, radius: 1.5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Timeline data labels
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─────────────────────────────────────────────────────────────────────────────
// Helper — format hectares
// ─────────────────────────────────────────────────────────────────────────────

function fmtHa(ha: number): string {
  if (ha >= 1_000_000) return `${(ha / 1_000_000).toFixed(1)}M ha`;
  if (ha >= 1_000)     return `${(ha / 1_000).toFixed(0)}K ha`;
  return `${ha.toLocaleString()} ha`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content generation modal
// ─────────────────────────────────────────────────────────────────────────────

function ContentGenModal({ fire, onClose }: { fire: WildfireEvent; onClose: () => void }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const generate = async (suggestion: ContentSuggestion) => {
    setGenerating(suggestion.format);
    setError(null);
    try {
      const formatMap: Record<string, "reel" | "carousel" | "story"> = {
        "Instagram Carousel": "carousel",
        "YouTube Script": "reel",
        "X Thread": "reel",
        "Substack": "reel",
      };
      await createDraft({
        title: `${fire.name} — ${suggestion.format}`,
        format: formatMap[suggestion.format] ?? "carousel",
        metadata: {
          fire_id: fire.id,
          fire_name: fire.name,
          content_type: suggestion.format,
          hook: suggestion.hook,
          angle: suggestion.angle,
          cta: suggestion.cta,
          province: fire.province,
          hectares: fire.hectares,
          year: fire.year,
        },
      });
      setDone((prev) => new Set([...prev, suggestion.format]));
    } catch {
      setError(`Failed to create draft for ${suggestion.format}`);
    } finally {
      setGenerating(null);
    }
  };

  const FORMAT_ICONS: Record<string, string> = {
    "X Thread": "𝕏",
    "Instagram Carousel": "⊞",
    "YouTube Script": "▶",
    "Substack": "✍",
  };

  const FORMAT_COLORS: Record<string, string> = {
    "X Thread": "#1da1f2",
    "Instagram Carousel": "#e1306c",
    "YouTube Script": "#ff0000",
    "Substack": "#ff6719",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#0a1520] border border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-500/10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-orange-500/20 bg-gradient-to-r from-orange-950/40 to-transparent">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-orange-400/70 uppercase mb-0.5">Content Generation</div>
            <h3 className="text-sm font-bold text-white">{fire.name}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors text-lg">×</button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <p className="text-[11px] text-white/50 font-mono">
            {fmtHa(fire.hectares)} · {fire.province} · {fire.year} · Integrity relevance: <span className={`font-bold ${fire.integrity_relevance === "critical" ? "text-red-400" : "text-orange-400"}`}>{fire.integrity_relevance.toUpperCase()}</span>
          </p>

          {fire.content_suggestions.map((s) => {
            const isDone = done.has(s.format);
            const isGenerating = generating === s.format;
            return (
              <div key={s.format} className={`rounded-xl border p-3.5 transition-all ${isDone ? "border-emerald-500/30 bg-emerald-950/20" : "border-white/8 bg-white/3 hover:border-orange-500/30"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px]" style={{ color: FORMAT_COLORS[s.format] }}>{FORMAT_ICONS[s.format]}</span>
                      <span className="text-[11px] font-bold text-white">{s.format}</span>
                      {isDone && <span className="text-[9px] text-emerald-400 font-bold bg-emerald-900/40 px-1.5 py-0.5 rounded-full">✓ Draft created</span>}
                    </div>
                    <p className="text-[12px] text-white/80 font-medium leading-snug mb-1">"{s.hook}"</p>
                    <div className="flex gap-3 text-[10px] text-white/40">
                      <span>Angle: {s.angle}</span>
                      <span>CTA: {s.cta}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => generate(s)}
                    disabled={!!generating || isDone}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      isDone ? "bg-emerald-900/40 text-emerald-400 cursor-default" :
                      isGenerating ? "bg-orange-900/40 text-orange-300" :
                      "bg-orange-500/20 hover:bg-orange-500/40 text-orange-300 border border-orange-500/30"
                    } disabled:opacity-60`}
                  >
                    {isDone ? "✓ Done" : isGenerating ? (
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 border border-orange-400/50 border-t-orange-400 rounded-full animate-spin inline-block" />Gen...</span>
                    ) : "Generate"}
                  </button>
                </div>
              </div>
            );
          })}

          {error && <p className="text-[11px] text-red-400 font-mono">{error}</p>}
        </div>

        <div className="px-5 pb-4">
          <p className="text-[10px] text-white/25 font-mono">
            Generated drafts will appear in the Approval Queue for review and scheduling.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fire intelligence side panel
// ─────────────────────────────────────────────────────────────────────────────

function FirePanel({ fire, onClose, onGenerate }: { fire: WildfireEvent; onClose: () => void; onGenerate: () => void }) {
  const { x, y } = project(fire.lat, fire.lng);

  return (
    <div className="absolute inset-y-0 right-0 w-[360px] bg-[#060d14]/95 border-l border-orange-500/20 flex flex-col z-20 backdrop-blur-md shadow-2xl">
      {/* Panel header */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                fire.status === "active" ? "bg-red-500/20 text-red-400 animate-pulse" :
                fire.status === "contained" ? "bg-orange-500/20 text-orange-400" :
                "bg-gray-500/20 text-gray-400"
              }`}>
                {fire.status === "active" ? "🔴 ACTIVE" : fire.status === "contained" ? "🟠 CONTAINED" : "⬛ EXTINGUISHED"}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                fire.integrity_relevance === "critical" ? "bg-red-900/40 text-red-400" :
                fire.integrity_relevance === "high" ? "bg-orange-900/40 text-orange-400" :
                "bg-yellow-900/40 text-yellow-400"
              }`}>
                Integrity: {fire.integrity_relevance}
              </span>
            </div>
            <h3 className="text-[15px] font-bold text-white leading-tight">{fire.name}</h3>
            <p className="text-[11px] text-white/40 mt-0.5 font-mono">{fire.province} · {MONTHS[fire.month - 1]} {fire.year}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors text-base shrink-0">×</button>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Burned", value: fmtHa(fire.hectares), color: INTENSITY_COLORS[fire.intensity] },
            { label: "Intensity", value: fire.intensity.toUpperCase(), color: INTENSITY_COLORS[fire.intensity] },
            { label: "Restoration", value: `${fire.restoration_potential}%`, color: "#39de8b" },
          ].map((s) => (
            <div key={s.label} className="bg-white/3 rounded-xl p-2.5 text-center border border-white/5">
              <div className="text-[13px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] text-white/35 font-mono mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

        {/* Hectares burned visual bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wide">Scale</span>
            <span className="text-[10px] text-orange-400 font-mono">{fire.hectares.toLocaleString()} ha</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((fire.hectares / 6_000_000) * 100, 100)}%`,
                backgroundColor: INTENSITY_COLORS[fire.intensity],
                boxShadow: `0 0 8px ${INTENSITY_COLORS[fire.intensity]}80`,
              }}
            />
          </div>
          <div className="text-[9px] text-white/20 font-mono mt-0.5">vs 6M ha = 100%</div>
        </div>

        {/* Cause */}
        <div>
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wide mb-1.5">Cause</div>
          <div className="text-[12px] text-white/70 font-mono">{fire.cause}</div>
        </div>

        {/* Timeline */}
        <div>
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wide mb-2">Timeline</div>
          <div className="space-y-2">
            {fire.timeline.map((t, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 ${i === 0 ? "bg-red-500" : i === fire.timeline.length - 1 ? "bg-emerald-500" : "bg-orange-400"}`} />
                  {i < fire.timeline.length - 1 && <div className="w-px flex-1 bg-white/10 mt-0.5" />}
                </div>
                <div className="pb-2">
                  <div className="text-[10px] text-white/35 font-mono">{t.date}</div>
                  <div className="text-[11px] text-white/70 leading-snug">{t.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Media coverage */}
        <div>
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wide mb-2">Media Coverage</div>
          <div className="space-y-2">
            {fire.media_coverage.map((m, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-orange-400">{m.outlet}</span>
                  <span className="text-[9px] text-white/30 font-mono">{m.reach} reach</span>
                </div>
                <p className="text-[11px] text-white/60 leading-snug">"{m.headline}"</p>
                <div className="text-[9px] text-white/25 font-mono mt-1">{m.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Narrative opportunities */}
        <div>
          <div className="text-[10px] font-bold text-white/50 uppercase tracking-wide mb-2">Narrative Opportunities</div>
          <div className="space-y-1.5">
            {fire.narrative_opportunities.map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-white/65">
                <span className="text-emerald-400 mt-0.5 shrink-0 text-[10px]">◆</span>
                {n}
              </div>
            ))}
          </div>
        </div>

        {/* Coordinates */}
        <div className="pt-2 border-t border-white/5">
          <div className="text-[9px] text-white/20 font-mono">
            {fire.lat.toFixed(2)}°N · {Math.abs(fire.lng).toFixed(2)}°W · map pos ({x.toFixed(1)}%, {y.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Footer — generate content */}
      <div className="shrink-0 px-5 py-4 border-t border-white/5">
        <button
          onClick={onGenerate}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white text-[12px] font-bold transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40"
        >
          ⚡ Generate Content from this Fire
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main WildfireMap component
// ─────────────────────────────────────────────────────────────────────────────

export default function WildfireMap() {
  const [selectedYear, setSelectedYear]     = useState<2023 | 2024 | 2025 | "all">("all");
  const [selectedFire, setSelectedFire]     = useState<WildfireEvent | null>(null);
  const [showGenModal, setShowGenModal]     = useState(false);
  const [layers, setLayers]                 = useState<Set<FireLayer>>(new Set(["scars", "hotspots", "restoration"]));
  const [hoveredFireId, setHoveredFireId]   = useState<string | null>(null);
  const [timelineMonth, setTimelineMonth]   = useState<number | null>(null); // null = all months
  const svgRef = useRef<SVGSVGElement>(null);

  const toggleLayer = (layer: FireLayer) => {
    setLayers((prev) => {
      const next = new Set(prev);
      next.has(layer) ? next.delete(layer) : next.add(layer);
      return next;
    });
  };

  const visibleFires = useMemo(() => {
    return WILDFIRE_EVENTS.filter((f) => {
      if (selectedYear !== "all" && f.year !== selectedYear) return false;
      if (timelineMonth !== null && f.month !== timelineMonth) return false;
      return true;
    });
  }, [selectedYear, timelineMonth]);

  const totalHa = useMemo(() =>
    visibleFires.reduce((s, f) => s + f.hectares, 0),
    [visibleFires]
  );

  const activeFires = visibleFires.filter((f) => f.status === "active");

  // Pulse animation tick
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => (p + 1) % 60), 50);
    return () => clearInterval(id);
  }, []);
  const pulseScale = 1 + Math.sin(pulse / 10) * 0.3;

  const LAYERS: { key: FireLayer; label: string; color: string; icon: string }[] = [
    { key: "scars",       label: "Burn Scars",           color: "#f97316", icon: "◯" },
    { key: "hotspots",    label: "Active Hotspots",      color: "#ef4444", icon: "◉" },
    { key: "news",        label: "News Clusters",        color: "#fbbf24", icon: "◈" },
    { key: "restoration", label: "Restoration Zones",    color: "#39de8b", icon: "◍" },
  ];

  return (
    <div className="relative flex flex-col bg-[#050a0e] text-white overflow-hidden" style={{ height: "calc(100vh - 120px)", minHeight: 600 }}>

      {/* ── Top stats bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-px border-b border-orange-500/10 bg-[#07111a]">
        {/* System label */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-r border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-red-400 uppercase">Wildfire Intelligence</span>
          </div>
          <span className="text-[9px] text-white/20 font-mono">NASA FIRMS · MODIS · CWFIS · NOAA</span>
        </div>

        {/* Stat cells */}
        {[
          { label: "Total Area", value: fmtHa(totalHa), color: "#ef4444" },
          { label: "Events Tracked", value: visibleFires.length.toString(), color: "#f97316" },
          { label: "Active Now",  value: activeFires.length.toString(), color: "#ff1a1a", pulse: true },
          { label: "Integrity Zones", value: visibleFires.filter(f => f.integrity_relevance === "critical").length.toString(), color: "#fbbf24" },
          { label: "Restoration Ha", value: fmtHa(visibleFires.filter(f => f.integrity_relevance === "critical").reduce((s, f) => s + f.hectares, 0)), color: "#39de8b" },
        ].map((s) => (
          <div key={s.label} className="flex-1 px-3 py-2 border-r border-white/5 text-center">
            <div className={`text-[13px] font-bold font-mono ${s.pulse ? "animate-pulse" : ""}`} style={{ color: s.color }}>{s.value}</div>
            <div className="text-[8px] text-white/25 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}

        {/* Year selector */}
        <div className="flex items-center gap-1 px-3">
          {(["all", 2023, 2024, 2025] as const).map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                selectedYear === y
                  ? "bg-orange-500/30 text-orange-300 border border-orange-500/40"
                  : "text-white/25 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              {y === "all" ? "ALL" : y}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main map area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Layer controls sidebar */}
        <div className="shrink-0 w-[180px] border-r border-white/5 bg-[#07111a] flex flex-col">
          <div className="px-3 pt-3 pb-2 border-b border-white/5">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/30 uppercase">Map Layers</div>
          </div>
          <div className="flex-1 p-2 space-y-1">
            {LAYERS.map((l) => (
              <button
                key={l.key}
                onClick={() => toggleLayer(l.key)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all border ${
                  layers.has(l.key)
                    ? "border-white/10 bg-white/5 text-white"
                    : "border-transparent text-white/25 hover:text-white/50"
                }`}
              >
                <span style={{ color: layers.has(l.key) ? l.color : undefined }}>{l.icon}</span>
                {l.label}
              </button>
            ))}
          </div>

          {/* Month filter */}
          <div className="p-2 border-t border-white/5">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/30 uppercase mb-2 px-1">Month Filter</div>
            <div className="grid grid-cols-3 gap-0.5">
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setTimelineMonth(timelineMonth === i + 1 ? null : i + 1)}
                  className={`py-1 rounded text-[8px] font-bold transition-all ${
                    timelineMonth === i + 1
                      ? "bg-orange-500/30 text-orange-300"
                      : "text-white/20 hover:text-white/50 hover:bg-white/5"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {timelineMonth !== null && (
              <button onClick={() => setTimelineMonth(null)} className="w-full mt-1.5 text-[9px] text-white/30 hover:text-white/60 transition-colors">
                Clear
              </button>
            )}
          </div>

          {/* Fire legend */}
          <div className="p-2 border-t border-white/5 space-y-1.5">
            <div className="text-[9px] font-bold tracking-[0.2em] text-white/30 uppercase px-1">Intensity</div>
            {(["low", "medium", "high", "extreme"] as FireIntensity[]).map((lvl) => (
              <div key={lvl} className="flex items-center gap-2 px-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: INTENSITY_COLORS[lvl] }} />
                <span className="text-[9px] text-white/40 capitalize">{lvl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Map canvas */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            style={{ background: "radial-gradient(ellipse at 50% 60%, #071420 0%, #020810 100%)" }}
          >
            <defs>
              {/* Scan line effect */}
              <pattern id="scanlines" x="0" y="0" width="100" height="0.4" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(0,200,100,0.03)" strokeWidth="0.2" />
              </pattern>
              {/* Grid */}
              <pattern id="grid" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,200,100,0.06)" strokeWidth="0.15" />
              </pattern>
              {/* Glow filters */}
              <filter id="fire-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="0.8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="scar-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.6" />
              </filter>
            </defs>

            {/* Background fills */}
            <rect width="100" height="100" fill="url(#grid)" />
            <rect width="100" height="100" fill="url(#scanlines)" />

            {/* Ocean / land hint */}
            <rect width="100" height="100" fill="rgba(5,25,45,0.4)" rx="0" />

            {/* Province outlines */}
            {PROVINCES.map((p) => (
              <g key={p.id}>
                <polygon
                  points={p.points}
                  fill="rgba(20,50,80,0.15)"
                  stroke="rgba(0,180,100,0.12)"
                  strokeWidth="0.25"
                />
                <text
                  x={p.x} y={p.y}
                  textAnchor="middle"
                  fontSize="1.8"
                  fill="rgba(255,255,255,0.1)"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {p.label}
                </text>
              </g>
            ))}

            {/* Latitude lines */}
            {[50, 55, 60, 65, 70, 75].map((lat) => {
              const { y } = project(lat, -100);
              return (
                <g key={lat}>
                  <line x1="0" y1={y} x2="100" y2={y} stroke="rgba(0,200,150,0.06)" strokeWidth="0.15" strokeDasharray="0.5,1" />
                  <text x="0.5" y={y - 0.3} fontSize="1.2" fill="rgba(0,200,100,0.2)" fontFamily="monospace">{lat}°N</text>
                </g>
              );
            })}

            {/* Longitude lines */}
            {[-80, -90, -100, -110, -120, -130, -140].map((lng) => {
              const { x } = project(60, lng);
              return (
                <g key={lng}>
                  <line x1={x} y1="0" x2={x} y2="100" stroke="rgba(0,200,150,0.06)" strokeWidth="0.15" strokeDasharray="0.5,1" />
                  <text x={x + 0.3} y="98" fontSize="1.2" fill="rgba(0,200,100,0.2)" fontFamily="monospace">{Math.abs(lng)}°W</text>
                </g>
              );
            })}

            {/* ── Restoration zones (green rings) ── */}
            {layers.has("restoration") && RESTORATION_ZONES.map((rz) => {
              const { x, y } = project(rz.lat, rz.lng);
              return (
                <g key={rz.id}>
                  <circle cx={x} cy={y} r={rz.radius + 0.5} fill="rgba(57,222,139,0.04)" stroke="rgba(57,222,139,0.25)" strokeWidth="0.3" strokeDasharray="0.8,0.6" />
                  <circle cx={x} cy={y} r={0.6} fill="rgba(57,222,139,0.6)" />
                  <text x={x + 0.9} y={y + 0.4} fontSize="1.1" fill="rgba(57,222,139,0.5)" fontFamily="monospace">{rz.name}</text>
                </g>
              );
            })}

            {/* ── Burn scars (large translucent blobs) ── */}
            {layers.has("scars") && visibleFires.map((fire) => {
              const { x, y } = project(fire.lat, fire.lng);
              const r = fireRadius(fire.hectares);
              const col = INTENSITY_COLORS[fire.intensity];
              return (
                <ellipse
                  key={`scar-${fire.id}`}
                  cx={x} cy={y}
                  rx={r * 1.4} ry={r * 0.9}
                  fill={`${col}22`}
                  stroke={`${col}15`}
                  strokeWidth="0.2"
                  filter="url(#scar-blur)"
                />
              );
            })}

            {/* ── News clusters (yellow diamonds) ── */}
            {layers.has("news") && visibleFires
              .filter((f) => f.media_coverage.length > 0)
              .map((fire) => {
                const { x, y } = project(fire.lat, fire.lng);
                return (
                  <text
                    key={`news-${fire.id}`}
                    x={x + fireRadius(fire.hectares) + 0.5}
                    y={y - fireRadius(fire.hectares) - 0.5}
                    fontSize="2"
                    fill="#fbbf24"
                    opacity="0.7"
                  >
                    ◈
                  </text>
                );
              })
            }

            {/* ── Fire markers (interactive) ── */}
            {layers.has("hotspots") && visibleFires.map((fire) => {
              const { x, y } = project(fire.lat, fire.lng);
              const r = fireRadius(fire.hectares);
              const col = INTENSITY_COLORS[fire.intensity];
              const glow = STATUS_GLOW[fire.status];
              const ring = RELEVANCE_RING[fire.integrity_relevance];
              const isSelected = selectedFire?.id === fire.id;
              const isHovered  = hoveredFireId === fire.id;
              const isActive   = fire.status === "active";
              const scale      = isActive ? pulseScale : 1;

              return (
                <g
                  key={fire.id}
                  transform={`translate(${x},${y})`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedFire(selectedFire?.id === fire.id ? null : fire)}
                  onMouseEnter={() => setHoveredFireId(fire.id)}
                  onMouseLeave={() => setHoveredFireId(null)}
                >
                  {/* Outer relevance ring */}
                  {(isSelected || isHovered) && (
                    <circle r={r + 2.5} fill="none" stroke={ring} strokeWidth="0.4" opacity="0.6" />
                  )}

                  {/* Pulse ring for active */}
                  {isActive && (
                    <circle r={r * scale + 1} fill="none" stroke={glow} strokeWidth="0.3" opacity={0.3 / scale} />
                  )}

                  {/* Burn scar inner */}
                  <circle r={r} fill={`${col}55`} stroke={col} strokeWidth={isSelected ? 0.5 : 0.25} filter="url(#fire-glow)" />

                  {/* Active hotspot indicator */}
                  {isActive && (
                    <circle r={r * 0.35} fill="#ff1a1a" opacity="0.9" />
                  )}

                  {/* Integrity critical marker */}
                  {fire.integrity_relevance === "critical" && !isActive && (
                    <circle r={r * 0.25} fill="#fbbf24" opacity="0.8" />
                  )}

                  {/* Hover tooltip */}
                  {isHovered && (
                    <g transform={`translate(${r + 1}, ${-r - 1})`}>
                      <rect x="0" y="-3.5" width={fire.name.length * 1.1 + 2} height="4.5" rx="0.6" fill="rgba(5,15,25,0.95)" stroke="rgba(255,120,0,0.4)" strokeWidth="0.2" />
                      <text x="1" y="-1" fontSize="1.5" fill="white" fontFamily="monospace" fontWeight="bold">{fire.name}</text>
                      <text x="1" y="0.5" fontSize="1.2" fill="#f97316" fontFamily="monospace">{fmtHa(fire.hectares)} · {fire.year}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Compass rose */}
            <g transform="translate(3,4)">
              <text x="0" y="0" fontSize="1.5" fill="rgba(0,200,100,0.3)" fontFamily="monospace">N</text>
              <line x1="0.75" y1="0.3" x2="0.75" y2="2.5" stroke="rgba(0,200,100,0.3)" strokeWidth="0.2" />
              <polygon points="0.75,0.3 0.3,2.5 0.75,2.2 1.2,2.5" fill="rgba(0,200,100,0.4)" />
            </g>

            {/* Data attribution */}
            <text x="0.5" y="99" fontSize="1" fill="rgba(255,255,255,0.1)" fontFamily="monospace">
              NASA FIRMS · MODIS · CWFIS · NOAA Fire Detection
            </text>
          </svg>

          {/* Empty state when no fires match */}
          {visibleFires.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-2xl text-white/10 mb-2">◯</div>
                <div className="text-[12px] text-white/20">No fires match current filters</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Fire intelligence panel ── */}
        {selectedFire && (
          <FirePanel
            fire={selectedFire}
            onClose={() => setSelectedFire(null)}
            onGenerate={() => setShowGenModal(true)}
          />
        )}
      </div>

      {/* ── Timeline slider ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/5 bg-[#07111a] px-4 py-2.5">
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-bold tracking-[0.2em] text-white/30 uppercase shrink-0">Timeline</span>

          {/* Year breakdown */}
          <div className="flex-1 flex items-center gap-1">
            {([2023, 2024, 2025] as const).map((yr) => {
              const yearFires = WILDFIRE_EVENTS.filter((f) => f.year === yr);
              const yearHa = yearFires.reduce((s, f) => s + f.hectares, 0);
              const pct = Math.min((yearHa / 18_000_000) * 100, 100);
              return (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(selectedYear === yr ? "all" : yr)}
                  className={`flex-1 group transition-all ${selectedYear === yr || selectedYear === "all" ? "opacity-100" : "opacity-30"}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-bold text-white/50 font-mono">{yr}</span>
                    <span className="text-[9px] text-orange-400 font-mono">{fmtHa(yearHa)}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: yr === 2023 ? "#ef4444" : yr === 2024 ? "#f97316" : "#fbbf24",
                      }}
                    />
                  </div>
                  <div className="text-[8px] text-white/20 mt-0.5 font-mono">{yearFires.length} fires</div>
                </button>
              );
            })}
          </div>

          {/* Active / selected state */}
          <div className="shrink-0 text-right">
            {selectedFire ? (
              <div>
                <div className="text-[9px] text-orange-400 font-mono font-bold">{selectedFire.name}</div>
                <div className="text-[9px] text-white/30 font-mono">{fmtHa(selectedFire.hectares)} · Click map to deselect</div>
              </div>
            ) : (
              <div className="text-[9px] text-white/20 font-mono">Click a fire to open intel panel</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content generation modal ── */}
      {showGenModal && selectedFire && (
        <ContentGenModal fire={selectedFire} onClose={() => setShowGenModal(false)} />
      )}
    </div>
  );
}
