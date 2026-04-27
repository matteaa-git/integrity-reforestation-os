"use client";

import type { Slide } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface SlideCanvasProps {
  slide: Slide;
  scale?: number;
  interactive?: boolean;
  showGuides?: boolean;
  showSafeZone?: boolean;
  editingField?: string | null;
  onFieldClick?: (field: "headline" | "subheadline" | "body" | "subtext" | "ctaText") => void;
}

export default function SlideCanvas({
  slide,
  scale = 1,
  interactive = false,
  showGuides = false,
  showSafeZone = false,
  editingField = null,
  onFieldClick,
}: SlideCanvasProps) {
  const { content, style, image } = slide;

  // 4:5 ratio = 1080x1350 at native, scaled down
  const W = 1080;
  const H = 1350;
  const s = scale; // shorthand

  // ── Layout logic ──
  const getLayoutStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: `${style.paddingY * s}px ${style.paddingX * s}px`,
      textAlign: style.textAlign,
    };

    switch (style.layout) {
      case "top-heavy":
        return { ...base, justifyContent: "flex-start" };
      case "bottom-heavy":
        return { ...base, justifyContent: "flex-end" };
      case "hero-hook":
        return { ...base, justifyContent: "center", alignItems: style.textAlign === "center" ? "center" : undefined };
      case "quote-layout":
        return { ...base, justifyContent: "center", paddingLeft: `${60 * s}px`, paddingRight: `${60 * s}px` };
      case "story-layout":
        return { ...base, justifyContent: "flex-end", paddingBottom: `${80 * s}px` };
      case "two-column":
        return { ...base, justifyContent: "center" };
      case "bullet-breakdown":
        return { ...base, justifyContent: "flex-start", paddingTop: `${60 * s}px` };
      case "framework-layout":
        return { ...base, justifyContent: "flex-start", paddingTop: `${50 * s}px` };
      case "comparison-layout":
        return { ...base, justifyContent: "center" };
      case "checklist":
        return { ...base, justifyContent: "flex-start", paddingTop: `${50 * s}px` };
      case "split":
        return { ...base, justifyContent: "center" };
      case "full-bleed":
        return { ...base, justifyContent: "flex-end", padding: `${24 * s}px ${32 * s}px` };
      default: // centered
        return { ...base, justifyContent: "center" };
    }
  };

  const fieldRing = (field: string) =>
    interactive && editingField === field
      ? `outline outline-2 outline-[#39de8b] outline-offset-2 rounded`
      : interactive && onFieldClick
      ? "hover:outline hover:outline-1 hover:outline-white/20 hover:outline-offset-1 rounded cursor-text"
      : "";

  const handleFieldClick = (field: "headline" | "subheadline" | "body" | "subtext" | "ctaText") => (e: React.MouseEvent) => {
    if (interactive && onFieldClick) {
      e.stopPropagation();
      onFieldClick(field);
    }
  };

  // ── Render quote decoration ──
  const renderQuoteDecor = () => {
    if (style.layout !== "quote-layout") return null;
    return (
      <div
        style={{
          fontSize: `${80 * s}px`,
          lineHeight: 1,
          color: style.accentColor,
          opacity: 0.3,
          fontFamily: "Georgia, serif",
          marginBottom: `${-10 * s}px`,
          textAlign: style.textAlign,
        }}
      >
        "
      </div>
    );
  };

  // ── Render comparison divider ──
  const renderComparisonDivider = () => {
    if (style.layout !== "comparison-layout") return null;
    return (
      <div
        style={{
          width: `${60 * s}px`,
          height: `${2 * s}px`,
          backgroundColor: style.accentColor,
          margin: `${12 * s}px ${style.textAlign === "center" ? "auto" : "0"}`,
          opacity: 0.5,
        }}
      />
    );
  };

  // ── Render framework numbering ──
  const renderFrameworkBadge = () => {
    if (style.layout !== "framework-layout" && style.layout !== "checklist") return null;
    return (
      <div
        style={{
          width: `${36 * s}px`,
          height: `${36 * s}px`,
          borderRadius: style.layout === "checklist" ? `${6 * s}px` : "50%",
          backgroundColor: style.accentColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${16 * s}px`,
          fontWeight: 700,
          color: style.bgColor,
          marginBottom: `${12 * s}px`,
        }}
      >
        {style.layout === "checklist" ? "✓" : "#"}
      </div>
    );
  };

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        width: `${W * s}px`,
        height: `${H * s}px`,
        backgroundColor: style.bgColor,
        fontFamily: style.fontFamily,
      }}
    >
      {/* Background image from style */}
      {style.bgImage && (
        <>
          <img src={style.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${style.bgOverlayOpacity / 100})` }} />
        </>
      )}

      {/* Slide image — background mode */}
      {image && image.mode === "background" && (() => {
        const cx = image.cropX ?? 0, cy = image.cropY ?? 0;
        const cw = image.cropW ?? 100, ch = image.cropH ?? 100;
        const hasCrop = cx > 0 || cy > 0 || cw < 100 || ch < 100;
        return (
          <>
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={`${API_BASE}/assets/${image.assetId}/file`}
                alt=""
                style={hasCrop ? {
                  position: "absolute",
                  width: `${(100 / cw) * 100}%`,
                  height: `${(100 / ch) * 100}%`,
                  left: `-${(cx / cw) * 100}%`,
                  top: `-${(cy / ch) * 100}%`,
                  opacity: image.opacity / 100,
                } : {
                  width: "100%", height: "100%", objectFit: "cover" as const, display: "block",
                  opacity: image.opacity / 100,
                }}
              />
            </div>
            <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${style.bgOverlayOpacity / 100})` }} />
          </>
        );
      })()}

      {/* Slide image — side mode (split layout) */}
      {image && image.mode === "side" && (
        <div
          className="absolute top-0 right-0 bottom-0"
          style={{ width: `${image.width}%` }}
        >
          <img
            src={`${API_BASE}/assets/${image.assetId}/file`}
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: image.opacity / 100 }}
          />
        </div>
      )}

      {/* Main content area */}
      <div
        className="relative h-full flex flex-col"
        style={{
          ...getLayoutStyles(),
          // For side image, limit text width
          ...(image && image.mode === "side" ? { width: `${100 - image.width}%` } : {}),
        }}
      >
        {/* Accent element */}
        {style.showAccent && style.accentStyle !== "none" && (
          <div className="shrink-0" style={{ marginBottom: `${8 * s}px`, textAlign: style.textAlign }}>
            {style.accentStyle === "line" && (
              <div style={{ width: `${48 * s}px`, height: `${4 * s}px`, backgroundColor: style.accentColor, borderRadius: `${2 * s}px`, display: "inline-block" }} />
            )}
            {style.accentStyle === "dot" && (
              <div style={{ width: `${12 * s}px`, height: `${12 * s}px`, backgroundColor: style.accentColor, borderRadius: "50%", display: "inline-block" }} />
            )}
            {style.accentStyle === "bar" && (
              <div style={{ width: `${6 * s}px`, height: `${40 * s}px`, backgroundColor: style.accentColor, borderRadius: `${3 * s}px`, display: "inline-block" }} />
            )}
          </div>
        )}

        {/* Framework / checklist badge */}
        {renderFrameworkBadge()}

        {/* Quote decoration */}
        {renderQuoteDecor()}

        {/* Headline */}
        {content.headline && (
          <div
            className={`shrink-0 ${fieldRing("headline")}`}
            onClick={handleFieldClick("headline")}
            style={{
              fontSize: `${style.headlineFontSize * s}px`,
              fontWeight: style.headlineWeight,
              color: style.headlineColor,
              lineHeight: style.layout === "hero-hook" ? 1.1 : 1.15,
              whiteSpace: "pre-wrap",
              marginBottom: `${(content.subheadline || content.body || content.subtext ? 12 : 0) * s}px`,
              letterSpacing: "-0.02em",
            }}
          >
            {content.headline}
          </div>
        )}

        {/* Subheadline */}
        {content.subheadline && (
          <div
            className={`shrink-0 ${fieldRing("subheadline")}`}
            onClick={handleFieldClick("subheadline")}
            style={{
              fontSize: `${style.subheadlineFontSize * s}px`,
              fontWeight: style.subheadlineWeight ?? 600,
              color: style.subheadlineColor,
              lineHeight: 1.3,
              whiteSpace: "pre-wrap",
              marginBottom: `${(content.body || content.subtext ? 12 : 0) * s}px`,
            }}
          >
            {content.subheadline}
          </div>
        )}

        {/* Comparison divider */}
        {renderComparisonDivider()}

        {/* Body */}
        {content.body && (
          <div
            className={`shrink-0 ${fieldRing("body")}`}
            onClick={handleFieldClick("body")}
            style={{
              fontSize: `${style.bodyFontSize * s}px`,
              fontWeight: 400,
              color: style.bodyColor,
              lineHeight: style.lineSpacing,
              whiteSpace: "pre-wrap",
              marginBottom: `${(content.subtext ? 12 : 0) * s}px`,
              opacity: 0.9,
            }}
          >
            {content.body}
          </div>
        )}

        {/* Subtext */}
        {content.subtext && (
          <div
            className={`shrink-0 ${fieldRing("subtext")}`}
            onClick={handleFieldClick("subtext")}
            style={{
              fontSize: `${style.subtextFontSize * s}px`,
              fontWeight: 400,
              color: style.subtextColor,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              marginBottom: `${(content.ctaText ? 20 : 0) * s}px`,
            }}
          >
            {content.subtext}
          </div>
        )}

        {/* CTA button */}
        {content.ctaText && (
          <div
            className={`shrink-0 ${fieldRing("ctaText")}`}
            onClick={handleFieldClick("ctaText")}
            style={{ textAlign: style.ctaAlign ?? style.textAlign }}
          >
            <div
              style={{
                display: "inline-block",
                fontSize: `${style.ctaFontSize * s}px`,
                fontWeight: 700,
                color: style.ctaColor,
                backgroundColor: style.ctaBgColor,
                padding: `${12 * s}px ${28 * s}px`,
                borderRadius: `${9999}px`,
                letterSpacing: "0.01em",
                // outline mode: when ctaBgColor matches the slide bg, show a teal border
                border: style.ctaBgColor === style.bgColor
                  ? `${2 * s}px solid ${style.ctaColor}`
                  : "none",
              }}
            >
              {content.ctaText}
            </div>
          </div>
        )}
      </div>

      {/* Contained image */}
      {image && image.mode === "contained" && (
        <div
          className="absolute"
          style={{
            left: `${image.x}%`,
            top: `${image.y}%`,
            width: `${image.width}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <img
            src={`${API_BASE}/assets/${image.assetId}/file`}
            alt=""
            className="w-full rounded-lg shadow-lg"
            style={{
              opacity: image.opacity / 100,
              borderRadius: `${8 * s}px`,
            }}
          />
        </div>
      )}

      {/* Handle watermark */}
      {style.showHandle && (
        <div
          className="absolute"
          style={{
            bottom: `${14 * s}px`,
            left: `${style.paddingX * s}px`,
            right: `${style.paddingX * s}px`,
            fontSize: `${11 * s}px`,
            color: "rgba(255,255,255,0.3)",
            textAlign: style.textAlign,
            fontWeight: 500,
          }}
        >
          @integrityreforestation
        </div>
      )}

      {/* Logo placeholder */}
      {style.showLogo && (
        <div
          className="absolute flex items-center gap-1"
          style={{
            top: `${16 * s}px`,
            right: `${style.paddingX * s}px`,
            fontSize: `${10 * s}px`,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          <span style={{
            width: `${18 * s}px`,
            height: `${18 * s}px`,
            borderRadius: `${4 * s}px`,
            backgroundColor: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${10 * s}px`,
          }}>
            IR
          </span>
        </div>
      )}

      {/* Safe zone overlay */}
      {showSafeZone && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: `${60 * s}px`,
            left: `${40 * s}px`,
            right: `${40 * s}px`,
            bottom: `${60 * s}px`,
            border: `${1 * s}px dashed rgba(57,222,139,0.4)`,
            borderRadius: `${8 * s}px`,
          }}
        />
      )}

      {/* Alignment guides */}
      {showGuides && (
        <>
          <div className="absolute top-0 bottom-0 left-1/2 w-px pointer-events-none" style={{ backgroundColor: "rgba(57,222,139,0.2)" }} />
          <div className="absolute left-0 right-0 top-1/2 h-px pointer-events-none" style={{ backgroundColor: "rgba(57,222,139,0.2)" }} />
          {/* Thirds */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: "33.33%", width: "1px", backgroundColor: "rgba(57,222,139,0.1)" }} />
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: "66.66%", width: "1px", backgroundColor: "rgba(57,222,139,0.1)" }} />
          <div className="absolute left-0 right-0 pointer-events-none" style={{ top: "33.33%", height: "1px", backgroundColor: "rgba(57,222,139,0.1)" }} />
          <div className="absolute left-0 right-0 pointer-events-none" style={{ top: "66.66%", height: "1px", backgroundColor: "rgba(57,222,139,0.1)" }} />
        </>
      )}
    </div>
  );
}
