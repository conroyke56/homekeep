---
phase: 11
plan: 02
subsystem: task-model-extensions
tags:
  - task-scheduling
  - coverage
  - completions
  - ooft
  - seasonal
  - branch-composition
  - wave-2
  - D-16-branch-order
dependency_graph:
  requires:
    - "Plan 11-01 helpers (isInActiveWindow, nextWindowOpenDate, widened Task type)"
    - "Phase 10 override branch + pb.createBatch atomic pattern"
  provides:
    - "computeNextDue with D-16 branch order: archived → freq-guard(null-safe) → override → seasonal-dormant → seasonal-wakeup → OOFT → cycle → anchored"
    - "computeNextDue 5th optional timezone?: string param (A2 Option A adopted)"
    - "computeCoverage dormant-task pre-filter (D-14, SEAS-05)"
    - "completeTaskAction atomic OOFT archive batch op (D-04, OOFT-02)"
    - "wasInPriorSeason private helper (A3 365-day heuristic)"
  affects:
    - "Plan 11-03 integration suite — end-to-end OOFT lifecycle + seasonal lifecycle + override-on-dormant scenarios"
    - "Phase 12 LOAD smoother — inherits the 5th timezone param slot; 6th `smoothed?` slot reserved"
    - "Phase 14 Seasonal UI — isInActiveWindow consumption plus dormant-filter contract"
    - "Phase 15 OOFT Form UI — due_date read behaviour plus archive-on-complete UX"
tech-stack:
  added: []
  patterns:
    - "D-17 override precedence preserved (runs BEFORE seasonal-dormant check)"
    - "Shared lastInPriorSeason computation: one helper call feeds both the dormant and wake-up branches (refined from plan's two-independent-branches pattern — see Deviations)"
    - "UTC-month fallback when timezone undefined (Pitfall 4 acceptance)"
    - "Conditional pb.createBatch op pattern — extending Phase 10's atomic transaction without new batch instantiation"
key-files:
  created: []
  modified:
    - "lib/task-scheduling.ts (272 → 423 lines; +151 lines; computeNextDue body extended with 3 new branches + 5th timezone param; private wasInPriorSeason helper added at bottom)"
    - "lib/coverage.ts (76 → 107 lines; +31 lines; isDormant inline helper + filter-chain extension + import isInActiveWindow)"
    - "lib/actions/completions.ts (354 → 382 lines; +28 lines; conditional OOFT archive op in pb.createBatch + JSDoc Phase 11 section)"
    - "tests/unit/task-scheduling.test.ts (382 → 664 lines; +282 lines; 16 new tests across 4 describe blocks)"
    - "tests/unit/coverage.test.ts (262 → 338 lines; +76 lines; 4 new tests in 1 describe block)"
decisions:
  - "A2 Option A adopted: 5th timezone?: string param with default undefined → UTC-month fallback; 44 Phase 10 call-sites preserved byte-identical (D-26)"
  - "archived_at field INCLUDED in OOFT archive op — verified present in baseline migration 1714780800_init_homekeep.js:145 via grep"
  - "Dormant/wake-up branch composition refactored from plan text — single shared lastInPriorSeason computation replaces independent dormant-branch and wake-up-branch conditions. Required to satisfy plan's test case 'last completion 400d ago (prior season) → next window open' which expects wake-up to win over dormancy when now is out-of-window AND completion is prior-season. See Deviations."
  - "wasInPriorSeason kept PRIVATE (not exported) — only computeNextDue's seasonal-wakeup branch consumes it; exposing would require publicly documenting the A3 heuristic contract"
  - "No new unit tests added in Task 3 (OOFT archive batch op) — plan defers integration assertion to Plan 11-03's disposable-PB scenarios"
metrics:
  duration: ~11min
  tasks: 3
  files_created: 0
  files_modified: 5
  lines_added: 568
  tests_added: 20
  total_tests: 406
  baseline_tests: 386
  plan_11_01_tests: 31
  plan_11_02_tests: 20
  completed: 2026-04-22
---

# Phase 11 Plan 02: Task Model Extensions — Branch Composition Summary

Wire Plan 11-01's pure helpers into the three runtime surfaces per D-16 branch order: `computeNextDue` gains 3 new branches (seasonal-dormant, seasonal-wakeup, OOFT) composed with Phase 10's override branch plus a 5th optional timezone parameter; `computeCoverage` gains a dormant-task pre-filter (SEAS-05); `completeTaskAction` appends one conditional batch op that atomically archives one-off tasks on completion (OOFT-02 / D-04). Zero architectural changes; 44 Phase 10 call-sites preserved byte-identical (D-26).

## What Was Built

### Production files

| File | Before | After | Delta | Purpose |
|------|--------|-------|-------|---------|
| `lib/task-scheduling.ts` | 272 | 423 | +151 | `computeNextDue` extended with seasonal-dormant (D-12, SEAS-02), seasonal-wakeup (D-12, SEAS-03), OOFT (D-05, OOFT-05) branches. 5th optional `timezone?: string` param (A2 Option A). Frequency-validation guard wrapped in `task.frequency_days !== null` so OOFT tasks bypass the positive-integer check. JSDoc preamble updated with D-16 branch list + timezone semantics. New private `wasInPriorSeason` helper (A3 365-day heuristic) at file bottom. |
| `lib/coverage.ts` | 76 | 107 | +31 | `computeCoverage` imports `isInActiveWindow`; adds inline `isDormant(t)` helper; filter chain becomes `!t.archived && !isDormant(t)`. Signature UNCHANGED — UTC-month fallback accepted per Pitfall 4. Year-round tasks (no window) unaffected. |
| `lib/actions/completions.ts` | 354 | 382 | +28 | Conditional OOFT archive op appended to existing Phase 10 `pb.createBatch`: `if (task.frequency_days === null) batch.collection('tasks').update(task.id, { archived: true, archived_at: now.toISOString() })`. Placement AFTER override consumption, BEFORE `batch.send()`. Preserves `results[0] = completion` for downstream destructure. JSDoc extended with Phase 11 D-04 atomicity section. |

### Test files

| File | Before | After | Delta | Tests Added |
|------|--------|-------|-------|-------------|
| `tests/unit/task-scheduling.test.ts` | 382 | 664 | +282 | **16 new tests** across 4 describe blocks: OOFT branch (4), seasonal dormant (3), seasonal wake-up (5), branch composition (4). Covers: unborn OOFT, null due_date defense, completed OOFT null semantic, past due_date legitimate, out-of-window dormancy null, in-window fall-through to cycle, out-of-window no-completion wake-up, Perth tz boundary math, 400d-prior wake-up, same-season continuation, wrap-window Oct-Mar wake-up, D-17 override-on-dormant, archived dominates all, null-due-null-completion non-throw, hybrid OOFT+seasonal dormant-branch wins. |
| `tests/unit/coverage.test.ts` | 262 | 338 | +76 | **4 new tests** in 1 describe block: dormant-only → 1.0 (empty-home invariant), year-round NOT excluded (v1.0 backward-compat), dormant+active-overdue mix → active-only mean = 0, in-window seasonal task included in mean. |

## A2 Resolution — 5th `timezone?` Param Adopted

**Outcome:** **Option A (extend signature).** The plan's planning_context locked this per AUTO-RESOLVED. Implemented with default `undefined`.

**D-26 preservation check:** grep for `computeNextDue(` call-sites with 4 args (no tz) — all 44 Phase 10 sites continue to work unchanged because the new param defaults to `undefined`. The 5 new test cases that pass seasonal scenarios explicitly pass `'UTC'` or `'Australia/Perth'` as the 5th arg. Zero mechanical churn required in pre-existing tests.

**Phase 12 forward compatibility:** the 6th `smoothed?` param slot is reserved. No further signature churn expected in v1.1.

## archived_at Field Inclusion

**Decision:** **INCLUDED** in the OOFT archive batch op.

**Verification:** `grep -rn 'archived_at' pocketbase/pb_migrations/` returned one hit:
```
1714780800_init_homekeep.js:145: tasks.fields.add(new DateField({ name: "archived_at" }));
```
The `archived_at` DateField is part of the baseline tasks schema (v1.0), so including it in the Phase 11 archive update is backward-compatible and matches the existing `archiveTask` action pattern. Writing ISO8601 UTC via `now.toISOString()`.

## Branch-Order Verification Table (D-16)

| Branch Order Step | Test Assertion | File:line |
|---|---|---|
| 1. archived → null | `archived task with all Phase 11 fields set → still returns null` | task-scheduling.test.ts:618 (approx) |
| 1. archived > override | `O6: archived task + override → null (archived short-circuit runs first)` | task-scheduling.test.ts:324 (existing Phase 10) |
| 2. freq-guard null-safe | `OOFT with null due_date and null completion → returns null (not throw)` | task-scheduling.test.ts:638 (approx) |
| 3. override > dormant (D-17) | `override on dormant seasonal task → override wins` | task-scheduling.test.ts:600 (approx) |
| 5. seasonal-dormant (SEAS-02) | `out-of-window with prior completion → null` | task-scheduling.test.ts:484 (approx) |
| 6. seasonal-wakeup (SEAS-03) | `no completion + Apr-Sep window, now=Feb → Apr 1 UTC` | task-scheduling.test.ts:534 (approx) |
| 7. OOFT null-freq (D-05) | `unborn OOFT (no completion) → returns due_date` | task-scheduling.test.ts:437 (approx) |
| 8. cycle fall-through | `in-window with prior in-season completion → cycle branch` | task-scheduling.test.ts:497 (approx) |

All 8 branch-order invariants covered by explicit test assertions.

## Decisions Made During Execution

1. **A2 Option A — locked with `undefined` default.** Adopted verbatim from plan. 44 Phase 10 call-sites preserved.

2. **`archived_at` included** — baseline schema has the field; writing the timestamp matches `archiveTask` action convention.

3. **Branch composition refactored from plan text** (Deviation 1 below) — plan described dormant and wake-up as two independent branches (`if (hasWindow && lastCompletion) { if (!in-window) return null; }` followed by `if (hasWindow) { if (lastInPriorSeason) return wakeup; }`). The plan's own test case "last completion 400d ago (prior season) → next window open" demanded that wake-up win even when now is out-of-window AND a prior-season completion exists. Resolved by computing `lastInPriorSeason` once, then gating dormancy on `!inWindowNow && !lastInPriorSeason` — i.e. same-season dormancy returns null, but prior-season out-of-window triggers wake-up. Same test suite passes both "400d ago → wake-up" and "completed in Jan, now July → null" (different semantics only because `lastInPriorSeason` differs: 400d → true, 186d in-window → false).

4. **`wasInPriorSeason` kept private.** The A3 365-day heuristic is an implementation detail; documenting it publicly would promote it to an API contract. Kept as file-local function at the bottom of `lib/task-scheduling.ts`.

5. **No new unit tests for Task 3 (OOFT archive batch op).** Per plan instructions: the "completed OOFT returns null" behaviour is covered in Task 1's unit suite; the end-to-end atomic-archive assertion is deferred to Plan 11-03's disposable-PB integration scenarios.

## Deviations from Plan

### 1. Dormant/wake-up branch composition merged

**Plan text:** Two independent branch blocks — first `seasonal-dormant` returning null, then `seasonal-wakeup` returning the next open date.

**Executed:** Single combined block with a shared `lastInPriorSeason` computation. Dormancy only fires when `!inWindowNow && !lastInPriorSeason` (same-season dormancy); otherwise wake-up or cycle fall-through handles the case.

**Why deviated:** The plan's own test expectation set the constraint — the "400d ago prior-season" test at task-scheduling.test.ts ~line 519 requires wake-up to win when now is out-of-window AND completion is prior-season. The plan's two-independent-branch pattern returns `null` in that case (dormant fires first). To satisfy both the D-17 override-precedence test AND the prior-season-wake-up test, the branch conditions needed composition, not independence.

**Impact:** No D-26 impact; all 44 existing Phase 10 test assertions still pass. The semantic invariants documented in D-12 are preserved: dormant task returns null, wake-up task returns from-month-midnight, in-season task uses cycle branch. The refactor clarifies the decision matrix:

| `inWindowNow` | `lastInPriorSeason` | Result |
|---|---|---|
| false | false | null (same-season dormant) |
| false | true | wake-up (prior-season → next open) |
| true | false | cycle branch (same-season continuation) |
| true | true | wake-up (prior-season → next open) |

### 2. One test in coverage suite "accidentally" passed in RED

**Plan text expectation:** 3+ new coverage tests all failing in RED.

**Executed:** 4 tests added; only 1 failed in RED ("mix: 1 dormant + 1 active-overdue"). The other 3 passed accidentally because either (a) the empty-home invariant kicks in when the only task is "dormant" (counted as active via wake-up-in-future = health 1.0), or (b) the in-window seasonal task produces health 1.0 anyway.

**Why acceptable:** The failing test is the real gate — it's the only case where the dormant-filter decision actually matters (when a dormant task's wake-up-health would drag or inflate the mean). Once the filter is in place, all 4 tests pass with correct semantics. The "accidentally green" tests become meaningful regression gates going forward.

**Impact:** None. Dormant-filter correctness is asserted.

### 3. No repo-root CLAUDE.md

`./CLAUDE.md` not present in repo root (consistent with Plan 11-01 SUMMARY note). No project-layer directives to enforce beyond the standard GSD conventions.

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Task 1 unit tests (GREEN) | `npm test -- tests/unit/task-scheduling.test.ts --run` | 39/39 green (was 23; +16) |
| Task 2 unit tests (GREEN) | `npm test -- tests/unit/coverage.test.ts --run` | 17/17 green (was 13; +4) |
| Task 3 (no new tests) | — | N/A (integration deferred to 11-03) |
| Full regression | `npm test --run` | **406/406 green** (386 → 406; +20) |
| Type-check | `npx tsc --noEmit` | clean exit, zero new errors |
| D-26 preservation | Existing 386 tests unchanged assertions | Verified — no test files pre-dating this plan required edits |
| Branch-order (D-16) | Explicit test assertions per table above | 8/8 invariants asserted |
| archived_at grep | `grep archived_at pocketbase/pb_migrations/` | 1 hit — 1714780800_init_homekeep.js:145 (baseline field) |
| `frequency_days === null` in completions.ts | `grep 'frequency_days === null' lib/actions/completions.ts` | 2 hits (line 63 JSDoc, line 249 runtime check) |
| Batch op order | override (line 235) < OOFT archive (line 249) < batch.send() | Verified via grep |

## Handoff for Plan 11-03 (Integration Suite — Wave 3)

Plan 11-03 owns the disposable-PocketBase integration suite on **port 18099** (reserved by Plan 11-01). Plan 11-02 ships only unit-level assertions; end-to-end correctness is 11-03's mandate.

**Scenarios to seed (from D-25 + plan text):**

1. **Migration correctness.** Boot PB against fresh `pb_data` with migrations 1714780800 (init) → 1745280000 (schedule_overrides) → 1745280001 (task_extensions) applied. Assert all 4 new fields (`due_date`, `preferred_days`, `active_from_month`, `active_to_month`) exist via `GET /api/collections/tasks`, with correct types/constraints. Assert `frequency_days.required === false`.

2. **Full OOFT lifecycle — atomic archive (OOFT-02, D-04, T-11-03).** Seed home + member + area. Create task with `frequency_days: null, due_date: '2026-05-01T00:00:00.000Z'`. Verify `computeNextDue` reads `due_date`. Call `completeTaskAction(taskId)`. Verify IN ONE BATCH: (a) completion row written, (b) task row has `archived: true` AND `archived_at: <now>`. Verify `computeNextDue` now returns null. Verify the task no longer appears in `getFullList({ filter: 'archived = false' })`.

3. **OOFT + override interaction.** Seed OOFT task. Create schedule_override. Complete task. Verify batch contains 3 ops (completion + override consumption + task archive) in declaration order. `results[0]` = completion, `results[1]` = override consumed, `results[2]` = task archived. All atomic — if any fail, the whole batch rolls back.

4. **Full seasonal lifecycle.** Seed seasonal task (`active_from_month: 10, active_to_month: 3, frequency_days: 30`, no completion). During July (current now in test): `computeNextDue` returns Oct 1 wake-up date; `computeCoverage` excludes from mean (dormant filter). Shift test `now` to November: `computeNextDue` returns cycle-based next-due (wake-up anchors); `computeCoverage` now includes the task. Complete task in November. Shift test `now` back to July of next year: `computeNextDue` returns null (dormant — same-season gap check now trips on completion in prior-season November). Full lifecycle in one test.

5. **Override beats dormant-seasonal (D-17).** Seed seasonal task (Oct-Mar window). During July (out-of-window), create a schedule_override with snooze_until = Aug 1. Call `computeNextDue` → must return Aug 1 (override wins), NOT null (dormancy would otherwise fire). Verify the Phase 15 UI warning contract surfaces here (Phase 15 owns rendering; Plan 11-03 just checks the data-layer invariant).

6. **Zod rejection (from Plan 11-01).** Integration cross-check: `pb.collection('tasks').create({ frequency_days: null, due_date: null, ... })` must fail either at zod layer (app-layer server action) OR at PB level. Plan 11-01 already unit-tests zod; Plan 11-03 confirms end-to-end rejection.

**Port allocation:** **18099 claimed** (by 11-01, unused; 11-03 opens the disposable PB here).

**State assumptions for 11-03:**
- Migration `1745280001_task_extensions.js` applied (live).
- Helpers exported from `lib/task-scheduling.ts`: `effectivePreferredDays`, `narrowToPreferredDays`, `isInActiveWindow`, `nextWindowOpenDate`.
- `computeNextDue` 5-param signature live; 5th param defaults to `undefined` (UTC fallback).
- `computeCoverage` dormant filter live.
- `completeTaskAction` OOFT archive op live.
- Test baseline starts from **406 tests green**. Plan 11-03 adds ~4-6 integration scenarios. Preservation of all 406 is the regression gate.

## Commits

- `647723f` — `test(11-02): add failing tests for computeNextDue OOFT + seasonal branches`
- `8238b41` — `feat(11-02): extend computeNextDue with seasonal + OOFT branches + timezone param`
- `7caf43f` — `test(11-02): add failing tests for computeCoverage dormant filter`
- `751b98d` — `feat(11-02): extend computeCoverage with dormant-task filter (SEAS-05)`
- `8df6542` — `feat(11-02): atomic OOFT auto-archive in completeTaskAction batch (D-04)`

## Self-Check: PASSED

- `lib/task-scheduling.ts` exists: FOUND
- `lib/coverage.ts` exists: FOUND
- `lib/actions/completions.ts` exists: FOUND
- `tests/unit/task-scheduling.test.ts` exists: FOUND
- `tests/unit/coverage.test.ts` exists: FOUND
- Commit 647723f exists: FOUND
- Commit 8238b41 exists: FOUND
- Commit 7caf43f exists: FOUND
- Commit 751b98d exists: FOUND
- Commit 8df6542 exists: FOUND
- Full test suite: 406 passed
- Type-check: clean
