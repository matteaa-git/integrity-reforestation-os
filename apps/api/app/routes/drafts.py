"""Draft API routes — CRUD + workflow transitions."""

import io
import math
import os
import zipfile

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional

from app.schemas.draft import (
    AddDraftAssetRequest,
    DraftCreate,
    DraftDetailResponse,
    DraftListResponse,
    DraftResponse,
    DraftUpdate,
    RescheduleDraftRequest,
    ScheduleDraftRequest,
)
from app import store

router = APIRouter(prefix="/drafts", tags=["drafts"])


def _draft_detail(draft_id: str) -> dict:
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    assets = store.get_draft_assets(draft_id)
    return {**draft, "assets": assets}


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=DraftDetailResponse, status_code=201)
async def create_draft(body: DraftCreate):
    draft = store.create_draft(body.model_dump())
    return {**draft, "assets": []}


@router.get("", response_model=DraftListResponse)
async def list_drafts(
    format: Optional[str] = Query(None, description="Filter by format"),
    status: Optional[str] = Query(None, description="Filter by status"),
    scheduled_after: Optional[str] = Query(None, description="ISO-8601 lower bound"),
    scheduled_before: Optional[str] = Query(None, description="ISO-8601 upper bound"),
):
    drafts = store.list_drafts(
        fmt=format, status=status,
        scheduled_after=scheduled_after, scheduled_before=scheduled_before,
    )
    return DraftListResponse(drafts=drafts, total=len(drafts))


@router.get("/{draft_id}", response_model=DraftDetailResponse)
async def get_draft(draft_id: str):
    return _draft_detail(draft_id)


@router.patch("/{draft_id}", response_model=DraftDetailResponse)
async def update_draft(draft_id: str, body: DraftUpdate):
    updates = body.model_dump(exclude_unset=True)
    draft = store.update_draft(draft_id, updates)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    assets = store.get_draft_assets(draft_id)
    return {**draft, "assets": assets}


@router.delete("/{draft_id}", status_code=204)
async def delete_draft(draft_id: str):
    deleted = store.delete_draft(draft_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Draft not found")


@router.post("/{draft_id}/duplicate", response_model=DraftDetailResponse, status_code=201)
async def duplicate_draft(draft_id: str):
    draft = store.duplicate_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {**draft, "assets": []}


@router.post("/{draft_id}/copy-as-carousel", status_code=201)
async def copy_as_carousel(draft_id: str):
    """Convert a story/reel draft into a new carousel draft.

    Each frame becomes one carousel slide with the frame's asset as the
    background image and the first text layer as the slide headline.
    """
    import uuid as _uuid

    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Collect frames: prefer draft_assets table, fall back to metadata.frames
    draft_assets = store.get_draft_assets(draft_id)
    if not draft_assets:
        meta_frames = (draft.get("metadata") or {}).get("frames") or []
        draft_assets = [
            {"asset_id": f["asset_id"], "asset": f.get("asset")}
            for f in meta_frames
            if f.get("asset_id")
        ]

    frame_text_layers = (
        (draft.get("metadata") or {}).get("frameTextLayers")
        or (draft.get("metadata") or {}).get("frame_text_layers")
        or {}
    )

    slides = []
    for i, da in enumerate(draft_assets):
        asset_id = da.get("asset_id") or (da.get("asset") or {}).get("id")
        if not asset_id:
            continue
        asset = store.get_asset(asset_id) or da.get("asset") or {}

        layers = frame_text_layers.get(asset_id) or []
        headline = layers[0]["text"] if layers else ""
        headline_color = layers[0].get("color", "#ffffff") if layers else "#ffffff"
        font_family = layers[0].get("fontFamily", "'Noto Sans', sans-serif") if layers else "'Noto Sans', sans-serif"
        font_weight = layers[0].get("fontWeight", "900") if layers else "900"

        slides.append({
            "id": f"slide-{i}-{_uuid.uuid4().hex[:8]}",
            "type": "hook" if i == 0 else "blank",
            "content": {
                "headline": headline,
                "subheadline": "",
                "body": "",
                "subtext": "",
                "ctaText": "",
            },
            "style": {
                "bgColor": "#002a27",
                "bgImage": None,
                "bgOverlayOpacity": 40,
                "headlineColor": headline_color,
                "subheadlineColor": "rgba(255,255,255,0.7)",
                "bodyColor": "#ffffff",
                "subtextColor": "rgba(255,255,255,0.6)",
                "ctaColor": "#002a27",
                "ctaBgColor": "#39de8b",
                "accentColor": "#39de8b",
                "headlineFontSize": 36,
                "subheadlineFontSize": 20,
                "bodyFontSize": 18,
                "subtextFontSize": 14,
                "ctaFontSize": 16,
                "fontFamily": font_family,
                "headlineWeight": font_weight if font_weight in ("400", "700", "900") else "900",
                "subheadlineWeight": "600",
                "ctaAlign": "left",
                "textAlign": "center",
                "lineSpacing": 1.5,
                "paddingX": 40,
                "paddingY": 48,
                "showLogo": True,
                "showHandle": True,
                "showAccent": True,
                "accentStyle": "line",
                "layout": "hero-hook" if i == 0 else "centered",
            },
            "image": {
                "assetId": asset_id,
                "url": asset.get("path", ""),
                "mode": "background",
                "x": 50,
                "y": 50,
                "width": 100,
                "opacity": 100,
            },
            "elements": [],
        })

    new_draft = store.create_draft({
        "title": f"{draft['title']} (Carousel)",
        "format": "carousel",
        "status": "draft",
        "caption": draft.get("caption"),
        "hashtags": draft.get("hashtags"),
        "metadata": {"slides": slides},
    })

    return {"id": new_draft["id"], "draft": {**new_draft, "assets": []}}


@router.patch("/{draft_id}/reschedule", response_model=DraftDetailResponse)
async def reschedule_draft(draft_id: str, body: RescheduleDraftRequest):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] == "rejected":
        raise HTTPException(
            status_code=409,
            detail="Cannot reschedule a rejected draft — return it to draft first",
        )
    store.update_draft(draft_id, {"scheduled_for": body.scheduled_for, "status": "scheduled", "publish_error": None})
    return _draft_detail(draft_id)


# ---------------------------------------------------------------------------
# Draft assets
# ---------------------------------------------------------------------------

@router.post("/{draft_id}/assets", status_code=201)
async def add_draft_asset(draft_id: str, body: AddDraftAssetRequest):
    entry = store.add_draft_asset(draft_id, body.asset_id, body.position)
    if entry is None:
        raise HTTPException(status_code=400, detail="Invalid draft_id, asset_id, or asset already attached")
    assets = store.get_draft_assets(draft_id)
    return {"assets": assets}


@router.delete("/{draft_id}/assets/{asset_id}")
async def remove_draft_asset(draft_id: str, asset_id: str):
    removed = store.remove_draft_asset(draft_id, asset_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Asset not found on draft")
    assets = store.get_draft_assets(draft_id)
    return {"assets": assets}


# ---------------------------------------------------------------------------
# Workflow transitions
# ---------------------------------------------------------------------------

@router.post("/{draft_id}/submit-for-review", response_model=DraftDetailResponse)
async def submit_for_review(draft_id: str):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] != "draft":
        raise HTTPException(status_code=409, detail=f"Cannot submit: status is '{draft['status']}', must be 'draft'")
    # Allow submission if draft has library assets OR non-empty metadata (e.g. text overlays, carousel slides)
    has_assets = store.draft_asset_count(draft_id) > 0
    has_metadata = bool(draft.get("metadata"))
    if not has_assets and not has_metadata:
        raise HTTPException(status_code=409, detail="Cannot submit: draft has no assets or content")
    store.update_draft(draft_id, {"status": "in_review"})
    return _draft_detail(draft_id)


@router.post("/{draft_id}/approve", response_model=DraftDetailResponse)
async def approve_draft(draft_id: str):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] != "in_review":
        raise HTTPException(status_code=409, detail=f"Cannot approve: status is '{draft['status']}', must be 'in_review'")
    store.update_draft(draft_id, {"status": "approved"})
    return _draft_detail(draft_id)


@router.post("/{draft_id}/reject", response_model=DraftDetailResponse)
async def reject_draft(draft_id: str):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] != "in_review":
        raise HTTPException(status_code=409, detail=f"Cannot reject: status is '{draft['status']}', must be 'in_review'")
    store.update_draft(draft_id, {"status": "rejected"})
    return _draft_detail(draft_id)


@router.post("/{draft_id}/return-to-draft", response_model=DraftDetailResponse)
async def return_to_draft(draft_id: str):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] not in ("rejected", "in_review"):
        raise HTTPException(status_code=409, detail=f"Cannot return to draft: status is '{draft['status']}', must be 'rejected' or 'in_review'")
    store.update_draft(draft_id, {"status": "draft"})
    return _draft_detail(draft_id)


@router.post("/{draft_id}/publish-now")
async def publish_draft_now(draft_id: str):
    """Immediately publish a draft to Instagram (bypasses schedule)."""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from app.services.instagram_publisher import publish_draft
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    store.update_draft(draft_id, {"status": "publishing", "publish_error": None})
    try:
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pub-now")
        result = await loop.run_in_executor(executor, publish_draft, draft_id)
        return {"ok": True, **result, **_draft_detail(draft_id)}
    except Exception as exc:
        err = str(exc)
        store.update_draft(draft_id, {"status": "publish_failed", "publish_error": err})
        raise HTTPException(status_code=500, detail=err)


@router.post("/{draft_id}/schedule", response_model=DraftDetailResponse)
async def schedule_draft(draft_id: str, body: ScheduleDraftRequest):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] == "rejected":
        raise HTTPException(status_code=409, detail="Cannot schedule a rejected draft — return it to draft first")
    store.update_draft(draft_id, {
        "status": "scheduled",
        "scheduled_for": body.scheduled_for,
        "schedule_notes": body.notes,
    })
    return _draft_detail(draft_id)


# ---------------------------------------------------------------------------
# Carousel render/export
# ---------------------------------------------------------------------------

@router.get("/{draft_id}/render-carousel")
async def render_carousel(draft_id: str):
    """
    Render all carousel slides to 1080×1350 PNG images and return as a ZIP.
    Supports both elements-based slides (new style) and content-field slides (legacy).
    """
    from PIL import Image, ImageDraw, ImageOps
    from app.services.r2_uploader import _load_font, _hex_to_rgba, _wrap_text

    CANVAS_W, CANVAS_H = 1080, 1350

    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")

    slides = (draft.get("metadata") or {}).get("slides", [])
    if not slides:
        raise HTTPException(status_code=400, detail="Draft has no slides")

    def _apply_bg_image(img: "Image.Image", path: str, opacity: int) -> "Image.Image":
        try:
            src = ImageOps.exif_transpose(Image.open(path)).convert("RGBA")
            scale = max(CANVAS_W / src.width, CANVAS_H / src.height)
            new_w = math.ceil(src.width * scale)
            new_h = math.ceil(src.height * scale)
            src = src.resize((new_w, new_h), Image.LANCZOS)
            left = (new_w - CANVAS_W) // 2
            top = (new_h - CANVAS_H) // 2
            src = src.crop((left, top, left + CANVAS_W, top + CANVAS_H))
            if opacity < 100:
                op = opacity  # capture for lambda
                r, g, b, a = src.split()
                a = a.point(lambda p, o=op: int(p * o / 100))
                src.putalpha(a)
            base = img.convert("RGBA")
            base.paste(src, (0, 0), src)
            return base.convert("RGB")
        except Exception:
            return img

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, slide in enumerate(slides):
            style = slide.get("style", {})
            content = slide.get("content", {})
            image_meta = slide.get("image")
            elements = slide.get("elements", [])

            # ── Background ──
            bg_color = style.get("bgColor", "#1a1a2e")
            img = Image.new("RGB", (CANVAS_W, CANVAS_H), bg_color)

            # ── Background image from slide.image ──
            if image_meta and image_meta.get("assetId"):
                asset = store.get_asset(image_meta["assetId"])
                if asset and asset.get("path") and os.path.isfile(asset["path"]):
                    opacity = int(image_meta.get("opacity", 100) or 100)
                    img = _apply_bg_image(img, asset["path"], opacity)

            # ── Dark overlay ──
            overlay_opacity = style.get("bgOverlayOpacity", 0) or 0
            if overlay_opacity > 0:
                overlay = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, int(overlay_opacity / 100 * 255)))
                base = img.convert("RGBA")
                base.paste(overlay, (0, 0), overlay)
                img = base.convert("RGB")

            img = img.convert("RGBA")
            draw = ImageDraw.Draw(img)

            if elements:
                # ── Elements-based rendering (new-style free-form slides) ──
                for el in sorted(elements, key=lambda e: e.get("zIndex", 0)):
                    el_type = el.get("type")
                    el_x = int(el.get("x", 0))
                    el_y = int(el.get("y", 0))
                    el_w = int(el.get("width", CANVAS_W))
                    el_h = int(el.get("height", 100))
                    el_opacity = float(el.get("opacity", 100)) / 100.0

                    if el_type == "text":
                        raw_text = el.get("text", "").strip()
                        if not raw_text:
                            continue
                        font_size = int(el.get("fontSize", 32))
                        font_weight = int(el.get("fontWeight", 400))
                        font_family = el.get("fontFamily", "noto sans")
                        color_hex = el.get("color", "#ffffff")
                        text_align = el.get("textAlign", "left")
                        line_height_mult = float(el.get("lineHeight", 1.3))

                        font = _load_font(font_size, weight=font_weight, font_family=font_family)
                        text_color = _hex_to_rgba(color_hex, el_opacity)
                        line_h = int(font_size * line_height_mult)

                        # Split on explicit newlines first, then word-wrap each paragraph
                        all_lines: list[str] = []
                        for para in raw_text.split("\n"):
                            if para.strip():
                                all_lines.extend(_wrap_text(para, font, el_w))
                            else:
                                all_lines.append("")  # preserve blank lines

                        for i, line in enumerate(all_lines):
                            if not line:
                                continue
                            bb = draw.textbbox((0, 0), line, font=font)
                            lw = bb[2] - bb[0]
                            if text_align == "center":
                                lx = el_x + (el_w - lw) // 2
                            elif text_align == "right":
                                lx = el_x + el_w - lw
                            else:
                                lx = el_x
                            draw.text((lx, el_y + i * line_h), line, font=font, fill=text_color)

                    elif el_type == "image":
                        asset_id = el.get("assetId")
                        if not asset_id:
                            continue
                        asset = store.get_asset(asset_id)
                        if asset and asset.get("path") and os.path.isfile(asset["path"]):
                            try:
                                logo = Image.open(asset["path"]).convert("RGBA")
                                logo = logo.resize((el_w, el_h), Image.LANCZOS)
                                if el_opacity < 1.0:
                                    op = el_opacity
                                    r, g, b, a = logo.split()
                                    a = a.point(lambda p, o=op: int(p * o))
                                    logo.putalpha(a)
                                img.paste(logo, (el_x, el_y), logo)
                            except Exception:
                                pass

            else:
                # ── Legacy content-field rendering ──
                font_family = style.get("fontFamily", "noto sans")
                pad_x = int(style.get("paddingX", 60))
                pad_y = int(style.get("paddingY", 80))
                text_align = style.get("textAlign", "left")
                max_w = CANVAS_W - pad_x * 2
                layout = style.get("layout", "centered")

                if layout in ("top-heavy", "bullet-breakdown", "framework-layout", "checklist"):
                    text_y = pad_y + 60
                elif layout in ("bottom-heavy", "story-layout", "full-bleed"):
                    text_y = CANVAS_H - pad_y - 600
                else:
                    text_y = CANVAS_H // 2 - 200

                def draw_text_block(text, font_size, weight, color_hex, spacing=1.25):
                    nonlocal text_y
                    if not text:
                        return
                    font = _load_font(int(font_size), weight=int(weight), font_family=font_family)
                    lines = _wrap_text(text, font, max_w)
                    line_h = int(font_size * spacing)
                    for line in lines:
                        bb = draw.textbbox((0, 0), line, font=font)
                        lw = bb[2] - bb[0]
                        if text_align == "center":
                            lx = (CANVAS_W - lw) // 2
                        elif text_align == "right":
                            lx = CANVAS_W - pad_x - lw
                        else:
                            lx = pad_x
                        draw.text((lx, text_y), line, font=font, fill=_hex_to_rgba(color_hex))
                        text_y += line_h
                    text_y += int(font_size * 0.4)

                draw_text_block(content.get("headline", ""), style.get("headlineFontSize", 72),
                                style.get("headlineWeight", 900), style.get("headlineColor", "#ffffff"), spacing=1.1)
                draw_text_block(content.get("subheadline", ""), style.get("subheadlineFontSize", 36),
                                style.get("subheadlineWeight", 600), style.get("subheadlineColor", "#ffffff"))
                draw_text_block(content.get("body", ""), style.get("bodyFontSize", 28), 400,
                                style.get("bodyColor", "#cccccc"), spacing=style.get("lineSpacing", 1.5))
                draw_text_block(content.get("subtext", ""), style.get("subtextFontSize", 22), 400,
                                style.get("subtextColor", "#aaaaaa"))

                cta = content.get("ctaText", "")
                if cta:
                    cta_font_size = int(style.get("ctaFontSize", 24))
                    font = _load_font(cta_font_size, weight=700, font_family=font_family)
                    bb = draw.textbbox((0, 0), cta, font=font)
                    cta_w = bb[2] - bb[0] + 56
                    cta_h = cta_font_size + 24
                    if text_align == "center":
                        cta_x = (CANVAS_W - cta_w) // 2
                    elif text_align == "right":
                        cta_x = CANVAS_W - pad_x - cta_w
                    else:
                        cta_x = pad_x
                    cta_bg = _hex_to_rgba(style.get("ctaBgColor", style.get("accentColor", "#39de8b")))
                    draw.rounded_rectangle([cta_x, text_y, cta_x + cta_w, text_y + cta_h],
                                           radius=cta_h // 2, fill=cta_bg)
                    draw.text((cta_x + 28, text_y + 12), cta, font=font,
                              fill=_hex_to_rgba(style.get("ctaColor", "#0a2010")))

            # ── Save slide to ZIP ──
            slide_buf = io.BytesIO()
            img.convert("RGB").save(slide_buf, format="PNG", optimize=True)
            slide_buf.seek(0)
            zf.writestr(f"slide-{idx + 1:02d}.png", slide_buf.read())

    zip_buf.seek(0)
    import re as _re
    raw_title = (draft.get("title") or "carousel")
    title_slug = _re.sub(r"[^a-z0-9]+", "-", raw_title.lower()).strip("-")
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{title_slug}.zip"'},
    )
