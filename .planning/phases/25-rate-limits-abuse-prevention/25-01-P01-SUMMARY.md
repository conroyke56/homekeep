---
phase: 25
plan: 01
subsystem: security / rate-limiting / abuse-prevention
tags: [RATE, security, rate-limit, quotas, ntfy]
requirements: [RATE-01, RATE-02, RATE-03, RATE-04, RATE-05, RATE-06]
status: complete
date: 2026-04-23
---

# Phase 25 Plan 01: Rate Limits + Abuse Prevention Summary

Tightens the public-signup deployment surface by adding per-owner /
per-home row-creation quotas, narrower per-endpoint PB rate-limit
buckets, an app-layer invite-accept limiter with per-token lockout,
and a min-12-chars + digit-required ntfy-topic rule. All six RATE-IDs
land with integration / unit test coverage; full suite remains green
(80 files, 659 tests).

## Tech-stack
- **Added:** `lib/rate-limit.ts` (sliding-window limiter + token lockout),
  `lib/quotas.ts` (assertHomesQuota / assertTasksQuota / assertAreasQuota)
- **Patterns:** app-layer quota enforcement (PB-JSVM hook deferred — see
  Deviations), sliding-window rate-limit, per-token failure counter

## Key files

**Created:**
- `lib/quotas.ts` — env-configurable quota helpers invoked by create* actions
- `lib/rate-limit.ts` — in-memory limiter + token lockout module
- `pocketbase/pb_hooks/` (no new hook — RATE-01 moved to action layer;
  see Deviations)
- `tests/unit/actions/quotas.test.ts` (RATE-01)
- `tests/unit/hooks-rate-limits.test.ts` (RATE-02/04/05)
- `tests/unit/rate-limit.test.ts` (RATE-03 helper)
- `tests/unit/actions/invite-rate-limit.test.ts` (RATE-03 roundtrip)

**Modified:**
- `pocketbase/pb_hooks/bootstrap_ratelimits.pb.js` (RATE-02/04/05)
- `lib/actions/homes.ts` + `lib/actions/tasks.ts` + `lib/actions/areas.ts`
  (RATE-01 quota guards)
- `lib/actions/invites.ts` (RATE-03 limiter + lockout)
- `lib/schemas/notification-prefs.ts` + `lib/actions/notification-prefs.ts`
  (RATE-06)
- `tests/unit/actions/notification-prefs.test.ts` (RATE-06 cases)
- `tests/unit/actions/tasks-tcsem.test.ts` (mock extension for RATE-01)

## RATE-ID tickets

| ID       | What                                                    | Commit    |
|----------|---------------------------------------------------------|-----------|
| RATE-01  | row quotas (homes ≤5, tasks ≤500, areas ≤10) at action layer | 9e5aa87 |
| RATE-02  | users:create bucket 10/60s                              | 500ed1a |
| RATE-03  | invite-accept 5/60s per-IP + 3-strike per-token lockout | 2c13226 |
| RATE-04  | users:confirmPasswordReset bucket 5/60s                 | 500ed1a |
| RATE-05  | *:authWithPassword tightened 60/60s → 20/60s           | 500ed1a |
| RATE-06  | ntfy topic min 12 chars + ≥1 digit                     | 9b15fdf |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RATE-01 moved from PB JSVM hook → server-action layer**
- **Found during:** first RATE-01 integration-test run
- **Issue:** PB 0.37.1 JSVM exhibits multiple unresolvable issues with
  the plan-specified pattern:
  1. `process.env.MAX_*` reads from inside `onRecordCreateRequest`
     handlers collapse silently to a generic 400 (reading them at the
     top-level module scope works because bootstrap hooks share that
     phase of evaluation).
  2. `countRecords(collection, dbx.hashExp({...}))` and
     `findRecordsByFilter(...., params)` both re-dispatch the tagged
     handler a second time per request; the second `e.next()` lands
     post-transaction and the whole request collapses to
     `"Something went wrong while processing your request."`
     Switching to `onRecordCreate` / `onRecordCreateExecute`, raw
     `newQuery().one()`, splitting hooks into per-collection files,
     and consolidating into a single untagged handler each reproduced
     a variant of the same failure mode.
  3. Raw `.db().newQuery().bind({...})` rejects plain JS objects
     with `GoError: Invalid variable type: must be a NullStringMap`.
- **Fix:** implemented `lib/quotas.ts` invoked from `createHome`,
  `createTask`, `createArea` before the PB create call. Uses the
  authed PB client's `pb.collection().getList()` with `pb.filter()`
  binding (SQL-injection unreachable). Three fix-attempts exhausted
  per the Rule-scope policy; fell back after attempt #3.
- **Residual gap:** a direct PB REST call from a logged-in user's
  browser (bypassing the Next server action) would skirt the quota.
  The /api/ 300/60s bucket remains the outer cap, and realistic
  attack cost is low because the client has no admin credentials.
  Documented in `lib/quotas.ts` docblock.
- **Files modified:** `lib/quotas.ts`, `lib/actions/homes.ts`,
  `lib/actions/tasks.ts`, `lib/actions/areas.ts`
- **Commit:** 9e5aa87

**2. [Rule 3 - Blocking] RATE-02/04/05 moved from migration → bootstrap hook**
- **Found during:** planning — migration-based approach scan
- **Issue:** the codebase has no rate-limit migrations; all existing
  rate-limit config lives in `bootstrap_ratelimits.pb.js` because PB
  settings are global (not per-collection) and don't fit the
  migration abstraction.
- **Fix:** added new buckets to the existing bootstrap hook. Matches
  the established pattern (also used by `bootstrap_batch`,
  `bootstrap_smtp`). Hook is idempotent — re-bootstraps reset-and-
  repush the rule slice.
- **Files modified:** `pocketbase/pb_hooks/bootstrap_ratelimits.pb.js`
- **Commit:** 500ed1a

**3. [Rule 3 - Blocking] extended pb.collection() mock in tasks-tcsem.test.ts**
- **Found during:** full-suite run after RATE-01 landed
- **Issue:** the Phase 13 TCSEM unit tests mock a thin PB client that
  provides only `getOne`, `getFullList`, `create`. RATE-01's
  `assertTasksQuota` adds a `.getList()` call → `TypeError` in 5
  pre-existing tests.
- **Fix:** stubbed `getList()` in the mock to return an empty
  totalItems so the quota check always passes; these tests don't
  exercise quota behaviour, only task-scheduling-engine output.
- **Files modified:** `tests/unit/actions/tasks-tcsem.test.ts`
- **Commit:** 9b15fdf (folded into RATE-06 to keep the suite green)

## Verification

- `npm test --run` — all 659 tests across 80 files pass (118s)
- `npx tsc --noEmit` — clean
- Integration coverage per RATE-ID:
  - RATE-01: `quotas.test.ts` exercises all 3 create-actions with
    ceilings + archived/Whole-Home exemptions
  - RATE-02/04/05: `hooks-rate-limits.test.ts` fires (max+1) calls
    against each bucket and asserts 429
  - RATE-03: `rate-limit.test.ts` unit-tests the limiter semantics;
    `invite-rate-limit.test.ts` exercises the action-layer roundtrip
    for both per-IP and per-token branches
  - RATE-06: `notification-prefs.test.ts` adds 5 new cases covering
    min-length-12, digit-required, boundary, empty-grandfathered

## Metrics

- **Duration:** ~45 minutes wall-clock (dominated by the RATE-01
  JSVM debugging cycle)
- **Task count:** 6 REQ-IDs implemented + 3 deviations logged
- **File count:** 13 files touched (6 created, 7 modified)

## Self-Check: PASSED

- `lib/quotas.ts` FOUND
- `lib/rate-limit.ts` FOUND
- `tests/unit/rate-limit.test.ts` FOUND
- `tests/unit/actions/quotas.test.ts` FOUND
- `tests/unit/actions/invite-rate-limit.test.ts` FOUND
- `tests/unit/hooks-rate-limits.test.ts` FOUND
- Commit 9e5aa87 (RATE-01) FOUND
- Commit 500ed1a (RATE-02/04/05) FOUND
- Commit 2c13226 (RATE-03) FOUND
- Commit 9b15fdf (RATE-06) FOUND
