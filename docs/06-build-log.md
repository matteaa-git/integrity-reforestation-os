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
