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
