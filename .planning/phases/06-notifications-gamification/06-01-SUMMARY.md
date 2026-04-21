---
phase: 06-notifications-gamification
plan: 01
subsystem: notifications
tags:
  - pocketbase-migration
  - ntfy
  - idempotency
  - household-streak
  - weekly-summary
  - area-celebration
  - pure-functions

# Dependency graph
requires:
  - phase: 03-completions
    provides: "completions collection, CompletionRecord type, reduceLatestByTask reducer, computeCoverage, computeNextDue"
  - phase: 04-multi-member
    provides: "home_members collection + superuser write pattern (createAdminClient) that Wave 2 scheduler will reuse"
  - phase: 05-views
    provides: "computePersonalStreak algorithm cloned for computeHouseholdStreak; computeAreaCoverage wrapper"

provides:
  - "users.ntfy_topic + 4 notify toggles + weekly_summary_day (D-02)"
  - "notifications collection with UNIQUE INDEX (user_id, ref_cycle) for idempotency (D-05)"
  - "sendNtfy(url, topic, msg) pure fetch wrapper, 5s timeout, never throws (D-03)"
  - "computeHouseholdStreak(completions, now, tz) — ANY member counts (D-10, GAME-01)"
  - "computeWeeklySummary(completions, tasks, areas, now, tz) (D-12, GAME-03)"
  - "detectAreaCelebration(tasks, beforeMap, afterMap, now) — <100→100 crossover (D-13, GAME-04)"
  - "ref_cycle builders (overdue/assigned/weekly/partner) + hasNotified + recordNotification helpers"
  - "Port 18096 claimed for notifications idempotency integration test"

affects:
  - 06-02 (Wave 2 scheduler — consumes all 5 pure fns + notifications accessors)
  - 06-03 (Wave 3 UI — consumes WeeklySummary type, celebration flag)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PB-extend-existing-collection idiom: findCollectionByNameOrId + fields.add + backfill loop"
    - "Append-only collection with null write-rules + UNIQUE INDEX as idempotency safety net"
    - "Pure-fn best-effort PB accessor: swallow all errors, let DB unique index catch races"
    - "AbortController 5s timeout for outbound HTTP (sendNtfy)"
    - "ref_cycle as deterministic dedupe key — {scope}:{id}:{kind}:{timestamp}"

key-files:
  created:
    - "pocketbase/pb_migrations/1714953605_users_notification_prefs.js"
    - "pocketbase/pb_migrations/1714953606_notifications.js"
    - "lib/ntfy.ts"
    - "lib/household-streak.ts"
    - "lib/weekly-summary.ts"
    - "lib/area-celebration.ts"
    - "lib/notifications.ts"
    - "tests/unit/ntfy.test.ts"
    - "tests/unit/household-streak.test.ts"
    - "tests/unit/weekly-summary.test.ts"
    - "tests/unit/area-celebration.test.ts"
    - "tests/unit/notifications.test.ts"
    - "tests/unit/hooks-notifications-idempotency.test.ts"
  modified: []

key-decisions:
  - "06-01: users ntfy_topic stores empty string post-backfill; topic-presence + regex validated at app layer (lib/ntfy.ts) rather than via PB pattern field"
  - "06-01: weekly_summary_day SelectField required:false — PB 0.37.1 enforces required+empty-string combos awkwardly; backfill sets 'sunday'"
  - "06-01: notifications.task_id nullable (minSelect:0) so weekly_summary rows have no task; partition enforced by caller, not schema"
  - "06-01: topic regex /^[A-Za-z0-9_-]{4,64}$/ rejects dots and percent-encoding (T-06-01-04 hardening over ntfy.sh's looser accept)"
  - "06-01: lib/notifications.ts accessors swallow ALL errors — DB UNIQUE INDEX is the sole race safety net; two-layer dedupe per D-05"
  - "06-01: topArea tie-break alphabetical by name (deterministic); mostNeglected tie-break by newer created DESC"
  - "06-01: detectAreaCelebration uses strict < 1.0 and === 1.0 (not epsilon-compare) — coverage is a deterministic mean, no FP drift vs canonical values"
  - "06-01: Disposable-PB port 18096 claimed; allocation log continues 18090..18096"

patterns-established:
  - "Pure-fn gamification primitive: computeHouseholdStreak is algorithm-identical to computePersonalStreak with a looser caller contract documented in jsdoc"
  - "ref_cycle as (scope):(id):(kind):(timestamp) — scheduler pre-check via hasNotified + DB unique index = two-layer dedupe"
  - "sendNtfy never-throws contract: structured {ok,error?} result lets caller decide whether failure is silent/logged/retried"

requirements-completed:
  - GAME-01
  - GAME-03

# Metrics
duration: 12min
completed: 2026-04-21
---

# Phase 6 Plan 1: Notifications & Gamification Foundation Summary

**PB migrations for user notification prefs + idempotent notifications ledger, plus 5 pure-fn primitives (ntfy client, household streak, weekly summary, area-100% crossover, ref_cycle dedupe helpers) — the deterministic engine Wave 2's scheduler will compose.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-21T05:44:00Z
- **Completed:** 2026-04-21T05:56:08Z
- **Tasks:** 2 (both TDD)
- **Files created:** 13
- **Files modified:** 0

## Accomplishments

- Users collection extended with 6 notification-pref fields; pre-existing rows backfilled to product defaults (D-02).
- Append-only `notifications` collection with `UNIQUE INDEX idx_notifications_user_ref_cycle ON (user_id, ref_cycle)` — the scheduler's race-safe idempotency guarantee (D-05).
- Disposable-PB integration test on port 18096 proves 6 contract cases: initial insert 201, duplicate 400, cross-user 201, non-superuser PATCH reject, DELETE reject, row unchanged after rejected PATCH.
- `sendNtfy()` pure fetch wrapper: 5s `AbortController` timeout, strict topic regex, zero log-leakage, structured `{ok,error?}` return that never throws (D-03, T-06-01-04).
- `computeHouseholdStreak` — algorithm-identical to `computePersonalStreak` with the caller contract loosened so ANY member's completion counts (D-10, GAME-01).
- `computeWeeklySummary` composes `computeCoverage` + `computeNextDue` + `reduceLatestByTask` → `{completionsCount, coveragePercent, topArea, mostNeglectedTask}` with locked tie-breaks (D-12, GAME-03).
- `detectAreaCelebration` returns true ONLY on the `<100 → 100` discrete crossover — the anti-spam invariant that keeps confetti one-shot per area per healing event (D-13, GAME-04).
- `lib/notifications.ts` supplies 4 deterministic `ref_cycle` builders plus best-effort `hasNotified` / `recordNotification` accessors; filter injection blocked via `pb.filter(... , {u,r})` binding.
- Test count grew 236 → 281 (+45 — 44 new unit + 1 new integration).

## Task Commits

Each task used full RED → GREEN TDD gating:

1. **Task 1 RED: failing notifications idempotency test** — `16a6958` (test)
2. **Task 1 GREEN: users prefs + notifications migrations** — `a303340` (feat)
3. **Task 2 RED: failing tests for ntfy + 3 gamification fns + builders** — `30e173a` (test)
4. **Task 2 GREEN: lib/ntfy + household-streak + weekly-summary + area-celebration + notifications** — `25894eb` (feat)

## Files Created/Modified

- `pocketbase/pb_migrations/1714953605_users_notification_prefs.js` — 6 user prefs fields + backfill
- `pocketbase/pb_migrations/1714953606_notifications.js` — notifications collection + unique index + append-only rules
- `lib/ntfy.ts` — `sendNtfy()` with 5s timeout and never-throws contract
- `lib/household-streak.ts` — `computeHouseholdStreak()` (home-wide version of personal streak)
- `lib/weekly-summary.ts` — `computeWeeklySummary()` + `WeeklySummary` + `TaskWithAreaName` types
- `lib/area-celebration.ts` — `detectAreaCelebration()` 4-line crossover predicate
- `lib/notifications.ts` — 4 ref_cycle builders + `hasNotified` + `recordNotification` + types
- `tests/unit/hooks-notifications-idempotency.test.ts` — 6-assertion integration test on port 18096
- `tests/unit/ntfy.test.ts` — 13 cases (status codes, timeout, headers, invalid topic, trailing-slash)
- `tests/unit/household-streak.test.ts` — 9 cases (streaks, gaps, DST, future-dated, multi-member)
- `tests/unit/weekly-summary.test.ts` — 9 cases (empty, topArea ties, most-neglected ties, DST)
- `tests/unit/area-celebration.test.ts` — 8 cases (crossover, anti-spam, empty area, partial)
- `tests/unit/notifications.test.ts` — 4 cases (ref_cycle formatters)

## Decisions Made

- **Topic format strictness:** enforced `[A-Za-z0-9_-]{4,64}` at app layer (`lib/ntfy.ts`) rather than via PB TextField `pattern`, to keep the post-backfill empty-string state valid and avoid PB 0.37 pattern-on-empty-string quirks.
- **Task-id nullable on notifications:** schema uses `minSelect:0, maxSelect:1` for `task_id` so weekly_summary rows carry `null`; the kind↔task-presence partition is a caller invariant, not a DB constraint.
- **Two-layer dedupe discipline:** the Wave 2 scheduler will call `hasNotified()` first (cheap read), then `recordNotification()`; if a race slips through the read, the SQLite UNIQUE INDEX rejects the duplicate and `recordNotification` returns `null` — we treat that as a successful idempotent no-op, not a failure.
- **Crossover uses strict equality (`=== 1.0`) not epsilon:** `computeCoverage` is a deterministic mean of clamped healths; floating-point drift would require at least one `health = 0.333...` input, which means the area was never at 100%. The strict check is correct here.
- **Port 18096 claimed:** continues 06-CONTEXT.md allocation (18090..18095 in use by 02-01/03-01/04-01/04-02/05-01).

## Deviations from Plan

None — plan executed exactly as written. The plan anticipated "PB 0.37 JSVM gotchas for SelectField default" as a possible deviation, but the actual migration landed cleanly on the first apply; backfill handles the defaulting at the row level, sidestepping PB's awkward field-level default semantics as intended.

The single lint nit (`'_e' is defined but never used` inside `lib/ntfy.ts`) was resolved inline by switching to `catch {}` (Rule 1 bug polish in the same commit; lint now shows only the pre-existing out-of-scope RHF warning on `components/forms/task-form.tsx:139`).

## Issues Encountered

None.

## Authentication Gates

None — no external services touched in this plan. `lib/ntfy.ts` is pure and unit-tested without any real ntfy.sh interaction.

## TDD Gate Compliance

Both tasks executed the full RED → GREEN cycle:

- **Task 1:** `test(06-01): add failing test for notifications idempotency contract` (16a6958) → failure verified (`Missing or invalid collection context.`) → `feat(06-01): add users notification prefs + notifications collection` (a303340) → integration test passes (6/6 assertions green).
- **Task 2:** `test(06-01): add failing tests for ntfy + gamification pure fns` (30e173a) → all 5 files fail with `Failed to resolve import` → `feat(06-01): implement ntfy client + gamification pure fns` (25894eb) → 44/44 unit tests green.

No REFACTOR commits were needed — each GREEN landed clean.

## User Setup Required

None — no external service configuration or env-var touch in this plan. `NTFY_URL` env plumbing deferred to Wave 2 scheduler (06-02) per D-01.

## Threat Model Adherence

All `mitigate` dispositions in the plan's `<threat_model>` are implemented:

- **T-06-01-01 / T-06-01-02** (spoofing/tampering): `listRule`/`viewRule` pin to `user_id = @request.auth.id`; `createRule`/`updateRule`/`deleteRule` all `null`. Proved by integration test: non-superuser PATCH + DELETE reject with HTTP ≥400.
- **T-06-01-03** (repudiation): append-only contract + unique index; duplicate insert returns 400.
- **T-06-01-04** (ntfy log info leakage): `lib/ntfy.ts` console.warn logs ONLY the status code or `'network'` string — never the topic, title, or body.
- **T-06-01-07** (unique-index race): `recordNotification` catches the 400 silently and returns `null`; the pre-check via `hasNotified` amortises the cost in the non-race case.

`accept`-disposition threats (T-06-01-05 ntfy_topic visible to co-members; T-06-01-06 ntfy rate-limit; T-06-01-08 summary payload) are inherited from the plan without new mitigation — scope matches the threat register.

## Next Phase Readiness

**Wave 2 (plan 06-02) consumes from this plan:**

- `sendNtfy(url, topic, msg)` — scheduler will source `url` from `process.env.NTFY_URL ?? 'https://ntfy.sh'` (D-01).
- `computeHouseholdStreak`, `computeWeeklySummary`, `detectAreaCelebration` — scheduler + `completeTaskAction` will invoke per cron tick / mutation.
- `buildOverdueRefCycle`, `buildAssignedRefCycle`, `buildWeeklyRefCycle`, `buildPartnerRefCycle` — scheduler + server actions derive dedupe keys.
- `hasNotified` + `recordNotification` — scheduler's check-then-insert pattern.
- `NotificationRecord` + `NotificationKind` — Wave 3 UI types if a per-user history surface ships.
- `notifications` collection — superuser write path via `createAdminClient()` (pattern already proven by 04-02's acceptInvite).

**Wave 3 (plan 06-03) consumes from this plan:**

- `users.ntfy_topic` + 4 toggles + `weekly_summary_day` — Person view's Notifications section binds directly to these fields.
- `WeeklySummary` type — optional dashboard widget shape, if the spec surfaces it in-app.
- `computeHouseholdStreak` — dashboard header badge.

**No blockers.** Wave 2 can begin immediately. Port 18097 is the next disposable-PB slot for Wave 2's scheduler integration test, if one is added.

## Self-Check: PASSED

Verified (via grep + `test -f`):

- FOUND: `pocketbase/pb_migrations/1714953605_users_notification_prefs.js` (contains `ntfy_topic`, `findRecordsByFilter('users'`)
- FOUND: `pocketbase/pb_migrations/1714953606_notifications.js` (contains `idx_notifications_user_ref_cycle`, `UNIQUE INDEX`, `createRule: null`, `updateRule: null`, `deleteRule: null`, `ref_cycle`)
- FOUND: `lib/ntfy.ts` (exports `sendNtfy`)
- FOUND: `lib/household-streak.ts` (exports `computeHouseholdStreak`)
- FOUND: `lib/weekly-summary.ts` (exports `computeWeeklySummary`)
- FOUND: `lib/area-celebration.ts` (exports `detectAreaCelebration`)
- FOUND: `lib/notifications.ts` (exports `buildOverdueRefCycle`)
- FOUND: `tests/unit/hooks-notifications-idempotency.test.ts` (references port `18096`)
- FOUND: commit 16a6958 (test: failing integration test)
- FOUND: commit a303340 (feat: migrations)
- FOUND: commit 30e173a (test: failing unit tests)
- FOUND: commit 25894eb (feat: pure fns)
- FULL SUITE: 281/281 passing; typecheck clean; `npm run build` green.

---

*Phase: 06-notifications-gamification*
*Plan: 01*
*Completed: 2026-04-21*
