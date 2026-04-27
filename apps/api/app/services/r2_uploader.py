"""Image uploader — Cloudinary for Instagram-accessible URLs, R2 for backup storage."""

import io
import math
import os
import uuid
from typing import List, Optional

import boto3
import cloudinary
import cloudinary.uploader
from botocore.config import Config
from PIL import Image, ImageDraw, ImageFont


def _configure_cloudinary():
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )

# ── Font loader ──────────────────────────────────────────────────────────────

_FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "fonts")

# Map CSS font-family values used in the story builder → (variable_path, static_regular, static_bold)
_FONT_MAP = {
    "noto sans": {
        "variable": os.path.join(_FONTS_DIR, "NotoSans-Variable.ttf"),
        "weight_axis": True,   # supports wght axis
    },
    "inter": {
        "variable": os.path.join(_FONTS_DIR, "InterVariable.ttf"),
        "weight_axis": True,
    },
}

_FALLBACK_SEARCH = [
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _load_font(size: int, weight: int = 400, font_family: str = "") -> ImageFont.FreeTypeFont:
    """Load the best matching font for the given family and weight."""
    # Normalise the CSS font-family string: "'Inter', sans-serif" → "inter"
    family_key = font_family.lower().replace("'", "").replace('"', "").split(",")[0].strip()

    cfg = _FONT_MAP.get(family_key)
    if cfg:
        if cfg.get("weight_axis"):
            # Variable font — set exact weight axis value
            path = cfg["variable"]
            if os.path.isfile(path):
                try:
                    f = ImageFont.truetype(path, size)
                    axes = f.get_variation_axes()
                    values = []
                    for axis in axes:
                        name = axis["name"]
                        if isinstance(name, bytes):
                            name = name.decode("utf-8")
                        if "weight" in name.lower():
                            values.append(weight)
                        else:
                            values.append(axis["default"])
                    f.set_variation_by_axes(values)
                    return f
                except Exception:
                    pass
        else:
            path = cfg["bold"] if weight >= 600 else cfg["regular"]
            if os.path.isfile(path):
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    pass

    # Fallback: system sans-serif
    for path in _FALLBACK_SEARCH:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _hex_to_rgba(hex_color: str, opacity: float = 1.0):
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    a = int(opacity * 255)
    return (r, g, b, a)


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width_px: int) -> List[str]:
    """Wrap text to fit within max_width_px using the given font."""
    draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width_px:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines if lines else [text]


# Reference canvas height used in the frontend (px)
FRONTEND_CANVAS_HEIGHT = 640

# ── Text burning ─────────────────────────────────────────────────────────────

def burn_text_layers(img: Image.Image, text_layers: List[dict]) -> Image.Image:
    """
    Composite text layers onto an RGBA copy of img.
    text_layers: list of TextLayer dicts from draft metadata.
    """
    if not text_layers:
        return img

    canvas_w, canvas_h = img.size
    scale = canvas_h / FRONTEND_CANVAS_HEIGHT

    # Work in RGBA so we can use per-layer opacity
    result = img.convert("RGBA")

    for layer in text_layers:
        text = layer.get("text", "").strip()
        if not text:
            continue

        font_size = max(8, int(layer.get("fontSize", 32) * scale))
        font_weight = int(layer.get("fontWeight", "400"))
        font_family = layer.get("fontFamily", "")
        font = _load_font(font_size, weight=font_weight, font_family=font_family)

        color_hex = layer.get("color", "#ffffff")
        opacity = float(layer.get("opacity", 1.0))
        text_color = _hex_to_rgba(color_hex, opacity)

        # Position (center anchor)
        cx = (layer.get("x", 50) / 100) * canvas_w
        cy = (layer.get("y", 50) / 100) * canvas_h

        # Available width for this box
        box_width_px = int((layer.get("width", 80) / 100) * canvas_w)

        # Align
        align = layer.get("textAlign", "center")

        # Wrap text to fit box width
        lines = _wrap_text(text, font, box_width_px)
        line_height = int(font_size * 1.3)

        # Measure total block dimensions using actual glyph extents
        tmp_draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
        line_widths = []
        max_descent = 0
        for line in lines:
            bb = tmp_draw.textbbox((0, 0), line, font=font)
            line_widths.append(bb[2] - bb[0])
            # bb[3] is the bottom of the glyph (includes descenders)
            descent = bb[3] - font_size
            if descent > max_descent:
                max_descent = descent
        block_w = max(line_widths) if line_widths else box_width_px
        # Add extra room for descenders on the last line
        block_h = line_height * len(lines) + max(0, max_descent)

        # Background
        bg_style = layer.get("bgStyle", "none")
        bg_color_hex = layer.get("bgColor", "#000000")
        pad_x, pad_y = 0, 0
        if bg_style != "none":
            pad_x, pad_y = int(12 * scale), int(6 * scale)

        total_w = block_w + pad_x * 2
        total_h = block_h + pad_y * 2

        # Top-left corner of the text block (centered on cx, cy)
        origin_x = int(cx - total_w / 2)
        origin_y = int(cy - total_h / 2)

        # Handle rotation
        rotation = float(layer.get("rotation", 0))

        # Create a sub-image for this layer
        layer_img = Image.new("RGBA", (total_w + 1, total_h + 1), (0, 0, 0, 0))
        layer_draw = ImageDraw.Draw(layer_img)

        # Draw background
        if bg_style != "none":
            bg_rgba = _hex_to_rgba(bg_color_hex, opacity)
            radius = total_h // 2 if bg_style == "pill" else int(8 * scale)
            layer_draw.rounded_rectangle(
                [0, 0, total_w, total_h],
                radius=radius,
                fill=bg_rgba,
            )

        # Draw text lines
        for i, line in enumerate(lines):
            bb = tmp_draw.textbbox((0, 0), line, font=font)
            lw = bb[2] - bb[0]
            if align == "center":
                lx = pad_x + (block_w - lw) // 2
            elif align == "right":
                lx = pad_x + block_w - lw
            else:
                lx = pad_x
            ly = pad_y + i * line_height
            layer_draw.text((lx, ly), line, font=font, fill=text_color)

        # Rotate if needed
        if rotation != 0:
            layer_img = layer_img.rotate(-rotation, expand=True, resample=Image.BICUBIC)
            rot_w, rot_h = layer_img.size
            origin_x = int(cx - rot_w / 2)
            origin_y = int(cy - rot_h / 2)

        # Composite onto result
        result.paste(layer_img, (origin_x, origin_y), layer_img)

    return result.convert("RGB")


def _client():
    account_id = os.environ["R2_ACCOUNT_ID"]
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(
            signature_version="s3v4",
            connect_timeout=15,
            read_timeout=120,          # large story images can be 10–15 MB
            retries={"max_attempts": 3, "mode": "adaptive"},
        ),
        region_name="auto",
    )


def upload_image_for_instagram(
    local_path: str,
    prefix: str = "posts",
    text_layers: Optional[List[dict]] = None,
    target_size: Optional[tuple] = None,
) -> str:
    """
    Resize/crop image to the target canvas, burn text layers, upload to Cloudinary.

    target_size defaults:
      - stories  → (1080, 1920)  9:16
      - feed/carousel → (1080, 1350)  4:5
    """
    if target_size is None:
        target_size = (1080, 1920) if prefix == "stories" else (1080, 1350)

    img = Image.open(local_path).convert("RGB")
    target_w, target_h = target_size
    src_w, src_h = img.width, img.height
    scale = max(target_w / src_w, target_h / src_h)
    new_w = math.ceil(src_w * scale)
    new_h = math.ceil(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top  = (new_h - target_h) // 2
    img = img.crop((left, top, left + target_w, top + target_h))

    if text_layers:
        img = burn_text_layers(img, text_layers)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    buf.seek(0)

    _configure_cloudinary()
    result = cloudinary.uploader.upload(
        buf,
        folder=f"instagram/{prefix}",
        resource_type="image",
        format="jpg",
    )
    return result["secure_url"]


def upload_video_for_instagram(local_path: str, prefix: str = "posts") -> str:
    """Upload a video file to R2 and return its public URL."""
    ext = os.path.splitext(local_path)[1].lower() or ".mp4"
    key = f"{prefix}/{uuid.uuid4().hex}{ext}"
    bucket = os.environ["R2_BUCKET_NAME"]
    public_base = os.environ["R2_PUBLIC_URL"].rstrip("/")

    with open(local_path, "rb") as f:
        _client().put_object(
            Bucket=bucket,
            Key=key,
            Body=f,
            ContentType="video/mp4",
        )

    return f"{public_base}/{key}"
