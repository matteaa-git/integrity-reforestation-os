"use client";

import { useEffect, useState } from "react";
import type { PhotoEdits, PhotoPreset } from "./photoEdits";
import {
  DEFAULT_PHOTO_EDITS, isDefaultEdits,
  loadPresets, savePreset, deletePreset,
} from "./photoEdits";

interface Props {
  edits: PhotoEdits;
  onChange: (edits: PhotoEdits) => void;
}

type Section = "light" | "color" | "detail";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "light",  label: "Light"  },
  { key: "color",  label: "Color"  },
  { key: "detail", label: "Detail" },
];

const CONTROLS: { key: keyof PhotoEdits; label: string; min: number; max: number; section: Section; unit: string }[] = [
  { key: "exposure",       label: "Exposure",        min: -100, max: 100, section: "light",  unit: "" },
  { key: "brilliance",     label: "Brilliance",      min: -100, max: 100, section: "light",  unit: "" },
  { key: "highlights",     label: "Highlights",      min: -100, max: 100, section: "light",  unit: "" },
  { key: "shadows",        label: "Shadows",         min: -100, max: 100, section: "light",  unit: "" },
  { key: "contrast",       label: "Contrast",        min: -100, max: 100, section: "light",  unit: "" },
  { key: "blackPoint",     label: "Black Point",     min: -100, max: 100, section: "light",  unit: "" },
  { key: "saturation",     label: "Saturation",      min: -100, max: 100, section: "color",  unit: "" },
  { key: "vibrance",       label: "Vibrance",        min: -100, max: 100, section: "color",  unit: "" },
  { key: "warmth",         label: "Warmth",          min: -100, max: 100, section: "color",  unit: "" },
  { key: "tint",           label: "Tint",            min: -100, max: 100, section: "color",  unit: "" },
  { key: "sharpness",      label: "Sharpness",       min:    0, max: 100, section: "detail", unit: "" },
  { key: "definition",     label: "Definition",      min: -100, max: 100, section: "detail", unit: "" },
  { key: "noiseReduction", label: "Noise Reduction", min:    0, max: 100, section: "detail", unit: "" },
  { key: "vignette",       label: "Vignette",        min:    0, max: 100, section: "detail", unit: "" },
];

export default function PhotoEditPanel({ edits, onChange }: Props) {
  const [section, setSection] = useState<Section>("light");
  const [presets, setPresets] = useState<PhotoPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => { setPresets(loadPresets()); }, []);

  const sectionControls = CONTROLS.filter((c) => c.section === section);
  const isDefault = isDefaultEdits(edits);
  const hasChanges = !isDefault;

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const updated = savePreset(name, edits);
    setPresets(updated);
    setPresetName("");
    setShowSaveForm(false);
  };

  const handleDeletePreset = (id: string) => {
    setPresets(deletePreset(id));
  };

  return (
    <div className="space-y-4">

      {/* Presets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">Presets</span>
          {hasChanges && (
            <button
              onClick={() => setShowSaveForm((v) => !v)}
              className="text-[10px] font-semibold text-primary hover:text-primary-dark transition-colors"
            >
              {showSaveForm ? "Cancel" : "+ Save"}
            </button>
          )}
        </div>

        {showSaveForm && (
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              placeholder="Preset name…"
              autoFocus
              className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold disabled:opacity-40 transition-opacity"
            >
              Save
            </button>
          </div>
        )}

        {presets.length === 0 && !showSaveForm && (
          <p className="text-[10px] text-text-tertiary italic">
            No presets saved. Adjust settings then click + Save.
          </p>
        )}

        {presets.length > 0 && (
          <div className="space-y-1">
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 hover:border-primary/30 px-3 py-2 group transition-colors"
              >
                <button
                  className="flex-1 text-left text-[11px] font-medium text-text-primary hover:text-primary transition-colors"
                  onClick={() => onChange({ ...edits, ...p.edits })}
                >
                  {p.name}
                </button>
                <button
                  onClick={() => handleDeletePreset(p.id)}
                  className="text-[10px] text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-danger transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={[
              "flex-1 py-2 text-[10px] font-semibold transition-colors",
              section === s.key
                ? "bg-primary text-white"
                : "text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        {sectionControls.map(({ key, label, min, max }) => {
          const val = edits[key];
          const isChanged = val !== DEFAULT_PHOTO_EDITS[key];
          const midpoint = (min + max) / 2;
          const pct = ((val - min) / (max - min)) * 100;
          const midPct = ((midpoint - min) / (max - min)) * 100;

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-medium flex items-center gap-1 ${isChanged ? "text-primary" : "text-text-secondary"}`}>
                  {isChanged && <span className="w-1 h-1 rounded-full bg-primary" />}
                  {label}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-tertiary font-mono w-8 text-right">{val > 0 ? `+${val}` : val}</span>
                  {isChanged && (
                    <button
                      onClick={() => onChange({ ...edits, [key]: DEFAULT_PHOTO_EDITS[key] })}
                      className="text-[9px] text-text-tertiary/60 hover:text-primary transition-colors leading-none"
                      title="Reset"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                {/* Centre tick mark for bipolar controls */}
                {min < 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-px h-2 bg-border-light z-10 pointer-events-none"
                    style={{ left: `${midPct}%` }}
                  />
                )}
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={val}
                  onChange={(e) => onChange({ ...edits, [key]: Number(e.target.value) })}
                  className="w-full h-1.5 accent-primary relative z-20"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Reset all */}
      {hasChanges && (
        <button
          onClick={() => onChange({ ...DEFAULT_PHOTO_EDITS })}
          className="w-full text-[10px] font-medium text-text-tertiary hover:text-danger py-1.5 rounded-xl border border-border/50 hover:border-danger/30 hover:bg-red-50 transition-colors"
        >
          Reset all adjustments
        </button>
      )}
    </div>
  );
}
