"""
LinkedIn Account Integration Routes
======================================
GET  /linkedin/account/auth-url    — return OAuth 2.0 URL
GET  /linkedin/account/callback    — exchange code, store credentials
GET  /linkedin/account/status      — connection status + analytics summary
POST /linkedin/account/disconnect  — clear credentials
POST /linkedin/account/sync        — refresh profile metrics
"""

import os
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.services import linkedin_api
import app.store as store

router = APIRouter(prefix="/linkedin/account", tags=["linkedin-account"])

_state_store: dict[str, str] = {}   # state -> "pending" (no PKCE needed for LinkedIn)


def _frontend_url(path: str = "/linkedin/account") -> str:
    base = os.environ.get("FRONTEND_URL", "http://localhost:3001")
    return f"{base.rstrip('/')}{path}"


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.get("/auth-url")
async def get_auth_url():
    if not linkedin_api.get_client_id():
        raise HTTPException(
            400,
            "LINKEDIN_CLIENT_ID not configured. Add it to apps/api/.env and restart.",
        )
    state             = secrets.token_urlsafe(16)
    _state_store[state] = "pending"
    return {"auth_url": linkedin_api.get_auth_url(state)}


@router.get("/callback")
async def oauth_callback(
    code:  str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
):
    if error:
        desc = (error_description or error)[:120].replace(" ", "+")
        return RedirectResponse(_frontend_url(f"?li_error={desc}"))
    if not code or not state:
        return RedirectResponse(_frontend_url("?li_error=missing_params"))
    if state not in _state_store:
        return RedirectResponse(_frontend_url("?li_error=invalid_state"))

    _state_store.pop(state)

    try:
        token_data   = linkedin_api.exchange_code_for_token(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("No access_token in LinkedIn response")

        profile = linkedin_api.get_user_profile(access_token)

        # LinkedIn OpenID userinfo fields
        person_urn = f"urn:li:person:{profile.get('sub')}"

        store.set_linkedin_account_state({
            "access_token":   access_token,
            "person_urn":     person_urn,
            "sub":            profile.get("sub"),
            "name":           profile.get("name"),
            "given_name":     profile.get("given_name"),
            "family_name":    profile.get("family_name"),
            "email":          profile.get("email"),
            "picture":        profile.get("picture"),
            "headline":       profile.get("headline", ""),
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        })

        return RedirectResponse(_frontend_url("?li_connected=1"))

    except Exception as exc:
        err = str(exc)[:120].replace(" ", "+")
        return RedirectResponse(_frontend_url(f"?li_error={err}"))


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status():
    connected = store.is_linkedin_account_connected()
    if not connected:
        return {
            "connected":  False,
            "configured": bool(linkedin_api.get_client_id()),
        }

    state = store.get_linkedin_account_state()
    posts = store.list_linkedin_posts(status="published", limit=200)

    total_impressions = sum(p.get("estimated_reach", 0) for p in posts)
    total_reactions   = 0
    total_shares      = 0

    try:
        summary = store.get_linkedin_analytics_summary()
        total_impressions = summary.get("total_impressions", total_impressions)
        total_reactions   = summary.get("total_reactions", 0)
        total_shares      = summary.get("total_shares", 0)
    except Exception:
        pass

    return {
        "connected":        True,
        "person_urn":       state.get("person_urn"),
        "name":             state.get("name"),
        "given_name":       state.get("given_name"),
        "email":            state.get("email"),
        "picture":          state.get("picture"),
        "headline":         state.get("headline"),
        "last_synced_at":   state.get("last_synced_at"),
        "published_posts":  len(posts),
        "total_impressions": total_impressions,
        "total_reactions":  total_reactions,
        "total_shares":     total_shares,
        "avg_thought_leadership_score": (
            round(sum(p.get("thought_leadership_score", 0) for p in posts) / len(posts), 1)
            if posts else 0.0
        ),
    }


# ── Disconnect ────────────────────────────────────────────────────────────────

@router.post("/disconnect")
async def disconnect():
    store.clear_linkedin_account_state()
    return {"status": "disconnected"}


# ── Sync ──────────────────────────────────────────────────────────────────────

@router.post("/sync")
async def sync():
    if not store.is_linkedin_account_connected():
        raise HTTPException(400, "LinkedIn account not connected")

    state        = store.get_linkedin_account_state()
    access_token = state["access_token"]
    errors: list[str] = []

    try:
        profile = linkedin_api.get_user_profile(access_token)
        store.set_linkedin_account_state({
            "name":           profile.get("name"),
            "headline":       profile.get("headline", ""),
            "picture":        profile.get("picture"),
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        errors.append(f"profile: {exc}")

    return {"synced": True, "errors": errors}
