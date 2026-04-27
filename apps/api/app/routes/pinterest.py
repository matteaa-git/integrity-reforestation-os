"""
Pinterest Pin Studio Routes
Handles drafting, approval, scheduling, publishing, and analytics
for Pinterest pins.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services import pinterest_api
from app.schemas.pinterest import (
    PinterestPin,
    PinterestPinCreate,
    PinterestPinUpdate,
    PinterestPinListResponse,
    PinterestScheduleRequest,
    PinterestAnalytics,
)
import app.store as store

router = APIRouter(prefix="/pinterest", tags=["pinterest-studio"])


# ---------------------------------------------------------------------------
# Draft CRUD
# ---------------------------------------------------------------------------

@router.post("/draft", response_model=PinterestPin)
async def create_draft(data: PinterestPinCreate):
    pin = store.create_pinterest_pin(data.model_dump())
    return pin


@router.get("/drafts", response_model=PinterestPinListResponse)
async def list_drafts(
    status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    pins = store.list_pinterest_pins(status=status, limit=limit)
    return {
        "pins": pins,
        "total": len(pins),
        "draft_count":     sum(1 for p in pins if p.get("status") == "draft"),
        "pending_count":   sum(1 for p in pins if p.get("status") == "pending_approval"),
        "scheduled_count": sum(1 for p in pins if p.get("status") == "scheduled"),
        "published_count": sum(1 for p in pins if p.get("status") == "published"),
    }


@router.get("/analytics/summary", response_model=PinterestAnalytics)
async def get_analytics():
    return store.get_pinterest_analytics_summary()


@router.get("/{pin_id}", response_model=PinterestPin)
async def get_pin(pin_id: str):
    pin = store.get_pinterest_pin(pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    return pin


@router.patch("/{pin_id}", response_model=PinterestPin)
async def update_pin(pin_id: str, data: PinterestPinUpdate):
    pin = store.update_pinterest_pin(pin_id, data.model_dump(exclude_none=True))
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    return pin


@router.delete("/{pin_id}")
async def delete_pin(pin_id: str):
    ok = store.delete_pinterest_pin(pin_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Pin not found")
    return {"status": "deleted", "pin_id": pin_id}


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------

@router.post("/{pin_id}/submit-approval", response_model=PinterestPin)
async def submit_for_approval(pin_id: str):
    pin = store.get_pinterest_pin(pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    pin = store.update_pinterest_pin(pin_id, {"status": "pending_approval"})
    preview = pin.get("title", "") or pin.get("description", "")[:120]
    store.create_queue_item({
        "topic_id": pin_id,
        "topic_title": preview,
        "platform": "pinterest",
        "content_type": pin.get("pin_type", "standard"),
        "content": {
            "pin_id": pin_id,
            "title": preview,
            "pin_score": pin.get("pin_score", 0),
            "estimated_monthly_views": pin.get("estimated_monthly_views", 0),
        },
    })
    return pin


@router.post("/{pin_id}/schedule", response_model=PinterestPin)
async def schedule_pin(pin_id: str, data: PinterestScheduleRequest):
    pin = store.get_pinterest_pin(pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    pin = store.update_pinterest_pin(pin_id, {
        "status": "scheduled",
        "scheduled_time": data.scheduled_time,
    })
    return pin


@router.post("/{pin_id}/publish", response_model=PinterestPin)
async def publish_pin(pin_id: str):
    pin = store.get_pinterest_pin(pin_id)
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    live_pin_id: Optional[str] = None

    # Attempt live posting when Pinterest account is connected
    if store.is_pinterest_connected():
        account = store.get_pinterest_account_state()
        access_token = account["access_token"]

        # Resolve board_id from board name if needed
        board_id = ""
        board_name = pin.get("board_name", "")
        boards = store.get_pinterest_cached_boards()
        matched = next((b for b in boards if b["name"] == board_name), None)
        if matched:
            board_id = matched["board_id"]

        if not board_id:
            raise HTTPException(
                400,
                f"Board '{board_name}' not found. Sync your account first or select a valid board."
            )

        try:
            result = pinterest_api.create_pin(
                access_token  = access_token,
                board_id      = board_id,
                title         = pin.get("title", ""),
                description   = pin.get("description", ""),
                link          = pin.get("destination_url", ""),
                media_source_url = pin.get("cover_image_url", ""),
            )
            live_pin_id = result.get("id")
        except Exception as exc:
            raise HTTPException(502, f"Pinterest API error: {exc}")

    now    = datetime.now(timezone.utc).isoformat()
    update: dict = {"status": "published", "published_time": now}
    if live_pin_id:
        update["live_pin_id"] = live_pin_id

    pin = store.update_pinterest_pin(pin_id, update)
    store.record_pinterest_analytics_event(pin_id, pin)
    return pin
