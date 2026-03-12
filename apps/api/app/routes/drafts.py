"""Draft API routes — CRUD + workflow transitions."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.schemas.draft import (
    AddDraftAssetRequest,
    DraftCreate,
    DraftDetailResponse,
    DraftListResponse,
    DraftResponse,
    DraftUpdate,
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
    if store.draft_asset_count(draft_id) == 0:
        raise HTTPException(status_code=409, detail="Cannot submit: draft has no assets")
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


@router.post("/{draft_id}/schedule", response_model=DraftDetailResponse)
async def schedule_draft(draft_id: str, body: ScheduleDraftRequest):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft["status"] != "approved":
        raise HTTPException(status_code=409, detail=f"Cannot schedule: status is '{draft['status']}', must be 'approved'")
    store.update_draft(draft_id, {
        "status": "scheduled",
        "scheduled_for": body.scheduled_for,
        "schedule_notes": body.notes,
    })
    return _draft_detail(draft_id)
