"use client";

import { useState, useEffect } from "react";
import type { TextLayer } from "./TextOverlay";

// ---------------------------------------------------------------------------
// Story Template types
// ---------------------------------------------------------------------------
export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  palette: string[]; // preview swatches
  layers: Omit<TextLayer, "id">[];
}

// ---------------------------------------------------------------------------
// 5 Integrity Reforestation story templates
// Colors: #002a27 Forest Teal · #39de8b Bright Green · #348050 Forest Green
//         #fbb700 Gold · #ffffff White · #000000 Black
// Fonts:  'Noto Sans' (headlines) · 'Inter' (body/caption)
// ---------------------------------------------------------------------------
export const STORY_TEMPLATES: StoryTemplate[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. IMPACT ANNOUNCEMENT
  // Bold mission statement for planting milestones and campaign launches.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "impact-announcement",
    name: "Impact Announcement",
    description: "Bold headline + stat callout for milestone moments",
    palette: ["#002a27", "#39de8b", "#fbb700", "#ffffff"],
    layers: [
      // eyebrow label – top left
      {
        text: "INTEGRITY REFORESTATION",
        x: 50,
        y: 10,
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "700",
        color: "#39de8b",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: false,
        bgStyle: "pill",
        bgColor: "#002a27",
        preset: "caption",
      },
      // headline
      {
        text: "PLANTING\nTHE FUTURE",
        x: 50,
        y: 40,
        fontSize: 56,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "900",
        color: "#ffffff",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "headline",
      },
      // gold stat
      {
        text: "1,000 TREES",
        x: 50,
        y: 62,
        fontSize: 38,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "900",
        color: "#fbb700",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "subheadline",
      },
      // caption
      {
        text: "California Wildfire Reforestation",
        x: 50,
        y: 72,
        fontSize: 15,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "400",
        color: "#ffffff",
        opacity: 0.85,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#000000",
        preset: "caption",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. VOLUNTEER RECRUIT
  // Recruitment-focused with gold urgency accent and CTA pill.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "volunteer-recruit",
    name: "Volunteer Recruit",
    description: "Recruitment call-to-action with urgency and apply CTA",
    palette: ["#fbb700", "#002a27", "#39de8b", "#ffffff"],
    layers: [
      // urgent eyebrow
      {
        text: "NOW HIRING",
        x: 50,
        y: 14,
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "700",
        color: "#002a27",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: false,
        bgStyle: "pill",
        bgColor: "#fbb700",
        preset: "caption",
      },
      // headline
      {
        text: "JOIN THE\nMISSION",
        x: 50,
        y: 38,
        fontSize: 58,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "900",
        color: "#ffffff",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "headline",
      },
      // subheadline
      {
        text: "Tree Planters Needed",
        x: 50,
        y: 58,
        fontSize: 24,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "700",
        color: "#39de8b",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "subheadline",
      },
      // CTA button pill
      {
        text: "APPLY NOW →",
        x: 50,
        y: 82,
        fontSize: 16,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "700",
        color: "#ffffff",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: false,
        bgStyle: "pill",
        bgColor: "#348050",
        preset: "cta",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. FIELD UPDATE
  // Documentary / behind-the-scenes dispatch style.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "field-update",
    name: "Field Update",
    description: "Documentary dispatch with location tag and day counter",
    palette: ["#002a27", "#ffffff", "#39de8b", "#fbb700"],
    layers: [
      // location tag – top left
      {
        text: "📍 SIERRA NEVADA, CA",
        x: 16,
        y: 14,
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "700",
        color: "#ffffff",
        opacity: 1,
        textAlign: "left",
        rotation: 0,
        dropShadow: false,
        bgStyle: "block",
        bgColor: "#002a27",
        preset: "caption",
      },
      // day counter
      {
        text: "DAY 14\nIN THE FIELD",
        x: 50,
        y: 45,
        fontSize: 48,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "900",
        color: "#ffffff",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "headline",
      },
      // subheadline green
      {
        text: "Restoring what the fire took",
        x: 50,
        y: 64,
        fontSize: 20,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "700",
        color: "#39de8b",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "subheadline",
      },
      // brand mark – bottom right
      {
        text: "integrity-reforestation.com",
        x: 72,
        y: 91,
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "400",
        color: "#ffffff",
        opacity: 0.7,
        textAlign: "right",
        rotation: 0,
        dropShadow: false,
        bgStyle: "none",
        bgColor: "#000000",
        preset: "caption",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. MISSION QUOTE
  // Inspirational brand-voice quote card.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "mission-quote",
    name: "Mission Quote",
    description: "Centered quote card with brand attribution",
    palette: ["#fbb700", "#ffffff", "#39de8b", "#002a27"],
    layers: [
      // opening quote mark
      {
        text: "\u201C",
        x: 50,
        y: 24,
        fontSize: 96,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "900",
        color: "#fbb700",
        opacity: 0.9,
        textAlign: "center",
        rotation: 0,
        dropShadow: false,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "headline",
      },
      // quote body
      {
        text: "Every tree is a promise\nkept to the land.",
        x: 50,
        y: 50,
        fontSize: 28,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "700",
        color: "#ffffff",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "headline",
      },
      // attribution
      {
        text: "— Integrity Reforestation",
        x: 50,
        y: 68,
        fontSize: 16,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "400",
        color: "#39de8b",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "subheadline",
      },
      // org mark
      {
        text: "integrity-reforestation.com",
        x: 50,
        y: 91,
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "400",
        color: "#ffffff",
        opacity: 0.6,
        textAlign: "center",
        rotation: 0,
        dropShadow: false,
        bgStyle: "none",
        bgColor: "#000000",
        preset: "caption",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SWIPE UP CTA
  // Final story slide driving traffic — link + swipe action.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "swipe-up-cta",
    name: "Swipe Up CTA",
    description: "Last-frame link driver — restore, apply, learn more",
    palette: ["#39de8b", "#002a27", "#ffffff", "#fbb700"],
    layers: [
      // green headline
      {
        text: "RESTORE\nWITH US",
        x: 50,
        y: 32,
        fontSize: 60,
        fontFamily: "'Noto Sans', sans-serif",
        fontWeight: "900",
        color: "#39de8b",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#002a27",
        preset: "headline",
      },
      // body
      {
        text: "Join our crew planting trees\nacross California\u2019s fire zones.",
        x: 50,
        y: 55,
        fontSize: 18,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "400",
        color: "#ffffff",
        opacity: 0.92,
        textAlign: "center",
        rotation: 0,
        dropShadow: true,
        bgStyle: "none",
        bgColor: "#000000",
        preset: "caption",
      },
      // swipe pill
      {
        text: "SWIPE UP TO APPLY \u2191",
        x: 50,
        y: 75,
        fontSize: 15,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "700",
        color: "#002a27",
        opacity: 1,
        textAlign: "center",
        rotation: 0,
        dropShadow: false,
        bgStyle: "pill",
        bgColor: "#39de8b",
        preset: "cta",
      },
      // url
      {
        text: "integrity-reforestation.com",
        x: 50,
        y: 88,
        fontSize: 12,
        fontFamily: "'Inter', sans-serif",
        fontWeight: "400",
        color: "#ffffff",
        opacity: 0.65,
        textAlign: "center",
        rotation: 0,
        dropShadow: false,
        bgStyle: "none",
        bgColor: "#000000",
        preset: "caption",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Custom template persistence (localStorage)
// ---------------------------------------------------------------------------
export interface CustomStoryTemplate extends StoryTemplate {
  createdAt: string; // ISO string
}

const STORAGE_KEY = "ir_custom_story_templates";

export function loadCustomTemplates(): CustomStoryTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomStoryTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(tpl: CustomStoryTemplate): void {
  const existing = loadCustomTemplates();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, tpl]));
}

export function deleteCustomTemplate(id: string): void {
  const updated = loadCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// Derive a palette preview from a set of text layers (up to 4 unique colors)
function paletteFromLayers(layers: Omit<TextLayer, "id">[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of layers) {
    if (!seen.has(l.color)) { seen.add(l.color); out.push(l.color); }
    if (out.length >= 4) break;
  }
  return out.length ? out : ["#002a27"];
}

// ---------------------------------------------------------------------------
// Shared template card component
// ---------------------------------------------------------------------------
interface TemplateCardProps {
  tpl: StoryTemplate;
  onApply: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}

function TemplateCard({ tpl, onApply, onDelete, disabled }: TemplateCardProps) {
  return (
    <div className="rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all p-3 group">
      {/* Palette swatches */}
      <div className="flex gap-1 mb-2">
        {tpl.palette.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className="w-4 h-4 rounded-full border border-white/30 shadow-sm"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="text-[11px] font-semibold text-text-primary group-hover:text-primary transition-colors leading-tight">
        {tpl.name}
      </div>
      <div className="text-[10px] text-text-tertiary mt-0.5 leading-snug">
        {tpl.description}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-medium text-text-tertiary bg-surface-secondary px-1.5 py-0.5 rounded-md">
          {tpl.layers.length} text layer{tpl.layers.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-1">
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-[9px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
              title="Delete template"
            >
              Delete
            </button>
          )}
          <button
            disabled={disabled}
            onClick={onApply}
            className="text-[9px] font-semibold text-white bg-primary hover:bg-primary/90 px-2 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Picker Panel
// ---------------------------------------------------------------------------
interface TemplatePickerPanelProps {
  currentLayers: TextLayer[];
  onApply: (layers: Omit<TextLayer, "id">[]) => void;
  disabled?: boolean;
}

export function TemplatePickerPanel({ currentLayers, onApply, disabled }: TemplatePickerPanelProps) {
  const [customTemplates, setCustomTemplates] = useState<CustomStoryTemplate[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
  }, []);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) { setSaveError("Enter a name"); return; }
    if (currentLayers.length === 0) { setSaveError("Add text layers to the frame first"); return; }

    setSaving(true);
    setSaveError(null);

    const tpl: CustomStoryTemplate = {
      id: crypto.randomUUID(),
      name,
      description: `${currentLayers.length} text layer${currentLayers.length !== 1 ? "s" : ""} · custom`,
      palette: paletteFromLayers(currentLayers),
      // strip the `id` from each layer so the template stores position/style only
      layers: currentLayers.map(({ id: _id, ...rest }) => rest),
      createdAt: new Date().toISOString(),
    };

    saveCustomTemplate(tpl);
    setCustomTemplates(loadCustomTemplates());
    setSaveName("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = (id: string) => {
    deleteCustomTemplate(id);
    setCustomTemplates(loadCustomTemplates());
  };

  return (
    <div className="p-3 space-y-4">

      {/* ── Save current frame as template ── */}
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-3 space-y-2">
        <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
          Save Current Frame
        </div>
        <p className="text-[10px] text-text-tertiary leading-relaxed">
          Captures all text layers on the active frame as a reusable template.
        </p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={saveName}
            onChange={(e) => { setSaveName(e.target.value); setSaveError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Template name…"
            className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-0"
          />
          <button
            onClick={handleSave}
            disabled={saving || currentLayers.length === 0}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
        {saveError && <p className="text-[10px] text-red-500">{saveError}</p>}
        {currentLayers.length === 0 && (
          <p className="text-[10px] text-text-tertiary/70">No text layers on this frame yet.</p>
        )}
      </div>

      {/* ── Custom templates ── */}
      {customTemplates.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
            My Templates ({customTemplates.length})
          </div>
          {customTemplates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              disabled={disabled}
              onApply={() => onApply(tpl.layers)}
              onDelete={() => handleDelete(tpl.id)}
            />
          ))}
        </div>
      )}

      {/* ── Built-in templates ── */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">
          Built-in Templates
        </div>
        {STORY_TEMPLATES.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            tpl={tpl}
            disabled={disabled}
            onApply={() => onApply(tpl.layers)}
          />
        ))}
      </div>
    </div>
  );
}
