// Shared types for the reel editor components

export interface ClipTrim {
  inPoint: number;
  outPoint: number | null;
}

export interface ClipEffects {
  brightness: number; // 0-200, default 100
  contrast: number;   // 0-200, default 100
  saturation: number; // 0-200, default 100
  zoom: number;       // 100-200, default 100 (percentage)
  panX: number;       // -50 to 50, default 0 (percentage offset from center)
  panY: number;       // -50 to 50, default 0 (percentage offset from center)
  hueRotate: number;  // -180 to 180 degrees, default 0
  sepia: number;      // 0-100, default 0 (warm film toning)
}

export const DEFAULT_EFFECTS: ClipEffects = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  zoom: 100,
  panX: 0,
  panY: 0,
  hueRotate: 0,
  sepia: 0,
};

// ── Cinematic filter presets tailored for Integrity Reforestation content ─────
export interface FilterPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Visual palette swatch (two-stop gradient) */
  gradient: string;
  effects: ClipEffects;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "integrity-green",
    name: "Integrity Green",
    emoji: "🌿",
    description: "Brand signature — rich forest teal, lifted greens",
    gradient: "linear-gradient(135deg, #1a4a3a 0%, #39de8b 100%)",
    effects: { brightness: 107, contrast: 108, saturation: 122, hueRotate: -10, sepia: 0, zoom: 100, panX: 0, panY: 0 },
  },
  {
    id: "wildfire",
    name: "Wildfire",
    emoji: "🔥",
    description: "High-contrast near-mono for burned zones & dramatic landscapes",
    gradient: "linear-gradient(135deg, #1a1005 0%, #c07020 100%)",
    effects: { brightness: 94, contrast: 138, saturation: 52, hueRotate: 8, sepia: 22, zoom: 100, panX: 0, panY: 0 },
  },
  {
    id: "golden-field",
    name: "Golden Field",
    emoji: "☀️",
    description: "Warm sunlit energy for crew action & helicopter shots",
    gradient: "linear-gradient(135deg, #7a4f10 0%, #fbb700 100%)",
    effects: { brightness: 112, contrast: 104, saturation: 112, hueRotate: 10, sepia: 28, zoom: 100, panX: 0, panY: 0 },
  },
  {
    id: "camp-social",
    name: "Camp Social",
    emoji: "🏕️",
    description: "Amber campfire warmth for crew bonding & camp-life moments",
    gradient: "linear-gradient(135deg, #4a1a00 0%, #e06830 100%)",
    effects: { brightness: 113, contrast: 94, saturation: 82, hueRotate: 18, sepia: 42, zoom: 100, panX: 0, panY: 0 },
  },
  {
    id: "northern-grit",
    name: "Northern Grit",
    emoji: "🪨",
    description: "Cool desaturated documentary — BTS, equipment, headshots",
    gradient: "linear-gradient(135deg, #1a2030 0%, #8090a8 100%)",
    effects: { brightness: 100, contrast: 122, saturation: 58, hueRotate: 4, sepia: 4, zoom: 100, panX: 0, panY: 0 },
  },
];

export interface TextOverlay {
  id: string;
  text: string;
  x: number;         // percentage 0-100
  y: number;         // percentage 0-100
  width?: number;    // percentage of canvas width (10-100), defaults to 80
  fontSize: number;
  fontFamily: string;
  fontWeight: "400" | "700" | "900";
  color: string;
  opacity: number;
  textAlign: "left" | "center" | "right";
  rotation: number;
  dropShadow: boolean;
  bgStyle: "none" | "pill" | "block";
  bgColor: string;
  startTime: number; // seconds (global timeline)
  endTime: number;   // seconds (global timeline)
}

export interface Caption {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  style: "default" | "bold" | "highlight" | "subtitle";
}

export const CAPTION_STYLES: Record<Caption["style"], { label: string; className: string; previewClass: string }> = {
  default: {
    label: "Default",
    className: "bg-surface-secondary text-text-secondary",
    previewClass: "bg-black/70 text-white text-sm px-3 py-1.5 rounded-lg",
  },
  bold: {
    label: "Bold",
    className: "bg-amber-50 text-amber-700",
    previewClass: "bg-black/80 text-white text-base font-bold px-4 py-2 rounded-lg uppercase tracking-wide",
  },
  highlight: {
    label: "Highlight",
    className: "bg-emerald-50 text-emerald-700",
    previewClass: "bg-[#39de8b] text-[#002a27] text-base font-bold px-4 py-2 rounded-lg",
  },
  subtitle: {
    label: "Subtitle",
    className: "bg-blue-50 text-blue-700",
    previewClass: "bg-black/60 text-white/90 text-xs px-3 py-1 rounded backdrop-blur-sm",
  },
};

export const BRAND_FONTS = [
  { label: "Noto Sans", value: "'Noto Sans', sans-serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "System", value: "system-ui, sans-serif" },
] as const;

export const BRAND_COLORS = [
  { label: "Forest Teal", value: "#002a27" },
  { label: "Bright Green", value: "#39de8b" },
  { label: "Forest Green", value: "#348050" },
  { label: "Gold", value: "#fbb700" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
] as const;

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
}

export function parseTime(str: string): number {
  const parts = str.split(":");
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(str) || 0;
}
