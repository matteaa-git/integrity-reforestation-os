"""Pydantic schemas for the Narrative Dominance Engine."""

from typing import List, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Narrative Signals (Radar)
# ---------------------------------------------------------------------------

class NarrativeSignal(BaseModel):
    id: str
    signal_type: str  # environmental | cultural | political | social | trend
    title: str
    description: str
    urgency: int        # 0-100
    relevance: int      # 0-100
    opportunity_window: str   # "24h" | "3 days" | "1 week" | "2 weeks"
    narrative_angle: str
    platforms: List[str]
    tags: List[str]
    status: str         # active | fading | emerging
    detected_at: str


class SignalListResponse(BaseModel):
    signals: List[NarrativeSignal]
    total: int
    active_count: int
    emerging_count: int


# ---------------------------------------------------------------------------
# Opportunities
# ---------------------------------------------------------------------------

class NarrativeOpportunity(BaseModel):
    id: str
    signal_id: Optional[str] = None
    title: str
    narrative_type: str  # authority | story | education | movement | crisis_response
    impact_score: int
    urgency_score: int
    brand_fit: int
    composite_score: int
    recommended_action: str
    content_formats: List[str]
    estimated_reach: str
    priority: str        # critical | high | medium | low
    window_closes: str
    key_angle: str


class OpportunityListResponse(BaseModel):
    opportunities: List[NarrativeOpportunity]
    total: int
    critical_count: int
    high_count: int


# ---------------------------------------------------------------------------
# Narrative Arc
# ---------------------------------------------------------------------------

class NarrativeBeat(BaseModel):
    beat_number: int
    title: str
    description: str
    content_format: str
    hook_suggestion: str
    asset_category: Optional[str] = None


class NarrativeArc(BaseModel):
    id: str
    title: str
    narrative_type: str
    protagonist: str
    tension: str
    resolution: str
    beats: List[NarrativeBeat]
    arc_length: int
    estimated_duration: str
    key_messages: List[str]
    cta: str
    emotional_arc: str   # e.g. "despair → hope → action"
    created_at: str


class GenerateArcRequest(BaseModel):
    topic: str
    narrative_type: Optional[str] = "story"
    protagonist: Optional[str] = None
    arc_length: Optional[int] = 5


class ArcListResponse(BaseModel):
    arcs: List[NarrativeArc]
    total: int


# ---------------------------------------------------------------------------
# Thread Intelligence
# ---------------------------------------------------------------------------

class ThreadTweet(BaseModel):
    position: int
    text: str
    char_count: int
    engagement_hook: Optional[str] = None
    media_suggestion: Optional[str] = None


class NarrativeThread(BaseModel):
    id: str
    narrative_id: Optional[str] = None
    title: str
    platform: str   # twitter | linkedin | threads
    hook_tweet: str
    tweets: List[ThreadTweet]
    thread_length: int
    estimated_impressions: str
    hook_score: int
    created_at: str


class BuildThreadRequest(BaseModel):
    narrative_id: Optional[str] = None
    topic: str
    platform: Optional[str] = "twitter"
    thread_length: Optional[int] = 7


class ThreadListResponse(BaseModel):
    threads: List[NarrativeThread]
    total: int


# ---------------------------------------------------------------------------
# Planter / Character Engine
# ---------------------------------------------------------------------------

class PlanterImpactMetrics(BaseModel):
    trees_planted: int
    hectares_restored: float
    communities_served: int
    years_active: int


class PlanterCharacter(BaseModel):
    id: str
    name: str
    role: str
    location: str
    story_arc: str   # origin | challenge | transformation | impact
    quote: str
    narrative_tags: List[str]
    photo_asset_id: Optional[str] = None
    impact_metrics: PlanterImpactMetrics
    content_angle: str
    story_beats: List[str]
    emotional_profile: str   # inspiring | humbling | urgent | joyful
    created_at: str


class PlanterListResponse(BaseModel):
    planters: List[PlanterCharacter]
    total: int


# ---------------------------------------------------------------------------
# War Room
# ---------------------------------------------------------------------------

class SignalAlert(BaseModel):
    level: str   # info | warning | critical
    message: str
    timestamp: str


class NarrativePerformanceRow(BaseModel):
    narrative: str
    reach: int
    engagement: float
    momentum: str   # rising | stable | declining
    posts_count: int


class ContentPipelineStats(BaseModel):
    drafts: int
    in_review: int
    approved: int
    scheduled: int


class WarRoomMetrics(BaseModel):
    narrative_velocity: float
    active_narratives: int
    narrative_reach_7d: int
    top_narrative: str
    signals_detected: int
    opportunities_open: int
    content_pipeline: ContentPipelineStats
    signal_alerts: List[SignalAlert]
    narrative_performance: List[NarrativePerformanceRow]


# ---------------------------------------------------------------------------
# Cross-Platform Multiplication
# ---------------------------------------------------------------------------

class TwitterThreadSpec(BaseModel):
    hook: str
    posts: List[str]
    cta: str
    estimated_impressions: str


class InstagramCarouselSpec(BaseModel):
    slide_count: int
    slides: List[str]
    caption: str
    hashtags: List[str]


class InstagramReelSpec(BaseModel):
    concept: str
    hook: str
    script_beats: List[str]
    cta: str
    recommended_duration: str
    sound_suggestion: str


class TikTokSpec(BaseModel):
    concept: str
    hook: str
    structure: List[str]
    sound_suggestion: str
    trend_angle: str


class YouTubeSpec(BaseModel):
    title: str
    description: str
    chapters: List[str]
    thumbnail_concept: str
    format: str   # short | long | documentary


class SubstackSpec(BaseModel):
    title: str
    subtitle: str
    intro: str
    body_outline: List[str]
    conclusion: str
    cta: str


class CrossPlatformPlan(BaseModel):
    narrative_id: Optional[str] = None
    narrative_title: str
    source_narrative: str
    twitter_thread: TwitterThreadSpec
    instagram_carousel: InstagramCarouselSpec
    instagram_reel: InstagramReelSpec
    tiktok: TikTokSpec
    youtube: YouTubeSpec
    substack: SubstackSpec
    total_content_pieces: int
    estimated_total_reach: str


class MultiplyRequest(BaseModel):
    narrative_id: Optional[str] = None
    narrative_title: str
    core_message: str
    narrative_type: Optional[str] = "story"
