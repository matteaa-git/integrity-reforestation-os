"""Pydantic schemas for the Narrative Response Engine."""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel


class NarrativeTopic(BaseModel):
    topic_id: str
    title: str
    summary: str
    signal_count: int
    sources: List[str]
    keywords: List[str]
    opportunity_score: int
    conversation_velocity: float
    controversy_score: int
    engagement_potential: int
    relevance_score: int
    search_volume_estimate: int
    trend_direction: str  # rising | peak | stable | declining
    status: str           # respond_now | good_opportunity | monitor | low_priority
    category: str
    lifespan_estimate: str
    signal_ids: List[str]
    top_signal_title: str
    top_signal_url: Optional[str] = None
    created_at: str


class NarrativeTopicListResponse(BaseModel):
    topics: List[NarrativeTopic]
    total: int
    respond_now_count: int
    good_opportunity_count: int
    last_clustered: str


class XTweetItem(BaseModel):
    position: int
    text: str
    char_count: int
    engagement_hook: Optional[str] = None
    media_suggestion: Optional[str] = None


class LinkedInPost(BaseModel):
    title: str
    body: str
    word_count: int
    suggested_image: Optional[str] = None
    suggested_cta: Optional[str] = None


class SubstackSection(BaseModel):
    section: str
    description: str


class SubstackOutline(BaseModel):
    title: str
    subtitle: str
    intro: str
    sections: List[SubstackSection]
    suggested_length: str
    suggested_cta: str
    tags: List[str]


class GeneratedResponse(BaseModel):
    response_id: str
    topic_id: str
    topic_title: str
    x_thread: List[XTweetItem]
    linkedin_post: LinkedInPost
    substack_outline: SubstackOutline
    generated_at: str
    ai_enhanced: bool = False


class ResponseQueueItem(BaseModel):
    item_id: str
    topic_id: str
    topic_title: str
    platform: str       # x | linkedin | substack
    content_type: str   # thread | post | article_outline
    status: str         # draft | review | approved | scheduled
    content: Dict[str, Any]
    created_at: str
    scheduled_for: Optional[str] = None


class ResponseQueueListResponse(BaseModel):
    items: List[ResponseQueueItem]
    total: int
    draft_count: int
    review_count: int
    approved_count: int
    scheduled_count: int


class AddToQueueRequest(BaseModel):
    topic_id: str
    topic_title: str
    platform: str
    content_type: str
    content: Dict[str, Any]


class UpdateQueueItemRequest(BaseModel):
    status: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    scheduled_for: Optional[str] = None
