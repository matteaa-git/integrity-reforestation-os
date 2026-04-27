"""Narrative Dominance Engine — API routes."""

from fastapi import APIRouter, HTTPException
from typing import Optional

from app.schemas.narrative import (
    SignalListResponse,
    OpportunityListResponse,
    ArcListResponse,
    GenerateArcRequest,
    NarrativeArc,
    ThreadListResponse,
    BuildThreadRequest,
    NarrativeThread,
    PlanterListResponse,
    WarRoomMetrics,
    CrossPlatformPlan,
    MultiplyRequest,
)
import app.store as store

router = APIRouter(prefix="/narrative", tags=["narrative"])


# ---------------------------------------------------------------------------
# Narrative Radar — Signal Detection
# ---------------------------------------------------------------------------

@router.get("/signals", response_model=SignalListResponse)
def list_signals(
    status: Optional[str] = None,
    signal_type: Optional[str] = None,
    min_urgency: Optional[int] = None,
):
    signals = store.list_narrative_signals(
        status=status,
        signal_type=signal_type,
        min_urgency=min_urgency,
    )
    active = sum(1 for s in signals if s["status"] == "active")
    emerging = sum(1 for s in signals if s["status"] == "emerging")
    return {
        "signals": signals,
        "total": len(signals),
        "active_count": active,
        "emerging_count": emerging,
    }


@router.get("/signals/{signal_id}")
def get_signal(signal_id: str):
    signal = store.get_narrative_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal


# ---------------------------------------------------------------------------
# Opportunity Engine
# ---------------------------------------------------------------------------

@router.get("/opportunities", response_model=OpportunityListResponse)
def list_opportunities(
    priority: Optional[str] = None,
    narrative_type: Optional[str] = None,
    min_score: Optional[int] = None,
):
    opps = store.list_narrative_opportunities(
        priority=priority,
        narrative_type=narrative_type,
        min_score=min_score,
    )
    critical = sum(1 for o in opps if o["priority"] == "critical")
    high = sum(1 for o in opps if o["priority"] == "high")
    return {
        "opportunities": opps,
        "total": len(opps),
        "critical_count": critical,
        "high_count": high,
    }


# ---------------------------------------------------------------------------
# Narrative Builder — Arcs
# ---------------------------------------------------------------------------

@router.get("/arcs", response_model=ArcListResponse)
def list_arcs():
    arcs = store.list_narrative_arcs()
    return {"arcs": arcs, "total": len(arcs)}


@router.get("/arcs/{arc_id}")
def get_arc(arc_id: str):
    arc = store.get_narrative_arc(arc_id)
    if not arc:
        raise HTTPException(status_code=404, detail="Arc not found")
    return arc


@router.post("/generate-arc", response_model=NarrativeArc)
def generate_arc(req: GenerateArcRequest):
    arc = store.generate_narrative_arc(
        topic=req.topic,
        narrative_type=req.narrative_type or "story",
        protagonist=req.protagonist,
        arc_length=req.arc_length or 5,
    )
    return arc


# ---------------------------------------------------------------------------
# Thread Intelligence Studio
# ---------------------------------------------------------------------------

@router.get("/threads", response_model=ThreadListResponse)
def list_threads(platform: Optional[str] = None):
    threads = store.list_narrative_threads(platform=platform)
    return {"threads": threads, "total": len(threads)}


@router.post("/build-thread", response_model=NarrativeThread)
def build_thread(req: BuildThreadRequest):
    thread = store.build_narrative_thread(
        topic=req.topic,
        platform=req.platform or "twitter",
        thread_length=req.thread_length or 7,
        narrative_id=req.narrative_id,
    )
    return thread


# ---------------------------------------------------------------------------
# Planter / Character Story Engine
# ---------------------------------------------------------------------------

@router.get("/planters", response_model=PlanterListResponse)
def list_planters(story_arc: Optional[str] = None):
    planters = store.list_planters(story_arc=story_arc)
    return {"planters": planters, "total": len(planters)}


@router.get("/planters/{planter_id}")
def get_planter(planter_id: str):
    planter = store.get_planter(planter_id)
    if not planter:
        raise HTTPException(status_code=404, detail="Planter not found")
    return planter


# ---------------------------------------------------------------------------
# Content War Room
# ---------------------------------------------------------------------------

@router.get("/warroom", response_model=WarRoomMetrics)
def get_war_room():
    return store.get_war_room_metrics()


# ---------------------------------------------------------------------------
# Cross-Platform Multiplication
# ---------------------------------------------------------------------------

@router.post("/multiply", response_model=CrossPlatformPlan)
def multiply_narrative(req: MultiplyRequest):
    plan = store.generate_cross_platform_plan(
        narrative_title=req.narrative_title,
        core_message=req.core_message,
        narrative_type=req.narrative_type or "story",
        narrative_id=req.narrative_id,
    )
    return plan
