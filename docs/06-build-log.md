# Build Log

## 2026-03-12 — Initial Scaffold

### What was done
- Created pnpm + Turborepo monorepo root configuration
- Scaffolded `apps/web` — Next.js 14 shell with landing page showing daily targets
- Scaffolded `apps/api` — FastAPI shell with `/health` endpoint
- Scaffolded `apps/worker` — Python worker service with signal-handling idle loop
- Created `packages/shared-types` with `ContentItem`, `AdCreative`, `ContentFormat`, `ContentStatus` types and `DAILY_TARGETS` constant
- Stubbed remaining packages: `content-engine`, `asset-engine`, `brand-engine`, `ad-engine`, `analytics-engine`, `instagram-client`
- Added `.gitignore`, `tsconfig.base.json`, `turbo.json`, `pnpm-workspace.yaml`

### Stack correction
- Replaced Express (Node.js) API with FastAPI (Python 3.11+)
- Replaced BullMQ (Node.js) worker with Python worker service
- Documented decision in `docs/05-decisions.md` (ADR-001)

### What's NOT included
- No database setup (PostgreSQL planned)
- No product logic or integrations
- No CI/CD pipeline
- No environment variable configuration

## 2026-03-12 — Database Schema (Ticket 2)

### What was done
- Designed 10-table schema: `assets`, `content_briefs`, `templates`, `drafts`, `draft_assets`, `campaigns`, `publish_jobs`, `ad_creatives`, `performance_events`, `recommendations`
- Implemented SQLAlchemy 2.0 models in `apps/api/app/models/`
- Created shared `Base` class with UUID pk, `created_at`, `updated_at`
- Defined 10 enums in `app/models/enums.py`
- Set up Alembic with initial migration (`e669bf7c2d2c`)
- Updated `packages/shared-types` with matching TypeScript interfaces for all 10 entities
- Added `sqlalchemy`, `alembic`, `psycopg2-binary`, `asyncpg` to API requirements
- Documented schema in `docs/04-data-model.md`
- Documented design decisions in `docs/05-decisions.md` (ADR-003)

### Key design choices
- Polymorphic nullable FKs (not generic FKs) for `performance_events` and `recommendations`
- Money stored as integer cents
- `ai_score` on drafts for future AI scoring
- JSONB on `performance_events` for flexible metric metadata

### Verified
- All 10 models import without errors
- Alembic generates valid PostgreSQL DDL in offline mode
- API `/health` endpoint still responds correctly

## 2026-03-12 — Asset Library Engine (Ticket 3)

### What was done

**Backend (`apps/api`):**
- Added Pydantic schemas in `app/schemas/asset.py`
- Created asset API routes in `app/routes/assets.py`: `GET /assets`, `GET /assets/{id}`, `POST /assets`, `PATCH /assets/{id}`, `POST /assets/index-directory`
- Built directory indexer in `app/services/asset_indexer.py` — scans local paths, classifies by extension (image/video), skips non-media files
- Added in-memory store in `app/store.py` — dict-backed CRUD with filter/search
- Updated `app/main.py` with CORS middleware and asset router

**Frontend (`apps/web`):**
- Created `src/lib/api.ts` — typed API client for asset endpoints
- Created `src/components/AssetGrid.tsx` — reusable grid with selection highlighting
- Created `src/components/AssetPreview.tsx` — detail panel showing metadata
- Created `src/app/assets/page.tsx` — Asset Browser with filter, search, index-directory, loading/empty/error states
- Added Asset Browser link to home page

### Verified
- All 5 API endpoints respond correctly
- `index-directory` scans, classifies, and skips non-media files
- Filters by media_type and search by filename work
- Web app builds clean (`/assets` route — 3.17 kB)
- CORS allows localhost:3000 → localhost:4000

### Hash-based deduplication
- Added `hash` field (SHA-256) to asset model, store, schemas, and API responses
- `index-directory` computes SHA-256 for each file and skips if hash already exists in the store
- Prevents duplicate ingestion when re-indexing the same or overlapping directories

### What's NOT included
- No real image/video preview (placeholder icons)
- No AI tagging
- No cloud storage
- No pagination (planned for large libraries)

## 2026-03-12 — Content Builders (Ticket 4)

### What was done

**Backend (`apps/api`):**
- Added draft CRUD to in-memory store: `create_draft`, `get_draft`, `list_drafts`, `update_draft`
- Added draft-asset join operations: `add_draft_asset`, `remove_draft_asset`, `get_draft_assets`
- Created Pydantic schemas in `app/schemas/draft.py`
- Created draft API routes in `app/routes/drafts.py`: `POST /drafts`, `GET /drafts`, `GET /drafts/{id}`, `PATCH /drafts/{id}`, `POST /drafts/{id}/assets`, `DELETE /drafts/{id}/assets/{asset_id}`
- Registered drafts router in `app/main.py`

**Frontend (`apps/web`):**
- Created `DraftCanvas` component — shared builder with title edit, asset management, save/create flow
- Created `AssetPicker` component — modal overlay with search/filter, excludes already-attached assets
- Created `DraftAssetList` component — ordered list with position numbers and remove buttons
- Created builder pages: `/stories/new`, `/reels/new`, `/carousels/new`
- Extended `lib/api.ts` with draft CRUD + draft-asset functions
- Updated home page with builder links

### Verified
- All 6 draft API endpoints tested (create, list, get, patch, add asset, remove asset)
- Asset ordering preserved via position field
- Web builds clean — all 6 routes compile
- Documented in ADR-005

### What's NOT included
- No publishing workflow
- No AI generation
- No draft editing (load existing draft by ID)
- No drag-to-reorder (position managed via add/remove)

## 2026-03-12 — Approval Queue + Calendar (Ticket 5)

### What was done

**Backend (`apps/api`):**
- Added 5 workflow transition endpoints to `app/routes/drafts.py`:
  - `POST /drafts/{id}/submit-for-review` — requires status=draft + assets>0
  - `POST /drafts/{id}/approve` — requires status=in_review
  - `POST /drafts/{id}/reject` — requires status=in_review
  - `POST /drafts/{id}/return-to-draft` — requires status=rejected or in_review
  - `POST /drafts/{id}/schedule` — requires status=approved, sets scheduled_for + notes
- All invalid transitions return 409 Conflict with descriptive message
- Added `scheduled_for`, `schedule_notes` fields to draft model in store
- Added `scheduled_after`/`scheduled_before` date-range filtering to `GET /drafts`
- Added `draft_asset_count()` helper and `clear_all()` test reset to store
- Updated `DraftStatus` literal to include `scheduled`
- Added `ScheduleDraftRequest` schema
- Wrote 13 pytest tests (6 valid transitions, 7 invalid transitions) — all passing

**Frontend (`apps/web`):**
- Created `DraftStatusBadge` component — color-coded pill badges for all 5 statuses
- Created `SchedulePanel` component — datetime picker + notes for approved drafts
- Created `ApprovalQueue` component — filterable list with inline workflow actions (submit, approve, reject, return-to-draft, schedule)
- Created `CalendarView` component — month grid with navigation, shows scheduled drafts by date
- Created `/queue` page with status filter tabs
- Created `/calendar` page with month navigation
- Extended `lib/api.ts` with 5 workflow functions + `DraftStatus` type + schedule fields on `Draft` interface
- Updated home page with Workflow section (queue + calendar links)

### Verified
- 13 backend workflow tests pass (`pytest tests/test_workflow.py`)
- Web builds clean — all 8 routes compile (added `/queue` 3.4 kB, `/calendar` 2.86 kB)
- API bumped to v0.0.4
- Documented in ADR-006

### DB enum alignment
- `DraftStatus` enum updated from 8 speculative values to 5 canonical values matching the enforced workflow: `draft`, `in_review`, `approved`, `rejected`, `scheduled`
- Updated in: SQLAlchemy enum (`app/models/enums.py`), Draft model default, Alembic migration, shared-types (`packages/shared-types`), data-model docs
- Old values removed: `idea`, `in_progress`, `review`, `published`, `failed`, `archived`

### What's NOT included
- No real-time updates / WebSocket push on status change
- No notification system for reviewers
- No drag-to-reschedule on calendar
- No recurring schedule support
