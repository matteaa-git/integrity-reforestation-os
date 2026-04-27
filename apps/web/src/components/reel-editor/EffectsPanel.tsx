"use client";

import type { ClipEffects } from "./types";
import { DEFAULT_EFFECTS, FILTER_PRESETS } from "./types";

interface EffectsPanelProps {
  effects: ClipEffects;
  onChange: (effects: ClipEffects) => void;
}

const EFFECT_CONTROLS = [
  { key: "brightness" as const, label: "Brightness", icon: "☀", min: 0, max: 200, unit: "%" },
  { key: "contrast" as const, label: "Contrast", icon: "◐", min: 0, max: 200, unit: "%" },
  { key: "saturation" as const, label: "Saturation", icon: "◉", min: 0, max: 200, unit: "%" },
  { key: "hueRotate" as const, label: "Warmth/Cool", icon: "🎨", min: -40, max: 40, unit: "°" },
  { key: "sepia" as const, label: "Film Tone", icon: "✦", min: 0, max: 80, unit: "%" },
  { key: "zoom" as const, label: "Zoom", icon: "⊕", min: 100, max: 200, unit: "%" },
  { key: "panX" as const, label: "Pan X", icon: "↔", min: -50, max: 50, unit: "" },
  { key: "panY" as const, label: "Pan Y", icon: "↕", min: -50, max: 50, unit: "" },
] as const;

function filterCss(e: ClipEffects): string {
  return [
    e.brightness !== 100 && `brightness(${e.brightness / 100})`,
    e.contrast !== 100 && `contrast(${e.contrast / 100})`,
    e.saturation !== 100 && `saturate(${e.saturation / 100})`,
    e.hueRotate && `hue-rotate(${e.hueRotate}deg)`,
    e.sepia && `sepia(${e.sepia / 100})`,
  ].filter(Boolean).join(" ") || "none";
}

export default function EffectsPanel({ effects, onChange }: EffectsPanelProps) {
  const isDefault = Object.entries(DEFAULT_EFFECTS).every(
    ([key, val]) => effects[key as keyof ClipEffects] === val
  );

  const activePresetId = FILTER_PRESETS.find(
    (p) =>
      p.effects.brightness === effects.brightness &&
      p.effects.contrast === effects.contrast &&
      p.effects.saturation === effects.saturation &&
      p.effects.hueRotate === effects.hueRotate &&
      p.effects.sepia === effects.sepia
  )?.id ?? null;

  return (
    <div className="space-y-4">

      {/* ── Filter Presets ── */}
      <div>
        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-2">Presets</p>
        <div className="grid grid-cols-1 gap-1.5">
          {FILTER_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onChange({ ...effects, ...preset.effects })}
                className={[
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all text-left border",
                  isActive
                    ? "border-primary/50 bg-primary/6 shadow-sm"
                    : "border-border/50 hover:border-primary/30 hover:bg-white/50",
                ].join(" ")}
              >
                {/* Gradient swatch */}
                <div
                  className="w-8 h-8 rounded-lg shrink-0 shadow-sm border border-white/20"
                  style={{ background: preset.gradient, filter: filterCss(preset.effects) }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-text-primary">{preset.emoji} {preset.name}</span>
                    {isActive && (
                      <span className="text-[8px] font-bold uppercase text-primary bg-primary/10 px-1 py-0.5 rounded">Active</span>
                    )}
                  </div>
                  <p className="text-[9px] text-text-tertiary leading-snug truncate mt-0.5">{preset.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* None / Reset preset */}
        {!isDefault && (
          <button
            onClick={() => onChange({ ...DEFAULT_EFFECTS })}
            className="mt-1.5 w-full text-[10px] font-medium text-text-tertiary hover:text-text-secondary py-1.5 rounded-xl border border-border/50 hover:border-border hover:bg-white/40 transition-colors"
          >
            ✕ Remove filter
          </button>
        )}
      </div>

      {/* ── Fine-tune sliders ── */}
      <div>
        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-2">Fine-tune</p>
        <div className="space-y-3">
          {EFFECT_CONTROLS.map(({ key, label, icon, min, max, unit }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-text-secondary flex items-center gap-1">
                  <span className="text-[9px]">{icon}</span> {label}
                </span>
                <span className="text-[10px] text-text-tertiary font-mono">{effects[key]}{unit}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                value={effects[key]}
                onChange={(e) => onChange({ ...effects, [key]: Number(e.target.value) })}
                className="w-full h-1.5 accent-primary"
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
