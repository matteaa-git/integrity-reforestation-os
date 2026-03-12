"""Pydantic schemas for the Draft API."""

from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.asset import AssetResponse

ContentFormat = Literal["story", "reel", "carousel"]
DraftStatus = Literal[
    "draft", "in_review", "approved", "rejected", "scheduled",
]


class DraftCreate(BaseModel):
    title: str
    format: ContentFormat
    status: Optional[DraftStatus] = "draft"
    source_asset_id: Optional[str] = None
    campaign_id: Optional[str] = None


class DraftUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[DraftStatus] = None
    source_asset_id: Optional[str] = None
    campaign_id: Optional[str] = None


class DraftResponse(BaseModel):
    id: str
    title: str
    format: ContentFormat
    status: str
    source_asset_id: Optional[str] = None
    campaign_id: Optional[str] = None
    scheduled_for: Optional[str] = None
    schedule_notes: Optional[str] = None
    created_at: str
    updated_at: str


class DraftDetailResponse(DraftResponse):
    assets: List["DraftAssetEntry"] = []


class DraftAssetEntry(BaseModel):
    id: str
    draft_id: str
    asset_id: str
    position: int
    asset: AssetResponse


class DraftListResponse(BaseModel):
    drafts: List[DraftResponse]
    total: int


class AddDraftAssetRequest(BaseModel):
    asset_id: str
    position: Optional[int] = None


class ScheduleDraftRequest(BaseModel):
    scheduled_for: str  # ISO-8601 datetime
    notes: Optional[str] = None
