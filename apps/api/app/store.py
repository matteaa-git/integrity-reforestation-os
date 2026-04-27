"""In-memory store — replaced by real DB when PostgreSQL is connected."""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

_STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "instagram_state.json")
_DRAFTS_FILE = os.path.join(os.path.dirname(__file__), "..", "drafts_state.json")
_ASSETS_FILE = os.path.join(os.path.dirname(__file__), "..", "assets_state.json")


def _load_instagram_state_from_disk() -> dict:
    try:
        with open(_STATE_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_instagram_state_to_disk(state: dict) -> None:
    try:
        with open(_STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass


def _load_assets_from_disk() -> Dict[str, dict]:
    try:
        with open(_ASSETS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_assets_to_disk() -> None:
    try:
        with open(_ASSETS_FILE, "w") as f:
            json.dump(_assets, f)
    except Exception:
        pass


def _load_drafts_from_disk() -> tuple:
    try:
        with open(_DRAFTS_FILE, "r") as f:
            data = json.load(f)
        return data.get("drafts", {}), data.get("draft_assets", {})
    except Exception:
        return {}, {}


def _save_drafts_to_disk() -> None:
    try:
        with open(_DRAFTS_FILE, "w") as f:
            json.dump({"drafts": _drafts, "draft_assets": _draft_assets}, f, indent=2)
    except Exception:
        pass


_assets: Dict[str, dict] = _load_assets_from_disk()

_drafts_seed, _draft_assets_seed = _load_drafts_from_disk()
_drafts: Dict[str, dict] = _drafts_seed
_draft_assets: Dict[str, List[dict]] = _draft_assets_seed


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
        "extension": data.get("extension"),
        "relative_path": data.get("relative_path"),
        "category": data.get("category"),
        "project": data.get("project"),
        "pillar": data.get("pillar"),
        # Enriched fields from Integrity sidecar / canonical filename
        "description": data.get("description"),
        "orientation": data.get("orientation"),
        "subject": data.get("subject"),
        "action": data.get("action"),
        "content_type": data.get("content_type"),
        "ai_keywords": data.get("ai_keywords") or [],
        "ai_confidence": data.get("ai_confidence"),
        "created_at": now,
        "updated_at": now,
    }
    _assets[asset_id] = asset
    _save_assets_to_disk()
    return asset


def get_asset(asset_id: str) -> Optional[dict]:
    return _assets.get(asset_id)


def list_assets(
    media_type: Optional[str] = None,
    search: Optional[str] = None,
    project: Optional[str] = None,
    pillar: Optional[str] = None,
    subject: Optional[str] = None,
    action: Optional[str] = None,
    orientation: Optional[str] = None,
    content_type: Optional[str] = None,
) -> List[dict]:
    results = list(_assets.values())
    if media_type:
        results = [a for a in results if a["media_type"] == media_type]
    if search:
        q = search.lower()
        results = [
            a for a in results if
            q in a["filename"].lower() or
            q in (a.get("description") or "").lower() or
            any(q in kw for kw in (a.get("ai_keywords") or []))
        ]
    if project:
        results = [a for a in results if (a.get("project") or "").lower() == project.lower()]
    if pillar:
        results = [a for a in results if (a.get("pillar") or "").upper() == pillar.upper()]
    if subject:
        results = [a for a in results if (a.get("subject") or "").upper() == subject.upper()]
    if action:
        results = [a for a in results if (a.get("action") or "").upper() == action.upper()]
    if orientation:
        results = [a for a in results if (a.get("orientation") or "").upper() == orientation.upper()]
    if content_type:
        results = [a for a in results if (a.get("content_type") or "").lower() == content_type.lower()]
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
    _save_assets_to_disk()
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
        "caption": data.get("caption"),
        "hashtags": data.get("hashtags"),
        "scheduled_for": None,
        "schedule_notes": None,
        "metadata": data.get("metadata"),
        "created_at": now,
        "updated_at": now,
    }
    _drafts[draft_id] = draft
    _draft_assets[draft_id] = []
    _save_drafts_to_disk()
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
        draft[key] = value
    draft["updated_at"] = _now_iso()
    _save_drafts_to_disk()
    return draft


def delete_draft(draft_id: str) -> bool:
    if draft_id not in _drafts:
        return False
    _drafts.pop(draft_id)
    _draft_assets.pop(draft_id, None)
    _save_drafts_to_disk()
    return True


def duplicate_draft(draft_id: str) -> Optional[dict]:
    source = _drafts.get(draft_id)
    if source is None:
        return None
    new_id = str(uuid.uuid4())
    now = _now_iso()
    copy = {
        "id": new_id,
        "title": f"{source['title']} (Copy)",
        "format": source["format"],
        "status": "draft",
        "source_asset_id": source.get("source_asset_id"),
        "campaign_id": source.get("campaign_id"),
        "scheduled_for": None,
        "schedule_notes": None,
        "metadata": source.get("metadata"),
        "created_at": now,
        "updated_at": now,
    }
    _drafts[new_id] = copy
    _draft_assets[new_id] = []
    _save_drafts_to_disk()
    return copy


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
    _save_drafts_to_disk()
    return entry


def remove_draft_asset(draft_id: str, asset_id: str) -> bool:
    entries = _draft_assets.get(draft_id, [])
    before = len(entries)
    _draft_assets[draft_id] = [e for e in entries if e["asset_id"] != asset_id]
    # re-normalize positions
    for i, e in enumerate(_draft_assets[draft_id]):
        e["position"] = i
    _save_drafts_to_disk()
    return len(_draft_assets[draft_id]) < before


# ---------------------------------------------------------------------------
# Ad creatives
# ---------------------------------------------------------------------------

_ad_creatives: Dict[str, dict] = {}


def create_ad_creative(data: dict) -> dict:
    creative_id = str(uuid.uuid4())
    now = _now_iso()
    creative = {
        "id": creative_id,
        "title": data.get("title", ""),
        "asset_id": data.get("asset_id"),
        "draft_id": data.get("draft_id"),
        "campaign_id": data.get("campaign_id"),
        "hook_text": data.get("hook_text", ""),
        "cta_text": data.get("cta_text", ""),
        "thumbnail_label": data.get("thumbnail_label", ""),
        "status": data.get("status", "draft"),
        "created_at": now,
        "updated_at": now,
    }
    _ad_creatives[creative_id] = creative
    return creative


def get_ad_creative(creative_id: str) -> Optional[dict]:
    return _ad_creatives.get(creative_id)


def list_ad_creatives(
    campaign_id: Optional[str] = None,
    status: Optional[str] = None,
) -> List[dict]:
    results = list(_ad_creatives.values())
    if campaign_id:
        results = [c for c in results if c.get("campaign_id") == campaign_id]
    if status:
        results = [c for c in results if c["status"] == status]
    results.sort(key=lambda c: c["created_at"], reverse=True)
    return results


def update_ad_creative(creative_id: str, data: dict) -> Optional[dict]:
    creative = _ad_creatives.get(creative_id)
    if creative is None:
        return None
    for key, value in data.items():
        creative[key] = value
    creative["updated_at"] = _now_iso()
    return creative


# ---------------------------------------------------------------------------
# Reel Templates
# ---------------------------------------------------------------------------

_templates: Dict[str, dict] = {}


def create_template(data: dict) -> dict:
    template_id = str(uuid.uuid4())
    now = _now_iso()
    template = {
        "id": template_id,
        "name": data.get("name", ""),
        "category": data.get("category", "custom"),
        "tags": data.get("tags", []),
        "hook_text": data.get("hook_text", ""),
        "cta_text": data.get("cta_text", ""),
        "clip_slots": data.get("clip_slots", []),
        "captions": data.get("captions", []),
        "music_asset_id": data.get("music_asset_id"),
        "thumbnail_asset_id": data.get("thumbnail_asset_id"),
        "usage_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    _templates[template_id] = template
    return template


def get_template(template_id: str) -> Optional[dict]:
    return _templates.get(template_id)


def list_templates(category: Optional[str] = None) -> List[dict]:
    results = list(_templates.values())
    if category:
        results = [t for t in results if t["category"] == category]
    results.sort(key=lambda t: t["created_at"], reverse=True)
    return results


def update_template(template_id: str, data: dict) -> Optional[dict]:
    template = _templates.get(template_id)
    if template is None:
        return None
    for key, value in data.items():
        if value is not None:
            template[key] = value
    template["updated_at"] = _now_iso()
    return template


def delete_template(template_id: str) -> bool:
    return _templates.pop(template_id, None) is not None


def increment_template_usage(template_id: str) -> Optional[dict]:
    template = _templates.get(template_id)
    if template is None:
        return None
    template["usage_count"] = template.get("usage_count", 0) + 1
    template["updated_at"] = _now_iso()
    return template


# ---------------------------------------------------------------------------
# Hook Bank
# ---------------------------------------------------------------------------

_hooks: Dict[str, dict] = {}


def _seed_hooks() -> None:
    """Seed the hook bank with starter hooks for Integrity Reforestation."""
    seeds = [
        # curiosity
        {
            "hook_text": "Most people don't know that planting 1 tree does this to the atmosphere",
            "hook_category": "curiosity",
            "topic_tags": ["reforestation", "climate", "trees"],
            "emotion_tags": ["surprising", "educational"],
            "format": "carousel",
            "performance_score": 87.0,
        },
        {
            "hook_text": "Here's what nobody tells you about carbon offsetting",
            "hook_category": "curiosity",
            "topic_tags": ["carbon", "sustainability", "climate"],
            "emotion_tags": ["surprising", "contrarian"],
            "format": "carousel",
            "performance_score": 82.0,
        },
        {
            "hook_text": "The silent crisis happening in our forests right now",
            "hook_category": "curiosity",
            "topic_tags": ["forests", "environment", "climate"],
            "emotion_tags": ["urgent", "alarming"],
            "format": "carousel",
            "performance_score": 79.0,
        },
        # authority
        {
            "hook_text": "I studied 100 reforestation projects. Here's what actually works",
            "hook_category": "authority",
            "topic_tags": ["reforestation", "research", "impact"],
            "emotion_tags": ["authoritative", "educational"],
            "format": "carousel",
            "performance_score": 91.0,
        },
        {
            "hook_text": "5 things every sustainable brand needs to know about tree planting",
            "hook_category": "authority",
            "topic_tags": ["sustainability", "brands", "education"],
            "emotion_tags": ["educational", "authoritative"],
            "format": "carousel",
            "performance_score": 83.0,
        },
        {
            "hook_text": "The science behind why some reforestation projects fail",
            "hook_category": "authority",
            "topic_tags": ["science", "reforestation", "research"],
            "emotion_tags": ["educational", "credible"],
            "format": "carousel",
            "performance_score": 81.0,
        },
        # contrarian
        {
            "hook_text": "Stop planting trees the wrong way (most brands do this)",
            "hook_category": "contrarian",
            "topic_tags": ["reforestation", "brands", "sustainability"],
            "emotion_tags": ["provocative", "educational"],
            "format": "carousel",
            "performance_score": 88.0,
        },
        {
            "hook_text": "Tree planting apps are lying to you about their impact",
            "hook_category": "contrarian",
            "topic_tags": ["apps", "impact", "sustainability"],
            "emotion_tags": ["provocative", "alarming"],
            "format": "carousel",
            "performance_score": 92.0,
        },
        {
            "hook_text": "The uncomfortable truth about 'carbon neutral' claims",
            "hook_category": "contrarian",
            "topic_tags": ["carbon", "greenwashing", "sustainability"],
            "emotion_tags": ["provocative", "educational"],
            "format": "carousel",
            "performance_score": 88.0,
        },
        # shock
        {
            "hook_text": "We lose 10 million hectares of forest every year. This is what that looks like",
            "hook_category": "shock",
            "topic_tags": ["deforestation", "forests", "climate"],
            "emotion_tags": ["alarming", "urgent"],
            "format": "carousel",
            "performance_score": 85.0,
        },
        {
            "hook_text": "One brand planted 500,000 trees — and it still wasn't enough",
            "hook_category": "shock",
            "topic_tags": ["reforestation", "impact", "brands"],
            "emotion_tags": ["humbling", "urgent"],
            "format": "carousel",
            "performance_score": 84.0,
        },
        # story
        {
            "hook_text": "Three years ago this land was barren. Look at it now.",
            "hook_category": "story",
            "topic_tags": ["transformation", "reforestation", "impact"],
            "emotion_tags": ["inspiring", "hopeful"],
            "format": "carousel",
            "performance_score": 93.0,
        },
        {
            "hook_text": "We planted our first 1,000 trees in 2021. Here's what we learned",
            "hook_category": "story",
            "topic_tags": ["reforestation", "journey", "learning"],
            "emotion_tags": ["authentic", "educational"],
            "format": "carousel",
            "performance_score": 89.0,
        },
        # transformation
        {
            "hook_text": "From degraded farmland to living forest: a 5-year transformation",
            "hook_category": "transformation",
            "topic_tags": ["transformation", "reforestation", "environment"],
            "emotion_tags": ["inspiring", "hopeful"],
            "format": "carousel",
            "performance_score": 90.0,
        },
        {
            "hook_text": "What happens to a community when you restore its forest",
            "hook_category": "transformation",
            "topic_tags": ["community", "reforestation", "impact"],
            "emotion_tags": ["heartwarming", "inspiring"],
            "format": "carousel",
            "performance_score": 86.0,
        },
        # reels
        {
            "hook_text": "POV: You just funded the planting of 1,000 trees",
            "hook_category": "story",
            "topic_tags": ["reforestation", "impact", "community"],
            "emotion_tags": ["inspiring", "heartwarming"],
            "format": "reel",
            "performance_score": 91.0,
        },
        {
            "hook_text": "Watch what happens when a degraded hillside gets reforested",
            "hook_category": "transformation",
            "topic_tags": ["reforestation", "environment", "impact"],
            "emotion_tags": ["inspiring", "hopeful"],
            "format": "reel",
            "performance_score": 88.0,
        },
        {
            "hook_text": "Wait until you see what 10 years of reforestation looks like",
            "hook_category": "curiosity",
            "topic_tags": ["reforestation", "transformation", "climate"],
            "emotion_tags": ["surprising", "inspiring"],
            "format": "reel",
            "performance_score": 87.0,
        },
    ]
    for seed in seeds:
        create_hook({
            **seed,
            "times_used": 0,
            "saves": 0,
            "shares": 0,
            "is_favorite": False,
        })


def create_hook(data: dict) -> dict:
    hook_id = str(uuid.uuid4())
    now = _now_iso()
    hook = {
        "id": hook_id,
        "hook_text": data.get("hook_text", ""),
        "hook_category": data.get("hook_category", "curiosity"),
        "topic_tags": data.get("topic_tags", []),
        "emotion_tags": data.get("emotion_tags", []),
        "format": data.get("format", "universal"),
        "performance_score": float(data.get("performance_score", 50.0)),
        "times_used": int(data.get("times_used", 0)),
        "saves": int(data.get("saves", 0)),
        "shares": int(data.get("shares", 0)),
        "is_favorite": bool(data.get("is_favorite", False)),
        "created_at": now,
        "updated_at": now,
    }
    _hooks[hook_id] = hook
    return hook


def get_hook(hook_id: str) -> Optional[dict]:
    return _hooks.get(hook_id)


def list_hooks(
    category: Optional[str] = None,
    topic: Optional[str] = None,
    emotion: Optional[str] = None,
    fmt: Optional[str] = None,
    min_score: Optional[float] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    sort_by: str = "performance_score",
) -> List[dict]:
    results = list(_hooks.values())
    if category:
        results = [h for h in results if h["hook_category"] == category]
    if topic:
        results = [h for h in results if any(topic.lower() in t.lower() for t in h["topic_tags"])]
    if emotion:
        results = [h for h in results if any(emotion.lower() in e.lower() for e in h["emotion_tags"])]
    if fmt:
        results = [h for h in results if h["format"] in (fmt, "universal")]
    if min_score is not None:
        results = [h for h in results if h["performance_score"] >= min_score]
    if favorites_only:
        results = [h for h in results if h["is_favorite"]]
    if search:
        q = search.lower()
        results = [h for h in results if q in h["hook_text"].lower() or
                   any(q in t.lower() for t in h["topic_tags"])]
    if sort_by == "times_used":
        results.sort(key=lambda h: h["times_used"], reverse=True)
    elif sort_by == "saves":
        results.sort(key=lambda h: h["saves"], reverse=True)
    elif sort_by == "created_at":
        results.sort(key=lambda h: h["created_at"], reverse=True)
    else:
        results.sort(key=lambda h: h["performance_score"], reverse=True)
    return results


def update_hook(hook_id: str, data: dict) -> Optional[dict]:
    hook = _hooks.get(hook_id)
    if hook is None:
        return None
    for key, value in data.items():
        hook[key] = value
    hook["updated_at"] = _now_iso()
    return hook


def delete_hook(hook_id: str) -> bool:
    return _hooks.pop(hook_id, None) is not None


def increment_hook_usage(hook_id: str) -> Optional[dict]:
    hook = _hooks.get(hook_id)
    if hook is None:
        return None
    hook["times_used"] = hook.get("times_used", 0) + 1
    hook["updated_at"] = _now_iso()
    return hook


def toggle_hook_favorite(hook_id: str) -> Optional[dict]:
    hook = _hooks.get(hook_id)
    if hook is None:
        return None
    hook["is_favorite"] = not hook.get("is_favorite", False)
    hook["updated_at"] = _now_iso()
    return hook


def record_hook_save(hook_id: str) -> Optional[dict]:
    hook = _hooks.get(hook_id)
    if hook is None:
        return None
    hook["saves"] = hook.get("saves", 0) + 1
    hook["updated_at"] = _now_iso()
    return hook


def record_hook_share(hook_id: str) -> Optional[dict]:
    hook = _hooks.get(hook_id)
    if hook is None:
        return None
    hook["shares"] = hook.get("shares", 0) + 1
    hook["updated_at"] = _now_iso()
    return hook


def suggest_hooks(topic: Optional[str] = None, limit: int = 5) -> List[dict]:
    """Return top-performing hooks relevant to a topic."""
    return list_hooks(topic=topic, sort_by="performance_score")[:limit]


# Run seed on module load
_seed_hooks()


# ---------------------------------------------------------------------------
# Instagram account + post cache
# ---------------------------------------------------------------------------

_instagram_state: dict = {
    "access_token":       None,   # long-lived page token
    "ig_user_id":         None,
    "username":           None,
    "account_type":       None,
    "followers_count":    0,
    "media_count":        0,
    "profile_picture_url": None,
    "last_synced_at":     None,
}

# Load persisted state from disk on startup
_instagram_state.update({k: v for k, v in _load_instagram_state_from_disk().items() if k in _instagram_state})

_instagram_posts: List[dict] = []


def get_instagram_state() -> dict:
    return dict(_instagram_state)


def set_instagram_state(data: dict) -> None:
    for k, v in data.items():
        if k in _instagram_state:
            _instagram_state[k] = v
    _save_instagram_state_to_disk(_instagram_state)


def clear_instagram_state() -> None:
    for k in list(_instagram_state.keys()):
        _instagram_state[k] = None if k != "followers_count" and k != "media_count" else 0
    _save_instagram_state_to_disk(_instagram_state)


def get_instagram_posts() -> List[dict]:
    return list(_instagram_posts)


def set_instagram_posts(posts: List[dict]) -> None:
    _instagram_posts.clear()
    _instagram_posts.extend(posts)


def is_instagram_connected() -> bool:
    return bool(_instagram_state.get("access_token") and _instagram_state.get("ig_user_id"))


# ---------------------------------------------------------------------------
# X (Twitter) account + post cache
# ---------------------------------------------------------------------------

_x_account_state: dict = {
    "access_token":      None,
    "refresh_token":     None,
    "x_user_id":         None,
    "username":          None,
    "name":              None,
    "profile_image_url": None,
    "followers_count":   0,
    "following_count":   0,
    "tweet_count":       0,
    "last_synced_at":    None,
}

_x_cached_posts: List[dict] = []


def get_x_account_state() -> dict:
    return dict(_x_account_state)


def set_x_account_state(data: dict) -> None:
    for k, v in data.items():
        if k in _x_account_state:
            _x_account_state[k] = v


def clear_x_account_state() -> None:
    for k in list(_x_account_state.keys()):
        if k in ("followers_count", "following_count", "tweet_count"):
            _x_account_state[k] = 0
        else:
            _x_account_state[k] = None
    _x_cached_posts.clear()


def get_x_cached_posts() -> List[dict]:
    return list(_x_cached_posts)


def set_x_cached_posts(posts: List[dict]) -> None:
    _x_cached_posts.clear()
    _x_cached_posts.extend(posts)


def is_x_connected() -> bool:
    return bool(_x_account_state.get("access_token") and _x_account_state.get("x_user_id"))


# ---------------------------------------------------------------------------
# Pinterest account + boards/pins cache
# ---------------------------------------------------------------------------

_pinterest_account_state: dict = {
    "access_token":      None,
    "refresh_token":     None,
    "pinterest_user_id": None,
    "username":          None,
    "account_type":      None,
    "profile_image":     None,
    "website_url":       None,
    "follower_count":    0,
    "following_count":   0,
    "monthly_views":     0,
    "last_synced_at":    None,
}

_pinterest_cached_boards: List[dict] = []
_pinterest_cached_pins:   List[dict] = []


def get_pinterest_account_state() -> dict:
    return dict(_pinterest_account_state)


def set_pinterest_account_state(data: dict) -> None:
    for k, v in data.items():
        if k in _pinterest_account_state:
            _pinterest_account_state[k] = v


def clear_pinterest_account_state() -> None:
    for k in list(_pinterest_account_state.keys()):
        if k in ("follower_count", "following_count", "monthly_views"):
            _pinterest_account_state[k] = 0
        else:
            _pinterest_account_state[k] = None
    _pinterest_cached_boards.clear()
    _pinterest_cached_pins.clear()


def get_pinterest_cached_boards() -> List[dict]:
    return list(_pinterest_cached_boards)


def set_pinterest_cached_boards(boards: List[dict]) -> None:
    _pinterest_cached_boards.clear()
    _pinterest_cached_boards.extend(boards)


def get_pinterest_cached_pins() -> List[dict]:
    return list(_pinterest_cached_pins)


def set_pinterest_cached_pins(pins: List[dict]) -> None:
    _pinterest_cached_pins.clear()
    _pinterest_cached_pins.extend(pins)


def is_pinterest_connected() -> bool:
    return bool(
        _pinterest_account_state.get("access_token") and
        _pinterest_account_state.get("pinterest_user_id")
    )


# ---------------------------------------------------------------------------
# LinkedIn account credentials
# ---------------------------------------------------------------------------

_linkedin_account_state: dict = {
    "access_token": None,
    "person_urn":   None,
    "sub":          None,
    "name":         None,
    "given_name":   None,
    "family_name":  None,
    "email":        None,
    "picture":      None,
    "headline":     None,
    "last_synced_at": None,
}


def get_linkedin_account_state() -> dict:
    return dict(_linkedin_account_state)


def set_linkedin_account_state(data: dict) -> None:
    for k, v in data.items():
        if k in _linkedin_account_state:
            _linkedin_account_state[k] = v


def clear_linkedin_account_state() -> None:
    for k in list(_linkedin_account_state.keys()):
        _linkedin_account_state[k] = None


def is_linkedin_account_connected() -> bool:
    return bool(
        _linkedin_account_state.get("access_token") and
        _linkedin_account_state.get("person_urn")
    )


# ---------------------------------------------------------------------------
# Narrative Dominance Engine — Signals, Opportunities, Arcs, Threads, Planters
# ---------------------------------------------------------------------------

_narrative_signals: Dict[str, dict] = {}
_narrative_opportunities: Dict[str, dict] = {}
_narrative_arcs: Dict[str, dict] = {}
_narrative_threads: Dict[str, dict] = {}
_planters: Dict[str, dict] = {}


def _seed_narrative_engine() -> None:
    signals_seed = [
        {
            "id": "sig-001",
            "signal_type": "environmental",
            "title": "Amazon Deforestation Spike Hits 15-Year High",
            "description": "Satellite data shows a 34% surge in Amazon deforestation this month, dominating global climate news cycles and creating massive authority windows for reforestation advocates.",
            "urgency": 95,
            "relevance": 98,
            "opportunity_window": "48h",
            "narrative_angle": "Integrity's work as a direct counter-force to this crisis — every tree we plant is a measurable resistance act.",
            "platforms": ["instagram", "twitter", "linkedin", "youtube"],
            "tags": ["amazon", "deforestation", "climate-crisis", "reforestation"],
            "status": "active",
            "detected_at": "2026-03-15T06:00:00Z",
        },
        {
            "id": "sig-002",
            "signal_type": "cultural",
            "title": "Earth Day 2026 Campaign Season Opens",
            "description": "Brands and NGOs begin Earth Day content 6 weeks out. Integrity has a 3-week window to establish narrative authority before the space gets saturated.",
            "urgency": 72,
            "relevance": 91,
            "opportunity_window": "3 weeks",
            "narrative_angle": "Not just Earth Day — Earth Year. We plant trees 365 days a year, not for a hashtag.",
            "platforms": ["instagram", "twitter", "tiktok", "youtube"],
            "tags": ["earth-day", "climate", "reforestation", "brand-moment"],
            "status": "emerging",
            "detected_at": "2026-03-14T12:00:00Z",
        },
        {
            "id": "sig-003",
            "signal_type": "social",
            "title": "Planter Community Viral Moment — Marcos Tending 10,000th Tree",
            "description": "Internal milestone: lead planter Marcos Rodriguez reached 10,000 trees this week. Human-interest angle has viral potential on reels and TikTok.",
            "urgency": 88,
            "relevance": 96,
            "opportunity_window": "72h",
            "narrative_angle": "One person. 10,000 trees. An entire ecosystem rebuilt with human hands.",
            "platforms": ["instagram", "tiktok", "youtube"],
            "tags": ["planter-story", "milestone", "human-interest", "viral"],
            "status": "active",
            "detected_at": "2026-03-15T08:00:00Z",
        },
        {
            "id": "sig-004",
            "signal_type": "political",
            "title": "COP31 Pre-Summit Press Wave Building",
            "description": "COP31 pre-summit briefings are generating press. Organizations with credible reforestation data get quoted and shared heavily in this window.",
            "urgency": 60,
            "relevance": 84,
            "opportunity_window": "2 weeks",
            "narrative_angle": "We don't wait for summits. We show up in the field every day, regardless of politics.",
            "platforms": ["linkedin", "twitter", "substack"],
            "tags": ["cop31", "climate-policy", "authority", "credibility"],
            "status": "emerging",
            "detected_at": "2026-03-13T09:00:00Z",
        },
        {
            "id": "sig-005",
            "signal_type": "trend",
            "title": "Regenerative Agriculture Documentary Trending on Netflix",
            "description": "A Netflix documentary on regenerative land practices has spiked search interest in reforestation by 280% this week. Massive audience primed and curious.",
            "urgency": 82,
            "relevance": 89,
            "opportunity_window": "1 week",
            "narrative_angle": "The documentary shows the problem. Integrity Reforestation is the solution you can support today.",
            "platforms": ["instagram", "tiktok", "twitter", "youtube"],
            "tags": ["netflix", "regenerative", "trending", "documentary"],
            "status": "active",
            "detected_at": "2026-03-14T20:00:00Z",
        },
        {
            "id": "sig-006",
            "signal_type": "environmental",
            "title": "Wildfire Season Declared Early in Southeast Asia",
            "description": "Thailand and Indonesia declare early wildfire conditions. Reforestation organizations historically see donation spikes during wildfire media cycles.",
            "urgency": 78,
            "relevance": 87,
            "opportunity_window": "5 days",
            "narrative_angle": "Wildfires destroy in hours what takes decades to grow. This is why we never stop planting.",
            "platforms": ["instagram", "twitter", "youtube"],
            "tags": ["wildfire", "asia", "urgency", "donation-moment"],
            "status": "active",
            "detected_at": "2026-03-15T04:00:00Z",
        },
        {
            "id": "sig-007",
            "signal_type": "cultural",
            "title": "Gen Z Anti-Greenwashing Skepticism at Peak",
            "description": "Social listening shows Gen Z highly skeptical of corporate sustainability claims. Authentic, field-level storytelling from real planters is performing 4x better.",
            "urgency": 55,
            "relevance": 93,
            "opportunity_window": "Ongoing",
            "narrative_angle": "No boardroom. No PR spin. Just dirt under fingernails and trees in the ground.",
            "platforms": ["tiktok", "instagram", "threads"],
            "tags": ["gen-z", "authenticity", "anti-greenwashing", "field-content"],
            "status": "active",
            "detected_at": "2026-03-12T11:00:00Z",
        },
    ]
    for s in signals_seed:
        _narrative_signals[s["id"]] = s

    opps_seed = [
        {
            "id": "opp-001",
            "signal_id": "sig-001",
            "title": "Amazon Crisis Response — Position Integrity as the Antidote",
            "narrative_type": "crisis_response",
            "impact_score": 97,
            "urgency_score": 95,
            "brand_fit": 99,
            "composite_score": 97,
            "recommended_action": "Deploy 3-post rapid response series: (1) acknowledge the crisis with data, (2) show our counter-work on the ground, (3) give audience action.",
            "content_formats": ["reel", "carousel", "twitter_thread"],
            "estimated_reach": "180K–420K",
            "priority": "critical",
            "window_closes": "2026-03-17",
            "key_angle": "We are the resistance. Plant-by-plant, against the tide.",
        },
        {
            "id": "opp-002",
            "signal_id": "sig-003",
            "title": "Marcos Rodriguez 10,000 Trees Milestone Feature",
            "narrative_type": "story",
            "impact_score": 91,
            "urgency_score": 88,
            "brand_fit": 96,
            "composite_score": 92,
            "recommended_action": "Produce a short-form documentary reel (60-90s) with Marcos. Deploy TikTok + Instagram Reel simultaneously.",
            "content_formats": ["reel", "tiktok", "carousel", "twitter_thread"],
            "estimated_reach": "95K–280K",
            "priority": "critical",
            "window_closes": "2026-03-18",
            "key_angle": "10,000 trees. One planter. An entire forest built by a single pair of hands.",
        },
        {
            "id": "opp-003",
            "signal_id": "sig-005",
            "title": "Ride the Netflix Regenerative Wave with Proof-of-Work Content",
            "narrative_type": "authority",
            "impact_score": 86,
            "urgency_score": 82,
            "brand_fit": 88,
            "composite_score": 85,
            "recommended_action": "Create a 'We're already doing this' series referencing the doc themes. Lead audience from curiosity to action.",
            "content_formats": ["carousel", "instagram_story", "substack", "youtube"],
            "estimated_reach": "60K–190K",
            "priority": "high",
            "window_closes": "2026-03-22",
            "key_angle": "The documentary shows the problem. We are the solution.",
        },
        {
            "id": "opp-004",
            "signal_id": "sig-002",
            "title": "Pre-Earth Day Authority Positioning Campaign",
            "narrative_type": "authority",
            "impact_score": 78,
            "urgency_score": 72,
            "brand_fit": 91,
            "composite_score": 80,
            "recommended_action": "Launch a 3-week content arc establishing Integrity as year-round vs. campaign-based organizations.",
            "content_formats": ["carousel", "reel", "substack", "twitter_thread"],
            "estimated_reach": "45K–130K",
            "priority": "high",
            "window_closes": "2026-04-05",
            "key_angle": "Earth Day is every day when you do this work.",
        },
        {
            "id": "opp-005",
            "signal_id": "sig-006",
            "title": "Wildfire Season Urgency — Restoration After Destruction",
            "narrative_type": "movement",
            "impact_score": 82,
            "urgency_score": 78,
            "brand_fit": 85,
            "composite_score": 82,
            "recommended_action": "Deploy single high-impact reel: contrast wildfire destruction vs. Integrity reforestation. CTA to donate.",
            "content_formats": ["reel", "tiktok", "instagram_story"],
            "estimated_reach": "70K–210K",
            "priority": "high",
            "window_closes": "2026-03-20",
            "key_angle": "While fires burn, we plant.",
        },
        {
            "id": "opp-006",
            "signal_id": "sig-007",
            "title": "Anti-Greenwashing Authenticity Play",
            "narrative_type": "education",
            "impact_score": 75,
            "urgency_score": 55,
            "brand_fit": 94,
            "composite_score": 74,
            "recommended_action": "Series of Day in the Field raw, unpolished content showing real planter work. No graphics. Pure credibility.",
            "content_formats": ["reel", "tiktok", "instagram_story"],
            "estimated_reach": "30K–95K",
            "priority": "medium",
            "window_closes": "Ongoing",
            "key_angle": "No greenwashing here. Just mud, sweat, and 10 million trees.",
        },
    ]
    for o in opps_seed:
        _narrative_opportunities[o["id"]] = o

    arcs_seed = [
        {
            "id": "arc-001",
            "title": "The Planter's Journey — Marcos Rodriguez",
            "narrative_type": "story",
            "protagonist": "Marcos Rodriguez, Lead Field Planter",
            "tension": "One man against a deforested hillside — no machinery, just hands and determination.",
            "resolution": "10,000 trees later, the hillside breathes again. A community has clean water. Wildlife has returned.",
            "beats": [
                {"beat_number": 1, "title": "The Empty Hill", "description": "Show the degraded land before Marcos arrived. Barren, eroded, silent.", "content_format": "reel", "hook_suggestion": "This hill used to be dead. Here's what happened next.", "asset_category": "drone"},
                {"beat_number": 2, "title": "Day One", "description": "Marcos planting his first tree. The weight of mission.", "content_format": "reel", "hook_suggestion": "He planted one tree. Then another. Then he didn't stop.", "asset_category": "talking_head"},
                {"beat_number": 3, "title": "The Struggle", "description": "Dry season, losing seedlings, self-doubt. The real cost.", "content_format": "carousel", "hook_suggestion": "Nobody told him 40% of the seedlings would die in the first year.", "asset_category": "photo"},
                {"beat_number": 4, "title": "Signs of Life", "description": "First bird nest. First canopy closure. Water returning to the stream.", "content_format": "reel", "hook_suggestion": "The moment we knew it was working.", "asset_category": "timelapse"},
                {"beat_number": 5, "title": "10,000", "description": "The milestone. Community celebration. What 10,000 trees looks like from above.", "content_format": "reel", "hook_suggestion": "10,000 trees. One planter. Watch what that looks like from the sky.", "asset_category": "drone"},
            ],
            "arc_length": 5,
            "estimated_duration": "2 weeks",
            "key_messages": ["Individual action creates collective change", "Reforestation is measured in decades, not campaigns", "Real work looks like real hands in real dirt"],
            "cta": "Sponsor a tree in Marcos's forest — from $5.",
            "emotional_arc": "Despair → Determination → Doubt → Hope → Triumph",
            "created_at": "2026-03-10T10:00:00Z",
        },
        {
            "id": "arc-002",
            "title": "The Amazon Counter-Narrative",
            "narrative_type": "crisis_response",
            "protagonist": "Integrity Reforestation as collective force",
            "tension": "The Amazon is burning while headlines flood the media — and most organizations only tweet about it.",
            "resolution": "Integrity is in the field. Planting. Restoring. Resisting. This is what doing the work actually looks like.",
            "beats": [
                {"beat_number": 1, "title": "The Alarm", "description": "Open with the data. 34% spike. Satellite images. Hard facts.", "content_format": "carousel", "hook_suggestion": "The Amazon just hit a 15-year deforestation record. Here's what we're doing about it.", "asset_category": "photo"},
                {"beat_number": 2, "title": "The Response", "description": "Cut to field footage. Our planters. Our trees going in the ground. Today.", "content_format": "reel", "hook_suggestion": "While the news breaks, we plant.", "asset_category": "video"},
                {"beat_number": 3, "title": "The Numbers", "description": "Our impact data. Trees planted this year. Hectares restored. Communities served.", "content_format": "carousel", "hook_suggestion": "Here's what 10 million trees actually looks like in numbers.", "asset_category": "drone"},
            ],
            "arc_length": 3,
            "estimated_duration": "48 hours",
            "key_messages": ["Action > statements", "We are in the field today", "Real impact is measurable"],
            "cta": "We're planting right now. Will you help us plant 1,000 more this week?",
            "emotional_arc": "Alarm → Agency → Hope",
            "created_at": "2026-03-15T06:30:00Z",
        },
        {
            "id": "arc-003",
            "title": "Year-Round vs. Campaign Organizations",
            "narrative_type": "authority",
            "protagonist": "Integrity Reforestation — the organization that never stops",
            "tension": "Every April, organizations post about Earth Day. The other 364 days? Silence.",
            "resolution": "Integrity is in the field on days 1 through 365. That's the difference between marketing and mission.",
            "beats": [
                {"beat_number": 1, "title": "Earth Day Is Every Day", "description": "Contrast campaign orgs in April vs. Integrity posting field updates weekly.", "content_format": "carousel", "hook_suggestion": "When's the last time you heard from most environmental brands? Probably April.", "asset_category": "photo"},
                {"beat_number": 2, "title": "January in the Field", "description": "Field footage from cold season planting. Nobody talks about this.", "content_format": "reel", "hook_suggestion": "We were planting in January. While everyone else was doing year-end recaps.", "asset_category": "video"},
                {"beat_number": 3, "title": "The Math", "description": "365 days x planting schedule = real impact compounded over years.", "content_format": "carousel", "hook_suggestion": "If you plant for 30 days a year vs. 365, here's the math on what you're missing.", "asset_category": "photo"},
                {"beat_number": 4, "title": "Join the Year-Round Mission", "description": "CTA: monthly giving, tree sponsorship, following for daily field updates.", "content_format": "reel", "hook_suggestion": "Don't just support Earth Day. Support Earth Year.", "asset_category": "talking_head"},
            ],
            "arc_length": 4,
            "estimated_duration": "3 weeks",
            "key_messages": ["Mission over marketing", "Compounding impact", "Daily work over campaign bursts"],
            "cta": "Become a monthly tree planter — $15/month, 3 trees guaranteed.",
            "emotional_arc": "Frustration → Contrast → Respect → Invitation",
            "created_at": "2026-03-14T14:00:00Z",
        },
    ]
    for a in arcs_seed:
        _narrative_arcs[a["id"]] = a

    threads_seed = [
        {
            "id": "thr-001",
            "narrative_id": "arc-001",
            "title": "Marcos Rodriguez — The Thread",
            "platform": "twitter",
            "hook_tweet": "One planter. 10,000 trees. Here's the story nobody's telling about what reforestation actually looks like. 🧵",
            "tweets": [
                {"position": 1, "text": "One planter. 10,000 trees. Here's the story nobody's telling about what reforestation actually looks like. 🧵", "char_count": 110, "engagement_hook": "Curiosity gap + number + promise", "media_suggestion": "Drone shot of completed forest"},
                {"position": 2, "text": "In 2018, Marcos Rodriguez arrived at a degraded hillside. No shade. No birds. No water. Just eroded soil and silence.", "char_count": 118, "engagement_hook": "Scene-setting contrast", "media_suggestion": "Before photo of barren hillside"},
                {"position": 3, "text": "He planted his first tree. Then another. Then another.\n\nHe didn't stop for 8 years.", "char_count": 84, "engagement_hook": "Rhythm + commitment", "media_suggestion": "Close-up of hands in soil"},
                {"position": 4, "text": "Year 1: 40% of seedlings died in the dry season. He replanted. Every. Single. One.", "char_count": 88, "engagement_hook": "Obstacle + persistence", "media_suggestion": "Dry seedling tray"},
                {"position": 5, "text": "Year 3: the first bird nested in his trees.\n\nHe told us that was the moment he knew it was going to work.", "char_count": 107, "engagement_hook": "Emotional milestone", "media_suggestion": "Bird nest in young tree"},
                {"position": 6, "text": "Year 5: a stream that had dried up 20 years ago started flowing again.\n\nThat's what trees do. They bring water back.", "char_count": 120, "engagement_hook": "Science meets wonder", "media_suggestion": "Flowing stream"},
                {"position": 7, "text": "This week: Marcos planted his 10,000th tree.\n\n10,000 trees. 8 years. One person. An entire ecosystem rebuilt.", "char_count": 110, "engagement_hook": "Payoff + scale", "media_suggestion": "Aerial view of full forest"},
                {"position": 8, "text": "If you want to help Marcos plant 10,000 more — you can sponsor a tree in his forest for $5.\n\nLink in bio. Every tree counts.", "char_count": 128, "engagement_hook": "Specific CTA + accessibility", "media_suggestion": None},
            ],
            "thread_length": 8,
            "estimated_impressions": "45K–180K",
            "hook_score": 91,
            "created_at": "2026-03-15T09:00:00Z",
        },
        {
            "id": "thr-002",
            "narrative_id": "arc-002",
            "title": "Amazon Crisis Response Thread",
            "platform": "twitter",
            "hook_tweet": "The Amazon just hit a 15-year deforestation record. Most orgs are tweeting about it. Here's what we're actually doing. 🧵",
            "tweets": [
                {"position": 1, "text": "The Amazon just hit a 15-year deforestation record. Most orgs are tweeting about it. Here's what we're actually doing. 🧵", "char_count": 126, "engagement_hook": "Crisis + contrast hook", "media_suggestion": "Satellite comparison image"},
                {"position": 2, "text": "Today our field teams planted 847 trees. Yesterday: 1,203. The day before: 990.\n\nWe don't pause for press cycles.", "char_count": 117, "engagement_hook": "Specific data = credibility", "media_suggestion": "Field team planting"},
                {"position": 3, "text": "Deforestation is a daily act of destruction. Reforestation has to be a daily act of resistance.", "char_count": 95, "engagement_hook": "Manifesto line", "media_suggestion": None},
                {"position": 4, "text": "Since January 1, 2026:\n847K trees planted\n12,400 hectares restored\n23 communities supported\n\nThis is what doing the work looks like.", "char_count": 145, "engagement_hook": "Impact list", "media_suggestion": "Data visualization"},
                {"position": 5, "text": "We need to plant 1,000 more trees this week to stay on track.\n\nWill you help? $5 plants one tree. Link in bio.", "char_count": 113, "engagement_hook": "Specific ask + urgency", "media_suggestion": None},
            ],
            "thread_length": 5,
            "estimated_impressions": "62K–230K",
            "hook_score": 94,
            "created_at": "2026-03-15T07:00:00Z",
        },
    ]
    for t in threads_seed:
        _narrative_threads[t["id"]] = t

    planters_seed = [
        {
            "id": "plt-001",
            "name": "Marcos Rodriguez",
            "role": "Lead Field Planter",
            "location": "Chiapas Region, Mexico",
            "story_arc": "impact",
            "quote": "Every tree I plant is a letter to the next generation. I hope they can read it.",
            "narrative_tags": ["milestone", "dedication", "long-term", "indigenous-land"],
            "photo_asset_id": None,
            "impact_metrics": {"trees_planted": 10000, "hectares_restored": 48.5, "communities_served": 3, "years_active": 8},
            "content_angle": "The planter who rebuilt an entire hillside by hand over 8 years — now at 10,000 trees.",
            "story_beats": ["Arrived at degraded land with no machinery, just determination", "First year: 40% seedling loss to drought — he replanted every single one", "Year 3: first bird nested in his trees", "Year 5: the dried stream began flowing again", "Year 8: 10,000 trees — an ecosystem reborn"],
            "emotional_profile": "inspiring",
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "id": "plt-002",
            "name": "Amara Diallo",
            "role": "Community Reforestation Coordinator",
            "location": "Sahel Region, Mali",
            "story_arc": "transformation",
            "quote": "My village had no shade when I was a child. My children grow up under a canopy we built together.",
            "narrative_tags": ["community", "women-led", "sahel", "water-security"],
            "photo_asset_id": None,
            "impact_metrics": {"trees_planted": 4200, "hectares_restored": 18.0, "communities_served": 7, "years_active": 5},
            "content_angle": "How a mother of four rebuilt her community's forest and restored access to water for 700 people.",
            "story_beats": ["Grew up where trees had been cleared for agriculture", "Joined Integrity after seeing her children fetch water from 5km away", "Trained 45 women in her community to plant native species", "Year 3: water table rose, restoring a community well", "Now coordinates 7 villages and 4,200 trees"],
            "emotional_profile": "inspiring",
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "id": "plt-003",
            "name": "Bui Thi Lan",
            "role": "Seedling Nursery Manager",
            "location": "Mekong Delta, Vietnam",
            "story_arc": "origin",
            "quote": "People think forests grow from trees. They grow from seeds. Every seed is a decision.",
            "narrative_tags": ["nursery", "seedlings", "science", "origin-story"],
            "photo_asset_id": None,
            "impact_metrics": {"trees_planted": 28000, "hectares_restored": 0.0, "communities_served": 12, "years_active": 6},
            "content_angle": "The woman who has grown 28,000 seedlings — the invisible engine behind every Integrity forest.",
            "story_beats": ["Former rice farmer who lost her crop to flooding from deforestation", "Retrained as a native-species nursery specialist", "Manages a 12,000-seedling nursery supplying 6 planting teams", "Her seedlings have a 94% survival rate — the highest in the program", "She names every batch of seedlings"],
            "emotional_profile": "educational",
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "id": "plt-004",
            "name": "Diego Fuentes",
            "role": "Drone Surveyor & Forest Monitor",
            "location": "Andes Foothills, Colombia",
            "story_arc": "challenge",
            "quote": "The data never lies. Sometimes it tells you you're winning. Sometimes it breaks your heart. Both are necessary.",
            "narrative_tags": ["technology", "data", "monitoring", "youth"],
            "photo_asset_id": None,
            "impact_metrics": {"trees_planted": 1500, "hectares_restored": 94.0, "communities_served": 5, "years_active": 3},
            "content_angle": "22 years old, flying drones over forests he helped plant — finding out which trees are surviving.",
            "story_beats": ["Grew up in a city, never imagined working in forests", "Joined as a volunteer at 19, learned drone surveying on-the-job", "His maps revealed a 30% mortality zone — data that saved a planting program", "Now trains other young surveyors across the region", "His footage has been used in 3 NGO campaigns reaching 2M+ people"],
            "emotional_profile": "educational",
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "id": "plt-005",
            "name": "Fatimah Hassan",
            "role": "Indigenous Knowledge Integration Lead",
            "location": "Borneo, Indonesia",
            "story_arc": "transformation",
            "quote": "The forest doesn't need us to teach it how to grow. It needs us to remember what we've forgotten.",
            "narrative_tags": ["indigenous", "knowledge", "biodiversity", "culture"],
            "photo_asset_id": None,
            "impact_metrics": {"trees_planted": 3800, "hectares_restored": 22.0, "communities_served": 4, "years_active": 4},
            "content_angle": "How ancient indigenous planting knowledge is making Integrity's forests grow 40% faster than conventional methods.",
            "story_beats": ["Elder of the Dayak community, keeper of traditional forest knowledge", "Partnered with Integrity to integrate traditional species selection", "Her multi-species plots have 40% higher biodiversity than single-species sites", "Training a new generation in indigenous botanical knowledge before it is lost", "Her methods are now part of Integrity's core field protocol"],
            "emotional_profile": "inspiring",
            "created_at": "2026-01-01T00:00:00Z",
        },
    ]
    for p in planters_seed:
        _planters[p["id"]] = p


_seed_narrative_engine()


def list_narrative_signals(
    status: Optional[str] = None,
    signal_type: Optional[str] = None,
    min_urgency: Optional[int] = None,
) -> List[dict]:
    signals = list(_narrative_signals.values())
    if status:
        signals = [s for s in signals if s["status"] == status]
    if signal_type:
        signals = [s for s in signals if s["signal_type"] == signal_type]
    if min_urgency is not None:
        signals = [s for s in signals if s["urgency"] >= min_urgency]
    return sorted(signals, key=lambda s: s["urgency"], reverse=True)


def get_narrative_signal(signal_id: str) -> Optional[dict]:
    return _narrative_signals.get(signal_id)


def list_narrative_opportunities(
    priority: Optional[str] = None,
    narrative_type: Optional[str] = None,
    min_score: Optional[int] = None,
) -> List[dict]:
    opps = list(_narrative_opportunities.values())
    if priority:
        opps = [o for o in opps if o["priority"] == priority]
    if narrative_type:
        opps = [o for o in opps if o["narrative_type"] == narrative_type]
    if min_score is not None:
        opps = [o for o in opps if o["composite_score"] >= min_score]
    return sorted(opps, key=lambda o: o["composite_score"], reverse=True)


def list_narrative_arcs() -> List[dict]:
    return sorted(_narrative_arcs.values(), key=lambda a: a["created_at"], reverse=True)


def get_narrative_arc(arc_id: str) -> Optional[dict]:
    return _narrative_arcs.get(arc_id)


def generate_narrative_arc(
    topic: str,
    narrative_type: str = "story",
    protagonist: Optional[str] = None,
    arc_length: int = 5,
) -> dict:
    arc_id = str(uuid.uuid4())
    now = _now_iso()
    protagonists = {
        "story": "An Integrity field planter",
        "authority": "Integrity Reforestation's science team",
        "education": "A reforestation educator",
        "crisis_response": "The Integrity field response team",
        "movement": "The global reforestation community",
    }
    proto = protagonist or protagonists.get(narrative_type, "Integrity Reforestation")
    beat_templates = [
        {"title": "The Status Quo", "description": f"Establish the problem: {topic} as it stands today.", "content_format": "carousel", "hook_suggestion": f"Here's what most people don't know about {topic}.", "asset_category": "photo"},
        {"title": "The Discovery", "description": f"The insight that changes everything about {topic}.", "content_format": "reel", "hook_suggestion": f"We've been thinking about {topic} all wrong.", "asset_category": "talking_head"},
        {"title": "The Work", "description": f"Field footage showing Integrity's direct response to {topic}.", "content_format": "reel", "hook_suggestion": f"This is what we're actually doing about {topic}.", "asset_category": "video"},
        {"title": "The Evidence", "description": f"Data and outcomes that prove the approach works on {topic}.", "content_format": "carousel", "hook_suggestion": f"Here are the numbers after 3 years of work on {topic}.", "asset_category": "drone"},
        {"title": "The Invitation", "description": f"Give the audience a specific action to join the response to {topic}.", "content_format": "reel", "hook_suggestion": f"Here's exactly how you can help us solve {topic}.", "asset_category": "talking_head"},
        {"title": "The Proof", "description": f"Before/after visual documentation of transformation related to {topic}.", "content_format": "carousel", "hook_suggestion": f"Before and after: what happens when we take {topic} seriously.", "asset_category": "drone"},
        {"title": "The Future", "description": f"Project forward: if this approach scales, what does the world look like?", "content_format": "reel", "hook_suggestion": f"If every community responded to {topic} like this, here's what happens.", "asset_category": "timelapse"},
    ]
    beats = []
    for i in range(min(arc_length, len(beat_templates))):
        beat = dict(beat_templates[i])
        beat["beat_number"] = i + 1
        beats.append(beat)
    arc = {
        "id": arc_id,
        "title": f"{topic} — A Narrative Arc",
        "narrative_type": narrative_type,
        "protagonist": proto,
        "tension": f"The world faces {topic} while deforestation accelerates unchecked.",
        "resolution": f"Integrity Reforestation provides a proven, field-tested solution to {topic} through systematic reforestation.",
        "beats": beats,
        "arc_length": arc_length,
        "estimated_duration": f"{arc_length * 3} days",
        "key_messages": [f"Reforestation is the most direct response to {topic}", "Field-level action beats policy statements", "Every tree is a measurable unit of progress"],
        "cta": f"Help us plant 1,000 trees in response to {topic} — $5 plants one tree.",
        "emotional_arc": "Alarm → Understanding → Agency → Hope → Action",
        "created_at": now,
    }
    _narrative_arcs[arc_id] = arc
    return arc


def list_narrative_threads(platform: Optional[str] = None) -> List[dict]:
    threads = list(_narrative_threads.values())
    if platform:
        threads = [t for t in threads if t["platform"] == platform]
    return sorted(threads, key=lambda t: t["hook_score"], reverse=True)


def build_narrative_thread(
    topic: str,
    platform: str = "twitter",
    thread_length: int = 7,
    narrative_id: Optional[str] = None,
) -> dict:
    thread_id = str(uuid.uuid4())
    now = _now_iso()
    char_limit = 280 if platform == "twitter" else 500
    raw_tweets = [
        f"{topic}: here's what most people don't realize about what this means for global forests. 🧵",
        f"First, the scale. Every year, the world loses 10 million hectares of forest — the size of South Korea, gone annually.",
        f"{topic} accelerates this. Rising temperatures stress native species. Drought kills seedlings. Pest pressure multiplies.",
        f"But here's what most coverage misses: reforestation is already working. We have the data.",
        f"At Integrity, we've planted 847,000 trees since January. Survival rate: 87%. That's not a campaign — it's a field operation.",
        f"The math: if 1,000 organizations planted at our rate, we'd replace the annual loss in under a year.",
        f"What you can do right now: sponsor a tree ($5), share this thread, follow for daily field updates. Real action beats awareness. Link in bio.",
    ]
    tweets = []
    hooks = ["Curiosity gap + promise", "Scale + shock", "How + mechanism", "Reframe", "Proof + data", "Vision + scale", "CTA + specifics"]
    media = ["Aerial forest drone", "Deforestation map", "Infographic", "Field footage", "Data visualization", "Scale comparison", None]
    for i, text in enumerate(raw_tweets[:thread_length]):
        tweets.append({
            "position": i + 1,
            "text": text[:char_limit],
            "char_count": min(len(text), char_limit),
            "engagement_hook": hooks[i] if i < len(hooks) else "Supporting point",
            "media_suggestion": media[i] if i < len(media) else None,
        })
    thread = {
        "id": thread_id,
        "narrative_id": narrative_id,
        "title": f"{topic} — Thread",
        "platform": platform,
        "hook_tweet": tweets[0]["text"] if tweets else "",
        "tweets": tweets,
        "thread_length": len(tweets),
        "estimated_impressions": "35K–140K",
        "hook_score": 86,
        "created_at": now,
    }
    _narrative_threads[thread_id] = thread
    return thread


def list_planters(story_arc: Optional[str] = None) -> List[dict]:
    planters = list(_planters.values())
    if story_arc:
        planters = [p for p in planters if p["story_arc"] == story_arc]
    return sorted(planters, key=lambda p: p["impact_metrics"]["trees_planted"], reverse=True)


def get_planter(planter_id: str) -> Optional[dict]:
    return _planters.get(planter_id)


def get_war_room_metrics() -> dict:
    signals = list(_narrative_signals.values())
    opps = list(_narrative_opportunities.values())
    return {
        "narrative_velocity": 2.4,
        "active_narratives": len([s for s in signals if s["status"] == "active"]),
        "narrative_reach_7d": 847000,
        "top_narrative": "The Amazon Counter-Narrative",
        "signals_detected": len(signals),
        "opportunities_open": len(opps),
        "content_pipeline": {
            "drafts": len([d for d in _drafts.values() if d.get("status") == "draft"]),
            "in_review": len([d for d in _drafts.values() if d.get("status") == "in_review"]),
            "approved": len([d for d in _drafts.values() if d.get("status") == "approved"]),
            "scheduled": len([d for d in _drafts.values() if d.get("status") == "scheduled"]),
        },
        "signal_alerts": [
            {"level": "critical", "message": "Amazon deforestation signal expires in 31h — deploy content now", "timestamp": "2026-03-15T08:00:00Z"},
            {"level": "warning", "message": "Marcos milestone window closing — 60h remaining", "timestamp": "2026-03-15T07:00:00Z"},
            {"level": "info", "message": "Earth Day arc should begin publishing by March 22", "timestamp": "2026-03-15T06:00:00Z"},
        ],
        "narrative_performance": [
            {"narrative": "Planter Stories", "reach": 284000, "engagement": 6.8, "momentum": "rising", "posts_count": 12},
            {"narrative": "Crisis Response", "reach": 198000, "engagement": 8.2, "momentum": "rising", "posts_count": 4},
            {"narrative": "Impact Data", "reach": 145000, "engagement": 4.1, "momentum": "stable", "posts_count": 9},
            {"narrative": "Education Series", "reach": 112000, "engagement": 5.3, "momentum": "stable", "posts_count": 7},
            {"narrative": "Field Diaries", "reach": 89000, "engagement": 7.9, "momentum": "rising", "posts_count": 18},
            {"narrative": "Year-Round Mission", "reach": 54000, "engagement": 3.8, "momentum": "declining", "posts_count": 3},
        ],
    }


def generate_cross_platform_plan(
    narrative_title: str,
    core_message: str,
    narrative_type: str = "story",
    narrative_id: Optional[str] = None,
) -> dict:
    return {
        "narrative_id": narrative_id,
        "narrative_title": narrative_title,
        "source_narrative": core_message,
        "twitter_thread": {
            "hook": f"{narrative_title}: here's what most people don't know. 🧵",
            "posts": [
                f"{narrative_title}: here's what most people don't know. 🧵",
                f"First, the scale. {core_message[:80]}...",
                f"But here's what most coverage misses: reforestation is already working.",
                f"At Integrity, we've planted 847K trees since January. 87% survival rate.",
                f"The math: if 1,000 orgs planted at our scale, we'd offset annual global loss.",
                f"What you can do: sponsor a tree ($5), share this, follow for daily updates.",
            ],
            "cta": "Plant a tree today. Link in bio.",
            "estimated_impressions": "45K–180K",
        },
        "instagram_carousel": {
            "slide_count": 7,
            "slides": [
                f"SLIDE 1 — HOOK: {narrative_title}",
                f"SLIDE 2 — THE PROBLEM: {core_message[:120]}",
                "SLIDE 3 — THE SCALE: 10M hectares lost per year globally",
                "SLIDE 4 — OUR RESPONSE: 847,000 trees planted in 2026",
                "SLIDE 5 — THE EVIDENCE: Before/after drone imagery",
                "SLIDE 6 — THE PLANTERS: Real people, real hands, real work",
                "SLIDE 7 — CTA: Sponsor a tree from $5. Link in bio.",
            ],
            "caption": f"{narrative_title}\n\n{core_message[:200]}\n\nSwipe to see the full story\n\n#Reforestation #ClimateAction #IntegrityReforestation",
            "hashtags": ["#Reforestation", "#ClimateAction", "#IntegrityReforestation", "#ForestRestoration", "#TreePlanting", "#Sustainability"],
        },
        "instagram_reel": {
            "concept": f"60-second field documentary style: '{narrative_title}'",
            "hook": f"'{core_message[:60]}...' — then cut to field footage.",
            "script_beats": [
                f"0–3s: Bold text overlay — '{narrative_title}'",
                "3–10s: Aerial drone establishing shot",
                "10–25s: Field planter B-roll — hands in soil",
                "25–40s: Data text overlays — key impact numbers",
                "40–52s: Emotional close-up — planter's face, birds, water",
                "52–60s: CTA screen — 'Plant a tree from $5. Link in bio.'",
            ],
            "cta": "Plant a tree. Link in bio.",
            "recommended_duration": "60s",
            "sound_suggestion": "Cinematic ambient — low strings, nature sounds, no lyrics",
        },
        "tiktok": {
            "concept": f"Raw, field-level perspective on {narrative_title}",
            "hook": f"POV: You asked what we actually do about this...",
            "structure": [
                "0–2s: Hook text overlay or direct-to-camera statement",
                "2–15s: Raw field footage — no polish, authentic",
                "15–35s: Walk-and-talk with a planter",
                "35–50s: The payoff — impact visual or data reveal",
                "50–60s: CTA — 'Follow for daily forest updates'",
            ],
            "sound_suggestion": "Trending ambient or original sound",
            "trend_angle": "POV / Day-in-the-life / Satisfying transformation",
        },
        "youtube": {
            "title": f"{narrative_title} | Integrity Reforestation",
            "description": f"{core_message}\n\nIn this video, we go deep on {narrative_title}.\n\n#Reforestation #ClimateAction",
            "chapters": ["00:00 — Introduction", "01:30 — The Problem", "04:00 — Our Response", "07:30 — The Data", "11:00 — Meet the Planters", "14:30 — How You Can Help"],
            "thumbnail_concept": "Split-screen: deforested land (left) vs. Integrity's restored forest (right). Bold text: 'This Changed Everything'",
            "format": "documentary",
        },
        "substack": {
            "title": f"{narrative_title}: A Field Report from Integrity Reforestation",
            "subtitle": "What's really happening, what we're doing, and what the data shows.",
            "intro": f"This week, {narrative_title} dominated the headlines. But most coverage missed the most important part: there are organizations already doing the work. We're one of them.",
            "body_outline": [
                "Section 1: The situation as we see it from the field",
                "Section 2: Our response — specific numbers, locations, planting targets",
                "Section 3: What the data shows after months of work",
                "Section 4: The planters making this possible — one story in detail",
                "Section 5: What we need from our community right now",
            ],
            "conclusion": "You don't have to wait for a summit. You can plant a tree today. That's where we always start.",
            "cta": "Sponsor a tree — from $5. Every tree is tracked, photographed, and reported back to you.",
        },
        "total_content_pieces": 21,
        "estimated_total_reach": "350K–1.2M",
    }


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def clear_all() -> None:
    """Reset all stores — for testing only."""
    _assets.clear()
    _drafts.clear()
    _draft_assets.clear()
    _ad_creatives.clear()
    _templates.clear()
    _hooks.clear()
    clear_instagram_state()
    _instagram_posts.clear()
    _narrative_signals.clear()
    _narrative_opportunities.clear()
    _narrative_arcs.clear()
    _narrative_threads.clear()
    _planters.clear()


# ---------------------------------------------------------------------------
# Live Signal Intelligence Store
# ---------------------------------------------------------------------------

from datetime import timezone as _tz  # avoid shadowing builtin

_live_signals: Dict[str, dict] = {}
_live_narratives: Dict[str, dict] = {}      # generated narratives keyed by narrative_id
_live_content: Dict[str, dict] = {}         # generated content keyed by content_id
_signal_stats: dict = {
    "last_refreshed": None,
    "total_ingested": 0,
    "refresh_count": 0,
}


def upsert_live_signal(signal: dict) -> dict:
    """Insert or replace a live signal. Returns the stored signal."""
    _live_signals[signal["id"]] = signal
    return signal


def get_live_signal(signal_id: str) -> Optional[dict]:
    return _live_signals.get(signal_id)


def list_live_signals(
    category: Optional[str] = None,
    status: Optional[str] = None,
    min_score: Optional[int] = None,
    limit: int = 50,
) -> List[dict]:
    signals = list(_live_signals.values())
    if category:
        signals = [s for s in signals if s.get("category") == category]
    if status:
        signals = [s for s in signals if s.get("status") == status]
    if min_score is not None:
        signals = [s for s in signals if s.get("opportunity_score", 0) >= min_score]
    signals.sort(key=lambda s: s.get("opportunity_score", 0), reverse=True)
    return signals[:limit]


def list_trending_signals(limit: int = 10) -> List[dict]:
    """Return signals sorted by trend_velocity × opportunity_score."""
    signals = list(_live_signals.values())
    signals = [s for s in signals if s.get("status") in ("active", "emerging")]
    signals.sort(key=lambda s: s.get("trend_velocity", 0) * s.get("opportunity_score", 0), reverse=True)
    return signals[:limit]


def save_signal(signal_id: str) -> Optional[dict]:
    sig = _live_signals.get(signal_id)
    if sig:
        sig["is_saved"] = True
    return sig


def set_signal_narrative(signal_id: str, narrative_id: str) -> None:
    sig = _live_signals.get(signal_id)
    if sig:
        sig["narrative_id"] = narrative_id


def bulk_upsert_signals(signals: List[dict]) -> int:
    """Upsert a batch of signals. Returns count of new signals added."""
    new_count = 0
    for sig in signals:
        is_new = sig["id"] not in _live_signals
        _live_signals[sig["id"]] = sig
        if is_new:
            new_count += 1
    return new_count


def update_signal_stats(ingested: int, new: int) -> None:
    now = datetime.now(_tz.utc).isoformat()
    _signal_stats["last_refreshed"] = now
    _signal_stats["total_ingested"] = ingested
    _signal_stats["refresh_count"] = _signal_stats.get("refresh_count", 0) + 1


def get_signal_stats() -> dict:
    return dict(_signal_stats)


def get_live_signal_summary() -> dict:
    signals = list(_live_signals.values())
    active = [s for s in signals if s.get("status") == "active"]
    emerging = [s for s in signals if s.get("status") == "emerging"]
    top = max(signals, key=lambda s: s.get("opportunity_score", 0), default=None)
    cats: Dict[str, int] = {}
    sources: Dict[str, int] = {}
    for s in signals:
        cats[s.get("category", "unknown")] = cats.get(s.get("category", "unknown"), 0) + 1
        sources[s.get("source", "unknown")] = sources.get(s.get("source", "unknown"), 0) + 1
    top_cat = max(cats, key=lambda c: cats[c]) if cats else "environmental"

    return {
        "total_signals": len(signals),
        "active_signals": len(active),
        "emerging_signals": len(emerging),
        "avg_opportunity_score": round(sum(s.get("opportunity_score", 0) for s in signals) / max(len(signals), 1), 1),
        "top_category": top_cat,
        "top_signal_title": top["title"] if top else "—",
        "top_signal_score": top["opportunity_score"] if top else 0,
        "last_refreshed": _signal_stats.get("last_refreshed") or datetime.now(_tz.utc).isoformat(),
        "refresh_in_seconds": 1800,
        "source_breakdown": sources,
        "daily_top_opportunities": [
            {
                "signal_id": s["id"],
                "title": s["title"][:80],
                "score": s["opportunity_score"],
                "category": s["category"],
                "window": s["lifespan_estimate"],
            }
            for s in sorted(signals, key=lambda x: x.get("opportunity_score", 0), reverse=True)[:5]
        ],
    }


# Live narrative CRUD
def store_live_narrative(narrative: dict) -> dict:
    _live_narratives[narrative["narrative_id"]] = narrative
    set_signal_narrative(narrative.get("signal_id", ""), narrative["narrative_id"])
    return narrative


def get_live_narrative(narrative_id: str) -> Optional[dict]:
    return _live_narratives.get(narrative_id)


def list_live_narratives(limit: int = 20) -> List[dict]:
    narrs = list(_live_narratives.values())
    narrs.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    return narrs[:limit]


# Live content CRUD
def store_live_content(content: dict) -> dict:
    _live_content[content["content_id"]] = content
    return content


def get_live_content(content_id: str) -> Optional[dict]:
    return _live_content.get(content_id)


def get_content_by_narrative(narrative_id: str) -> Optional[dict]:
    for c in _live_content.values():
        if c.get("narrative_id") == narrative_id:
            return c
    return None


# ===========================================================================
# Narrative Response Engine — clusters, generated responses, queue
# ===========================================================================

_narrative_topics: Dict[str, dict] = {}      # topic_id -> NarrativeTopic dict
_cluster_timestamp: Optional[str] = None
_topic_responses: Dict[str, dict] = {}       # topic_id -> GeneratedResponse dict
_response_by_id: Dict[str, dict] = {}        # response_id -> GeneratedResponse dict
_response_queue: Dict[str, dict] = {}        # item_id -> ResponseQueueItem dict


# Narrative Topics (clustered signals)

def get_narrative_topics() -> List[dict]:
    return list(_narrative_topics.values())


def set_narrative_topics(topics: List[dict]) -> None:
    global _cluster_timestamp
    _narrative_topics.clear()
    for t in topics:
        _narrative_topics[t["topic_id"]] = t
    _cluster_timestamp = datetime.now(timezone.utc).isoformat()


def get_narrative_topic(topic_id: str) -> Optional[dict]:
    return _narrative_topics.get(topic_id)


def get_cluster_timestamp() -> Optional[str]:
    return _cluster_timestamp


# Generated Responses (cached per topic)

def store_topic_response(topic_id: str, response: dict) -> dict:
    _topic_responses[topic_id] = response
    _response_by_id[response["response_id"]] = response
    return response


def get_topic_response(topic_id: str) -> Optional[dict]:
    return _topic_responses.get(topic_id)


def get_response_by_id(response_id: str) -> Optional[dict]:
    return _response_by_id.get(response_id)


# Response Queue CRUD

def list_response_queue(
    status: Optional[str] = None,
    platform: Optional[str] = None,
) -> List[dict]:
    items = list(_response_queue.values())
    if status:
        items = [i for i in items if i.get("status") == status]
    if platform:
        items = [i for i in items if i.get("platform") == platform]
    items.sort(key=lambda i: i.get("created_at", ""), reverse=True)
    return items


def create_queue_item(data: dict) -> dict:
    item_id = "qi-" + str(uuid.uuid4())[:10]
    item = {
        "item_id": item_id,
        "topic_id": data.get("topic_id", ""),
        "topic_title": data.get("topic_title", ""),
        "platform": data.get("platform", "x"),
        "content_type": data.get("content_type", "thread"),
        "status": "draft",
        "content": data.get("content", {}),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "scheduled_for": data.get("scheduled_for"),
    }
    _response_queue[item_id] = item
    return item


def update_queue_item(item_id: str, data: dict) -> Optional[dict]:
    item = _response_queue.get(item_id)
    if item is None:
        return None
    for key, value in data.items():
        if value is not None:
            item[key] = value
    return item


def delete_queue_item(item_id: str) -> bool:
    if item_id not in _response_queue:
        return False
    _response_queue.pop(item_id)
    return True


# ===========================================================================
# X Post Studio
# ===========================================================================

_x_posts: Dict[str, dict] = {}
_x_analytics_events: List[dict] = []
_linkedin_posts: Dict[str, dict] = {}
_linkedin_analytics_events: List[dict] = []


def create_x_post(data: dict) -> dict:
    post_id = "xp-" + str(uuid.uuid4())[:10]
    now = _now_iso()
    post = {
        "id": post_id,
        "content": data.get("content", ""),
        "post_type": data.get("post_type", "single"),
        "thread_posts": data.get("thread_posts", []),
        "media": data.get("media", []),
        "status": "draft",
        "hook_score": data.get("hook_score", 0),
        "estimated_reach": data.get("estimated_reach", 0),
        "topic_signal": data.get("topic_signal"),
        "scheduled_time": None,
        "published_time": None,
        "created_by": data.get("created_by", "editor"),
        "created_at": now,
        "updated_at": now,
    }
    _x_posts[post_id] = post
    return post


def get_x_post(post_id: str) -> Optional[dict]:
    return _x_posts.get(post_id)


def update_x_post(post_id: str, data: dict) -> Optional[dict]:
    post = _x_posts.get(post_id)
    if post is None:
        return None
    for key, value in data.items():
        if value is not None:
            post[key] = value
    post["updated_at"] = _now_iso()
    return post


def delete_x_post(post_id: str) -> bool:
    if post_id not in _x_posts:
        return False
    _x_posts.pop(post_id)
    return True


def list_x_posts(status: Optional[str] = None, limit: int = 50) -> List[dict]:
    posts = list(_x_posts.values())
    if status:
        posts = [p for p in posts if p.get("status") == status]
    posts.sort(key=lambda p: p.get("updated_at", ""), reverse=True)
    return posts[:limit]


def record_x_analytics_event(post_id: str, post: dict) -> None:
    import random
    hook = post.get("hook_score", 50)
    reach_base = post.get("estimated_reach", 5000)
    event = {
        "post_id": post_id,
        "impressions": reach_base + random.randint(500, 3000),
        "engagements": int(reach_base * 0.04) + random.randint(20, 200),
        "reposts": random.randint(5, 50),
        "replies": random.randint(3, 30),
        "followers_gained": random.randint(0, 15),
        "hook_score": hook,
        "recorded_at": _now_iso(),
    }
    _x_analytics_events.append(event)


def get_x_analytics_summary() -> dict:
    if not _x_analytics_events:
        posts = list(_x_posts.values())
        top = max(posts, key=lambda p: p.get("hook_score", 0)) if posts else None
        return {
            "total_posts": len(posts),
            "total_impressions": 0,
            "total_engagements": 0,
            "total_reposts": 0,
            "total_replies": 0,
            "avg_hook_score": round(sum(p.get("hook_score", 0) for p in posts) / max(len(posts), 1), 1),
            "top_post_id": top["id"] if top else None,
            "top_post_preview": (top.get("content") or "")[:80] if top else None,
            "top_post_impressions": 0,
            "followers_gained": 0,
        }
    total_impressions = sum(e["impressions"] for e in _x_analytics_events)
    total_engagements = sum(e["engagements"] for e in _x_analytics_events)
    top_event = max(_x_analytics_events, key=lambda e: e["impressions"])
    top_post = _x_posts.get(top_event["post_id"])
    return {
        "total_posts": len(_x_posts),
        "total_impressions": total_impressions,
        "total_engagements": total_engagements,
        "total_reposts": sum(e["reposts"] for e in _x_analytics_events),
        "total_replies": sum(e["replies"] for e in _x_analytics_events),
        "avg_hook_score": round(sum(e["hook_score"] for e in _x_analytics_events) / len(_x_analytics_events), 1),
        "top_post_id": top_event["post_id"],
        "top_post_preview": (top_post.get("content") or "")[:80] if top_post else None,
        "top_post_impressions": top_event["impressions"],
        "followers_gained": sum(e["followers_gained"] for e in _x_analytics_events),
    }


# ---------------------------------------------------------------------------
# LinkedIn Post Studio
# ---------------------------------------------------------------------------

def create_linkedin_post(data: dict) -> dict:
    post_id = "li-" + str(uuid.uuid4())[:10]
    now = _now_iso()
    post = {
        "id": post_id,
        "content": data.get("content", ""),
        "post_type": data.get("post_type", "text"),
        "hook_type": data.get("hook_type", "story"),
        "hashtags": data.get("hashtags", []),
        "visibility": data.get("visibility", "public"),
        "status": "draft",
        "thought_leadership_score": data.get("thought_leadership_score", 0),
        "estimated_reach": data.get("estimated_reach", 0),
        "scheduled_time": None,
        "published_time": None,
        "created_by": data.get("created_by", "editor"),
        "created_at": now,
        "updated_at": now,
    }
    _linkedin_posts[post_id] = post
    return post


def get_linkedin_post(post_id: str) -> Optional[dict]:
    return _linkedin_posts.get(post_id)


def update_linkedin_post(post_id: str, data: dict) -> Optional[dict]:
    post = _linkedin_posts.get(post_id)
    if post is None:
        return None
    for key, value in data.items():
        if value is not None:
            post[key] = value
    post["updated_at"] = _now_iso()
    return post


def delete_linkedin_post(post_id: str) -> bool:
    if post_id not in _linkedin_posts:
        return False
    _linkedin_posts.pop(post_id)
    return True


def list_linkedin_posts(status: Optional[str] = None, limit: int = 50) -> List[dict]:
    posts = list(_linkedin_posts.values())
    if status:
        posts = [p for p in posts if p.get("status") == status]
    posts.sort(key=lambda p: p.get("updated_at", ""), reverse=True)
    return posts[:limit]


def record_linkedin_analytics_event(post_id: str, post: dict) -> None:
    import random
    score = post.get("thought_leadership_score", 50)
    reach_base = post.get("estimated_reach", 3000)
    event = {
        "post_id": post_id,
        "impressions": reach_base + random.randint(200, 2000),
        "reactions": int(reach_base * 0.03) + random.randint(10, 150),
        "comments": random.randint(3, 40),
        "shares": random.randint(2, 25),
        "profile_views": random.randint(20, 120),
        "followers_gained": random.randint(0, 10),
        "thought_leadership_score": score,
        "recorded_at": _now_iso(),
    }
    _linkedin_analytics_events.append(event)


def get_linkedin_analytics_summary() -> dict:
    posts = list(_linkedin_posts.values())
    if not _linkedin_analytics_events:
        top = max(posts, key=lambda p: p.get("thought_leadership_score", 0)) if posts else None
        return {
            "total_posts": len(posts),
            "total_impressions": 0,
            "total_reactions": 0,
            "total_comments": 0,
            "total_shares": 0,
            "avg_thought_leadership_score": round(
                sum(p.get("thought_leadership_score", 0) for p in posts) / max(len(posts), 1), 1
            ),
            "top_post_id": top["id"] if top else None,
            "top_post_preview": (top.get("content") or "")[:80] if top else None,
            "top_post_impressions": 0,
            "followers_gained": 0,
            "profile_views": 0,
        }
    top_event = max(_linkedin_analytics_events, key=lambda e: e["impressions"])
    top_post = _linkedin_posts.get(top_event["post_id"])
    scores = [e["thought_leadership_score"] for e in _linkedin_analytics_events]
    return {
        "total_posts": len(posts),
        "total_impressions": sum(e["impressions"] for e in _linkedin_analytics_events),
        "total_reactions": sum(e["reactions"] for e in _linkedin_analytics_events),
        "total_comments": sum(e["comments"] for e in _linkedin_analytics_events),
        "total_shares": sum(e["shares"] for e in _linkedin_analytics_events),
        "avg_thought_leadership_score": round(sum(scores) / len(scores), 1),
        "top_post_id": top_event["post_id"],
        "top_post_preview": (top_post.get("content") or "")[:80] if top_post else None,
        "top_post_impressions": top_event["impressions"],
        "followers_gained": sum(e["followers_gained"] for e in _linkedin_analytics_events),
        "profile_views": sum(e["profile_views"] for e in _linkedin_analytics_events),
    }


# ---------------------------------------------------------------------------
# Pinterest Pin Studio
# ---------------------------------------------------------------------------

_pinterest_pins: Dict[str, dict] = {}
_pinterest_analytics_events: List[dict] = []


def create_pinterest_pin(data: dict) -> dict:
    pin_id = "pin-" + str(uuid.uuid4())[:10]
    now = _now_iso()
    pin = {
        "id": pin_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "destination_url": data.get("destination_url", ""),
        "board_name": data.get("board_name", ""),
        "pin_type": data.get("pin_type", "standard"),
        "cover_image_url": data.get("cover_image_url", ""),
        "tags": data.get("tags", []),
        "status": "draft",
        "pin_score": data.get("pin_score", 0),
        "estimated_monthly_views": data.get("estimated_monthly_views", 0),
        "scheduled_time": None,
        "published_time": None,
        "created_by": data.get("created_by", "editor"),
        "created_at": now,
        "updated_at": now,
    }
    _pinterest_pins[pin_id] = pin
    return pin


def get_pinterest_pin(pin_id: str) -> Optional[dict]:
    return _pinterest_pins.get(pin_id)


def update_pinterest_pin(pin_id: str, data: dict) -> Optional[dict]:
    pin = _pinterest_pins.get(pin_id)
    if pin is None:
        return None
    for key, value in data.items():
        if value is not None:
            pin[key] = value
    pin["updated_at"] = _now_iso()
    return pin


def delete_pinterest_pin(pin_id: str) -> bool:
    if pin_id not in _pinterest_pins:
        return False
    _pinterest_pins.pop(pin_id)
    return True


def list_pinterest_pins(status: Optional[str] = None, limit: int = 50) -> List[dict]:
    pins = list(_pinterest_pins.values())
    if status:
        pins = [p for p in pins if p.get("status") == status]
    return sorted(pins, key=lambda p: p["created_at"], reverse=True)[:limit]


def record_pinterest_analytics_event(pin_id: str, pin: dict) -> None:
    import random
    score = pin.get("pin_score", 50)
    views = pin.get("estimated_monthly_views", 1000)
    event = {
        "pin_id": pin_id,
        "impressions": int(views * (0.8 + random.random() * 0.4)),
        "saves": int(views * 0.04 * (0.5 + score / 100)),
        "clicks": int(views * 0.02 * (0.5 + score / 100)),
        "closeups": int(views * 0.06 * (0.5 + score / 100)),
        "pin_score": score,
        "monthly_views": views,
        "profile_visits": int(views * 0.01),
        "recorded_at": _now_iso(),
    }
    _pinterest_analytics_events.append(event)


def get_pinterest_analytics_summary() -> dict:
    pins = list(_pinterest_pins.values())
    if not _pinterest_analytics_events:
        return {
            "total_pins": len(pins),
            "total_impressions": 0,
            "total_saves": 0,
            "total_clicks": 0,
            "total_closeups": 0,
            "avg_pin_score": 0.0,
            "top_pin_id": None,
            "top_pin_title": None,
            "top_pin_impressions": 0,
            "monthly_views": 0,
            "profile_visits": 0,
        }
    top_event = max(_pinterest_analytics_events, key=lambda e: e["impressions"])
    top_pin   = _pinterest_pins.get(top_event["pin_id"])
    scores    = [e["pin_score"] for e in _pinterest_analytics_events]
    return {
        "total_pins": len(pins),
        "total_impressions": sum(e["impressions"] for e in _pinterest_analytics_events),
        "total_saves":       sum(e["saves"]       for e in _pinterest_analytics_events),
        "total_clicks":      sum(e["clicks"]      for e in _pinterest_analytics_events),
        "total_closeups":    sum(e["closeups"]    for e in _pinterest_analytics_events),
        "avg_pin_score":     round(sum(scores) / len(scores), 1),
        "top_pin_id":        top_event["pin_id"],
        "top_pin_title":     (top_pin.get("title") or "")[:80] if top_pin else None,
        "top_pin_impressions": top_event["impressions"],
        "monthly_views":     sum(e["monthly_views"]  for e in _pinterest_analytics_events),
        "profile_visits":    sum(e["profile_visits"] for e in _pinterest_analytics_events),
    }
