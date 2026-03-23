# Buildbot

AI-powered website generator and auto-deployer. Give it a URL and a prompt — it scrapes the site, generates a complete HTML/CSS/JS website using an LLM, and deploys it live to a subdomain automatically.

Built by **Dnyaneshwar Wantace** and **Prakash Wantace**.

---

## How it works

```
POST /api/v1/create
        │
        ▼
   Add to queue (BullMQ + Redis)
   Return { jobId } instantly
        │
        ▼
   Worker picks up job
        │
        ├── 1. Scrape    — fetch & parse reference website HTML (Cheerio + Cloudflare crawler)
        ├── 2. Generate  — send scraped content + requirements to LLM (OpenRouter / Kimi K2.5)
        ├── 3. Deploy    — write files to disk, auto-configure Nginx, go live
        └── 4. Persist   — save raw AI response to /projects/bin/{subdomain}.txt
        │
        ▼
   GET /api/v1/status/{jobId}
   Poll for progress (0→100%) and result
```

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Job Queue | BullMQ + Redis |
| Scraping | Cheerio + Cloudflare crawler bypass |
| AI | OpenRouter API (Kimi K2.5 / moonshotai) |
| Deploy | Nginx static file serving |
| Process Manager | PM2 |

---

## Architecture decisions

### Why we removed Docker per site

The original approach built a Docker container for every generated website. This caused:
- ~30s deploy time per site (docker build is slow)
- Port conflicts under concurrent load (scanning 5000-6000)
- Disk filling up with Docker images over time
- Only 1 site deployable at a time (execSync blocked Node.js)

The new approach writes static files directly to `$PROJECTS_BASE/{subdomain}/` and writes an Nginx config pointing to that folder. Deploy time dropped from ~30s to under 1s. No ports, no containers, no conflicts.

### Why we added a job queue

The original API route ran scrape → generate → deploy inline inside the POST handler. Users had to wait 60-120 seconds for a response. Under load, concurrent requests would block each other.

Now the POST handler just enqueues the job and returns `{ jobId }` immediately. A separate worker process picks up jobs and processes them at a configurable concurrency (default: 10). Users poll `/api/v1/status/{jobId}` for live progress.

---

## API

### Create a site
```
POST /api/v1/create
Content-Type: application/json

{
  "subdomain": "mysite",
  "companyName": "My Company",
  "companyWebsite": "https://example.com",
  "competitorWebsites": ["https://competitor.com"],
  "clientRequirements": "Modern SaaS landing page with dark theme"
}
```

Response:
```json
{
  "success": true,
  "jobId": "mysite",
  "message": "Job queued — poll /api/v1/status/mysite for progress"
}
```

### Poll job status
```
GET /api/v1/status/{jobId}
```

Response:
```json
{
  "jobId": "mysite",
  "state": "active",
  "progress": 40,
  "result": null
}
```

When `state` is `completed`:
```json
{
  "jobId": "mysite",
  "state": "completed",
  "progress": 100,
  "result": {
    "liveUrl": "http://mysite.wantace.org",
    "nginxConfigured": true,
    "generationError": null,
    "deployError": null,
    "total_time": 47.3
  }
}
```

---

## Environment variables

```env
MOONSHOT_API_KEY=         # OpenRouter or Moonshot API key
MOONSHOT_BASE_URL=        # API base URL (https://openrouter.ai/api/v1)
KIMI_SYSTEM_PROMPT=       # System prompt for AI generation
KIMI_MODEL=               # Model ID (default: moonshotai/kimi-k2.5)

PROJECTS_BASE=            # Path where generated sites are stored (/var/www/sites)
DOMAIN=                   # Base domain (wantace.org)
NGINX_SITES_AVAILABLE=    # Nginx sites-available path (/etc/nginx/sites-available)

REDIS_HOST=               # Redis host (127.0.0.1)
REDIS_PORT=               # Redis port (6379)
WORKER_CONCURRENCY=       # Concurrent jobs (default: 10)
```

---

## Running locally

```bash
# Start Redis
docker run -d -p 6379:6379 --name redis redis:alpine

# Install dependencies
npm install

# Start Next.js app
npm run dev

# Start worker (separate terminal)
npm run worker
```

## Running on server

```bash
# Build
npm run build

# Start app on port 3001
pm2 start npm --name "buildbot-app" -- start -- -p 3001

# Start worker
pm2 start npm --name "buildbot-worker" -- run worker

pm2 save
pm2 startup
```

---

## Generated site structure

Each deployed site lives at `$PROJECTS_BASE/{subdomain}/`:

```
/var/www/sites/{subdomain}/
├── index.html
├── styles.css
├── script.js
└── README.md
```

Accessible at `http://{subdomain}.{DOMAIN}` via auto-configured Nginx.

---

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm run worker   # Start BullMQ job worker
```
