"""Reel Template API routes — CRUD for reusable reel templates."""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from app import store

router = APIRouter(prefix="/templates", tags=["templates"])


class TemplateClipSlot(BaseModel):
    position: int
    label: str = ""
    locked_asset_id: Optional[str] = None
    duration: Optional[float] = None


class TemplateCaptionSlot(BaseModel):
    text: str = ""
    start_time: float = 0
    end_time: float = 3
    style: str = "default"


class TemplateCreate(BaseModel):
    name: str
    category: str = "custom"
    tags: List[str] = []
    hook_text: str = ""
    cta_text: str = ""
    clip_slots: List[TemplateClipSlot] = []
    captions: List[TemplateCaptionSlot] = []
    music_asset_id: Optional[str] = None
    thumbnail_asset_id: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    hook_text: Optional[str] = None
    cta_text: Optional[str] = None
    clip_slots: Optional[List[TemplateClipSlot]] = None
    captions: Optional[List[TemplateCaptionSlot]] = None
    music_asset_id: Optional[str] = None
    thumbnail_asset_id: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    category: str
    tags: List[str]
    hook_text: str
    cta_text: str
    clip_slots: List[TemplateClipSlot]
    captions: List[TemplateCaptionSlot]
    music_asset_id: Optional[str]
    thumbnail_asset_id: Optional[str]
    usage_count: int
    created_at: str
    updated_at: str


class TemplateListResponse(BaseModel):
    templates: List[TemplateResponse]
    total: int


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(body: TemplateCreate):
    template = store.create_template(body.model_dump())
    return template


@router.get("", response_model=TemplateListResponse)
async def list_templates(category: Optional[str] = None):
    templates = store.list_templates(category=category)
    return TemplateListResponse(templates=templates, total=len(templates))


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str):
    template = store.get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, body: TemplateUpdate):
    updates = body.model_dump(exclude_unset=True)
    template = store.update_template(template_id, updates)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: str):
    deleted = store.delete_template(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/{template_id}/use", response_model=TemplateResponse)
async def use_template(template_id: str):
    """Increment usage count when a template is applied."""
    template = store.increment_template_usage(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template
