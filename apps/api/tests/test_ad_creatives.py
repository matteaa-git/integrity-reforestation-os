"""Tests for ad creative CRUD and variant creation."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import store


@pytest.fixture(autouse=True)
def _reset_store():
    store.clear_all()
    yield
    store.clear_all()


client = TestClient(app)


def _create_asset() -> str:
    r = client.post("/assets", json={
        "path": "/tmp/test.jpg", "filename": "test.jpg",
        "media_type": "image", "file_size": 100,
    })
    return r.json()["id"]


def _create_draft_with_asset() -> str:
    asset_id = _create_asset()
    r = client.post("/drafts", json={"title": "Test Draft", "format": "story"})
    draft_id = r.json()["id"]
    client.post(f"/drafts/{draft_id}/assets", json={"asset_id": asset_id})
    return draft_id


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

class TestCreateAdCreative:
    def test_create_manual(self):
        r = client.post("/ad-creatives", json={
            "title": "Spring Sale Ad",
            "hook_text": "Don't miss out!",
            "cta_text": "Shop Now",
            "thumbnail_label": "Variant A",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Spring Sale Ad"
        assert data["hook_text"] == "Don't miss out!"
        assert data["cta_text"] == "Shop Now"
        assert data["thumbnail_label"] == "Variant A"
        assert data["status"] == "draft"

    def test_create_from_asset(self):
        asset_id = _create_asset()
        r = client.post(f"/ad-creatives/from-asset/{asset_id}", json={
            "hook_text": "Plant a tree today",
            "cta_text": "Learn More",
            "thumbnail_label": "Cover B",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["asset_id"] == asset_id
        assert data["hook_text"] == "Plant a tree today"
        assert "test.jpg" in data["title"]

    def test_create_from_asset_not_found(self):
        r = client.post("/ad-creatives/from-asset/nonexistent", json={})
        assert r.status_code == 404

    def test_create_from_draft(self):
        draft_id = _create_draft_with_asset()
        r = client.post(f"/ad-creatives/from-draft/{draft_id}", json={
            "hook_text": "Reforest the planet",
            "cta_text": "Donate",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["draft_id"] == draft_id
        assert data["hook_text"] == "Reforest the planet"
        assert "Test Draft" in data["title"]

    def test_create_from_draft_not_found(self):
        r = client.post("/ad-creatives/from-draft/nonexistent", json={})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

class TestUpdateAdCreative:
    def test_update_hook_cta_thumbnail(self):
        r = client.post("/ad-creatives", json={"title": "Ad"})
        creative_id = r.json()["id"]
        r = client.patch(f"/ad-creatives/{creative_id}", json={
            "hook_text": "New hook",
            "cta_text": "New CTA",
            "thumbnail_label": "Variant C",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["hook_text"] == "New hook"
        assert data["cta_text"] == "New CTA"
        assert data["thumbnail_label"] == "Variant C"

    def test_update_status(self):
        r = client.post("/ad-creatives", json={"title": "Ad"})
        creative_id = r.json()["id"]
        r = client.patch(f"/ad-creatives/{creative_id}", json={"status": "ready"})
        assert r.status_code == 200
        assert r.json()["status"] == "ready"

    def test_update_not_found(self):
        r = client.patch("/ad-creatives/nonexistent", json={"title": "X"})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# List and filter
# ---------------------------------------------------------------------------

class TestListAdCreatives:
    def test_list_empty(self):
        r = client.get("/ad-creatives")
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_list_all(self):
        client.post("/ad-creatives", json={"title": "Ad 1"})
        client.post("/ad-creatives", json={"title": "Ad 2"})
        r = client.get("/ad-creatives")
        assert r.json()["total"] == 2

    def test_filter_by_status(self):
        r1 = client.post("/ad-creatives", json={"title": "Ad 1"})
        creative_id = r1.json()["id"]
        client.patch(f"/ad-creatives/{creative_id}", json={"status": "ready"})
        client.post("/ad-creatives", json={"title": "Ad 2"})

        r = client.get("/ad-creatives?status=ready")
        assert r.json()["total"] == 1
        assert r.json()["ad_creatives"][0]["status"] == "ready"

        r = client.get("/ad-creatives?status=draft")
        assert r.json()["total"] == 1

    def test_filter_by_campaign(self):
        client.post("/ad-creatives", json={"title": "Ad 1", "campaign_id": "camp-1"})
        client.post("/ad-creatives", json={"title": "Ad 2", "campaign_id": "camp-2"})
        r = client.get("/ad-creatives?campaign_id=camp-1")
        assert r.json()["total"] == 1
        assert r.json()["ad_creatives"][0]["campaign_id"] == "camp-1"
