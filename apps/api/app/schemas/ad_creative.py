"""Pydantic schemas for the Ad Creative API."""

from typing import List, Literal, Optional

from pydantic import BaseModel

AdCreativeStatus = Literal["draft", "ready", "archived"]


class AdCreativeCreate(BaseModel):
    title: str
    asset_id: Optional[str] = None
    campaign_id: Optional[str] = None
    hook_text: Optional[str] = ""
    cta_text: Optional[str] = ""
    thumbnail_label: Optional[str] = ""


class AdCreativeUpdate(BaseModel):
    title: Optional[str] = None
    campaign_id: Optional[str] = None
    hook_text: Optional[str] = None
    cta_text: Optional[str] = None
    thumbnail_label: Optional[str] = None
    status: Optional[AdCreativeStatus] = None


class AdCreativeResponse(BaseModel):
    id: str
    title: str
    asset_id: Optional[str] = None
    draft_id: Optional[str] = None
    campaign_id: Optional[str] = None
    hook_text: str
    cta_text: str
    thumbnail_label: str
    status: str
    created_at: str
    updated_at: str


class AdCreativeListResponse(BaseModel):
    ad_creatives: List[AdCreativeResponse]
    total: int


class FromDraftRequest(BaseModel):
    campaign_id: Optional[str] = None
    hook_text: Optional[str] = ""
    cta_text: Optional[str] = ""
    thumbnail_label: Optional[str] = ""


class FromAssetRequest(BaseModel):
    title: Optional[str] = None
    campaign_id: Optional[str] = None
    hook_text: Optional[str] = ""
    cta_text: Optional[str] = ""
    thumbnail_label: Optional[str] = ""
