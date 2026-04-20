# Architecture Patterns

**Domain:** Self-hosted household maintenance PWA (Next.js + PocketBase, single container)
**Researched:** 2026-04-20
**Confidence:** HIGH (Next.js self-hosting docs verified; PocketBase patterns well-established)

## Recommended Architecture

### Overview: Two Processes, One Container, One Volume

```
                    Docker Container
 +--------------------------------------------------+
 |                                                    |
 |   supervisord (PID 1)                             |
 |       |                                            |
 |       +--- PocketBase (Go binary)  :8090          |
 |       |       - SQLite DB (./data/pb_data/)       |
 |       |       - REST API + Realtime (SSE/WS)      |
 |       |       - Auth (email/password)              |
 |       |       - Admin UI (/_/)                     |
 |       |                                            |
 |       +--- Next.js standalone     :3000           |
 |               - Server-rendered pages              |
 |               - /api/health endpoint               |
 |               - Static assets                      |
 |               - Scheduler (node-cron, in-process)  |
 |                                                    |
 +--------------------------------------------------+
          |                     |
     port 3000 (exposed)   port 8090 (exposed)
          |                     |
 +--------------------------------------------------+
 |     ./data volume (bind mount)                    |
 |       pb_data/        - PocketBase SQLite + logs  |
 |       pb_migrations/  - Schema migration files    |
 +--------------------------------------------------+
```

### Why This Shape

1. **Single container** -- the spec mandates it for self-hoster simplicity. One `docker compose up`, one service, done.
2. **Two separate ports** -- PocketBase JS SDK connects directly from the browser to `:8090`. Next.js serves the UI on `:3000`. No proxying PocketBase through Next.js. This is the standard PocketBase pattern and avoids adding complexity.
3. **supervisord as PID 1** -- Docker expects one foreground process. supervisord manages both, handles restarts, and forwards signals for graceful shutdown. Lighter alternatives (s6-overlay, tini + bash) exist but supervisord is the most straightforward for two long-running processes.
4. **Shared volume** -- All persistence lives in `./data`. PocketBase stores its SQLite database, WAL, and any uploaded files in `pb_data/`. Next.js cache goes to the filesystem by default and needs no separate persistence for a single-instance deployment.

## Component Boundaries

| Component | Responsibility | Communicates With | Port |
|-----------|---------------|-------------------|------|
| **PocketBase** | Auth, data storage (SQLite), REST API, realtime subscriptions, admin UI, migration runner | Browser (via JS SDK), Next.js (server-side, optional) | 8090 |
| **Next.js standalone** | SSR pages, static assets, `/api/health`, in-process scheduler | Browser (serves HTML/JS/CSS), PocketBase (server-side data fetching if needed) | 3000 |
| **Browser (PB JS SDK)** | Client-side auth, CRUD operations, realtime subscriptions | PocketBase directly | -- |
| **Browser (Next.js)** | UI rendering, navigation, PWA shell | Next.js (page loads), PocketBase (data ops) | -- |
| **supervisord** | Process management, signal forwarding, restart policy | PocketBase process, Next.js process | -- |
| **Scheduler (node-cron)** | Hourly overdue detection, ntfy push notifications | PocketBase (reads tasks via SDK or direct HTTP), ntfy.sh (outbound POST) | -- |

### Key Boundary Rules

1. **Browser owns the PocketBase connection.** The PB JS SDK runs in the browser, authenticates directly with PocketBase, and performs all CRUD. Next.js does NOT proxy data requests.
2. **Next.js owns the UI and routing.** All pages, navigation, and UI state live in the Next.js App Router. PocketBase serves zero HTML to end users (its admin UI is for ops only).
3. **PocketBase owns the data.** All business data, auth state, and access rules live in PocketBase collections with API rules. PocketBase is the single source of truth.
4. **The scheduler lives inside Next.js.** It runs as an in-process node-cron job within the Next.js server process -- no separate worker container, no external job queue. It reads from PocketBase (via SDK or HTTP) and POSTs to ntfy.

## Data Flow

### Authentication Flow

```
Browser                    PocketBase (:8090)
  |                             |
  |-- POST /api/collections/    |
  |   users/auth-with-password  |
  |   {email, password}  ----->|
  |                             |-- Validate credentials
  |                             |-- Return JWT token
  |<---- {token, record} ------|
  |                             |
  |-- Store token in           |
  |   localStorage/cookie      |
  |                             |
  |-- All subsequent requests   |
  |   include Authorization     |
  |   header with token  ----->|
```

### Task Completion Flow

```
Browser                    PocketBase (:8090)
  |                             |
  |-- POST /api/collections/    |
  |   completions/records       |
  |   {task_id, completed_by,   |
  |    completed_at}     ----->|
  |                             |-- Validate via API rules
  |                             |-- Insert completion record
  |                             |-- Emit realtime event
  |<---- {record}        ------|
  |                             |
  |-- UI updates optimistically |
  |   (coverage ring, bands)    |
```

### Notification Flow (Server-Side)

```
Next.js (node-cron)        PocketBase (:8090)      ntfy.sh
  |                             |                      |
  |-- (every hour)              |                      |
  |-- GET /api/collections/     |                      |
  |   tasks/records?filter=...  |                      |
  |   (compute overdue)  ----->|                      |
  |                             |                      |
  |<---- {tasks}         ------|                      |
  |                             |                      |
  |-- For each overdue task:    |                      |
  |   GET user's ntfy_topic     |                      |
  |   from PocketBase    ----->|                      |
  |<---- {ntfy_topic}    ------|                      |
  |                             |                      |
  |-- POST /[topic]             |                      |
  |   {title, message}  --------------------------->|
  |                             |                      |-- Push to device
```

### Page Load Flow

```
Browser                    Next.js (:3000)         PocketBase (:8090)
  |                             |                      |
  |-- GET /dashboard     ----->|                      |
  |                             |-- Render React       |
  |                             |   (App Router SSR    |
  |                             |    or client-side)   |
  |<---- HTML + JS bundle -----|                      |
  |                             |                      |
  |-- PB SDK initializes        |                      |
  |-- GET /api/collections/     |                      |
  |   tasks/records      --------------------------->|
  |                             |                      |
  |<---- {tasks}         ----------------------------|
  |                             |                      |
  |-- Render three-band view    |                      |
```

## Patterns to Follow

### Pattern 1: Client-Side PocketBase SDK (Primary Data Path)

**What:** All CRUD operations go directly from browser to PocketBase. Next.js never proxies data.

**When:** Always, for all user-facing data operations.

**Why:** This is the canonical PocketBase pattern. It gives you realtime subscriptions for free, keeps Next.js stateless (no API routes for data), and simplifies the architecture. PocketBase API rules handle authorization.

```typescript
// lib/pocketbase.ts
import PocketBase from 'pocketbase';

// Browser-side PB client -- connects directly to PocketBase port
export const pb = new PocketBase(
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8090`
    : 'http://localhost:8090'
);

// Auth state persists in localStorage automatically
pb.authStore.onChange(() => {
  // React state update, cookie sync, etc.
});
```

**Important:** The PocketBase URL must be configurable. In LAN mode the browser needs to reach PocketBase on the same host but port 8090. Behind a reverse proxy, both ports may be mapped differently.

### Pattern 2: Environment-Aware PocketBase URL

**What:** PocketBase URL is configured via environment variable, with a sensible default for LAN.

**When:** Always.

```typescript
// The NEXT_PUBLIC_ prefix exposes this to the browser bundle at build time.
// Default assumes same-host deployment.
const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL
  || `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8090`;
```

For reverse-proxy deployments, the user sets `NEXT_PUBLIC_POCKETBASE_URL` to the proxied URL. For LAN-only, the default auto-detects correctly.

### Pattern 3: PocketBase Migrations as Code

**What:** Schema defined in `pocketbase/pb_migrations/` JavaScript files, auto-applied on PocketBase startup.

**When:** Always. Schema must be reproducible.

```
pocketbase/
  pb_migrations/
    1713600000_create_homes.js
    1713600001_create_areas.js
    1713600002_create_tasks.js
    1713600003_create_completions.js
    1713600004_create_invites.js
```

PocketBase auto-runs migrations from its `--migrationsDir` flag on startup. The Dockerfile copies these into the image.

### Pattern 4: supervisord Process Management

**What:** Use supervisord to run both PocketBase and Next.js as child processes.

**When:** Always, in the Docker container.

```ini
; /etc/supervisord.conf
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0

[program:pocketbase]
command=/app/pocketbase serve --http=0.0.0.0:8090 --dir=/app/data/pb_data --migrationsDir=/app/pb_migrations
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nextjs]
command=node /app/server.js
autostart=true
autorestart=true
environment=PORT="3000",HOSTNAME="0.0.0.0"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

### Pattern 5: Next.js Standalone Output

**What:** Build Next.js with `output: "standalone"` in `next.config.js`. This produces a self-contained `server.js` that includes only the required Node.js dependencies.

**When:** Always, for Docker builds. Dramatically reduces image size.

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
module.exports = nextConfig;
```

The standalone output produces:
- `.next/standalone/server.js` -- the Node.js server entry point
- `.next/standalone/node_modules/` -- only production deps
- `.next/static/` -- static assets (must be copied to `public/` in final image)

### Pattern 6: Health Check Endpoint

**What:** `/api/health` checks both Next.js and PocketBase liveness.

**When:** Always. Required by Docker HEALTHCHECK, Uptime Kuma, etc.

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check PocketBase is alive
    const pbRes = await fetch('http://localhost:8090/api/health', {
      signal: AbortSignal.timeout(3000),
    });
    if (!pbRes.ok) {
      return NextResponse.json(
        { status: 'degraded', pocketbase: 'unhealthy' },
        { status: 503 }
      );
    }
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json(
      { status: 'degraded', pocketbase: 'unreachable' },
      { status: 503 }
    );
  }
}
```

### Pattern 7: Insecure Context Detection

**What:** Detect when running without HTTPS and gracefully disable PWA install and web push features.

**When:** Always, on app load.

```typescript
// lib/context.ts
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext ?? false;
}

// Used to conditionally show PWA install prompt,
// hide service worker registration, and inform user
// about what features are unavailable on LAN-only mode.
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Proxying PocketBase Through Next.js API Routes

**What:** Creating Next.js API routes that forward requests to PocketBase.

**Why bad:** Adds latency, doubles memory usage for request handling, breaks PocketBase realtime subscriptions (SSE/WebSocket), and creates a maintenance burden keeping the proxy in sync with PocketBase API changes.

**Instead:** Let the browser talk to PocketBase directly. That is the intended architecture.

### Anti-Pattern 2: Server-Side PocketBase Admin Auth for User Requests

**What:** Using PocketBase admin credentials on the Next.js server to fetch data on behalf of users.

**Why bad:** Bypasses PocketBase API rules (security model), creates a single point of failure, and means Next.js must re-implement authorization logic.

**Instead:** Client-side auth via PB JS SDK. The user's token is sent directly to PocketBase, which enforces collection-level API rules.

### Anti-Pattern 3: Storing Computed State in the Database

**What:** Storing `next_due_date`, `is_overdue`, or `coverage_percentage` as database fields.

**Why bad:** Creates stale data that must be kept in sync. Due dates and overdue status change every second without any writes. The spec explicitly says "next due date is computed, never stored."

**Instead:** Compute `next_due = last_completion + frequency_days` at query time. PocketBase supports computed filters. The browser can also compute locally.

### Anti-Pattern 4: Multiple Volumes

**What:** Separate Docker volumes for PocketBase data, Next.js cache, uploads, etc.

**Why bad:** Violates the "one folder backup" constraint. Users expect `cp -r ./data backup/` to capture everything.

**Instead:** All persistence under `./data`. PocketBase uses `./data/pb_data/`. If Next.js needs persistent cache, put it under `./data/cache/` (but for single-instance, the default in-memory + filesystem cache is fine without explicit persistence).

### Anti-Pattern 5: Running PocketBase Behind Next.js Rewrites

**What:** Using `next.config.js` rewrites to route `/pb/*` to `localhost:8090`.

**Why bad:** Breaks WebSocket/SSE for realtime subscriptions. Adds complexity. Requires careful header forwarding. Masks PocketBase errors.

**Instead:** Expose both ports. In reverse-proxy deployments (Caddy, Traefik), the proxy handles routing, not Next.js.

## Docker Image Structure

### Multi-Stage Dockerfile Strategy

```
Stage 1: deps (node:22-alpine)
  - Copy package.json + lockfile
  - npm ci

Stage 2: builder (node:22-alpine)
  - Copy source + deps from stage 1
  - next build (produces .next/standalone)

Stage 3: runner (node:22-alpine)
  - Copy .next/standalone from builder
  - Copy .next/static from builder
  - Copy public/ from builder
  - Download PocketBase binary (multi-arch: amd64 or arm64)
  - Copy pb_migrations/
  - Install supervisord (pip or apk)
  - Copy supervisord.conf
  - EXPOSE 3000 8090
  - HEALTHCHECK /api/health
  - CMD ["supervisord", "-c", "/etc/supervisord.conf"]
```

**Image size budget (~300MB target):**
- node:22-alpine base: ~130MB
- Next.js standalone: ~50-80MB
- PocketBase binary: ~20MB
- supervisord + Python: ~40MB
- Static assets + migrations: ~10MB

**Alternative for smaller images:** Use s6-overlay instead of supervisord to avoid the Python dependency. s6 is a C-based process supervisor (~5MB) commonly used in Alpine containers. This could save 30-35MB.

### PocketBase Binary Download (Multi-Arch)

```dockerfile
ARG TARGETARCH
RUN wget -O /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v0.25.x/pocketbase_0.25.x_linux_${TARGETARCH}.zip" \
    && unzip /tmp/pb.zip -d /app/ \
    && rm /tmp/pb.zip
```

Docker's `TARGETARCH` build arg is automatically set during multi-platform builds (`docker buildx build --platform linux/amd64,linux/arm64`).

## Reverse Proxy Patterns (Deployment Variants)

### LAN-Only (Default)

```yaml
# docker-compose.yml
services:
  homekeep:
    image: ghcr.io/owner/homekeep:latest
    ports:
      - "3000:3000"   # Next.js UI
      - "8090:8090"   # PocketBase API
    volumes:
      - ./data:/app/data
    environment:
      - NTFY_URL=https://ntfy.sh
```

Browser accesses `http://<lan-ip>:3000` for the UI and `http://<lan-ip>:8090` for PocketBase API.

### Caddy (Public Domain)

```yaml
# docker-compose.caddy.yml (extends base)
services:
  caddy:
    image: caddy:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
```

```
# Caddyfile
homekeep.example.com {
    handle /api/* {
        reverse_proxy homekeep:8090
    }
    handle /_/* {
        reverse_proxy homekeep:8090
    }
    handle {
        reverse_proxy homekeep:3000
    }
}
```

With Caddy, both services are behind one domain. `NEXT_PUBLIC_POCKETBASE_URL` is set to `https://homekeep.example.com` (Caddy routes API paths to PocketBase).

### Tailscale Sidecar

```yaml
# docker-compose.tailscale.yml (extends base)
services:
  tailscale:
    image: tailscale/tailscale
    environment:
      - TS_AUTHKEY=${TS_AUTHKEY}
      - TS_SERVE_CONFIG=/config/serve.json
    volumes:
      - ts_state:/var/lib/tailscale
      - ./ts-serve.json:/config/serve.json
```

Tailscale provides HTTPS certificates automatically. The serve config proxies to the homekeep container.

## Suggested Build Order (Dependencies)

The architecture dictates this build sequence:

```
Phase 0: Container Foundation
  [Dockerfile] --> [supervisord config] --> [PocketBase binary] --> [Next.js hello]
  Deliverable: docker compose up shows a page, both processes running

Phase 1: Data Layer
  [PB migrations (schema)] --> [PB API rules] --> [PB JS SDK client setup]
  Dependency: Phase 0 (need PocketBase running)
  Deliverable: Can create/read data via PB admin and SDK

Phase 2: Core UI
  [Next.js App Router pages] --> [PB SDK integration in browser] --> [Auth flow]
  Dependency: Phase 1 (need schema + SDK)
  Deliverable: Working auth, task CRUD in browser

Phase 3: Views & Computation
  [Three-band view] --> [Coverage computation] --> [By Area view]
  Dependency: Phase 2 (need data + auth + UI foundation)

Phase 4: Multi-User
  [Invite system] --> [Cascading assignment] --> [Person view]
  Dependency: Phase 2 (need auth), Phase 1 (need schema)

Phase 5: Background Processing
  [node-cron scheduler] --> [Overdue detection] --> [ntfy integration]
  Dependency: Phase 1 (need data), Phase 0 (runs inside Next.js process)

Phase 6: Deployment Variants
  [Caddy compose] --> [Tailscale compose] --> [PWA manifest] --> [HTTPS detection]
  Dependency: Phase 0 (base container), Phase 2 (UI exists)
```

**Critical path:** Phase 0 -> Phase 1 -> Phase 2. Everything else can be parallelized after Phase 2.

**Key dependency insight:** The scheduler (Phase 5) and deployment variants (Phase 6) have no dependency on each other or on Phase 3/4. They can be built in any order after the core is functional.

## Scalability Considerations

| Concern | 1-2 users (target) | 5-10 users | Notes |
|---------|---------------------|------------|-------|
| SQLite concurrency | No concern | WAL mode handles reads fine; writes serialize but are infrequent | PocketBase uses WAL by default |
| Memory | ~100-150MB total | ~200MB | Pi 4 (8GB) has headroom |
| CPU | Negligible | Negligible | Household tasks are low-frequency operations |
| Storage | <10MB/year | <50MB/year | Text data only (no photos in v1) |
| Realtime connections | 2-4 SSE connections | 5-10 | PocketBase handles thousands; not a concern |
| Node-cron overhead | Trivial | Trivial | One hourly tick, reads a few hundred records max |

**HomeKeep is not a scale problem.** A Raspberry Pi 4 can run this comfortably for its entire useful life. Architecture decisions should optimize for simplicity and operational ease, not throughput.

## Sources

- Next.js self-hosting documentation (verified via WebFetch, v16.2.4, 2026-04-15): standalone output, Docker deployment, environment variables, caching, graceful shutdown
- Next.js official Docker example: `github.com/vercel/next.js/tree/canary/examples/with-docker`
- PocketBase documentation (pocketbase.io/docs): standard deployment pattern, JS SDK browser-direct architecture, SQLite storage, migration system
- SPEC.md sections 13 (Tech stack), 14 (Repo layout), 15 (Docker requirements)
- PROJECT.md constraints (single container, single volume, multi-arch)

**Confidence notes:**
- HIGH: Next.js standalone + Docker pattern (verified with official docs)
- HIGH: PocketBase browser-direct SDK pattern (canonical usage, well-documented)
- MEDIUM: supervisord as process manager (standard Docker pattern, but s6-overlay is a viable alternative worth evaluating in Phase 0)
- HIGH: Multi-stage Dockerfile with TARGETARCH for multi-arch (standard Docker buildx pattern)
