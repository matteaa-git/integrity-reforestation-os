"use client";

import { useCallback, useRef, useState } from "react";
import type { DraftAssetEntry } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface FrameTimelineProps {
  frames: DraftAssetEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (assetId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export default function FrameTimeline({
  frames,
  selectedIndex,
  onSelect,
  onDuplicate,
  onDelete,
  onReorder,
}: FrameTimelineProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      onReorder(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDropTarget(null);
  }, [dragIndex, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTarget(null);
  }, []);

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide">Frames</span>
          <span className="text-[10px] text-text-tertiary bg-surface-secondary px-1.5 py-0.5 rounded-md font-medium">
            {frames.length}
          </span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-thin">
          <div className="flex gap-2 py-1">
            {frames.map((entry, i) => {
              const isSelected = i === selectedIndex;
              const isDragging = i === dragIndex;
              const isDropTarget = i === dropTarget && dragIndex !== null && dragIndex !== i;
              const isHovered = i === hoveredIndex;

              return (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="relative shrink-0 group"
                >
                  <button
                    onClick={() => onSelect(i)}
                    className={`relative w-[52px] rounded-lg overflow-hidden border-2 transition-all ${
                      isDragging ? "opacity-40" : ""
                    } ${
                      isDropTarget ? "border-primary/60 scale-105" : ""
                    } ${
                      isSelected
                        ? "border-primary shadow-md shadow-primary/10"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <div className="aspect-[9/16] overflow-hidden bg-gray-100 relative">
                      {entry.asset.media_type === "image" ? (
                        <img
                          src={`${API_BASE}/assets/${entry.asset_id}/file`}
                          alt={entry.asset.filename}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-purple-50">
                          <span className="text-[10px] text-purple-300">▶</span>
                        </div>
                      )}
                      {/* Frame number */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-0.5 pt-2">
                        <span className="text-[9px] text-white font-semibold">{i + 1}</span>
                      </div>
                      {/* Duration for video */}
                      {entry.asset.media_type === "video" && entry.asset.duration != null && (
                        <div className="absolute top-0.5 right-0.5">
                          <span className="text-[8px] bg-black/60 text-white px-1 rounded backdrop-blur-sm">
                            {entry.asset.duration.toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Hover actions */}
                  {isHovered && !isDragging && (
                    <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDuplicate(i); }}
                        className="w-4 h-4 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-[8px] text-text-secondary hover:text-primary hover:border-primary/30 transition-colors"
                        title="Duplicate frame"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(entry.asset_id); }}
                        className="w-4 h-4 rounded-full bg-white border border-border shadow-sm flex items-center justify-center text-[8px] text-red-400 hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Remove frame"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {frames.length === 0 && (
              <div className="text-[11px] text-text-tertiary py-2.5 px-2">
                Add assets from the library to create frames
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
