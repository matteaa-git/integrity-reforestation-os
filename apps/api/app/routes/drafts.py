"""Draft API routes."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.schemas.draft import (
    AddDraftAssetRequest,
    DraftCreate,
    DraftDetailResponse,
    DraftListResponse,
    DraftResponse,
    DraftUpdate,
)
from app import store

router = APIRouter(prefix="/drafts", tags=["drafts"])


@router.post("", response_model=DraftDetailResponse, status_code=201)
async def create_draft(body: DraftCreate):
    draft = store.create_draft(body.model_dump())
    return {**draft, "assets": []}


@router.get("", response_model=DraftListResponse)
async def list_drafts(
    format: Optional[str] = Query(None, description="Filter by format: story, reel, carousel"),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    drafts = store.list_drafts(fmt=format, status=status)
    return DraftListResponse(drafts=drafts, total=len(drafts))


@router.get("/{draft_id}", response_model=DraftDetailResponse)
async def get_draft(draft_id: str):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    assets = store.get_draft_assets(draft_id)
    return {**draft, "assets": assets}


@router.patch("/{draft_id}", response_model=DraftDetailResponse)
async def update_draft(draft_id: str, body: DraftUpdate):
    updates = body.model_dump(exclude_unset=True)
    draft = store.update_draft(draft_id, updates)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    assets = store.get_draft_assets(draft_id)
    return {**draft, "assets": assets}


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
