"""Pydantic schemas for the X Post Studio."""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel


class XMediaItem(BaseModel):
    asset_id: Optional[str] = None
    url: Optional[str] = None
    media_type: str = "image"  # image | video
    alt_text: Optional[str] = None


class XThreadPost(BaseModel):
    position: int
    text: str
    char_count: int
    media: List[XMediaItem] = []


class XPostCreate(BaseModel):
    content: str = ""
    post_type: str = "single"   # single | thread | quote_reply | story_post
    thread_posts: List[XThreadPost] = []
    media: List[XMediaItem] = []
    topic_signal: Optional[str] = None
    hook_score: int = 0
    estimated_reach: int = 0
    created_by: str = "editor"


class XPostUpdate(BaseModel):
    content: Optional[str] = None
    post_type: Optional[str] = None
    thread_posts: Optional[List[XThreadPost]] = None
    media: Optional[List[XMediaItem]] = None
    topic_signal: Optional[str] = None
    hook_score: Optional[int] = None
    estimated_reach: Optional[int] = None
    status: Optional[str] = None
    scheduled_time: Optional[str] = None


class XPost(BaseModel):
    id: str
    content: str
    post_type: str
    thread_posts: List[XThreadPost]
    media: List[XMediaItem]
    status: str          # draft | pending_approval | approved | scheduled | published
    hook_score: int
    estimated_reach: int
    topic_signal: Optional[str]
    scheduled_time: Optional[str]
    published_time: Optional[str]
    created_by: str
    created_at: str
    updated_at: str


class XPostListResponse(BaseModel):
    posts: List[XPost]
    total: int
    draft_count: int
    pending_count: int
    scheduled_count: int
    published_count: int


class XApprovalSubmission(BaseModel):
    platform: str = "X"
    content_type: str
    status: str = "pending"
    hook_score: int
    estimated_reach: int
    author: str
    preview_text: str
    post_id: str


class XScheduleRequest(BaseModel):
    scheduled_time: str


class XAnalytics(BaseModel):
    total_posts: int
    total_impressions: int
    total_engagements: int
    total_reposts: int
    total_replies: int
    avg_hook_score: float
    top_post_id: Optional[str]
    top_post_preview: Optional[str]
    top_post_impressions: int
    followers_gained: int


class XMultiplyResult(BaseModel):
    source_post_id: str
    linkedin_post: Dict[str, Any]
    instagram_carousel: Dict[str, Any]
    substack_outline: Dict[str, Any]
    youtube_script: Dict[str, Any]
    instagram_caption: Dict[str, Any]
    generated_at: str
