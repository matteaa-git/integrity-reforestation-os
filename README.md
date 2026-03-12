# Instagram Growth OS

Content production and paid-growth operating system for Integrity Reforestation.

**Daily targets:** 10 stories, 3 reels, 1 carousel, profitable ad testing.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Python >= 3.11
- (Later) PostgreSQL, Redis

## Setup

### 1. Install JS dependencies

```bash
pnpm install
```

### 2. Set up Python virtual environments

```bash
# API
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate

# Worker
cd ../worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate

cd ../..
```

## Run

### Web (Next.js) — port 3000

```bash
pnpm --filter @igrowth/web dev
```

### API (FastAPI) — port 4000

```bash
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --reload --port 4000
```

### Worker

```bash
cd apps/worker
source .venv/bin/activate
python -m worker.main
```

### All JS packages (build)

```bash
pnpm build
```

## Project Layout

```
apps/
  web/          Next.js 14 + TypeScript
  api/          FastAPI + Python 3.11+
  worker/       Python worker service
packages/
  shared-types/       TypeScript type definitions
  content-engine/     Content generation (stub)
  asset-engine/       Media management (stub)
  brand-engine/       Brand consistency (stub)
  ad-engine/          Ad management (stub)
  analytics-engine/   Metrics and ROI (stub)
  instagram-client/   Instagram Graph API wrapper (stub)
data/
  brand/        Brand assets
  templates/    Content templates
docs/           Architecture docs and decision log
```

## Status

Scaffold only — no product logic implemented yet.
