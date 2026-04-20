# Domain Pitfalls

**Domain:** Self-hosted household maintenance PWA (Next.js + PocketBase in Docker)
**Researched:** 2026-04-20
**Overall confidence:** MEDIUM-HIGH (based on well-documented ecosystem issues; web search unavailable for latest confirmation)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture problems.

### Pitfall 1: SQLite Database Locking Under Docker Volume Mounts

**What goes wrong:** PocketBase uses SQLite with WAL (Write-Ahead Logging) mode. When the SQLite database file lives on a Docker volume backed by certain filesystems (notably NFS, CIFS/SMB, or some network-attached storage), WAL mode either silently fails or produces `SQLITE_BUSY` / `database is locked` errors. This is the single most common production failure for PocketBase-in-Docker deployments.

**Why it happens:** WAL mode requires shared-memory primitives (`mmap`) that only work correctly on local filesystems. Docker bind mounts to local ext4/btrfs/APFS are fine. Docker named volumes are fine. But users running on Synology NAS (Btrfs over SMB), Unraid (shfs), or NFS-mounted paths hit this wall.

**Consequences:** Intermittent write failures, data corruption in worst case, completions lost silently if error handling is poor.

**Prevention:**
- Document clearly: `./data` MUST be on a local filesystem, not a network share
- Set `PRAGMA journal_mode=WAL` explicitly and verify it on startup (PocketBase does this by default, but confirm)
- Add a startup health check that does a test write/read cycle to catch bad mounts early
- In the Docker health check endpoint (`/api/health`), include a lightweight DB write test, not just an HTTP 200
- Consider adding `PRAGMA busy_timeout=5000` to handle brief lock contention from concurrent requests

**Detection:** Users report "random 500 errors" or "tasks sometimes don't save." Check `journal_mode` with a debug endpoint.

**Phase relevance:** Phase 0 (Docker scaffold) -- get the volume mount and health check right from day one.

---

### Pitfall 2: Next.js Standalone Output Missing Files

**What goes wrong:** When using `output: 'standalone'` in `next.config.js`, Next.js traces dependencies and copies only what it thinks the server needs into `.next/standalone`. But it frequently misses:
- The `public/` directory (icons, manifest.json, PWA assets)
- The `.next/static/` directory (client-side JS/CSS bundles)
- Certain native Node modules or `.node` bindings
- Sharp (image optimization library) native binaries

The result: the Docker image builds and starts, but serves 404s for static assets, the PWA manifest, or icons.

**Why it happens:** The standalone trace is conservative and only follows `import`/`require` chains. Static files accessed by URL (not imported) are not traced. This is documented behavior but almost every team hits it the first time.

**Consequences:** Broken PWA install (manifest.json 404), missing icons, missing CSS, broken service worker -- app looks completely broken despite the server running fine.

**Prevention:**
- In the Dockerfile, explicitly copy `public/` and `.next/static/` into the standalone directory:
  ```dockerfile
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  COPY --from=builder /app/public ./public
  ```
- Add a CI test that curls key static assets after container start (manifest.json, main CSS bundle, app icons)
- Do NOT rely on `next start` working identically in standalone mode vs. development -- test in Docker early

**Detection:** Visit the app in a browser, open DevTools Network tab. 404s on `/manifest.json`, `/_next/static/*`, or icon paths.

**Phase relevance:** Phase 0 (Dockerfile creation). Get this right in the initial multi-stage Dockerfile and never touch it again.

---

### Pitfall 3: Environment Variables at Build Time vs. Runtime

**What goes wrong:** Next.js bakes `NEXT_PUBLIC_*` environment variables into the JavaScript bundle at `next build` time. They cannot be changed at runtime. This means if you build a Docker image with `NEXT_PUBLIC_API_URL=http://localhost:8090` in CI, every user who pulls that image gets that hardcoded URL. The app cannot discover its own PocketBase backend at runtime.

**Why it happens:** Next.js's static optimization inlines public env vars for performance. This is correct for Vercel deployments but fundamentally broken for distributable Docker images where the hostname varies per deployment.

**Consequences:** The app either connects to the wrong backend URL, or you must force users to rebuild the image themselves, defeating the purpose of publishing to GHCR.

**Prevention:**
- Do NOT use `NEXT_PUBLIC_*` for any URL that varies per deployment
- Instead, use a runtime configuration pattern:
  1. Serve a `/api/config` endpoint from the Next.js server that reads env vars at runtime and returns them as JSON
  2. Client-side code fetches config on app init (or use a React context provider that loads config before rendering)
  3. Alternatively, use a `__ENV.js` script injected into the HTML `<head>` at container start time via an entrypoint script that does string replacement
- For the PocketBase URL specifically: since both processes run in the same container, the server-side can always use `http://localhost:8090`. The client needs to reach PocketBase through the same host the browser used to load the page. Use `window.location.origin` as the base and proxy PocketBase through Next.js API routes, OR use relative URLs if PocketBase is reverse-proxied under the same domain.

**Detection:** Deploy the published Docker image on a different machine. If the browser console shows requests to `localhost:8090` or the CI build host, you hit this.

**Phase relevance:** Phase 0 (scaffold) and Phase 1 (auth). Must be solved before any client-side PocketBase SDK calls exist.

---

### Pitfall 4: Two Processes in One Container Without Proper Lifecycle Management

**What goes wrong:** HomeKeep runs Next.js (Node) and PocketBase (Go binary) in a single container. If you just background one process (`pocketbase serve &` then `node server.js`), you get:
- No restart if PocketBase crashes (Node keeps running, app looks "up" but DB is dead)
- Docker health check passes (HTTP 200 from Next.js) while PocketBase is down
- Zombie processes accumulate (no init system to reap them)
- `docker stop` sends SIGTERM only to PID 1 (Node), PocketBase never gets a clean shutdown, potential WAL checkpoint issues

**Why it happens:** Docker expects one process per container. Running two requires explicit process management.

**Consequences:** Silent data layer failures, unclean shutdowns corrupting WAL, zombie process buildup on long-running containers.

**Prevention:**
- Use `tini` as the entrypoint (already in `node:22-alpine` as `/sbin/tini`). It handles zombie reaping and signal forwarding.
- Write a small shell entrypoint script that:
  1. Starts PocketBase in background
  2. Waits for PocketBase to be healthy (poll `http://localhost:8090/api/health`)
  3. Starts Node.js server as PID 1 (via `exec`)
  4. Traps SIGTERM to kill PocketBase first
- OR use a lightweight process manager: `s6-overlay` (Alpine-friendly, ~2MB, production-grade) is better than `supervisord` (Python, heavy). Avoid `supervisord` in Alpine -- it pulls in Python.
- The `/api/health` endpoint MUST check both processes: Next.js responds AND PocketBase is reachable
- Consider: if PocketBase dies, the Node process should exit too (fail-fast), letting Docker's restart policy bring everything back

**Detection:** `docker exec <container> ps aux` shows zombie processes. Or: stop PocketBase manually inside the container (`kill <pb_pid>`) and see if the health check still passes.

**Phase relevance:** Phase 0 (Dockerfile and entrypoint). This is foundational infrastructure.

---

## Moderate Pitfalls

### Pitfall 5: PWA Without HTTPS -- Service Worker and Install Prompt Limitations

**What goes wrong:** Service workers only register on HTTPS origins (with one exception: `localhost`). The PWA install prompt (Add to Home Screen) similarly requires HTTPS and a valid manifest. In the "LAN only" deployment mode (`http://192.168.1.x:3000`), users get:
- No service worker registration (no offline caching)
- No install prompt (cannot add to home screen on mobile)
- No Web Push notifications (irrelevant here since using ntfy, but worth noting)
- On iOS Safari, no service worker means no app-like behavior at all

**Why it happens:** Browser security policy. Non-localhost HTTP is considered insecure context. This is not a bug, it is by design.

**Consequences:** LAN-only users get a degraded experience that feels like "just a website." The spec explicitly says this is acceptable (principle 6: progressive enhancement), but the app must gracefully communicate this.

**Prevention:**
- Detect secure context in JavaScript: `window.isSecureContext`
- Show a non-dismissable but non-blocking banner on insecure contexts: "Running over HTTP -- install as app and offline mode unavailable. Set up HTTPS for the full experience." with a link to deployment docs
- Do NOT attempt to register the service worker on insecure context (it will throw, and unhandled it looks like a bug)
- Wrap ALL service worker registration in `if ('serviceWorker' in navigator && window.isSecureContext)`
- Test the LAN-only mode explicitly in CI or manual QA -- it is easy to develop only on localhost (where SW works) and never test the real LAN deployment

**Detection:** Open app on phone via LAN IP. Check if "Add to Home Screen" appears. If not, and no explanation is shown, users will file bugs.

**Phase relevance:** Phase 0 (PWA manifest setup), Phase 2 (UI -- the degradation banner), Phase 7 (deployment docs).

---

### Pitfall 6: PocketBase Migrations in Docker -- Schema Drift

**What goes wrong:** PocketBase supports auto-migration via `pb_migrations/` JavaScript files. But the migration story has sharp edges:
- Migrations run on PocketBase startup. If a migration fails, PocketBase exits. If this happens in Docker with `restart: always`, you get a crash loop.
- There is no built-in rollback mechanism. A bad migration requires manual SQLite surgery.
- If you develop using the PocketBase admin UI (which auto-generates migration files), those files may conflict with hand-written migrations.
- The migration files are JavaScript executed by PocketBase's embedded JS runtime (not Node.js), which has a limited API surface.

**Why it happens:** PocketBase is opinionated about schema-as-code but the tooling is still maturing compared to Prisma/Drizzle migration systems.

**Consequences:** Failed deployments on version upgrades, inability to rollback, schema drift between development and production.

**Prevention:**
- NEVER edit schema through the PocketBase admin UI in production. All changes go through migration files committed to git.
- In development, use the admin UI freely but always export the resulting migration files and commit them.
- Add a pre-deploy step in CI that starts PocketBase with a fresh DB, runs all migrations, and verifies the schema matches expectations.
- Back up the SQLite file BEFORE any migration (the entrypoint script should `cp data/pb_data/data.db data/pb_data/data.db.premigrate` before starting PocketBase).
- Keep migrations small and incremental. One change per file.
- Test migrations against a copy of production data, not just fresh databases.

**Detection:** PocketBase container enters crash loop after image update. Logs show migration error.

**Phase relevance:** Phase 1 (initial schema) and every subsequent phase that changes the schema. Establish the migration workflow in Phase 1 and never deviate.

---

### Pitfall 7: Multi-Arch Docker Builds -- QEMU Emulation Pain

**What goes wrong:** Building `linux/arm64` images on an `amd64` GitHub Actions runner uses QEMU user-space emulation. This makes the build:
- 5-10x slower (a 3-minute build becomes 20-30 minutes)
- Prone to segfaults in QEMU, especially during `npm install` with native modules
- Flaky -- the same build may pass or fail randomly due to QEMU bugs
- Sharp (image optimization) and other native modules may fail to compile under emulation

**Why it happens:** QEMU emulates an entire CPU architecture in software. Complex operations (JIT compilation during npm install, native addon builds) hit edge cases.

**Consequences:** CI builds take 30+ minutes, fail intermittently, and developers avoid running the full matrix, leading to broken ARM images discovered only by Raspberry Pi users.

**Prevention:**
- Use native ARM runners if available (GitHub now offers `ubuntu-24.04-arm` runners for public repos)
- If QEMU is unavoidable, split the build:
  1. Build `amd64` natively
  2. Build `arm64` natively on an ARM runner (or accept QEMU slowness)
  3. Use `docker buildx imagetools create` to combine into a multi-arch manifest
- Avoid native Node modules where possible. Use `sharp` with the pre-built `libvips` binaries (set `SHARP_IGNORE_GLOBAL_LIBVIPS=1` and let npm pull the correct prebuilt binary per platform)
- Pin the QEMU version in CI (`docker/setup-qemu-action@v3` with a specific image)
- Cache aggressively: Docker layer cache, npm cache, buildx cache (`--cache-to` / `--cache-from` with GitHub Actions cache or registry cache)
- Consider: skip image optimization entirely in v1 (user-uploaded photos can be resized client-side before upload) to avoid the Sharp dependency altogether

**Detection:** CI arm64 builds fail with SIGSEGV or take >20 minutes. ARM users report "exec format error" when pulling the image.

**Phase relevance:** Phase 0 (CI pipeline) and Phase 7 (release pipeline hardening).

---

### Pitfall 8: PocketBase Client-Side SDK and Next.js SSR Mismatch

**What goes wrong:** The PocketBase JavaScript SDK maintains an auth store (token + user model) that is designed for client-side SPAs. When used in Next.js with SSR (Server Components, server actions), you hit:
- The SDK's default `LocalAuthStore` uses `localStorage`, which does not exist on the server
- Server Components cannot access the client-side auth token without explicit cookie forwarding
- Race conditions where the server renders "logged out" state while the client has a valid token, causing hydration mismatches
- API calls from Server Components go to `localhost:8090` (correct inside the container) but client calls need the external URL

**Why it happens:** PocketBase SDK was built for SPA patterns. Next.js App Router blurs the client/server boundary. The two mental models clash.

**Consequences:** Auth appears broken (flash of logged-out state on page load), hydration errors in console, SSR pages always render as if unauthenticated.

**Prevention:**
- Use a cookie-based auth store for PocketBase: store the PB auth token in an HTTP-only cookie so it is available on both client and server
- Create a server-side PocketBase client factory that reads the auth cookie from the request headers
- Create a client-side PocketBase client that syncs with the cookie
- For Server Components that need auth: read the cookie via `cookies()` from `next/headers` and pass it to the PocketBase client
- Consider making the app primarily client-rendered for authenticated routes (use `'use client'` liberally for the main app shell) and reserve Server Components for the public landing page / login
- Use Next.js middleware to handle token refresh and cookie management

**Detection:** Log in, navigate to a page. See a brief flash of the login screen before content appears. Or: Server Component API calls return 401 while client-side calls work fine.

**Phase relevance:** Phase 1 (auth implementation). This must be solved correctly from the start or it infects every subsequent feature.

---

### Pitfall 9: Docker Data Volume Permissions

**What goes wrong:** The PocketBase binary and Node.js process may run as different users inside the container. The `./data` volume mount inherits the host filesystem's ownership. Common failure: PocketBase creates `pb_data/` as root, then a non-root Node process cannot read it, or vice versa.

**Why it happens:** Alpine Node images run as `node` user (UID 1000) by default if you use `USER node`. PocketBase does not have a built-in user concept. Bind mounts inherit host UID/GID.

**Consequences:** Permission denied errors on startup, or only one of the two processes can write to the data directory.

**Prevention:**
- Run both processes as the same user in the Dockerfile
- Use a consistent UID/GID: either both as root (simpler but less secure) or both as a dedicated `homekeep` user
- In the entrypoint script, `chown` the data directory before starting services (if running as root)
- Document that the `./data` directory must be writable by UID 1000 (or whatever is chosen)
- If using `USER node`, ensure PocketBase is also started as that user
- Test with `docker compose up` as a non-root host user to catch permission issues

**Detection:** Container starts, one process crashes with EACCES or "permission denied" errors in logs.

**Phase relevance:** Phase 0 (Dockerfile).

---

### Pitfall 10: PocketBase Realtime Subscriptions Through Reverse Proxies

**What goes wrong:** PocketBase's realtime API uses Server-Sent Events (SSE). When deployed behind Nginx Proxy Manager, Traefik, or Caddy, the reverse proxy may:
- Buffer SSE responses (Nginx default behavior), causing events to arrive in batches instead of real-time
- Time out long-lived connections (default 60s proxy timeouts)
- Not pass through the correct headers for SSE

**Why it happens:** Reverse proxies are designed for request-response HTTP, not long-lived streaming connections.

**Consequences:** Realtime updates (new completions by partner, task assignments) arrive late or not at all. Users see stale data.

**Prevention:**
- For Caddy (the recommended proxy): no special config needed -- Caddy handles SSE correctly out of the box
- For Nginx (NPM uses Nginx): add `proxy_buffering off;` and increase `proxy_read_timeout`
- Document proxy requirements in DEPLOYMENT.md for each supported reverse proxy
- Add a client-side heartbeat: if no SSE events arrive for N seconds, reconnect
- PocketBase SDK handles reconnection automatically, but test it behind each proxy type
- Consider: for v1, poll every 30 seconds as a fallback when SSE fails, rather than debugging every proxy configuration

**Detection:** Partner completes a task. Other partner's view does not update until they manually refresh.

**Phase relevance:** Phase 7 (deployment variants). But the client-side reconnection logic should be in Phase 1.

---

## Minor Pitfalls

### Pitfall 11: node-cron Scheduler Drift in Containers

**What goes wrong:** The spec calls for an in-app scheduler (node-cron) for overdue detection and ntfy notifications. If the container runs for weeks, timer drift can accumulate. More importantly, if the container restarts, the scheduler resets and may re-fire notifications.

**Prevention:**
- Store "last notification sent" timestamps in PocketBase to deduplicate
- On startup, check what notifications were already sent before scheduling new ones
- Use absolute times ("fire at minute 0 of every hour") not relative intervals
- Consider the container's timezone vs. the home's timezone setting

**Phase relevance:** Phase 5 (notifications).

---

### Pitfall 12: PocketBase Version Pinning

**What goes wrong:** PocketBase is still pre-1.0 (as of early 2025, v0.25+). Breaking changes between minor versions are common. If the Dockerfile pulls `latest`, a rebuild can break everything.

**Prevention:**
- Pin PocketBase to an exact version in the Dockerfile: `POCKETBASE_VERSION=0.25.9` (or latest stable at development time)
- Test PocketBase upgrades in a separate branch before bumping
- Document the PocketBase version in the README

**Phase relevance:** Phase 0 (Dockerfile).

---

### Pitfall 13: Tailscale Sidecar Container Networking

**What goes wrong:** The Tailscale sidecar compose variant requires `network_mode: service:tailscale` on the app container, which means the app container loses its own network namespace. Port mappings (`ports:`) on the app container are ignored. The app is only reachable via the Tailscale IP.

**Prevention:**
- The Tailscale compose file must NOT include `ports:` on the app service
- Document that in Tailscale mode, the app is only accessible via `https://homekeep.tailnet-name.ts.net`
- Provide a clear "which compose file should I use?" decision tree in DEPLOYMENT.md
- Test that the Tailscale container can obtain a certificate (requires `tailscale up --hostname=homekeep` and HTTPS cert provisioning)

**Phase relevance:** Phase 7 (deployment variants).

---

### Pitfall 14: iOS PWA Limitations (Even With HTTPS)

**What goes wrong:** Even when served over HTTPS, iOS PWAs (added to home screen via Safari) have limitations:
- No background sync
- Service worker cache is aggressively purged after ~7 days of non-use
- No push notification support via Web Push (this is why HomeKeep uses ntfy -- good call)
- Camera access for photo uploads works but has quirks with `<input type="file" accept="image/*">`
- No badge API support

**Prevention:**
- Do not rely on service worker cache for critical data persistence on iOS
- The ntfy approach sidesteps the biggest iOS PWA pain point (notifications)
- For photo uploads (v1.1), test on iOS Safari specifically -- use `capture="environment"` for camera access
- Inform users that iOS will re-download the app data if they haven't used it in a week

**Phase relevance:** Phase 2 (UI/PWA) and Phase 5 (notifications -- already mitigated by ntfy choice).

---

### Pitfall 15: SQLite Backup While PocketBase Is Running

**What goes wrong:** The spec says "backup = copy the folder." But copying a SQLite database while it is being written to can produce a corrupt backup. The WAL file and shared-memory file must be consistent with the main database file.

**Prevention:**
- Use PocketBase's built-in backup API (`POST /api/backups`) which does a safe `VACUUM INTO` operation
- Alternatively, use `sqlite3 data.db ".backup backup.db"` which handles WAL correctly
- Document that `cp data.db data.db.bak` while the app is running is NOT safe
- Provide a backup script or document the correct backup procedure in DEPLOYMENT.md
- For Docker users: `docker exec homekeep /app/pocketbase backup` (or equivalent)

**Phase relevance:** Phase 7 (documentation and deployment). But the backup endpoint should be exposed early.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 0 (Scaffold) | Standalone output missing files (#2), two-process lifecycle (#4), volume permissions (#9), PocketBase version pinning (#12) | Get the Dockerfile right first. Test `docker compose up` on a clean machine before moving on. |
| Phase 0 (CI) | Multi-arch QEMU failures (#7) | Start with amd64-only builds. Add arm64 after the build is stable. |
| Phase 1 (Auth) | SSR/client auth mismatch (#8), env vars at build time (#3) | Design the auth cookie pattern before writing any auth code. Solve the PocketBase URL problem with a runtime config endpoint. |
| Phase 1 (Schema) | Migration workflow (#6) | Establish migration discipline from the first schema. Never edit production via admin UI. |
| Phase 2 (PWA/UI) | PWA without HTTPS (#5), iOS limitations (#14) | Implement secure context detection early. Test on a real phone over LAN IP. |
| Phase 5 (Notifications) | Scheduler drift/duplicates (#11) | Idempotent notification logic with stored timestamps. |
| Phase 7 (Deployment) | Reverse proxy SSE buffering (#10), Tailscale networking (#13), unsafe backups (#15) | Test all three compose variants. Provide proxy-specific config snippets. Document backup procedure. |

---

## Sources and Confidence

| Pitfall | Confidence | Basis |
|---------|-----------|-------|
| SQLite WAL + Docker volumes (#1) | HIGH | Well-documented SQLite limitation, PocketBase GitHub issues |
| Standalone output missing files (#2) | HIGH | Next.js documentation explicitly states this, universally encountered |
| Env vars build vs runtime (#3) | HIGH | Next.js documented behavior, fundamental architecture issue |
| Two processes in one container (#4) | HIGH | Docker best practices, well-understood problem space |
| PWA without HTTPS (#5) | HIGH | W3C specification, browser security model |
| PocketBase migrations (#6) | MEDIUM | Based on PocketBase docs and community reports; tooling evolving |
| Multi-arch QEMU (#7) | HIGH | Widely reported in Docker community, GitHub Actions known limitation |
| PocketBase SDK + SSR (#8) | HIGH | Common pattern problem documented in PocketBase + Next.js community |
| Volume permissions (#9) | HIGH | Standard Docker pitfall |
| SSE through proxies (#10) | MEDIUM | Proxy-specific; Caddy handles it well, Nginx needs config |
| node-cron drift (#11) | MEDIUM | Minor issue, standard mitigation |
| PocketBase version pinning (#12) | HIGH | Pre-1.0 software, breaking changes documented in changelogs |
| Tailscale networking (#13) | MEDIUM | Docker network mode behavior, Tailscale docs |
| iOS PWA limitations (#14) | HIGH | Apple platform limitations, well-documented |
| SQLite backup safety (#15) | HIGH | SQLite documentation, fundamental database safety |

**Note:** Web search was unavailable during this research. All findings are based on established, well-documented ecosystem issues. Confidence levels reflect the maturity and stability of the underlying knowledge -- these are not speculative issues but repeatedly confirmed patterns. However, specific version numbers and latest workarounds should be verified against current documentation during implementation.
