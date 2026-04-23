# Phase 24: HTTP Headers + Transport — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Autonomous

<domain>
## Phase Boundary

Ship 5 HTTP security headers across both Next.js (`next.config.ts`) and Caddy layers (LAN + Caddyfile.prod). CSP starts in Report-Only mode to catch violations during soak, flipped to enforced in Phase 28 or later. Build-ID fingerprint optionally stealthed via env flag.

**In scope (4 REQ-IDs):**
- HDR-01 `next.config.ts headers()` export — CSP-Report-Only, HSTS, X-Frame DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrictive
- HDR-02 Caddyfile + Caddyfile.prod mirror the same headers (defense-in-depth)
- HDR-03 `/api/csp-report` endpoint accepts violation reports (server-side log only; no DB, no PII)
- HDR-04 `HK_BUILD_STEALTH=true` env flag redacts `HomeKeep-Build` header to `hk-hidden`

**Out of scope:**
- CSP flipped to enforced (Phase 28+ after 30-day soak)
- Rate limits (Phase 25)
- Demo instance (Phase 26)

**Deliverables:**
1. `next.config.ts` with `async headers()` export returning per-path header arrays
2. Both Caddyfiles add a `header` directive inside their main site block
3. `app/api/csp-report/route.ts` — POST handler that logs violation body + returns 204
4. `lib/constants.ts` or similar: `HK_BUILD_STEALTH` gate around the build-ID header emission
</domain>

<decisions>
## Implementation Decisions

### HDR-01: Next.js headers() export

- **D-01 (CSP — Report-Only initially):** `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ntfy.sh *.ntfy.sh; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report`
- **D-02 (CSP direction — Report-Only, not enforced):** ship as `Content-Security-Policy-Report-Only` for 30-day soak. Phase 28 flips to `Content-Security-Policy` (enforced) once violation data shows 0 legit-path triggers.
- **D-03 (HSTS):** `max-age=31536000; includeSubDomains; preload` — applied only when NEXT_PUBLIC_SITE_URL starts with `https://` (avoid locking HTTP-only LAN deploys). Caddy layer also applies this on the HTTPS terminator.
- **D-04 (X-Frame):** `DENY` — the app has no legitimate iframe embedding use case.
- **D-05 (X-Content-Type-Options):** `nosniff` — standard hardening.
- **D-06 (Referrer-Policy):** `strict-origin-when-cross-origin` — leaks origin but not path on cross-origin.
- **D-07 (Permissions-Policy):** `camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()` — all off.

### HDR-02: Caddy mirror

- **D-08 (internal Caddyfile):** same header set, using `header` directive inside the `:3000` block. Placed BEFORE the reverse_proxy so responses get headers even if upstream doesn't.
- **D-09 (Caddyfile.prod):** same + HSTS (since Caddy terminates TLS there). `header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"`.
- **D-10 (X-Powered-By strip):** `header -Server` and `header -X-Powered-By` at Caddy layer — hides Caddy version from responses.

### HDR-03: CSP report endpoint

- **D-11 (`app/api/csp-report/route.ts`):** POST handler. Accepts `application/csp-report` body. Logs to stdout with a `[CSP-REPORT]` prefix. Returns 204 No Content. No DB write. No PII stored.
- **D-12 (rate limit):** PB rate-limit doesn't apply to Next API routes directly, but Caddy can be configured to throttle `/api/csp-report` if abuse surfaces. Defer unless seen.

### HDR-04: Build-ID stealth

- **D-13 (gate):** `HK_BUILD_STEALTH` env var. When `"true"`, all `HomeKeep-Build` header emissions use literal `hk-hidden`. Otherwise current `HK_BUILD_ID` value. Single source of truth in `lib/constants.ts` (which Phase 8 set up).

### Test scope

- **D-14 (~4 unit tests):**
  - CSP header present on GET / response
  - CSP report-uri points to /api/csp-report
  - X-Frame-Options header = DENY
  - HK_BUILD_STEALTH=true → header value is "hk-hidden"
  - /api/csp-report POST returns 204, logs the body

### Deploy verification
- `curl -sI https://<vps>/ | grep -E 'Content-Security-Policy-Report-Only|Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy'` — all 6 present
- Frontend renders correctly under Report-Only (no blocked fonts/styles/scripts)
</decisions>

<canonical_refs>
- `.planning/v1.2-security/research/public-facing-hardening.md` §Security headers audit (table of recommended headers)
- `.planning/v1.2-security/research/attack-surface.md` §F-01 (no security headers finding)
- `next.config.ts` — target file
- `docker/Caddyfile` + `docker/Caddyfile.prod` — Caddy layer targets
- `app/layout.tsx` — Google Fonts imported (affects CSP source allowlist)
- `lib/constants.ts` — HK_BUILD_ID constant (Phase 8)
- `lib/ntfy.ts` — outbound fetch target (affects connect-src)
</canonical_refs>

<deferred>
- CSP flipped to enforced (after 30-day soak)
- CSP nonces / hashes (defer; 'unsafe-inline' acceptable during soak)
- Report-URI / Report-To dual mode (modern browsers prefer Report-To)
</deferred>

---

*Phase: 24-http-headers-transport*
