import asyncio
from dotenv import load_dotenv
load_dotenv()  # load apps/api/.env before any route/service imports read os.environ

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.assets import router as assets_router, auto_sync_on_startup
from app.routes.drafts import router as drafts_router
from app.routes.ad_creatives import router as ad_creatives_router
from app.routes.templates import router as templates_router
from app.routes.ai_reel import router as ai_reel_router
from app.routes.hooks import router as hooks_router
from app.routes.intelligence import router as intelligence_router
from app.routes.instagram import router as instagram_router
from app.routes.narrative import router as narrative_router
from app.routes.signals import router as signals_router
from app.routes.narrative_response import router as narrative_response_router
from app.routes.x_posts import router as x_posts_router
from app.routes.x_account import router as x_account_router
from app.routes.linkedin import router as linkedin_router
from app.routes.linkedin_account import router as linkedin_account_router
from app.routes.pinterest import router as pinterest_router
from app.routes.pinterest_account import router as pinterest_account_router
from app.routes.health_safety import router as hs_router

app = FastAPI(title="Integrity Social Media Machine API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets_router)
app.include_router(drafts_router)
app.include_router(ad_creatives_router)
app.include_router(templates_router)
app.include_router(ai_reel_router)
app.include_router(hooks_router)
app.include_router(intelligence_router)
app.include_router(instagram_router)
app.include_router(narrative_router)
app.include_router(signals_router)
app.include_router(narrative_response_router)
app.include_router(x_account_router)
app.include_router(x_posts_router)
app.include_router(linkedin_account_router)
app.include_router(linkedin_router)
app.include_router(pinterest_account_router)
app.include_router(pinterest_router)
app.include_router(hs_router)


async def publish_scheduler_loop():
    """Background task: publish scheduled drafts when their time arrives."""
    from datetime import datetime, timezone
    from concurrent.futures import ThreadPoolExecutor
    from app.services.instagram_publisher import publish_draft
    import app.store as store

    executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="publisher")
    loop = asyncio.get_event_loop()

    await asyncio.sleep(10)  # let server fully start
    while True:
        try:
            now = datetime.now(timezone.utc).isoformat()
            due = store.list_drafts(status="scheduled", scheduled_before=now)
            for draft in due:
                draft_id = draft["id"]
                title = draft.get("title", "")
                print(f"[scheduler] Publishing draft {draft_id} — {title!r}")
                # Mark in-progress so a server restart doesn't double-publish
                store.update_draft(draft_id, {"status": "publishing"})
                try:
                    # Run blocking publisher in a thread — keeps the event loop alive
                    result = await loop.run_in_executor(executor, publish_draft, draft_id)
                    print(f"[scheduler] ✓ Published {draft_id} → media_ids={result.get('media_ids')}")
                except Exception as exc:
                    err = str(exc)
                    print(f"[scheduler] ✗ Failed {draft_id}: {err}")
                    # Store error as a top-level field so UI autosave can't wipe it
                    store.update_draft(draft_id, {
                        "status": "publish_failed",
                        "publish_error": err,
                    })
        except Exception as exc:
            print(f"[scheduler] Error in publish loop: {exc}")
        await asyncio.sleep(60)  # check every minute


async def signal_refresh_loop():
    """Background task: ingest signals every 30 minutes."""
    from app.services.signal_ingestion import ingest_signals
    import app.store as store

    # Initial run after 5-second delay to let server fully start
    await asyncio.sleep(5)
    while True:
        try:
            new_signals = await ingest_signals()
            new_count = store.bulk_upsert_signals(new_signals)
            store.update_signal_stats(len(store.list_live_signals(limit=1000)), new_count)
        except Exception as exc:
            print(f"[signal_refresh_loop] Error: {exc}")
        await asyncio.sleep(1800)  # 30 minutes


@app.on_event("startup")
async def startup_event():
    """Auto-sync the Integrity Asset Library and start the signal refresh loop."""
    auto_sync_on_startup()
    asyncio.create_task(publish_scheduler_loop())
    asyncio.create_task(signal_refresh_loop())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "igrowth-api"}
