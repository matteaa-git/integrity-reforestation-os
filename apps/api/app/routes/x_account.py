"""
X Account Integration Routes
==============================
GET  /x/account/auth-url    — return OAuth 2.0 PKCE URL for the browser
GET  /x/account/callback    — exchange code for token, store credentials
GET  /x/account/status      — connection status + account + analytics summary
POST /x/account/disconnect  — clear stored credentials
POST /x/account/sync        — pull latest profile metrics + recent tweet analytics
GET  /x/account/posts       — cached tweet performance list
"""

import os
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.services import x_api
import app.store as store

router = APIRouter(prefix="/x/account", tags=["x-account"])

# Short-lived PKCE verifier store keyed by OAuth state param.
# Replace with Redis/DB for multi-instance deployments.
_pkce_store: dict[str, str] = {}


def _frontend_url(path: str = "/x-studio/account") -> str:
    base = os.environ.get("FRONTEND_URL", "http://localhost:3001")
    return f"{base.rstrip('/')}{path}"


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.get("/auth-url")
async def get_auth_url():
    """Return the X OAuth 2.0 PKCE URL the user must open in their browser."""
    if not x_api.get_client_id():
        raise HTTPException(
            400,
            "X_CLIENT_ID not configured. Add X_CLIENT_ID and X_CLIENT_SECRET "
            "to apps/api/.env and restart.",
        )
    state          = secrets.token_urlsafe(16)
    code_verifier, code_challenge = x_api.generate_pkce_pair()
    _pkce_store[state] = code_verifier
    return {"auth_url": x_api.get_auth_url(state, code_challenge)}


@router.get("/callback")
async def oauth_callback(
    code:  str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    """
    X redirects here after the user grants (or denies) permission.
    Exchanges the auth code + PKCE verifier for tokens, fetches profile,
    and redirects back to the frontend.
    """
    if error:
        return RedirectResponse(_frontend_url(f"?x_error={error}"))
    if not code or not state:
        return RedirectResponse(_frontend_url("?x_error=missing_params"))

    code_verifier = _pkce_store.pop(state, None)
    if not code_verifier:
        return RedirectResponse(_frontend_url("?x_error=invalid_state"))

    try:
        token_data    = x_api.exchange_code_for_token(code, code_verifier)
        access_token  = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        if not access_token:
            raise ValueError("No access_token in X token response")

        user_resp = x_api.get_user_info(access_token)
        user      = user_resp.get("data", {})
        metrics   = user.get("public_metrics", {})

        store.set_x_account_state({
            "access_token":      access_token,
            "refresh_token":     refresh_token,
            "x_user_id":         user.get("id"),
            "username":          user.get("username"),
            "name":              user.get("name"),
            "profile_image_url": user.get("profile_image_url"),
            "followers_count":   metrics.get("followers_count", 0),
            "following_count":   metrics.get("following_count", 0),
            "tweet_count":       metrics.get("tweet_count", 0),
            "last_synced_at":    datetime.now(timezone.utc).isoformat(),
        })

        return RedirectResponse(_frontend_url("?x_connected=1"))

    except Exception as exc:
        err = str(exc)[:120].replace(" ", "+")
        return RedirectResponse(_frontend_url(f"?x_error={err}"))


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status():
    """Return connection status, account info, and aggregate analytics."""
    connected = store.is_x_connected()
    if not connected:
        return {
            "connected":  False,
            "configured": bool(x_api.get_client_id()),
        }

    state = store.get_x_account_state()
    posts = store.get_x_cached_posts()

    total_impressions = sum(p.get("impressions", 0)  for p in posts)
    total_engagements = sum(p.get("engagements", 0)  for p in posts)
    total_reposts     = sum(p.get("repost_count", 0) for p in posts)

    return {
        "connected":          True,
        "x_user_id":          state.get("x_user_id"),
        "username":           state.get("username"),
        "name":               state.get("name"),
        "profile_image_url":  state.get("profile_image_url"),
        "followers_count":    state.get("followers_count", 0),
        "following_count":    state.get("following_count", 0),
        "tweet_count":        state.get("tweet_count", 0),
        "last_synced_at":     state.get("last_synced_at"),
        "post_count":         len(posts),
        "total_impressions":  total_impressions,
        "total_engagements":  total_engagements,
        "total_reposts":      total_reposts,
        "avg_engagement_rate": (
            round(total_engagements / total_impressions * 100, 2)
            if total_impressions else 0.0
        ),
    }


# ── Disconnect ────────────────────────────────────────────────────────────────

@router.post("/disconnect")
async def disconnect():
    store.clear_x_account_state()
    return {"status": "disconnected"}


# ── Sync ──────────────────────────────────────────────────────────────────────

@router.post("/sync")
async def sync():
    """Refresh profile metrics and pull recent tweet analytics from X API."""
    if not store.is_x_connected():
        raise HTTPException(400, "X account not connected")

    state        = store.get_x_account_state()
    access_token = state["access_token"]
    user_id      = state["x_user_id"]

    errors: list[str] = []

    try:
        user_resp = x_api.get_user_info(access_token)
        user      = user_resp.get("data", {})
        metrics   = user.get("public_metrics", {})
        store.set_x_account_state({
            "followers_count": metrics.get("followers_count", 0),
            "following_count": metrics.get("following_count", 0),
            "tweet_count":     metrics.get("tweet_count", 0),
            "last_synced_at":  datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        errors.append(f"profile_refresh: {exc}")

    posts: list[dict] = []
    try:
        tweets_resp = x_api.get_user_tweets(access_token, user_id, max_results=20)
        for tw in tweets_resp.get("data", []):
            pm = tw.get("public_metrics", {})
            posts.append({
                "tweet_id":     tw["id"],
                "text":         tw.get("text", ""),
                "created_at":   tw.get("created_at"),
                "impressions":  pm.get("impression_count", 0),
                "likes":        pm.get("like_count", 0),
                "repost_count": pm.get("retweet_count", 0),
                "replies":      pm.get("reply_count", 0),
                "engagements":  (
                    pm.get("like_count", 0)
                    + pm.get("retweet_count", 0)
                    + pm.get("reply_count", 0)
                    + pm.get("quote_count", 0)
                ),
            })
        store.set_x_cached_posts(posts)
    except Exception as exc:
        errors.append(f"tweets_fetch: {exc}")

    return {"synced": len(posts), "errors": errors}


# ── Posts ─────────────────────────────────────────────────────────────────────

@router.get("/posts")
async def get_posts(limit: int = Query(default=20, ge=1, le=100)):
    posts = store.get_x_cached_posts()
    return {"posts": posts[:limit], "total": len(posts)}
