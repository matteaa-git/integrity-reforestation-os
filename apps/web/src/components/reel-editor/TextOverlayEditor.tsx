"use client";

import type { TextOverlay } from "./types";
import { BRAND_FONTS, BRAND_COLORS, formatTime } from "./types";

interface TextOverlayEditorProps {
  overlay: TextOverlay;
  totalDuration: number;
  onChange: (updated: TextOverlay) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onApplyToAll?: () => void;
}

export default function TextOverlayEditor({ overlay, totalDuration, onChange, onDelete, onDuplicate, onApplyToAll }: TextOverlayEditorProps) {
  const update = <K extends keyof TextOverlay>(key: K, value: TextOverlay[K]) => {
    onChange({ ...overlay, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* Text content */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Text</label>
        <textarea
          value={overlay.text}
          onChange={(e) => update("text", e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
        />
      </div>

      {/* Timing */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Timing</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[9px] text-text-tertiary block mb-0.5">Start</span>
            <input
              type="range"
              min={0}
              max={totalDuration * 10}
              value={overlay.startTime * 10}
              onChange={(e) => update("startTime", Number(e.target.value) / 10)}
              className="w-full h-1.5 accent-blue-500"
            />
            <span className="text-[9px] text-text-tertiary font-mono">{formatTime(overlay.startTime)}</span>
          </div>
          <div>
            <span className="text-[9px] text-text-tertiary block mb-0.5">End</span>
            <input
              type="range"
              min={0}
              max={totalDuration * 10}
              value={overlay.endTime * 10}
              onChange={(e) => update("endTime", Number(e.target.value) / 10)}
              className="w-full h-1.5 accent-blue-500"
            />
            <span className="text-[9px] text-text-tertiary font-mono">{formatTime(overlay.endTime)}</span>
          </div>
        </div>
      </div>

      {/* Font */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Font</label>
          <select
            value={overlay.fontFamily}
            onChange={(e) => update("fontFamily", e.target.value)}
            className="w-full rounded-lg border border-border px-2 py-1 text-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {BRAND_FONTS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Weight</label>
          <select
            value={overlay.fontWeight}
            onChange={(e) => update("fontWeight", e.target.value as TextOverlay["fontWeight"])}
            className="w-full rounded-lg border border-border px-2 py-1 text-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="400">Regular</option>
            <option value="700">Bold</option>
            <option value="900">Black</option>
          </select>
        </div>
      </div>

      {/* Size */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
          Size ({overlay.fontSize}px)
        </label>
        <input
          type="range"
          min={8}
          max={72}
          value={overlay.fontSize}
          onChange={(e) => update("fontSize", Number(e.target.value))}
          className="w-full h-1.5 accent-primary"
        />
      </div>

      {/* Box width */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
          Box Width ({overlay.width ?? 80}%)
        </label>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={overlay.width ?? 80}
          onChange={(e) => update("width", Number(e.target.value))}
          className="w-full h-1.5 accent-primary"
        />
      </div>

      {/* Color */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Color</label>
        <div className="flex items-center gap-1.5">
          {BRAND_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => update("color", c.value)}
              title={c.label}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                overlay.color === c.value ? "border-primary scale-110" : "border-border"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <input
            type="color"
            value={overlay.color}
            onChange={(e) => update("color", e.target.value)}
            className="w-5 h-5 rounded border-0 cursor-pointer"
          />
        </div>
      </div>

      {/* Alignment */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Align</label>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => update("textAlign", a)}
              className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                overlay.textAlign === a ? "bg-primary text-white" : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {a === "left" ? "←" : a === "center" ? "↔" : "→"}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity + Rotation */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
            Opacity ({Math.round(overlay.opacity * 100)}%)
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={overlay.opacity}
            onChange={(e) => update("opacity", Number(e.target.value))}
            className="w-full h-1.5 accent-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
            Rotation ({overlay.rotation}°)
          </label>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={overlay.rotation}
            onChange={(e) => update("rotation", Number(e.target.value))}
            className="w-full h-1.5 accent-primary"
          />
        </div>
      </div>

      {/* Shadow + Background */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={overlay.dropShadow}
            onChange={(e) => update("dropShadow", e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary/20"
          />
          <span className="text-[10px] font-medium text-text-secondary">Shadow</span>
        </label>
      </div>

      {/* Background style */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Background</label>
        <div className="flex gap-1 mb-1.5">
          {(["none", "pill", "block"] as const).map((s) => (
            <button
              key={s}
              onClick={() => update("bgStyle", s)}
              className={`flex-1 py-1 rounded text-[10px] font-medium capitalize transition-colors ${
                overlay.bgStyle === s ? "bg-primary text-white" : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {overlay.bgStyle !== "none" && (
          <div className="flex items-center gap-1.5">
            {BRAND_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => update("bgColor", c.value)}
                className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${
                  overlay.bgColor === c.value ? "border-primary scale-110" : "border-border"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {onApplyToAll && (
        <button
          onClick={onApplyToAll}
          className="w-full text-[10px] font-semibold text-primary hover:text-primary-dark py-1.5 rounded-lg border border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors"
        >
          Apply to All Clips
        </button>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onDuplicate}
          className="flex-1 text-[10px] font-medium text-text-secondary hover:text-primary py-1.5 rounded-lg border border-border hover:border-primary/30 transition-colors"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="flex-1 text-[10px] font-medium text-red-500 hover:text-red-700 py-1.5 rounded-lg border border-red-200 hover:border-red-300 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
