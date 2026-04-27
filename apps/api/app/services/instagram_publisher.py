"""Instagram Graph API publisher — posts images/stories from R2 URLs."""

import io
import math
import os
import time

import httpx

from app.services.r2_uploader import upload_image_for_instagram, _load_font, _hex_to_rgba, _wrap_text
import app.store as store

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def _token() -> str:
    token = store.get_instagram_state().get("access_token") or os.environ.get("INSTAGRAM_PAGE_TOKEN", "")
    if not token:
        raise RuntimeError("No Instagram access token configured.")
    return token


def _ig_user_id() -> str:
    uid = store.get_instagram_state().get("ig_user_id", "")
    if not uid:
        raise RuntimeError("No Instagram user ID configured.")
    return uid


def _create_container(ig_user_id: str, token: str, params: dict) -> str:
    """POST to /{ig-user-id}/media — returns creation_id. Retries on timeout or transient errors."""
    for attempt in range(4):
        try:
            resp = httpx.post(
                f"{GRAPH_BASE}/{ig_user_id}/media",
                data={**params, "access_token": token},
                timeout=httpx.Timeout(connect=15, read=180, write=30, pool=5),
            )
            data = resp.json()
            if "error" in data:
                err = data["error"]
                if err.get("is_transient") and attempt < 3:
                    wait = 10 * (attempt + 1)
                    print(f"[publisher] Transient Instagram error (attempt {attempt + 1}), retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                raise RuntimeError(f"Instagram container error: {err}")
            return data["id"]
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
            if attempt == 3:
                raise RuntimeError(f"Instagram container creation timed out after 4 attempts: {exc}") from exc
            print(f"[publisher] Container creation timeout (attempt {attempt + 1}), retrying...")
            time.sleep(5)


def _wait_for_container(creation_id: str, token: str, max_wait: int = 120) -> None:
    """Poll container status until FINISHED. Raises on ERROR or timeout."""
    for _ in range(max_wait):
        try:
            resp = httpx.get(
                f"{GRAPH_BASE}/{creation_id}",
                params={"fields": "status_code", "access_token": token},
                timeout=30,
            )
            status = resp.json().get("status_code", "IN_PROGRESS")
            if status == "FINISHED":
                return
            if status == "ERROR":
                raise RuntimeError(f"Instagram container {creation_id} processing failed")
        except (httpx.ReadTimeout, httpx.ConnectTimeout):
            pass  # transient poll timeout — keep waiting
        time.sleep(1)
    raise RuntimeError(f"Instagram container {creation_id} not ready after {max_wait}s")


def _publish_container(ig_user_id: str, token: str, creation_id: str) -> str:
    """POST to /{ig-user-id}/media_publish — returns media_id. Retries on timeout."""
    for attempt in range(3):
        try:
            resp = httpx.post(
                f"{GRAPH_BASE}/{ig_user_id}/media_publish",
                data={"creation_id": creation_id, "access_token": token},
                timeout=90,
            )
            data = resp.json()
            if "error" in data:
                raise RuntimeError(f"Instagram publish error: {data['error']}")
            return data["id"]
        except (httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
            if attempt == 2:
                raise RuntimeError(f"Instagram publish timed out after 3 attempts: {exc}") from exc
            print(f"[publisher] Publish container timeout (attempt {attempt + 1}), retrying...")
            time.sleep(5)


def _collect_image_assets(draft_assets: list) -> list:
    """Return all accessible image asset dicts in draft order."""
    result = []
    for a in draft_assets:
        full = store.get_asset(a["asset_id"])
        if full and full.get("media_type") == "image" and os.path.isfile(full["path"]):
            result.append(full)
    return result


def _render_slide_to_file(slide: dict, tmp_path: str) -> None:
    """Render a new-style carousel slide (elements array) to a JPEG file."""
    from PIL import Image, ImageDraw, ImageOps

    CANVAS_W, CANVAS_H = 1080, 1350
    style = slide.get("style", {})
    image_meta = slide.get("image")
    elements = slide.get("elements", [])

    img = Image.new("RGB", (CANVAS_W, CANVAS_H), style.get("bgColor", "#002a27"))

    # Background photo
    if image_meta and image_meta.get("assetId"):
        asset = store.get_asset(image_meta["assetId"])
        if asset and asset.get("path") and os.path.isfile(asset["path"]):
            try:
                src = ImageOps.exif_transpose(Image.open(asset["path"])).convert("RGBA")
                scale = max(CANVAS_W / src.width, CANVAS_H / src.height)
                src = src.resize((math.ceil(src.width * scale), math.ceil(src.height * scale)), Image.LANCZOS)
                left = (src.width - CANVAS_W) // 2
                top = (src.height - CANVAS_H) // 2
                src = src.crop((left, top, left + CANVAS_W, top + CANVAS_H))
                op = int(image_meta.get("opacity", 100) or 100)
                if op < 100:
                    r, g, b, a = src.split()
                    a = a.point(lambda p, o=op: int(p * o / 100))
                    src.putalpha(a)
                base = img.convert("RGBA")
                base.paste(src, (0, 0), src)
                img = base.convert("RGB")
            except Exception:
                pass

    # Dark overlay
    ov = style.get("bgOverlayOpacity", 0) or 0
    if ov > 0:
        overlay = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, int(ov / 100 * 255)))
        base = img.convert("RGBA")
        base.paste(overlay, (0, 0), overlay)
        img = base.convert("RGB")

    img = img.convert("RGBA")
    draw = ImageDraw.Draw(img)

    for el in sorted(elements, key=lambda e: e.get("zIndex", 0)):
        el_type = el.get("type")
        el_x, el_y = int(el.get("x", 0)), int(el.get("y", 0))
        el_w, el_h = int(el.get("width", CANVAS_W)), int(el.get("height", 100))
        el_opacity = float(el.get("opacity", 100)) / 100.0

        if el_type == "text":
            raw_text = el.get("text", "").strip()
            if not raw_text:
                continue
            font = _load_font(int(el.get("fontSize", 32)), weight=int(el.get("fontWeight", 400)),
                              font_family=el.get("fontFamily", ""))
            color = _hex_to_rgba(el.get("color", "#ffffff"), el_opacity)
            line_h = int(el.get("fontSize", 32) * float(el.get("lineHeight", 1.3)))
            all_lines: list = []
            for para in raw_text.split("\n"):
                all_lines.extend(_wrap_text(para, font, el_w) if para.strip() else [""])
            for i, line in enumerate(all_lines):
                if not line:
                    continue
                bb = draw.textbbox((0, 0), line, font=font)
                lw = bb[2] - bb[0]
                align = el.get("textAlign", "left")
                lx = el_x + (el_w - lw) // 2 if align == "center" else (el_x + el_w - lw if align == "right" else el_x)
                draw.text((lx, el_y + i * line_h), line, font=font, fill=color)

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
                        r, g, b, a = logo.split()
                        a = a.point(lambda p, o=el_opacity: int(p * o))
                        logo.putalpha(a)
                    img.paste(logo, (el_x, el_y), logo)
                except Exception:
                    pass

    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=88, optimize=True)
    buf.seek(0)
    with open(tmp_path, "wb") as f:
        f.write(buf.read())


def publish_draft(draft_id: str) -> dict:
    """
    Publish a draft to Instagram.

    - story:    each image asset posted as a separate story frame
    - carousel: all images posted as a single carousel (up to 10)
    - post:     single image post (first asset)

    Updates draft status to 'published'. Returns media_ids and public_urls.
    """
    draft = store.get_draft(draft_id)
    if draft is None:
        raise ValueError(f"Draft {draft_id} not found")

    draft_assets = store.get_draft_assets(draft_id)

    # Story/Reel builders store frames in metadata, not in the draft_assets table.
    # Fall back to metadata.frames so both workflows publish correctly.
    if not draft_assets:
        meta_frames = (draft.get("metadata") or {}).get("frames") or []
        draft_assets = [{"asset_id": f["asset_id"]} for f in meta_frames if f.get("asset_id")]

    if not draft_assets:
        raise ValueError(f"Draft {draft_id} has no assets")

    image_assets = _collect_image_assets(draft_assets)
    if not image_assets:
        raise ValueError(f"Draft {draft_id} has no accessible image assets on disk")

    fmt = draft.get("format", "post")
    token = _token()
    ig_user_id = _ig_user_id()

    caption_parts = []
    if draft.get("caption"):
        caption_parts.append(draft["caption"])
    if draft.get("hashtags"):
        caption_parts.append(draft["hashtags"])
    caption = "\n\n".join(caption_parts)

    media_ids = []
    public_urls = []

    # Text layers per asset (stories store them keyed by asset_id).
    # Frontend saves as camelCase "frameTextLayers"; fall back to snake_case.
    _meta = draft.get("metadata") or {}
    frame_text_layers = _meta.get("frameTextLayers") or _meta.get("frame_text_layers") or {}

    if fmt == "story":
        # Each image is a separate story frame
        for i, asset in enumerate(image_assets):
            layers = frame_text_layers.get(asset["id"]) or []
            public_url = upload_image_for_instagram(asset["path"], prefix="stories", text_layers=layers)
            public_urls.append(public_url)
            creation_id = _create_container(ig_user_id, token, {
                "image_url": public_url,
                "media_type": "STORIES",
            })
            _wait_for_container(creation_id, token)
            media_id = _publish_container(ig_user_id, token, creation_id)
            media_ids.append(media_id)
            print(f"[publisher] Story frame {i + 1}/{len(image_assets)} published: {media_id}")
            if i < len(image_assets) - 1:
                time.sleep(2)  # brief gap between frames to avoid rate-limiting

    elif fmt == "carousel":
        import tempfile
        _meta = draft.get("metadata") or {}
        meta_slides = _meta.get("slides", [])

        # New-style carousel: slides have elements array — render each slide server-side
        if meta_slides and any(s.get("elements") for s in meta_slides):
            child_ids = []
            tmp_files = []
            for i, slide in enumerate(meta_slides[:10]):
                tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
                tmp.close()
                _render_slide_to_file(slide, tmp.name)
                tmp_files.append(tmp.name)
                public_url = upload_image_for_instagram(tmp.name, prefix="carousel")
                public_urls.append(public_url)
                child_id = _create_container(ig_user_id, token, {
                    "image_url": public_url,
                    "is_carousel_item": "true",
                })
                child_ids.append(child_id)
                print(f"[publisher] Carousel slide {i + 1}/{len(meta_slides[:10])} uploaded")
            for f in tmp_files:
                try:
                    os.unlink(f)
                except OSError:
                    pass
        elif len(image_assets) > 1:
            # Legacy carousel: plain assets with no compositing
            child_ids = []
            for asset in image_assets[:10]:
                public_url = upload_image_for_instagram(asset["path"], prefix="carousel")
                public_urls.append(public_url)
                child_id = _create_container(ig_user_id, token, {
                    "image_url": public_url,
                    "is_carousel_item": "true",
                })
                child_ids.append(child_id)
        else:
            raise ValueError("Carousel draft has no slides or assets to publish")

        if len(child_ids) < 2:
            raise ValueError(f"Instagram requires at least 2 carousel items (got {len(child_ids)})")

        carousel_id = _create_container(ig_user_id, token, {
            "media_type": "CAROUSEL",
            "children": ",".join(child_ids),
            "caption": caption,
        })
        _wait_for_container(carousel_id, token)
        media_id = _publish_container(ig_user_id, token, carousel_id)
        media_ids.append(media_id)

    else:
        # Single image post
        asset = image_assets[0]
        layers = frame_text_layers.get(asset["id"]) or []
        public_url = upload_image_for_instagram(asset["path"], prefix="posts", text_layers=layers)
        public_urls.append(public_url)
        creation_id = _create_container(ig_user_id, token, {
            "image_url": public_url,
            "media_type": "IMAGE",
            "caption": caption,
        })
        _wait_for_container(creation_id, token)
        media_id = _publish_container(ig_user_id, token, creation_id)
        media_ids.append(media_id)

    # Mark draft as published
    store.update_draft(draft_id, {
        "status": "published",
        "metadata": {
            **(draft.get("metadata") or {}),
            "ig_media_ids": media_ids,
            "ig_public_urls": public_urls,
            "published_at": store._now_iso(),
        },
    })

    return {"media_ids": media_ids, "public_urls": public_urls}
