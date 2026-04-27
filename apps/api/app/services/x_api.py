"""
X (Twitter) API v2 Client
==========================
OAuth 2.0 with PKCE for user-context auth.

Required X App settings (developer.twitter.com):
  - OAuth 2.0 enabled
  - Type: Web App (confidential client with client_secret)
  - Callback URL must match X_REDIRECT_URI

Required scopes:
  tweet.read  tweet.write  users.read  offline.access

Environment variables (see .env.example):
  X_CLIENT_ID
  X_CLIENT_SECRET
  X_REDIRECT_URI
"""

import base64
import hashlib
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
from typing import Optional

import httpx

AUTH_BASE = "https://twitter.com/i/oauth2/authorize"
TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
API_BASE  = "https://api.twitter.com/2"

SCOPES = "tweet.read tweet.write users.read offline.access"


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def get_client_id() -> str:
    return _env("X_CLIENT_ID")


def get_redirect_uri() -> str:
    return _env("X_REDIRECT_URI", "http://localhost:4000/x/account/callback")


def generate_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) using S256 method."""
    code_verifier = secrets.token_urlsafe(64)[:128]
    digest        = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


def get_auth_url(state: str, code_challenge: str) -> str:
    params = {
        "response_type":         "code",
        "client_id":             get_client_id(),
        "redirect_uri":          get_redirect_uri(),
        "scope":                 SCOPES,
        "state":                 state,
        "code_challenge":        code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{AUTH_BASE}?{urllib.parse.urlencode(params)}"


def _basic_auth_header() -> str:
    client_id     = _env("X_CLIENT_ID")
    client_secret = _env("X_CLIENT_SECRET")
    return base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()


def exchange_code_for_token(code: str, code_verifier: str) -> dict:
    """Exchange authorization code + PKCE verifier for tokens."""
    data = urllib.parse.urlencode({
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  get_redirect_uri(),
        "code_verifier": code_verifier,
    }).encode()
    req = urllib.request.Request(
        TOKEN_URL, data=data, method="POST",
        headers={
            "Authorization": f"Basic {_basic_auth_header()}",
            "Content-Type":  "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def refresh_access_token(refresh_token: str) -> dict:
    """Use refresh_token to obtain a new access_token."""
    data = urllib.parse.urlencode({
        "grant_type":    "refresh_token",
        "refresh_token": refresh_token,
    }).encode()
    req = urllib.request.Request(
        TOKEN_URL, data=data, method="POST",
        headers={
            "Authorization": f"Basic {_basic_auth_header()}",
            "Content-Type":  "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _api_get(path: str, access_token: str, params: Optional[dict] = None) -> dict:
    url = f"{API_BASE}/{path.lstrip('/')}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _api_post(path: str, access_token: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req  = urllib.request.Request(
        f"{API_BASE}/{path.lstrip('/')}",
        data=data, method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def get_user_info(access_token: str) -> dict:
    """Fetch authenticated user profile with public metrics."""
    return _api_get(
        "users/me",
        access_token,
        {"user.fields": "public_metrics,profile_image_url,description,verified"},
    )


def post_tweet(access_token: str, text: str, media_ids: Optional[list[str]] = None) -> dict:
    """Create a single tweet. Returns API v2 response."""
    body: dict = {"text": text}
    if media_ids:
        body["media"] = {"media_ids": media_ids}
    return _api_post("tweets", access_token, body)


def post_thread(access_token: str, texts: list[str], media_ids: Optional[list[str]] = None) -> list[dict]:
    """Create a thread by chaining reply_to_tweet_id on each subsequent tweet.
    Media is attached to the first tweet only."""
    results: list[dict] = []
    reply_to: Optional[str] = None
    for i, text in enumerate(texts):
        body: dict = {"text": text}
        if reply_to:
            body["reply"] = {"in_reply_to_tweet_id": reply_to}
        if i == 0 and media_ids:
            body["media"] = {"media_ids": media_ids}
        result = _api_post("tweets", access_token, body)
        reply_to = result.get("data", {}).get("id")
        results.append(result)
    return results


def get_tweet_metrics(access_token: str, tweet_id: str) -> dict:
    """Fetch public engagement metrics for a single tweet."""
    return _api_get(
        f"tweets/{tweet_id}",
        access_token,
        {"tweet.fields": "public_metrics,created_at"},
    )


def get_user_tweets(access_token: str, user_id: str, max_results: int = 20) -> dict:
    """Fetch recent tweets with engagement metrics for a user."""
    return _api_get(
        f"users/{user_id}/tweets",
        access_token,
        {
            "tweet.fields": "public_metrics,created_at",
            "max_results":  max(5, min(max_results, 100)),
        },
    )


# ── Media upload ──────────────────────────────────────────────────────────────

UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json"

_MIME_MAP = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
    ".mp4": "video/mp4", ".mov": "video/quicktime",
}

_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".m4v"}


def _mime_type(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    return _MIME_MAP.get(ext, "image/jpeg")


def upload_media_to_x(access_token: str, file_path: str) -> str:
    """
    Upload a local image or video to X and return the media_id_string.
    Images use simple upload; videos use chunked INIT/APPEND/FINALIZE.
    """
    ext = os.path.splitext(file_path)[1].lower()
    mime = _mime_type(file_path)
    headers = {"Authorization": f"Bearer {access_token}"}

    if ext in _VIDEO_EXTS:
        return _chunked_upload(access_token, file_path, mime, headers)

    # Simple image upload
    with open(file_path, "rb") as f:
        data = f.read()
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            UPLOAD_URL,
            headers=headers,
            files={"media": (os.path.basename(file_path), data, mime)},
        )
    resp.raise_for_status()
    return resp.json()["media_id_string"]


def _chunked_upload(access_token: str, file_path: str, mime: str, headers: dict) -> str:
    """INIT → APPEND → FINALIZE chunked upload for video."""
    file_size = os.path.getsize(file_path)

    with httpx.Client(timeout=120) as client:
        # INIT
        init_resp = client.post(
            UPLOAD_URL,
            headers=headers,
            data={
                "command": "INIT",
                "media_type": mime,
                "total_bytes": str(file_size),
                "media_category": "tweet_video",
            },
        )
        init_resp.raise_for_status()
        media_id = init_resp.json()["media_id_string"]

        # APPEND in 5 MB chunks
        chunk_size = 5 * 1024 * 1024
        segment = 0
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                client.post(
                    UPLOAD_URL,
                    headers=headers,
                    files={"media": chunk},
                    data={"command": "APPEND", "media_id": media_id, "segment_index": str(segment)},
                )
                segment += 1

        # FINALIZE
        fin_resp = client.post(
            UPLOAD_URL,
            headers=headers,
            data={"command": "FINALIZE", "media_id": media_id},
        )
        fin_resp.raise_for_status()
        processing = fin_resp.json().get("processing_info")

        # Poll until ready
        while processing and processing.get("state") not in ("succeeded", "failed"):
            wait = processing.get("check_after_secs", 2)
            time.sleep(wait)
            status_resp = client.get(
                UPLOAD_URL,
                headers=headers,
                params={"command": "STATUS", "media_id": media_id},
            )
            processing = status_resp.json().get("processing_info")

        if processing and processing.get("state") == "failed":
            raise ValueError(f"X media processing failed: {processing.get('error', {})}")

    return media_id
