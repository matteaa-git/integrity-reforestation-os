"use client";

import { useCallback, useEffect, useRef, useState, memo } from "react";
import type { Slide, SlideStyle, CanvasElement, BrandTheme } from "@/components/carousel-builder/types";
import {
  DEFAULT_STYLE,
  DEFAULT_THEMES,
  BRAND_FONTS,
  BRAND_COLORS,
  createSlide,
} from "@/components/carousel-builder/types";
import InteractiveCanvas, { CANVAS_W, CANVAS_H } from "@/components/carousel-builder/InteractiveCanvas";
import SlideCanvas from "@/components/carousel-builder/SlideCanvas";
import CropModal from "@/components/carousel-builder/CropModal";
import { INTEGRITY_TEMPLATES } from "@/components/carousel-builder/templates";
import type { Asset } from "@/lib/api";
import { createDraft, fetchDraft, fetchAssets, fetchAsset, updateDraft as apiUpdateDraft, scheduleDraft, type ContentFormat } from "@/lib/api";

// ── Thumbnail scales ──────────────────────────────────────────────────────────
const STRIP_SCALE = 0.085; // bottom strip: ~92px × ~115px
const PANEL_SCALE = 0.185; // left panel slide list: ~200px × ~250px
const TPLTHUMB_SCALE = 0.055; // template preview rows: ~59px × ~74px

// ── Tool type ─────────────────────────────────────────────────────────────────
type Tool = "select" | "text" | "rect" | "circle";
type LeftPanel = "slides" | "elements" | "templates" | "media" | "brand" | null;

// ── Shared micro-components (defined OUTSIDE to prevent React remounting) ─────

const Divider = memo(function Divider() {
  return <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", margin: "4px 0" }} />;
});
Divider.displayName = "Divider";

const PropRow = memo(function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </label>
      {children}
    </div>
  );
});
PropRow.displayName = "PropRow";

const ColorRow = memo(function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        type="color"
        value={value.startsWith("rgba") || value === "transparent" ? "#888888" : value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer", padding: 2, backgroundColor: "rgba(255,255,255,0.1)" }}
      />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {BRAND_COLORS.slice(0, 7).map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            title={c.label}
            style={{
              width: 20, height: 20, borderRadius: "50%",
              backgroundColor: c.value,
              border: value === c.value ? "2px solid #39de8b" : "2px solid transparent",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
});
ColorRow.displayName = "ColorRow";

const SliderRow = memo(function SliderRow({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, height: 4, accentColor: "#39de8b" }}
      />
      <input
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 52, backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "3px 6px", fontSize: 12, color: "#fff", textAlign: "center" }}
      />
    </div>
  );
});
SliderRow.displayName = "SliderRow";

const NumInput = memo(function NumInput({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <input
      type="number" min={min} value={Math.round(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#fff" }}
    />
  );
});
NumInput.displayName = "NumInput";

// ── Convert legacy template slide → free-form elements ────────────────────────
function slideToElements(slide: Slide): CanvasElement[] {
  const { content: c, style: s } = slide;
  if (!c.headline && !c.subheadline && !c.body && !c.subtext && !c.ctaText) return [];

  const px = s.paddingX, py = s.paddingY;
  const textW = CANVAS_W - px * 2;
  const isBottom = ["bottom-heavy", "story-layout", "full-bleed"].includes(s.layout);
  const isCenter = ["centered", "hero-hook", "quote-layout", "two-column"].includes(s.layout);

  type Spec = { text: string; fontSize: number; fontWeight: string; color: string; height: number };
  const specs: Spec[] = [];
  const addSpec = (text: string, fontSize: number, fontWeight: string, color: string) => {
    const lines = text.split("\n").length;
    specs.push({ text, fontSize, fontWeight, color, height: Math.ceil(lines * fontSize * s.lineSpacing + 20) });
  };

  if (c.headline)    addSpec(c.headline,    s.headlineFontSize,    s.headlineWeight,            s.headlineColor);
  if (c.subheadline) addSpec(c.subheadline, s.subheadlineFontSize, s.subheadlineWeight ?? "600", s.subheadlineColor);
  if (c.body)        addSpec(c.body,        s.bodyFontSize,        "400",                        s.bodyColor);
  if (c.subtext)     addSpec(c.subtext,     s.subtextFontSize,     "400",                        s.subtextColor);

  const ctaH = c.ctaText ? 56 : 0;
  const totalH = specs.reduce((sum, sp) => sum + sp.height + 12, 0) + ctaH;
  let startY = isBottom ? CANVAS_H - py - totalH : isCenter ? (CANVAS_H - totalH) / 2 : py;
  startY = Math.max(py, startY);

  const els: CanvasElement[] = [];
  let y = startY, zi = 1;

  for (const sp of specs) {
    els.push({
      id: `el-${Date.now()}-${zi}`,
      type: "text", x: px, y, width: textW, height: sp.height,
      rotation: 0, opacity: 100, locked: false, zIndex: zi++,
      text: sp.text, fontSize: sp.fontSize, fontFamily: s.fontFamily,
      fontWeight: sp.fontWeight, color: sp.color,
      textAlign: s.textAlign, lineHeight: s.lineSpacing, letterSpacing: 0,
    });
    y += sp.height + 12;
  }

  if (c.ctaText) {
    const ctaW = Math.max(200, c.ctaText.length * (s.ctaFontSize ?? 16) * 0.65 + 48);
    const ctaX = s.ctaAlign === "right" ? CANVAS_W - px - ctaW
               : s.ctaAlign === "center" ? (CANVAS_W - ctaW) / 2 : px;
    const isOutline = s.ctaBgColor === s.bgColor;
    els.push({
      id: `el-${Date.now()}-${zi}`, type: "shape",
      x: ctaX, y: y + 8, width: ctaW, height: 48,
      rotation: 0, opacity: 100, locked: false, zIndex: zi++,
      fill: isOutline ? "transparent" : s.ctaBgColor,
      stroke: isOutline ? s.ctaColor : "none", strokeWidth: 2,
      borderRadius: 9999, shapeType: "rect",
    });
    els.push({
      id: `el-${Date.now()}-${zi}`, type: "text",
      x: ctaX, y: y + 8, width: ctaW, height: 48,
      rotation: 0, opacity: 100, locked: false, zIndex: zi++,
      text: c.ctaText, fontSize: s.ctaFontSize ?? 16,
      fontFamily: s.fontFamily, fontWeight: "700", color: s.ctaColor,
      textAlign: "center", lineHeight: 1.2, letterSpacing: 0,
    });
  }

  return els;
}

// Deterministic initial slide — fixed ID so server + client render match exactly,
// avoiding React hydration mismatches that block event handlers.
const INITIAL_SLIDE: Slide = {
  id: "slide-initial",
  type: "blank",
  content: { headline: "", subheadline: "", body: "", subtext: "", ctaText: "" },
  style: { ...DEFAULT_STYLE, bgColor: "#002a27", layout: "centered" },
  image: null,
  elements: [],
};

function freshSlide(bgColor = "#002a27"): Slide {
  const s = createSlide("blank");
  s.style = { ...DEFAULT_STYLE, bgColor, layout: "centered" };
  s.elements = [];
  return s;
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewCarouselPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const [slides, setSlides] = useState<Slide[]>([INITIAL_SLIDE]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("slides");
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(44);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled Carousel");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsPage, setAssetsPage] = useState(0);
  const [history, setHistory] = useState<Slide[][]>([[INITIAL_SLIDE]]);
  const [histIdx, setHistIdx] = useState(0);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  // Crop modal: "element" crops a CanvasElement, "background" crops the slide.image
  const [cropTarget, setCropTarget] = useState<{ kind: "element"; elementId: string } | { kind: "background" } | null>(null);

  const scale = zoom / 100;
  const activeSlide = slides[activeIdx] ?? slides[0];
  const selectedEl = activeSlide?.elements?.find((el) => el.id === selectedId) ?? null;

  // ── History ──
  const pushHistory = useCallback((ns: Slide[]) => {
    setHistory((h) => [...h.slice(0, histIdx + 1), ns]);
    setHistIdx((i) => i + 1);
    setSlides(ns);
  }, [histIdx]);

  const undo = useCallback(() => {
    if (histIdx > 0) { setHistIdx((i) => i - 1); setSlides(history[histIdx - 1]); }
  }, [histIdx, history]);

  const redo = useCallback(() => {
    if (histIdx < history.length - 1) { setHistIdx((i) => i + 1); setSlides(history[histIdx + 1]); }
  }, [histIdx, history]);

  // ── Slide CRUD ──
  const addSlide = useCallback(() => {
    const ns = freshSlide(activeSlide?.style.bgColor);
    const newSlides = [...slides.slice(0, activeIdx + 1), ns, ...slides.slice(activeIdx + 1)];
    pushHistory(newSlides);
    setActiveIdx(activeIdx + 1);
    setSelectedId(null);
  }, [slides, activeIdx, activeSlide, pushHistory]);

  const deleteSlide = useCallback((i: number) => {
    if (slides.length <= 1) return;
    const ns = slides.filter((_, idx) => idx !== i);
    pushHistory(ns);
    setActiveIdx(Math.min(i, ns.length - 1));
    setSelectedId(null);
  }, [slides, pushHistory]);

  const duplicateSlide = useCallback((i: number) => {
    const src = slides[i];
    const dup: Slide = {
      ...src, id: `slide-dup-${Date.now()}`,
      content: { ...src.content }, style: { ...src.style },
      elements: (src.elements ?? []).map((el) => ({ ...el, id: `el-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    };
    const ns = [...slides.slice(0, i + 1), dup, ...slides.slice(i + 1)];
    pushHistory(ns);
    setActiveIdx(i + 1);
  }, [slides, pushHistory]);

  const updateSlideStyle = useCallback((updates: Partial<SlideStyle>) => {
    setSlides((prev) => prev.map((s, i) => i === activeIdx ? { ...s, style: { ...s.style, ...updates } } : s));
  }, [activeIdx]);

  // ── Element CRUD ──
  const addElement = useCallback((el: CanvasElement) => {
    setSlides((prev) => prev.map((s, i) =>
      i === activeIdx ? { ...s, elements: [...(s.elements ?? []), el] } : s
    ));
    setActiveTool("select");
  }, [activeIdx]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setSlides((prev) => prev.map((s, i) =>
      i === activeIdx
        ? { ...s, elements: (s.elements ?? []).map((el) => el.id === id ? { ...el, ...updates } : el) }
        : s
    ));
  }, [activeIdx]);

  const deleteElement = useCallback((id: string) => {
    const ns = slides.map((s, i) =>
      i === activeIdx ? { ...s, elements: (s.elements ?? []).filter((el) => el.id !== id) } : s
    );
    pushHistory(ns);
    setSelectedId(null);
  }, [slides, activeIdx, pushHistory]);

  const duplicateElement = useCallback((id: string) => {
    const el = activeSlide?.elements?.find((e) => e.id === id);
    if (!el) return;
    const dup: CanvasElement = { ...el, id: `el-dup-${Date.now()}`, x: el.x + 20, y: el.y + 20, zIndex: (activeSlide.elements?.length ?? 0) + 1 };
    addElement(dup);
    setSelectedId(dup.id);
  }, [activeSlide, addElement]);

  const reorder = useCallback((id: string, mode: "forward" | "backward" | "front" | "back") => {
    setSlides((prev) => prev.map((s, i) => {
      if (i !== activeIdx) return s;
      const els = [...(s.elements ?? [])].sort((a, b) => a.zIndex - b.zIndex);
      const idx = els.findIndex((e) => e.id === id);
      if (idx === -1) return s;
      let updated = els.map((e) => ({ ...e }));
      if (mode === "front") {
        const max = Math.max(...updated.map((e) => e.zIndex));
        updated[idx].zIndex = max + 1;
      } else if (mode === "back") {
        const min = Math.min(...updated.map((e) => e.zIndex));
        updated[idx].zIndex = min - 1;
      } else if (mode === "forward" && idx < els.length - 1) {
        const tmp = updated[idx].zIndex;
        updated[idx].zIndex = updated[idx + 1].zIndex;
        updated[idx + 1].zIndex = tmp;
      } else if (mode === "backward" && idx > 0) {
        const tmp = updated[idx].zIndex;
        updated[idx].zIndex = updated[idx - 1].zIndex;
        updated[idx - 1].zIndex = tmp;
      }
      return { ...s, elements: updated };
    }));
  }, [activeIdx]);

  const textCommit = useCallback((id: string, text: string) => {
    updateElement(id, { text });
    setEditingId(null);
  }, [updateElement]);

  // ── Template loader ──
  const loadTemplate = useCallback((templateId: string) => {
    const tpl = INTEGRITY_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const ns: Slide[] = tpl.slides.map((s) => ({
      ...s, id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: { ...s.content }, style: { ...s.style },
      elements: slideToElements(s),
    }));
    pushHistory(ns);
    setActiveIdx(0);
    setSelectedId(null);
  }, [pushHistory]);

  const applyTheme = useCallback((theme: BrandTheme) => {
    setSlides((prev) => prev.map((s) => ({
      ...s, style: { ...s.style, bgColor: theme.bgColor, headlineColor: theme.headlineColor, bodyColor: theme.bodyColor, accentColor: theme.accentColor, ctaBgColor: theme.ctaBgColor, ctaColor: theme.ctaColor, fontFamily: theme.fontFamily },
    })));
  }, []);

  // ── Save ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = { title, format: "carousel" as ContentFormat, metadata: { slides } };
      if (!draftId) {
        const d = await createDraft(payload);
        setDraftId(d.id);
      } else {
        await apiUpdateDraft(draftId, { title, metadata: { slides } });
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setSavedAt("local");
    } finally {
      setSaving(false);
    }
  }, [title, slides, draftId]);

  useEffect(() => {
    const t = setTimeout(handleSave, 3000);
    return () => clearTimeout(t);
  }, [slides, title]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export ──
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Save first so the backend has the latest slides
      let id = draftId;
      if (!id) {
        const d = await createDraft({ title, format: "carousel" as ContentFormat, metadata: { slides } });
        setDraftId(d.id);
        id = d.id;
      } else {
        await apiUpdateDraft(id, { title, metadata: { slides } });
      }
      const res = await fetch(`${API_BASE}/drafts/${id}/render-carousel`);
      if (!res.ok) throw new Error(`Render failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  }, [slides, title, draftId, API_BASE]);

  // ── Schedule ──
  const handleSchedule = useCallback(async () => {
    if (!scheduleTime) return;
    setScheduling(true);
    setScheduleMsg(null);
    try {
      // Ensure draft is saved first
      let id = draftId;
      if (!id) {
        const d = await createDraft({ title, format: "carousel" as ContentFormat, metadata: { slides } });
        setDraftId(d.id);
        id = d.id;
      } else {
        await apiUpdateDraft(id, { title, metadata: { slides } });
      }
      await scheduleDraft(id, { scheduled_for: new Date(scheduleTime).toISOString(), notes: scheduleNotes || undefined });
      setScheduleMsg("Scheduled!");
      setTimeout(() => { setShowSchedule(false); setScheduleMsg(null); }, 1500);
    } catch {
      setScheduleMsg("Failed to schedule");
    } finally {
      setScheduling(false);
    }
  }, [draftId, title, slides, scheduleTime, scheduleNotes]);

  // ── Assets ──
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(false);
    try {
      const data = await fetchAssets({ media_type: "image", limit: 24, offset: assetsPage * 24, ...(assetSearch ? { search: assetSearch } : {}) });
      setAssets(data.assets); setAssetsTotal(data.total);
    } catch { setAssets([]); setAssetsError(true); }
    finally { setAssetsLoading(false); }
  }, [assetsPage, assetSearch]);

  useEffect(() => { if (leftPanel === "media") loadAssets(); }, [leftPanel, loadAssets]);
  useEffect(() => { setAssetsPage(0); }, [assetSearch]);

  // ── ?draft= query param — load existing carousel ──────────────────────────
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draft");
    if (!id) return;
    fetchDraft(id).then((d) => {
      const savedSlides = d.metadata?.slides as Slide[] | undefined;
      if (savedSlides && savedSlides.length > 0) {
        setSlides(savedSlides);
        setHistory([savedSlides]);
        setHistIdx(0);
      }
      if (d.title) setTitle(d.title);
      setDraftId(d.id);
      setSavedAt("loaded");
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ?asset= query param (read from URL directly — no useSearchParams needed) ──
  useEffect(() => {
    const assetId = new URLSearchParams(window.location.search).get("asset");
    if (!assetId) return;
    fetchAsset(assetId).then((asset) => {
      const id = `el-${Date.now()}`;
      addElement({ id, type: "image", x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, rotation: 0, opacity: 80, locked: false, zIndex: 1, assetId: asset.id, objectFit: "cover" });
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scale canvas ──
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const sw = (width - 64) / CANVAS_W;
      const sh = (height - 80) / CANVAS_H;
      setZoom(Math.max(20, Math.min(100, Math.round(Math.min(sw, sh) * 100))));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "v" || e.key === "V") { setActiveTool("select"); return; }
      if (e.key === "t" || e.key === "T") { setActiveTool("text"); return; }
      if (e.key === "r" || e.key === "R") { setActiveTool("rect"); return; }
      if (e.key === "Escape") { setSelectedId(null); setEditingId(null); setActiveTool("select"); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteElement(selectedId); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); redo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedId) { e.preventDefault(); duplicateElement(selectedId); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, undo, redo, deleteElement, duplicateElement, handleSave]);

  // ── Image helpers ──
  const addImageElement = (assetId: string) => {
    const id = `el-${Date.now()}`;
    addElement({ id, type: "image", x: 40, y: 40, width: 500, height: 500, rotation: 0, opacity: 100, locked: false, zIndex: (activeSlide.elements?.length ?? 0) + 1, assetId, objectFit: "cover", borderRadius: 0 });
    setSelectedId(id);
    setLeftPanel(null);
  };

  const setSlideBackground = (assetId: string) => {
    setSlides((prev) => prev.map((s, i) =>
      i === activeIdx ? { ...s, image: { assetId, url: `${API_BASE}/assets/${assetId}/file`, mode: "background", x: 50, y: 50, width: 100, opacity: 80 } } : s
    ));
    setLeftPanel(null);
  };

  const togglePanel = (panel: LeftPanel) => setLeftPanel((p) => p === panel ? null : panel);

  // ── CSS vars ──
  const bg0 = "#0d0d1a";
  const bg1 = "#13131f";
  const bg2 = "#1a1a2e";
  const border = "rgba(255,255,255,0.08)";
  const green = "#39de8b";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: bg1, color: "#fff", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 52, backgroundColor: bg0, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <a href="/carousels" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 18, padding: "4px 6px", borderRadius: 6 }} title="Back">←</a>
        <div style={{ width: 1, height: 20, backgroundColor: border }} />
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          style={{ background: "transparent", border: "none", outline: "none", color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, minWidth: 0, maxWidth: 200 }}
          placeholder="Untitled Carousel"
        />
        <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
          {[{ fn: undo, icon: "↩", disabled: histIdx <= 0 }, { fn: redo, icon: "↪", disabled: histIdx >= history.length - 1 }].map(({ fn, icon, disabled }) => (
            <button key={icon} onClick={fn} disabled={disabled}
              style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: disabled ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)", cursor: disabled ? "not-allowed" : "pointer", borderRadius: 6, fontSize: 14 }}>
              {icon}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          <button onClick={() => setZoom(Math.max(20, zoom - 5))} style={{ width: 24, height: 24, background: "none", border: "none", color: "inherit", cursor: "pointer", borderRadius: 4, fontSize: 16 }}>−</button>
          <span style={{ width: 42, textAlign: "center" }}>{zoom}%</span>
          <button onClick={() => setZoom(Math.min(120, zoom + 5))} style={{ width: 24, height: 24, background: "none", border: "none", color: "inherit", cursor: "pointer", borderRadius: 4, fontSize: 16 }}>+</button>
        </div>
        {/* Grid toggle */}
        <button onClick={() => setShowGrid(!showGrid)}
          style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: showGrid ? "rgba(57,222,139,0.15)" : "none", border: "none", color: showGrid ? green : "rgba(255,255,255,0.3)", cursor: "pointer", borderRadius: 6, fontSize: 14 }}
          title="Toggle grid">⊞</button>
        <div style={{ width: 1, height: 20, backgroundColor: border }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{slides.length} slides</span>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "0 12px", height: 30, background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer" }}>
          {saving ? "Saving…" : savedAt ? `✓ ${savedAt}` : "Save"}
        </button>
        <button onClick={handleExport} disabled={exporting}
          style={{ padding: "0 12px", height: 30, background: "rgba(255,255,255,0.06)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer", opacity: exporting ? 0.5 : 1 }}>
          {exporting ? "Exporting…" : "↓ Export"}
        </button>
        <button onClick={() => setShowSchedule(true)}
          style={{ padding: "0 14px", height: 30, background: green, border: "none", borderRadius: 6, color: "#0a2010", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Schedule ↗
        </button>
      </div>

      {/* ── MAIN ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* ── LEFT ICON BAR ── */}
        <nav style={{ width: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, paddingTop: 8, backgroundColor: bg0, borderRight: `1px solid ${border}`, flexShrink: 0 }}>
          {([
            { p: "slides" as LeftPanel, icon: "▦", label: "Pages" },
            { p: "elements" as LeftPanel, icon: "+", label: "Add" },
            { p: "templates" as LeftPanel, icon: "⊞", label: "Templates" },
            { p: "media" as LeftPanel, icon: "🖼", label: "Media" },
            { p: "brand" as LeftPanel, icon: "🎨", label: "Brand" },
          ] as { p: LeftPanel; icon: string; label: string }[]).map(({ p, icon, label }) => (
            <button key={label} onClick={() => togglePanel(p)}
              style={{
                width: 40, height: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                background: leftPanel === p ? "rgba(57,222,139,0.15)" : "none",
                border: "none", borderRadius: 8,
                color: leftPanel === p ? green : "rgba(255,255,255,0.35)",
                cursor: "pointer", fontSize: 14,
              }}
              title={label}>
              <span style={{ fontSize: 15 }}>{icon}</span>
              <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</span>
            </button>
          ))}
        </nav>

        {/* ── LEFT PANEL ── */}
        {leftPanel && (
          <div style={{ width: 236, backgroundColor: bg0, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>

            {/* SLIDES */}
            {leftPanel === "slides" && (
              <>
                <div style={{ padding: "8px 10px 6px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Pages</span>
                  <button onClick={addSlide}
                    style={{ fontSize: 11, padding: "2px 8px", background: "rgba(57,222,139,0.12)", border: "none", borderRadius: 5, color: green, cursor: "pointer", fontWeight: 600 }}>
                    + Add
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {slides.map((sl, i) => (
                    <div key={sl.id} onClick={() => { setActiveIdx(i); setSelectedId(null); }}
                      style={{ position: "relative", borderRadius: 6, overflow: "hidden", cursor: "pointer", border: `2px solid ${i === activeIdx ? green : "transparent"}`, flexShrink: 0 }}>
                      <div style={{ width: CANVAS_W * PANEL_SCALE, height: CANVAS_H * PANEL_SCALE, overflow: "hidden", borderRadius: 4 }}>
                        <SlideCanvas slide={sl} scale={PANEL_SCALE} />
                      </div>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 6px", background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{i + 1}</span>
                        <div style={{ display: "flex", gap: 3 }}>
                          <button onClick={(e) => { e.stopPropagation(); duplicateSlide(i); }}
                            style={{ width: 18, height: 18, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", fontSize: 9 }}>⧉</button>
                          {slides.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); deleteSlide(i); }}
                              style={{ width: 18, height: 18, background: "rgba(239,68,68,0.2)", border: "none", borderRadius: 3, color: "#f87171", cursor: "pointer", fontSize: 9 }}>✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ELEMENTS */}
            {leftPanel === "elements" && (
              <>
                <div style={{ padding: "8px 10px 6px", borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Elements</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Text</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {([
                        { label: "Heading", size: 56, weight: "900" },
                        { label: "Subheading", size: 32, weight: "700" },
                        { label: "Body Text", size: 20, weight: "400" },
                        { label: "Small Text", size: 14, weight: "400" },
                      ] as { label: string; size: number; weight: string }[]).map(({ label, size, weight }) => (
                        <button key={label}
                          onClick={() => {
                            const id = `el-${Date.now()}`;
                            const existingCount = activeSlide.elements?.length ?? 0;
                            const yPos = Math.min(80 + existingCount * (size * 1.6 + 16), CANVAS_H - size * 2 - 40);
                            addElement({ id, type: "text", x: 40, y: yPos, width: CANVAS_W - 80, height: size * 2, rotation: 0, opacity: 100, locked: false, zIndex: existingCount + 1, text: label, fontSize: size, fontFamily: activeSlide.style.fontFamily, fontWeight: weight, color: "#FFFFFF", textAlign: "left", lineHeight: 1.2, letterSpacing: 0 });
                            setSelectedId(id);
                            setTimeout(() => setEditingId(id), 60);
                          }}
                          style={{ textAlign: "left", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: Math.min(size * 0.3, 16), fontWeight: weight }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Divider />
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Shapes</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {([
                        { label: "Rect", shapeType: "rect" as const, icon: "■" },
                        { label: "Circle", shapeType: "circle" as const, icon: "●" },
                        { label: "Line", shapeType: "rect" as const, icon: "—", thin: true },
                      ] as { label: string; shapeType: "rect"|"circle"; icon: string; thin?: boolean }[]).map(({ label, shapeType, icon, thin }) => (
                        <button key={label}
                          onClick={() => {
                            const id = `el-${Date.now()}`;
                            addElement({ id, type: "shape", x: 100, y: 200, width: thin ? 800 : 300, height: thin ? 8 : 300, rotation: 0, opacity: 100, locked: false, zIndex: (activeSlide.elements?.length ?? 0) + 1, fill: activeSlide.style.accentColor, stroke: "none", strokeWidth: 0, borderRadius: shapeType === "circle" ? 9999 : 0, shapeType });
                            setSelectedId(id);
                          }}
                          style={{ padding: "10px 4px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 18 }}>
                          <span>{icon}</span>
                          <span style={{ fontSize: 9 }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Divider />
                  <div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Drawing tools</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                      {([
                        { key: "text" as Tool, icon: "T", label: "Text" },
                        { key: "rect" as Tool, icon: "□", label: "Rectangle" },
                        { key: "circle" as Tool, icon: "○", label: "Circle" },
                      ] as { key: Tool; icon: string; label: string }[]).map(({ key, icon, label }) => (
                        <button key={key} onClick={() => setActiveTool(key)}
                          style={{ padding: "7px 4px", background: activeTool === key ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${activeTool === key ? green : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: activeTool === key ? green : "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12 }}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>Click or drag on the canvas to place</p>
                  </div>
                </div>
              </>
            )}

            {/* TEMPLATES */}
            {leftPanel === "templates" && (
              <>
                <div style={{ padding: "8px 10px 6px", borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Templates</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {INTEGRITY_TEMPLATES.map((tpl) => (
                    <button key={tpl.id} onClick={() => loadTemplate(tpl.id)}
                      style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden", cursor: "pointer", padding: 0, width: "100%" }}>
                      <div style={{ display: "flex", gap: 3, padding: 6, background: "rgba(0,0,0,0.2)" }}>
                        {tpl.slides.slice(0, 4).map((sl) => (
                          <div key={sl.id} style={{ flex: 1, height: CANVAS_H * TPLTHUMB_SCALE, overflow: "hidden", borderRadius: 3 }}>
                            <SlideCanvas slide={sl} scale={TPLTHUMB_SCALE} />
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: "6px 8px" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: 0 }}>{tpl.icon} {tpl.name}</p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>{tpl.slides.length} slides · {tpl.tagline}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* MEDIA */}
            {leftPanel === "media" && (
              <>
                <div style={{ padding: "8px 10px 6px", borderBottom: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Media Library</span>
                  <input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="Search images…"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#fff", outline: "none", width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                  {/* Upload button */}
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", marginBottom: 8, background: "rgba(57,222,139,0.08)", border: `1px dashed rgba(57,222,139,0.3)`, borderRadius: 6, color: green, fontSize: 12, cursor: "pointer" }}>
                    <input type="file" accept="image/*" multiple style={{ display: "none" }}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        for (const file of files) {
                          try {
                            const form = new FormData();
                            form.append("file", file);
                            const res = await fetch(`${API_BASE}/assets/upload`, { method: "POST", body: form });
                            if (res.ok) { await loadAssets(); }
                          } catch { /* ignore */ }
                        }
                        e.target.value = "";
                      }} />
                    ↑ Upload images
                  </label>

                  {assetsLoading ? (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", marginTop: 20 }}>Loading…</p>
                  ) : assetsError ? (
                    <div style={{ textAlign: "center", padding: "16px 8px" }}>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "0 0 8px" }}>Could not reach API server</p>
                      <button onClick={loadAssets} style={{ fontSize: 11, padding: "4px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 5, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Retry</button>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                      {assets.map((asset) => (
                        <div key={asset.id} style={{ position: "relative", aspectRatio: "1", background: "rgba(255,255,255,0.05)", borderRadius: 5, overflow: "hidden", cursor: "pointer" }}
                          onClick={() => addImageElement(asset.id)}>
                          <img src={`${API_BASE}/assets/${asset.id}/file`} alt={asset.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", opacity: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}>
                            <button onClick={(ev) => { ev.stopPropagation(); addImageElement(asset.id); }}
                              style={{ fontSize: 10, padding: "3px 8px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", width: "85%" }}>Add</button>
                            <button onClick={(ev) => { ev.stopPropagation(); setSlideBackground(asset.id); }}
                              style={{ fontSize: 10, padding: "3px 8px", background: "rgba(57,222,139,0.25)", border: "none", borderRadius: 4, color: green, cursor: "pointer", width: "85%" }}>Set BG</button>
                          </div>
                        </div>
                      ))}
                      {assets.length === 0 && <p style={{ gridColumn: "span 3", fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", padding: 20 }}>No images found.<br/>Try uploading above.</p>}
                    </div>
                  )}
                  {assetsTotal > 24 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button disabled={assetsPage === 0} onClick={() => setAssetsPage(p => p - 1)}
                        style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 5, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}>Prev</button>
                      <button disabled={(assetsPage + 1) * 24 >= assetsTotal} onClick={() => setAssetsPage(p => p + 1)}
                        style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 5, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}>Next</button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* BRAND */}
            {leftPanel === "brand" && (
              <>
                <div style={{ padding: "8px 10px 6px", borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Brand Themes</span>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                  {DEFAULT_THEMES.map((theme) => (
                    <button key={theme.id} onClick={() => applyTheme(theme)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, cursor: "pointer", textAlign: "left" }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {[theme.bgColor, theme.headlineColor, theme.accentColor].map((c, ci) => (
                          <span key={ci} style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: c, border: "1px solid rgba(255,255,255,0.1)", display: "inline-block" }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{theme.name}</span>
                    </button>
                  ))}
                  <Divider />
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Slide Font</p>
                  <select value={activeSlide?.style.fontFamily ?? ""} onChange={(e) => updateSlideStyle({ fontFamily: e.target.value })}
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#fff", width: "100%" }}>
                    {BRAND_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Arial', sans-serif">Arial</option>
                  </select>
                </div>
              </>
            )}

          </div>
        )}

        {/* ── CANVAS AREA ── */}
        <div ref={canvasAreaRef}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "auto", backgroundColor: bg2, position: "relative", minWidth: 0 }}>

          {/* Tool bar */}
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4, background: bg0, border: `1px solid ${border}`, borderRadius: 10, padding: "5px 8px", zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
            {([
              { key: "select" as Tool, icon: "↖", label: "Select (V)" },
              { key: "text" as Tool, icon: "T", label: "Text (T)" },
              { key: "rect" as Tool, icon: "□", label: "Rectangle (R)" },
              { key: "circle" as Tool, icon: "○", label: "Circle" },
            ] as { key: Tool; icon: string; label: string }[]).map(({ key, icon, label }) => (
              <button key={key} onClick={() => setActiveTool(key)} title={label}
                style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "none", background: activeTool === key ? green : "none", color: activeTool === key ? "#0a2010" : "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
                {icon}
              </button>
            ))}
            {selectedId && (
              <>
                <div style={{ width: 1, height: 20, background: border, margin: "0 4px" }} />
                <button onClick={() => duplicateElement(selectedId)} title="Duplicate (⌘D)"
                  style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", borderRadius: 6, fontSize: 14 }}>⧉</button>
                <button onClick={() => deleteElement(selectedId)} title="Delete"
                  style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "rgba(239,68,68,0.5)", cursor: "pointer", borderRadius: 6, fontSize: 14 }}>✕</button>
              </>
            )}
          </div>

          {/* Canvas */}
          <div style={{ marginTop: 52, boxShadow: "0 8px 48px rgba(0,0,0,0.6)", flexShrink: 0, position: "relative" }}>
            <InteractiveCanvas
              slide={activeSlide} scale={scale}
              selectedId={selectedId} editingId={editingId}
              activeTool={activeTool}
              onSelect={(id) => { setSelectedId(id); if (id && activeTool !== "select") setActiveTool("select"); }}
              onEditStart={setEditingId}
              onTextCommit={textCommit}
              onUpdateElement={updateElement}
              onAddElement={addElement}
              showGrid={showGrid}
              API_BASE={API_BASE}
            />
            {/* Empty-canvas hint */}
            {(!activeSlide.elements || activeSlide.elements.length === 0) && !activeSlide.image && activeTool === "select" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 8 }}>
                <p style={{ fontSize: 13 * scale, color: "rgba(255,255,255,0.2)", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                  Press <strong style={{ color: "rgba(255,255,255,0.4)" }}>T</strong> then click to add text<br />
                  or use the <strong style={{ color: "rgba(255,255,255,0.4)" }}>+ Elements</strong> panel
                </p>
              </div>
            )}
          </div>

          {/* Canvas info */}
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", margin: "6px 0 4px" }}>
            Slide {activeIdx + 1}/{slides.length} · {CANVAS_W}×{CANVAS_H}
          </p>
        </div>

        {/* ── RIGHT PROPERTIES PANEL ── */}
        <div style={{ width: 256, backgroundColor: bg0, borderLeft: `1px solid ${border}`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ padding: "8px 12px 6px", borderBottom: `1px solid ${border}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {!selectedEl ? "Slide" : selectedEl.type === "text" ? "Text" : selectedEl.type === "image" ? "Image" : "Shape"}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── SLIDE BACKGROUND ── */}
            {!selectedEl && (
              <>
                <PropRow label="Background Color">
                  <ColorRow value={activeSlide?.style.bgColor ?? "#000"} onChange={(v) => updateSlideStyle({ bgColor: v })} />
                </PropRow>

                {activeSlide?.image && (
                  <>
                    <PropRow label="BG Image Opacity">
                      <SliderRow value={activeSlide.image.opacity} min={0} max={100}
                        onChange={(v) => setSlides((prev) => prev.map((s, i) => i === activeIdx && s.image ? { ...s, image: { ...s.image, opacity: v } } : s))} />
                    </PropRow>
                    <button
                      onClick={() => setCropTarget({ kind: "background" })}
                      style={{ padding: "7px 0", background: "rgba(57,222,139,0.07)", border: `1px solid rgba(57,222,139,0.2)`, borderRadius: 6, color: "rgba(57,222,139,0.8)", fontSize: 12, cursor: "pointer" }}
                    >
                      ✂ Crop Background
                    </button>
                  </>
                )}

                <PropRow label="Overlay Darkness">
                  <SliderRow value={activeSlide?.style.bgOverlayOpacity ?? 0} min={0} max={100}
                    onChange={(v) => updateSlideStyle({ bgOverlayOpacity: v })} />
                </PropRow>

                <button onClick={() => togglePanel("media")}
                  style={{ padding: "7px 0", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer" }}>
                  {activeSlide?.image ? "Change background image" : "+ Add background image"}
                </button>
                {activeSlide?.image && (
                  <button onClick={() => setSlides((prev) => prev.map((s, i) => i === activeIdx ? { ...s, image: null } : s))}
                    style={{ padding: "6px 0", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "rgba(248,113,113,0.7)", fontSize: 12, cursor: "pointer" }}>
                    Remove background image
                  </button>
                )}
                <Divider />
                <PropRow label="Slide size">
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>{CANVAS_W}×{CANVAS_H}px · 4:5</p>
                </PropRow>
                <Divider />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button onClick={addSlide} style={{ padding: "7px 0", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer" }}>+ New slide</button>
                  <button onClick={() => duplicateSlide(activeIdx)} style={{ padding: "7px 0", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer" }}>Duplicate</button>
                  {slides.length > 1 && (
                    <button onClick={() => deleteSlide(activeIdx)} style={{ gridColumn: "span 2", padding: "7px 0", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "rgba(248,113,113,0.7)", fontSize: 12, cursor: "pointer" }}>Delete slide</button>
                  )}
                </div>
              </>
            )}

            {/* ── TEXT ── */}
            {selectedEl?.type === "text" && (
              <>
                <PropRow label="Text">
                  <textarea value={selectedEl.text ?? ""} onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })} rows={3}
                    style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#fff", resize: "none", outline: "none", width: "100%", boxSizing: "border-box" }} />
                </PropRow>
                <PropRow label="Font">
                  <select value={selectedEl.fontFamily ?? ""} onChange={(e) => updateElement(selectedEl.id, { fontFamily: e.target.value })}
                    style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#fff", width: "100%" }}>
                    {BRAND_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Arial', sans-serif">Arial</option>
                  </select>
                </PropRow>
                <PropRow label="Size">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min={6} max={300} value={selectedEl.fontSize ?? 32}
                      onChange={(e) => updateElement(selectedEl.id, { fontSize: Number(e.target.value) })}
                      style={{ flex: 1, accentColor: green }} />
                    <input type="number" min={1} value={selectedEl.fontSize ?? 32}
                      onChange={(e) => updateElement(selectedEl.id, { fontSize: Number(e.target.value) })}
                      style={{ width: 52, background: "rgba(255,255,255,0.08)", border: `1px solid ${border}`, borderRadius: 6, padding: "3px 6px", fontSize: 12, color: "#fff", textAlign: "center" }} />
                  </div>
                </PropRow>
                <PropRow label="Weight">
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["400", "700", "900"] as const).map((w) => (
                      <button key={w} onClick={() => updateElement(selectedEl.id, { fontWeight: w })}
                        style={{ flex: 1, padding: "5px 0", background: selectedEl.fontWeight === w ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${selectedEl.fontWeight === w ? green : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: selectedEl.fontWeight === w ? green : "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer", fontWeight: w }}>
                        {w === "400" ? "Reg" : w === "700" ? "Bold" : "Black"}
                      </button>
                    ))}
                    <button onClick={() => updateElement(selectedEl.id, { fontStyle: selectedEl.fontStyle === "italic" ? "normal" : "italic" })}
                      style={{ padding: "5px 8px", background: selectedEl.fontStyle === "italic" ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${selectedEl.fontStyle === "italic" ? green : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: selectedEl.fontStyle === "italic" ? green : "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", fontStyle: "italic" }}>
                      I
                    </button>
                  </div>
                </PropRow>
                <PropRow label="Align">
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} onClick={() => updateElement(selectedEl.id, { textAlign: a })}
                        style={{ flex: 1, padding: "5px 0", background: selectedEl.textAlign === a ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${selectedEl.textAlign === a ? green : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: selectedEl.textAlign === a ? green : "rgba(255,255,255,0.45)", fontSize: 13, cursor: "pointer" }}>
                        {a === "left" ? "⬛L" : a === "center" ? "⬛C" : "⬛R"}
                      </button>
                    ))}
                  </div>
                </PropRow>
                <PropRow label="Color">
                  <ColorRow value={selectedEl.color ?? "#fff"} onChange={(v) => updateElement(selectedEl.id, { color: v })} />
                </PropRow>
                <PropRow label="Line Height">
                  <SliderRow value={selectedEl.lineHeight ?? 1.2} min={0.8} max={3} step={0.05}
                    onChange={(v) => updateElement(selectedEl.id, { lineHeight: v })} />
                </PropRow>
                <PropRow label="Letter Spacing">
                  <SliderRow value={selectedEl.letterSpacing ?? 0} min={-5} max={30}
                    onChange={(v) => updateElement(selectedEl.id, { letterSpacing: v })} />
                </PropRow>
                <PropRow label="Opacity">
                  <SliderRow value={selectedEl.opacity} min={0} max={100}
                    onChange={(v) => updateElement(selectedEl.id, { opacity: v })} />
                </PropRow>
                <Divider />
                <PropRow label="Position">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>X</label><NumInput value={selectedEl.x} onChange={(v) => updateElement(selectedEl.id, { x: v })} /></div>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Y</label><NumInput value={selectedEl.y} onChange={(v) => updateElement(selectedEl.id, { y: v })} /></div>
                  </div>
                </PropRow>
                <PropRow label="Size">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>W</label><NumInput value={selectedEl.width} onChange={(v) => updateElement(selectedEl.id, { width: v })} min={20} /></div>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>H</label><NumInput value={selectedEl.height} onChange={(v) => updateElement(selectedEl.id, { height: v })} min={10} /></div>
                  </div>
                </PropRow>
                <Divider />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => reorder(selectedEl.id, "back")} title="Send to Back" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>⇊</button>
                  <button onClick={() => reorder(selectedEl.id, "backward")} title="Send Backward" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>↓</button>
                  <button onClick={() => reorder(selectedEl.id, "forward")} title="Bring Forward" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>↑</button>
                  <button onClick={() => reorder(selectedEl.id, "front")} title="Bring to Front" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>⇈</button>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => duplicateElement(selectedEl.id)} style={{ flex: 1, padding: "6px 0", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>⧉ Dup</button>
                  <button onClick={() => deleteElement(selectedEl.id)} style={{ padding: "6px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "rgba(248,113,113,0.7)", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              </>
            )}

            {/* ── IMAGE ── */}
            {selectedEl?.type === "image" && (
              <>
                <PropRow label="Opacity"><SliderRow value={selectedEl.opacity} min={0} max={100} onChange={(v) => updateElement(selectedEl.id, { opacity: v })} /></PropRow>
                <PropRow label="Object Fit">
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["cover", "contain", "fill"] as const).map((fit) => (
                      <button key={fit} onClick={() => updateElement(selectedEl.id, { objectFit: fit })}
                        style={{ flex: 1, padding: "5px 0", background: selectedEl.objectFit === fit ? "rgba(57,222,139,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${selectedEl.objectFit === fit ? green : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: selectedEl.objectFit === fit ? green : "rgba(255,255,255,0.45)", fontSize: 10, cursor: "pointer", textTransform: "capitalize" }}>
                        {fit}
                      </button>
                    ))}
                  </div>
                </PropRow>
                <PropRow label="Corner Radius"><SliderRow value={selectedEl.borderRadius ?? 0} min={0} max={540} onChange={(v) => updateElement(selectedEl.id, { borderRadius: v })} /></PropRow>
                <Divider />
                <PropRow label="Position">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>X</label><NumInput value={selectedEl.x} onChange={(v) => updateElement(selectedEl.id, { x: v })} /></div>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Y</label><NumInput value={selectedEl.y} onChange={(v) => updateElement(selectedEl.id, { y: v })} /></div>
                  </div>
                </PropRow>
                <PropRow label="Size">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>W</label><NumInput value={selectedEl.width} onChange={(v) => updateElement(selectedEl.id, { width: v })} min={20} /></div>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>H</label><NumInput value={selectedEl.height} onChange={(v) => updateElement(selectedEl.id, { height: v })} min={20} /></div>
                  </div>
                </PropRow>
                <Divider />
                <button onClick={() => togglePanel("media")} style={{ padding: "7px 0", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer" }}>Replace image →</button>
                <button
                  onClick={() => setCropTarget({ kind: "element", elementId: selectedEl.id })}
                  style={{ padding: "7px 0", background: "rgba(57,222,139,0.07)", border: `1px solid rgba(57,222,139,0.2)`, borderRadius: 6, color: "rgba(57,222,139,0.8)", fontSize: 12, cursor: "pointer" }}
                >
                  ✂ Crop Image
                </button>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => reorder(selectedEl.id, "back")} title="Send to Back" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>⇊</button>
                  <button onClick={() => reorder(selectedEl.id, "backward")} title="Send Backward" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>↓</button>
                  <button onClick={() => reorder(selectedEl.id, "forward")} title="Bring Forward" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>↑</button>
                  <button onClick={() => reorder(selectedEl.id, "front")} title="Bring to Front" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>⇈</button>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => duplicateElement(selectedEl.id)} style={{ flex: 1, padding: "6px 0", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>⧉ Dup</button>
                  <button onClick={() => deleteElement(selectedEl.id)} style={{ padding: "6px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "rgba(248,113,113,0.7)", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              </>
            )}

            {/* ── SHAPE ── */}
            {selectedEl?.type === "shape" && (
              <>
                <PropRow label="Fill Color"><ColorRow value={selectedEl.fill ?? green} onChange={(v) => updateElement(selectedEl.id, { fill: v })} /></PropRow>
                <PropRow label="Opacity"><SliderRow value={selectedEl.opacity} min={0} max={100} onChange={(v) => updateElement(selectedEl.id, { opacity: v })} /></PropRow>
                <PropRow label="Corner Radius"><SliderRow value={selectedEl.borderRadius ?? 0} min={0} max={9999} onChange={(v) => updateElement(selectedEl.id, { borderRadius: v })} /></PropRow>
                <PropRow label="Stroke Color"><ColorRow value={selectedEl.stroke && selectedEl.stroke !== "none" ? selectedEl.stroke : "#ffffff"} onChange={(v) => updateElement(selectedEl.id, { stroke: v })} /></PropRow>
                <PropRow label="Stroke Width">
                  <SliderRow value={selectedEl.strokeWidth ?? 0} min={0} max={20}
                    onChange={(v) => updateElement(selectedEl.id, { strokeWidth: v, stroke: v === 0 ? "none" : (selectedEl.stroke ?? "#fff") })} />
                </PropRow>
                <Divider />
                <PropRow label="Position">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>X</label><NumInput value={selectedEl.x} onChange={(v) => updateElement(selectedEl.id, { x: v })} /></div>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Y</label><NumInput value={selectedEl.y} onChange={(v) => updateElement(selectedEl.id, { y: v })} /></div>
                  </div>
                </PropRow>
                <PropRow label="Size">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>W</label><NumInput value={selectedEl.width} onChange={(v) => updateElement(selectedEl.id, { width: v })} min={1} /></div>
                    <div><label style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>H</label><NumInput value={selectedEl.height} onChange={(v) => updateElement(selectedEl.id, { height: v })} min={1} /></div>
                  </div>
                </PropRow>
                <Divider />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => reorder(selectedEl.id, "back")} title="Send to Back" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>⇊</button>
                  <button onClick={() => reorder(selectedEl.id, "backward")} title="Send Backward" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>↓</button>
                  <button onClick={() => reorder(selectedEl.id, "forward")} title="Bring Forward" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>↑</button>
                  <button onClick={() => reorder(selectedEl.id, "front")} title="Bring to Front" style={{ flex: 1, padding: "5px 0", background: "rgba(255,255,255,0.04)", border: `1px solid ${border}`, borderRadius: 5, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>⇈</button>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => duplicateElement(selectedEl.id)} style={{ flex: 1, padding: "6px 0", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>⧉ Dup</button>
                  <button onClick={() => deleteElement(selectedEl.id)} style={{ padding: "6px 10px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "rgba(248,113,113,0.7)", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      {/* ── BOTTOM SLIDE STRIP ── */}
      <div style={{ height: 128, backgroundColor: bg0, borderTop: `1px solid ${border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", overflowX: "auto" }}>
        {slides.map((sl, i) => (
          <div key={sl.id} onClick={() => { setActiveIdx(i); setSelectedId(null); }}
            style={{
              flexShrink: 0, cursor: "pointer", borderRadius: 6, overflow: "hidden",
              border: `2px solid ${i === activeIdx ? green : "transparent"}`,
              boxShadow: i === activeIdx ? `0 0 12px ${green}40` : "none",
              width: CANVAS_W * STRIP_SCALE, height: CANVAS_H * STRIP_SCALE,
              position: "relative",
            }}>
            <SlideCanvas slide={sl} scale={STRIP_SCALE} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.4)", padding: "1px 0" }}>{i + 1}</div>
          </div>
        ))}
        <button onClick={addSlide}
          style={{
            flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            width: CANVAS_W * STRIP_SCALE, height: CANVAS_H * STRIP_SCALE,
            background: "none", border: `2px dashed rgba(255,255,255,0.12)`, borderRadius: 6,
            color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 20,
          }}>
          <span>+</span>
          <span style={{ fontSize: 9, marginTop: 2 }}>Add</span>
        </button>
      </div>

      {/* ── CROP MODAL ── */}
    {cropTarget && activeSlide && (() => {
      let imageUrl: string | null = null;
      let initialCrop = undefined;

      if (cropTarget.kind === "background" && activeSlide.image) {
        imageUrl = `${API_BASE}/assets/${activeSlide.image.assetId}/file`;
        if (activeSlide.image.cropW != null) {
          initialCrop = { x: activeSlide.image.cropX ?? 0, y: activeSlide.image.cropY ?? 0, w: activeSlide.image.cropW, h: activeSlide.image.cropH ?? 100 };
        }
      } else if (cropTarget.kind === "element") {
        const el = activeSlide.elements?.find((e) => e.id === cropTarget.elementId);
        if (el?.assetId) {
          imageUrl = `${API_BASE}/assets/${el.assetId}/file`;
          if (el.cropW != null) {
            initialCrop = { x: el.cropX ?? 0, y: el.cropY ?? 0, w: el.cropW, h: el.cropH ?? 100 };
          }
        }
      }

      if (!imageUrl) return null;

      const onConfirm = (crop: { x: number; y: number; w: number; h: number }) => {
        if (cropTarget.kind === "background") {
          setSlides((prev) => prev.map((s, i) =>
            i === activeIdx && s.image
              ? { ...s, image: { ...s.image, cropX: crop.x, cropY: crop.y, cropW: crop.w, cropH: crop.h } }
              : s
          ));
        } else {
          updateElement(cropTarget.elementId, { cropX: crop.x, cropY: crop.y, cropW: crop.w, cropH: crop.h });
        }
        setCropTarget(null);
      };

      return (
        <CropModal
          imageUrl={imageUrl}
          aspectRatio={cropTarget.kind === "background" ? CANVAS_W / CANVAS_H : null}
          initialCrop={initialCrop}
          onConfirm={onConfirm}
          onClose={() => setCropTarget(null)}
        />
      );
    })()}

    {/* ── Schedule modal ── */}
    {showSchedule && (
      <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={() => setShowSchedule(false)}>
        <div style={{ background: "#16181f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 24, width: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
          onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 16, fontFamily: "system-ui" }}>Schedule Carousel</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "system-ui" }}>Publish date &amp; time</label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "8px 12px", color: "#fff", fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, fontFamily: "system-ui" }}>Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Peak engagement window"
              value={scheduleNotes}
              onChange={(e) => setScheduleNotes(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "8px 12px", color: "#fff", fontSize: 13, fontFamily: "system-ui", boxSizing: "border-box" }}
            />
          </div>
          {scheduleMsg && (
            <div style={{ marginBottom: 12, fontSize: 12, color: scheduleMsg === "Scheduled!" ? green : "#f87171", fontFamily: "system-ui" }}>
              {scheduleMsg}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowSchedule(false)}
              style={{ padding: "7px 14px", fontSize: 12, fontFamily: "system-ui", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleSchedule} disabled={!scheduleTime || scheduling}
              style={{ padding: "7px 18px", fontSize: 12, fontWeight: 700, fontFamily: "system-ui", background: scheduleTime ? green : "rgba(57,222,139,0.3)", border: "none", borderRadius: 7, color: "#0a2010", cursor: scheduleTime ? "pointer" : "not-allowed" }}>
              {scheduling ? "Scheduling…" : "Confirm Schedule"}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
