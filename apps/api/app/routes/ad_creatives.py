"""Ad Creative API routes — CRUD + variant creation from drafts/assets."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.schemas.ad_creative import (
    AdCreativeCreate,
    AdCreativeListResponse,
    AdCreativeResponse,
    AdCreativeUpdate,
    FromAssetRequest,
    FromDraftRequest,
)
from app import store

router = APIRouter(prefix="/ad-creatives", tags=["ad-creatives"])


@router.post("", response_model=AdCreativeResponse, status_code=201)
async def create_ad_creative(body: AdCreativeCreate):
    creative = store.create_ad_creative(body.model_dump())
    return creative


@router.get("", response_model=AdCreativeListResponse)
async def list_ad_creatives(
    campaign_id: Optional[str] = Query(None, description="Filter by campaign"),
    status: Optional[str] = Query(None, description="Filter by status"),
):
    creatives = store.list_ad_creatives(campaign_id=campaign_id, status=status)
    return AdCreativeListResponse(ad_creatives=creatives, total=len(creatives))


@router.get("/{creative_id}", response_model=AdCreativeResponse)
async def get_ad_creative(creative_id: str):
    creative = store.get_ad_creative(creative_id)
    if creative is None:
        raise HTTPException(status_code=404, detail="Ad creative not found")
    return creative


@router.patch("/{creative_id}", response_model=AdCreativeResponse)
async def update_ad_creative(creative_id: str, body: AdCreativeUpdate):
    updates = body.model_dump(exclude_unset=True)
    creative = store.update_ad_creative(creative_id, updates)
    if creative is None:
        raise HTTPException(status_code=404, detail="Ad creative not found")
    return creative


@router.post("/from-draft/{draft_id}", response_model=AdCreativeResponse, status_code=201)
async def create_from_draft(draft_id: str, body: FromDraftRequest):
    draft = store.get_draft(draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    creative = store.create_ad_creative({
        "title": f"Ad: {draft['title']}",
        "draft_id": draft_id,
        "asset_id": draft.get("source_asset_id"),
        "campaign_id": body.campaign_id or draft.get("campaign_id"),
        "hook_text": body.hook_text,
        "cta_text": body.cta_text,
        "thumbnail_label": body.thumbnail_label,
    })
    return creative


@router.post("/from-asset/{asset_id}", response_model=AdCreativeResponse, status_code=201)
async def create_from_asset(asset_id: str, body: FromAssetRequest):
    asset = store.get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    creative = store.create_ad_creative({
        "title": body.title or f"Ad: {asset['filename']}",
        "asset_id": asset_id,
        "campaign_id": body.campaign_id,
        "hook_text": body.hook_text,
        "cta_text": body.cta_text,
        "thumbnail_label": body.thumbnail_label,
    })
    return creative
