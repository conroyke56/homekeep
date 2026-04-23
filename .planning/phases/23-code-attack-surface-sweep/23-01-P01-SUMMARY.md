---
phase: 23
plan: 01-P01
subsystem: security
tags:
  - security-hardening
  - code-sweep
  - v1.2-security
  - defense-in-depth
requirements:
  - SEC-01
  - SEC-02
  - SEC-03
  - SEC-04
  - SEC-05
  - SEC-06
  - SEC-07
dependency_graph:
  requires:
    - "Phase 10 — schedule_overrides collection (SEC-02 migration target)"
    - "Phase 6 — admin scheduler route.ts (SEC-03 target)"
    - "Phase 2 — auth schemas + layout.tsx (SEC-06, SEC-07 targets)"
    - "Phase 4 — membership model + last_viewed_home_id (SEC-05 target)"
  provides:
    - "Parameterized PB filter convention sweep-complete — no template-literal survivors"
    - "Tightened schedule_overrides.createRule body-check (matches completions pattern)"
    - "Timing-safe admin token comparison — eliminates byte-by-byte timing oracle"
    - "Cross-home area_id guard on task updates (matches createTask invariant)"
    - "users.last_viewed_home_id PB-layer membership hook — action + rule defense-in-depth"
    - "12-character password floor for new passwords (grandfathered for existing)"
    - "Token-refresh round-trip on authed /h renders (not just cookie presence)"
  affects:
    - "All (app) Server Components — one extra PB roundtrip per render (SEC-07)"
    - "users collection direct-SDK writes — rejected when setting last_viewed_home_id to non-member home"
    - "schedule_overrides create flow — rejects forged created_by_id"
tech-stack:
  added:
    - "node:crypto.timingSafeEqual (Node 22 stdlib — no new dependency)"
  patterns:
    - "Additive PB migration pattern (findCollectionByNameOrId + mutate rule + app.save)"
    - "PB hook as action-layer backstop for IDOR on built-in users collection"
    - "Zod schema-level password floor (pre-PB, surfaces friendlier error than PB's min(8))"
key-files:
  created:
    - "pocketbase/pb_migrations/1745280004_schedule_overrides_body_check.js"
    - "pocketbase/pb_hooks/users_last_viewed_home_membership.pb.js"
    - "tests/unit/admin-scheduler-token.test.ts"
    - "tests/unit/actions/update-task-cross-home.test.ts"
    - "tests/unit/last-viewed-home-idor.test.ts"
  modified:
    - "app/(app)/layout.tsx (filter parameterize + SEC-07 refresh variant)"
    - "app/(app)/h/page.tsx (filter parameterize)"
    - "app/(app)/h/[homeId]/page.tsx (3 filter sites)"
    - "app/(app)/h/[homeId]/members/page.tsx"
    - "app/(app)/h/[homeId]/areas/page.tsx"
    - "app/(app)/h/[homeId]/areas/[areaId]/page.tsx"
    - "app/(app)/h/[homeId]/by-area/page.tsx (2 sites)"
    - "app/(app)/h/[homeId]/history/page.tsx (3 sites)"
    - "app/(app)/h/[homeId]/onboarding/page.tsx"
    - "app/(app)/h/[homeId]/person/page.tsx (3 sites)"
    - "app/(app)/h/[homeId]/tasks/new/page.tsx (2 sites)"
    - "app/(app)/h/[homeId]/tasks/[taskId]/page.tsx (2 sites)"
    - "app/api/admin/run-scheduler/route.ts (SEC-03 timing-safe compare)"
    - "lib/actions/tasks.ts (SEC-04 cross-home area guard)"
    - "lib/actions/seed.ts (filter parameterize)"
    - "lib/actions/areas.ts (filter parameterize)"
    - "lib/scheduler.ts (4 sites — CRITICAL admin-client paths)"
    - "lib/schemas/auth.ts (SEC-06 min 8→12)"
    - "tests/unit/schedule-overrides-integration.test.ts (+2 scenarios)"
    - "tests/unit/schemas/auth.test.ts (SEC-06 coverage)"
    - "tests/e2e/*.spec.ts (12 files — signup password 11→12 chars)"
decisions:
  - "SEC-01 landed as a single commit rather than per-file: all sites were mechanical pb.filter(...) conversions with no logic change. Reviewer scan-time is lower on one grep-accepted commit than 15 tiny ones."
  - "SEC-02 used additive rule amendment (not full rule replacement) so a future down migration restores the pre-Phase-23 string verbatim. Drift-safe; matches migration 1714953602_update_rules_multi_member.js pattern."
  - "SEC-03 kept tokenEquals private to the route segment rather than exporting it. Next.js constrains route file exports to HTTP methods + config; we drive the compare via POST() end-to-end in the unit test (6 scenarios cover every branch)."
  - "SEC-04 mirrored the createTaskAction pattern exactly — fetch target area, compare home_id. Error surface is a friendly formError rather than leaking PB 404 / rule-deny detail."
  - "SEC-05 added a PB hook on top of the existing switchHome assertMembership call. Action-layer check is sufficient for the UI flow; the hook closes the gap for direct SDK calls to /api/collections/users/records/:id. Hook exempts superuser writes + clears."
  - "SEC-06 grandfathered existing 8-char passwords on loginSchema — no forced reset. Only new signups + reset-confirm flows enforce 12. PB's own floor is 8, so zod's min(12) refine surfaces a friendlier error than PB's generic '8 chars' toast."
  - "SEC-07 wired createServerClientWithRefresh at the (app) layout layer (not proxy.ts itself). proxy.ts stays a cheap cookie-presence gate for every navigation; the Server Component render — which already performs multiple PB reads — adds one authRefresh at the top. One roundtrip per authed render is predictable and measurable."
metrics:
  duration_min: ~15
  completed_date: "2026-04-23"
  tests_added: 19
  tests_total_after: 629
  files_changed: 32
  commits: 7
---

# Phase 23 Plan 01-P01: Code Attack Surface Sweep Summary

Defense-in-depth pass closing seven code-level security gaps identified in
the v1.2-security research reports (`auth-access-control.md`,
`attack-surface.md`). Each fix lands as an independent commit so the
`fix(23):` / `feat(23):` history reads as an audit-friendly register of
what changed and why.

## Deliverables (SEC-01 through SEC-07)

### SEC-01 — Filter parameterization sweep (commit 486269a)

Converted every template-literal `filter: \`...\`` across `app/**/*.tsx` +
`lib/**/*.ts` to parameterised `pb.filter('x = {:y}', { y: value })`. 15
files touched, 27 sites total. The highest-risk group was `lib/scheduler.ts`
(4 sites) which runs under the admin PB client — a template-literal
injection there would have unbounded privilege.

Acceptance: `grep -rn 'filter: \`' app/ lib/` returns 0 matches (verified
post-commit).

Every site the research reports flagged (`auth-access-control.md §A-01`,
`attack-surface.md §F-03`) is covered. `app/(app)/h/[homeId]/settings/page.tsx`
was already using the safe pattern and was skipped.

### SEC-02 — schedule_overrides body-check (commit 9009118)

Migration `1745280004_schedule_overrides_body_check.js` amends
`schedule_overrides.createRule` with the additional clause
`@request.body.created_by_id = @request.auth.id`. Matches the defense-
in-depth pattern on `completions.createRule`. Prevents a malicious home
member from forging an override that attributes `created_by_id` to a
different member (audit-trail pollution per `auth-access-control §A-05`).

Two new integration scenarios on `schedule-overrides-integration.test.ts`
(port 18098, test count 10 → 12):
- **Scenario 11**: Alice creates an override with `created_by_id = malloryId`
  → rejected by rule gate (4xx).
- **Scenario 12**: Alice creates an override with `created_by_id = aliceId`
  (her own id) → success.

Down migration reverts to the pre-Phase-23 rule string.

### SEC-03 — Timing-safe scheduler token compare (commit 0ee94a1)

Replaced `provided !== token` in `app/api/admin/run-scheduler/route.ts`
with a private `tokenEquals` helper using `crypto.timingSafeEqual` on
Buffer views of the two strings, guarded by an explicit length-equality
pre-check (timingSafeEqual throws on unequal length). Length mismatch
short-circuits to `false` without running the compare.

The prior `!==` had a byte-by-byte early-exit timing side-channel that
could theoretically leak the ADMIN_SCHEDULER_TOKEN to a network-close
attacker. The length itself is bounded-public (env gate enforces >= 32),
so the leaked bit is already acceptable.

New unit test `tests/unit/admin-scheduler-token.test.ts` (6 scenarios)
drives the POST handler end-to-end:
- Correct token → 200 with runOnce result
- Wrong-length (short) → 401
- Wrong-length (long) → 401
- Wrong-value same-length → 401 (the branch the fix targets)
- Missing header → 401
- Env token < 32 chars → 401 regardless of header

`tokenEquals` is kept private (not exported) because Next.js route
segments restrict exports to HTTP methods + config. The end-to-end test
covers every branch the new code introduces.

### SEC-04 — updateTask cross-verifies area home (commit 1c834bb)

In `lib/actions/tasks.ts` `updateTask`: after fetching the task's
previous state (already done for the assignee-diff path), also compare
the incoming `area_id`'s `home_id` against the task's `home_id`. On
mismatch OR area fetch failure, return formError 'Selected area does
not belong to this home' and skip the update.

Without this check, a user who is a member of both home A and home B
could re-home a task in home A by supplying an area_id belonging to
home B. PB's `tasks.updateRule` gates by membership (which the user has
for home A) but does not enforce the cross-table `area_id.home_id`
invariant. Mirrors the `createTaskAction` invariant at line 168.

New unit test `tests/unit/actions/update-task-cross-home.test.ts`:
- area_id resolves to a DIFFERENT home → formError, no update
- area_id 404s (forged) → formError, no update
- area_id in SAME home → update proceeds normally

### SEC-05 — last_viewed_home_id IDOR hook (commit da2b79a)

Added `pocketbase/pb_hooks/users_last_viewed_home_membership.pb.js` as
the DB-layer backstop. `lib/actions/homes.ts` `switchHome()` already
calls `assertMembership` before writing, but a direct SDK call to
`/api/collections/users/records/:id` bypasses that action-layer guard.

The hook runs on `onRecordUpdateRequest("users")`:
- Bypasses superuser / admin writes (no `e.auth`) — ops/backup flows unaffected.
- Skips when `last_viewed_home_id` is unchanged (comparing original vs
  incoming via `e.record.original().getString(...)`).
- Allows clears (empty string) unconditionally — used by
  `lib/actions/members.ts` when a user leaves a home.
- For non-empty writes, verifies `home_members` row exists for
  `(home_id = target, user_id = auth.id)` via parameterised filter
  (`findFirstRecordByFilter` with `{:hid}` + `{:uid}`). Throws
  `BadRequestError` on miss.

Integration test `tests/unit/last-viewed-home-idor.test.ts` (port 18100,
4 scenarios):
- Non-member home → 4xx rejection + stored value unchanged
- Member home → success
- Clear to '' → success
- Unrelated name update → passes through

### SEC-06 — Password minimum 12 (commit c794743)

In `lib/schemas/auth.ts`:
- `signupSchema.password` and `passwordConfirm`: `min(8)` → `min(12)`.
- `resetConfirmSchema.password` and `passwordConfirm`: `min(8)` → `min(12)`.
- `loginSchema.password`: **kept at min(8)** so grandfathered users with
  pre-Phase-23 passwords can still log in. No forced reset.

Refine message: "Password must be at least 12 characters".

Test updates:
- `tests/unit/schemas/auth.test.ts`: added SEC-06 coverage (rejects 8,
  rejects 11, accepts exactly 12, rejects 8 on reset-confirm). Existing
  happy-path values refreshed from 8/11 chars to 12+ chars.
- **12 E2E spec files**: signup passwords bumped `'password123'` (11
  chars) → `'password1234'` (12 chars). `wrongpass123` for login-error
  tests is left alone (loginSchema still accepts 8+).

### SEC-07 — proxy.ts token refresh via layout.tsx (commit bb14d37)

Swapped `app/(app)/layout.tsx` from `createServerClient()` to
`createServerClientWithRefresh()`. The variant already existed in
`lib/pocketbase-server.ts` (line 50) with a JSDoc explicitly naming
this use case; Phase 23 simply wires it at the authed route boundary.

`proxy.ts` itself remains a cheap cookie-presence check (no PB call,
no per-navigation latency). The Server Component layout — which
already performs multiple PB reads — adds one `authRefresh` at the
top so:
- Stale/revoked tokens are rejected at render time, not later via a
  cryptic 401 from a downstream collection call.
- The token gets rotated, keeping the HttpOnly cookie fresh as long as
  the user is active.

Transparent to existing E2E coverage — authed navigation still
succeeds; only revoked/expired tokens now redirect to `/login` sooner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] SEC-06 bump also required E2E password updates**

- **Found during:** SEC-06 implementation
- **Issue:** The CONTEXT mentioned "Update unit tests that test signup password". While scanning for impacted tests, I found 12 E2E specs using `'password123'` (11 chars) which would have failed the new signup schema. These were not in the plan's test update scope.
- **Fix:** Bulk bumped `'password123'` → `'password1234'` (12 chars) across all 12 e2e signup specs. Integration tests that use the PB admin SDK directly (`pbAdmin.collection('users').create(...)`) are NOT affected because they bypass zod and PB's own floor is min(8) — passwords like `alice123456` (11 chars) still satisfy PB directly.
- **Files modified:** 12 `tests/e2e/*.spec.ts` files.
- **Commit:** c794743 (bundled into SEC-06).

**2. [Rule 2 — Defense-in-depth gap] SEC-05 action-guard already existed — added PB hook as additional layer**

- **Found during:** SEC-05 read-before-fix inspection
- **Issue:** `lib/actions/homes.ts` `switchHome` already had `assertMembership(pb, homeId)` before writing `last_viewed_home_id`. The action-layer guard was already in place; the CONTEXT's "Add: before the PB update, call assertMembership" was essentially already done. However, a direct SDK call to `/api/collections/users/records/:id` bypasses any action-layer guard.
- **Fix:** Added `pocketbase/pb_hooks/users_last_viewed_home_membership.pb.js` as the DB-layer backstop (matching the CONTEXT D-08 "PB rule option recommended hook" guidance). Uses `$app.findFirstRecordByFilter` with parameterised filter to verify membership on every user-initiated write that touches `last_viewed_home_id`.
- **Commit:** da2b79a.

### Intentional Scope Limits (matches CONTEXT)

- SEC-01 grep-verify acceptance: no per-file tests added (grep is the acceptance criteria, mechanical edits).
- SEC-07 no new tests: existing E2E coverage exercises authed navigation; the refresh round-trip is transparent to the happy path (CONTEXT D-11).

### Authentication Gates

None encountered. All changes are server-side code; no human action was
required at any point during execution.

## Verification

- **Full test suite:** `npm test --run` → 74 files, **629 tests passed** (up from 610 pre-Phase-23, +19 new: 2 SEC-02 + 6 SEC-03 + 3 SEC-04 + 4 SEC-05 + 4 SEC-06 additions).
- **Typecheck:** `npx tsc --noEmit` → clean, no errors.
- **SEC-01 grep acceptance:** `grep -rn 'filter: \`' app/ lib/` → 0 matches.

## Commits (in order)

| SHA      | Type        | Subject                                          |
| -------- | ----------- | ------------------------------------------------ |
| 486269a  | fix(23)     | parameterize PB filters (SEC-01)                 |
| 9009118  | feat(23)    | schedule_overrides.createRule body-check (SEC-02) |
| 0ee94a1  | fix(23)     | timing-safe scheduler token compare (SEC-03)     |
| 1c834bb  | fix(23)     | updateTask cross-verifies area home (SEC-04)     |
| da2b79a  | fix(23)     | validate last_viewed_home_id membership (SEC-05) |
| c794743  | fix(23)     | raise password minimum to 12 (SEC-06)            |
| bb14d37  | fix(23)     | proxy.ts uses createServerClientWithRefresh (SEC-07) |

Pushed to `origin/master` (`279b379..bb14d37`).

## Known Stubs

None. All changes are complete fixes with test coverage.

## Self-Check: PASSED

All 5 created files and 25+ modified files present on disk. All 7 commit
hashes in `git log --oneline`. Requirements SEC-01..07 marked complete
in `.planning/REQUIREMENTS.md`. All 629 tests green. Branch pushed to
origin.
