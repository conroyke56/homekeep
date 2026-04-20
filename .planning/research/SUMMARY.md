# Research Summary: HomeKeep

**Domain:** Self-hosted household maintenance PWA
**Researched:** 2026-04-20
**Overall confidence:** MEDIUM (web research tools unavailable; versions based on training data cutoff May 2025)

## Executive Summary

HomeKeep is a self-hosted household maintenance tracker for couples and families. The user's pre-selected stack -- Next.js 15, PocketBase, Tailwind + shadcn/ui, ntfy, Docker multi-arch -- is well-suited for this domain. Each choice aligns with the project's core principles: self-hosted first, single data volume, runs on a Raspberry Pi, no cloud dependencies.

The primary technical risk is the Next.js + PocketBase integration pattern. PocketBase runs as a sidecar in Docker Compose, and Next.js Server Components need to communicate with it over the internal Docker network. This is a well-documented pattern in the self-hosted community but requires careful handling of auth tokens across the server/client boundary. The PocketBase JS SDK handles this, but the pattern for Server Components (where you cannot use browser cookies) needs explicit design.

The feature set is well-scoped for a v1. The three-band main view, cascading assignment, and coverage ring are the defining features that differentiate HomeKeep from generic task apps. The computed "next due date" approach (never stored, always derived) is the right call -- it avoids stale data and simplifies the data model, but requires that date math is thoroughly tested.

PWA tooling is the least stable part of the stack. The `next-pwa` package may be unmaintained; `@serwist/next` (Serwist) is its successor. This needs verification at scaffold time. The graceful degradation requirement for non-HTTPS contexts (LAN mode) adds complexity to the service worker strategy.

## Key Findings

**Stack:** Next.js 15 (standalone) + PocketBase + Tailwind/shadcn/ui + ntfy. All choices validated. No changes recommended.
**Architecture:** Two-container Docker Compose (Next.js + PocketBase). PocketBase is the single source of truth for data, auth, and files. Next.js handles rendering, business logic (coverage calculation, cascade resolution), and ntfy integration.
**Critical pitfall:** PocketBase is pre-1.0. Minor version upgrades can break the JS SDK. Pin both binary and SDK versions together and test upgrades before deploying.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 0: Scaffold + Docker** - Get Next.js + PocketBase running in Docker Compose with standalone output. Verify multi-arch builds. This unblocks everything.
   - Addresses: Deployment infrastructure, development environment
   - Avoids: Late-stage Docker integration pain

2. **Phase 1: Schema + Auth + Basic CRUD** - PocketBase schema via migrations, auth flow, single home with areas and tasks. No styling.
   - Addresses: Data model, auth, core entities
   - Avoids: Building UI before the data layer is solid

3. **Phase 2: Three-Band UI + Design System** - The core differentiating UX. Design system with shadcn/ui customized to warm aesthetic. Coverage ring. Completion flow with early-completion guard.
   - Addresses: Table-stakes UX, design language
   - Avoids: Generic-looking app that feels like every other task manager

4. **Phase 3: Multi-Home + Sharing + Cascading Assignment** - The collaborative features. Invites, member management, cascade resolution logic.
   - Addresses: Multi-user, the "couple" use case
   - Avoids: Single-user-only trap

5. **Phase 4: Seed Library + Onboarding** - First-run wizard, task library, area creation guidance.
   - Addresses: Empty-state problem, user onboarding
   - Avoids: Blank app on first launch

6. **Phase 5: Notifications + Scheduler + History** - ntfy integration, hourly cron, overdue detection, history timeline.
   - Addresses: The "don't forget" value proposition
   - Avoids: Complex notification infrastructure (ntfy is simple HTTP POST)

7. **Phase 6: Gamification + Polish** - Streaks, celebrations, dark mode, accessibility, performance optimization.
   - Addresses: Emotional engagement, quality
   - Avoids: Premature polish before core features work

8. **Phase 7: Deployment Variants + Release** - Caddy/Tailscale compose files, documentation, CI/CD pipeline, first tagged release.
   - Addresses: Distribution, real-world deployment
   - Avoids: Shipping without deployment documentation

**Phase ordering rationale:**
- Docker scaffold first because every subsequent phase depends on the dev environment
- Schema before UI because the three-band view depends on computed date fields
- UI before multi-user because the core loop (view tasks, complete tasks) must work for one user before adding sharing
- Notifications late because they depend on tasks + assignments being complete
- Polish last because it touches everything and should not block functional completeness

**Research flags for phases:**
- Phase 0: Verify current Next.js, PocketBase, Tailwind versions. PWA tooling choice (Serwist vs alternatives).
- Phase 2: May need deeper UX research for the three-band layout on mobile
- Phase 5: ntfy integration is simple but test iOS notification delivery
- Phase 7: Multi-arch Docker builds with PocketBase binary need architecture-specific downloads

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Choices are correct but exact versions unverified for April 2026. |
| Features | HIGH | Well-defined in SPEC.md. Clear scope boundaries. |
| Architecture | HIGH | Two-container pattern is well-established. |
| Pitfalls | MEDIUM | Known pitfalls from training data. May miss recent ecosystem changes. |

## Gaps to Address

- Exact current versions of all packages (verify at scaffold time)
- PWA tooling: which package is currently maintained for Next.js service workers
- PocketBase version: may have reached 1.0 with API changes
- Tailwind v4 + shadcn/ui compatibility status
- React 19 features that may affect the Server Components data-fetching pattern
