"""
LinkedIn Post Studio Routes
Handles drafting, approval, scheduling, publishing, and analytics
for LinkedIn posts.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.linkedin import (
    LinkedInPost,
    LinkedInPostCreate,
    LinkedInPostUpdate,
    LinkedInPostListResponse,
    LinkedInScheduleRequest,
    LinkedInAnalytics,
)
import app.store as store

router = APIRouter(prefix="/linkedin", tags=["linkedin-studio"])


# ---------------------------------------------------------------------------
# Draft CRUD
# ---------------------------------------------------------------------------

@router.post("/draft", response_model=LinkedInPost)
async def create_draft(data: LinkedInPostCreate):
    post = store.create_linkedin_post(data.model_dump())
    return post


@router.get("/drafts", response_model=LinkedInPostListResponse)
async def list_drafts(
    status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    posts = store.list_linkedin_posts(status=status, limit=limit)
    return {
        "posts": posts,
        "total": len(posts),
        "draft_count":     sum(1 for p in posts if p.get("status") == "draft"),
        "pending_count":   sum(1 for p in posts if p.get("status") == "pending_approval"),
        "scheduled_count": sum(1 for p in posts if p.get("status") == "scheduled"),
        "published_count": sum(1 for p in posts if p.get("status") == "published"),
    }


@router.get("/analytics/summary", response_model=LinkedInAnalytics)
async def get_analytics():
    return store.get_linkedin_analytics_summary()


@router.get("/{post_id}", response_model=LinkedInPost)
async def get_post(post_id: str):
    post = store.get_linkedin_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.patch("/{post_id}", response_model=LinkedInPost)
async def update_post(post_id: str, data: LinkedInPostUpdate):
    post = store.update_linkedin_post(post_id, data.model_dump(exclude_none=True))
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.delete("/{post_id}")
async def delete_post(post_id: str):
    ok = store.delete_linkedin_post(post_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"status": "deleted", "post_id": post_id}


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------

@router.post("/{post_id}/submit-approval", response_model=LinkedInPost)
async def submit_for_approval(post_id: str):
    post = store.get_linkedin_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post = store.update_linkedin_post(post_id, {"status": "pending_approval"})
    preview = post.get("content", "")[:120]
    store.create_queue_item({
        "topic_id": post_id,
        "topic_title": preview,
        "platform": "linkedin",
        "content_type": post.get("post_type", "text"),
        "content": {
            "post_id": post_id,
            "text": preview,
            "thought_leadership_score": post.get("thought_leadership_score", 0),
            "estimated_reach": post.get("estimated_reach", 0),
        },
    })
    return post


@router.post("/{post_id}/schedule", response_model=LinkedInPost)
async def schedule_post(post_id: str, data: LinkedInScheduleRequest):
    post = store.get_linkedin_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post = store.update_linkedin_post(post_id, {
        "status": "scheduled",
        "scheduled_time": data.scheduled_time,
    })
    return post


@router.post("/{post_id}/publish", response_model=LinkedInPost)
async def publish_post(post_id: str):
    post = store.get_linkedin_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    now = datetime.now(timezone.utc).isoformat()
    post = store.update_linkedin_post(post_id, {
        "status": "published",
        "published_time": now,
    })
    store.record_linkedin_analytics_event(post_id, post)
    return post
