"""
AI Reel Director API Routes
============================
POST /ai/analyze              — analyze specific asset IDs (background job)
POST /ai/analyze-all          — analyze all video assets (background job)
GET  /ai/job/{job_id}         — poll background job status
GET  /ai/analysis/{asset_id}  — cached analysis for one asset
GET  /ai/scores               — per-asset intelligence scores for media browser
GET  /ai/library-scores       — full scored clip rankings
POST /ai/generate-reel        — generate reel versions from strategy
POST /ai/regenerate-segment   — swap one clip slot in an existing timeline
"""

import uuid
import threading
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app import store
from app.services.ai.media_analyzer import analyze_clip, get_cached as get_analysis
from app.services.ai.moment_scorer import score_library
from app.services.ai.reel_generator import (
    generate_reel,
    generate_versions,
    REEL_STRUCTURES,
    _select_clip,
    _build_why_chosen,
)

router = APIRouter(prefix="/ai", tags=["ai-reel"])

# ── In-memory job tracker ─────────────────────────────────────────────────

_jobs: Dict[str, dict] = {}


# ── Request / Response schemas ────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    asset_ids: List[str] = Field(..., description="Asset IDs to analyze (video only)")


class GenerateReelRequest(BaseModel):
    story_type: str = Field(
        "narrative",
        description="narrative | hook_reveal | problem_solution | montage | testimonial | educational",
    )
    objective: str = Field(
        "engagement",
        description="awareness | engagement | conversion | education",
    )
    audience: str = Field(
        "general",
        description="general | young_adults | professionals | eco_conscious",
    )
    tone: str = Field(
        "inspiring",
        description="inspiring | educational | entertaining | urgent | calm",
    )
    target_duration: float = Field(30.0, ge=5.0, le=90.0, description="Target reel duration in seconds")
    versions: int = Field(3, ge=1, le=3, description="How many reel versions to generate")
    asset_ids: Optional[List[str]] = Field(None, description="Restrict to these asset IDs (uses all video if omitted)")


class RegenerateSegmentRequest(BaseModel):
    segment_index: int = Field(..., description="Index of the clip to replace (0-based)")
    story_role: str = Field("main", description="Story role / slot role to refill")
    story_type: str = Field("narrative", description="The story type currently in use")
    target_duration: float = Field(5.0, ge=1.0, le=30.0, description="Target duration for the new segment")
    exclude_asset_ids: List[str] = Field([], description="Asset IDs already in timeline (to avoid repeats)")


class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: float
    analyzed: int
    total: int
    error: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def start_analysis(body: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Kick off background analysis of specific video clips."""
    assets = []
    for asset_id in body.asset_ids:
        asset = store.get_asset(asset_id)
        if asset and asset.get("media_type") == "video":
            assets.append(asset)

    if not assets:
        raise HTTPException(400, "No valid video assets found in the provided IDs")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "progress": 0.0, "analyzed": 0, "total": len(assets), "error": None}
    background_tasks.add_task(_run_analysis_job, job_id, assets)
    return {"job_id": job_id, "total": len(assets)}


@router.post("/analyze-all")
async def analyze_all_videos(background_tasks: BackgroundTasks):
    """Analyze ALL video assets in the library."""
    all_assets = store.list_assets(media_type="video")
    if not all_assets:
        raise HTTPException(400, "No video assets in library. Index a directory first.")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "progress": 0.0, "analyzed": 0, "total": len(all_assets), "error": None}
    background_tasks.add_task(_run_analysis_job, job_id, all_assets)
    return {"job_id": job_id, "total": len(all_assets)}


@router.get("/job/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    """Poll background analysis job status."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return JobStatus(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        analyzed=job["analyzed"],
        total=job["total"],
        error=job.get("error"),
    )


@router.get("/analysis/{asset_id}")
async def get_asset_analysis(asset_id: str):
    """Return cached analysis for a single asset."""
    result = get_analysis(asset_id)
    if not result:
        raise HTTPException(404, "Analysis not found. Run /ai/analyze first.")
    return result


@router.get("/scores")
async def get_asset_scores():
    """
    Lightweight per-asset intelligence scores for the media browser.
    Returns composite score + key dimensions per asset_id.
    Only includes clips that have been analyzed.
    """
    all_assets = store.list_assets(media_type="video")
    analyses = [get_analysis(a["id"]) for a in all_assets if get_analysis(a["id"])]

    if not analyses:
        return {"scores": {}, "analyzed": 0, "total": len(all_assets)}

    from app.services.ai.transcript_service import get_cached as get_transcript
    transcripts = {
        a["asset_id"]: get_transcript(a["asset_id"])
        for a in analyses
        if get_transcript(a["asset_id"])
    }

    scored = score_library(analyses, transcripts, all_assets)

    scores = {
        c["asset_id"]: {
            "composite": c["composite"],
            "hook_score": c["hook_score"],
            "motion_score": c["motion_score"],
            "emotion_score": c.get("emotion_score", 0.0),
            "clarity_score": c.get("clarity_score", 0.5),
            "story_role_suggestion": c.get("story_role_suggestion", "main"),
        }
        for c in scored["clips"]
    }
    return {"scores": scores, "analyzed": len(analyses), "total": len(all_assets)}


@router.get("/library-scores")
async def get_library_scores(limit: int = 50):
    """Return full scored rankings of all analyzed video assets."""
    all_assets = store.list_assets(media_type="video")
    analyses = [get_analysis(a["id"]) for a in all_assets if get_analysis(a["id"])]

    if not analyses:
        return {"clips": [], "analyzed_count": 0, "total_videos": len(all_assets)}

    from app.services.ai.transcript_service import get_cached as get_transcript
    transcripts = {a["asset_id"]: get_transcript(a["asset_id"]) for a in analyses if get_transcript(a["asset_id"])}

    scored = score_library(analyses, transcripts, all_assets)

    return {
        "clips": scored["clips"][:limit],
        "best_hook": scored["best_hook"],
        "best_motion": scored["best_motion"],
        "avg_composite": scored["avg_composite"],
        "analyzed_count": len(analyses),
        "total_videos": len(all_assets),
    }


@router.post("/generate-reel")
async def generate_reel_endpoint(body: GenerateReelRequest):
    """
    Generate 1–3 reel timeline versions from the analyzed clip library.

    Strategy fields (objective, audience, tone) influence CTA copy and
    clip-selection bias within the chosen story structure.

    Returns timeline payloads compatible with the editor's loadAITimeline().
    """
    if body.asset_ids:
        assets = [a for a in [store.get_asset(aid) for aid in body.asset_ids] if a and a.get("media_type") == "video"]
    else:
        assets = store.list_assets(media_type="video")

    if not assets:
        raise HTTPException(400, "No video assets available. Add clips to your library.")

    from app.services.ai.transcript_service import get_cached as get_transcript
    analyses = [get_analysis(a["id"]) for a in assets if get_analysis(a["id"])]

    if not analyses:
        raise HTTPException(
            400,
            "No clips have been analyzed yet. Run POST /ai/analyze-all first and wait for completion."
        )

    transcripts = {a["asset_id"]: get_transcript(a["asset_id"]) for a in analyses if get_transcript(a["asset_id"])}
    scored = score_library(analyses, transcripts, assets)

    valid_styles = set(REEL_STRUCTURES.keys())
    style = body.story_type if body.story_type in valid_styles else "narrative"

    strategy = {
        "objective": body.objective,
        "audience": body.audience,
        "tone": body.tone,
    }

    timelines = generate_versions(scored, style, body.target_duration, body.versions, strategy=strategy)
    return {"versions": timelines, "count": len(timelines)}


@router.post("/regenerate-segment")
async def regenerate_segment(body: RegenerateSegmentRequest):
    """
    Replace one clip slot in an existing timeline with the best alternative.
    Excludes asset_ids already in the timeline to ensure variety.
    """
    all_assets = store.list_assets(media_type="video")
    analyses = [get_analysis(a["id"]) for a in all_assets if get_analysis(a["id"])]

    if not analyses:
        raise HTTPException(400, "No analyzed clips available.")

    from app.services.ai.transcript_service import get_cached as get_transcript
    transcripts = {a["asset_id"]: get_transcript(a["asset_id"]) for a in analyses if get_transcript(a["asset_id"])}
    scored = score_library(analyses, transcripts, all_assets)

    # Find the matching slot template from the story structure
    structure = REEL_STRUCTURES.get(body.story_type) or REEL_STRUCTURES["narrative"]
    slot = None
    for s in structure:
        if s["role"] == body.story_role or s["story_role"].lower() == body.story_role.lower():
            slot = s
            break
    if not slot:
        idx = min(body.segment_index, len(structure) - 1)
        slot = structure[idx]

    slot_with_duration = {**slot, "target_duration": body.target_duration}
    exclude = set(body.exclude_asset_ids)

    # Try versions 1-5 to find a genuinely different clip
    clip = None
    for v in range(1, 6):
        candidate = _select_clip(scored["clips"], slot_with_duration, exclude, v)
        if candidate:
            clip = candidate
            break

    if not clip:
        raise HTTPException(404, "No alternative clips available for this segment.")

    in_point = clip["best_in_point"]
    out_point = min(clip["best_out_point"], in_point + body.target_duration)

    return {
        "asset_id": clip["asset_id"],
        "filename": clip["filename"],
        "in_point": round(in_point, 2),
        "out_point": round(out_point, 2),
        "duration": round(out_point - in_point, 2),
        "story_role": slot["story_role"],
        "why_chosen": _build_why_chosen(clip, slot_with_duration),
        "effects": {
            "brightness": 100,
            "contrast": 105 if slot["role"] == "hook" else 100,
            "saturation": 100,
            "zoom": 100,
            "panX": 0,
            "panY": 0,
        },
    }


# ── Background job runner ─────────────────────────────────────────────────

def _run_analysis_job(job_id: str, assets: List[dict]) -> None:
    """Run media analysis in a background thread."""
    job = _jobs[job_id]
    job["status"] = "running"
    total = len(assets)
    errors = []

    for i, asset in enumerate(assets):
        try:
            analyze_clip(asset["id"], asset["path"])
        except Exception as e:
            errors.append(f"{asset.get('filename', asset['id'])}: {str(e)[:100]}")

        job["analyzed"] = i + 1
        job["progress"] = round((i + 1) / total, 3)

    job["status"] = "done"
    job["progress"] = 1.0
    if errors:
        job["error"] = f"{len(errors)} clips failed: " + "; ".join(errors[:3])
