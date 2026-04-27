"""
Pinterest Account Integration Routes
======================================
GET  /pinterest/account/auth-url    — return OAuth 2.0 PKCE URL
GET  /pinterest/account/callback    — exchange code, store credentials
GET  /pinterest/account/status      — connection status + analytics summary
POST /pinterest/account/disconnect  — clear credentials
POST /pinterest/account/sync        — pull profile, boards, recent pin metrics
GET  /pinterest/account/boards      — cached board list
GET  /pinterest/account/pins        — cached pin performance list
"""

import os
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.services import pinterest_api
import app.store as store

router = APIRouter(prefix="/pinterest/account", tags=["pinterest-account"])

_pkce_store: dict[str, str] = {}


def _frontend_url(path: str = "/pinterest/account") -> str:
    base = os.environ.get("FRONTEND_URL", "http://localhost:3001")
    return f"{base.rstrip('/')}{path}"


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.get("/auth-url")
async def get_auth_url():
    if not pinterest_api.get_client_id():
        raise HTTPException(
            400,
            "PINTEREST_CLIENT_ID not configured. Add it to apps/api/.env and restart.",
        )
    state                      = secrets.token_urlsafe(16)
    code_verifier, code_challenge = pinterest_api.generate_pkce_pair()
    _pkce_store[state]         = code_verifier
    return {"auth_url": pinterest_api.get_auth_url(state, code_challenge)}


@router.get("/callback")
async def oauth_callback(
    code:  str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    if error:
        return RedirectResponse(_frontend_url(f"?p_error={error}"))
    if not code or not state:
        return RedirectResponse(_frontend_url("?p_error=missing_params"))

    code_verifier = _pkce_store.pop(state, None)
    if not code_verifier:
        return RedirectResponse(_frontend_url("?p_error=invalid_state"))

    try:
        token_data    = pinterest_api.exchange_code_for_token(code, code_verifier)
        access_token  = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        if not access_token:
            raise ValueError("No access_token in Pinterest token response")

        user = pinterest_api.get_user_account(access_token)

        store.set_pinterest_account_state({
            "access_token":      access_token,
            "refresh_token":     refresh_token,
            "pinterest_user_id": user.get("id"),
            "username":          user.get("username"),
            "account_type":      user.get("account_type", "PERSONAL"),
            "profile_image":     user.get("profile_image"),
            "website_url":       user.get("website_url"),
            "follower_count":    user.get("follower_count", 0),
            "following_count":   user.get("following_count", 0),
            "monthly_views":     user.get("monthly_views", 0),
            "last_synced_at":    datetime.now(timezone.utc).isoformat(),
        })

        return RedirectResponse(_frontend_url("?p_connected=1"))

    except Exception as exc:
        err = str(exc)[:120].replace(" ", "+")
        return RedirectResponse(_frontend_url(f"?p_error={err}"))


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status():
    connected = store.is_pinterest_connected()
    if not connected:
        return {
            "connected":  False,
            "configured": bool(pinterest_api.get_client_id()),
        }

    state  = store.get_pinterest_account_state()
    pins   = store.get_pinterest_cached_pins()
    boards = store.get_pinterest_cached_boards()

    total_impressions = sum(p.get("impression_count", 0) for p in pins)
    total_saves       = sum(p.get("save_count", 0)       for p in pins)
    total_clicks      = sum(p.get("outbound_clicks", 0)  for p in pins)

    return {
        "connected":          True,
        "pinterest_user_id":  state.get("pinterest_user_id"),
        "username":           state.get("username"),
        "account_type":       state.get("account_type"),
        "profile_image":      state.get("profile_image"),
        "website_url":        state.get("website_url"),
        "follower_count":     state.get("follower_count", 0),
        "following_count":    state.get("following_count", 0),
        "monthly_views":      state.get("monthly_views", 0),
        "last_synced_at":     state.get("last_synced_at"),
        "board_count":        len(boards),
        "pin_count":          len(pins),
        "total_impressions":  total_impressions,
        "total_saves":        total_saves,
        "total_clicks":       total_clicks,
        "avg_save_rate": (
            round(total_saves / total_impressions * 100, 2)
            if total_impressions else 0.0
        ),
    }


# ── Disconnect ────────────────────────────────────────────────────────────────

@router.post("/disconnect")
async def disconnect():
    store.clear_pinterest_account_state()
    return {"status": "disconnected"}


# ── Sync ──────────────────────────────────────────────────────────────────────

@router.post("/sync")
async def sync():
    if not store.is_pinterest_connected():
        raise HTTPException(400, "Pinterest account not connected")

    state        = store.get_pinterest_account_state()
    access_token = state["access_token"]
    errors: list[str] = []

    # Refresh user profile
    try:
        user = pinterest_api.get_user_account(access_token)
        store.set_pinterest_account_state({
            "follower_count":  user.get("follower_count", 0),
            "following_count": user.get("following_count", 0),
            "monthly_views":   user.get("monthly_views", 0),
            "last_synced_at":  datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        errors.append(f"profile: {exc}")

    # Fetch boards
    boards: list[dict] = []
    try:
        resp = pinterest_api.get_boards(access_token)
        for b in resp.get("items", []):
            boards.append({
                "board_id":    b["id"],
                "name":        b["name"],
                "description": b.get("description", ""),
                "privacy":     b.get("privacy", "PUBLIC"),
                "pin_count":   b.get("pin_count", 0),
                "follower_count": b.get("follower_count", 0),
            })
        store.set_pinterest_cached_boards(boards)
    except Exception as exc:
        errors.append(f"boards: {exc}")

    # Fetch recent pins with metrics
    pins: list[dict] = []
    try:
        resp = pinterest_api.get_pins(access_token)
        for p in resp.get("items", []):
            m = p.get("pin_metrics", {}).get("lifetime_metrics", {})
            pins.append({
                "pin_id":          p["id"],
                "title":           p.get("title", ""),
                "description":     p.get("description", ""),
                "board_id":        p.get("board_id", ""),
                "created_at":      p.get("created_at"),
                "impression_count": m.get("impression", 0),
                "save_count":       m.get("save", 0),
                "outbound_clicks":  m.get("outbound_click", 0),
                "pin_click":        m.get("pin_click", 0),
            })
        store.set_pinterest_cached_pins(pins)
    except Exception as exc:
        errors.append(f"pins: {exc}")

    return {
        "synced_boards": len(boards),
        "synced_pins":   len(pins),
        "errors":        errors,
    }


# ── Boards + Pins ─────────────────────────────────────────────────────────────

@router.get("/boards")
async def get_boards():
    return {"boards": store.get_pinterest_cached_boards()}


@router.get("/pins")
async def get_pins(limit: int = Query(default=25, ge=1, le=100)):
    pins = store.get_pinterest_cached_pins()
    return {"pins": pins[:limit], "total": len(pins)}
