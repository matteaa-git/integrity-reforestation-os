"""
Hook Bank API Routes
====================
GET  /hooks                — list/filter hooks
POST /hooks                — create hook
GET  /hooks/suggest        — top hooks for a topic (carousel suggestions)
POST /hooks/generate       — AI-generate hook variations
GET  /hooks/{id}           — single hook
PATCH /hooks/{id}          — edit hook
DELETE /hooks/{id}         — delete hook
POST /hooks/{id}/use       — track usage
POST /hooks/{id}/favorite  — toggle favorite
POST /hooks/{id}/save      — record save event
POST /hooks/{id}/share     — record share event
"""

from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app import store
from app.services.ai.hook_generator import generate_hooks, VALID_CATEGORIES

router = APIRouter(prefix="/hooks", tags=["hooks"])


# ── Schemas ────────────────────────────────────────────────────────────────

class HookCreate(BaseModel):
    hook_text: str
    hook_category: str = Field(
        "curiosity",
        description="curiosity | shock | authority | story | contrarian | transformation",
    )
    topic_tags: List[str] = Field(default_factory=list)
    emotion_tags: List[str] = Field(default_factory=list)
    format: str = Field("universal", description="carousel | reel | story | universal")
    performance_score: float = Field(50.0, ge=0.0, le=100.0)
    is_favorite: bool = False


class HookUpdate(BaseModel):
    hook_text: Optional[str] = None
    hook_category: Optional[str] = None
    topic_tags: Optional[List[str]] = None
    emotion_tags: Optional[List[str]] = None
    format: Optional[str] = None
    performance_score: Optional[float] = None
    is_favorite: Optional[bool] = None


class HookGenerateRequest(BaseModel):
    topic: str = Field(..., description="Topic for the hooks")
    emotion: str = Field("inspiring", description="Target emotion / tone")
    content_type: str = Field("carousel", description="carousel | reel | story")
    hook_category: Optional[str] = Field(None, description="Lock to a specific category (optional)")
    count: int = Field(5, ge=1, le=10)
    save_to_bank: bool = Field(False, description="Persist generated hooks to the bank")


class HookPerformanceUpdate(BaseModel):
    performance_score: float = Field(..., ge=0.0, le=100.0)


# ── Routes ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_hooks(
    category: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    emotion: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0.0, le=100.0),
    search: Optional[str] = Query(None),
    favorites_only: bool = Query(False),
    sort_by: str = Query("performance_score", description="performance_score | times_used | saves | created_at"),
    limit: int = Query(50, ge=1, le=200),
):
    """List hooks with optional filters."""
    hooks = store.list_hooks(
        category=category,
        topic=topic,
        emotion=emotion,
        fmt=format,
        min_score=min_score,
        search=search,
        favorites_only=favorites_only,
        sort_by=sort_by,
    )
    return {"hooks": hooks[:limit], "total": len(hooks)}


@router.post("", status_code=201)
async def create_hook(body: HookCreate):
    """Create a new hook and add it to the bank."""
    hook = store.create_hook(body.model_dump())
    return hook


@router.get("/suggest")
async def suggest_hooks(
    topic: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20),
):
    """
    Return top-performing hooks relevant to a topic.
    Used by the carousel builder to surface contextual suggestions.
    """
    hooks = store.list_hooks(
        topic=topic,
        fmt=format,
        sort_by="performance_score",
    )[:limit]
    return {"hooks": hooks, "total": len(hooks)}


@router.get("/categories")
async def list_categories():
    """Return the valid hook categories."""
    return {"categories": VALID_CATEGORIES}


@router.post("/generate")
async def generate_hook_variations(body: HookGenerateRequest):
    """
    Generate AI-powered hook variations for a given topic and emotion.
    Optionally save them directly to the hook bank.
    """
    generated = generate_hooks(
        topic=body.topic,
        emotion=body.emotion,
        content_type=body.content_type,
        hook_category=body.hook_category,
        count=body.count,
    )

    saved = []
    if body.save_to_bank:
        for h in generated:
            saved.append(store.create_hook(h))
        return {"hooks": saved, "count": len(saved), "saved": True}

    return {"hooks": generated, "count": len(generated), "saved": False}


@router.get("/{hook_id}")
async def get_hook(hook_id: str):
    hook = store.get_hook(hook_id)
    if not hook:
        raise HTTPException(404, "Hook not found")
    return hook


@router.patch("/{hook_id}")
async def update_hook(hook_id: str, body: HookUpdate):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    hook = store.update_hook(hook_id, updates)
    if not hook:
        raise HTTPException(404, "Hook not found")
    return hook


@router.delete("/{hook_id}", status_code=204)
async def delete_hook(hook_id: str):
    if not store.delete_hook(hook_id):
        raise HTTPException(404, "Hook not found")


@router.post("/{hook_id}/use")
async def use_hook(hook_id: str):
    """Track that this hook was inserted into a carousel or reel."""
    hook = store.increment_hook_usage(hook_id)
    if not hook:
        raise HTTPException(404, "Hook not found")
    return {"times_used": hook["times_used"]}


@router.post("/{hook_id}/favorite")
async def toggle_favorite(hook_id: str):
    hook = store.toggle_hook_favorite(hook_id)
    if not hook:
        raise HTTPException(404, "Hook not found")
    return {"is_favorite": hook["is_favorite"]}


@router.post("/{hook_id}/save")
async def save_hook(hook_id: str):
    """Record that a user saved / bookmarked this hook."""
    hook = store.record_hook_save(hook_id)
    if not hook:
        raise HTTPException(404, "Hook not found")
    return {"saves": hook["saves"]}


@router.post("/{hook_id}/share")
async def share_hook(hook_id: str):
    """Record that a user shared this hook."""
    hook = store.record_hook_share(hook_id)
    if not hook:
        raise HTTPException(404, "Hook not found")
    return {"shares": hook["shares"]}


@router.patch("/{hook_id}/performance")
async def update_hook_performance(hook_id: str, body: HookPerformanceUpdate):
    """Update the performance score after real engagement data arrives."""
    hook = store.update_hook(hook_id, {"performance_score": body.performance_score})
    if not hook:
        raise HTTPException(404, "Hook not found")
    return hook
