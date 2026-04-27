"""
Instagram Integration Routes
=============================
GET  /instagram/auth-url    — return the Facebook OAuth URL for the browser
GET  /instagram/callback    — OAuth callback; exchanges code, stores token, redirects to frontend
GET  /instagram/status      — connection status + account summary
POST /instagram/disconnect  — revoke and clear stored credentials
POST /instagram/sync        — fetch recent posts + insights from the Graph API
GET  /instagram/posts       — cached post performance data
"""

import os
import urllib.parse
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.services import instagram_api as ig
import app.store as store

router = APIRouter(prefix="/instagram", tags=["instagram"])


def _frontend_url(path: str = "/intelligence") -> str:
    base = os.environ.get("FRONTEND_URL", "http://localhost:3001")
    return f"{base.rstrip('/')}{path}"


# ── Auth ─────────────────────────────────────────────────────────────────────

@router.get("/auth-url")
async def get_auth_url():
    """Return the Facebook OAuth URL the user must open in their browser."""
    app_id = ig.get_app_id()
    if not app_id:
        raise HTTPException(
            400,
            "INSTAGRAM_APP_ID not configured. Add it to apps/api/.env and restart.",
        )
    return {"auth_url": ig.get_auth_url()}


@router.get("/callback")
async def oauth_callback(
    code: str = Query(None),
    error: str = Query(None),
    error_reason: str = Query(None),
    error_description: str = Query(None),
    state: str = Query(None),
):
    """
    Facebook redirects here after the user grants (or denies) permission.
    Exchanges the auth code for a token, fetches the linked Instagram account,
    and redirects to the frontend.
    """
    if error:
        msg = error_description or error_reason or error
        return RedirectResponse(
            _frontend_url(f"/intelligence?ig_error={urllib.parse.quote(msg)}")
        )
    if not code:
        return RedirectResponse(_frontend_url("/intelligence?ig_error=no_code"))

    try:
        # 1. Short-lived token
        token_data = ig.exchange_code_for_token(code)
        short_token = token_data.get("access_token")
        if not short_token:
            raise ValueError("No access_token in response")

        # 2. Long-lived token (60 days)
        ll_data = ig.get_long_lived_token(short_token)
        long_token = ll_data.get("access_token", short_token)

        # 3. Resolve Instagram Business account via Facebook Pages
        result = ig.get_user_token_ig_account(long_token)
        if not result:
            raise ValueError(
                "No Instagram Business/Creator account found. "
                "Make sure your account is linked to a Facebook Page in Meta Business Suite."
            )
        page_token, ig_account = result

        # 4. Persist
        store.set_instagram_state({
            "access_token":        page_token,
            "ig_user_id":          ig_account["id"],
            "username":            ig_account.get("username"),
            "account_type":        ig_account.get("account_type"),
            "followers_count":     ig_account.get("followers_count", 0),
            "media_count":         ig_account.get("media_count", 0),
            "profile_picture_url": ig_account.get("profile_picture_url"),
        })

        # 5. Kick off initial sync in background
        import threading
        t = threading.Thread(target=_sync_posts, daemon=True)
        t.start()

        return RedirectResponse(_frontend_url("/intelligence?ig_connected=true"))

    except Exception as exc:
        msg = urllib.parse.quote(str(exc)[:200])
        return RedirectResponse(_frontend_url(f"/intelligence?ig_error={msg}"))


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status():
    """Return current Instagram connection status and account summary."""
    state = store.get_instagram_state()
    connected = store.is_instagram_connected()
    posts = store.get_instagram_posts()

    if not connected:
        return {
            "connected": False,
            "auth_url":  ig.get_auth_url() if ig.get_app_id() else None,
            "configured": bool(ig.get_app_id()),
        }

    # Aggregate post metrics
    total_reach      = sum(p.get("insights", {}).get("reach", 0)      for p in posts)
    total_saves      = sum(p.get("insights", {}).get("saved", 0)       for p in posts)
    total_shares     = sum(p.get("insights", {}).get("shares", 0)      for p in posts)
    total_impressions = sum(p.get("insights", {}).get("impressions", 0) for p in posts)
    avg_engagement   = 0.0
    if posts:
        eng_rates = []
        fc = state.get("followers_count") or 1
        for p in posts:
            likes    = p.get("like_count", 0) or 0
            comments = p.get("comments_count", 0) or 0
            saves    = p.get("insights", {}).get("saved", 0) or 0
            eng_rates.append((likes + comments + saves) / fc * 100)
        avg_engagement = round(sum(eng_rates) / len(eng_rates), 2)

    return {
        "connected":           True,
        "ig_user_id":          state["ig_user_id"],
        "username":            state["username"],
        "account_type":        state["account_type"],
        "followers_count":     state["followers_count"],
        "media_count":         state["media_count"],
        "profile_picture_url": state["profile_picture_url"],
        "last_synced_at":      state["last_synced_at"],
        "post_count":          len(posts),
        "total_reach":         total_reach,
        "total_saves":         total_saves,
        "total_shares":        total_shares,
        "total_impressions":   total_impressions,
        "avg_engagement_rate": avg_engagement,
    }


# ── Sync ─────────────────────────────────────────────────────────────────────

@router.post("/sync")
async def trigger_sync():
    """Fetch the latest posts + insights from Instagram and update the cache."""
    if not store.is_instagram_connected():
        raise HTTPException(400, "Instagram not connected. Visit /instagram/status for the auth URL.")
    try:
        result = _sync_posts()
        return {"synced": result["count"], "errors": result["errors"]}
    except Exception as exc:
        raise HTTPException(500, f"Sync failed: {exc}")


def _sync_posts() -> dict:
    """Blocking sync — safe to call from background thread."""
    state = store.get_instagram_state()
    token = state["access_token"]
    ig_id = state["ig_user_id"]

    posts_raw = ig.get_media(ig_id, token, limit=50)
    enriched = []
    errors = []

    for post in posts_raw:
        media_type = post.get("media_type", "IMAGE")
        insights = {}
        try:
            insights = ig.get_media_insights(post["id"], token, media_type)
        except Exception as e:
            errors.append(f"{post['id']}: {str(e)[:80]}")

        enriched.append({
            **post,
            "insights": insights,
        })

    # Refresh follower count while we're at it
    try:
        result = ig.get_user_token_ig_account(token)
        if result:
            _, ig_account = result
            store.set_instagram_state({
                "followers_count": ig_account.get("followers_count", state["followers_count"]),
                "media_count":     ig_account.get("media_count", state["media_count"]),
            })
    except Exception:
        pass

    store.set_instagram_posts(enriched)
    store.set_instagram_state({"last_synced_at": datetime.now(timezone.utc).isoformat()})

    return {"count": len(enriched), "errors": errors}


# ── Posts ─────────────────────────────────────────────────────────────────────

@router.get("/posts")
async def get_posts(limit: int = Query(50, ge=1, le=100)):
    """Return cached post performance data, newest first."""
    if not store.is_instagram_connected():
        raise HTTPException(400, "Instagram not connected.")
    posts = store.get_instagram_posts()
    posts_sorted = sorted(posts, key=lambda p: p.get("timestamp", ""), reverse=True)
    return {"posts": posts_sorted[:limit], "total": len(posts)}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics():
    """
    Full analytics payload:
    - Account summary
    - Follower growth (30d daily)
    - Account daily metrics (reach, impressions, profile_views)
    - Audience demographics
    - Enriched post list with engagement rate
    - Content type breakdown
    - Top posts by engagement
    - Best hours to post (derived from highest-performing post timestamps)
    """
    if not store.is_instagram_connected():
        raise HTTPException(400, "Instagram not connected.")

    state = store.get_instagram_state()
    token = state["access_token"]
    ig_id = state["ig_user_id"]
    followers = state.get("followers_count") or 1

    posts = store.get_instagram_posts()

    # ── Enrich posts with engagement rate ──
    enriched_posts = []
    for p in posts:
        ins = p.get("insights", {})
        likes = p.get("like_count", 0) or 0
        comments = p.get("comments_count", 0) or 0
        saves = ins.get("saved", 0) or 0
        shares = ins.get("shares", 0) or 0
        reach = ins.get("reach", 0) or 0
        impressions = ins.get("impressions", 0) or 0
        video_views = ins.get("video_views", ins.get("plays", 0)) or 0
        eng = likes + comments + saves + shares
        eng_rate = round(eng / followers * 100, 2) if followers > 0 else 0
        enriched_posts.append({
            **p,
            "engagement": eng,
            "engagement_rate": eng_rate,
            "reach": reach,
            "impressions": impressions,
            "saves": saves,
            "shares": shares,
            "video_views": video_views,
        })

    # Sort by date descending
    enriched_posts.sort(key=lambda p: p.get("timestamp", ""), reverse=True)

    # ── Content type breakdown ──
    type_stats: dict = {}
    for p in enriched_posts:
        mt = p.get("media_type", "IMAGE")
        if mt not in type_stats:
            type_stats[mt] = {"count": 0, "total_reach": 0, "total_engagement": 0, "total_saves": 0}
        type_stats[mt]["count"] += 1
        type_stats[mt]["total_reach"] += p["reach"]
        type_stats[mt]["total_engagement"] += p["engagement"]
        type_stats[mt]["total_saves"] += p["saves"]

    content_mix = []
    for mt, stats in type_stats.items():
        cnt = stats["count"] or 1
        content_mix.append({
            "type": mt,
            "count": stats["count"],
            "avg_reach": round(stats["total_reach"] / cnt),
            "avg_engagement": round(stats["total_engagement"] / cnt, 1),
            "avg_saves": round(stats["total_saves"] / cnt, 1),
        })

    # ── Top posts ──
    top_by_engagement = sorted(enriched_posts, key=lambda p: p["engagement_rate"], reverse=True)[:9]
    top_by_reach = sorted(enriched_posts, key=lambda p: p["reach"], reverse=True)[:9]
    top_by_saves = sorted(enriched_posts, key=lambda p: p["saves"], reverse=True)[:9]

    # ── Best hours to post (from top 20% posts by engagement) ──
    from collections import Counter
    top_20pct = sorted(enriched_posts, key=lambda p: p["engagement_rate"], reverse=True)[:max(1, len(enriched_posts) // 5)]
    hour_counter: Counter = Counter()
    weekday_counter: Counter = Counter()
    for p in top_20pct:
        try:
            from datetime import datetime, timezone
            dt = datetime.fromisoformat(p["timestamp"].replace("Z", "+00:00"))
            hour_counter[dt.hour] += 1
            weekday_counter[dt.strftime("%A")] += 1
        except Exception:
            pass
    best_hours = [h for h, _ in hour_counter.most_common(3)]
    best_days = [d for d, _ in weekday_counter.most_common(3)]

    # ── Aggregate totals ──
    total_reach = sum(p["reach"] for p in enriched_posts)
    total_impressions = sum(p["impressions"] for p in enriched_posts)
    total_saves = sum(p["saves"] for p in enriched_posts)
    total_shares = sum(p["shares"] for p in enriched_posts)
    total_likes = sum(p.get("like_count", 0) or 0 for p in enriched_posts)
    total_comments = sum(p.get("comments_count", 0) or 0 for p in enriched_posts)
    avg_eng_rate = round(sum(p["engagement_rate"] for p in enriched_posts) / len(enriched_posts), 2) if enriched_posts else 0

    # ── Live data from API (follower growth + account daily metrics) ──
    follower_growth = []
    daily_metrics: dict = {}
    audience: dict = {}
    try:
        follower_growth = ig.get_follower_growth(ig_id, token, days=30)
    except Exception:
        pass
    try:
        daily_metrics = ig.get_account_insights_daily(ig_id, token, days=30)
    except Exception:
        pass
    try:
        audience = ig.get_audience_insights(ig_id, token)
    except Exception:
        pass

    return {
        "account": {
            "username": state.get("username"),
            "followers_count": state.get("followers_count"),
            "media_count": state.get("media_count"),
            "profile_picture_url": state.get("profile_picture_url"),
            "last_synced_at": state.get("last_synced_at"),
        },
        "summary": {
            "total_posts": len(enriched_posts),
            "total_reach": total_reach,
            "total_impressions": total_impressions,
            "total_saves": total_saves,
            "total_shares": total_shares,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "avg_engagement_rate": avg_eng_rate,
        },
        "follower_growth": follower_growth,
        "daily_metrics": daily_metrics,
        "audience": audience,
        "content_mix": content_mix,
        "posts": enriched_posts,
        "top_by_engagement": top_by_engagement,
        "top_by_reach": top_by_reach,
        "top_by_saves": top_by_saves,
        "best_hours": best_hours,
        "best_days": best_days,
    }


# ── Disconnect ───────────────────────────────────────────────────────────────

@router.post("/disconnect")
async def disconnect():
    """Clear all stored Instagram credentials and cached data."""
    store.clear_instagram_state()
    store.set_instagram_posts([])
    return {"disconnected": True}
