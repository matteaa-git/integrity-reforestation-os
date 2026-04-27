"""
Signal Intelligence Routes
Live signal feed, opportunity scoring, narrative generation, content generation,
media matching, recommended action panel.
"""

import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.schemas.signals import (
    SignalFeedResponse,
    SignalStatsResponse,
    GeneratedNarrative,
    GeneratedContent,
    MediaMatchResponse,
    ActionPanelResponse,
    RecommendedAction,
    RefreshResponse,
)
from app.services.signal_ingestion import ingest_signals
from app.services.narrative_generator import generate_narrative
from app.services.content_generator import generate_content
from app.services.media_matcher import match_assets_to_signal
import app.store as store

router = APIRouter(prefix="/signals", tags=["signals"])

# ---------------------------------------------------------------------------
# Signal Feed
# ---------------------------------------------------------------------------

@router.get("/latest", response_model=SignalFeedResponse)
async def get_latest_signals(
    category: Optional[str] = None,
    status: Optional[str] = None,
    min_score: int = Query(default=0, ge=0, le=100),
    limit: int = Query(default=30, ge=1, le=100),
):
    signals = store.list_live_signals(
        category=category,
        status=status,
        min_score=min_score if min_score > 0 else None,
        limit=limit,
    )
    active = sum(1 for s in signals if s.get("status") == "active")
    emerging = sum(1 for s in signals if s.get("status") == "emerging")
    stats = store.get_signal_stats()
    return {
        "signals": signals,
        "total": len(signals),
        "active_count": active,
        "emerging_count": emerging,
        "last_refreshed": stats.get("last_refreshed") or datetime.now(timezone.utc).isoformat(),
    }


@router.get("/trending", response_model=SignalFeedResponse)
async def get_trending_signals(limit: int = Query(default=10, ge=1, le=50)):
    signals = store.list_trending_signals(limit=limit)
    active = sum(1 for s in signals if s.get("status") == "active")
    emerging = sum(1 for s in signals if s.get("status") == "emerging")
    stats = store.get_signal_stats()
    return {
        "signals": signals,
        "total": len(signals),
        "active_count": active,
        "emerging_count": emerging,
        "last_refreshed": stats.get("last_refreshed") or datetime.now(timezone.utc).isoformat(),
    }


@router.get("/stats", response_model=SignalStatsResponse)
async def get_signal_stats():
    return store.get_live_signal_summary()


@router.get("/{signal_id}")
async def get_signal(signal_id: str):
    signal = store.get_live_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal


@router.post("/{signal_id}/save")
async def save_signal(signal_id: str):
    sig = store.save_signal(signal_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"status": "saved", "signal_id": signal_id}


# ---------------------------------------------------------------------------
# Signal Refresh (manual + background)
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=RefreshResponse)
async def refresh_signals(background_tasks: BackgroundTasks):
    """Trigger a manual signal ingestion run."""
    start = time.time()
    new_signals = await ingest_signals()
    new_count = store.bulk_upsert_signals(new_signals)
    store.update_signal_stats(len(store.list_live_signals(limit=1000)), new_count)
    elapsed = round(time.time() - start, 2)
    return {
        "status": "ok",
        "signals_ingested": len(new_signals),
        "new_signals": new_count,
        "elapsed_seconds": elapsed,
        "next_refresh_in": 1800,
    }


# ---------------------------------------------------------------------------
# Narrative Generation from Signal
# ---------------------------------------------------------------------------

@router.post("/{signal_id}/build-narrative", response_model=GeneratedNarrative)
async def build_narrative_from_signal(signal_id: str):
    signal = store.get_live_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    # Return cached narrative if already generated
    if signal.get("narrative_id"):
        cached = store.get_live_narrative(signal["narrative_id"])
        if cached:
            return cached

    narrative = await generate_narrative(signal)
    store.store_live_narrative(narrative)
    return narrative


@router.get("/{signal_id}/narrative", response_model=GeneratedNarrative)
async def get_signal_narrative(signal_id: str):
    signal = store.get_live_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    if not signal.get("narrative_id"):
        raise HTTPException(status_code=404, detail="No narrative generated yet")
    narrative = store.get_live_narrative(signal["narrative_id"])
    if not narrative:
        raise HTTPException(status_code=404, detail="Narrative not found")
    return narrative


# ---------------------------------------------------------------------------
# Content Generation from Signal
# ---------------------------------------------------------------------------

@router.post("/{signal_id}/generate-content", response_model=GeneratedContent)
async def generate_signal_content(signal_id: str):
    signal = store.get_live_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    # Generate narrative first if needed
    if signal.get("narrative_id"):
        narrative = store.get_live_narrative(signal["narrative_id"])
    else:
        narrative = await generate_narrative(signal)
        store.store_live_narrative(narrative)

    # Return cached content if exists
    existing = store.get_content_by_narrative(narrative["narrative_id"])
    if existing:
        return existing

    content = await generate_content(narrative, signal)
    store.store_live_content(content)
    return content


@router.get("/content/{content_id}", response_model=GeneratedContent)
async def get_content(content_id: str):
    content = store.get_live_content(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


# ---------------------------------------------------------------------------
# Media Matching
# ---------------------------------------------------------------------------

@router.get("/{signal_id}/media-match", response_model=MediaMatchResponse)
async def match_media(signal_id: str, limit: int = Query(default=8, ge=1, le=20)):
    signal = store.get_live_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    narrative_id = signal.get("narrative_id")
    narrative = store.get_live_narrative(narrative_id) if narrative_id else {}

    assets = store.list_assets(limit=200)
    matched = match_assets_to_signal(assets, signal, narrative or {}, limit=limit)

    return {
        "signal_id": signal_id,
        "narrative_id": narrative_id,
        "matched_assets": matched,
        "total_library_assets": len(assets),
        "search_tags": signal.get("tags", []),
    }


# ---------------------------------------------------------------------------
# Recommended Action Panel
# ---------------------------------------------------------------------------

@router.get("/recommended-actions", response_model=ActionPanelResponse)
async def get_recommended_actions():
    signals = store.list_live_signals(status="active", limit=10)
    if not signals:
        signals = store.list_live_signals(limit=10)

    if not signals:
        return {
            "primary_action": {
                "action": "Run signal refresh to detect opportunities",
                "platform": "all",
                "deadline_window": "now",
                "reason": "No signals detected yet",
                "signal_title": "—",
                "signal_score": 0,
                "suggested_format": "reel",
                "suggested_asset_type": "drone",
                "urgency_level": "low",
            },
            "secondary_actions": [],
            "total_open_windows": 0,
            "next_deadline": "—",
        }

    def _make_action(sig: dict, is_primary: bool) -> dict:
        score = sig.get("opportunity_score", 50)
        urgency = sig.get("urgency_score", 50)
        cat = sig.get("category", "environmental")
        window = sig.get("lifespan_estimate", "48h")
        title = sig.get("title", "")[:60]

        if urgency >= 80:
            action = f"Deploy {cat} response content immediately — {window} window"
            urgency_level = "critical"
        elif urgency >= 60:
            action = f"Create {cat} content within {window} while momentum is high"
            urgency_level = "high"
        else:
            action = f"Build {cat} narrative content — emerging opportunity"
            urgency_level = "medium"

        format_map = {
            "environmental": "reel",
            "cultural": "carousel",
            "social": "reel",
            "political": "twitter_thread",
            "trend": "reel",
        }
        asset_map = {
            "environmental": "drone",
            "cultural": "talking_head",
            "social": "talking_head",
            "political": "talking_head",
            "trend": "video",
        }
        platform_map = {
            "environmental": "Instagram + TikTok",
            "cultural": "Instagram + Threads",
            "social": "Instagram + YouTube",
            "political": "LinkedIn + Twitter",
            "trend": "TikTok + Instagram",
        }
        return {
            "action": action,
            "platform": platform_map.get(cat, "Instagram"),
            "deadline_window": window,
            "reason": f"Score {score}/100 — {sig.get('tags', ['reforestation'])[0] if sig.get('tags') else 'reforestation'} signal trending",
            "signal_title": title,
            "signal_score": score,
            "suggested_format": format_map.get(cat, "reel"),
            "suggested_asset_type": asset_map.get(cat, "drone"),
            "urgency_level": urgency_level,
        }

    primary = _make_action(signals[0], True)
    secondary = [_make_action(s, False) for s in signals[1:4]]

    active_windows = len([s for s in signals if s.get("status") == "active"])
    next_sig = signals[0] if signals else None
    next_deadline = next_sig["lifespan_estimate"] if next_sig else "—"

    return {
        "primary_action": primary,
        "secondary_actions": secondary,
        "total_open_windows": active_windows,
        "next_deadline": next_deadline,
    }
