---
phase: 07-pwa-release
plan: 01
subsystem: infra
tags: [pwa, service-worker, serwist, manifest, secure-context, offline, next16, react19]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Next 16 App Router + standalone output + Dockerfile + public/ static serving"
  - phase: 02-auth-core-data
    provides: "Shadcn theme tokens (bg-accent, border-border) + tests/setup.ts jsdom harness + Playwright globalSetup"
  - phase: 05-views-onboarding
    provides: "app/(app)/h/[homeId]/layout.tsx NavShell mount point"
provides:
  - "public/manifest.webmanifest — installable PWA metadata (name, colors, 3 icons)"
  - "public/icons/{192,512,512-maskable}.png + icon-source.svg — warm house+checkmark on terracotta"
  - "app/sw.ts + build-time public/sw.js — Serwist runtime cache + navigationPreload + /offline.html fallback"
  - "lib/secure-context.ts — pure SSR-safe isSecureContext + isStandaloneMode helpers"
  - "components/insecure-context-banner.tsx — dismissible warm banner for HTTP deploys (INFR-07)"
  - "public/offline.html — zero-network warm fallback page"
  - "Next.js --webpack build flag to unlock the serwist webpack plugin under Next 16 Turbopack default"
affects: [07-02-deployment-variants, future-ios-pwa, future-push-notifications]

# Tech tracking
tech-stack:
  added:
    - "@serwist/next@9.2.1 (exact pin) — Next.js wrapper around Serwist"
    - "serwist@9.2.1 (exact pin) — runtime service worker library (Workbox successor)"
    - "@types/serviceworker@0.0.180 (exact pin, devDep) — ServiceWorkerGlobalScope typings without polluting DOM lib"
  patterns:
    - "useSyncExternalStore for secure-context visibility (avoids react-hooks/set-state-in-effect lint and SSR hydration flash)"
    - "SSR fail-OPEN on isSecureContext (undefined window → true) to prevent HTTP-banner flash on HTTPS server renders"
    - "page.addInitScript stub for localhost secure-context override in Playwright (localhost is always secure per W3C)"
    - "Triple-slash `/// <reference lib=\"webworker\" />` in app/sw.ts for ServiceWorker typings without global lib pollution"

key-files:
  created:
    - "public/manifest.webmanifest"
    - "public/icons/icon-source.svg"
    - "public/icons/icon-192.png"
    - "public/icons/icon-512.png"
    - "public/icons/icon-512-maskable.png"
    - "public/offline.html"
    - "app/sw.ts"
    - "lib/secure-context.ts"
    - "components/insecure-context-banner.tsx"
    - "tests/unit/secure-context.test.ts"
    - "tests/unit/insecure-context-banner.test.tsx"
    - "tests/e2e/pwa-manifest.spec.ts"
  modified:
    - "next.config.ts"
    - "app/layout.tsx"
    - "app/(app)/h/[homeId]/layout.tsx"
    - "package.json"
    - ".gitignore"

key-decisions:
  - "Adopted Serwist (v9.2.1) over next-pwa — Serwist is the actively-maintained successor and is explicitly documented for Next 16 App Router"
  - "Next 16 Metadata API split: themeColor lives in `export const viewport: Viewport` (not metadata); manifest + icons + appleWebApp remain in `export const metadata: Metadata`"
  - "Build script switched to `next build --webpack` — Next 16 defaults to Turbopack which cannot see Serwist's webpack plugin; --webpack is the documented Serwist workaround pending https://github.com/serwist/serwist/issues/54"
  - "public/sw.js + /public/swe-worker-*.js gitignored — regenerated on every prod build; committing would drift with app code"
  - "InsecureContextBanner uses useSyncExternalStore (not useState+useEffect) — React 19 react-hooks/set-state-in-effect lint rule forbids the effect-driven pattern; external-store pattern also eliminates SSR flash naturally"
  - "E2E stubs window.isSecureContext=false via page.addInitScript — http://localhost is treated as a secure context by all browsers (W3C allowlist), so the banner cannot appear without the stub"
  - "Banner suppressed when isStandaloneMode=true (D-08) — an installed PWA has no HTTP install path to advertise, so nagging would be redundant"
  - "Triple-slash references in app/sw.ts (webworker lib + @types/serviceworker) instead of globally adding WebWorker to tsconfig.lib — keeps DOM + WebWorker types from colliding in the main app bundle"

patterns-established:
  - "SSR-safe window probes: accept `Window | undefined`, fail OPEN (true) on undefined for isSecureContext-style checks so server renders default to the 'no banner' path"
  - "useSyncExternalStore for read-only client-only state that has a deterministic server snapshot — preferred over useState+useEffect when lint blocks the latter"
  - "Exact-pinned PWA deps (9.2.1) — continues the Phase 1 invariant that all runtime deps are locked without carets"
  - "Service-worker file header triple-slash pattern: `/// <reference lib=\"webworker\" />` + `/// <reference types=\"@types/serviceworker\" />` for isolated worker typings"

requirements-completed: [INFR-07, INFR-08]

# Metrics
duration: 15min
completed: 2026-04-21
---

# Phase 7 Plan 01: PWA Manifest + Serwist Service Worker + HTTP Banner Summary

**Installable HomeKeep PWA with Serwist service worker (NetworkFirst + /offline.html fallback), warm manifest+icons, and a dismissible HTTP-deploy banner suppressing itself for installed PWAs.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-21T06:59:12Z
- **Completed:** 2026-04-21T07:14:31Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 17 (12 created, 5 modified)

## Accomplishments

- Shipped a valid PWA manifest matching D-01 byte-for-byte (HomeKeep, standalone, #F5EEE0/#D4A574, 3 icons including maskable).
- Rasterized 192/512/512-maskable PNG icons from a single warm house+checkmark SVG source (sharp, already a Next transitive dep) — no placeholder 1×1 pixels, real brand icons.
- Integrated `@serwist/next@9.2.1` for service-worker generation with `defaultCache` runtime (NetworkFirst navs + CacheFirst immutable assets), `/offline.html` fallback for failed navigations, and `disable: dev` so hot-reload is never polluted with stale precache.
- Shipped `components/insecure-context-banner.tsx` with warm copy, `/deployment` Learn more link, localStorage persistence, and the D-08 standalone suppression — wired into `app/(app)/h/[homeId]/layout.tsx` so it only appears on authed pages.
- Locked `lib/secure-context.ts` to SSR-safe fail-OPEN semantics (undefined window → true) with 6 dedicated unit tests + a 7th manifest JSON-shape integrity test.
- Added Playwright e2e spec with manifest-200 check + banner visible/dismiss/reload flow (uses `page.addInitScript` to stub `isSecureContext=false` since `http://localhost` is always a secure context).

## Task Commits

Each task followed the TDD RED → GREEN gate:

1. **Task 1 RED:** failing secure-context + manifest tests — `017b530` (test)
2. **Task 1 GREEN:** @serwist deps + manifest + icons + offline.html + sw.ts + lib/secure-context.ts + withSerwist in next.config — `07583ad` (feat)
3. **Task 2 RED:** failing InsecureContextBanner tests — `759e314` (test)
4. **Task 2 GREEN:** banner component + metadata wiring + e2e spec + --webpack build flag + gitignore sw.js — `8038243` (feat)

**Plan metadata commit:** (appended at end — STATE/ROADMAP/REQUIREMENTS + this SUMMARY)

## Files Created/Modified

### Created

- `public/manifest.webmanifest` — D-01 exact JSON (name, standalone, #F5EEE0/#D4A574, 3 icons w/ maskable)
- `public/icons/icon-source.svg` — source-of-truth SVG (warm house+checkmark on terracotta)
- `public/icons/icon-192.png` — 192×192, 2.4 kB — verified via PNG IHDR (sig 89504e47)
- `public/icons/icon-512.png` — 512×512, 10 kB — primary Android/desktop install icon
- `public/icons/icon-512-maskable.png` — 512×512 maskable — Android adaptive icon
- `public/offline.html` — warm zero-network fallback (system-ui font, inline styles, palette match)
- `app/sw.ts` — Serwist worker: precache manifest + defaultCache runtime + offline.html document fallback
- `lib/secure-context.ts` — 2 pure fns: isSecureContext (SSR fail-OPEN), isStandaloneMode (matchMedia + iOS quirk)
- `components/insecure-context-banner.tsx` — useSyncExternalStore + useState dismiss + localStorage persistence
- `tests/unit/secure-context.test.ts` — 7 cases (3 secure-context + 3 standalone + 1 manifest JSON shape)
- `tests/unit/insecure-context-banner.test.tsx` — 5 cases (HTTP render, HTTPS hidden, dismissed-persistent, dismiss-writes-localStorage, standalone-suppressed)
- `tests/e2e/pwa-manifest.spec.ts` — 2 cases (manifest 200 + banner visible/dismiss/reload on HTTP)

### Modified

- `next.config.ts` — wrapped with `withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js', disable: dev })`; `output: 'standalone'` preserved
- `app/layout.tsx` — Metadata.manifest='/manifest.webmanifest' + icons.apple + appleWebApp; new Viewport export with themeColor='#D4A574' (Next 16 API split)
- `app/(app)/h/[homeId]/layout.tsx` — rendered `<InsecureContextBanner />` above NavShell (auth-gated scope)
- `package.json` — build script → `next build --webpack`; new deps exact-pinned; no carets
- `.gitignore` — /public/sw.js + /public/swe-worker-*.js excluded

## Decisions Made

See `key-decisions` frontmatter for the full list with rationale. Headline picks:

1. **Serwist over next-pwa** — next-pwa is in maintenance mode; Serwist v9 is the actively-developed successor with documented Next 16 App Router support.
2. **Viewport export for themeColor** — matches Next 16 codemod output (`metadata-to-viewport-export`); keeping themeColor on `metadata` would emit a warning in the build log.
3. **`next build --webpack` flag** — Serwist is a webpack plugin. Next 16 defaults to Turbopack, which currently cannot load the plugin (tracked in serwist/serwist#54). Forcing webpack at build time is the least-invasive unblock.
4. **useSyncExternalStore pattern for banner visibility** — chosen because the React 19 `react-hooks/set-state-in-effect` lint rule flags the naive useState+useEffect pattern as an error. The external-store approach also eliminates SSR flash (getServerSnapshot=false) without any hydration logic.
5. **localhost secure-context stub in E2E** — `http://localhost` is on the W3C secure-context allowlist, so the real browser correctly hides the banner on the Playwright baseURL. The spec uses `page.addInitScript` to override `window.isSecureContext` only for this test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next 16 Turbopack default broke Serwist webpack plugin**

- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `next build` in Next 16 uses Turbopack by default. `@serwist/next` ships only a webpack plugin wrapper, and the build failed with: `ERROR: This build is using Turbopack, with a 'webpack' config and no 'turbopack' config.`
- **Fix:** Updated `package.json` build script to `next build --webpack`. Upstream tracker: https://github.com/serwist/serwist/issues/54.
- **Files modified:** `package.json`
- **Verification:** `npm run build` emits `public/sw.js` (45 kB) + `public/swe-worker-*.js` (456 B). Contains precache manifest + offline.html matcher.
- **Committed in:** `8038243` (Task 2)

**2. [Rule 1 - Bug] React 19 Compiler lint: `setState` directly in useEffect**

- **Found during:** Task 2 final lint pass
- **Issue:** My initial `InsecureContextBanner` used the documented-in-plan pattern `useState(false) + useEffect(() => setVisible(true), [])`. React 19's `react-hooks/set-state-in-effect` rule (new in this repo's eslint-config-next@16.2.4) flags this as an error ("Calling setState synchronously within an effect can trigger cascading renders").
- **Fix:** Refactored to `useSyncExternalStore` with `getServerSnapshot=false` and a no-op subscribe. Dismissal state stays in a separate `useState` that's only written in the click handler (never in an effect). Same observable behavior; lint clean.
- **Files modified:** `components/insecure-context-banner.tsx`
- **Verification:** `npm run lint` → 0 errors; all 5 banner unit tests still green; E2E still passes.
- **Committed in:** `8038243` (Task 2)

**3. [Rule 3 - Blocking] `file` command unavailable for PNG dimension verification**

- **Found during:** Task 1 verify gate
- **Issue:** Plan's verify command used `file public/icons/icon-192.png | grep "192 x 192"`. The `file` binary is not installed on this host.
- **Fix:** Switched to a Node script that reads the PNG IHDR header directly (`b.readUInt32BE(16)` = width, `b.readUInt32BE(20)` = height) + validates the 8-byte PNG signature. More portable and more precise anyway.
- **Files modified:** none (verification-only; Node is a hard dep of this project)
- **Verification:** 192×192, 512×512, 512×512 confirmed with IHDR reads; signature `89504e470d0a1a0a` on all three.
- **Committed in:** n/a (verify-only)

**4. [Rule 1 - Bug] My own test had unused-arg lint warnings**

- **Found during:** First lint pass after Task 1
- **Issue:** `tests/unit/secure-context.test.ts` used `matchMedia: (_q: string) => ...` three times. ESLint's @typescript-eslint/no-unused-vars doesn't honor the `_` prefix under this config for inline arrow params.
- **Fix:** Removed the unused `_q` parameter from the three `matchMedia` stubs — they never use the query string.
- **Files modified:** `tests/unit/secure-context.test.ts`
- **Verification:** 0 lint warnings originating from this plan after the fix.
- **Committed in:** `07583ad` (bundled into Task 1 GREEN)

---

**Total deviations:** 4 auto-fixed (2 Rule 3 blocking, 2 Rule 1 bugs)
**Impact on plan:** All four are environmental adaptations, not scope changes. Serwist+Turbopack incompatibility was the only material surprise — the `--webpack` flag is a clean, documented workaround with no follow-up required unless Turbopack SW plugin support lands in Next 17+.

## Issues Encountered

- **Playwright localhost secure-context:** `http://localhost:3001` is treated as a secure context by the W3C spec (no need for HTTPS to get crypto/service-worker APIs on localhost). The first E2E run correctly hid the banner. Resolved with `page.addInitScript` override — standard Playwright pattern for testing browser-API-dependent UI.
- **`scripts/dev-pb.js` Node warning during webServer boot:** `MODULE_TYPELESS_PACKAGE_JSON` warning reparses dev-pb.js as ESM. Pre-existing (Phase 1); not caused by this plan. Ignored.

## Plan-Output-Spec Notes (per plan's `<output>` block)

- **Serwist or next-pwa?** Serwist (9.2.1). No fallback required.
- **Icon-design divergence from D-01?** None — SVG source is the exact markup in the plan. sharp was available as a transitive dep (no `sharp-cli` `npx --yes` fallback needed; used raw `sharp` via `node -e` inline).
- **Metadata API shape:** Next 16 split `themeColor` into a separate `viewport` export (confirmed via `mcp__context7` / ctx7 docs `/vercel/next.js`). `metadata.manifest`, `metadata.icons`, `metadata.appleWebApp` unchanged.
- **public/sw.js status:** gitignored. Regenerated by `npm run build`.
- **defaultCache divergence:** None — used Serwist's exported `defaultCache` verbatim. Added only the `fallbacks.entries[0]` for `/offline.html`.

## User Setup Required

None — no external service configuration required for this plan. Icon rasterization can be redone locally with:

```bash
node -e "
const sharp = require('sharp');
const fs = require('node:fs');
const svg = fs.readFileSync('public/icons/icon-source.svg');
(async () => {
  await sharp(svg).resize(192, 192).png().toFile('public/icons/icon-192.png');
  await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512.png');
  await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512-maskable.png');
})();
"
```

## Next Phase Readiness

- Phase 7 Plan 02 (deployment variants) can now assume PWA manifest/SW ship automatically with every `next build --webpack`.
- HTTPS smoke test on a real deploy (Caddy or Tailscale compose variant) remains manual — Chrome DevTools > Application > Manifest + install simulator is the documented check per CONTEXT D-16.
- No blockers for the subsequent release plan.

## TDD Gate Compliance

- ✅ Task 1: RED (`017b530` test) → GREEN (`07583ad` feat). No refactor needed.
- ✅ Task 2: RED (`759e314` test) → GREEN (`8038243` feat). No refactor needed.

Both tasks executed the full TDD cycle with distinct `test(...)` and `feat(...)` commits. Gate order verified in `git log --oneline -5` post-execution.

## Self-Check: PASSED

All 13 created/modified files present on disk. All 4 task commits (017b530, 07583ad, 759e314, 8038243) present in git log. No missing artifacts.

---

*Phase: 07-pwa-release*
*Completed: 2026-04-21*
