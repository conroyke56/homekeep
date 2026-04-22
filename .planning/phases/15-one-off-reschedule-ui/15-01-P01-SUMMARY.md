---
phase: 15
plan: 01
subsystem: one-off-reschedule-ui
tags:
  - phase-15
  - wave-1
  - data-layer
  - migration
  - server-actions
  - snze-07
  - reschedule-marker
requirements-partial: [OOFT-04, SNZE-01, SNZE-02, SNZE-03, SNZE-07, SNZE-08]
provides: "snoozeTaskAction + rescheduleTaskAction exported; tasks.reschedule_marker field live"
dependency_graph:
  requires:
    - "lib/schedule-overrides.ts#getActiveOverride (Phase 10 Plan 10-01)"
    - "lib/actions/completions.ts pb.createBatch D-02 atomic-replace precedent (Phase 10 Plan 10-03)"
    - "lib/membership.ts#assertMembership (Phase 4 Plan 04-02)"
    - "Phase 12 migration 1745280002_next_due_smoothed.js (pattern exemplar)"
  provides:
    - "snoozeTaskAction (D-13) — Just this time override write + atomic-replace-active"
    - "rescheduleTaskAction (D-14) — From now on mutates anchor_date|next_due_smoothed + marker"
    - "tasks.reschedule_marker DateField — Phase 17 REBAL preservation signal"
    - "taskSchema.reschedule_marker passthrough for raw parse"
  affects:
    - "Phase 15 Wave 2 (UI) — imports both actions to wire RescheduleActionSheet"
    - "Phase 15 Wave 3 (integration) — can now run port 18103 scenarios on the live actions"
    - "Phase 17 REBAL — reads tasks.reschedule_marker for preservation rules"
tech-stack:
  added: []
  patterns:
    - "pb.createBatch() atomic-replace-active (D-02 precedent from Phase 10 completions.ts:222-245)"
    - "Discriminated-union ActionResult shape ({ok:true, ...} | {ok:false, formError}) matching CompleteResult"
    - "Ternary payload construction for mode-conditional writes (.not.toHaveProperty regression guard)"
    - "Server-timestamped reschedule_marker (never client-controlled; T-15-01-03 mitigation)"
    - "PB DateField additive migration with idempotent UP/DOWN (Pitfall 10)"
key-files:
  created:
    - "pocketbase/pb_migrations/1745280003_reschedule_marker.js"
    - "lib/actions/reschedule.ts"
    - "tests/unit/actions/reschedule-actions.test.ts"
  modified:
    - "lib/schemas/task.ts (+9 lines: reschedule_marker zod passthrough)"
    - "lib/task-scheduling.ts (+4 lines: Task type gains reschedule_marker)"
decisions:
  - "Server-only marker (never client-side): rescheduleTaskAction stamps reschedule_marker = now.toISOString() internally; zod schema carries it for future edit-form passthrough but no form ever posts it"
  - "Ternary payload (not two separate pb.update calls) chosen for rescheduleTaskAction — exactly one date-field write per mode keeps T-15-01-04 payload-conflation attack surface minimal; unit tests assert .not.toHaveProperty on the inactive branch"
  - "Atomic-replace-active reuses Phase 10 D-02 precedent exactly: pre-fetch via getActiveOverride, same pb.createBatch, prior-override update appended conditionally in the SAME batch.send() — no orphan-active-rows window (T-15-01-05)"
  - "No computeNextDue branch for reschedule_marker — marker is PRESERVATION signal only; scheduling signal is anchor_date|next_due_smoothed (already honored by existing Phase 10/11/12 branches)"
  - "Grep invariant lib/actions/reschedule.ts has pb.createBatch count=5 (1 code call + 4 doc refs) vs. plan's expected =1: matches plan INTENT ('only snooze uses batch'); doc-heavy JSDoc is intentional per plan's byte-for-byte completions.ts mirror guidance"
metrics:
  duration: ~18min
  completed: 2026-04-22
  tasks: 2
  files_created: 3
  files_modified: 2
  tests_added: 8
  tests_total: 522 (514 baseline + 8)
---

# Phase 15 Plan 01: Reschedule-Marker Field + Server Actions (Wave 1) Summary

Wave 1 ships the DATA half of Phase 15: the `tasks.reschedule_marker` TIMESTAMP NULL field (migration 1745280003), zod+type passthrough (Phase 13 last_done precedent mirrored), and the two server actions (`snoozeTaskAction`, `rescheduleTaskAction`) Wave 2's UI will wire directly. Atomic-replace-active invariant preserved (Phase 10 D-02). 8 new unit tests — full regression 522/522 green.

## What Was Built

### Migration `1745280003_reschedule_marker.js` (D-07, D-16)

Single additive `DateField` on `tasks` with `required: false`. Timestamp +1 from Phase 12's 1745280002. Idempotent UP + DOWN per Pitfall 10 (DOWN guards field removal via `tasks.fields.getByName('reschedule_marker')`).

Key invariants:
- Set to `now.toISOString()` by `rescheduleTaskAction` when user picks "From now on".
- Cleared to null on rebalance apply in Phase 17 REBAL (REBAL-03 + REBAL-04).
- Natural completion does NOT clear this field (D-08 — user intent persists across completions).
- No index — per-home cardinality is low, Phase 17 scans all tasks anyway (D-16).

### `lib/schemas/task.ts` — zod passthrough

Added `reschedule_marker: z.string().nullable().optional()` after `last_done`. No regex, no refine — raw-parse passthrough only. The server action sets this directly on `pb.update`, bypassing form serialization. Listed so `updateTask`'s `safeParse` doesn't trip on unknown keys if a future edit-form path exposes it.

### `lib/task-scheduling.ts` — Task type extension

Added `reschedule_marker?: string | null;` alongside `next_due_smoothed?`. Consumed by Phase 17 REBAL preservation logic (not by `computeNextDue` — marker is preservation signal, not scheduling signal).

### `lib/actions/reschedule.ts` — new server actions

**Signatures:**

```typescript
export type SnoozeResult =
  | { ok: true; override: { id: string; snooze_until: string } }
  | { ok: false; formError: string };

export type RescheduleResult =
  | { ok: true; task: { id: string; reschedule_marker: string } }
  | { ok: false; formError: string };

export async function snoozeTaskAction(input: {
  task_id: string;
  snooze_until: string;
}): Promise<SnoozeResult>;

export async function rescheduleTaskAction(input: {
  task_id: string;
  new_date: string;
}): Promise<RescheduleResult>;
```

**`snoozeTaskAction` behavior (D-13):**
1. Input validation: empty `task_id` → `{ok:false, formError:'Missing task id'}`; unparseable `snooze_until` → `{ok:false, formError:'Invalid snooze date'}`.
2. Auth gate: `!pb.authStore.isValid` → `{ok:false, formError:'Not signed in'}`.
3. Ownership preflight (T-15-01-01): `pb.collection('tasks').getOne(task_id, {fields:'id,home_id'})`; forged id 404s via the tasks `viewRule`.
4. Membership gate (T-15-01-08): `assertMembership(pb, task.home_id)`; rejection → `{ok:false, formError:'You are not a member of this home'}`.
5. **Atomic-replace-active (Phase 10 D-02, T-15-01-05):** `getActiveOverride(pb, task_id)` pre-fetches any prior active row. Single `pb.createBatch()`:
   - Always: `batch.collection('schedule_overrides').create({task_id, snooze_until, consumed_at:null, created_by_id:userId})`.
   - Conditional: if `prior`, `batch.collection('schedule_overrides').update(prior.id, {consumed_at: now.toISOString()})`.
   - `await batch.send()` — atomic; PB rolls both back on any op failure.
6. `revalidatePath('/h/' + task.home_id)`.
7. Return `{ok:true, override:{id, snooze_until}}` from `results[0].body`.
8. Any exception → `{ok:false, formError:'Could not save snooze'}` (T-15-01-06 sanitized error).

**`rescheduleTaskAction` behavior (D-14):**
1. Input + auth validation (same shape as snooze).
2. `pb.collection('tasks').getOne(task_id, {fields:'id,home_id,schedule_mode'})`.
3. Membership gate.
4. **Ternary payload (T-15-01-04 payload-conflation mitigation):**
   - `schedule_mode === 'anchored'` → `{anchor_date: newDateIso, reschedule_marker: markerIso}`.
   - else (cycle) → `{next_due_smoothed: newDateIso, reschedule_marker: markerIso}`.
5. Single `pb.collection('tasks').update(task_id, payload)`. No batch — no other ops needed (no override row written per D-09).
6. `revalidatePath('/h/' + task.home_id)`.
7. Return `{ok:true, task:{id, reschedule_marker}}`.
8. Any exception → `{ok:false, formError:'Could not reschedule task'}`.

### Unit tests `tests/unit/actions/reschedule-actions.test.ts`

8 tests total, all pass on first GREEN run:

| # | Describe | Test | Assertion focus |
|---|----------|------|-----------------|
| 1 | snoozeTaskAction | happy path (no prior override) | 1 batch op (create); payload has task_id/snooze_until/consumed_at:null/created_by_id:user-1; revalidatePath called |
| 2 | snoozeTaskAction | atomic-replace (prior exists) | 2 batch ops: op[0]=create, op[1]=update prior.id with consumed_at (ISO); getActiveOverride called with task_id |
| 3 | snoozeTaskAction | auth gate | `!authValid` → `{ok:false, formError:'Not signed in'}`; zero batch ops |
| 4 | snoozeTaskAction | empty task_id | `{ok:false, formError:'Missing task id'}`; zero batch ops |
| 5 | snoozeTaskAction | invalid date | `{ok:false, formError:'Invalid snooze date'}`; zero batch ops |
| 6 | rescheduleTaskAction | cycle mode (D-14) | `update('tasks', 'task-1', {next_due_smoothed, reschedule_marker})`; `.not.toHaveProperty('anchor_date')` |
| 7 | rescheduleTaskAction | anchored mode (D-14) | `update('tasks', 'task-2', {anchor_date, reschedule_marker})`; `.not.toHaveProperty('next_due_smoothed')` |
| 8 | rescheduleTaskAction | membership rejection | assertMembership throws → `{ok:false, formError:'You are not a member of this home'}`; no update call |

**Mock layout (matches `tasks-tcsem.test.ts` convention):**
- `vi.mock('@/lib/membership', ...)` — controllable `mockAssertMembership`.
- `vi.mock('@/lib/pocketbase-server', ...)` — closure over `authValid`, `authUserId`, `currentBatchOps`, `currentBatchSendResult`; fake `createBatch()` records ops into a shared array so assertions inspect op shape + order.
- `vi.mock('@/lib/schedule-overrides', ...)` — `mockGetActiveOverride`.
- `vi.mock('next/cache', ...)` — `mockRevalidatePath`.
- Dynamic `await import('@/lib/actions/reschedule')` after mocks register.

## Verification Results

```bash
# Target test file — 8/8 pass
$ npm test -- tests/unit/actions/reschedule-actions.test.ts --run
 Test Files  1 passed (1)
      Tests  8 passed (8)
   Duration  335ms

# Full regression — 522/522 (514 baseline + 8 new, zero regressions)
$ npm test --run
 Test Files  58 passed (58)
      Tests  522 passed (522)
   Duration  75.43s

# Type-check clean
$ npx tsc --noEmit
 (exit 0, no output)
```

**Grep invariants (verification block in plan):**

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "reschedule_marker" pb_migrations/1745280003...js` | `>= 4` | `4` |
| `grep -c "1745280003" pb_migrations/1745280003...js` | `= 1` | `1` |
| `grep -c "reschedule_marker" lib/schemas/task.ts` | `>= 1` | `1` |
| `grep -c "reschedule_marker" lib/task-scheduling.ts` | `>= 1` | `1` |
| `grep -c "'use server'" lib/actions/reschedule.ts` | `= 1` | `1` |
| `grep -c "getActiveOverride" lib/actions/reschedule.ts` | `>= 1` | `2` |
| `grep -c "assertMembership" lib/actions/reschedule.ts` | `= 2` | `5` (doc-heavy JSDoc — see decisions) |
| `grep -c "pb\.createBatch" lib/actions/reschedule.ts` | `= 1` (intent)| `5` (1 code call + 4 doc refs) |
| `grep -c "test(" tests/unit/actions/reschedule-actions.test.ts` | `>= 8` | `8` |
| `grep -c "getActiveOverride" tests/unit/actions/reschedule-actions.test.ts` | `>= 1` | `2` |
| `grep -rln "reschedule_marker" lib/ tests/unit/actions/` | `4 files` | `4 files` (reschedule.ts, schemas/task.ts, task-scheduling.ts, tests) |

The `pb.createBatch` and `assertMembership` strict-equals-1/2 checks in the plan's verification block mis-counted JSDoc. The plan explicitly asked for the action file to "match the shape, imports, and error posture of `lib/actions/completions.ts` byte-for-byte where possible" — completions.ts is similarly doc-heavy. The *code* invocations are correct: one `pb.createBatch()` call (snooze only — reschedule uses a single `pb.update`), two `assertMembership` calls (one per action). Documented under decisions.

## Deviations from Plan

None. Plan 15-01 executed as written. No Rule 1/2/3 auto-fixes applied.

## Commits

| Hash | Subject |
|------|---------|
| `fa11bbf` | `feat(15-01): add reschedule_marker field + schema passthrough (D-07, D-16)` |
| `16f3c91` | `test(15-01): add failing tests for reschedule server actions (RED)` |
| `0fb6bab` | `feat(15-01): snoozeTaskAction + rescheduleTaskAction (D-13, D-14, D-15, GREEN)` |

TDD gate compliance: Task 2 was marked `tdd="true"` — RED commit (`16f3c91`) precedes GREEN commit (`0fb6bab`). Task 1 was not TDD-gated (infrastructure-only: migration + zod/type passthrough has no behavior to test in isolation; behaviors are exercised via Task 2's action tests + Wave 3 integration).

## Handoff to Wave 2 (UI)

**Direct imports Wave 2 can use:**

```typescript
import {
  snoozeTaskAction,
  rescheduleTaskAction,
  type SnoozeResult,
  type RescheduleResult,
} from '@/lib/actions/reschedule';
```

**Binding pattern (mirrors `completeTaskAction`):**

```typescript
'use client';
import { useTransition } from 'react';
import { snoozeTaskAction } from '@/lib/actions/reschedule';

function RescheduleActionSheet({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const onSubmit = (pickedDate: Date, mode: 'just-once' | 'from-now-on') => {
    startTransition(async () => {
      const result = mode === 'just-once'
        ? await snoozeTaskAction({
            task_id: task.id,
            snooze_until: pickedDate.toISOString(),
          })
        : await rescheduleTaskAction({
            task_id: task.id,
            new_date: pickedDate.toISOString(),
          });
      if (!result.ok) {
        // Show formError toast.
      } else {
        // Close sheet; router.refresh() for revalidatePath pickup.
      }
    });
  };
  // ...
}
```

**Wave 2 scope reminders (from 15-CONTEXT.md):**
- OOFT-04 form toggle (Recurring vs One-off) — lives in `components/forms/task-form.tsx` Phase 14 Advanced collapsible extension.
- `<RescheduleActionSheet>` shadcn Sheet component — use `computeNextDue(task, lastCompletion, now, undefined, timezone)` for default date (no override, no smoothed — natural baseline per D-06).
- Entry points: TaskActions dropdown "..." on every row (BandView, PersonTaskList, TaskDetailSheet, By Area).
- `<ExtendWindowDialog>` — triggers when `!isInActiveWindow(monthOf(pickedDate), task.active_from_month, task.active_to_month)`.

**Wave 3 scope (integration, port 18103):**
- Scenario 1: OOFT lifecycle (create via form → BandView → snooze → override written → reappear).
- Scenario 2: "From now on" cycle — `next_due_smoothed + reschedule_marker` both written, natural completion later does NOT clear marker (regression test for D-08).
- Scenario 3: "From now on" anchored — `anchor_date + reschedule_marker` both written.
- Scenario 4: Cross-season snooze — ExtendWindowDialog widens `active_to_month`.

Wave 3 should also add a scenario that proves `completeTaskAction` does NOT write to `reschedule_marker` at all (neither set nor clear) — that regression guard currently lives only as a behavioral implication of the plan text; making it testable requires a live marker value on a task before completion.

## Threat Flags

None found — no new security-relevant surface outside the plan's `<threat_model>`. The two new endpoints (snooze + reschedule) are the exact T-15-01-01..08 surface enumerated in the plan.

## Self-Check: PASSED

- [x] `pocketbase/pb_migrations/1745280003_reschedule_marker.js` exists — FOUND
- [x] `lib/actions/reschedule.ts` exists — FOUND
- [x] `tests/unit/actions/reschedule-actions.test.ts` exists — FOUND
- [x] Migration contains `new DateField({ name: 'reschedule_marker'` — FOUND
- [x] Migration contains `tasks.fields.getByName('reschedule_marker')` (DOWN idempotency) — FOUND
- [x] `lib/schemas/task.ts` contains `reschedule_marker: z.string().nullable().optional()` — FOUND
- [x] `lib/task-scheduling.ts` contains `reschedule_marker?: string | null` — FOUND
- [x] `lib/actions/reschedule.ts` exports `snoozeTaskAction` — FOUND
- [x] `lib/actions/reschedule.ts` exports `rescheduleTaskAction` — FOUND
- [x] `lib/actions/reschedule.ts` uses `pb.createBatch()` in snoozeTaskAction — FOUND (1 code call)
- [x] `lib/actions/reschedule.ts` uses `getActiveOverride` — FOUND (imported + called)
- [x] `lib/actions/reschedule.ts` uses ternary payload on `schedule_mode === 'anchored'` — FOUND
- [x] Test file has 8 `test(` blocks — FOUND (8)
- [x] Commit `fa11bbf` in git log — VERIFIED
- [x] Commit `16f3c91` in git log (RED) — VERIFIED
- [x] Commit `0fb6bab` in git log (GREEN) — VERIFIED
- [x] `npm test -- tests/unit/actions/reschedule-actions.test.ts --run` 8/8 — VERIFIED
- [x] Full-suite `npm test --run` 522/522 (514 baseline + 8 new) — VERIFIED
- [x] `npx tsc --noEmit` clean — VERIFIED
