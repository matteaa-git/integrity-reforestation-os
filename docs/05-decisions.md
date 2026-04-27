# Architectural Decisions

## ADR-001: Tech Stack Selection (2026-03-12)

**Decision:** Use a hybrid TypeScript + Python monorepo.

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Web UI | Next.js 14 + TypeScript | App Router, SSR, React ecosystem |
| API | FastAPI + Python 3.11+ | Async-first, Pydantic validation, fast prototyping |
| Worker | Python 3.11+ service | Shares code with API, simpler than a separate runtime |
| Database | PostgreSQL (planned) | Relational, JSONB for flexible content schemas |
| Monorepo | pnpm workspaces + Turborepo | Manages JS/TS packages; Python services use venvs |
| Shared TS types | `@igrowth/shared-types` | Type-safe frontend contracts |

**Context:** Initial scaffold used Express + BullMQ for api/worker. Corrected to FastAPI + Python to align with team preference and faster iteration on AI/content pipeline logic.

## ADR-002: Scaffold Only — No Product Logic Yet (2026-03-12)

**Decision:** The initial commit contains only runnable shells. No database, no integrations, no business logic. Each service starts and responds to a health check (or runs idle). This keeps the repo clean while the product spec and build order are finalized.

## ADR-003: Database Schema Design (2026-03-12)

**Decision:** Use SQLAlchemy 2.0 declarative models with Alembic migrations, targeting PostgreSQL.

| Choice | Rationale |
|--------|-----------|
| SQLAlchemy 2.0 (not SQLModel) | More mature, full relationship/JSONB/enum support, wider ecosystem |
| UUID primary keys | Globally unique IDs, safe for distributed systems and client-generated IDs |
| Polymorphic nullable FKs | `performance_events` and `recommendations` reference either `publish_jobs`/`ad_creatives` or `drafts`/`ad_creatives` via two nullable FKs + a discriminator enum. Keeps referential integrity at the DB level without generic FK hacks |
| Money in cents (integer) | Avoids floating-point rounding; UI converts to dollars for display |
| JSONB for metadata | `performance_events.metadata_json` allows flexible metric context without schema migration per new metric |
| `ai_score` on drafts | Placeholder column for future AI scoring — avoids a schema migration when AI features ship |
| Alembic for migrations | Industry standard for SQLAlchemy; supports offline SQL generation for review |

**Context:** SQLModel was considered but lacks mature support for complex relationships, JSONB, and check constraints needed by this schema. SQLAlchemy 2.0's `Mapped` + `mapped_column` API provides comparable type safety.

## ADR-004: Asset Library — In-Memory Store + Integrity_AssetLibrary (2026-03-12, updated 2026-03-13)

**Decision:** Use an in-memory Python dict as the asset store for initial development. No PostgreSQL dependency required to run or test. Default indexing source is `~/Integrity_AssetLibrary`.

| Choice | Rationale |
|--------|-----------|
| In-memory store | Repo stays runnable without PostgreSQL; swap to real DB by replacing `store.py` with SQLAlchemy session calls |
| Local file paths | Assets reference local filesystem paths; no cloud storage yet |
| Default library root: `~/Integrity_AssetLibrary` | The real Integrity Reforestation asset library. `POST /assets/index-directory` defaults to this path when no directory is specified |
| Recursive scanning with junk filtering | Skips `.DS_Store`, AppleDouble `._` files, `.venv`, `__pycache__`, `state`, `LOGS`, `AGENTS` directories |
| SHA-256 hash deduplication | Prevents re-indexing the same file even if it appears at multiple paths or is re-indexed repeatedly |
| Library metadata inference from path | `category`, `project`, `pillar` are inferred from folder structure with high-confidence rules only. Known projects: OGK, PICFOREST, NAGAGAMI, WRIVER, KEN, ALG |
| Pillow for image dimensions | Extracts width/height from image files; fails gracefully |
| ffprobe for video metadata | Extracts width/height/duration from video files; fails gracefully |
| Pydantic schemas separate from DB models | API contracts (`app/schemas/`) are decoupled from SQLAlchemy models — allows the store layer to change independently |
| CORS enabled for localhost:3000 | Next.js dev server calls the API cross-origin |

**Supported file types:**
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.tiff`, `.tif`, `.svg`
- Videos: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.m4v`

**Context:** PostgreSQL is planned but not yet running. The in-memory store lets the full asset workflow (index, browse, filter, select) work end-to-end immediately. The API shape is final — only the persistence layer will change.

## ADR-005: Content Builders — Shared DraftCanvas Component (2026-03-12)

**Decision:** All three builder pages (`/stories/new`, `/reels/new`, `/carousels/new`) use a single `DraftCanvas` component parameterized by `format` and `formatLabel`. Builder-specific behavior (e.g. carousel multi-asset ordering) is handled by the same component with format-aware logic.

| Choice | Rationale |
|--------|-----------|
| Single DraftCanvas component | Stories, reels, and carousels share the same workflow: title, add assets, save. One component avoids duplication |
| Auto-create draft on first asset add | Draft is created lazily — avoids orphan drafts from abandoned sessions |
| AssetPicker as modal overlay | Keeps the builder context visible while selecting assets |
| Position-based asset ordering | `draft_assets` join table has `position` column, re-normalized on add/remove |
| Draft endpoints return nested assets | `GET /drafts/{id}` includes the ordered asset list to minimize round trips |

## ADR-006: Approval Queue — Status-Based Workflow (2026-03-12)

**Decision:** Drafts follow a strict status machine: `draft → in_review → approved → scheduled` (with a `rejected` branch). Transitions are enforced server-side via dedicated endpoints rather than a generic `PATCH /drafts/{id}` status update.

| Choice | Rationale |
|--------|-----------|
| Dedicated transition endpoints | `POST /drafts/{id}/approve`, `/reject`, `/submit-for-review`, `/return-to-draft`, `/schedule` — each validates preconditions (current status, has assets) and returns 409 on invalid transitions |
| No direct status PATCH for workflow | Prevents clients from skipping validation; `PATCH` still works for title/metadata edits |
| Asset-count guard on submit | Drafts cannot enter `in_review` without at least one attached asset — catches empty submissions early |
| `return-to-draft` from both `in_review` and `rejected` | Allows reviewers to pull back drafts and creators to iterate after rejection, but not from `approved` (committed to publish) |
| `scheduled_for` + `schedule_notes` on schedule | Scheduling is a distinct step after approval — captures when to post and any context for the scheduler |
| Calendar view queries by date range | `scheduled_after` / `scheduled_before` params on `GET /drafts` support efficient month-view loading |
| DB enum aligned with workflow | `DraftStatus` enum reduced from 8 values (`idea`, `in_progress`, `review`, `approved`, `scheduled`, `published`, `failed`, `archived`) to 5 (`draft`, `in_review`, `approved`, `rejected`, `scheduled`) — matches the enforced API workflow exactly. `published`/`failed`/`archived` will be reintroduced when publish jobs are implemented |

## ADR-007: Ad Creative Lab — Internal Creative Management (2026-03-12)

**Decision:** Ad creatives are managed as independent records separate from the organic draft workflow. They can be created manually, from an existing asset, or from an existing draft. No Meta Ads API integration yet — this is the internal creative generation and storage layer only.

| Choice | Rationale |
|--------|-----------|
| Separate from organic workflow | Paid creative testing (hooks, CTAs, thumbnails) has different lifecycle from organic content approval. Keeping them separate avoids muddying the draft status machine |
| `from-asset` / `from-draft` endpoints | Quick variant creation by inheriting title and linking source object. No AI generation — simple record creation with editable fields |
| `hook_text`, `cta_text`, `thumbnail_label` fields | Structured fields for the three main ad testing dimensions (hook testing, CTA testing, cover/thumbnail variants). Free-text rather than enum to allow creative flexibility |
| `AdCreativeStatus`: `draft`, `ready`, `archived` | Simple 3-state lifecycle. DB enum aligned from `draft/active/paused/completed` — `active/paused/completed` are Meta Ads API concepts not needed until integration |
| DB schema aligned with API | Removed `headline`, `body_text`, `call_to_action`, `spend_cents`, `impressions`, `clicks`, `conversions`, `instagram_ad_id` from the ad_creatives table — these are Meta Ads integration concerns. Added `title`, `draft_id`, `hook_text`, `cta_text`, `thumbnail_label`. Made `asset_id` nullable (from-draft flow may not have one). Performance/spend columns will be reintroduced when Meta Ads integration ships |
| VariantBuilder as modal overlay | Same pattern as AssetPicker — keeps the Ad Lab context visible while selecting source objects |
