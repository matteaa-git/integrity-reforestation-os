"""
Pinterest API v5 Client
========================
OAuth 2.0 with PKCE for user-context auth.

Required Pinterest App settings (developers.pinterest.com):
  - OAuth 2.0 enabled
  - Redirect URI must match PINTEREST_REDIRECT_URI

Required scopes:
  boards:read  boards:write  pins:read  pins:write  user_accounts:read

Environment variables (see .env.example):
  PINTEREST_CLIENT_ID
  PINTEREST_CLIENT_SECRET
  PINTEREST_REDIRECT_URI
"""

import base64
import hashlib
import json
import os
import secrets
import urllib.parse
import urllib.request
from typing import Optional

AUTH_BASE = "https://www.pinterest.com/oauth/"
TOKEN_URL = "https://api.pinterest.com/v5/oauth/token"
API_BASE  = "https://api.pinterest.com/v5"

SCOPES = "boards:read boards:write pins:read pins:write user_accounts:read"


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def get_client_id() -> str:
    return _env("PINTEREST_CLIENT_ID")


def get_redirect_uri() -> str:
    return _env("PINTEREST_REDIRECT_URI", "http://localhost:4000/pinterest/account/callback")


def generate_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) using S256."""
    code_verifier  = secrets.token_urlsafe(64)[:128]
    digest         = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return code_verifier, code_challenge


def get_auth_url(state: str, code_challenge: str) -> str:
    params = {
        "client_id":             get_client_id(),
        "redirect_uri":          get_redirect_uri(),
        "response_type":         "code",
        "scope":                 SCOPES,
        "state":                 state,
        "code_challenge":        code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{AUTH_BASE}?{urllib.parse.urlencode(params)}"


def _basic_auth_header() -> str:
    creds = f"{_env('PINTEREST_CLIENT_ID')}:{_env('PINTEREST_CLIENT_SECRET')}"
    return base64.b64encode(creds.encode()).decode()


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
    data = urllib.parse.urlencode({
        "grant_type":    "refresh_token",
        "refresh_token": refresh_token,
        "scope":         SCOPES,
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


def get_user_account(access_token: str) -> dict:
    """Fetch authenticated user profile."""
    return _api_get("user_account", access_token)


def get_boards(access_token: str, page_size: int = 25) -> dict:
    """List all boards for the authenticated user."""
    return _api_get("boards", access_token, {"page_size": page_size})


def get_pins(access_token: str, page_size: int = 25) -> dict:
    """List recent pins for the authenticated user."""
    return _api_get("pins", access_token, {"page_size": page_size})


def create_pin(access_token: str, board_id: str, title: str, description: str,
               link: str, media_source_url: str) -> dict:
    """Create a standard pin on a board."""
    body: dict = {
        "board_id":    board_id,
        "title":       title,
        "description": description,
        "link":        link,
        "media_source": {
            "source_type": "image_url",
            "url":         media_source_url,
        },
    }
    return _api_post("pins", access_token, body)
