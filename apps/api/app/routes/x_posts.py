"""
X Post Studio Routes
Handles drafting, approval submission, scheduling, publishing, analytics,
and content multiplication for X (Twitter) posts.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services import x_api
from app.schemas.x_post import (
    XPost,
    XPostCreate,
    XPostUpdate,
    XPostListResponse,
    XScheduleRequest,
    XAnalytics,
    XMultiplyResult,
)
import app.store as store

router = APIRouter(prefix="/x", tags=["x-studio"])


def _multiply_content(post: dict) -> dict:
    """Generate multi-platform adaptations from an X post."""
    text = post.get("content", "")
    thread = post.get("thread_posts", [])
    full_text = text if not thread else " ".join(t.get("text", "") for t in thread)
    topic = post.get("topic_signal", "environmental storytelling")

    return {
        "linkedin_post": {
            "title": f"From the field: {text[:60]}..." if len(text) > 60 else text,
            "body": (
                f"{full_text}\n\n"
                "At Integrity Reforestation, we believe every story from the field deserves a wider audience. "
                "This post captures what we see on the ground every day — the intersection of urgency and hope.\n\n"
                "Follow along for weekly field updates, data, and ground-level perspectives on forest restoration.\n\n"
                "#Reforestation #Conservation #ClimateAction #EnvironmentalLeadership"
            ),
            "word_count": len(full_text.split()) + 60,
            "cta": "Comment with your perspective or tag someone who needs to see this.",
        },
        "instagram_carousel": {
            "slide_count": min(len(thread) + 2, 8) if thread else 5,
            "slides": (
                [f"Cover: {text[:80]}", "Slide 2: Context & data", "Slide 3: Field evidence",
                 "Slide 4: Community impact", "Slide 5: CTA"]
                if not thread
                else [f"Slide {i+1}: {t.get('text','')[:80]}" for i, t in enumerate(thread[:6])]
                + ["Final slide: Follow @IntegrityReforestation"]
            ),
            "caption": f"{text[:200]} 🌱\n\n#Reforestation #Forest #ClimateAction #Conservation",
            "hashtags": ["#Reforestation", "#Forest", "#ClimateAction", "#Conservation", "#TreePlanting"],
        },
        "substack_outline": {
            "title": f"Field Report: {text[:70]}",
            "subtitle": f"On-the-ground perspective about {topic}",
            "intro": f"This week, we're exploring the story behind this post: {text[:150]}",
            "sections": [
                {"section": "The Signal", "description": "What triggered this post and why it matters"},
                {"section": "Field Evidence", "description": "What our teams are seeing on the ground"},
                {"section": "The Data", "description": "Numbers and metrics that support the narrative"},
                {"section": "Community Response", "description": "How local communities are reacting"},
                {"section": "The Bigger Picture", "description": "Connection to global reforestation goals"},
                {"section": "What You Can Do", "description": "Specific actions for readers"},
            ],
            "suggested_length": "800–1200 words",
        },
        "youtube_script": {
            "title": f"Field Update: {text[:60]}",
            "format": "Short (60–90 seconds)",
            "hook": text[:120],
            "beats": [
                {"time": "0:00–0:10", "content": f"Hook: {text[:80]}"},
                {"time": "0:10–0:30", "content": "Context: What's happening on the ground"},
                {"time": "0:30–0:50", "content": "Evidence: Show field footage / data"},
                {"time": "0:50–1:10", "content": "Call to action: Follow / Subscribe / Share"},
            ],
            "cta": "Subscribe for weekly field updates from Integrity Reforestation.",
        },
        "instagram_caption": {
            "caption": f"{text[:200]}\n\n🌱 Follow @IntegrityReforestation for field updates.\n\n#Reforestation #Conservation #ClimateAction #Forest #TreePlanting #Sustainability",
            "hashtag_count": 6,
            "cta": "Double tap if this resonates. Share to spread awareness.",
        },
    }


# ---------------------------------------------------------------------------
# Draft CRUD
# ---------------------------------------------------------------------------

@router.post("/draft", response_model=XPost)
async def create_draft(data: XPostCreate):
    post = store.create_x_post(data.model_dump())
    return post


@router.get("/drafts", response_model=XPostListResponse)
async def list_drafts(
    status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
):
    posts = store.list_x_posts(status=status, limit=limit)
    return {
        "posts": posts,
        "total": len(posts),
        "draft_count":    sum(1 for p in posts if p.get("status") == "draft"),
        "pending_count":  sum(1 for p in posts if p.get("status") == "pending_approval"),
        "scheduled_count":sum(1 for p in posts if p.get("status") == "scheduled"),
        "published_count":sum(1 for p in posts if p.get("status") == "published"),
    }


# analytics/summary must be defined before /{post_id} to prevent path conflict
@router.get("/analytics/summary", response_model=XAnalytics)
async def get_analytics():
    return store.get_x_analytics_summary()


@router.get("/{post_id}", response_model=XPost)
async def get_post(post_id: str):
    post = store.get_x_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.patch("/{post_id}", response_model=XPost)
async def update_post(post_id: str, data: XPostUpdate):
    post = store.update_x_post(post_id, data.model_dump(exclude_none=True))
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.delete("/{post_id}")
async def delete_post(post_id: str):
    ok = store.delete_x_post(post_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"status": "deleted", "post_id": post_id}


# ---------------------------------------------------------------------------
# Workflow
# ---------------------------------------------------------------------------

@router.post("/{post_id}/submit-approval", response_model=XPost)
async def submit_for_approval(post_id: str):
    post = store.get_x_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Update post status
    post = store.update_x_post(post_id, {"status": "pending_approval"})

    # Create a record in the NDE response queue for visibility
    preview = post.get("content", "")[:120]
    store.create_queue_item({
        "topic_id": post_id,
        "topic_title": preview,
        "platform": "x",
        "content_type": post.get("post_type", "single"),
        "content": {
            "post_id": post_id,
            "text": preview,
            "hook_score": post.get("hook_score", 0),
            "estimated_reach": post.get("estimated_reach", 0),
        },
    })

    return post


@router.post("/{post_id}/schedule", response_model=XPost)
async def schedule_post(post_id: str, data: XScheduleRequest):
    post = store.get_x_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post = store.update_x_post(post_id, {
        "status": "scheduled",
        "scheduled_time": data.scheduled_time,
    })
    return post


@router.post("/{post_id}/publish", response_model=XPost)
async def publish_post(post_id: str):
    post = store.get_x_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    live_tweet_id: Optional[str] = None

    # Attempt live posting when X account is connected
    if store.is_x_connected():
        account = store.get_x_account_state()
        access_token = account["access_token"]
        try:
            # Upload any attached media and collect media_ids
            media_ids: list[str] = []
            for m in post.get("media", []):
                asset_id = m.get("asset_id")
                if asset_id:
                    asset = store.get_asset(asset_id)
                    if asset and asset.get("file_path"):
                        media_id = x_api.upload_media_to_x(access_token, asset["file_path"])
                        media_ids.append(media_id)

            if post.get("post_type") == "thread" and post.get("thread_posts"):
                texts   = [t["text"] for t in post["thread_posts"]]
                results = x_api.post_thread(access_token, texts, media_ids=media_ids)
                live_tweet_id = results[0].get("data", {}).get("id") if results else None
            else:
                result        = x_api.post_tweet(access_token, post["content"], media_ids=media_ids)
                live_tweet_id = result.get("data", {}).get("id")
        except Exception as exc:
            raise HTTPException(502, f"X API error: {exc}")

    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"status": "published", "published_time": now}
    if live_tweet_id:
        update["live_tweet_id"] = live_tweet_id

    post = store.update_x_post(post_id, update)
    store.record_x_analytics_event(post_id, post)
    return post


# ---------------------------------------------------------------------------
# Content Multiplication
# ---------------------------------------------------------------------------

@router.post("/{post_id}/multiply", response_model=XMultiplyResult)
async def multiply_post(post_id: str):
    post = store.get_x_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    now = datetime.now(timezone.utc).isoformat()
    result = _multiply_content(post)

    return {
        "source_post_id": post_id,
        **result,
        "generated_at": now,
    }
