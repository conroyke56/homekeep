# Phase 12: Load-Smoothing Engine — Validation Architecture

**Extracted from:** `12-RESEARCH.md` §Validation Architecture (Nyquist Dimension 8)
**Distributed across plans:** 12-01, 12-02, 12-03, 12-04

This document is the single consolidated view of WHERE each of the 15 LOAD-xx requirements is behaviorally asserted, by which test, in which plan. Verifier (`/gsd-verify-work`) reads this to confirm every REQ has at least one green automated test before phase close.

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (Phase 1) |
| Quick run (target) | `npm test -- tests/unit/load-smoothing.test.ts tests/unit/task-scheduling.test.ts --run` |
| Full suite | `npm test --run` |
| Baseline test count (end of Phase 11) | 410 |
| Phase 12 expected final count | ~450 (+~40 new) |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Plan | File | Command |
|--------|----------|-----------|------|------|---------|
| LOAD-01 | Migration adds `next_due_smoothed DATE NULL` | integration | 12-04 | `tests/unit/load-smoothing-integration.test.ts` (Scenario 1) | `npm test -- tests/unit/load-smoothing-integration.test.ts --run` |
| LOAD-02 | `computeNextDue` consults `next_due_smoothed` | unit | 12-02 | `tests/unit/task-scheduling.test.ts` (branch-matrix cases 3, 12, 20) | `npm test -- tests/unit/task-scheduling.test.ts --run` |
| LOAD-03 | `placeNextDue` helper behavior | unit | 12-01 | `tests/unit/load-smoothing.test.ts` (10 placement cases) | `npm test -- tests/unit/load-smoothing.test.ts --run` |
| LOAD-04 | Tolerance formula `min(0.15*freq, 5)` | unit | 12-01 | `tests/unit/load-smoothing.test.ts` (tolerance edge cases) | `npm test -- tests/unit/load-smoothing.test.ts --run` |
| LOAD-05 | PREF narrows BEFORE load scoring | unit | 12-01 | `tests/unit/load-smoothing.test.ts` (PREF-narrow + empty-widen) | `npm test -- tests/unit/load-smoothing.test.ts --run` |
| LOAD-06 | Anchored bypasses smoothing | unit | 12-02 | `tests/unit/task-scheduling.test.ts` (branch-matrix case 9) | `npm test -- tests/unit/task-scheduling.test.ts --run` |
| LOAD-07 | Seasonal wake-up anchors to window start | unit | 12-02 | `tests/unit/task-scheduling.test.ts` (branch-matrix cases 4, 11, 20) | `npm test -- tests/unit/task-scheduling.test.ts --run` |
| LOAD-08 | Snoozed contributes to load map | unit | 12-01 | `tests/unit/load-smoothing.test.ts` (snoozed contribution case) | `npm test -- tests/unit/load-smoothing.test.ts --run` |
| LOAD-09 | OOFT contributes, own smoothed never set | unit | 12-01 + 12-02 | `tests/unit/load-smoothing.test.ts` + branch-matrix case 14 | `npm test -- tests/unit/task-scheduling.test.ts tests/unit/load-smoothing.test.ts --run` |
| LOAD-10 | Smoother runs on completion | integration | 12-04 | `tests/unit/load-smoothing-integration.test.ts` (Scenario 2) | `npm test -- tests/unit/load-smoothing-integration.test.ts --run` |
| LOAD-11 | Forward-only — no sibling mutation | unit | 12-01 | `tests/unit/load-smoothing.test.ts` (forward-only contract) | `npm test -- tests/unit/load-smoothing.test.ts --run` |
| LOAD-12 | Tiebreakers closest-to-ideal → earliest | unit | 12-01 | `tests/unit/load-smoothing.test.ts` (tiebreaker chain) | `npm test -- tests/unit/load-smoothing.test.ts --run` |
| LOAD-13 | <100ms for 100 tasks | perf | 12-04 | `tests/unit/load-smoothing-perf.test.ts` | `npm test -- tests/unit/load-smoothing-perf.test.ts --run` |
| LOAD-14 | `computeHouseholdLoad` signature + contributions | unit | 12-01 | `tests/unit/load-smoothing.test.ts` (8 household-load cases) | `npm test -- tests/unit/load-smoothing.test.ts --run` |
| LOAD-15 | Branch composition matrix HARD GATE | unit | 12-02 | `tests/unit/task-scheduling.test.ts` (21+ matrix cases) | `npm test -- tests/unit/task-scheduling.test.ts --run` |

## Branch Composition Matrix (LOAD-15 hard gate — Plan 12-02)

**Test location:** `tests/unit/task-scheduling.test.ts`, new `describe('branch composition matrix — LOAD-15 hard gate')` block.

**21 mandatory cases (phase-blocking):**

### Branch precedence axis (6 tests)

| # | Test Name | Fixture | Expected | REQ/D |
|---|-----------|---------|----------|-------|
| 1 | archived wins over every other state | `archived: true` + all branch states set | `null` | existing |
| 2 | override wins over smoothed | active unconsumed override + `next_due_smoothed` set | `override.snooze_until` | D-02 |
| 3 | smoothed wins over seasonal-dormant (same-season) | `next_due_smoothed` set + in-window now + in-window completion | `next_due_smoothed` | D-02 |
| 4 | seasonal-wakeup wins over smoothed (prior-season) | `next_due_smoothed` set + no completion + has window | `nextWindowOpenDate(...)` | D-15 |
| 5 | seasonal-dormant wins over OOFT | `frequency_days=null` + out-of-window + in-season completion | `null` (dormant) | D-10 |
| 6 | OOFT wins over cycle-natural | `frequency_days=null` + `due_date` set + no completion | `due_date` | D-05 |

### Interaction axis (15 tests)

| # | Test Name | Fixture | Expected | REQ/D |
|---|-----------|---------|----------|-------|
| 7 | override × smoothed × seasonal-dormant | active override + smoothed + out-of-window + in-season completion | `override.snooze_until` | D-17 + D-02 |
| 8 | override × OOFT | active override + `freq=null` + `due_date` | `override.snooze_until` | D-10 |
| 9 | smoothed × anchored (LOAD-06 bypass) | `schedule_mode='anchored'` + `next_due_smoothed` set (stale) + `anchor_date` in past | natural anchored date — smoothed ignored | D-03 |
| 10 | smoothed × PREF respect (read-side) | smoothed written by placement honors `preferred_days='weekend'` | date falls on Sat/Sun | D-06 |
| 11 | smoothed × seasonal-wakeup first cycle | no completion + has window + stale `next_due_smoothed` | `nextWindowOpenDate(...)` | D-15 |
| 12 | smoothed × cycle-natural (v1.0 holdover NULL) | `next_due_smoothed=null` + cycle mode + completion | `lastCompletion + freq` | D-02 + T-12-03 |
| 13 | OOFT × archived (post-completion) | `freq=null` + completion exists | `null` | D-05 |
| 14 | OOFT contributes to load map, own smoothed stays null | `computeHouseholdLoad` includes OOFT's `due_date`; `placeNextDue` never called | Map has entry on `due_date`; `task.next_due_smoothed` remains null | D-10 + LOAD-09 |
| 15 | snoozed task contributes `snooze_until` to load map | `computeHouseholdLoad` input includes snoozed task | `Map.get(iso(snooze_until)) === 1` | D-10 + LOAD-08 |
| 16 | anchored contributes natural date (not smoothed) | anchored w/ stale smoothed; `computeHouseholdLoad` skips smoothed | `Map.get(iso(anchored_next)) === 1`; `Map.get(iso(smoothed)) === 0` | D-10 + D-03 |
| 17 | post-completion: NULL smoothed before → non-null after | simulate batch; assert pre-state null, post-state `iso(placedDate)` | `tasks.update({next_due_smoothed})` op present in batch | D-13 |
| 18 | anchored bypass + still contributes | complete anchored; batch contains NO smoothed update; sibling Map reflects natural date | no update op; Map has date | D-03 + D-10 |
| 19 | seasonal-wakeup × anchored × PREF | anchored + has window + `preferred_days='weekend'` | natural anchored (no smoothing, no PREF — byte-identical v1.0) | D-03 |
| 20 | seasonal in-window past wake-up × smoothed | has window + `lastInPriorSeason=false` + in-window now + `next_due_smoothed` set | `next_due_smoothed` | D-15 |
| 21 | empty-PREF-window widen forward | `preferred_days='weekend'` + tolerance contains only Tue-Thu | result is next Sat or Sun (widen +1..+6) | D-06 step 5 + PREF-03 |

### Bonus edge cases (encouraged, not phase-blocking)

- 22: smoothed × override consumed (`consumed_at` set) → falls through to smoothed
- 23: `tolerance=0` override via options param passthrough
- 24: cycle task freq=1 (daily) → `floor(0.15)=0` tolerance → single candidate → deterministic
- 25: 365-day task → tolerance `min(54.75, 5) = 5` → 11 candidates

**Hard-gate acceptance (LOAD-15):** All 21 mandatory cases green. Cases 22-25 strongly encouraged.

## Rider 1 Tolerance Validation Harness (Plan 12-04)

**Trigger:** Phase close, BEFORE `/gsd-verify-work`.

**Test location:** `tests/unit/load-smoothing-integration.test.ts` Scenario 4 on port 18100.

### 30-task seed composition (per D-17)

| Frequency (days) | Count | Tolerance | Candidates |
|------------------|-------|-----------|------------|
| 1 | 5 | `min(floor(0.15), 5) = 0` | 1 (no smoothing available) |
| 7 | 5 | `min(floor(1.05), 5) = 1` | 3 |
| 14 | 5 | `min(floor(2.1), 5) = 2` | 5 |
| 30 | 5 | `min(floor(4.5), 5) = 4` | 9 |
| 90 | 5 | `min(floor(13.5), 5) = 5` | 11 |
| 365 | 5 | `min(floor(54.75), 5) = 5` | 11 |

All cycle mode, `preferred_days='any'`, no seasonal window, no overrides.

### Cluster-count decision rule

A "cluster" = ISO date with ≥3 tasks assigned. Count clusters in the final load Map.

- **Green (clusters ≤ 7):** Ship `min(0.15 * freq, 5)` default. Document in `12-SUMMARY.md`: "Rider 1 validation: green, N clusters".
- **Red (clusters > 7):** Executor widens the default cap to 14 and updates:
  - `lib/load-smoothing.ts` default computation + JSDoc
  - `.planning/REQUIREMENTS.md` LOAD-04 text ("5" → "14")
  - `.planning/phases/12-load-smoothing-engine/12-CONTEXT.md` D-05 text
  - Re-run the validation harness to confirm cluster count drops
  - Document in `12-SUMMARY.md`: "Rider 1 validation: widened to 14, N → M clusters"

### Deterministic fixture

- Fixed `now = new Date('2026-05-01T00:00:00.000Z')`
- Deterministic `task.created` offsets (all created at `now - 1 hour`, staggered by 1 minute)
- No completions for initial placement (first-cycle smoothing)
- Sequential `placeNextDue` calls, updating in-memory load Map between placements (previews Phase 13 TCSEM pattern)

## Perf Benchmark Harness (Plan 12-04)

**Test location:** `tests/unit/load-smoothing-perf.test.ts` on port (none — pure in-memory).

**Budget (LOAD-13):** <100ms for 100-task household, single `placeNextDue` + `computeHouseholdLoad` call.

**Seed composition:** 100 tasks with mixed frequencies (scaled 30-task distribution ~3.3×):
- 15 × freq=1
- 17 × freq=7
- 17 × freq=14
- 17 × freq=30
- 17 × freq=90
- 17 × freq=365

All cycle mode, no PREF, no seasonal window. Half pre-completed (freq/2 ago), half fresh-new.

**Harness:**
```typescript
const start = performance.now();
const load = computeHouseholdLoad(tasks, latestByTask, new Map(), now, 120, 'UTC');
const placed = placeNextDue(target, latestByTask.get(target.id) ?? null, load, now, { timezone: 'UTC' });
const elapsed = performance.now() - start;
expect(elapsed).toBeLessThan(100);
```

**Why `performance.now()`:** Sub-ms resolution, cross-runtime (node + browser for future Phase 16 LVIZ).

**Flakiness protection:** Expected observed range ~3-5ms on CI; 100ms is 20-33× headroom.

## Integration Scenarios (Plan 12-04)

**Test location:** `tests/unit/load-smoothing-integration.test.ts` on port **18100**.

Boot pattern copied verbatim from Phase 11's `tests/unit/task-extensions-integration.test.ts`:
- Superuser CLI create BEFORE `serve` (Pitfall 9 WAL race)
- `--migrationsDir=./pocketbase/pb_migrations` picks up `1745280002_next_due_smoothed.js`
- `--hooksDir=./pocketbase/pb_hooks` picks up Whole Home hook + bootstrap_batch
- Poll `/api/health` 30× at 200ms intervals (max 6s)
- `vi.mock` plumbing: `next/cache` + `@/lib/pocketbase-server` + `@/lib/pocketbase-admin`

| # | Scenario | REQs | D-# |
|---|----------|------|-----|
| 1 | Migration shape: `next_due_smoothed` DateField present, required:false, accepts null + ISO write | LOAD-01 | D-01, D-19 |
| 2 | Completion flow E2E: cycle task complete → batch writes smoothed atomically; subsequent getOne shows date | LOAD-10 | D-13 |
| 3 | 100-task in-memory perf benchmark (no PB needed — pure in-memory test in same file) | LOAD-13 | D-12 |
| 4 | 30-task Rider 1 tolerance validation — cluster count ≤ 7 OR widen to 14 | LOAD-04 + rider 1 | D-17 |
| 5 | v1.0 upgrade: cycle task w/ null smoothed completes → smoothed written; second completion reads smoothed | LOAD-02 + T-12-03 | D-02 |

**Boot budget (from 11-03 exemplar):** ~850ms beforeAll + ~100-150ms per scenario = 5 scenarios in ~2.5s.

## Port Allocation

| Port | Claimant | Status |
|------|----------|--------|
| 18090..18097 | Phases 2-6 | claimed |
| 18098 | 10-01 schedule_overrides | claimed |
| 18099 | 11-03 task-extensions | claimed |
| **18100** | **12-04 load-smoothing (this phase)** | **CLAIMED** |
| 18101 | — | next free (Phase 13+) |

## Sampling Rate

- **Per task commit:** target test files (`npm test -- tests/unit/load-smoothing.test.ts tests/unit/task-scheduling.test.ts --run`) — <5s typical
- **Per wave merge:** full suite (`npm test --run`) — ~30s
- **Phase gate:** Full suite green + LOAD-15 branch matrix green (21/21) + LOAD-13 perf budget green + rider 1 explicit decision committed before `/gsd-verify-work`

## Verification Gate

LOAD-15 is the phase's explicit hard gate per ROADMAP §Phase 12 + CONTEXT §domain. The verifier cannot pass the phase until all 21 mandatory branch-matrix cases are green. Plan 12-02 owns this gate.
