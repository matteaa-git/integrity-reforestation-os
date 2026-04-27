"""Asset API routes."""

import io
import os
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, Response

from app.schemas.asset import (
    AssetCreate,
    AssetListResponse,
    AssetResponse,
    AssetUpdate,
    IndexDirectoryRequest,
    IndexDirectoryResponse,
    LibraryStatusResponse,
)
from app.services.asset_indexer import (
    DEFAULT_LIBRARY_ROOT,
    INTEGRITY_LIBRARY_ROOT,
    INTEGRITY_ROOT,
    VIDEO_EXTENSIONS,
    IMAGE_EXTENSIONS,
    AUDIO_EXTENSIONS,
    classify_media_type,
    compute_sha256,
    _extract_video_metadata,
    _extract_image_dimensions,
    _extract_audio_duration,
    scan_directory,
)
from app import store

router = APIRouter(prefix="/assets", tags=["assets"])

# ── Library sync state ─────────────────────────────────────────────────────

_sync_state = {
    "last_synced_at": None,   # ISO string
    "sync_in_progress": False,
}

# ── Custom library path (persisted across restarts) ─────────────────────────

_CUSTOM_PATH_FILE = os.path.join(os.path.expanduser("~"), "Integrity_AssetLibrary", ".growth_os_library_path")
_custom_library_path: Optional[str] = None

# Restore persisted path on module load
try:
    if os.path.isfile(_CUSTOM_PATH_FILE):
        _stored = Path(_CUSTOM_PATH_FILE).read_text().strip()
        if _stored and os.path.isdir(_stored):
            _custom_library_path = _stored
except Exception:
    pass


def _run_sync(directory: Optional[str] = None) -> IndexDirectoryResponse:
    """Perform a full library sync, replacing existing assets from the same root."""
    _sync_state["sync_in_progress"] = True
    try:
        scan = scan_directory(directory=directory)
        indexed_count = 0
        duplicate_count = 0
        for f in scan.files:
            if store.has_hash(f.hash):
                duplicate_count += 1
                continue
            store.create_asset({
                "path": f.path,
                "filename": f.filename,
                "media_type": f.media_type,
                "file_size": f.file_size,
                "hash": f.hash,
                "width": f.width,
                "height": f.height,
                "duration": f.duration,
                "extension": f.extension,
                "relative_path": f.relative_path,
                "category": f.category,
                "project": f.project,
                "pillar": f.pillar,
                "description": f.description,
                "orientation": f.orientation,
                "subject": f.subject,
                "action": f.action,
                "content_type": f.content_type,
                "ai_keywords": f.ai_keywords,
                "ai_confidence": f.ai_confidence,
            })
            indexed_count += 1
        _sync_state["last_synced_at"] = datetime.now(timezone.utc).isoformat()
        return IndexDirectoryResponse(
            indexed_count=indexed_count,
            skipped_count=scan.skipped_non_media + scan.skipped_ignored,
            duplicate_count=duplicate_count,
            invalid_count=len(scan.errors),
            scanned_root=scan.scanned_root,
            errors=scan.errors[:50],
        )
    finally:
        _sync_state["sync_in_progress"] = False


def auto_sync_on_startup() -> None:
    """Called from main.py startup — syncs Integrity LIBRARY/ in background thread."""
    if _sync_state["sync_in_progress"]:
        return
    t = threading.Thread(target=_run_sync, daemon=True)
    t.start()


# ── Routes ─────────────────────────────────────────────────────────────────

@router.get("", response_model=AssetListResponse)
async def list_assets(
    media_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    pillar: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    orientation: Optional[str] = Query(None),
    content_type: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    assets = store.list_assets(
        media_type=media_type,
        search=search,
        project=project,
        pillar=pillar,
        subject=subject,
        action=action,
        orientation=orientation,
        content_type=content_type,
    )
    total = len(assets)
    return AssetListResponse(assets=assets[offset:offset + limit], total=total)


@router.get("/library-status", response_model=LibraryStatusResponse)
async def get_library_status():
    """Return the current Integrity Library sync status and asset breakdown."""
    all_assets = store.list_assets()
    projects = sorted({a["project"] for a in all_assets if a.get("project")})
    pillars = sorted({a["pillar"] for a in all_assets if a.get("pillar")})
    effective_path = _custom_library_path if _custom_library_path else DEFAULT_LIBRARY_ROOT
    return LibraryStatusResponse(
        connected=os.path.isdir(effective_path),
        library_root=INTEGRITY_LIBRARY_ROOT,
        library_path=effective_path,
        total_assets=len(all_assets),
        images=sum(1 for a in all_assets if a["media_type"] == "image"),
        videos=sum(1 for a in all_assets if a["media_type"] == "video"),
        audio=sum(1 for a in all_assets if a["media_type"] == "audio"),
        last_synced_at=_sync_state["last_synced_at"],
        sync_in_progress=_sync_state["sync_in_progress"],
        projects=projects,
        pillars=pillars,
    )


@router.post("/sync-library", response_model=IndexDirectoryResponse)
async def sync_library():
    """
    Sync from ~/Integrity_AssetLibrary/LIBRARY/ (canonical finalized assets),
    or the custom library path if one has been set.
    New files are indexed; existing hashes are skipped (no re-hash cost).
    """
    if _sync_state["sync_in_progress"]:
        raise HTTPException(409, "Sync already in progress")
    return _run_sync(directory=_custom_library_path if _custom_library_path else None)


@router.post("/set-library-path", response_model=IndexDirectoryResponse)
async def set_library_path(body: dict):
    """
    Persist a custom library path and trigger a sync of it.
    Saves the path to ~/Integrity_AssetLibrary/.growth_os_library_path so it
    survives server restarts.
    """
    global _custom_library_path
    raw_path = body.get("path", "").strip()
    if not raw_path:
        raise HTTPException(400, "path is required")
    expanded = os.path.expanduser(raw_path)
    if not os.path.isdir(expanded):
        raise HTTPException(400, f"Directory not found: {expanded}")
    if _sync_state["sync_in_progress"]:
        raise HTTPException(409, "Sync already in progress")
    # Persist to file
    try:
        os.makedirs(os.path.dirname(_CUSTOM_PATH_FILE), exist_ok=True)
        Path(_CUSTOM_PATH_FILE).write_text(expanded)
    except Exception as exc:
        raise HTTPException(500, f"Could not persist library path: {exc}") from exc
    _custom_library_path = expanded
    return _run_sync(directory=expanded)


@router.get("/{asset_id}/ig-story")
async def get_asset_ig_story(asset_id: str):
    """Return image resized and cropped to 1080x1350 (4:5 portrait) for Instagram Story/Feed posting."""
    asset = store.get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    filepath = asset["path"]
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    from PIL import Image
    img = Image.open(filepath).convert("RGB")
    target_w, target_h = 1080, 1350
    src_ratio = img.width / img.height
    tgt_ratio = target_w / target_h
    if src_ratio > tgt_ratio:
        new_h = target_h
        new_w = int(src_ratio * new_h)
    else:
        new_w = target_w
        new_h = int(new_w / src_ratio)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    img = img.crop((left, top, left + target_w, top + target_h))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    return Response(content=buf.getvalue(), media_type="image/jpeg", headers={
        "Cache-Control": "public, max-age=3600",
        "ngrok-skip-browser-warning": "true",
    })


@router.post("/{asset_id}/render-story")
async def render_story_frame(asset_id: str, body: dict):
    """
    Render a story frame at 1080×1920 with text layers burned in.
    Body: { text_layers: [...] }
    Returns a JPEG with Content-Disposition: attachment for browser download.
    """
    import math
    from PIL import Image
    from app.services.r2_uploader import burn_text_layers

    asset = store.get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    filepath = asset["path"]
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")

    text_layers = body.get("text_layers") or []
    target_w, target_h = 1080, 1920

    img = Image.open(filepath).convert("RGB")
    src_w, src_h = img.width, img.height
    scale = max(target_w / src_w, target_h / src_h)
    new_w = math.ceil(src_w * scale)
    new_h = math.ceil(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    img = img.crop((left, top, left + target_w, top + target_h))

    if text_layers:
        img = burn_text_layers(img, text_layers)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    filename = f"story_{asset_id[:8]}.jpg"
    return Response(
        content=buf.getvalue(),
        media_type="image/jpeg",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{asset_id}/thumb")
async def get_asset_thumb(asset_id: str, size: int = Query(300, ge=50, le=800)):
    asset = store.get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    filepath = asset["path"]
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    try:
        from PIL import Image
        img = Image.open(filepath)
        img.thumbnail((size, size), Image.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75, optimize=True)
        return Response(content=buf.getvalue(), media_type="image/jpeg", headers={
            "Cache-Control": "public, max-age=86400",
        })
    except Exception:
        return FileResponse(filepath, filename=asset["filename"])


@router.get("/{asset_id}/file")
async def get_asset_file(asset_id: str):
    asset = store.get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    filepath = asset["path"]
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(filepath, filename=asset["filename"])


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(asset_id: str):
    asset = store.get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(body: AssetCreate):
    asset = store.create_asset(body.model_dump())
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(asset_id: str, body: AssetUpdate):
    updates = body.model_dump(exclude_unset=True)
    asset = store.update_asset(asset_id, updates)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("/index-directory", response_model=IndexDirectoryResponse)
async def index_directory(body: IndexDirectoryRequest):
    """Index a custom directory path (or default library if omitted)."""
    if _sync_state["sync_in_progress"]:
        raise HTTPException(409, "Sync already in progress")
    return _run_sync(directory=body.directory)


@router.post("/upload", response_model=AssetResponse, status_code=201)
async def upload_asset(file: UploadFile = File(...)):
    """Upload a video, image, or audio file directly and register it as an asset."""
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()

    media_type = classify_media_type(ext)
    if media_type is None:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Accepted: video ({', '.join(VIDEO_EXTENSIONS)}), "
                   f"image ({', '.join(IMAGE_EXTENSIONS)}), audio ({', '.join(AUDIO_EXTENSIONS)})",
        )

    # Save to ~/Integrity_AssetLibrary/UPLOADS/ (created on demand)
    upload_dir = os.path.join(INTEGRITY_ROOT, "UPLOADS")
    os.makedirs(upload_dir, exist_ok=True)

    # Avoid filename collisions with a timestamp prefix
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_stem = Path(filename).stem[:60]  # cap length
    dest_filename = f"{timestamp}_{safe_stem}{ext}"
    dest_path = os.path.join(upload_dir, dest_filename)

    try:
        with open(dest_path, "wb") as f_out:
            shutil.copyfileobj(file.file, f_out)
    finally:
        await file.close()

    file_size = os.path.getsize(dest_path)
    sha256 = compute_sha256(dest_path)

    # Skip exact duplicates already in the store
    if store.has_hash(sha256):
        existing = next((a for a in store.list_assets() if a.get("hash") == sha256), None)
        if existing:
            return existing
        # hash collision with deleted record — proceed to re-register

    # Extract metadata
    width, height, duration = None, None, None
    if media_type == "video":
        width, height, duration = _extract_video_metadata(dest_path)
    elif media_type == "image":
        width, height = _extract_image_dimensions(dest_path)
    elif media_type == "audio":
        duration = _extract_audio_duration(dest_path)

    asset = store.create_asset({
        "path":          dest_path,
        "filename":      dest_filename,
        "media_type":    media_type,
        "file_size":     file_size,
        "hash":          sha256,
        "width":         width,
        "height":        height,
        "duration":      duration,
        "extension":     ext,
        "relative_path": f"UPLOADS/{dest_filename}",
        "category":      "UPLOADS",
        "project":       None,
        "pillar":        None,
        "description":   None,
        "orientation":   None,
        "subject":       None,
        "action":        None,
        "content_type":  media_type if media_type in ("video", "image") else None,
        "ai_keywords":   None,
        "ai_confidence": None,
    })
    return asset
