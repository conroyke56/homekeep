---
phase: 24
plan: 01-P01
subsystem: security
tags:
  - security-headers
  - csp
  - hsts
  - defense-in-depth
  - v1.2-security
  - public-facing-hardening
requirements:
  - HDR-01
  - HDR-02
  - HDR-03
  - HDR-04
dependency_graph:
  requires:
    - "Phase 8 — HOMEKEEP_BUILD constant (HDR-04 stealth gate wraps this)"
    - "Phase 7 — Caddyfile + Caddyfile.prod (HDR-02 header directive targets)"
    - "Phase 1 — next.config.ts (HDR-01 headers() export target)"
    - "Phase 2 — proxy.ts (HDR-04 HomeKeep-Build response header emitter)"
  provides:
    - "CSP-Report-Only at every response (Next + internal Caddy + external Caddy) — 30-day violation soak corpus for Phase 28 enforced flip"
    - "HSTS on external Caddy terminator only (plain-HTTP LAN deploys unaffected)"
    - "X-Frame DENY, X-Content-Type nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy all-off on every response"
    - "HomeKeep-Build HTTP response header — operator-togglable via HK_BUILD_STEALTH env, no image rebuild required"
    - "/api/csp-report sink — logs violations to stdout, caps at 4096 chars, never 500s"
  affects:
    - "Every HTTP response served by Next (via headers() export + proxy.ts tag) — 5+ new response headers"
    - "Every HTTP response served by Caddy (internal :3000 + external {\\$DOMAIN}) — same header set at transport layer"
    - "Public provenance surfaces (<meta name=\"hk-build\">, /.well-known/homekeep.json build field) — redacted when stealth on"
tech-stack:
  added: []
  patterns:
    - "Triple-layer header defense: Next headers() + internal Caddy + external Caddy all emit the same CSP/security set"
    - "Env-gated per-call build-id resolver (getBuildIdPublic()) — runtime re-read means operators flip flags without rebuilding"
    - "CSP Report-Only → Report corpus → enforced flip (Phase 28) — staged rollout pattern for never-break-prod CSP adoption"
key-files:
  created:
    - "app/api/csp-report/route.ts"
    - "tests/unit/csp-report.test.ts"
    - "tests/unit/build-id-stealth.test.ts"
  modified:
    - "next.config.ts"
    - "docker/Caddyfile"
    - "docker/Caddyfile.prod"
    - "lib/constants.ts"
    - "proxy.ts"
    - "app/layout.tsx"
    - "app/.well-known/homekeep.json/route.ts"
decisions:
  - "HDR-01 CSP ships as Report-Only (D-02); Phase 28 flips to enforced after 30-day soak"
  - "HDR-01 HSTS conditional on SITE_URL starts-with https:// (D-03) — plain-HTTP LAN deploys unaffected"
  - "HDR-01 allowlist scoped to observed sources: fonts.googleapis.com + fonts.gstatic.com (layout.tsx), ntfy.sh + *.ntfy.sh (lib/ntfy.ts)"
  - "HDR-02 Caddyfile block placed BEFORE handle blocks (D-08) so header directive applies to every downstream response including error pages"
  - "HDR-02 external Caddyfile.prod adds HSTS (D-09) because it is the only layer that sees real HTTPS clients"
  - "HDR-02 strips -Server + -X-Powered-By (D-10) — hides Caddy version from responses"
  - "HDR-03 /api/csp-report returns 204 always (D-11) — endpoint must never 500 or browsers stop sending reports"
  - "HDR-03 body capped at 4096 chars before logging — log-flood defense"
  - "HDR-04 getBuildIdPublic() is a function (not a frozen constant) — per-call env read lets operators flip HK_BUILD_STEALTH via compose without rebuilding the image"
  - "HDR-04 stealth sentinel is `hk-hidden` (not empty / null) — deterministic log-grep partition between stealth vs real responses"
  - "HDR-04 scope expanded beyond plan text: layout.tsx <meta> tags + /.well-known/homekeep.json also honour stealth (Rule 2 — plan named 'build-id' emission generically, not just the header; redacting only the header while leaking via <meta> would defeat the purpose)"
metrics:
  duration: "~20min"
  completed: "2026-04-23"
  tasks: 4
  files: 10
  tests_added: 8
  tests_total: 637
---

# Phase 24 Plan 01-P01: HTTP Headers + Transport Summary

CSP-Report-Only + HSTS + 5 fingerprint-blocking headers shipped at both the Next.js app layer (`next.config.ts headers()`) and the Caddy reverse-proxy layer (`docker/Caddyfile` + `docker/Caddyfile.prod`); `/api/csp-report` endpoint collects violation corpus for the Phase 28 enforced-CSP flip; `HK_BUILD_STEALTH=true` env flag redacts every public build-id surface (`HomeKeep-Build` response header, `<meta name="hk-build">`, `/.well-known/homekeep.json`) to the literal `hk-hidden` without rebuilding the image.

## What was built

### HDR-01 — `next.config.ts` headers() export (`13793fb`)

Added `async headers()` returning one entry for `source: '/:path*'` with 5 baseline security headers, conditionally promoting to 6 when `SITE_URL` starts with `https://`:

- `Content-Security-Policy-Report-Only` — 9 directives: `default-src 'self'`; script/style allow `'unsafe-inline'` during soak; font-src allowlists `fonts.gstatic.com`; style-src allowlists `fonts.googleapis.com`; img-src permits `data:` + `blob:`; connect-src allowlists `ntfy.sh` + `*.ntfy.sh`; frame-ancestors `'none'`; base-uri / form-action locked to `'self'`; report-uri `/api/csp-report`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` — conditional on `SITE_URL` starting `https://` (D-03)

### HDR-02 — Caddy mirror (`fbb7dcf`)

Inserted a `header { ... }` block inside each Caddy site block, BEFORE all `handle` blocks (D-08 — ensures errors, 404s, and bypass paths also carry the set):

- `docker/Caddyfile` `:3000` block — same 5 headers as HDR-01 (internal plain-HTTP; HSTS omitted because this layer is never directly HTTPS)
- `docker/Caddyfile.prod` `{$DOMAIN}` block — same 5 + `Strict-Transport-Security` (external TLS terminator)
- Both blocks strip `-Server` and `-X-Powered-By` (D-10) — hides Caddy version

### HDR-03 — CSP violation sink (`a7235c4`)

New file `app/api/csp-report/route.ts`. POST handler with a single `try { console.log(body.slice(0, 4096)) } catch {}` wrapper returning `new Response(null, { status: 204 })`. Contract guarantees:

- Always returns 204 — even on oversized bodies, malformed input, or `req.text()` rejection
- Logs body to stdout with `[CSP-REPORT]` prefix; body truncated at 4096 chars
- No DB write, no PII persisted, no downstream call (D-11)

4 unit tests cover the contract — 204 on valid body, `[CSP-REPORT]` prefix in log, 4096-char truncation, never-throws-on-broken-stream.

### HDR-04 — Build-ID stealth (`f46be44`)

New exported function `getBuildIdPublic()` in `lib/constants.ts` returning `'hk-hidden'` when `process.env.HK_BUILD_STEALTH === 'true'` else the real `HOMEKEEP_BUILD`. Per-call env read (not a module-load constant) so operators can toggle the flag via compose env without rebuilding.

Four emission sites now route through the gate:

1. **`proxy.ts`** — new `tagBuild()` helper sets `HomeKeep-Build` response header on every response including both redirect branches
2. **`app/layout.tsx`** — `<meta name="generator">` + `<meta name="hk-build">` source from `getBuildIdPublic()` (was frozen `HK_BUILD_ID` alias)
3. **`app/.well-known/homekeep.json/route.ts`** — `build` field honours the gate (was direct `process.env.HK_BUILD_ID` read)
4. **`HomeKeep-Build` response header** — newly emitted for the first time (plan called this out as the primary emission site; no prior HTTP header existed, only `<meta>` tags)

4 unit tests cover the contract — stealth=true → hk-hidden, unset → real build id, non-"true" fallback (false / yes / 1 / TRUE / empty), per-call re-read.

Real `HOMEKEEP_BUILD` still flows to the scheduler startup log (`lib/scheduler.ts:114`) and the container image label (`docker/Dockerfile:113`) — server-side forensics retained, client-visible fingerprint blocked.

## Verification

- `npx tsc --noEmit` — clean, zero errors
- `npm test --run` — 76 files, 637 tests passed (629 baseline + 8 new = 637 ≥ 633 plan target)
- All 4 requirements marked complete via `gsd-sdk query requirements.mark-complete HDR-01 HDR-02 HDR-03 HDR-04`
- Master pushed to origin (cdc0da0..f46be44)

**Manual deploy verification (operator step, post-rebuild):**

```bash
# Rebuild + redeploy on VPS
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d

# Confirm 6 headers present (7 with HSTS when SITE_URL is https://)
curl -sI http://127.0.0.1:3000/ | \
  grep -iE '(Content-Security-Policy-Report-Only|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy|HomeKeep-Build)'

# Confirm CSP report endpoint accepts violations
curl -sX POST http://127.0.0.1:3000/api/csp-report \
  -H 'Content-Type: application/csp-report' \
  -d '{"csp-report":{"violated-directive":"test"}}' -w '%{http_code}\n'
# Expected: 204

# Confirm stealth flag redacts the build-id header
HK_BUILD_STEALTH=true docker compose -f docker/docker-compose.yml up -d
curl -sI http://127.0.0.1:3000/ | grep -i HomeKeep-Build
# Expected: HomeKeep-Build: hk-hidden
```

## Deviations from Plan

### Rule 2 — scope expansion on HDR-04

**Found during:** HDR-04 planning / grep for `HomeKeep-Build` header emission sites.

**Issue:** Plan said "Find where `HomeKeep-Build` header is emitted (likely `proxy.ts` or `app/layout.tsx` via middleware)". Grep across `app/ lib/ proxy.ts` returned zero matches — the `HomeKeep-Build` HTTP response header has never existed in this codebase. Only `<meta name="hk-build">` tags in `app/layout.tsx` and the `build` field in `/.well-known/homekeep.json` leak the fingerprint.

**Fix:** Three parallel changes instead of one:
1. Added net-new `HomeKeep-Build` response header emission via `proxy.ts tagBuild()` helper (the "primary" channel the plan named)
2. Updated existing `<meta>` tag emissions in `layout.tsx` to source from `getBuildIdPublic()`
3. Updated existing `/.well-known/homekeep.json` build field to source from `getBuildIdPublic()`

Redacting only the header while leaving `<meta>` + `.well-known/` leaking the real build would defeat the stealth purpose — attackers probing for version fingerprint would just read the HTML. All public-facing build-id emissions now gated uniformly. Centralised in single `getBuildIdPublic()` function so any future emission site can opt in by importing one symbol.

**Files modified:** `lib/constants.ts`, `proxy.ts`, `app/layout.tsx`, `app/.well-known/homekeep.json/route.ts`
**Commit:** `f46be44`

### Rule 3 — env var naming

**Found during:** HDR-01 implementation, reading plan text.

**Issue:** Plan text referred to `NEXT_PUBLIC_SITE_URL` for the HSTS conditional, but the codebase convention (established at `docker/.env:7` + `lib/actions/invites.ts:100`) uses `SITE_URL` (no `NEXT_PUBLIC_` prefix — it is a server-only env, not exposed to the browser bundle).

**Fix:** Used `process.env.SITE_URL` in the HSTS conditional, matching codebase convention.

**Files modified:** `next.config.ts`
**Commit:** `13793fb`

### Rule 1 — `getBuildIdPublic()` as function, not const

**Found during:** HDR-04 test design review.

**Issue:** Initial implementation used `export const HK_BUILD_ID_PUBLIC = process.env.HK_BUILD_STEALTH === 'true' ? 'hk-hidden' : HOMEKEEP_BUILD;` — evaluated at module load. This would prevent unit tests from toggling the flag between assertions (vitest does not reload modules mid-test) AND would mean operators changing `HK_BUILD_STEALTH` in compose env would need to rebuild the image to see the change.

**Fix:** Converted to `export function getBuildIdPublic(): string` that reads `process.env.HK_BUILD_STEALTH` on every call. Same performance envelope (one env lookup), but now the operator ergonomics match the plan intent ("flip via env without rebuilding") and the 4-case test matrix is expressible.

**Files modified:** `lib/constants.ts`
**Commit:** `f46be44`

## Known Stubs

None. All 4 REQ-IDs fully implemented and tested.

## Threat Flags

None. Every change tightens public surface; no new network endpoints beyond `/api/csp-report` (explicit plan deliverable, no auth needed, cannot leak data).

## Self-Check: PASSED

Created files verified on disk:

```
FOUND: app/api/csp-report/route.ts
FOUND: tests/unit/csp-report.test.ts
FOUND: tests/unit/build-id-stealth.test.ts
```

Modified files verified:

```
FOUND: next.config.ts (13793fb)
FOUND: docker/Caddyfile (fbb7dcf)
FOUND: docker/Caddyfile.prod (fbb7dcf)
FOUND: lib/constants.ts (f46be44)
FOUND: proxy.ts (f46be44)
FOUND: app/layout.tsx (f46be44)
FOUND: app/.well-known/homekeep.json/route.ts (f46be44)
```

Commits verified in `git log --oneline -5`:

```
FOUND: 13793fb feat(24): add security headers to Next.js config (HDR-01)
FOUND: fbb7dcf feat(24): mirror security headers at Caddy layer (HDR-02)
FOUND: a7235c4 feat(24): CSP violation report endpoint (HDR-03)
FOUND: f46be44 feat(24): HK_BUILD_STEALTH env redacts build-id header (HDR-04)
```

Test suite: 76 files, 637 tests passed.
Typecheck: clean.
Master pushed to origin.
