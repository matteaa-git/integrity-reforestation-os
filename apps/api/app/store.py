"""In-memory asset store — replaced by real DB when PostgreSQL is connected."""

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional


_assets: Dict[str, dict] = {}


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
