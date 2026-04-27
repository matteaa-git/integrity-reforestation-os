"""
LinkedIn API Client
====================
OAuth 2.0 (Authorization Code) for user-context auth.

Required LinkedIn App settings (developer.linkedin.com):
  - Products: "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn"
  - Redirect URL must match LINKEDIN_REDIRECT_URI

Required scopes:
  openid  profile  email  w_member_social

Environment variables (see .env.example):
  LINKEDIN_CLIENT_ID
  LINKEDIN_CLIENT_SECRET
  LINKEDIN_REDIRECT_URI
"""

import base64
import json
import os
import urllib.parse
import urllib.request
from typing import Optional

AUTH_BASE = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
API_BASE  = "https://api.linkedin.com/v2"

SCOPES = "openid profile email w_member_social"


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def get_client_id() -> str:
    return _env("LINKEDIN_CLIENT_ID")


def get_redirect_uri() -> str:
    return _env("LINKEDIN_REDIRECT_URI", "http://localhost:4000/linkedin/account/callback")


def get_auth_url(state: str) -> str:
    params = {
        "response_type": "code",
        "client_id":     get_client_id(),
        "redirect_uri":  get_redirect_uri(),
        "state":         state,
        "scope":         SCOPES,
    }
    return f"{AUTH_BASE}?{urllib.parse.urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    """Exchange authorization code for access token."""
    data = urllib.parse.urlencode({
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  get_redirect_uri(),
        "client_id":     _env("LINKEDIN_CLIENT_ID"),
        "client_secret": _env("LINKEDIN_CLIENT_SECRET"),
    }).encode()
    req = urllib.request.Request(
        TOKEN_URL, data=data, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _api_get(path: str, access_token: str, params: Optional[dict] = None) -> dict:
    url = f"{API_BASE}/{path.lstrip('/')}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept":        "application/json",
            "LinkedIn-Version": "202401",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _api_post(path: str, access_token: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req  = urllib.request.Request(
        f"{API_BASE}/{path.lstrip('/')}",
        data=data, method="POST",
        headers={
            "Authorization":    f"Bearer {access_token}",
            "Content-Type":     "application/json",
            "Accept":           "application/json",
            "LinkedIn-Version": "202401",
            "X-Restli-Protocol-Version": "2.0.0",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def get_user_profile(access_token: str) -> dict:
    """Fetch authenticated user via OpenID Connect userinfo endpoint."""
    req = urllib.request.Request(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def post_text_share(access_token: str, person_urn: str, text: str,
                    visibility: str = "PUBLIC") -> dict:
    """Create a text post (UGC Post) on behalf of the user."""
    body = {
        "author":          person_urn,
        "lifecycleState":  "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": visibility,
        },
    }
    return _api_post("ugcPosts", access_token, body)


def get_share_statistics(access_token: str, person_urn: str) -> dict:
    """Fetch share statistics for the user's recent posts."""
    encoded_urn = urllib.parse.quote(person_urn, safe="")
    return _api_get(
        f"socialMetadata/{encoded_urn}",
        access_token,
    )
