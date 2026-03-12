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
