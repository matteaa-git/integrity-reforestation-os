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

## ADR-004: Asset Library — In-Memory Store (2026-03-12)

**Decision:** Use an in-memory Python dict as the asset store for initial development. No PostgreSQL dependency required to run or test.

| Choice | Rationale |
|--------|-----------|
| In-memory store | Repo stays runnable without PostgreSQL; swap to real DB by replacing `store.py` with SQLAlchemy session calls |
| Local file paths | Assets reference local filesystem paths; no cloud storage yet |
| Directory indexing | `POST /assets/index-directory` scans a local path and registers media files by extension |
| Pydantic schemas separate from DB models | API contracts (`app/schemas/`) are decoupled from SQLAlchemy models — allows the store layer to change independently |
| CORS enabled for localhost:3000 | Next.js dev server calls the API cross-origin |

**Context:** PostgreSQL is planned but not yet running. The in-memory store lets the full asset workflow (index, browse, filter, select) work end-to-end immediately. The API shape is final — only the persistence layer will change.
