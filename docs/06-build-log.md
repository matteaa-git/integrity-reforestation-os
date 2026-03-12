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
