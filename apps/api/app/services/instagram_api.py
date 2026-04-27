"""
Instagram Graph API Client
===========================
Wraps the Facebook/Instagram Graph API for OAuth, token exchange,
post data fetching, and account insights.

Required Facebook App permissions:
  - instagram_basic              — read media list + basic profile
  - instagram_manage_insights    — read post + account-level insights
  - pages_show_list              — list connected Pages to resolve IG account ID
  - pages_read_engagement        — some insights require this

Environment variables (see .env.example):
  INSTAGRAM_APP_ID
  INSTAGRAM_APP_SECRET
  INSTAGRAM_REDIRECT_URI
"""

import os
import urllib.parse
import urllib.request
import json
from typing import Optional, List, Dict, Tuple

GRAPH_BASE = "https://graph.facebook.com/v19.0"
AUTH_BASE  = "https://www.facebook.com/v19.0/dialog/oauth"

SCOPES = [
    "instagram_basic",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
]


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def get_app_id() -> str:
    return _env("INSTAGRAM_APP_ID")


def get_redirect_uri() -> str:
    return _env("INSTAGRAM_REDIRECT_URI", "http://localhost:4000/instagram/callback")


def get_frontend_url() -> str:
    return _env("FRONTEND_URL", "http://localhost:3001")


def get_auth_url(state: str = "connect") -> str:
    """Build the Facebook OAuth URL the user must visit to grant permission."""
    params = {
        "client_id":     get_app_id(),
        "redirect_uri":  get_redirect_uri(),
        "scope":         ",".join(SCOPES),
        "response_type": "code",
        "state":         state,
    }
    return f"{AUTH_BASE}?{urllib.parse.urlencode(params)}"


def _graph_get(path: str, params: dict) -> dict:
    """Minimal synchronous HTTP GET against the Graph API (no httpx dependency)."""
    url = f"{GRAPH_BASE}/{path.lstrip('/')}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def exchange_code_for_token(code: str) -> dict:
    """Exchange OAuth code for a short-lived access token."""
    params = {
        "client_id":     get_app_id(),
        "client_secret": _env("INSTAGRAM_APP_SECRET"),
        "redirect_uri":  get_redirect_uri(),
        "code":          code,
    }
    return _graph_get("/oauth/access_token", params)


def get_long_lived_token(short_token: str) -> dict:
    """Exchange short-lived user token for a 60-day long-lived token."""
    params = {
        "grant_type":        "fb_exchange_token",
        "client_id":         get_app_id(),
        "client_secret":     _env("INSTAGRAM_APP_SECRET"),
        "fb_exchange_token": short_token,
    }
    return _graph_get("/oauth/access_token", params)


def get_pages(token: str) -> List[dict]:
    """Return all Facebook Pages the user manages (with their tokens)."""
    data = _graph_get("/me/accounts", {"access_token": token, "fields": "id,name,access_token"})
    return data.get("data", [])


def get_instagram_account_for_page(page_id: str, page_token: str) -> Optional[dict]:
    """Return the Instagram Business/Creator account connected to a Facebook Page."""
    data = _graph_get(
        f"/{page_id}",
        {
            "access_token": page_token,
            "fields": "instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url,account_type}",
        },
    )
    iba = data.get("instagram_business_account")
    return iba if iba else None


def get_user_token_ig_account(user_token: str) -> Optional[Tuple[str, dict]]:
    """
    Find the first Instagram Business/Creator account connected to any of
    the user's Facebook Pages. Returns (page_token, ig_account_dict) or None.
    """
    pages = get_pages(user_token)
    for page in pages:
        ig = get_instagram_account_for_page(page["id"], page["access_token"])
        if ig:
            return page["access_token"], ig
    return None


def get_media(ig_user_id: str, token: str, limit: int = 50) -> List[dict]:
    """Return recent posts from the Instagram account."""
    data = _graph_get(
        f"/{ig_user_id}/media",
        {
            "access_token": token,
            "fields": "id,timestamp,media_type,caption,permalink,like_count,comments_count,thumbnail_url,media_url",
            "limit": min(limit, 100),
        },
    )
    return data.get("data", [])


def get_follower_growth(ig_user_id: str, token: str, days: int = 30) -> List[dict]:
    """Return daily follower_count values for the last N days."""
    try:
        data = _graph_get(
            f"/{ig_user_id}/insights",
            {
                "access_token": token,
                "metric": "follower_count",
                "period": "day",
                "since": _days_ago(days),
                "until": _days_ago(0),
            },
        )
        for item in data.get("data", []):
            if item.get("name") == "follower_count":
                return item.get("values", [])
        return []
    except Exception:
        return []


def get_account_insights_daily(ig_user_id: str, token: str, days: int = 30) -> dict:
    """Return daily reach, impressions, and profile_views for the last N days."""
    metrics = "reach,impressions,profile_views,website_clicks,email_contacts"
    result: dict = {}
    try:
        data = _graph_get(
            f"/{ig_user_id}/insights",
            {
                "access_token": token,
                "metric": metrics,
                "period": "day",
                "since": _days_ago(days),
                "until": _days_ago(0),
            },
        )
        for item in data.get("data", []):
            result[item["name"]] = item.get("values", [])
    except Exception:
        pass
    return result


def get_audience_insights(ig_user_id: str, token: str) -> dict:
    """Return audience demographic breakdown (gender/age, country, city)."""
    result: dict = {}
    for metric in ("audience_gender_age", "audience_country", "audience_city"):
        try:
            data = _graph_get(
                f"/{ig_user_id}/insights",
                {
                    "access_token": token,
                    "metric": metric,
                    "period": "lifetime",
                },
            )
            for item in data.get("data", []):
                if item.get("name") == metric:
                    vals = item.get("values", [])
                    if vals:
                        result[metric] = vals[-1].get("value", {})
        except Exception:
            pass
    return result


def get_media_insights(media_id: str, token: str, media_type: str = "IMAGE") -> dict:
    """
    Fetch per-post engagement insights.
    Available metrics vary by media_type:
      IMAGE / CAROUSEL_ALBUM: reach, impressions, saved, profile_visits, follows
      VIDEO (Reel):            reach, impressions, saved, shares, video_views, plays
    """
    if media_type in ("VIDEO",):
        metrics = "reach,impressions,saved,shares,video_views,plays"
    else:
        metrics = "reach,impressions,saved,profile_visits,follows"

    try:
        data = _graph_get(
            f"/{media_id}/insights",
            {"access_token": token, "metric": metrics},
        )
        result = {}
        for item in data.get("data", []):
            result[item["name"]] = item.get("values", [{"value": item.get("value", 0)}])[0]["value"]
        return result
    except Exception:
        return {}


def get_account_insights(ig_user_id: str, token: str) -> dict:
    """Fetch account-level insights for the last 28 days."""
    try:
        data = _graph_get(
            f"/{ig_user_id}/insights",
            {
                "access_token": token,
                "metric":       "reach,impressions,follower_count,profile_views",
                "period":       "day",
                "since":        _days_ago(28),
                "until":        _days_ago(0),
            },
        )
        result: dict = {}
        for item in data.get("data", []):
            values = item.get("values", [])
            total = sum(v.get("value", 0) for v in values)
            result[item["name"]] = total
        return result
    except Exception:
        return {}


def _days_ago(n: int) -> int:
    """Return Unix timestamp for n days ago."""
    import time
    return int(time.time()) - n * 86400
