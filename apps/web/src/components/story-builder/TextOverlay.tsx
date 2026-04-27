"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Brand constants – Integrity Reforestation
// ---------------------------------------------------------------------------
export const BRAND_FONTS = [
  { label: "Noto Sans", value: "'Noto Sans', sans-serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
] as const;

export const BRAND_COLORS = [
  { label: "Forest Teal", value: "#002a27" },
  { label: "Bright Green", value: "#39de8b" },
  { label: "Forest Green", value: "#348050" },
  { label: "Gold", value: "#fbb700" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
] as const;

// Font sizes are authored at this reference canvas height (px)
export const REFERENCE_CANVAS_HEIGHT = 640;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TextLayer {
  id: string;
  text: string;
  x: number;         // percentage 0-100
  y: number;         // percentage 0-100
  width?: number;    // percentage of canvas width (10-100), defaults to 80
  fontSize: number;  // px at REFERENCE_CANVAS_HEIGHT=640
  fontFamily: string;
  fontWeight: "400" | "700" | "900";
  color: string;
  opacity: number;   // 0-1
  textAlign: "left" | "center" | "right";
  rotation: number;  // degrees
  dropShadow: boolean;
  bgStyle: "none" | "pill" | "block";
  bgColor: string;
  preset?: string;
}

export interface TextLayerPreset {
  label: string;
  config: Omit<TextLayer, "id" | "x" | "y" | "width" | "text">;
}

export const TEXT_PRESETS: TextLayerPreset[] = [
  {
    label: "Headline",
    config: {
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
  },
  {
    label: "Subheadline",
    config: {
      fontSize: 28,
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
  },
  {
    label: "Call to Action",
    config: {
      fontSize: 24,
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
  },
  {
    label: "Small Caption",
    config: {
      fontSize: 16,
      fontFamily: "'Inter', sans-serif",
      fontWeight: "400",
      color: "#ffffff",
      opacity: 0.85,
      textAlign: "left",
      rotation: 0,
      dropShadow: true,
      bgStyle: "none",
      bgColor: "#000000",
      preset: "caption",
    },
  },
];

export function createTextLayer(preset?: TextLayerPreset): TextLayer {
  const base = preset?.config ?? TEXT_PRESETS[0].config;
  return {
    id: crypto.randomUUID(),
    text: preset ? preset.label : "New Text",
    x: 50,
    y: 50,
    width: 80,
    ...base,
  };
}

// ---------------------------------------------------------------------------
// Draggable + Resizable Text Layer on Canvas
// ---------------------------------------------------------------------------
interface DraggableTextProps {
  layer: TextLayer;
  isSelected: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Actual rendered height of the canvas in px — used to scale font sizes */
  canvasHeight: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number) => void;
}

export function DraggableText({ layer, isSelected, canvasRef, canvasHeight, onSelect, onMove, onResize }: DraggableTextProps) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ clientX: 0, width: 80, canvasWidth: 1 });

  // Scale font size proportionally to the actual canvas height
  const scale = canvasHeight > 0 ? canvasHeight / REFERENCE_CANVAS_HEIGHT : 1;
  const scaledFontSize = Math.max(8, Math.round(layer.fontSize * scale));

  // ── Drag ────────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (resizing) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    setDragging(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (layer.x / 100) * rect.width,
      y: e.clientY - (layer.y / 100) * rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [resizing, canvasRef, layer.x, layer.y, onSelect]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(100, ((e.clientX - dragOffset.current.x) / rect.width) * 100));
    const ny = Math.max(0, Math.min(100, ((e.clientY - dragOffset.current.y) / rect.height) * 100));
    onMove(nx, ny);
  }, [dragging, canvasRef, onMove]);

  // ── Resize (right handle) ───────────────────────────────────────────────
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeStart.current = {
      clientX: e.clientX,
      width: layer.width ?? 80,
      canvasWidth: canvas.getBoundingClientRect().width,
    };
    setResizing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [canvasRef, layer.width]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizing) return;
    const delta = e.clientX - resizeStart.current.clientX;
    // ×2 because the box is centered — dragging right edge changes both sides
    const deltaPercent = (delta / resizeStart.current.canvasWidth) * 100 * 2;
    const newWidth = Math.max(10, Math.min(100, resizeStart.current.width + deltaPercent));
    onResize(Math.round(newWidth));
  }, [resizing, onResize]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    setResizing(false);
  }, []);

  const textShadow = layer.dropShadow ? "0 2px 8px rgba(0,0,0,0.6)" : "none";
  const bgPadding = layer.bgStyle !== "none" ? "4px 12px" : undefined;
  const bgRadius = layer.bgStyle === "pill" ? "9999px" : layer.bgStyle === "block" ? "6px" : undefined;
  const bgColorVal = layer.bgStyle !== "none" ? layer.bgColor : "transparent";
  const layerWidth = layer.width ?? 80;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={resizing ? handleResizePointerMove : handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute select-none touch-none"
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layerWidth}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        cursor: dragging ? "grabbing" : "grab",
        zIndex: isSelected ? 20 : 10,
      }}
    >
      <div
        className={`whitespace-pre-wrap w-full ${isSelected ? "ring-2 ring-primary ring-offset-1 rounded" : ""}`}
        style={{
          fontFamily: layer.fontFamily,
          fontSize: `${scaledFontSize}px`,
          fontWeight: layer.fontWeight,
          color: layer.color,
          opacity: layer.opacity,
          textAlign: layer.textAlign,
          textShadow,
          padding: bgPadding,
          borderRadius: bgRadius,
          backgroundColor: bgColorVal,
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {layer.text || "\u00A0"}
      </div>

      {/* Resize handle — right edge, visible only when selected */}
      {isSelected && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-6 rounded-sm bg-primary border border-white shadow-lg cursor-ew-resize z-30 flex items-center justify-center"
          style={{ touchAction: "none" }}
          title="Drag to resize"
        >
          <div className="flex flex-col gap-0.5">
            <div className="w-0.5 h-2 bg-white/80 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text Layer Editor Panel (right side)
// ---------------------------------------------------------------------------
interface TextLayerEditorProps {
  layer: TextLayer;
  onChange: (updated: TextLayer) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onApplyToAll?: () => void;
}

export function TextLayerEditor({ layer, onChange, onDelete, onDuplicate, onApplyToAll }: TextLayerEditorProps) {
  const update = <K extends keyof TextLayer>(key: K, value: TextLayer[K]) => {
    onChange({ ...layer, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* Text content */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Text</label>
        <textarea
          value={layer.text}
          onChange={(e) => update("text", e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
        />
      </div>

      {/* Preset */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Style Preset</label>
        <div className="flex flex-wrap gap-1">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onChange({ ...layer, ...p.config })}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                layer.preset === p.config.preset
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font family */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Font</label>
        <select
          value={layer.fontFamily}
          onChange={(e) => update("fontFamily", e.target.value)}
          className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {BRAND_FONTS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Font size slider + weight */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
            Size ({layer.fontSize}px)
          </label>
          <input
            type="range"
            min={8}
            max={120}
            step={1}
            value={layer.fontSize}
            onChange={(e) => update("fontSize", Number(e.target.value))}
            className="w-full h-1.5 accent-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Weight</label>
          <select
            value={layer.fontWeight}
            onChange={(e) => update("fontWeight", e.target.value as TextLayer["fontWeight"])}
            className="w-full rounded-lg border border-border px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="400">Regular</option>
            <option value="700">Bold</option>
            <option value="900">Black</option>
          </select>
        </div>
      </div>

      {/* Box width slider */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
          Box Width ({layer.width ?? 80}%)
        </label>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={layer.width ?? 80}
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
                layer.color === c.value ? "border-primary scale-110" : "border-border"
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <input
            type="color"
            value={layer.color}
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
                layer.textAlign === a
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {a === "left" ? "←" : a === "center" ? "↔" : "→"}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
          Opacity ({Math.round(layer.opacity * 100)}%)
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={layer.opacity}
          onChange={(e) => update("opacity", Number(e.target.value))}
          className="w-full h-1.5 accent-primary"
        />
      </div>

      {/* Rotation */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">
          Rotation ({layer.rotation}°)
        </label>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={layer.rotation}
          onChange={(e) => update("rotation", Number(e.target.value))}
          className="w-full h-1.5 accent-primary"
        />
      </div>

      {/* Drop shadow */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={layer.dropShadow}
          onChange={(e) => update("dropShadow", e.target.checked)}
          className="rounded border-border text-primary focus:ring-primary/20"
        />
        <span className="text-[10px] font-medium text-text-secondary">Drop Shadow</span>
      </label>

      {/* Background style */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide block mb-1">Background</label>
        <div className="flex gap-1 mb-1.5">
          {(["none", "pill", "block"] as const).map((s) => (
            <button
              key={s}
              onClick={() => update("bgStyle", s)}
              className={`flex-1 py-1 rounded text-[10px] font-medium capitalize transition-colors ${
                layer.bgStyle === s
                  ? "bg-primary text-white"
                  : "bg-surface-secondary text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {layer.bgStyle !== "none" && (
          <div className="flex items-center gap-1.5">
            {BRAND_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => update("bgColor", c.value)}
                title={c.label}
                className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${
                  layer.bgColor === c.value ? "border-primary scale-110" : "border-border"
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
          Apply to All Frames
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
