from typing import List, Optional, Dict, Any
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Content Scoring
# ---------------------------------------------------------------------------

class ContentScoreRequest(BaseModel):
    title: str
    format: str  # reel | carousel | story | post
    hook_text: Optional[str] = None
    caption: Optional[str] = None
    content_category: Optional[str] = None
    asset_count: int = 0
    has_video: bool = False
    pillar: Optional[str] = None
    ai_keywords: List[str] = []


class ScoreFactor(BaseModel):
    label: str
    impact: float
    description: str


class ContentScoreResponse(BaseModel):
    viral_probability: float
    predicted_reach_low: int
    predicted_reach_high: int
    engagement_probability: float
    hook_strength: float
    save_potential: float
    share_potential: float
    content_category: str
    confidence: float
    factors: List[Dict[str, Any]]
    recommendations: List[str]


class ScoredDraftItem(BaseModel):
    draft_id: str
    title: str
    format: str
    status: str
    scheduled_for: Optional[str] = None
    viral_probability: float
    predicted_reach_low: int
    predicted_reach_high: int
    engagement_probability: float
    hook_strength: float
    save_potential: float
    share_potential: float
    content_category: str
    confidence: float
    factors: List[Dict[str, Any]]
    recommendations: List[str]


class ContentScoresResponse(BaseModel):
    items: List[ScoredDraftItem]
    total: int


# ---------------------------------------------------------------------------
# Trend Radar
# ---------------------------------------------------------------------------

class TrendItem(BaseModel):
    id: str
    topic: str
    platform: str
    trend_score: float
    velocity: str          # rising | peak | declining
    volume_label: str
    content_angle: str
    content_formats: List[str]
    tags: List[str]
    relevance_to_brand: float
    opportunity_window: str


class TrendRadarResponse(BaseModel):
    trends: List[TrendItem]
    last_updated: str
    top_opportunity: Optional[TrendItem] = None


# ---------------------------------------------------------------------------
# Hook Analysis
# ---------------------------------------------------------------------------

class HookAnalysisRequest(BaseModel):
    hook_text: str
    target_format: str = "universal"


class HookSuggestion(BaseModel):
    text: str
    category: str
    estimated_score_delta: float


class HookAnalysisResponse(BaseModel):
    hook_text: str
    overall_score: float
    curiosity_score: float
    clarity_score: float
    urgency_score: float
    emotional_pull: float
    word_count: int
    optimal_length: bool
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[HookSuggestion]


# ---------------------------------------------------------------------------
# Portfolio Optimizer
# ---------------------------------------------------------------------------

class PortfolioFormatBreakdown(BaseModel):
    reels: int
    carousels: int
    stories: int
    posts: int
    total: int
    reels_pct: float
    carousels_pct: float
    stories_pct: float
    ideal_reels_pct: float = 40.0
    ideal_carousels_pct: float = 35.0
    ideal_stories_pct: float = 25.0


class PortfolioNarrativeBreakdown(BaseModel):
    education: int
    entertainment: int
    story: int
    authority: int
    total: int
    education_pct: float
    entertainment_pct: float
    story_pct: float
    authority_pct: float


class PortfolioRecommendation(BaseModel):
    priority: str
    action: str
    reason: str
    suggested_format: Optional[str] = None
    suggested_topic: Optional[str] = None


class PortfolioAnalysis(BaseModel):
    week_label: str
    format_breakdown: PortfolioFormatBreakdown
    narrative_breakdown: PortfolioNarrativeBreakdown
    portfolio_score: float
    recommendations: List[PortfolioRecommendation]
    next_best_content: str
    next_best_reason: str


# ---------------------------------------------------------------------------
# Growth Flywheel
# ---------------------------------------------------------------------------

class FlywheelStage(BaseModel):
    key: str
    label: str
    value: int
    unit: str
    delta: Optional[str] = None
    status: str  # healthy | warning | critical
    icon: str


class FlywheelMetrics(BaseModel):
    stages: List[FlywheelStage]
    bottleneck: Optional[str] = None
    bottleneck_tip: Optional[str] = None
    ai_recommendation: str
    next_action: str
    content_velocity: float
    avg_viral_score: float
    pipeline_health: float
