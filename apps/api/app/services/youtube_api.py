"""
YouTube Data API v3 Client
============================
Wraps Google OAuth 2.0 and YouTube Data API v3 for channel connection,
token exchange, channel stats, and recent video performance.

Required Google Cloud project scopes:
  - https://www.googleapis.com/auth/youtube.readonly
  - https://www.googleapis.com/auth/yt-analytics.readonly

Environment variables (see .env.example):
  YOUTUBE_CLIENT_ID
  YOUTUBE_CLIENT_SECRET
  YOUTUBE_REDIRECT_URI   (default: http://localhost:4000/youtube/callback)
"""

import os
import json
import urllib.parse
import urllib.request
from typing import Optional, Dict, Any

GOOGLE_AUTH_BASE  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token"
YT_API_BASE       = "https://www.googleapis.com/youtube/v3"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
    "openid",
    "email",
    "profile",
]


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def get_client_id() -> str:
    return _env("YOUTUBE_CLIENT_ID")


def get_client_secret() -> str:
    return _env("YOUTUBE_CLIENT_SECRET")


def get_redirect_uri() -> str:
    return _env("YOUTUBE_REDIRECT_URI", "http://localhost:4000/youtube/callback")


def is_configured() -> bool:
    return bool(get_client_id() and get_client_secret())


def get_auth_url(state: str = "") -> str:
    params = {
        "client_id":     get_client_id(),
        "redirect_uri":  get_redirect_uri(),
        "response_type": "code",
        "scope":         " ".join(SCOPES),
        "access_type":   "offline",
        "prompt":        "consent",  # force refresh_token on every auth
        "state":         state,
    }
    return f"{GOOGLE_AUTH_BASE}?{urllib.parse.urlencode(params)}"


def exchange_code_for_token(code: str) -> Dict[str, Any]:
    """Exchange auth code for access + refresh tokens."""
    payload = urllib.parse.urlencode({
        "code":          code,
        "client_id":     get_client_id(),
        "client_secret": get_client_secret(),
        "redirect_uri":  get_redirect_uri(),
        "grant_type":    "authorization_code",
    }).encode()

    req = urllib.request.Request(GOOGLE_TOKEN_URL, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    """Use a stored refresh token to obtain a new access token."""
    payload = urllib.parse.urlencode({
        "client_id":     get_client_id(),
        "client_secret": get_client_secret(),
        "refresh_token": refresh_token,
        "grant_type":    "refresh_token",
    }).encode()

    req = urllib.request.Request(GOOGLE_TOKEN_URL, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def _yt_get(path: str, access_token: str, params: Optional[Dict] = None) -> Dict[str, Any]:
    """Authenticated GET to YouTube Data API v3."""
    query = urllib.parse.urlencode(params or {})
    url   = f"{YT_API_BASE}/{path}?{query}"
    req   = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {access_token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def get_channel_info(access_token: str) -> Dict[str, Any]:
    """Fetch the authenticated user's YouTube channel (snippet + statistics)."""
    data = _yt_get("channels", access_token, {
        "part": "snippet,statistics,brandingSettings",
        "mine": "true",
    })
    items = data.get("items", [])
    if not items:
        raise ValueError("No YouTube channel found for this Google account.")
    return items[0]


def get_recent_videos(access_token: str, channel_id: str, max_results: int = 25) -> list:
    """Return recent uploads from the channel with view/like/comment stats."""
    # Step 1: get video IDs via search
    search_data = _yt_get("search", access_token, {
        "part":       "snippet",
        "channelId":  channel_id,
        "type":       "video",
        "order":      "date",
        "maxResults": str(max_results),
    })

    video_ids = [
        item["id"]["videoId"]
        for item in search_data.get("items", [])
        if item.get("id", {}).get("videoId")
    ]

    if not video_ids:
        return []

    # Step 2: fetch statistics for those IDs
    stats_data = _yt_get("videos", access_token, {
        "part": "snippet,statistics,contentDetails",
        "id":   ",".join(video_ids),
    })

    videos = []
    for item in stats_data.get("items", []):
        snippet = item.get("snippet", {})
        stats   = item.get("statistics", {})
        cd      = item.get("contentDetails", {})
        videos.append({
            "video_id":      item["id"],
            "title":         snippet.get("title", ""),
            "description":   (snippet.get("description") or "")[:200],
            "published_at":  snippet.get("publishedAt"),
            "thumbnail_url": (snippet.get("thumbnails", {}).get("medium") or {}).get("url"),
            "duration":      cd.get("duration", ""),
            "view_count":    int(stats.get("viewCount", 0) or 0),
            "like_count":    int(stats.get("likeCount", 0) or 0),
            "comment_count": int(stats.get("commentCount", 0) or 0),
            "favorite_count":int(stats.get("favoriteCount", 0) or 0),
        })

    return videos
