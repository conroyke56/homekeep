# Phase 7: PWA & Release - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Finalizes HomeKeep for v1 release: PWA installability under HTTPS, graceful degradation on LAN-only HTTP, Caddy + Tailscale compose variants, and operational polish. CI/CD (multi-arch GHCR publish on tag) already shipped in Phase 1 (INFR-09). Phase 7 delivers INFR-07, INFR-08, and final release preparation.

**Scope:**
- PWA manifest + service worker for HTTPS deployments (INFR-08)
- Secure-context detection + graceful degradation on LAN-only HTTP (INFR-07)
- Caddy compose variant (docker-compose.caddy.yml) with automatic HTTPS
- Tailscale compose variant (docker-compose.tailscale.yml) as alternative HTTPS path
- INFR-09 re-validation: CI/CD pipeline (already shipped Phase 1)
- Release prep: tag v1.0.0-rc1 via the release workflow; smoke-test the multi-arch GHCR image
- Docs: production deployment guide (VPS + Caddy + HTTPS), PWA install instructions

**NOT in Phase 7:**
- Offline write support (deferred — offline read-only is v1 scope)
- iOS-specific PWA quirks beyond manifest best-practice
- Push notifications via service worker (ntfy handles via Phase 6)
- OAuth providers (future)
</domain>

<decisions>
## Implementation Decisions

### PWA manifest (INFR-08)

- **D-01:** `public/manifest.webmanifest` with: name "HomeKeep", short_name "HomeKeep", description, start_url "/", display "standalone", background_color "#F5EEE0" (warm cream), theme_color "#D4A574" (terracotta-sand from SPEC §19), icons (192, 512, maskable 512). Link from `app/layout.tsx` via `<link rel="manifest" href="/manifest.webmanifest">`.
- **D-02:** Icon set: generate from a simple warm mono-color SVG (house outline with a checkmark). Provide 192x192 PNG, 512x512 PNG, 512x512 maskable PNG. Store in `public/icons/`.
- **D-03:** `app/layout.tsx` metadata: themeColor + viewport tags; add `apple-touch-icon` for iOS install affordance.

### Service worker (INFR-08)

- **D-04:** Use **next-pwa** or **@serwist/next** (whichever is current best for Next 16 App Router) with minimal config: cache Next.js build assets + the dashboard + static routes + `/api/health`. Runtime strategy: NetworkFirst for data (tasks/areas/completions), CacheFirst for assets. Offline fallback: show "You're offline — reconnect to see updates" card.
- **D-05:** Service worker ONLY registers over HTTPS (browsers enforce this anyway). On HTTP, the registration fails silently and INFR-07 graceful-degradation UI takes over.

### Secure-context detection (INFR-07)

- **D-06:** `lib/secure-context.ts` — pure `isSecureContext(window)` wrapper + `isStandaloneMode(window)`. Used in client components to detect HTTPS + PWA install state.
- **D-07:** `components/insecure-context-banner.tsx` — client component that renders a dismissible warm banner when on HTTP: "You're on HTTP — install-to-home-screen and offline support require HTTPS. [Learn more]". Link to docs/deployment.md. Dismissible via localStorage (dismissed_insecure_banner=true).
- **D-08:** Hide the "Install app" prompt entirely on HTTP (PWA install prompt can't fire). Person view "Notifications" section stays (ntfy push works over HTTPS OR HTTP because ntfy.sh is HTTPS and the push happens server-side — not PWA-push-dependent).

### Compose variants

- **D-09:** `docker/docker-compose.caddy.yml` — adds a Caddy service that terminates HTTPS (auto-https via Let's Encrypt) and proxies to the internal homekeep service. Requires DOMAIN env var + port 80/443 exposed. Doc: "set DOMAIN=homekeep.example.com and Caddy handles TLS automatically".
- **D-10:** `docker/docker-compose.tailscale.yml` — adds a tailscale/tailscale sidecar (funnel mode for public access OR serve mode for tailnet-only). Requires TS_AUTHKEY env var.
- **D-11:** `docker-compose.yml` stays as LAN-only default (Phase 1 + Phase 2.1 baseline). The three variants are:
  - Default: `docker compose up` — LAN-only, port 3000
  - HTTPS via Caddy: `docker compose -f docker-compose.yml -f docker-compose.caddy.yml up`
  - HTTPS via Tailscale: `docker compose -f docker-compose.yml -f docker-compose.tailscale.yml up`

### Release

- **D-12:** Tag `v1.0.0-rc1` → CI release.yml (from Phase 1) builds multi-arch amd64+arm64 → pushes to ghcr.io/<owner>/homekeep:v1.0.0-rc1 + latest. Manual step: configure GHCR visibility public once first release is pushed.
- **D-13:** Docs: new `docs/deployment.md` with 3 sections (LAN, Caddy, Tailscale) + `docs/pwa-install.md` + update README quickstart.

### Testing

- **D-14:** Unit: lib/secure-context.ts (mock window), service-worker registration logic
- **D-15:** E2E: isSecureContext=false → banner visible; standalone=true → no banner
- **D-16:** Manual: real HTTPS deploy → PWA install prompt works → offline fallback (airplane mode)

</decisions>

<canonical_refs>
- SPEC.md §5 (deployment modes — three variants)
- SPEC.md §15 (docker + distribution)
- Phase 1 ROADMAP Phase 1 §4 (multi-arch builds — already working)
- Phase 1 .github/workflows/release.yml (shipped)
- Phase 2.1/3.1/4.1/5.1/6.1 deploy checkpoints (LAN-only VPS port 3000)
- next-pwa / @serwist/next docs
</canonical_refs>

<specifics>
- Warm cream background color for splash: #F5EEE0
- Keep banner copy calm: "You're on HTTP" not "INSECURE CONNECTION WARNING"
- PWA test: Chrome DevTools > Application > Manifest + install simulator
</specifics>

<deferred>
- Offline writes / conflict resolution — v1.1
- Background sync — v1.1
- Push via service worker — v1.1 (ntfy handles push already)
</deferred>

---

*Phase: 07-pwa-release*
*Context gathered: 2026-04-21 via autonomous yolo-mode synthesis*
