"""Content Intelligence Engine — scoring, trends, hook analysis, portfolio."""

from fastapi import APIRouter, HTTPException
from typing import Optional

from app.schemas.intelligence import (
    ContentScoreRequest, ContentScoreResponse, ContentScoresResponse,
    TrendRadarResponse,
    HookAnalysisRequest, HookAnalysisResponse, HookSuggestion,
    PortfolioAnalysis, PortfolioFormatBreakdown, PortfolioNarrativeBreakdown,
    PortfolioRecommendation,
    FlywheelMetrics, FlywheelStage,
)
from app.services.content_scorer import (
    score_content, score_hook,
    _word_count, _has_number, _has_question, _count_power_words,
    _has_curiosity_gap, _has_transformation_angle, _infer_category,
)
from app.services.trend_radar import get_trends
import app.store as store

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


# ---------------------------------------------------------------------------
# Content Scoring
# ---------------------------------------------------------------------------

@router.post("/score", response_model=ContentScoreResponse)
async def score_content_item(req: ContentScoreRequest):
    """Score content inline from request body."""
    return score_content(
        title=req.title,
        format=req.format,
        hook_text=req.hook_text,
        caption=req.caption,
        content_category=req.content_category,
        asset_count=req.asset_count,
        has_video=req.has_video,
        pillar=req.pillar,
        ai_keywords=req.ai_keywords,
    )


@router.get("/score/{draft_id}", response_model=ContentScoreResponse)
async def score_draft(draft_id: str):
    """Score an existing draft by ID."""
    draft = store.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft_assets = store.get_draft_assets(draft_id)
    has_video = any(da["asset"]["media_type"] == "video" for da in draft_assets)
    pillars = [da["asset"].get("pillar") for da in draft_assets if da["asset"].get("pillar")]
    keywords: list = []
    for da in draft_assets:
        keywords.extend(da["asset"].get("ai_keywords") or [])

    return score_content(
        title=draft["title"],
        format=draft["format"],
        asset_count=len(draft_assets),
        has_video=has_video,
        pillar=pillars[0] if pillars else None,
        ai_keywords=list(set(keywords))[:12],
    )


@router.get("/scores")
async def list_content_scores(status: Optional[str] = None):
    """Score all drafts and return ranked list."""
    drafts = store.list_drafts(status=status)
    scored = []
    for draft in drafts:
        draft_assets = store.get_draft_assets(draft["id"])
        has_video = any(da["asset"]["media_type"] == "video" for da in draft_assets)
        pillars = [da["asset"].get("pillar") for da in draft_assets if da["asset"].get("pillar")]
        keywords: list = []
        for da in draft_assets:
            keywords.extend(da["asset"].get("ai_keywords") or [])

        sc = score_content(
            title=draft["title"],
            format=draft["format"],
            asset_count=len(draft_assets),
            has_video=has_video,
            pillar=pillars[0] if pillars else None,
            ai_keywords=list(set(keywords))[:12],
        )
        scored.append({
            "draft_id": draft["id"],
            "title": draft["title"],
            "format": draft["format"],
            "status": draft["status"],
            "scheduled_for": draft.get("scheduled_for"),
            **sc,
        })

    scored.sort(key=lambda x: x["viral_probability"], reverse=True)
    return {"items": scored, "total": len(scored)}


# ---------------------------------------------------------------------------
# Trend Radar
# ---------------------------------------------------------------------------

@router.get("/trends", response_model=TrendRadarResponse)
async def get_trend_radar():
    """Return curated trending topics with content opportunity analysis."""
    return get_trends()


# ---------------------------------------------------------------------------
# Hook Analyzer
# ---------------------------------------------------------------------------

@router.post("/analyze-hook", response_model=HookAnalysisResponse)
async def analyze_hook(req: HookAnalysisRequest):
    """Score a hook text and return analysis + alternative suggestions."""
    text = req.hook_text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="hook_text cannot be empty")

    wc = _word_count(text)
    pw = _count_power_words(text)
    has_num = _has_number(text)
    has_q = _has_question(text)
    has_cg = _has_curiosity_gap(text)
    has_tx = _has_transformation_angle(text)

    length_score = 85.0 if 6 <= wc <= 15 else (60.0 if 4 <= wc <= 20 else 30.0)
    clarity_score = float(min(90 - max(wc - 15, 0) * 3, 90))
    urgency_score = float(min(30 + pw * 12 + (20 if has_q else 0), 95))
    curiosity_score = float(min(40 + (35 if has_cg else 0) + (15 if has_num else 0) + (10 if has_tx else 0), 97))
    emotional_pull = float(min(35 + pw * 8 + (15 if has_tx else 0) + (10 if has_q else 0), 95))

    overall = (
        length_score * 0.15
        + clarity_score * 0.20
        + urgency_score * 0.20
        + curiosity_score * 0.30
        + emotional_pull * 0.15
    )

    strengths = []
    weaknesses = []

    if 6 <= wc <= 15:
        strengths.append("Optimal length — concise and scannable on mobile")
    else:
        weaknesses.append(f"{'Too short' if wc < 6 else 'Too long'} ({wc} words) — aim for 6–15 words for best results")

    if has_cg:
        strengths.append("Strong curiosity gap — compels tap-through before the brain can answer")
    else:
        weaknesses.append("No curiosity gap — readers can mentally complete it without engaging")

    if has_num:
        strengths.append("Specific number — adds credibility and increases click-through by ~36%")

    if has_q:
        strengths.append("Question format — invites mental participation and comment responses")

    if pw > 0:
        strengths.append(f"{pw} power word{'s' if pw > 1 else ''} — activates emotional response")
    else:
        weaknesses.append("No power words — add urgency or intrigue vocabulary")

    if has_tx:
        strengths.append("Transformation angle — before/after structure consistently outperforms")

    if not strengths:
        weaknesses.append("Hook is too neutral — needs a stronger emotional trigger")

    suggestions = _generate_hook_suggestions(text, req.target_format)

    return {
        "hook_text": text,
        "overall_score": round(overall, 1),
        "curiosity_score": round(curiosity_score, 1),
        "clarity_score": round(clarity_score, 1),
        "urgency_score": round(urgency_score, 1),
        "emotional_pull": round(emotional_pull, 1),
        "word_count": wc,
        "optimal_length": 6 <= wc <= 15,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions,
    }


def _generate_hook_suggestions(original: str, fmt: str) -> list:
    words = original.strip().rstrip("?.!").split()
    tail = " ".join(words[-3:]) if len(words) >= 3 else original
    head = " ".join(words[:4]) if len(words) >= 4 else original

    return [
        {
            "text": f"Most people don't know the truth about {tail}",
            "category": "curiosity",
            "estimated_score_delta": 18.0,
        },
        {
            "text": f"The uncomfortable truth about {tail} (nobody talks about this)",
            "category": "contrarian",
            "estimated_score_delta": 22.0,
        },
        {
            "text": f"3 things I wish I knew before {head.lower()}",
            "category": "authority",
            "estimated_score_delta": 12.0,
        },
        {
            "text": f"Watch what happens when you {head.lower()} for 30 days",
            "category": "transformation",
            "estimated_score_delta": 16.0,
        },
        {
            "text": f"We studied 100 cases of {tail}. Here's what works.",
            "category": "authority",
            "estimated_score_delta": 14.0,
        },
    ]


# ---------------------------------------------------------------------------
# Portfolio Optimizer
# ---------------------------------------------------------------------------

@router.get("/portfolio", response_model=PortfolioAnalysis)
async def get_portfolio_analysis():
    """Analyze current content pipeline format and narrative balance."""
    drafts = store.list_drafts()

    fmt_counts = {"reel": 0, "carousel": 0, "story": 0, "post": 0}
    for d in drafts:
        fmt = d.get("format", "post")
        fmt_counts[fmt] = fmt_counts.get(fmt, 0) + 1

    # Overlay real published content from Instagram if connected
    ig_posts = store.get_instagram_posts() if store.is_instagram_connected() else []
    for p in ig_posts:
        mt = p.get("media_type", "IMAGE")
        if mt == "VIDEO":
            fmt_counts["reel"] = fmt_counts.get("reel", 0) + 1
        elif mt == "CAROUSEL_ALBUM":
            fmt_counts["carousel"] = fmt_counts.get("carousel", 0) + 1
        else:
            fmt_counts["post"] = fmt_counts.get("post", 0) + 1

    total_fmt = max(sum(fmt_counts.values()), 1)

    narrative = {"education": 0, "entertainment": 0, "story": 0, "authority": 0}
    for d in drafts:
        cat = _infer_category(d["title"])
        if cat == "transformation":
            narrative["story"] += 1
        elif cat in narrative:
            narrative[cat] += 1
        else:
            narrative["entertainment"] += 1

    total_narr = max(sum(narrative.values()), 1)

    reel_pct = fmt_counts["reel"] / total_fmt * 100
    carousel_pct = fmt_counts["carousel"] / total_fmt * 100
    story_pct = fmt_counts["story"] / total_fmt * 100

    edu_pct = narrative["education"] / total_narr * 100
    ent_pct = narrative["entertainment"] / total_narr * 100
    story_narr_pct = narrative["story"] / total_narr * 100
    auth_pct = narrative["authority"] / total_narr * 100

    # Portfolio score: penalise deviation from ideal mix
    reel_dev = abs(reel_pct - 40)
    carousel_dev = abs(carousel_pct - 35)
    story_dev = abs(story_pct - 25)
    narr_dev = (abs(edu_pct - 30) + abs(ent_pct - 25) + abs(story_narr_pct - 25) + abs(auth_pct - 20))

    portfolio_score = max(100 - (reel_dev + carousel_dev + story_dev) * 0.35 - narr_dev * 0.15, 10)

    recs: list = []
    if reel_pct < 30:
        recs.append(PortfolioRecommendation(
            priority="high",
            action="Create more Reels",
            reason=f"Only {fmt_counts['reel']} reels in pipeline — algorithm heavily favours video content",
            suggested_format="reel",
            suggested_topic="Transformation or BTS field footage",
        ))
    if carousel_pct < 20:
        recs.append(PortfolioRecommendation(
            priority="medium",
            action="Add educational carousels",
            reason="Carousels drive saves — the highest-value engagement signal for growth",
            suggested_format="carousel",
            suggested_topic="Carbon offset myths or reforestation facts",
        ))
    if edu_pct < 20:
        recs.append(PortfolioRecommendation(
            priority="medium",
            action="Increase educational content",
            reason="Educational posts receive 3× more saves and drive sustained follower growth",
            suggested_format="carousel",
            suggested_topic=None,
        ))
    if auth_pct < 15:
        recs.append(PortfolioRecommendation(
            priority="low",
            action="Add authority content",
            reason="Research-backed posts build brand credibility and attract high-quality followers",
            suggested_format="carousel",
            suggested_topic="Industry data or project impact report",
        ))
    if not recs:
        recs.append(PortfolioRecommendation(
            priority="low",
            action="Maintain current mix",
            reason="Pipeline is well-balanced — focus on posting cadence and hook quality",
        ))

    if fmt_counts["reel"] < fmt_counts["carousel"]:
        next_best = "reel"
        next_reason = "More carousels than reels in pipeline — balance with video for algorithmic boost"
    elif edu_pct > 55:
        next_best = "story"
        next_reason = "Heavy education weighting — add authentic story content to humanise the brand"
    else:
        next_best = "carousel"
        next_reason = "Curiosity-hook carousels consistently drive the most saves and shares in this niche"

    return PortfolioAnalysis(
        week_label="Current Pipeline",
        format_breakdown=PortfolioFormatBreakdown(
            reels=fmt_counts["reel"],
            carousels=fmt_counts["carousel"],
            stories=fmt_counts["story"],
            posts=fmt_counts["post"],
            total=total_fmt,
            reels_pct=round(reel_pct, 1),
            carousels_pct=round(carousel_pct, 1),
            stories_pct=round(story_pct, 1),
        ),
        narrative_breakdown=PortfolioNarrativeBreakdown(
            education=narrative["education"],
            entertainment=narrative["entertainment"],
            story=narrative["story"],
            authority=narrative["authority"],
            total=total_narr,
            education_pct=round(edu_pct, 1),
            entertainment_pct=round(ent_pct, 1),
            story_pct=round(story_narr_pct, 1),
            authority_pct=round(auth_pct, 1),
        ),
        portfolio_score=round(portfolio_score, 1),
        recommendations=recs,
        next_best_content=next_best,
        next_best_reason=next_reason,
    )


# ---------------------------------------------------------------------------
# Growth Flywheel
# ---------------------------------------------------------------------------

@router.get("/flywheel", response_model=FlywheelMetrics)
async def get_flywheel_metrics():
    """Return pipeline health metrics and AI growth recommendation."""
    drafts = store.list_drafts()

    in_production = len([d for d in drafts if d["status"] in ("draft", "in_review")])
    approved = len([d for d in drafts if d["status"] == "approved"])
    scheduled = len([d for d in drafts if d["status"] == "scheduled"])
    total_pieces = len(drafts)

    avg_score = 60.0
    if drafts:
        sample = drafts[:10]
        scores = [score_content(title=d["title"], format=d["format"])["viral_probability"] for d in sample]
        avg_score = sum(scores) / len(scores)

    # ── Real Instagram data (when connected) ──────────────────────────────
    ig_state = store.get_instagram_state()
    ig_connected = store.is_instagram_connected()
    ig_posts = store.get_instagram_posts() if ig_connected else []

    followers = ig_state.get("followers_count") or 0
    ig_username = ig_state.get("username") or ""

    # Compute real reach + saves from synced posts
    real_reach  = sum(p.get("insights", {}).get("reach", 0)  for p in ig_posts)
    real_saves  = sum(p.get("insights", {}).get("saved", 0)   for p in ig_posts)
    real_shares = sum(p.get("insights", {}).get("shares", 0)  for p in ig_posts)

    # Follower growth delta: compare first vs last posts if available
    follower_delta = ""
    if ig_connected and followers:
        follower_delta = f"@{ig_username} · {followers:,} total"

    reach_value = real_reach if ig_connected else max(scheduled * 4800, 0)
    reach_unit  = "reach (28d)" if ig_connected else "est. impressions"
    reach_delta = f"{real_saves:,} saves · {real_shares:,} shares" if ig_connected else "+12% vs last week"

    stages = [
        FlywheelStage(
            key="creation",
            label="In Production",
            value=in_production,
            unit="pieces",
            delta="+2 this week",
            status="healthy" if in_production >= 3 else "warning",
            icon="✦",
        ),
        FlywheelStage(
            key="approved",
            label="Approved",
            value=approved,
            unit="ready",
            status="healthy" if approved >= 2 else ("warning" if approved == 1 else "critical"),
            icon="✓",
        ),
        FlywheelStage(
            key="scheduled",
            label="Scheduled",
            value=scheduled,
            unit="posts",
            status="healthy" if scheduled >= 1 else "warning",
            icon="◷",
        ),
        FlywheelStage(
            key="reach",
            label="Reach",
            value=reach_value,
            unit=reach_unit,
            delta=reach_delta,
            status="healthy",
            icon="↗",
        ),
        FlywheelStage(
            key="followers",
            label="Followers",
            value=followers if ig_connected else 0,
            unit="followers",
            delta=follower_delta if ig_connected else "Connect Instagram",
            status="healthy" if ig_connected else "warning",
            icon="♟",
        ),
        FlywheelStage(
            key="conversions",
            label="Saves",
            value=real_saves if ig_connected else 0,
            unit="saves (28d)" if ig_connected else "saves",
            delta=f"{real_shares} shares" if ig_connected else "Connect Instagram",
            status="healthy" if ig_connected else "warning",
            icon="◈",
        ),
    ]

    bottleneck = None
    bottleneck_tip = None
    if in_production == 0 and total_pieces == 0:
        bottleneck = "creation"
        bottleneck_tip = "No content in production — create a reel or carousel to start the flywheel"
    elif approved == 0 and in_production > 0:
        bottleneck = "approved"
        bottleneck_tip = f"{in_production} piece{'s' if in_production > 1 else ''} awaiting approval — review and approve to unblock scheduling"
    elif scheduled == 0 and approved > 0:
        bottleneck = "scheduled"
        bottleneck_tip = f"{approved} approved piece{'s' if approved > 1 else ''} not yet scheduled — schedule for maximum algorithmic timing"

    # Engagement rate signal
    eng_note = ""
    if ig_connected and ig_posts and followers:
        fc = float(followers) or 1.0
        rates = []
        for p in ig_posts:
            likes    = p.get("like_count", 0) or 0
            comments = p.get("comments_count", 0) or 0
            saves    = p.get("insights", {}).get("saved", 0) or 0
            rates.append((likes + comments + saves) / fc * 100)
        avg_eng = sum(rates) / len(rates)
        eng_note = f" Your real engagement rate is {avg_eng:.1f}% across {len(ig_posts)} posts."

    if total_pieces == 0:
        rec = "Start by creating your first reel using a high-scoring hook from the Hook Bank — transformation content averages 88/100 viral score in this niche"
    elif avg_score < 55:
        rec = "Content scores below the engagement threshold — strengthen hooks and add video assets to push viral probability above 70"
    elif bottleneck:
        rec = f"Biggest growth lever: remove the {bottleneck} bottleneck. {bottleneck_tip}"
    else:
        rec = f"Pipeline healthy! Post Reels 4×/week and carousels 3×/week — posting consistency is the #1 growth driver for accounts under 10K followers.{eng_note}"

    if total_pieces == 0:
        next_action = "Create your first reel"
    elif in_production > 0 and approved == 0:
        next_action = "Submit content for approval"
    elif approved > 0 and scheduled == 0:
        next_action = "Schedule approved content"
    else:
        next_action = "Create more content to maintain cadence"

    pipeline_health = min(100.0, in_production * 12 + approved * 18 + scheduled * 22 + 20.0)

    return FlywheelMetrics(
        stages=stages,
        bottleneck=bottleneck,
        bottleneck_tip=bottleneck_tip,
        ai_recommendation=rec,
        next_action=next_action,
        content_velocity=round(total_pieces / 4.0, 1),
        avg_viral_score=round(avg_score, 1),
        pipeline_health=round(pipeline_health, 1),
    )
