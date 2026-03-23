# Buildbot v1 → v2 Changes

A full comparison of what changed between the original Docker-based architecture and the new queue-based static deploy system.

---

## Overview

| | v1 (Docker) | v2 (Queue + Static) |
|---|---|---|
| Deploy method | Docker container per site | Nginx static file serving |
| API response | Returns result after 60-120s | Returns `{ jobId }` instantly |
| Concurrency | 1 at a time (blocking) | 10 at a time (configurable) |
| Deploy time | ~30s (docker build) | ~1s (write files + nginx reload) |
| Port management | Scanned 5000-6000 per site | No ports needed |
| Progress tracking | None — user waited blind | Live 0→100% progress bar |
| Worker | Inline in API route | Separate PM2 process |

---

## 1. Deploy — `deploy.ts`

### v1 (Docker)

```
generate files
    → write Dockerfile
    → docker build -t {subdomain}        (~20-25s)
    → scan ports 5000-6000 for free one
    → docker run -d -p {port}:80         (~5s)
    → nginx proxy_pass http://127.0.0.1:{port}
```

Problems:
- `execSync` blocked the entire Node.js server during docker build
- Port scanning broke under concurrent requests (race condition)
- Each site left a running container and a Docker image on disk
- 1000 sites = 1000 containers + 1000 images eating memory and disk

### v2 (Static Nginx)

```
generate files
    → write files to /var/www/sites/{subdomain}/
    → write nginx config with root pointing to folder   (~50ms)
    → symlink to sites-enabled
    → nginx -t && systemctl reload nginx
```

Improvements:
- `execAsync` — non-blocking, does not freeze Node.js
- No ports, no containers, no Docker images
- Deploy time: 30s → under 1s
- 1000 sites = 1000 folders, Nginx serves them all with zero overhead

---

## 2. API Route — `route.ts`

### v1

```
POST /api/v1/create
    → scrape (await)
    → generate (await, 30-60s AI call)
    → deploy (await, 30s docker build)
    → return full result
```

User had to keep the HTTP connection open for 60-120 seconds. Any network hiccup = lost result. No way to check progress.

### v2

```
POST /api/v1/create
    → validate input
    → queue.add(job)
    → return { jobId } immediately   (< 100ms)
```

New endpoint added:
```
GET /api/v1/status/{jobId}
    → returns { state, progress, result }
```

States: `waiting → active → completed / failed`

---

## 3. Job Queue — `lib/queue.ts` (NEW)

Entirely new file. Uses BullMQ + Redis.

- Worker runs as a **separate process** (`npm run worker`)
- Processes jobs at configurable concurrency (`WORKER_CONCURRENCY=10`)
- Each job goes through: scrape → generate → deploy → persist
- Updates progress at each stage: 10% → 40% → 70% → 100%
- Failed jobs saved with error reason, accessible via status endpoint
- Completed jobs kept for 24h in Redis for polling

```
Queue (Redis)
    ↓
Worker (concurrency: 10)
    ├── Job 1: scrape → generate → deploy
    ├── Job 2: scrape → generate → deploy
    ├── ...
    └── Job 10: scrape → generate → deploy
```

---

## 4. Worker Entry Point — `worker.ts` (NEW)

New file. Starts the BullMQ worker as a standalone Node.js process.

```bash
npm run worker   # runs: tsx worker.ts
```

Runs separately from the Next.js app. On the server both run under PM2:
- `buildbot-app` — Next.js on port 3001
- `buildbot-worker` — BullMQ worker

---

## 5. Status Endpoint — `app/api/v1/status/[jobId]/route.ts` (NEW)

New GET endpoint. Polls Redis for job state.

```json
// While processing
{ "jobId": "mysite", "state": "active", "progress": 40, "result": null }

// On completion
{ "jobId": "mysite", "state": "completed", "progress": 100, "result": { "liveUrl": "http://mysite.wantace.org", ... } }

// On failure
{ "jobId": "mysite", "state": "failed", "progress": 0, "result": null, "failedReason": "Kimi request timed out" }
```

---

## 6. Frontend — `app/create/page.tsx`

### v1

- `useMutation` called `createProject()` and waited for the full response
- `onSuccess` received the complete deploy result
- Button showed "Creating..." for 60-120 seconds
- No feedback on what stage it was at

### v2

- `useMutation` calls `createProject()` → gets `{ jobId }` instantly
- Starts `pollJob(jobId)` — polls `/api/v1/status/{jobId}` every 2 seconds
- Shows live progress bar (0→100%) with stage label
- Button text changes: `Queuing... → Waiting in queue... → Generating...`
- On complete: sets `liveUrl`, `deployError`, `generationError` from job result

Progress bar UI added:
```
Queued...                    0%
[██░░░░░░░░░░░░░░░░░░░░░░]

Processing...               40%
[██████████░░░░░░░░░░░░░░]

Completed                  100%
[████████████████████████]
```

---

## 7. Client API — `api/create.api.ts`

### v1
- One function: `createProject()` — returned full deploy result

### v2
- `createProject()` — now returns `{ jobId }` only
- `getJobStatus(jobId)` — NEW, fetches job state from status endpoint
- `waitForJob(jobId, onProgress)` — NEW, polling helper with callback

---

## Summary of files changed

| File | Status | What changed |
|---|---|---|
| `app/api/v1/create/deploy.ts` | Modified | Removed Docker, added static Nginx, execSync → execAsync |
| `app/api/v1/create/route.ts` | Modified | Returns jobId instantly instead of running pipeline |
| `app/create/page.tsx` | Modified | Live progress bar, polls job status |
| `api/create.api.ts` | Modified | Returns jobId, added getJobStatus + waitForJob |
| `next.config.ts` | Modified | Removed basePath (was added for /v2 path attempt, reverted) |
| `package.json` | Modified | Added bullmq, tsx, worker script |
| `lib/queue.ts` | New | BullMQ queue + worker pipeline logic |
| `worker.ts` | New | Worker process entry point |
| `app/api/v1/status/[jobId]/route.ts` | New | Job status polling endpoint |
