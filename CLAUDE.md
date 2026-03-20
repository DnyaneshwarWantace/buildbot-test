# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Buildbot-v2 is a Next.js platform that automates website generation and deployment. It scrapes existing websites, uses the Kimi AI API to regenerate/improve them, and deploys the output as static sites served by nginx.

## Commands

```bash
# Development
npm run dev        # Start Next.js dev server (port 3000)
npm run worker     # Start BullMQ background worker (tsx worker.ts)

# Production
npm run build      # Build Next.js (standalone output)
npm start          # Start production server

# Code quality
npm run lint       # Run ESLint
```

Both the Next.js server and the worker must run simultaneously in development.

## Architecture

### Request Flow

```
User → /create form → POST /api/v1/create
  → Validate (Zod) → Enqueue BullMQ job → Return jobId
  → Client polls GET /api/v1/status/[jobId]
  → Worker processes: Scrape → Generate (Kimi AI) → Deploy (nginx)
  → Client receives liveUrl on completion
```

### Key Layers

**API Routes** (`app/api/v1/`)
- `create/route.ts` — validates input and enqueues job; does NOT do any processing
- `status/[jobId]/route.ts` — returns job state/progress from BullMQ/Redis

**Worker** (`worker.ts`) — runs as a separate process, handles the full pipeline:
1. Scrape company + competitor sites (10%)
2. Generate HTML/CSS/JS via Kimi API (40%)
3. Deploy files + nginx config (70%)
4. Complete with result (100%)

**Scraping** (`app/api/v1/create/scrape.ts`) — direct fetch with Cheerio parsing; falls back to Cloudflare Browser Rendering (`cloudflareCrawl.ts`) for JS-heavy sites.

**Generation** (`app/api/v1/create/generate.ts`) — calls Kimi/OpenRouter API with a large system prompt (`KIMI_SYSTEM_PROMPT` env var). Parses two output formats: JSON and `=== filename ===` section-delimited. Timeout: 20 minutes.

**Deployment** (`app/api/v1/create/deploy.ts`) — writes HTML/CSS/JS to `/var/www/sites/{subdomain}/`, creates nginx config, reloads nginx. No database — job state lives in Redis (24h retention).

### Job Queue (`lib/queue.ts`)

- Redis at `127.0.0.1:6379` (configurable)
- Queue name: `"create-site"`
- Worker concurrency: 10 (configurable via `WORKER_CONCURRENCY`)

### Frontend

- `app/page.tsx` — home page with `ComposerInput` (redirects to `/create`)
- `app/create/page.tsx` — project form; polls job status after submission using React Query
- `app/(components)/` — shared components (ComposerInput, ProjectsCard, QueryProvider, SmoothScroll)

## Configuration

- `next.config.ts` — `basePath: "/v2"` for nginx subpath hosting; `output: "standalone"`
- All internal links must account for the `/v2` basePath; use `NEXT_PUBLIC_BASE_PATH` env var on the client

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `MOONSHOT_API_KEY` | required | Kimi/OpenRouter API key |
| `MOONSHOT_BASE_URL` | required | AI API endpoint |
| `KIMI_SYSTEM_PROMPT` | required | System prompt for generation (large, ~849 lines) |
| `KIMI_MODEL` | `moonshotai/kimi-k2.5` | Model name |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `PROJECTS_BASE` | `/var/www/sites` | Output directory for generated sites |
| `DOMAIN` | `wantace.org` | Base domain for deployed sites |
| `NGINX_SITES_AVAILABLE` | — | Nginx config directory |
| `WORKER_CONCURRENCY` | `10` | Max parallel jobs |
| `CF_ACCOUNT_ID` / `CF_API_TOKEN` | optional | Cloudflare Browser Rendering fallback |

## TypeScript

Path alias `@/*` maps to the project root. Strict mode is enabled.
