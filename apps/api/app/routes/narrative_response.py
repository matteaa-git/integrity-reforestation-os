"""
Narrative Response Engine Routes
Handles narrative topic clustering, response generation, and response queue.
"""

import time
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.schemas.narrative_response import (
    NarrativeTopicListResponse,
    GeneratedResponse,
    ResponseQueueListResponse,
    ResponseQueueItem,
    AddToQueueRequest,
    UpdateQueueItemRequest,
)
from app.services.narrative_clustering import cluster_signals
from app.services.response_generator import generate_response
import app.store as store

router = APIRouter(prefix="/narrative-response", tags=["narrative-response"])


# ---------------------------------------------------------------------------
# Narrative Topics (clustered signals)
# ---------------------------------------------------------------------------

@router.get("/topics", response_model=NarrativeTopicListResponse)
async def get_narrative_topics(
    status: Optional[str] = None,
    category: Optional[str] = None,
    min_score: int = Query(default=0, ge=0, le=100),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Return clustered narrative topics from live signals."""
    # Get cached topics or recluster
    topics = store.get_narrative_topics()
    if not topics:
        signals = store.list_live_signals(limit=500)
        topics = cluster_signals(signals)
        store.set_narrative_topics(topics)

    if status:
        topics = [t for t in topics if t.get("status") == status]
    if category:
        topics = [t for t in topics if t.get("category") == category]
    if min_score > 0:
        topics = [t for t in topics if t.get("opportunity_score", 0) >= min_score]

    topics = topics[:limit]

    respond_now = sum(1 for t in topics if t.get("status") == "respond_now")
    good_opp = sum(1 for t in topics if t.get("status") == "good_opportunity")
    last_clustered = store.get_cluster_timestamp() or datetime.now(timezone.utc).isoformat()

    return {
        "topics": topics,
        "total": len(topics),
        "respond_now_count": respond_now,
        "good_opportunity_count": good_opp,
        "last_clustered": last_clustered,
    }


@router.post("/topics/recluster", response_model=NarrativeTopicListResponse)
async def recluster_topics():
    """Force re-clustering of current live signals."""
    signals = store.list_live_signals(limit=500)
    topics = cluster_signals(signals)
    store.set_narrative_topics(topics)
    respond_now = sum(1 for t in topics if t.get("status") == "respond_now")
    good_opp = sum(1 for t in topics if t.get("status") == "good_opportunity")
    last_clustered = datetime.now(timezone.utc).isoformat()
    return {
        "topics": topics,
        "total": len(topics),
        "respond_now_count": respond_now,
        "good_opportunity_count": good_opp,
        "last_clustered": last_clustered,
    }


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str):
    topic = store.get_narrative_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


# ---------------------------------------------------------------------------
# Response Generation
# ---------------------------------------------------------------------------

@router.post("/topics/{topic_id}/generate", response_model=GeneratedResponse)
async def generate_topic_response(topic_id: str):
    """Generate X thread, LinkedIn post, and Substack outline for a topic."""
    topic = store.get_narrative_topic(topic_id)
    if not topic:
        # Try to get from live signals and cluster on demand
        signals = store.list_live_signals(limit=500)
        if not signals:
            raise HTTPException(status_code=404, detail="Topic not found and no signals available")
        topics = cluster_signals(signals)
        store.set_narrative_topics(topics)
        topic = store.get_narrative_topic(topic_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

    # Return cached response if exists
    cached = store.get_topic_response(topic_id)
    if cached:
        return cached

    response = await generate_response(topic)
    store.store_topic_response(topic_id, response)
    return response


@router.post("/topics/{topic_id}/regenerate", response_model=GeneratedResponse)
async def regenerate_topic_response(topic_id: str):
    """Force regeneration of response (bypasses cache)."""
    topic = store.get_narrative_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    response = await generate_response(topic)
    store.store_topic_response(topic_id, response)
    return response


@router.get("/responses/{response_id}", response_model=GeneratedResponse)
async def get_response(response_id: str):
    resp = store.get_response_by_id(response_id)
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    return resp


# ---------------------------------------------------------------------------
# Response Queue
# ---------------------------------------------------------------------------

@router.get("/queue", response_model=ResponseQueueListResponse)
async def get_queue(
    status: Optional[str] = None,
    platform: Optional[str] = None,
):
    items = store.list_response_queue(status=status, platform=platform)
    return {
        "items": items,
        "total": len(items),
        "draft_count":    sum(1 for i in items if i.get("status") == "draft"),
        "review_count":   sum(1 for i in items if i.get("status") == "review"),
        "approved_count": sum(1 for i in items if i.get("status") == "approved"),
        "scheduled_count":sum(1 for i in items if i.get("status") == "scheduled"),
    }


@router.post("/queue", response_model=ResponseQueueItem)
async def add_to_queue(data: AddToQueueRequest):
    item = store.create_queue_item(data.model_dump())
    return item


@router.patch("/queue/{item_id}", response_model=ResponseQueueItem)
async def update_queue_item(item_id: str, data: UpdateQueueItemRequest):
    item = store.update_queue_item(item_id, data.model_dump(exclude_none=True))
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    return item


@router.delete("/queue/{item_id}")
async def delete_queue_item(item_id: str):
    ok = store.delete_queue_item(item_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Queue item not found")
    return {"status": "deleted", "item_id": item_id}
