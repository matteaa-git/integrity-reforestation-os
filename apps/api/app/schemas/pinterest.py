"""Pydantic schemas for the Pinterest Pin Studio."""

from typing import List, Optional
from pydantic import BaseModel


class PinterestPinCreate(BaseModel):
    title: str = ""
    description: str = ""
    destination_url: str = ""
    board_name: str = ""
    pin_type: str = "standard"       # standard | idea | video | product
    cover_image_url: str = ""
    tags: List[str] = []
    pin_score: int = 0
    estimated_monthly_views: int = 0
    created_by: str = "editor"


class PinterestPinUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    destination_url: Optional[str] = None
    board_name: Optional[str] = None
    pin_type: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    pin_score: Optional[int] = None
    estimated_monthly_views: Optional[int] = None
    status: Optional[str] = None
    scheduled_time: Optional[str] = None


class PinterestPin(BaseModel):
    id: str
    title: str
    description: str
    destination_url: str
    board_name: str
    pin_type: str
    cover_image_url: str
    tags: List[str]
    status: str          # draft | pending_approval | approved | scheduled | published
    pin_score: int
    estimated_monthly_views: int
    scheduled_time: Optional[str]
    published_time: Optional[str]
    created_by: str
    created_at: str
    updated_at: str


class PinterestPinListResponse(BaseModel):
    pins: List[PinterestPin]
    total: int
    draft_count: int
    pending_count: int
    scheduled_count: int
    published_count: int


class PinterestScheduleRequest(BaseModel):
    scheduled_time: str


class PinterestAnalytics(BaseModel):
    total_pins: int
    total_impressions: int
    total_saves: int
    total_clicks: int
    total_closeups: int
    avg_pin_score: float
    top_pin_id: Optional[str]
    top_pin_title: Optional[str]
    top_pin_impressions: int
    monthly_views: int
    profile_visits: int
