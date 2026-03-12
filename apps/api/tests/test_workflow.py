"""Tests for draft workflow status transitions."""

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
    """Create a draft and attach one asset."""
    asset_id = _create_asset()
    r = client.post("/drafts", json={"title": "Test", "format": "story"})
    draft_id = r.json()["id"]
    client.post(f"/drafts/{draft_id}/assets", json={"asset_id": asset_id})
    return draft_id


# ---------------------------------------------------------------------------
# Valid transitions
# ---------------------------------------------------------------------------

class TestValidTransitions:
    def test_draft_to_in_review(self):
        draft_id = _create_draft_with_asset()
        r = client.post(f"/drafts/{draft_id}/submit-for-review")
        assert r.status_code == 200
        assert r.json()["status"] == "in_review"

    def test_in_review_to_approved(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        r = client.post(f"/drafts/{draft_id}/approve")
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    def test_in_review_to_rejected(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        r = client.post(f"/drafts/{draft_id}/reject")
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_rejected_to_draft(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        client.post(f"/drafts/{draft_id}/reject")
        r = client.post(f"/drafts/{draft_id}/return-to-draft")
        assert r.status_code == 200
        assert r.json()["status"] == "draft"

    def test_in_review_return_to_draft(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        r = client.post(f"/drafts/{draft_id}/return-to-draft")
        assert r.status_code == 200
        assert r.json()["status"] == "draft"

    def test_approved_to_scheduled(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        client.post(f"/drafts/{draft_id}/approve")
        r = client.post(f"/drafts/{draft_id}/schedule", json={
            "scheduled_for": "2026-03-15T10:00:00Z",
            "notes": "Morning post",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "scheduled"
        assert r.json()["scheduled_for"] == "2026-03-15T10:00:00Z"
        assert r.json()["schedule_notes"] == "Morning post"


# ---------------------------------------------------------------------------
# Invalid transitions
# ---------------------------------------------------------------------------

class TestInvalidTransitions:
    def test_cannot_approve_draft_status(self):
        draft_id = _create_draft_with_asset()
        r = client.post(f"/drafts/{draft_id}/approve")
        assert r.status_code == 409

    def test_cannot_reject_draft_status(self):
        draft_id = _create_draft_with_asset()
        r = client.post(f"/drafts/{draft_id}/reject")
        assert r.status_code == 409

    def test_cannot_schedule_draft_status(self):
        draft_id = _create_draft_with_asset()
        r = client.post(f"/drafts/{draft_id}/schedule", json={
            "scheduled_for": "2026-03-15T10:00:00Z",
        })
        assert r.status_code == 409

    def test_cannot_schedule_in_review(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        r = client.post(f"/drafts/{draft_id}/schedule", json={
            "scheduled_for": "2026-03-15T10:00:00Z",
        })
        assert r.status_code == 409

    def test_cannot_schedule_rejected(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        client.post(f"/drafts/{draft_id}/reject")
        r = client.post(f"/drafts/{draft_id}/schedule", json={
            "scheduled_for": "2026-03-15T10:00:00Z",
        })
        assert r.status_code == 409

    def test_cannot_submit_without_assets(self):
        r = client.post("/drafts", json={"title": "Empty", "format": "reel"})
        draft_id = r.json()["id"]
        r = client.post(f"/drafts/{draft_id}/submit-for-review")
        assert r.status_code == 409
        assert "no assets" in r.json()["detail"]

    def test_cannot_return_approved_to_draft(self):
        draft_id = _create_draft_with_asset()
        client.post(f"/drafts/{draft_id}/submit-for-review")
        client.post(f"/drafts/{draft_id}/approve")
        r = client.post(f"/drafts/{draft_id}/return-to-draft")
        assert r.status_code == 409
