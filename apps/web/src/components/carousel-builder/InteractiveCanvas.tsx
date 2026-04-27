"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { Slide, CanvasElement } from "./types";

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const ALL_HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_CURSORS: Record<Handle, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize",
  e: "ew-resize", se: "nwse-resize", s: "ns-resize",
  sw: "nesw-resize", w: "ew-resize",
};

function getHandlePos(el: CanvasElement, h: Handle): { x: number; y: number } {
  const mx = el.x + el.width / 2, my = el.y + el.height / 2;
  const r = el.x + el.width, b = el.y + el.height;
  switch (h) {
    case "nw": return { x: el.x, y: el.y };
    case "n":  return { x: mx, y: el.y };
    case "ne": return { x: r, y: el.y };
    case "e":  return { x: r, y: my };
    case "se": return { x: r, y: b };
    case "s":  return { x: mx, y: b };
    case "sw": return { x: el.x, y: b };
    case "w":  return { x: el.x, y: my };
  }
}

interface DragState {
  kind: "move" | Handle;
  elId: string;
  startCX: number;
  startCY: number;
  orig: { x: number; y: number; w: number; h: number };
}

interface DrawState {
  sx: number; sy: number;
  cx: number; cy: number;
  shapeType: "rect" | "circle";
}

export interface InteractiveCanvasProps {
  slide: Slide;
  scale: number;
  selectedId: string | null;
  editingId: string | null;
  activeTool: "select" | "text" | "rect" | "circle";
  onSelect: (id: string | null) => void;
  onEditStart: (id: string) => void;
  onTextCommit: (id: string, text: string) => void;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
  onAddElement: (el: CanvasElement) => void;
  showGrid: boolean;
  API_BASE: string;
}

const HANDLE_PX = 9;

export default function InteractiveCanvas({
  slide, scale, selectedId, editingId, activeTool,
  onSelect, onEditStart, onTextCommit, onUpdateElement, onAddElement,
  showGrid, API_BASE,
}: InteractiveCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const drawRef = useRef<DrawState | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number; shapeType: "rect" | "circle" } | null>(null);

  // Stable refs for callbacks used inside global event handlers
  const cbRef = useRef({ onUpdateElement, onAddElement, slide, activeTool });
  cbRef.current = { onUpdateElement, onAddElement, slide, activeTool };
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return {
      cx: (clientX - rect.left) / scaleRef.current,
      cy: (clientY - rect.top) / scaleRef.current,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = scaleRef.current;
      const cx = (e.clientX - rect.left) / s;
      const cy = (e.clientY - rect.top) / s;

      const d = dragRef.current;
      if (d) {
        const dx = cx - d.startCX;
        const dy = cy - d.startCY;
        if (d.kind === "move") {
          cbRef.current.onUpdateElement(d.elId, {
            x: Math.max(0, Math.min(CANVAS_W - d.orig.w, d.orig.x + dx)),
            y: Math.max(0, Math.min(CANVAS_H - d.orig.h, d.orig.y + dy)),
          });
        } else {
          let nx = d.orig.x, ny = d.orig.y, nw = d.orig.w, nh = d.orig.h;
          if (d.kind.includes("e")) nw = Math.max(40, d.orig.w + dx);
          if (d.kind.includes("s")) nh = Math.max(20, d.orig.h + dy);
          if (d.kind.includes("w")) { nx = d.orig.x + dx; nw = Math.max(40, d.orig.w - dx); }
          if (d.kind.includes("n")) { ny = d.orig.y + dy; nh = Math.max(20, d.orig.h - dy); }
          cbRef.current.onUpdateElement(d.elId, { x: nx, y: ny, width: nw, height: nh });
        }
        return;
      }

      const dr = drawRef.current;
      if (dr) {
        setDrawPreview({
          x: Math.min(dr.sx, cx), y: Math.min(dr.sy, cy),
          w: Math.abs(cx - dr.sx), h: Math.abs(cy - dr.sy),
          shapeType: dr.shapeType,
        });
      }
    };

    const onUp = (e: MouseEvent) => {
      const dr = drawRef.current;
      if (dr) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const s = scaleRef.current;
          const cx = (e.clientX - rect.left) / s;
          const cy = (e.clientY - rect.top) / s;
          const nx = Math.min(dr.sx, cx), ny = Math.min(dr.sy, cy);
          const nw = Math.abs(cx - dr.sx), nh = Math.abs(cy - dr.sy);
          if (nw > 20 && nh > 20) {
            const sl = cbRef.current.slide;
            cbRef.current.onAddElement({
              id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: "shape",
              x: nx, y: ny, width: nw, height: nh,
              rotation: 0, opacity: 100, locked: false,
              zIndex: (sl.elements?.length ?? 0) + 1,
              fill: sl.style.accentColor,
              stroke: "none", strokeWidth: 0,
              shapeType: dr.shapeType,
              borderRadius: dr.shapeType === "circle" ? 9999 : 0,
            });
          }
        }
        drawRef.current = null;
        setDrawPreview(null);
      }
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleBgMouseDown = (e: React.MouseEvent) => {
    // Only fires when clicking the canvas background (not an element)
    const { cx, cy } = toCanvas(e.clientX, e.clientY);
    if (activeTool === "text") {
      const sl = cbRef.current.slide;
      const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      onAddElement({
        id, type: "text",
        x: Math.max(0, cx - 150), y: Math.max(0, cy - 20),
        width: 300, height: 80,
        rotation: 0, opacity: 100, locked: false,
        zIndex: (sl.elements?.length ?? 0) + 1,
        text: "Add text",
        fontSize: 36, fontFamily: sl.style.fontFamily,
        fontWeight: "700", color: "#FFFFFF",
        textAlign: "left", lineHeight: 1.2, letterSpacing: 0,
      });
      onSelect(id);
      setTimeout(() => onEditStart(id), 50);
    } else if (activeTool === "rect" || activeTool === "circle") {
      drawRef.current = { sx: cx, sy: cy, cx, cy, shapeType: activeTool };
    } else {
      onSelect(null);
    }
  };

  const startDrag = (e: React.MouseEvent, elId: string, kind: DragState["kind"]) => {
    e.stopPropagation();
    e.preventDefault();
    const el = slide.elements?.find((el) => el.id === elId);
    if (!el) return;
    const { cx, cy } = toCanvas(e.clientX, e.clientY);
    dragRef.current = {
      kind, elId, startCX: cx, startCY: cy,
      orig: { x: el.x, y: el.y, w: el.width, h: el.height },
    };
  };

  const sorted = [...(slide.elements ?? [])].sort((a, b) => a.zIndex - b.zIndex);
  const selectedEl = slide.elements?.find((el) => el.id === selectedId) ?? null;
  const s = scale;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        width: CANVAS_W * s,
        height: CANVAS_H * s,
        backgroundColor: slide.style.bgColor,
        fontFamily: slide.style.fontFamily,
        cursor: activeTool === "text" ? "text" : (activeTool === "rect" || activeTool === "circle") ? "crosshair" : "default",
        userSelect: "none",
        flexShrink: 0,
      }}
      onMouseDown={handleBgMouseDown}
    >
      {/* Background image from style.bgImage */}
      {slide.style.bgImage && (
        <>
          <img src={slide.style.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${slide.style.bgOverlayOpacity / 100})` }} />
        </>
      )}

      {/* Slide image — background mode */}
      {slide.image?.mode === "background" && (() => {
        const img = slide.image!;
        const cx = img.cropX ?? 0, cy = img.cropY ?? 0;
        const cw = img.cropW ?? 100, ch = img.cropH ?? 100;
        const hasCrop = cx > 0 || cy > 0 || cw < 100 || ch < 100;
        return (
          <>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img
                src={`${API_BASE}/assets/${img.assetId}/file`}
                alt=""
                style={hasCrop ? {
                  position: "absolute",
                  width: `${(100 / cw) * 100}%`,
                  height: `${(100 / ch) * 100}%`,
                  left: `-${(cx / cw) * 100}%`,
                  top: `-${(cy / ch) * 100}%`,
                  opacity: img.opacity / 100,
                } : {
                  width: "100%", height: "100%", objectFit: "cover", display: "block",
                  opacity: img.opacity / 100,
                }}
              />
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${slide.style.bgOverlayOpacity / 100})` }} />
          </>
        );
      })()}

      {/* Grid */}
      {showGrid && (
        <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W * s} height={CANVAS_H * s} style={{ zIndex: 2 }}>
          {[1,2,3,4,5,6,7,8,9].map(i => (
            <line key={`v${i}`} x1={CANVAS_W * s * i / 10} y1={0} x2={CANVAS_W * s * i / 10} y2={CANVAS_H * s} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          ))}
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
            <line key={`h${i}`} x1={0} y1={CANVAS_H * s * i / 13} x2={CANVAS_W * s} y2={CANVAS_H * s * i / 13} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          ))}
          {/* center guides */}
          <line x1={CANVAS_W * s / 2} y1={0} x2={CANVAS_W * s / 2} y2={CANVAS_H * s} stroke="rgba(57,222,139,0.12)" strokeWidth={1} />
          <line x1={0} y1={CANVAS_H * s / 2} x2={CANVAS_W * s} y2={CANVAS_H * s / 2} stroke="rgba(57,222,139,0.12)" strokeWidth={1} />
        </svg>
      )}

      {/* Canvas elements */}
      {sorted.map((el) => {
        const isSel = el.id === selectedId;
        const isEdit = el.id === editingId;

        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: el.x * s,
              top: el.y * s,
              width: el.width * s,
              height: el.height * s,
              opacity: el.opacity / 100,
              zIndex: el.zIndex,
              cursor: activeTool === "select" ? (isEdit ? "text" : "move") : "inherit",
              overflow: el.type === "text" ? "visible" : "hidden",
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSelect(el.id);
              if (!isEdit && activeTool === "select") startDrag(e, el.id, "move");
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (el.type === "text") onEditStart(el.id);
            }}
          >
            {/* Text */}
            {el.type === "text" && !isEdit && (
              <div style={{
                width: "100%", height: "100%",
                fontSize: (el.fontSize ?? 32) * s,
                fontFamily: el.fontFamily,
                fontWeight: el.fontWeight,
                fontStyle: el.fontStyle ?? "normal",
                color: el.color,
                textAlign: el.textAlign ?? "left",
                lineHeight: el.lineHeight,
                letterSpacing: ((el.letterSpacing ?? 0) * s) + "px",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                textDecoration: el.textDecoration ?? "none",
                pointerEvents: "none",
              }}>
                {el.text}
              </div>
            )}

            {/* Text editing */}
            {el.type === "text" && isEdit && (
              <textarea
                autoFocus
                defaultValue={el.text}
                style={{
                  width: "100%", height: "100%",
                  fontSize: (el.fontSize ?? 32) * s,
                  fontFamily: el.fontFamily,
                  fontWeight: el.fontWeight,
                  color: el.color,
                  textAlign: el.textAlign ?? "left",
                  lineHeight: el.lineHeight,
                  background: "rgba(0,0,0,0.05)",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  padding: 0, margin: 0,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                  display: "block",
                }}
                onBlur={(e) => onTextCommit(el.id, e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") onTextCommit(el.id, e.currentTarget.value);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* Image */}
            {el.type === "image" && el.assetId && (() => {
              const hasCrop = el.cropW != null && el.cropH != null && el.cropW < 100 || el.cropX != null && el.cropX > 0;
              const cx = el.cropX ?? 0, cy = el.cropY ?? 0;
              const cw = el.cropW ?? 100, ch = el.cropH ?? 100;
              if (hasCrop) {
                return (
                  <div style={{
                    width: "100%", height: "100%", overflow: "hidden", position: "relative",
                    borderRadius: (el.borderRadius ?? 0) * s,
                    pointerEvents: "none",
                  }}>
                    <img
                      src={`${API_BASE}/assets/${el.assetId}/file`}
                      alt="" draggable={false}
                      style={{
                        position: "absolute",
                        width: `${(100 / cw) * 100}%`,
                        height: `${(100 / ch) * 100}%`,
                        left: `-${(cx / cw) * 100}%`,
                        top: `-${(cy / ch) * 100}%`,
                        opacity: el.opacity / 100,
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                );
              }
              return (
                <img
                  src={`${API_BASE}/assets/${el.assetId}/file`}
                  alt="" draggable={false}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: el.objectFit ?? "cover",
                    borderRadius: (el.borderRadius ?? 0) * s,
                    pointerEvents: "none", display: "block",
                  }}
                />
              );
            })()}

            {/* Shape */}
            {el.type === "shape" && (
              <div style={{
                width: "100%", height: "100%",
                backgroundColor: el.fill,
                borderRadius: el.borderRadius ?? 0,
                border: el.stroke && el.stroke !== "none" ? `${(el.strokeWidth ?? 1) * s}px solid ${el.stroke}` : undefined,
                pointerEvents: "none",
              }} />
            )}
          </div>
        );
      })}

      {/* Selection ring + handles (rendered at canvas level, above elements) */}
      {selectedEl && editingId !== selectedEl.id && (
        <>
          <div
            className="pointer-events-none"
            style={{
              position: "absolute",
              left: selectedEl.x * s,
              top: selectedEl.y * s,
              width: selectedEl.width * s,
              height: selectedEl.height * s,
              border: "2px solid #39de8b",
              borderRadius: (selectedEl.borderRadius ?? 0) * s,
              zIndex: 9000,
            }}
          />
          {ALL_HANDLES.map((h) => {
            const pos = getHandlePos(selectedEl, h);
            return (
              <div
                key={h}
                style={{
                  position: "absolute",
                  left: pos.x * s - HANDLE_PX / 2,
                  top: pos.y * s - HANDLE_PX / 2,
                  width: HANDLE_PX,
                  height: HANDLE_PX,
                  backgroundColor: "#fff",
                  border: "2px solid #39de8b",
                  borderRadius: 2,
                  cursor: HANDLE_CURSORS[h],
                  zIndex: 9001,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startDrag(e, selectedEl.id, h);
                }}
              />
            );
          })}
        </>
      )}

      {/* Drawing preview */}
      {drawPreview && (
        <div
          className="pointer-events-none"
          style={{
            position: "absolute",
            left: drawPreview.x * s,
            top: drawPreview.y * s,
            width: drawPreview.w * s,
            height: drawPreview.h * s,
            border: "2px dashed #39de8b",
            backgroundColor: "rgba(57,222,139,0.12)",
            borderRadius: drawPreview.shapeType === "circle" ? "50%" : 0,
            zIndex: 9002,
          }}
        />
      )}
    </div>
  );
}
