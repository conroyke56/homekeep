---
phase: 17-manual-rebalance
plan: 01
subsystem: manual-rebalance
tags:
  - rebal
  - server-actions
  - load-smoothing
  - classification
  - wave-1
  - tdd

# Dependency graph
requires:
  - phase: 12-load-smoothing-engine
    plan: 04
    provides: "placeNextDue + computeHouseholdLoad + isoDateKey + computeFirstIdealDate pure helpers with load-map threading pattern"
  - phase: 13-task-creation-semantics
    plan: 01
    provides: "batchCreateSeedTasks TCSEM load-map threading exemplar (lib/actions/seed.ts:171-223) — the exact pattern Apply replicates"
  - phase: 15-one-off-reschedule-ui
    plan: 01
    provides: "tasks.reschedule_marker DateField + Task type extension + action shape (discriminated union, sanitized formError)"
  - phase: 10-schedule-overrides
    plan: 01
    provides: "getActiveOverridesForHome batch fetch + Override type"
  - phase: 04-ownership-membership
    plan: 02
    provides: "assertMembership gate"

provides:
  - "classifyTasksForRebalance(tasks, overridesByTask, latestByTask, now, tz): RebalanceBuckets — pure 4-bucket classifier with D-01 priority order + D-02 exclusions"
  - "rebalancePreviewAction(homeId): read-only preservation counts + rebalanceable count"
  - "rebalanceApplyAction(homeId): fresh computeHouseholdLoad + ascending-ideal sort + threaded placeNextDue + atomic batch with N next_due_smoothed writes + M marker-clear ops"
  - "RebalanceBuckets, RebalancePreview, RebalancePreviewResult, RebalanceResult TypeScript types exported for Wave 2 UI"

affects:
  - "Phase 17 Wave 2 (17-02): imports both actions + RebalancePreview type directly; Settings → Scheduling → Rebalance button + Dialog renders preview counts and triggers apply"
  - "Phase 17 phase close: Wave 2 is the only remaining deliverable after this plan"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Apply pattern mirrors Phase 13 TCSEM byte-for-byte: fetch-once compute-once, sequential placement loop mutates load map in-place between placements, single atomic batch at the end. Same isoDateKey(placedDate, homeTz) on Map.set and placeNextDue's scoring lookup (Pitfall 7 tz alignment)."
    - "Shared preamble helper (fetchAndClassify) between preview and apply — eliminates drift risk if the projection, overrides fetch, or classifier args ever change. Typed error union mapped at each action's return site so error messages stay action-specific."
    - "Dormancy gate inside classifier scoped ONLY to rebalanceable candidates (not anchored/override/marker) — user intent wins over inferred dormancy regardless of bucket. Synthesized natural-only view (next_due_smoothed=null, reschedule_marker=null) so computeNextDue's seasonal branches report dormancy objectively."
    - "Idempotency via determinism of placeNextDue: same baseIso + freq + same load map → same placedDate. Apply writes the placement value but PB's update-to-identical is a no-op on the value — D-12 holds."
    - "Deterministic mock placeNextDue for action unit tests (A1, A3-A8); REAL placeNextDue via vi.importActual for the one threading-proof test (A2). Split describe blocks keep the mock-vs-real cost localized."

key-files:
  created:
    - "lib/rebalance.ts (148 lines) — classifyTasksForRebalance + RebalanceBuckets type export"
    - "lib/actions/rebalance.ts (405 lines) — rebalancePreviewAction + rebalanceApplyAction + shared preamble + result types"
    - "tests/unit/rebalance.test.ts (401 lines) — 12 classifier unit tests"
    - "tests/unit/actions/rebalance-actions.test.ts (661 lines) — 13 action unit tests (5 preview + 8 apply)"
  modified: []

key-decisions:
  - "Shared fetchAndClassify preamble (not inlined per action). Both preview and apply need the same: auth gate → membership gate → home tz fetch → tasks.getFullList → completions → overrides → classifier. Inlining would duplicate ~60 lines per action and risk drift. The shared helper returns a discriminated-union Result so each action maps errors with its own action-specific formError string ('Could not build rebalance preview' vs 'Could not apply rebalance')."
  - "PB client instantiated TWICE inside apply: once inside fetchAndClassify (for reads), once after to get .createBatch() (for the write batch). Acceptable cost — createServerClient is cached within a Next.js request via the cookies() call path, so the second call returns the same underlying pb instance. Alternative (return pb from preamble) would leak an internal type through the public shape."
  - "Marker clear uses null (not ''). Phase 15 D-08 convention: markerIso is an ISO string or null. PB 0.37.1 DateField accepts either for clear, but Phase 15 chose null throughout lib/actions/reschedule.ts and we preserve that convention here."
  - "Batch skip when empty. If update_count is 0 AND from_now_on bucket is empty, the apply skips batch.send() entirely. Avoids a no-op PB roundtrip on an empty/all-preserved home. The revalidatePath calls still fire (idempotent, cheap) so cache behavior is consistent."
  - "Apply's placeNextDue receives the ORIGINAL task (with its existing next_due_smoothed). placeNextDue ignores next_due_smoothed internally — it recomputes naturalIdeal from lastCompletion?.completed_at ?? task.created. We do NOT synthesize a naturalView the way the classifier does for dormancy detection; placeNextDue has its own seasonal guards and the classifier already excluded dormant-seasonal tasks from rebalanceable."
  - "Deterministic mock placeNextDue in action tests echoes baseIso + freq (no load-map distribution). A1 ordering + A7 idempotency require stable ISOs the test can predict. A2 threading-proof uses REAL placeNextDue via vi.importActual to exercise the actual tolerance-window distribution — without threading, 5 same-freq tasks would collapse to ≤2 date keys; with threading they distribute to ≥4."

patterns-established:
  - "Pattern: fetch-and-classify preamble. When two server actions share a read-heavy preamble (auth, membership, projection, classifier), extract into a typed-union helper returning { ok: true, data } | { ok: false, error }. Each action maps the error union to its own action-specific formError. Eliminates drift and keeps the shape symmetric."
  - "Pattern: dormancy gate inside classifier scoped to rebalanceable candidates only. User intent (anchored / override / marker) ALWAYS wins over inferred dormancy. Only the catch-all rebalanceable bucket gates on computeNextDue-reports-null. Prevents the dormant-gate from accidentally dropping preserved tasks."
  - "Pattern: batch-skip on empty state. When a batch has zero ops, skip batch.send() entirely. PB treats zero-op batches as an error in some versions; skipping is portable and avoids an unnecessary roundtrip."
  - "Pattern: ascending natural-ideal sort before sequential placement. REBAL-07 TCSEM parity — earliest-ideal task bids first, later tasks see the earlier placements via the mutated load map, and the cohort distributes forward. Matches Phase 13's onboarding-cohort pattern exactly."

requirements-completed:
  - REBAL-01
  - REBAL-02
  - REBAL-03
  - REBAL-04
  - REBAL-07

# Metrics
duration: ~20min
completed: 2026-04-23
tasks: 2
files_created: 4
files_modified: 0
tests_added: 25
tests_total: 585 (560 baseline + 25)
---

# Phase 17 Plan 17-01: Manual Rebalance Wave 1 — Server (classify + actions) Summary

Wave 1 ships the SERVER half of Phase 17 Manual Rebalance: the pure classifier (`classifyTasksForRebalance`), the dry-run preview action (`rebalancePreviewAction`), and the apply action (`rebalanceApplyAction`). No UI surface in this plan — Wave 2 (17-02) imports these exports directly into the Settings → Scheduling Dialog.

**Core invariants shipped:**
- **Preservation (REBAL-01/02/03):** anchored tasks, tasks with active unconsumed schedule_overrides, and tasks with a truthy reschedule_marker are NEVER rewritten.
- **Rebalance (REBAL-04):** all other cycle tasks run through placeNextDue with a fresh computeHouseholdLoad map.
- **Load-map threading (REBAL-07):** in-memory load Map mutated between placements so later placements see earlier placements' effects (TCSEM parity).
- **Atomic single batch (D-05):** N next_due_smoothed writes + M reschedule_marker clears ship in ONE pb.createBatch().send().
- **Marker clear (D-06 revision):** the from_now_on bucket's tasks get reschedule_marker: null in the same batch — marker has served its purpose this run; next rebalance treats them normally.
- **Idempotency (D-12):** second apply produces bit-identical next_due_smoothed ISO per task.

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-23T01:14:03Z
- **Completed:** 2026-04-23T01:33:32Z
- **Tasks:** 2 / 2 (both TDD — RED → GREEN)
- **Files created:** 4 (lib/rebalance.ts, lib/actions/rebalance.ts, tests/unit/rebalance.test.ts, tests/unit/actions/rebalance-actions.test.ts)
- **Files modified:** 0
- **Test delta:** +25 exact (560 baseline → 585 final). Matches plan's 12 classifier + 13 action = 25 tests.

## What Was Built

### Task 1 — `classifyTasksForRebalance` pure helper + 12 unit tests (REBAL-01..04 classification)

**RED** (commit `9c5993c`): 12 failing tests in new file `tests/unit/rebalance.test.ts`. Tests cover priority order (D-01 — anchored > override > marker > rebalanceable), exclusions (D-02 — archived, OOFT null/0, dormant-seasonal), falsy-marker variants (null, undefined, ''), stable iteration order for ascending-sort downstream, and empty/edge inputs.

**GREEN** (commit `5a01db6`): `lib/rebalance.ts` — 148 lines including JSDoc. Exports:

```typescript
export type RebalanceBuckets = {
  anchored: Task[];
  active_snooze: Task[];
  from_now_on: Task[];
  rebalanceable: Task[];
};

export function classifyTasksForRebalance(
  tasks: Task[],
  overridesByTask: Map<string, Override>,
  latestByTask: Map<string, CompletionRecord>,
  now: Date,
  timezone: string = 'UTC',
): RebalanceBuckets;
```

Implementation is an 18-line loop with explicit D-01 priority short-circuits + a dormancy gate scoped to the rebalanceable candidate set only (user intent wins over inferred dormancy). Dormancy detection synthesizes a natural-only Task view (`next_due_smoothed: null, reschedule_marker: null`) and delegates to `computeNextDue`; null return → dormant → drop.

### Task 2 — `rebalancePreviewAction` + `rebalanceApplyAction` + 13 unit tests (REBAL-04, REBAL-07)

**RED** (commit `a7da8ad`): 13 failing tests in new file `tests/unit/actions/rebalance-actions.test.ts`. Mock layout mirrors `seed-tcsem.test.ts` (module-level `batchOps` array + `mockBatch` stub) and `reschedule-actions.test.ts` (controllable `authValid` + `mockAssertMembership`). Two describe blocks: one with deterministic mock `placeNextDue` (all preview tests + 7 apply tests) and one with REAL `placeNextDue` via `vi.importActual` (A2 threading proof).

**GREEN** (commit `69637a4`): `lib/actions/rebalance.ts` — 405 lines. Exports:

```typescript
export type RebalancePreview = {
  update_count: number;
  preserve_anchored: number;
  preserve_override: number;
  preserve_from_now_on: number;
  preserve_total: number;
};

export type RebalancePreviewResult =
  | { ok: true; preview: RebalancePreview }
  | { ok: false; formError: string };

export type RebalanceResult =
  | { ok: true; updated: number }
  | { ok: false; formError: string };

export async function rebalancePreviewAction(
  homeId: string,
): Promise<RebalancePreviewResult>;

export async function rebalanceApplyAction(
  homeId: string,
): Promise<RebalanceResult>;
```

**Shared preamble (`fetchAndClassify`)** handles: input validation → auth gate (`pb.authStore.isValid`) → membership gate (`assertMembership`) → home tz fetch → `tasks.getFullList` with the 14-field projection (including `reschedule_marker`) → completions (`getCompletionsForHome` + `reduceLatestByTask`) → overrides (`getActiveOverridesForHome`) → `classifyTasksForRebalance`. Returns a discriminated-union Result; each action maps the error kind to its own formError string.

**Preview action** (read-only): returns `{ok: true, preview: {counts}}`. No revalidatePath, no PB write.

**Apply action** (heart of the plan):
1. Fetch + classify (shared).
2. Fresh `computeHouseholdLoad` map built ONCE — includes contributions from ALL current tasks (anchored, override, marker, OOFT, dormant-aware, pre-existing smoothed cycle).
3. Rank rebalanceable bucket ascending by naturalIdeal = (lastCompletion?.completed_at ?? task.created) + freq.
4. Sequential placement loop: `placeNextDue(task, lastCompletion, load, now, {preferredDays, timezone})` → mutate `householdLoad.set(isoDateKey(placedDate, homeTz), prev+1)` → record placedDate ISO.
5. Per-task `console.warn` on placement error (D-06 best-effort); skipped task keeps existing smoothed.
6. Single atomic `pb.createBatch()`:
   - N × `tasks.update(taskId, { next_due_smoothed: iso })` (rebalanceable)
   - M × `tasks.update(markerTaskId, { reschedule_marker: null })` (from_now_on — D-06 revision)
7. `batch.send()` (skipped entirely if N=0 AND M=0).
8. `revalidatePath` × 3 (same set as seed.ts — every view reads next_due_smoothed).

## Verification Results

```bash
# Classifier tests — 12/12
$ npm test -- tests/unit/rebalance.test.ts --run
 Test Files  1 passed (1)
      Tests  12 passed (12)
   Duration  1.25s

# Action tests — 13/13
$ npm test -- tests/unit/actions/rebalance-actions.test.ts --run
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  1.32s

# Full regression — 585/585 (560 baseline + 25 new)
$ npm test --run
 Test Files  69 passed (69)
      Tests  585 passed (585)
   Duration  96.19s

# Type-check clean
$ npx tsc --noEmit
 (exit 0, no output)
```

**Grep invariants:**

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "'use server'" lib/actions/rebalance.ts` | `=1` | `1` |
| `grep -n "a.naturalIdeal.getTime() - b.naturalIdeal.getTime()" lib/actions/rebalance.ts` | `=1` | `1` |
| `grep -rn "classifyTasksForRebalance" lib/ tests/unit/` matches | `≥3` | `18 matches across 3 files` |
| `grep -c "assertMembership" lib/actions/rebalance.ts` | `=2 code` | `3` (1 import + 1 call + 1 doc) |
| `grep -c "pb.createBatch" lib/actions/rebalance.ts` | `=1 code` | `3` (1 code + 2 docs — Phase 15 precedent) |
| `grep -c "reschedule_marker: null" lib/actions/rebalance.ts` | `=1 code` | `3` (1 code + 2 docs) |
| `grep -c "isoDateKey" lib/actions/rebalance.ts` | `=1 code` | `5` (1 import + 1 call + 3 docs) |
| `grep -c "placeNextDue" lib/actions/rebalance.ts` | `=1 code` | `7` (1 import + 1 call + 5 docs) |
| `grep -c "computeHouseholdLoad" lib/actions/rebalance.ts` | `=1 code` | `6` (1 import + 1 call + 4 docs) |

Per Phase 15 Plan 15-01 precedent (Summary §"Grep invariants"), doc-heavy JSDoc legitimately bumps naive grep counts above the plan's "code call" intent. The CODE invocations are exactly the specified count:
- `assertMembership`: 1 import + 1 call (inside `fetchAndClassify`) — the 3rd match is in doc.
- `pb.createBatch`: 1 code call (inside apply) — 2 doc refs.
- `reschedule_marker: null`: 1 code (batch op payload) — 2 doc refs (JSDoc explaining D-06).
- `isoDateKey`: 1 code call (inside the placement loop) — 1 import + 3 doc refs.
- `placeNextDue`: 1 code call (inside the placement loop) — 1 import + 5 doc refs.
- `computeHouseholdLoad`: 1 code call (before the placement loop) — 1 import + 4 doc refs.

## Deviations from Plan

None. Plan 17-01 executed exactly as written. No Rule 1/2/3 auto-fixes applied.

All 13 action tests + 12 classifier tests passed on their first GREEN run.

No CLAUDE.md file exists in the project root; no CLAUDE.md-driven adjustments.

## Commits

| Hash | Subject |
|------|---------|
| `9c5993c` | `test(17-01): add failing tests for classifyTasksForRebalance (RED)` |
| `5a01db6` | `feat(17-01): ship classifyTasksForRebalance helper (REBAL-01..04)` |
| `a7da8ad` | `test(17-01): add failing tests for rebalance server actions (RED)` |
| `69637a4` | `feat(17-01): rebalancePreviewAction + rebalanceApplyAction (REBAL-04, REBAL-07)` |

## TDD Gate Compliance

Both Tasks were marked `tdd="true"` — RED commit precedes GREEN commit for each:

| Task | RED commit | GREEN commit | Tests added |
|------|------------|--------------|-------------|
| 1 | `9c5993c` | `5a01db6` | 12 |
| 2 | `a7da8ad` | `69637a4` | 13 |

Each RED commit was run and verified failing before the corresponding GREEN commit. All 25 new tests passed on their first full GREEN run.

## Handoff to Wave 2 (17-02) — UI: Settings → Scheduling → Rebalance

**Direct imports Wave 2 can use:**

```typescript
import {
  rebalancePreviewAction,
  rebalanceApplyAction,
  type RebalancePreview,
  type RebalancePreviewResult,
  type RebalanceResult,
} from '@/lib/actions/rebalance';
```

**Preview Dialog binding (mirrors Phase 15 `snoozeTaskAction` pattern):**

```typescript
'use client';
import { useTransition, useState, useEffect } from 'react';
import { rebalancePreviewAction, rebalanceApplyAction } from '@/lib/actions/rebalance';

function RebalanceDialog({ homeId }: { homeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<RebalancePreview | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const r = await rebalancePreviewAction(homeId);
      if (r.ok) setPreview(r.preview);
      // else: show r.formError toast + close dialog
    });
  }, [homeId]);

  const onApply = () => {
    startTransition(async () => {
      const r = await rebalanceApplyAction(homeId);
      if (r.ok) {
        // toast("Rebalanced {r.updated} tasks")
        // router.refresh() for revalidatePath pickup
      } else {
        // toast(r.formError)
      }
    });
  };

  return (
    <Dialog>
      {preview && (
        <p>
          Will update: {preview.update_count}.
          Will preserve: {preview.preserve_total}
          ({preview.preserve_anchored} anchored,
           {preview.preserve_override} active snoozes,
           {preview.preserve_from_now_on} from-now-on).
        </p>
      )}
      <Button onClick={onApply} disabled={isPending}>Apply rebalance</Button>
    </Dialog>
  );
}
```

**Exact preview result shape the Dialog renders:**

```typescript
{
  update_count: 18,           // rebalanceable bucket length
  preserve_anchored: 3,       // REBAL-01 — schedule_mode='anchored' count
  preserve_override: 2,       // REBAL-02 — active schedule_overrides count
  preserve_from_now_on: 2,    // REBAL-03 — reschedule_marker truthy count
  preserve_total: 7           // sum of the three preserve_ fields
}
```

**Wave 2 scope reminders (from 17-CONTEXT.md):**
- D-07: Settings → Scheduling nav section — `app/(app)/settings/scheduling/page.tsx` (or extend existing settings).
- D-08: Shadcn AlertDialog or Dialog. Calls `rebalancePreviewAction` on open; Buttons "Cancel" / "Apply rebalance"; on apply → `rebalanceApplyAction` → success toast → `router.refresh()`.
- D-09: Counts copy is designer discretion within the D-09 template.
- REBAL-05 (Settings button) and REBAL-06 (preview dialog) are Wave 2 scope.

**Wave 2 REQ handoff:** REBAL-05, REBAL-06 remain for Wave 2. REBAL-01/02/03/04/07 are complete with this plan's unit tests as evidence; Wave 3 (if scoped) would add port-18105 integration scenarios that exercise the actions against a live PB instance.

## Threat Flags

None found — no new security-relevant surface outside the plan's `<threat_model>`. The two new endpoints (`rebalancePreviewAction`, `rebalanceApplyAction`) are exactly the T-17-01-01..08 surface enumerated in the plan.

## Self-Check: PASSED

**Files verified exist:**
- `lib/rebalance.ts` (148 lines) — FOUND
- `lib/actions/rebalance.ts` (405 lines) — FOUND
- `tests/unit/rebalance.test.ts` (401 lines) — FOUND
- `tests/unit/actions/rebalance-actions.test.ts` (661 lines) — FOUND
- `.planning/phases/17-manual-rebalance/17-01-P01-SUMMARY.md` (this file) — FOUND

**Commits verified in git log:**
- `9c5993c test(17-01): add failing tests for classifyTasksForRebalance (RED)` — FOUND
- `5a01db6 feat(17-01): ship classifyTasksForRebalance helper (REBAL-01..04)` — FOUND
- `a7da8ad test(17-01): add failing tests for rebalance server actions (RED)` — FOUND
- `69637a4 feat(17-01): rebalancePreviewAction + rebalanceApplyAction (REBAL-04, REBAL-07)` — FOUND

**Acceptance criteria:**
- [x] `lib/rebalance.ts` ships `classifyTasksForRebalance` + `RebalanceBuckets` type
- [x] `lib/actions/rebalance.ts` ships `rebalancePreviewAction` + `rebalanceApplyAction` + both result types (+ intermediate `RebalancePreviewResult` type for symmetry with `RebalanceResult`)
- [x] Priority order: anchored > active_snooze > from_now_on > rebalanceable (D-01)
- [x] Archived, OOFT (null/0), dormant-seasonal tasks excluded from all buckets (D-02)
- [x] Apply uses single fresh `computeHouseholdLoad` map, threaded across placements (D-04 + REBAL-07)
- [x] Apply processes rebalanceable bucket in ascending natural-ideal order (D-03)
- [x] Apply uses one atomic `pb.createBatch()` for all writes (D-05)
- [x] Apply clears `reschedule_marker` to null on from_now_on bucket (D-06 revision)
- [x] Second apply is idempotent on values (D-12 — Test A7)
- [x] Membership gate via assertMembership (T-17-01-07)
- [x] 25 new tests green; full regression green (585/585)
- [x] TDD gate: RED commit precedes GREEN commit for both Task 1 and Task 2

## Test Count Trajectory

| Plan | Delta | Cumulative |
|------|-------|------------|
| Phase 16 final | — | 560 |
| **17-01 Task 1** (classifyTasksForRebalance) | **+12** | **572** |
| **17-01 Task 2** (preview + apply actions) | **+13** | **585** |

Plan 17-01 total: +25 tests exact — matches plan's `<verification>` projection.
