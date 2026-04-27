"""Scheduled post publisher.

Polls for drafts with status='scheduled' whose scheduled_for time has passed
and publishes them to Instagram via the existing publisher service.
"""

import sys
import os
import time
import traceback
from datetime import datetime, timezone

# Make the API app importable from the worker
_API_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "api"))
if _API_PATH not in sys.path:
    sys.path.insert(0, _API_PATH)

import app.store as store  # noqa: E402
from app.services.instagram_publisher import publish_draft  # noqa: E402

POLL_INTERVAL = 30  # seconds between checks
MAX_ATTEMPTS = 3    # retry up to 3 times before marking failed


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _due_drafts() -> list:
    """Return scheduled drafts whose scheduled_for time is now or past."""
    now = _now_iso()
    return store.list_drafts(status="scheduled", scheduled_before=now)


def _attempts(draft: dict) -> int:
    return (draft.get("metadata") or {}).get("publish_attempts", 0)


def run_once() -> None:
    """Check for due drafts and publish each one."""
    due = _due_drafts()
    if not due:
        return

    print(f"[scheduler] {len(due)} draft(s) due for publishing")

    for draft in due:
        draft_id = draft["id"]
        attempts = _attempts(draft)

        if attempts >= MAX_ATTEMPTS:
            print(f"[scheduler] draft {draft_id} exceeded max attempts — marking failed")
            store.update_draft(draft_id, {
                "status": "failed",
                "metadata": {
                    **(draft.get("metadata") or {}),
                    "fail_reason": f"Exceeded {MAX_ATTEMPTS} publish attempts",
                    "failed_at": _now_iso(),
                },
            })
            continue

        # Increment attempt counter before trying so a crash doesn't retry infinitely
        store.update_draft(draft_id, {
            "metadata": {
                **(draft.get("metadata") or {}),
                "publish_attempts": attempts + 1,
                "last_attempt_at": _now_iso(),
            },
        })

        try:
            print(f"[scheduler] publishing draft {draft_id} (attempt {attempts + 1}) — format={draft.get('format')} title={draft.get('title')!r}")
            result = publish_draft(draft_id)
            print(f"[scheduler] ✓ draft {draft_id} published — media_ids={result.get('media_ids')}")
        except Exception as exc:
            print(f"[scheduler] ✗ draft {draft_id} failed (attempt {attempts + 1}): {exc}")
            traceback.print_exc()
            # Leave status as 'scheduled' so it retries on next poll (up to MAX_ATTEMPTS)
            store.update_draft(draft_id, {
                "metadata": {
                    **(store.get_draft(draft_id) or {}).get("metadata") or {},
                    "last_error": str(exc),
                },
            })


def run_loop(stop_event=None) -> None:
    """Poll indefinitely. Pass a threading.Event to allow clean shutdown."""
    print(f"[scheduler] started — polling every {POLL_INTERVAL}s")
    while True:
        try:
            run_once()
        except Exception as exc:
            print(f"[scheduler] unexpected error in run_once: {exc}")
            traceback.print_exc()

        # Sleep in small increments so stop_event is checked promptly
        for _ in range(POLL_INTERVAL):
            if stop_event and stop_event.is_set():
                print("[scheduler] stopped")
                return
            time.sleep(1)
