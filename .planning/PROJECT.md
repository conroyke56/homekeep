# HomeKeep

## What This Is

A self-hosted, open-source household maintenance PWA for couples and families. Every recurring task has a frequency, and HomeKeep spreads the year's work evenly across weeks so nothing piles up and nothing rots. Designed for calm, shared responsibility — not competitive productivity.

## Core Value

The household's recurring maintenance is visible, evenly distributed, and nothing falls through the cracks — without creating anxiety or guilt.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Email/password auth (PocketBase built-in)
- [ ] Multiple homes per user with last-viewed-home default landing
- [ ] Share a home via shareable invite link (no SMTP dependency)
- [ ] Areas within a home (location-scoped or whole_home scope)
- [ ] Auto-created "Whole Home" area per home
- [ ] Tasks with name, frequency (days), area, optional notes, optional assignee
- [ ] Cascading assignment (task → area → anyone)
- [ ] Complete a task (records who, when)
- [ ] Early-completion guard (prompt when <25% of cycle elapsed)
- [ ] Cycle and anchored schedule modes
- [ ] Three-band main view (Overdue / This Week / Horizon)
- [ ] By Area view with per-area coverage %
- [ ] Person view (your tasks + history)
- [ ] History view (household activity timeline)
- [ ] Coverage ring (equal-weight, frequency-normalized overdue ratio)
- [ ] Year-view horizon (12-month calendar strip)
- [ ] Seed task library with first-run wizard
- [ ] Add custom tasks
- [ ] Per-user ntfy notification preferences
- [ ] Hourly scheduler for overdue detection + ntfy push
- [ ] Household streak (consecutive weeks with completions)
- [ ] Weekly summary notification (opt-in)
- [ ] Single Docker image, multi-arch (amd64 + arm64)
- [ ] Three compose variants (LAN-only, Caddy, Tailscale)
- [ ] Graceful degradation without HTTPS (inform, don't break)
- [ ] Single `./data` volume for all persistence
- [ ] PWA manifest + service worker (HTTPS modes only)
- [ ] `/api/health` endpoint
- [ ] GitHub Actions CI/CD → GHCR multi-arch publish
- [ ] MIT license

### Out of Scope

- Calendar integration (iCal, Google Calendar) — different problem space
- Shopping lists / inventory — not home maintenance
- Bill tracking / finance — not home maintenance
- Vendor/contractor contacts — adds complexity without core value
- Multi-tenant SaaS — self-hosted first, always
- Enterprise SSO (OIDC, SAML) — not the target user
- i18n (v1 is English only, strings extractable for later)
- Offline-first write sync — reads cached, writes require connection
- Real-time collaboration / presence — overkill for household app
- Documented public API (v1.1)
- Webhooks (v1.1)
- Kids/chores mode (post-1.1)
- Area groups (v1.1)
- Task rotation (v1.1)
- Photo attachments on completion (v1.1)

## Context

- Target deployment: Raspberry Pi 4 (8GB) for a single household
- Primary users are couples sharing one home; multi-home is for holiday house / parents' place
- PocketBase provides auth, DB (SQLite), and API out of the box as a single Go binary
- Frontend talks to PocketBase directly from the browser via PB JS SDK (standard pattern, gets realtime for free)
- Both PocketBase and Next.js run in the same Docker container (supervisord or similar process manager)
- ntfy.sh as default notification provider — no SMTP, no VAPID, works on iOS via ntfy app
- Aesthetic: warm, calm, domestic — not a SaaS dashboard. Think well-kept notebook.

## Constraints

- **Tech stack**: Next.js 15 (App Router, standalone), PocketBase, Tailwind + shadcn/ui — specified in SPEC.md
- **Container**: Single Docker image under 300MB, serves both processes
- **Data**: All state in one `./data` volume — backup = copy folder
- **No cloud**: Zero outbound telemetry, no paid APIs, no cloud dependencies
- **No SMTP**: v1 invites are link-only; no email delivery requirement
- **Platform**: Must run on amd64 + arm64 (Pi, Apple Silicon, ARM NAS)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-in-one container (PB + Next.js) | Simpler for self-hosters — one container, one compose service | — Pending |
| Direct PB SDK from browser | Standard PocketBase pattern, gets realtime subscriptions for free | — Pending |
| Link-only invites (no SMTP) | Removes config burden for self-hosters; progressive enhancement later | — Pending |
| Equal-weight coverage ring | Formula's overdue_ratio already normalizes by frequency; simpler to reason about | — Pending |
| Last-viewed-home landing | Most users have 1 home; extra picker tap is unnecessary friction | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 after initialization*
