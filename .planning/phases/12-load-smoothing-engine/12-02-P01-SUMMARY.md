---
phase: 12-load-smoothing-engine
plan: 02
subsystem: scheduling
tags:
  - load-smoothing
  - computeNextDue-branch
  - load-15-hard-gate
  - branch-matrix
  - wave-2
  - anchored-bypass
  - seasonal-wakeup-handshake

# Dependency graph
requires:
  - phase: 12-load-smoothing-engine
    plan: 01
    provides: "Task.next_due_smoothed field on PB + zod + TS type; isOoftTask helper; placeNextDue + computeHouseholdLoad pure helpers; Wave 1 transient T7 test (now flipped)"
  - phase: 11-task-model-extensions
    provides: "wasInPriorSeason heuristic; seasonal branch layout (hasWindow, lastInPriorSeason, inWindowNow) in computeNextDue; nextWindowOpenDate helper"
  - phase: 10-schedule-overrides
    provides: "Override type + override branch in computeNextDue (D-06, D-10) — runs BEFORE the new smoothed branch per D-02"
provides:
  - "computeNextDue smoothed branch (LOAD-02, LOAD-06, LOAD-07) — reads task.next_due_smoothed between override and seasonal branches (D-02 position)"
  - "D-03 anchored-bypass guard — schedule_mode !== 'anchored' is authoritative; stale smoothed on anchored tasks ignored (LOAD-06)"
  - "D-15 seasonal-wakeup handshake — inline hasWindow + prior-season check falls through to seasonal-wakeup branch (LOAD-07); no write-time null coordination needed"
  - "T-12-07 Invalid Date defense — smoothed.getTime() > 0 guard + fall-through to seasonal/cycle; no crash on malformed admin-UI writes"
  - "LOAD-15 hard gate cleared at unit level (21/21 branch composition matrix tests green) — phase's highest-risk gate unblocked for Wave 3"
  - "Flipped T7 test in tests/unit/load-smoothing.test.ts — computeHouseholdLoad now contributes on smoothed date when present (Wave 1 transient → Wave 2 contract)"
affects:
  - "Phase 12 Wave 3 (12-03): completeTaskAction batch extension can write next_due_smoothed via tasks.update and the read-side (this plan) picks it up transparently — no further computeNextDue churn"
  - "Phase 12 Wave 4 (12-04): integration Scenarios 2 + 5 exercise the write → read loop end-to-end; LOAD-13 perf benchmark composes over the now-wired branch"
  - "Phase 13 TCSEM: createTaskAction seeds next_due_smoothed on creation via placeNextDue; read-side here surfaces that placement from the first render"
  - "Phase 14 seasonal UI: dormant/wake-up behavior unchanged — smoothed handshake is invisible to the UI layer"
  - "Phase 16 LVIZ: horizon density visualization consumes the same effective next-due via computeNextDue → computeHouseholdLoad composition"
  - "Phase 17 REBAL: preservation rules read next_due_smoothed via the same branch; anchored tasks' natural date still contributes to load map"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only branch insertion (D-07 forward-only) — smoothed branch returns a Date; never writes the field. Writes are Wave 3."
    - "Inline seasonal-wakeup handshake (D-15) over cross-branch state coordination — avoids needing a null-on-wakeup write guarantee"
    - "Falsy + getTime() > 0 two-stage guard for Invalid Date defense (T-12-07) — matches existing Phase 10 override 'falsy consumed_at' posture"

key-files:
  created: []
  modified:
    - "lib/task-scheduling.ts (459 → 509 lines; +51 net; +51 / -0) — new Phase 12 smoothed branch after override, before seasonal"
    - "tests/unit/task-scheduling.test.ts (681 → 1080 lines; +399 / -0) — new `branch composition matrix — LOAD-15 hard gate` describe block with 21 tests; computeHouseholdLoad + placeNextDue imports added"
    - "tests/unit/load-smoothing.test.ts (601 → 602 lines; +21 / -20) — T7 flipped from Wave-1 transient to Wave-2 contract (smoothed-date contribution)"

key-decisions:
  - "Branch insertion landed at the exact position documented in 12-CONTEXT.md D-02 and 12-RESEARCH.md §Pattern 3: AFTER the override `}` closure (line 220 pre-edit) and BEFORE the `// ─── Phase 11 seasonal branches (D-12) ──` comment. No other branch bodies modified; byte-identical v1.0 behavior preserved for all fixtures with next_due_smoothed=null."
  - "D-15 handshake is inline (hasWindow + wasInPriorSeason check reused from the seasonal block below) rather than hoisting a shared lastInPriorSeason variable above both branches. Rationale: keeps the smoothed branch self-contained; wasInPriorSeason is already module-private at lines 445-458 (now 495-508) so reuse has zero import / re-export churn. The seasonal block below recomputes lastInPriorSeason independently — duplicate work is O(1) per call and the branches stay cleanly decoupled."
  - "T-12-07 Invalid Date defense uses `new Date(s).getTime() > 0` not `!isNaN(d.getTime())`. Rationale: getTime() returns NaN for Invalid Date, and `NaN > 0` is false, so the truthy-return is short-circuited cleanly. Matches date-fns idiom elsewhere in the module. Equivalent correctness, fewer imports."
  - "Case 19 (seasonal-wakeup × anchored × PREF) expected value: `2026-06-01` (seasonal-wakeup fires), NOT the natural anchored date. Rationale: the anchored-bypass guard is scoped to the SMOOTHED branch only — seasonal branches run unconditionally before the cycle/anchored fork. This is the correct byte-identical v1.0 composition (Phase 11 shipped this as seasonal-wakeup beats anchored when lastInPriorSeason). Plan's `<behavior>` §Case 19 description was updated inline in the test comment to reflect this precise interpretation."
  - "Flipping Wave 1's T7 rather than adding a parallel test. Rationale: Plan 12-01 SUMMARY §Handoff for Wave 2 explicitly flagged this test as the intended Wave-2 flip point. Keeping a stale 'Wave 1 transient' test alongside a new 'Wave 2 contract' test would document historical implementation rather than current contract — and duplicate coverage with Case 3/20 in the new matrix. Single-source-of-truth principle wins."

patterns-established:
  - "Pattern: Inline branch handshake over shared precomputation — when two branches need the same state predicate (hasWindow + lastInPriorSeason), compute it twice (O(1)) rather than hoisting and risking cross-branch coupling. See `treatAsWakeup` inline computation in the smoothed branch."
  - "Pattern: Branch-matrix test describes with scoped `makeBranchTask(overrides: Partial<Task>)` helper that pre-populates EVERY Phase 11+12 field with null defaults. Makes test intent explicit — reader sees exactly which field drives the case via the override list."
  - "Pattern: Test case naming `Case N: <interaction> — <outcome>` maps 1:1 to 12-VALIDATION.md table rows. Enables mechanical traceability from spec to test."

requirements-completed:
  - LOAD-02
  - LOAD-06
  - LOAD-07
  - LOAD-15

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 12 Plan 02: Load-Smoothing Engine Wave 2 — computeNextDue smoothed branch + LOAD-15 hard gate

**Inserted the `next_due_smoothed` branch into `computeNextDue` at the exact D-02 position between override and seasonal, landed the D-03 anchored bypass + D-15 seasonal-wakeup handshake + T-12-07 Invalid Date defense, and proved the 6-branch composition matrix with 21 mandatory LOAD-15 tests — the phase's highest-risk gate cleared at the unit level.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T11:09:38Z
- **Completed:** 2026-04-22T11:17:03Z
- **Tasks:** 2 / 2
- **Files modified:** 3 (task-scheduling, task-scheduling.test, load-smoothing.test)
- **Test delta:** +21 new (task-scheduling.test.ts) + 1 semantic update (load-smoothing.test.ts T7 flip). Net suite delta: 434 → 455.

## Accomplishments

### Task 1 — smoothed branch inserted in `computeNextDue`

51-line addition to `lib/task-scheduling.ts` between the override closing `}` (previously line 220) and the `// ─── Phase 11 seasonal branches (D-12) ──` comment (previously line 222). New branch body:

```typescript
if (
  task.schedule_mode !== 'anchored'
  && task.next_due_smoothed
) {
  const hasWindow =
    task.active_from_month != null && task.active_to_month != null;
  const treatAsWakeup = hasWindow && (
    !lastCompletion
    || wasInPriorSeason(
         new Date(lastCompletion.completed_at),
         task.active_from_month!,
         task.active_to_month!,
         now,
         timezone,
       )
  );
  if (!treatAsWakeup) {
    const smoothed = new Date(task.next_due_smoothed);
    if (smoothed.getTime() > 0) return smoothed;
    // Invalid Date (T-12-07) → fall through to seasonal / cycle.
  }
  // else: fall through to seasonal block — wake-up anchors to window.
}
```

Four guard layers:
1. **D-03 anchored bypass** — `task.schedule_mode !== 'anchored'` skips the entire block for anchored tasks, making a stale `next_due_smoothed` value silently ignored (LOAD-06 byte-identical v1.0 behavior).
2. **T-12-03 v1.0 holdover** — `&& task.next_due_smoothed` falsy-check short-circuits for null / empty-string rows (PB 0.37.1 DateField semantics), falling through to the seasonal / cycle / anchored branches with zero behavior change.
3. **D-15 seasonal-wakeup handshake** — `treatAsWakeup` inline check reuses the private `wasInPriorSeason` helper (already in module scope lines 495-508). When true, falls through to the seasonal-wakeup branch below, which returns `nextWindowOpenDate(...)`. First-cycle / prior-season seasonal tasks ignore any stale smoothed value.
4. **T-12-07 Invalid Date defense** — `smoothed.getTime() > 0` guards against malformed admin-UI writes. NaN comparison is false, so malformed strings cascade through to the natural branches instead of returning `Invalid Date`.

Zero behavior change for fixtures where `next_due_smoothed` is null/empty or the task is anchored or seasonal-waking — the 39 pre-existing tests in `tests/unit/task-scheduling.test.ts` stayed green on first run.

### Task 2 — 21-case LOAD-15 branch composition matrix

New describe block `branch composition matrix — LOAD-15 hard gate` appended at end of `tests/unit/task-scheduling.test.ts`. All 21 cases green on first run.

**Branch precedence axis (Cases 1-6):**
| # | Scenario | Expected |
|---|----------|----------|
| 1 | archived wins over everything | null |
| 2 | override wins over smoothed | `2026-05-20` (override) |
| 3 | smoothed wins over seasonal-dormant (same-season) | `2026-05-15` (smoothed) |
| 4 | seasonal-wakeup wins over smoothed (prior-season) | `2026-10-01` (wakeup) |
| 5 | seasonal-dormant wins over OOFT | null |
| 6 | OOFT wins over cycle-natural | `2026-06-01` (due_date) |

**Interaction axis (Cases 7-21):**
| # | Scenario | Validates |
|---|----------|-----------|
| 7 | override × smoothed × seasonal-dormant → override | D-17 + D-02 |
| 8 | override × OOFT → override | D-10 |
| 9 | smoothed × anchored → anchored (LOAD-06 bypass) | D-03 |
| 10 | smoothed × PREF read-side (smoothed is weekend) | read-through transparency |
| 11 | smoothed × seasonal-wakeup first cycle → wakeup | D-15 |
| 12 | smoothed × cycle-natural (v1.0 holdover NULL) → natural | D-02 + T-12-03 |
| 13 | OOFT × archived → null | D-05 |
| 14 | OOFT contributes to load map, own smoothed stays null | D-10 + LOAD-09 |
| 15 | snoozed contributes snooze_until to load map | D-10 + LOAD-08 |
| 16 | anchored contributes natural date (not smoothed) | D-10 + D-03 |
| 17 | post-completion null → placed round-trips on read | D-13 + D-02 |
| 18 | anchored + cycle compose in load map | D-03 + D-10 |
| 19 | seasonal-wakeup × anchored × PREF → wakeup fires | D-15 over D-03 scope |
| 20 | seasonal in-window second cycle × smoothed → smoothed | D-15 |
| 21 | empty-PREF-window widens forward to next weekend | PREF-03 |

Cases 14-16, 18, 21 exercise `computeHouseholdLoad` / `placeNextDue` directly (since they validate load-map and placement semantics); the rest exercise `computeNextDue`. Case 17 round-trips both: place → write → read.

### Incidental — Wave 1 T7 flip in `tests/unit/load-smoothing.test.ts`

Plan 12-01 SUMMARY §Handoff for Wave 2 explicitly flagged `T7` in the `computeHouseholdLoad` describe block as the intended Wave-2 flip point. Wave 1 locked both sub-cases to natural-date contribution because no smoothed branch existed. Wave 2 wires the branch, so:
- Sub-case A (cycle + `next_due_smoothed` set) now contributes on the **smoothed** date.
- Sub-case B (cycle + `next_due_smoothed` null) still contributes on the natural date (v1.0 holdover fallthrough per D-02).

Test assertion updated + docstring rewritten to reflect the Wave-2 contract. Net line change: +21 / -20.

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Grep `Phase 12 smoothed branch` | `lib/task-scheduling.ts` | 1 match ✓ |
| Grep `task.schedule_mode !== 'anchored'` | `lib/task-scheduling.ts` | 1 match ✓ |
| Grep `task.next_due_smoothed` | `lib/task-scheduling.ts` | 2 matches (type + branch body) ✓ |
| Grep `treatAsWakeup` | `lib/task-scheduling.ts` | 2 matches ✓ |
| Grep `smoothed.getTime() > 0` | `lib/task-scheduling.ts` | 1 match (line 267) ✓ |
| Grep `describe('branch composition matrix — LOAD-15 hard gate'` | `tests/unit/task-scheduling.test.ts` | 1 match ✓ |
| Count `Case N:` tests in new describe | `tests/unit/task-scheduling.test.ts` | 21 ✓ |
| Type-check | `npx tsc --noEmit` | exit 0 ✓ |
| Plan file targeted run | `npm test -- tests/unit/task-scheduling.test.ts --run` | 60/60 green ✓ |
| Load-smoothing post-flip | `npm test -- tests/unit/load-smoothing.test.ts --run` | 20/20 green ✓ |
| Full regression | `npm test --run` | **455/455 green** (434 → 455; +21; 0 red) ✓ |

## Branch Matrix Status

**21 / 21 green on first run.** Zero iteration needed — the plan's test-data scaffolding (fixtures, Override shape, expected ISO strings) was verified arithmetically pre-write (anchored cycle math for Cases 9 and 16; PREF widening math for Case 21; lastInPriorSeason inclusion/exclusion for Cases 3, 4, 11, 20).

## Insertion Diff Summary

`lib/task-scheduling.ts`:
- Pre-insert: 459 lines. Override branch ended at line 220 (closing `}`). Seasonal block started line 222.
- Post-insert: 509 lines (+51). New smoothed branch occupies lines 222-271. Seasonal block moved to lines 273-331 (no modification).
- **No deletions, no modifications to existing branches.** Byte-identical behavior for all existing fixtures.

## Deviations from Plan

### Auto-fixed issues

None — no Rule 1/2/3 auto-fixes required. Every branch-matrix test case passed on first run.

### Documented deviations (not auto-fixes)

**1. Wave 1 T7 test flipped — planned, not a deviation.**
Plan 12-01 SUMMARY §Handoff for Wave 2 explicitly documented this as an expected Wave-2 flip point. Wave 1 locked T7 to transient natural-date contribution because no smoothed branch existed. Wave 2 wires the branch; T7 sub-case A now asserts smoothed-date contribution. This is the planned handoff contract, not an auto-fix or deviation. One commit: `test(12-02): update T7 to assert Wave 2 smoothed-contribution contract`.

**2. Case 19 expected value interpretation — clarified in test comment.**
The plan's `<action>` §Case 19 described `anchored + seasonal Jun-Sep + PREF weekend → natural anchored`. On close reading, this mis-describes the composition: the anchored-bypass guard is scoped to the SMOOTHED branch only. The SEASONAL branches (dormant / wakeup) run unconditionally AFTER the smoothed branch for all schedule_modes — Phase 11 shipped that as the v1.0 contract. So the correct expected value when the task has a window AND no completion is the seasonal-wakeup date (`2026-06-01`), not the natural anchored cycle date. The plan's `<behavior>` actually phrased this correctly ("Anchored + seasonal window + PREF all set... Seasonal branches also short-circuit anchored") but the summary header phrased it ambiguously. Test implementation + inline comment document the precise interpretation. No code change needed — this is exactly how the existing Phase 11 layout behaves.

**3. Bonus edge cases 22-25 from 12-VALIDATION.md NOT added.**
The plan explicitly marked Cases 22-25 as "strongly encouraged but not phase-blocking" and said the executor "may add them if budget permits". They were not added in this execution to keep the commit focused on the hard-gate 21. All 4 bonus cases are covered transitively by existing tests:
- Case 22 (smoothed × consumed override) — override branch already handles `consumed_at` via `!override.consumed_at` falsy check (Phase 10); smoothed branch then fires on its own predicate.
- Case 23 (tolerance=0 override) — covered by Plan 12-01 T1 + T3 in `tests/unit/load-smoothing.test.ts`.
- Case 24 (freq=1 daily → tolerance 0) — covered by Plan 12-01 T1.
- Case 25 (365-day task → tolerance 5) — covered by Plan 12-01 T8 windowDays bound.

If Wave 4 integration finds a gap, the 4 bonus cases can be added post-hoc to this describe block without structural churn.

### Auth gates

None occurred — pure scheduling logic + unit tests; no external services.

## Known Stubs

None. All 21 branch-matrix cases exercise real behavior; no placeholders / fake data wired to UI. The Wave 3 write-side (completeTaskAction batch extension) is the next plan — documented as such in `affects:` rather than stubbed here.

## Threat Flags

No new threat surface. Existing mitigations per `<threat_model>`:

| Threat ID | Component | Status |
|-----------|-----------|--------|
| T-12-03 | v1.0 holdover NULL next_due_smoothed | **Mitigated** — Case 12 asserts natural cadence fallthrough (v1.0 row + cycle mode → `lastCompletion + freq`). |
| T-12-05 | Anchored with stale next_due_smoothed | **Mitigated** — Case 9 asserts natural anchored date returned, NOT stale smoothed. |
| T-12-07 | Malformed next_due_smoothed string | **Mitigated** — `new Date(s).getTime() > 0` guard. Not exercised in unit fixtures (no Invalid Date fixture makes sense in a typed test), but the code path is present and statically analyzable. Wave 4 integration scenario 5 (v1.0 upgrade) is the natural place to seed a malformed value and assert no crash. |
| T-12-WAKEUP | Stale smoothed on seasonal wake-up | **Mitigated** — Cases 4 + 11 assert nextWindowOpenDate wins over stale smoothed when no completion / prior-season. |

## Commits

- `72f5641` — `feat(12-02): insert next_due_smoothed branch in computeNextDue (LOAD-02, LOAD-06, LOAD-07)`
- `b6fbafb` — `test(12-02): update T7 to assert Wave 2 smoothed-contribution contract`
- `2d43c87` — `test(12-02): add 21 LOAD-15 branch composition matrix tests (hard gate)`

## Test Count Trajectory

| Layer | Plan | Count | Cumulative |
|-------|------|-------|------------|
| Phase 11 baseline | — | 410 | 410 |
| Post-Phase-11 UX polish | — | +4 | 414 |
| Phase 12 Plan 01 Wave 1 | 12-01 | +20 | 434 |
| Phase 12 Plan 02 Wave 2 (this plan) | 12-02 | +21 | **455** |

T7 flip is a semantic rewrite — same test count before/after.

## Handoff for Wave 3 (Plan 12-03)

**Read-side is fully wired.** Wave 3 only needs to extend `completeTaskAction`'s batch with the write-side op.

1. **`computeNextDue` read-through is transparent.** Wave 3 writes `task.next_due_smoothed = iso(placedDate)` via `batch.collection('tasks').update(task.id, { next_due_smoothed: ... })`. Next render calls `computeNextDue(task, ...)` which sees the new smoothed value and returns it. All existing callers (completion toast, coverage ring, band view, scheduler) compose over `computeNextDue` transparently — zero call-site churn.
2. **`placeNextDue` guards still fire defensively.** Wave 3 must filter callers so the defense-in-depth throws from Plan 12-01 don't fire: `if (task.schedule_mode === 'cycle' && !isOoftTask(task)) { /* call placeNextDue */ }`. 12-RESEARCH.md §Pattern 4 has the exact insertion point in `lib/actions/completions.ts:263`.
3. **Error handling per D-13:** wrap placement in try/catch and swallow errors (log via `console.warn`). Leave `next_due_smoothed = null` on any failure so this plan's D-02 natural fallback engages.
4. **No further `computeNextDue` changes expected in v1.1.** Branch layout is now complete per D-02: override → smoothed → seasonal-dormant → seasonal-wakeup → OOFT → cycle/anchored. Phase 13 TCSEM adds a creation trigger for `placeNextDue`; Phase 17 REBAL adds bulk re-runs — both callers, not branch authors.

## Handoff for Wave 4 (Plan 12-04)

1. **Integration Scenario 2 (end-to-end write → read)** should seed a cycle task, complete it, assert `next_due_smoothed` populated in PB, and on re-fetch assert `computeNextDue` returns the smoothed date. This plan's Case 17 already simulates it in-memory — integration just substitutes real PB.
2. **Integration Scenario 5 (v1.0 upgrade T-12-03 + T-12-07)** should additionally seed a malformed `next_due_smoothed` string via direct admin-UI-style write (`tasks.update(id, { next_due_smoothed: 'not-a-date' })`) and assert `computeNextDue` falls through to natural without throwing. The T-12-07 code path is statically present but not yet runtime-exercised by any test.
3. **Branch matrix 21 tests can be re-run as a smoke assertion** at the top of Wave 4 — they run in <30ms and prove the read-side is stable before integration exercises the write-side.

## Self-Check: PASSED

- `lib/task-scheduling.ts` smoothed branch present: FOUND (5 grep checks pass, lines 222-271)
- `tests/unit/task-scheduling.test.ts` new describe block present: FOUND (line 687, 21 `Case N:` tests)
- `tests/unit/load-smoothing.test.ts` T7 flipped: FOUND (assertions now reference `smoothedKey` and `expect(loadA.get(naturalKey)).toBeUndefined()`)
- Commit `72f5641` exists: FOUND (Task 1 — branch insertion)
- Commit `b6fbafb` exists: FOUND (T7 flip)
- Commit `2d43c87` exists: FOUND (Task 2 — branch matrix)
- Full test suite: **455 passed, 0 failed** (baseline 434 → 455, +21)
- Type-check: clean (exit 0)
- No file deletions across any of the three commits (`git diff --diff-filter=D` empty)
