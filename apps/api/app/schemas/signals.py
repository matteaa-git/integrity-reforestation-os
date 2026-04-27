"""Pydantic schemas for the live Signal Intelligence layer."""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel


class LiveSignal(BaseModel):
    id: str
    title: str
    source: str
    source_type: str
    url: Optional[str] = None
    timestamp: str
    raw_text: str
    summary: str
    category: str
    urgency_score: int
    relevance_score: int
    emotion_score: int
    trend_velocity: float
    lifespan_estimate: str
    opportunity_score: int
    status: str
    tags: List[str]
    is_saved: bool
    narrative_id: Optional[str] = None


class SignalFeedResponse(BaseModel):
    signals: List[LiveSignal]
    total: int
    active_count: int
    emerging_count: int
    last_refreshed: str


class SignalStatsResponse(BaseModel):
    total_signals: int
    active_signals: int
    emerging_signals: int
    avg_opportunity_score: float
    top_category: str
    top_signal_title: str
    top_signal_score: int
    last_refreshed: str
    refresh_in_seconds: int
    source_breakdown: Dict[str, int]
    daily_top_opportunities: List[dict]


class GeneratedNarrative(BaseModel):
    narrative_id: str
    signal_id: str
    signal_title: str
    recommended_angle: str
    stance: str
    core_message: str
    emotional_frame: str
    audience: str
    call_to_action: str
    content_formats: List[str]
    urgency_window: str
    opportunity_score: int
    tags: List[str]
    created_at: str
    enriched_by_ai: Optional[bool] = False


class ThreadPost(BaseModel):
    position: int
    text: str
    char_count: int
    engagement_hook: Optional[str] = None
    media_suggestion: Optional[str] = None


class GeneratedContent(BaseModel):
    content_id: str
    narrative_id: Optional[str] = None
    signal_id: Optional[str] = None
    generated_at: str
    x_thread: List[ThreadPost]
    instagram_carousel: Dict[str, Any]
    reel_script: Dict[str, Any]
    story_sequence: List[Dict[str, Any]]
    substack: Dict[str, Any]
    ai_enhanced: bool = False


class AssetMatch(BaseModel):
    asset: Dict[str, Any]
    match_score: int
    match_reason: str
    recommended_for: str


class MediaMatchResponse(BaseModel):
    signal_id: str
    narrative_id: Optional[str] = None
    matched_assets: List[AssetMatch]
    total_library_assets: int
    search_tags: List[str]


class RecommendedAction(BaseModel):
    action: str
    platform: str
    deadline_window: str
    reason: str
    signal_title: str
    signal_score: int
    suggested_format: str
    suggested_asset_type: str
    urgency_level: str


class ActionPanelResponse(BaseModel):
    primary_action: RecommendedAction
    secondary_actions: List[RecommendedAction]
    total_open_windows: int
    next_deadline: str


class RefreshResponse(BaseModel):
    status: str
    signals_ingested: int
    new_signals: int
    elapsed_seconds: float
    next_refresh_in: int
