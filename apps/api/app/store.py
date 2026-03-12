"""In-memory store — replaced by real DB when PostgreSQL is connected."""

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional


_assets: Dict[str, dict] = {}
_drafts: Dict[str, dict] = {}
_draft_assets: Dict[str, List[dict]] = {}  # draft_id -> ordered list of {asset_id, position}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_asset(data: dict) -> dict:
    asset_id = str(uuid.uuid4())
    now = _now_iso()
    asset = {
        "id": asset_id,
        "path": data["path"],
        "filename": data["filename"],
        "media_type": data["media_type"],
        "width": data.get("width"),
        "height": data.get("height"),
        "duration": data.get("duration"),
        "file_size": data["file_size"],
        "hash": data.get("hash"),
        "created_at": now,
        "updated_at": now,
    }
    _assets[asset_id] = asset
    return asset


def get_asset(asset_id: str) -> Optional[dict]:
    return _assets.get(asset_id)


def list_assets(
    media_type: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    results = list(_assets.values())
    if media_type:
        results = [a for a in results if a["media_type"] == media_type]
    if search:
        q = search.lower()
        results = [a for a in results if q in a["filename"].lower()]
    results.sort(key=lambda a: a["created_at"], reverse=True)
    return results


def update_asset(asset_id: str, data: dict) -> Optional[dict]:
    asset = _assets.get(asset_id)
    if asset is None:
        return None
    for key, value in data.items():
        if value is not None:
            asset[key] = value
    asset["updated_at"] = _now_iso()
    return asset


def has_path(path: str) -> bool:
    return any(a["path"] == path for a in _assets.values())


def has_hash(hash_value: str) -> bool:
    return any(a["hash"] == hash_value for a in _assets.values())


# ---------------------------------------------------------------------------
# Drafts
# ---------------------------------------------------------------------------

def create_draft(data: dict) -> dict:
    draft_id = str(uuid.uuid4())
    now = _now_iso()
    draft = {
        "id": draft_id,
        "title": data["title"],
        "format": data["format"],
        "status": data.get("status", "draft"),
        "source_asset_id": data.get("source_asset_id"),
        "campaign_id": data.get("campaign_id"),
        "scheduled_for": None,
        "schedule_notes": None,
        "created_at": now,
        "updated_at": now,
    }
    _drafts[draft_id] = draft
    _draft_assets[draft_id] = []
    return draft


def get_draft(draft_id: str) -> Optional[dict]:
    return _drafts.get(draft_id)


def list_drafts(
    fmt: Optional[str] = None,
    status: Optional[str] = None,
    scheduled_after: Optional[str] = None,
    scheduled_before: Optional[str] = None,
) -> List[dict]:
    results = list(_drafts.values())
    if fmt:
        results = [d for d in results if d["format"] == fmt]
    if status:
        results = [d for d in results if d["status"] == status]
    if scheduled_after:
        results = [d for d in results if d.get("scheduled_for") and d["scheduled_for"] >= scheduled_after]
    if scheduled_before:
        results = [d for d in results if d.get("scheduled_for") and d["scheduled_for"] <= scheduled_before]
    results.sort(key=lambda d: d.get("scheduled_for") or d["created_at"], reverse=True)
    return results


def update_draft(draft_id: str, data: dict) -> Optional[dict]:
    draft = _drafts.get(draft_id)
    if draft is None:
        return None
    for key, value in data.items():
        if value is not None:
            draft[key] = value
    draft["updated_at"] = _now_iso()
    return draft


def draft_asset_count(draft_id: str) -> int:
    return len(_draft_assets.get(draft_id, []))


# ---------------------------------------------------------------------------
# Draft assets (join table)
# ---------------------------------------------------------------------------

def get_draft_assets(draft_id: str) -> List[dict]:
    entries = _draft_assets.get(draft_id, [])
    result = []
    for entry in sorted(entries, key=lambda e: e["position"]):
        asset = _assets.get(entry["asset_id"])
        if asset:
            result.append({**entry, "asset": asset})
    return result


def add_draft_asset(draft_id: str, asset_id: str, position: Optional[int] = None) -> Optional[dict]:
    if draft_id not in _drafts:
        return None
    if asset_id not in _assets:
        return None
    entries = _draft_assets.setdefault(draft_id, [])
    # prevent duplicates
    if any(e["asset_id"] == asset_id for e in entries):
        return None
    pos = position if position is not None else len(entries)
    entry = {
        "id": str(uuid.uuid4()),
        "draft_id": draft_id,
        "asset_id": asset_id,
        "position": pos,
        "created_at": _now_iso(),
    }
    entries.append(entry)
    # re-normalize positions
    entries.sort(key=lambda e: e["position"])
    for i, e in enumerate(entries):
        e["position"] = i
    return entry


def remove_draft_asset(draft_id: str, asset_id: str) -> bool:
    entries = _draft_assets.get(draft_id, [])
    before = len(entries)
    _draft_assets[draft_id] = [e for e in entries if e["asset_id"] != asset_id]
    # re-normalize positions
    for i, e in enumerate(_draft_assets[draft_id]):
        e["position"] = i
    return len(_draft_assets[draft_id]) < before


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def clear_all() -> None:
    """Reset all stores — for testing only."""
    _assets.clear()
    _drafts.clear()
    _draft_assets.clear()
