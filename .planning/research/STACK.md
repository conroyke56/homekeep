# Technology Stack

**Project:** HomeKeep
**Researched:** 2026-04-20
**Verification note:** Bash, WebSearch, and WebFetch were unavailable during this research session. Versions are based on training data (cutoff May 2025) and should be verified with `npm info <package> version` before scaffolding. Confidence levels reflect this limitation.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 15.x (latest stable) | Frontend + SSR + API routes | App Router with `output: 'standalone'` produces a minimal self-contained Node.js server -- perfect for Docker. Server Components reduce client JS. The spec already chose this; it is correct for a self-hosted PWA that needs SSR for initial load performance on a Raspberry Pi. | MEDIUM |
| TypeScript | 5.x | Type safety | Non-negotiable for a project with computed dates, cascading logic, and multiple data entities. Catches frequency math bugs at compile time. | HIGH |
| Node.js | 22 LTS (Alpine) | Runtime | LTS with long support window. Alpine keeps Docker image small. The spec calls for `node:22-alpine` base image. | MEDIUM |

**Version verification needed:** Next.js 15 was stable as of late 2024. By April 2026, Next.js 15.x may have newer patch versions, or Next.js 16 may exist. Pin to the latest 15.x stable at scaffold time. Check `npm info next version`.

### Database + Auth

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PocketBase | 0.25+ (latest) | DB, auth, file storage, realtime | Single Go binary with embedded SQLite. One `pb_data` folder = entire database + uploaded files. Built-in email/password auth, admin UI, REST API, realtime subscriptions. Perfect for self-hosted: zero external dependencies, backs up by copying a folder. | MEDIUM |
| PocketBase JS SDK | 0.25+ (matching server) | Client library | Official TypeScript SDK. Handles auth tokens, realtime subscriptions, file URLs. Must match PocketBase server version. | MEDIUM |

**Critical note on PocketBase versions:** PocketBase was at v0.22-0.25 range as of early 2025. The API has been stable but pre-1.0, meaning minor versions can include breaking changes. Pin the PocketBase binary version in your Dockerfile and the JS SDK version in package.json. Always upgrade both together.

**Why PocketBase over alternatives:**
- vs. Supabase: Supabase requires PostgreSQL + multiple services. Violates self-hosted simplicity.
- vs. SQLite directly: PocketBase gives you auth, admin UI, realtime, file storage for free. Building that from scratch in Next.js API routes would be weeks of work.
- vs. Drizzle/Prisma + SQLite: Still need to build auth, admin, file uploads. PocketBase is the right abstraction level for this project.

### Styling + Components

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | 4.x | Utility-first CSS | v4 shipped stable in early 2025. New CSS-first config, faster builds, automatic content detection. If v4 has rough edges at scaffold time, fall back to 3.4.x -- but v4 should be mature by now. | MEDIUM |
| shadcn/ui | latest (not versioned as npm package) | Component library | Not a dependency -- copies component source into your project. You own the code, can customize everything. Perfect for the "warm, calm, domestic" aesthetic the spec demands. No runtime dependency, no version lock-in. | HIGH |
| Radix UI Primitives | (via shadcn/ui) | Accessible headless components | shadcn/ui is built on Radix. These provide keyboard navigation, ARIA, focus management out of the box. Critical for completion dialogs, menus, dropdowns. | HIGH |
| lucide-react | latest | Icons | Spec explicitly calls for lucide-react. Consistent stroke weight, tree-shakeable, covers all needed icons (home, kitchen, bathroom, checkmark, calendar, bell). | HIGH |
| class-variance-authority | latest | Component variants | Used by shadcn/ui for variant management. Already included when you init shadcn. | HIGH |
| clsx + tailwind-merge | latest | Class composition | Standard shadcn/ui utility. The `cn()` helper. | HIGH |

**Tailwind v4 vs v3 decision:** Tailwind v4 uses CSS-based configuration instead of `tailwind.config.js`. If using shadcn/ui, verify that `shadcn init` supports Tailwind v4 at scaffold time. As of early 2025, shadcn/ui was adding v4 support. If it is not seamless, use Tailwind 3.4.x -- the visual output is identical.

### PWA

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| next-pwa OR @serwist/next | latest | Service worker + manifest | Generates service worker for offline caching, handles manifest.json. `next-pwa` was the standard but may be unmaintained; `@serwist/next` is its maintained successor (Serwist). Check which is active at scaffold time. | LOW |
| Web App Manifest | N/A (manual) | PWA installability | Hand-written `manifest.json` in `/public`. Simple enough to not need a library. Define name, icons, theme_color, display: standalone. | HIGH |

**PWA strategy for this project:**
- Cache the app shell and static assets for offline loading
- API calls (PocketBase) require network -- no offline write sync (spec explicitly says this)
- Service worker registration must detect insecure context and skip gracefully on plain HTTP (LAN mode)
- On HTTPS contexts, enable install prompt and push notification registration

### Notifications

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ntfy | External service | Push notifications | Spec is firm on this. No VAPID keys, no service worker push complexity, works on iOS (via ntfy app). Users subscribe to their topic in the ntfy app. Server POSTs to ntfy HTTP API. | HIGH |
| node-cron | 3.x | Scheduled checks | Lightweight in-process cron. Runs hourly to check for newly-overdue tasks and POST to ntfy. No external job queue needed for a single-home app. | HIGH |

**Why ntfy over Web Push:**
- Web Push on iOS PWAs is unreliable and requires HTTPS + VAPID setup
- ntfy works on LAN-only mode (plain HTTP to ntfy.sh or self-hosted ntfy)
- Zero configuration on the server side -- just HTTP POST
- Users already in the self-hosted ecosystem likely know ntfy

### Data Fetching + State

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PocketBase JS SDK | (see above) | Data fetching | The SDK handles auth, CRUD, realtime subscriptions. No need for a separate fetching layer. | HIGH |
| React Server Components | (built into Next.js 15) | Server-side data loading | Fetch PocketBase data on the server for initial page loads. Reduces client-side JS. Perfect for the three-band view which is mostly read-heavy. | HIGH |
| React Context or Zustand | latest (if needed) | Client state | For auth state and optimistic UI updates on task completion. Start with React Context; add Zustand only if state sharing becomes complex across the bottom nav views. Do NOT start with a state management library -- add it when pain appears. | MEDIUM |

**What NOT to use for data fetching:**
- TanStack Query: Overkill when PocketBase SDK already handles caching and realtime. Would add a redundant abstraction layer.
- SWR: Same reasoning. PocketBase's realtime subscriptions replace the need for polling/revalidation.
- tRPC: No separate API to type -- PocketBase IS the API.

### Date/Time Handling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| date-fns | 3.x or 4.x | Date math + formatting | Tree-shakeable, immutable, no global side effects. Needed for frequency calculations (add days, difference in days, format relative dates). The three-band view and coverage ring depend heavily on date math. | MEDIUM |

**Why date-fns over alternatives:**
- vs. dayjs: dayjs uses a mutable wrapper object pattern. date-fns operates on native Date objects. For computed fields like "days overdue" and "next due date," pure functions on native Dates are cleaner.
- vs. Temporal API: Not yet shipped in all runtimes. Node 22 may have partial support but it is not safe to depend on for production.
- vs. Luxon: Larger bundle, designed for timezone-heavy work. HomeKeep stores timezone per home but the date math is simple integer-day arithmetic.

### Form Handling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React Hook Form | 7.x | Form state + validation | Task creation, home settings, user preferences, first-run wizard -- lots of forms. RHF is uncontrolled-first (performant), works with Zod for schema validation. | HIGH |
| Zod | 3.x | Schema validation | Validate task frequency (positive integer), email format, form inputs. Share validation schemas between client and server (API routes). | HIGH |

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | 2.x | Unit + integration tests | Fast, ESM-native, compatible with Next.js. Test coverage ring math, cascading assignment logic, date calculations, early-completion guard logic. | MEDIUM |
| Playwright | latest | E2E tests | Test the critical path: login, create home, add task, complete task, verify three-band view updates. Run in CI against Docker compose. | MEDIUM |
| Testing Library | latest | Component tests | `@testing-library/react` for testing UI components in Vitest. | HIGH |

### Docker + CI/CD

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Docker multi-stage build | N/A | Image optimization | Stage 1: install deps + build. Stage 2: copy standalone output + PocketBase binary. Target < 300MB. | HIGH |
| docker compose | v2 | Local orchestration | Three compose files per spec: default (LAN), Caddy, Tailscale. | HIGH |
| GitHub Actions | N/A | CI/CD | Build + test on PR. Multi-arch build (`docker/build-push-action` with QEMU) on tag push to GHCR. | HIGH |
| Caddy | 2.x | Reverse proxy (optional) | Automatic HTTPS for public domain mode. Single binary, simple Caddyfile. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.x | Generate ntfy topic IDs, invite tokens | User creation, invite generation |
| sharp | latest | Image optimization | If photo attachments are added in v1.1 |
| next-themes | latest | Dark/light mode toggle | Phase 6 (polish) |
| framer-motion | latest | Micro-interactions | Completion animation, band transitions. Use sparingly per spec aesthetic. |
| sonner | latest | Toast notifications | In-app feedback on task completion, errors |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 (App Router) | Remix / SvelteKit | Next.js standalone output is purpose-built for Docker. Larger ecosystem, more shadcn/ui compatibility. |
| Framework | Next.js 15 (App Router) | Next.js Pages Router | App Router with Server Components is the future. Pages Router is maintenance mode. |
| Database | PocketBase | Drizzle + better-sqlite3 | Would need to build auth, admin UI, file storage, realtime from scratch. Months of work for no benefit. |
| Database | PocketBase | Supabase | Requires PostgreSQL + multiple services. Violates single-binary, self-hosted simplicity. |
| CSS | Tailwind + shadcn/ui | Material UI / Ant Design | Heavy runtime, opinionated aesthetics that conflict with the "warm, domestic" design direction. Cannot easily customize. |
| CSS | Tailwind + shadcn/ui | CSS Modules | No component library benefit. Would need to build every component from scratch. |
| Notifications | ntfy | Web Push API | Requires HTTPS, VAPID keys, service worker complexity. Broken on iOS PWAs. Does not work in LAN-only mode. |
| Notifications | ntfy | Firebase Cloud Messaging | Cloud dependency. Violates no-cloud, no-telemetry, no-paid-APIs principle. |
| Scheduling | node-cron | BullMQ / Agenda | Requires Redis or MongoDB. Massive overkill for hourly overdue checks on a household app. |
| Icons | lucide-react | Heroicons / Phosphor | Spec explicitly chose lucide-react. Good choice -- consistent, comprehensive, tree-shakeable. |
| Date | date-fns | moment.js | Moment is deprecated and massive. Do not use. |
| State | React Context (start) | Redux | Redux is for large teams with complex state. A household app for 2-5 users does not need it. |

---

## Architecture Decisions

### Next.js + PocketBase Communication Pattern

PocketBase runs as a sidecar in Docker Compose. Next.js talks to it over the Docker network.

```
Browser <---> Next.js (port 3000) <---> PocketBase (port 8090, internal)
                                         |
                                    ./data/pb_data (SQLite + files)
```

- **Server Components** fetch from PocketBase on the server side (internal Docker network, fast)
- **Client Components** use the PocketBase JS SDK for mutations and realtime subscriptions (via browser, proxied or direct)
- **API routes** in Next.js handle ntfy POSTing and any business logic that should not be in the client

### PocketBase Client Setup

```typescript
// lib/pocketbase.ts
import PocketBase from 'pocketbase';

// Server-side: internal Docker network URL
export const pbServer = new PocketBase(
  process.env.POCKETBASE_INTERNAL_URL || 'http://pocketbase:8090'
);

// Client-side: browser-accessible URL (may be proxied through Next.js)
export const pbClient = new PocketBase(
  process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090'
);
```

### PocketBase Schema as Code

Use PocketBase migrations (`pocketbase/pb_migrations/`) to define schema. This ensures:
- Schema is version-controlled
- Fresh deployments get correct schema automatically
- Schema changes are reviewable in PRs

### Standalone Output Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Required for Docker: trust the proxy headers
  experimental: {
    // Check if this is still under experimental in your Next.js version
  },
};

module.exports = nextConfig;
```

---

## What NOT to Install

| Package | Why Not |
|---------|---------|
| `@prisma/client` / `drizzle-orm` | PocketBase handles the database. Adding an ORM creates two sources of truth for schema. |
| `next-auth` / `auth.js` | PocketBase has built-in auth. next-auth would fight it, not complement it. |
| `axios` | PocketBase SDK uses fetch internally. No need for another HTTP client. |
| `redux` / `@reduxjs/toolkit` | Overkill. Start with React Context. |
| `@tanstack/react-query` | PocketBase SDK + realtime subscriptions replace what TanStack Query does. |
| `swr` | Same as above. Redundant with PocketBase realtime. |
| `moment` / `luxon` | date-fns is lighter and sufficient. moment is deprecated. |
| `express` / `fastify` | Next.js standalone output IS the server. No separate backend needed. |
| `socket.io` | PocketBase has built-in SSE-based realtime. No WebSocket server needed. |
| `bcrypt` / `argon2` | PocketBase handles password hashing. |
| `multer` / `formidable` | PocketBase handles file uploads. |

---

## Installation (Scaffold Time)

```bash
# Create Next.js project with TypeScript + Tailwind
npx create-next-app@latest homekeep --typescript --tailwind --eslint --app --src-dir=false

# Core dependencies
npm install pocketbase date-fns zod react-hook-form nanoid node-cron
npm install lucide-react sonner next-themes

# Type definitions
npm install -D @types/node

# Initialize shadcn/ui (will prompt for config)
npx shadcn@latest init

# Add commonly needed shadcn components
npx shadcn@latest add button card dialog dropdown-menu input label tabs toast avatar badge separator sheet

# Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D playwright @playwright/test

# Framer Motion (for completion animations, Phase 6)
# npm install framer-motion  # defer until polish phase
```

**PocketBase binary (in Dockerfile):**
```dockerfile
# Download PocketBase binary for the target architecture
ARG PB_VERSION=0.25.0
ARG TARGETARCH
RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
    -O /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /usr/local/bin/ && \
    rm /tmp/pb.zip
```

**Verify PB_VERSION at scaffold time** by checking https://github.com/pocketbase/pocketbase/releases

---

## Environment Variables

```bash
# .env.example
POCKETBASE_INTERNAL_URL=http://pocketbase:8090   # Docker internal
NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090  # Browser access
NEXT_PUBLIC_APP_URL=http://localhost:3000          # For PWA manifest
NTFY_URL=https://ntfy.sh                           # Default ntfy server
NODE_ENV=production
```

---

## Version Pinning Strategy

All versions should be pinned with exact versions in package.json (no `^` prefix) to ensure reproducible builds. This is especially important for:

1. **PocketBase binary + JS SDK**: Must match. Pin both.
2. **Next.js**: Pin to avoid surprise breaking changes from minor bumps.
3. **Tailwind CSS**: Pin to avoid v3/v4 confusion.

```json
{
  "dependencies": {
    "next": "15.x.x",
    "react": "19.x.x",
    "react-dom": "19.x.x",
    "pocketbase": "0.25.x",
    "date-fns": "3.x.x",
    "zod": "3.x.x",
    "react-hook-form": "7.x.x"
  }
}
```

**Replace `x.x` with actual latest versions at scaffold time.**

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Next.js 15 + App Router | MEDIUM | Correct choice, but exact latest patch version unverified. May be 15.1+ or even 16.x by April 2026. |
| PocketBase | MEDIUM | Correct choice for self-hosted. Version may have reached 1.0 by now -- check releases. API may differ from 0.22-0.25 era. |
| Tailwind CSS | MEDIUM | v4 was releasing in early 2025. Should be stable by now, but verify shadcn/ui compatibility. |
| shadcn/ui | HIGH | Architecture (copy components, not dependency) is version-independent. Always works with latest. |
| ntfy | HIGH | Stable, simple HTTP API. Unlikely to have changed. |
| node-cron | HIGH | Stable, minimal library. Unlikely to have changed. |
| date-fns | MEDIUM | v3 was stable. v4 may exist. Either works. |
| React Hook Form + Zod | HIGH | Mature, stable ecosystem. Standard choice. |
| Docker multi-arch | HIGH | Well-established pattern. `docker/build-push-action` with QEMU. |
| PWA tooling (Serwist) | LOW | This area changes frequently. next-pwa may be dead, Serwist may have renamed. Verify at scaffold time. |

---

## Sources

- Training data knowledge (cutoff May 2025) -- all version numbers should be verified
- Project SPEC.md (technology choices already made by user)
- PocketBase documentation patterns from pocketbase.io
- Next.js App Router documentation from nextjs.org
- shadcn/ui documentation from ui.shadcn.com

**Action item for Phase 0:** Run `npm info next version`, `npm info pocketbase version`, check PocketBase GitHub releases, and verify shadcn/ui + Tailwind v4 compatibility before scaffolding.
