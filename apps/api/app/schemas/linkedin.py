"""Pydantic schemas for the LinkedIn Post Studio."""

from typing import List, Optional
from pydantic import BaseModel


class LinkedInPostCreate(BaseModel):
    content: str = ""
    post_type: str = "text"          # text | article | poll | document | image | video
    hook_type: str = "story"         # story | statistic | controversial | question | achievement | observation | list | failure
    hashtags: List[str] = []
    visibility: str = "public"       # public | connections
    thought_leadership_score: int = 0
    estimated_reach: int = 0
    created_by: str = "editor"


class LinkedInPostUpdate(BaseModel):
    content: Optional[str] = None
    post_type: Optional[str] = None
    hook_type: Optional[str] = None
    hashtags: Optional[List[str]] = None
    visibility: Optional[str] = None
    thought_leadership_score: Optional[int] = None
    estimated_reach: Optional[int] = None
    status: Optional[str] = None
    scheduled_time: Optional[str] = None


class LinkedInPost(BaseModel):
    id: str
    content: str
    post_type: str
    hook_type: str
    hashtags: List[str]
    visibility: str
    status: str          # draft | pending_approval | approved | scheduled | published
    thought_leadership_score: int
    estimated_reach: int
    scheduled_time: Optional[str]
    published_time: Optional[str]
    created_by: str
    created_at: str
    updated_at: str


class LinkedInPostListResponse(BaseModel):
    posts: List[LinkedInPost]
    total: int
    draft_count: int
    pending_count: int
    scheduled_count: int
    published_count: int


class LinkedInScheduleRequest(BaseModel):
    scheduled_time: str


class LinkedInAnalytics(BaseModel):
    total_posts: int
    total_impressions: int
    total_reactions: int
    total_comments: int
    total_shares: int
    avg_thought_leadership_score: float
    top_post_id: Optional[str]
    top_post_preview: Optional[str]
    top_post_impressions: int
    followers_gained: int
    profile_views: int
