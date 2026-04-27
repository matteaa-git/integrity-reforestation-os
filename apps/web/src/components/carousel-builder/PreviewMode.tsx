"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide, CarouselMeta } from "./types";
import SlideCanvas from "./SlideCanvas";

interface PreviewModeProps {
  slides: Slide[];
  meta: CarouselMeta;
  onClose: () => void;
}

export default function PreviewMode({ slides, meta, onClose }: PreviewModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const goTo = useCallback((index: number) => {
    if (isAnimating || index === currentIndex) return;
    if (index < 0 || index >= slides.length) return;
    setDirection(index > currentIndex ? "left" : "right");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsAnimating(false);
      setDirection(null);
    }, 250);
  }, [currentIndex, isAnimating, slides.length]);

  const goNext = useCallback(() => goTo(Math.min(slides.length - 1, currentIndex + 1)), [goTo, currentIndex, slides.length]);
  const goPrev = useCallback(() => goTo(Math.max(0, currentIndex - 1)), [goTo, currentIndex]);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  // Touch/pointer swipe on slide area
  const handlePointerDown = (e: React.PointerEvent) => {
    touchStartX.current = e.clientX;
    touchDeltaX.current = 0;
    setIsDragging(true);
    setDragX(0);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - touchStartX.current;
    touchDeltaX.current = delta;
    setDragX(delta);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 50;
    if (touchDeltaX.current < -threshold) {
      goNext();
    } else if (touchDeltaX.current > threshold) {
      goPrev();
    }
    setDragX(0);
  };

  const slideScale = 340 / 1080;

  // Animation transform
  const getSlideTransform = () => {
    if (isDragging) return `translateX(${dragX}px)`;
    if (!isAnimating || !direction) return "translateX(0)";
    return direction === "left" ? "translateX(-100%)" : "translateX(100%)";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition-colors"
      >
        &times;
      </button>

      {/* Nav arrows — desktop */}
      <button
        onClick={goPrev}
        disabled={currentIndex === 0}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 disabled:opacity-10 text-white/70 hover:text-white flex items-center justify-center transition-all text-sm"
      >
        ←
      </button>
      <button
        onClick={goNext}
        disabled={currentIndex === slides.length - 1}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 disabled:opacity-10 text-white/70 hover:text-white flex items-center justify-center transition-all text-sm"
      >
        →
      </button>

      {/* Phone frame */}
      <div className="flex flex-col items-center">
        {/* Phone notch */}
        <div className="w-[340px] bg-black rounded-t-[24px] pt-2 pb-0">
          <div className="w-20 h-1 bg-white/10 rounded-full mx-auto mb-2" />
        </div>

        {/* Instagram header */}
        <div className="w-[340px] bg-black px-3 py-2 flex items-center">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#39de8b] to-[#002a27] flex items-center justify-center shrink-0">
              <span className="text-[7px] font-bold text-white">IR</span>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-white leading-tight truncate">integrityreforestation</div>
            </div>
          </div>
          <div className="text-white/30 text-xs tracking-wider">...</div>
        </div>

        {/* Slide area with swipe */}
        <div
          className="relative w-[340px] bg-black overflow-hidden touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          {/* Carousel dots */}
          <div className="absolute top-2.5 left-0 right-0 z-20 flex items-center justify-center gap-[3px]">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === currentIndex
                    ? "w-[6px] h-[6px] bg-blue-400"
                    : "w-[5px] h-[5px] bg-white/25 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Slide with animation */}
          <div
            className="transition-transform duration-250 ease-out"
            style={{
              transform: getSlideTransform(),
              transitionDuration: isDragging ? "0ms" : "250ms",
            }}
          >
            <SlideCanvas slide={slides[currentIndex]} scale={slideScale} />
          </div>

          {/* Slide counter */}
          <div className="absolute bottom-2 right-3 z-20">
            <span className="text-[9px] font-semibold text-white/40 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              {currentIndex + 1}/{slides.length}
            </span>
          </div>
        </div>

        {/* Instagram footer */}
        <div className="w-[340px] bg-black px-3 py-2 rounded-b-[24px]">
          {/* Action icons */}
          <div className="flex items-center gap-3.5 mb-1.5">
            <span className="text-white text-[15px]">♡</span>
            <span className="text-white text-[15px]">💬</span>
            <span className="text-white text-[15px]">↗</span>
            <span className="ml-auto text-white text-[15px]">⊡</span>
          </div>

          {/* Likes */}
          <div className="text-[10px] font-semibold text-white/80 mb-1">1,247 likes</div>

          {/* Caption toggle */}
          <div className="text-[10px] text-white/70 leading-relaxed">
            <span className="font-semibold text-white/90">integrityreforestation </span>
            {meta.caption ? (
              showCaption ? (
                <>
                  {meta.caption}
                  {meta.hashtags && (
                    <span className="text-blue-400/60 block mt-0.5">{meta.hashtags}</span>
                  )}
                </>
              ) : (
                <>
                  {meta.caption.slice(0, 80)}
                  {meta.caption.length > 80 && (
                    <button
                      onClick={() => setShowCaption(true)}
                      className="text-white/30 ml-1"
                    >
                      ...more
                    </button>
                  )}
                </>
              )
            ) : (
              <span className="text-white/20 italic">No caption</span>
            )}
          </div>

          {/* Timestamp */}
          <div className="text-[9px] text-white/20 mt-1.5 uppercase tracking-wide">2 hours ago</div>
        </div>

        {/* Controls hint */}
        <div className="mt-5 flex items-center gap-5 text-[10px] text-white/20">
          <span>← → or swipe</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
