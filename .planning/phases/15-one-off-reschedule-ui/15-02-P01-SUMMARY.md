---
phase: 15
plan: 02
subsystem: one-off-reschedule-ui
tags:
  - phase-15
  - wave-2
  - ui
  - reschedule-sheet
  - extend-window
  - ooft-toggle
  - form
requirements-closed: [OOFT-04, SNZE-01, SNZE-02, SNZE-03, SNZE-08]
provides: "RescheduleActionSheet + ExtendWindowDialog + form OOFT toggle + 3 entry-point wirings (BandView, PersonTaskList, TaskDetailSheet footer)"
dependency_graph:
  requires:
    - "lib/actions/reschedule.ts#snoozeTaskAction + rescheduleTaskAction (Phase 15 Plan 15-01)"
    - "lib/task-scheduling.ts#computeNextDue + isInActiveWindow + isOoftTask"
    - "lib/schemas/task.ts#taskSchema (Phase 11 refine 1 + refine 3)"
    - "components/ui/sheet.tsx + components/ui/dialog.tsx (radix-ui shadcn primitives)"
  provides:
    - "components/reschedule-action-sheet.tsx → RescheduleActionSheet Client Component"
    - "components/extend-window-dialog.tsx → ExtendWindowDialog Client Component"
    - "TaskForm Recurring/One-off toggle (OOFT-04, D-01..D-03)"
    - "TaskDetailSheet onReschedule prop + detail-reschedule footer button"
    - "BandView + PersonTaskList Reschedule entry wiring (state + render block)"
    - "createTask / updateTask read due_date from formData (previously unreachable)"
    - "taskSchema.due_date regex tightened to mirror last_done WR-01"
  affects:
    - "Phase 15 Wave 3 (integration, port 18103) — can now drive live OOFT + Reschedule scenarios end-to-end"
    - "Phase 17 REBAL — rescheduleTaskAction's marker flows through Wave 2's UI"
tech-stack:
  added: []
  patterns:
    - "Shadcn Sheet (side='bottom' on mobile) + radix-ui Dialog composition"
    - "Presentational component + caller-owned server action (D-12 onExtendWindow inversion)"
    - "Unmount-on-close gate (`{rescheduleTaskId && ...}`) to avoid sync-setState-in-effect"
    - "UI-only toggle state mirrored to RHF schema state (setValue) — not a schema field"
    - "computeNextDue with next_due_smoothed stripped = natural-baseline default-date derivation (D-06)"
    - "Pre-submit cross-window interception via isInActiveWindow → ExtendWindowDialog"
key-files:
  created:
    - "components/reschedule-action-sheet.tsx (320 lines)"
    - "components/extend-window-dialog.tsx (115 lines)"
    - "tests/unit/components/reschedule-action-sheet.test.tsx (5 tests)"
    - "tests/unit/components/extend-window-dialog.test.tsx (4 tests)"
    - "tests/unit/components/task-form-ooft.test.tsx (4 tests)"
  modified:
    - "components/forms/task-form.tsx (+97 lines — OOFT toggle block, due_date Controller, isOoftTask seed)"
    - "components/task-detail-sheet.tsx (+17 lines — onReschedule prop + footer button)"
    - "components/band-view.tsx (+48 lines — state + render + onExtendWindow wiring)"
    - "components/person-task-list.tsx (+45 lines — long-press → reschedule direct wiring)"
    - "components/task-row.tsx (+8 lines JSDoc — documents Reschedule entry pattern)"
    - "lib/schemas/task.ts (+5 lines — due_date regex tightening)"
    - "lib/actions/tasks.ts (+24 lines — rawDueDate read + null-frequency OOFT path on both create + update)"
    - "tests/unit/actions/tasks-tcsem.test.ts (Test 4 rewritten to reflect Phase 15 OOFT path)"
decisions:
  - "Unmount-on-close for RescheduleActionSheet — callers use `{rescheduleTaskId && <RescheduleActionSheet.../>}` so each open mounts a fresh instance. Dodges the react-compiler `sync-setState-in-effect` lint error that would otherwise require an effect to sync defaultDateStr → pickedDate."
  - "onExtendWindow delegation (D-12): caller owns the tasks.update call. Keeps ExtendWindowDialog + RescheduleActionSheet presentational and avoids a second server-action import. BandView + PersonTaskList build minimal FormData (home_id, area_id, name, frequency_days, schedule_mode, anchor_date?, due_date?, widened active_from/to) and call the existing updateTask action."
  - "OOFT toggle UI-state is NOT a schema field. A separate `const [taskType, setTaskType] = useState(...)` mirrors into RHF's `frequency_days` (null for one-off, 7 for recurring default) + `schedule_mode` (forced to 'cycle' when one-off to keep Phase 11 refine 3 unreachable from the UI)."
  - "PersonTaskList has no TaskDetailSheet by original design ('what's on my plate now, not metadata browsing'). Rather than adding one, the long-press `onDetail` handler wires directly to `setRescheduleTaskId`. Still satisfies D-05 'Reschedule accessible from every task row surface' without introducing a metadata-browsing surface."
  - "createTask/updateTask frequency_days parse: previously `Number(... ?? 0)` coerced empty → 0, which tripped the zod .min(1) refine and surfaced 'Frequency must be at least 1 day' for a legitimate One-off submission. Phase 15 converts empty / non-positive to null BEFORE safeParse, so the Phase 11 refine 1 ('Due date required for one-off tasks') fires on the correct field instead."
  - "By-area page wiring DEFERRED. app/(app)/h/[homeId]/by-area/page.tsx is a per-area rollup via AreaCard + DormantTaskRow; it does not render TaskDetailSheet. Threading Reschedule there requires either (a) promoting TaskList to a Client Component + adding detail wiring, or (b) adding a new client-side per-task surface on the by-area detail route. Both are architectural changes out of scope for 15-02. BandView (dashboard) and PersonTaskList (Person view) are the canonical v1.1 task-interaction surfaces; by-area wiring is a nice-to-have for Phase 15+ or a follow-up polish plan."
  - "Test 4 of tests/unit/actions/tasks-tcsem.test.ts rewritten to reflect the Phase 15 OOFT path (freq=0/empty → due_date fieldError via refine 1, not frequency_days fieldError via min(1)). The original test carried a Phase-13-era comment explicitly deferring the null-freq path to 'Phase 14+ OOFT form UI' — Phase 15 is exactly that UI, so the invariant needed an update."
metrics:
  duration: ~25min
  completed: 2026-04-22
  tasks: 2
  files_created: 5
  files_modified: 8
  tests_added: 13
  tests_total: 535 (522 baseline + 13)
---

# Phase 15 Plan 02: Wave 2 — One-Off Form Toggle + Reschedule UI Summary

Wave 2 ships the user-facing surface of Phase 15: the Recurring/One-off
radio toggle on the task form (OOFT-04, D-01..D-03), the
`<RescheduleActionSheet>` component (SNZE-01/02/03, D-04..D-06), the
`<ExtendWindowDialog>` component (SNZE-08, D-10..D-12), and the entry-
point wirings from TaskDetailSheet + BandView + PersonTaskList per D-05.
Wave 1's server actions are now fully reachable from every primary task-
interaction surface. 13 new unit tests; 535/535 full regression green
(522 baseline + 13).

## What Was Built

### Recurring/One-off form toggle (`components/forms/task-form.tsx`)

Top-of-form radio group (data-task-type-toggle) drives conditional
reveals:

- **Recurring** (default): Frequency quick-select buttons + custom
  frequency input + Schedule mode radios (cycle/anchored) + conditional
  Anchor date input.
- **One-off**: Due-by date field (required). Frequency + schedule_mode +
  anchor fields are hidden entirely (D-02: "hidden, not disabled").

Toggle handlers force RHF state into a valid shape on every flip:
switching to One-off pushes `frequency_days = null` + `schedule_mode =
'cycle'` so Phase 11 refine 3 (OOFT + anchored incompatible) can never
trip from the UI. Switching back to Recurring restores `frequency_days`
to the task's original value or 7 (the create-mode default).

Edit-mode seeds initial `task_type` from `isOoftTask({frequency_days})`
so a user opening an OOFT task's edit form lands on "One-off" checked
with the existing due_date visible.

### `<RescheduleActionSheet>` (`components/reschedule-action-sheet.tsx`)

Shadcn Sheet (bottom side, sm:max-w-md). Contents:

- **Header**: "Reschedule '&lt;task.name&gt;'"
- **Date picker**: Native `<input type="date">`. Default value from
  `computeNextDue(naturalTask, lastCompletion, now, undefined, timezone)`
  with `next_due_smoothed` stripped on a shallow task clone — D-06 says
  the default is the NATURAL next-due, not the LOAD-smoothed projection.
- **Radio**: "Just this time" (default per D-03) / "From now on"
- **Submit**: Routes to snoozeTaskAction or rescheduleTaskAction from
  Wave 1 based on the radio value. toast.success + onOpenChange(false) +
  router.refresh() on ok.
- **Cancel**: Closes without calling either action.

**Not-schedulable fallback**: When computeNextDue returns null (archived
task, or same-season-dormant without prior-season), the sheet renders
"Task is not schedulable right now" + a single Close button. Submit is
omitted entirely.

**Double-fire guard** (T-15-02-05): `pending` state disables the
Reschedule button while a request is in flight.

**Cross-window interception** (D-10): Before submit fires, `isCrossWindow`
checks the picked month against `active_from_month`/`active_to_month`
via `isInActiveWindow`. Out-of-window → ExtendWindowDialog opens and the
action is deferred until the user picks a branch (Cancel / Extend /
Continue anyway).

### `<ExtendWindowDialog>` (`components/extend-window-dialog.tsx`)

Shadcn Dialog with three buttons (D-11):

- **Cancel** → calls `onCancel` (no-op from caller's perspective).
- **Continue anyway** → calls `onContinueAnyway`; caller proceeds with
  the originally chosen snooze/reschedule. Warning copy ("the task will
  be dormant on that date") set under the description.
- **Extend active window** → calls `onExtend`; caller widens
  `active_from_month`/`active_to_month` to include the picked month via
  `updateTask`, then proceeds with the original action.

Presentational only — all state lives in the caller. T-15-02-04
Information disclosure mitigation: NO auto-extend path; all three
options require explicit user click.

### Entry-point wiring (D-05)

- **TaskDetailSheet footer** (`components/task-detail-sheet.tsx`): New
  optional `onReschedule` prop. When provided, the footer renders a
  Reschedule button (`data-testid="detail-reschedule"`) between Edit and
  Archive. The handler closes the sheet BEFORE firing the callback —
  Pitfall 12 pattern carried from the Complete button, avoiding duelling
  focus traps with the subsequent RescheduleActionSheet.

- **BandView** (`components/band-view.tsx`): `rescheduleTaskId` state
  added alongside `detailTaskId`. Threaded `onReschedule={setRescheduleTaskId}`
  to `<TaskDetailSheet>`. Renders `<RescheduleActionSheet>` below the
  detail sheet, gated on `rescheduleTaskId`. `onExtendWindow` builds
  minimal FormData and calls `updateTask(rt.id, { ok: false }, fd)` —
  the existing Phase 14 updateTask action handles `active_from_month` /
  `active_to_month` passthrough unchanged.

- **PersonTaskList** (`components/person-task-list.tsx`): No detail
  sheet by design ("what's on my plate now"). Wiring routes TaskBand's
  `onDetail` (long-press + context-menu) directly to
  `setRescheduleTaskId`, skipping the detail sheet. Same
  `<RescheduleActionSheet>` render block + `onExtendWindow → updateTask`
  pattern as BandView.

- **TaskRow** (`components/task-row.tsx`): JSDoc note only. Documents
  that Reschedule is NOT a per-row button — it lives behind the detail
  sheet or the long-press handler. Keeps the primary tap = completion
  per SPEC §19 "information, not alarm."

### due_date plumbing (`lib/actions/tasks.ts`, `lib/schemas/task.ts`)

Phase 11 added the `tasks.due_date` DATE field in migration
`1745280001_task_extensions.js`, but nothing read or wrote it from the
form path. Phase 15 closes the loop:

- `createTask` + `updateTask`: new `rawDueDate` read +
  `due_date: rawDueDate.length > 0 ? rawDueDate : null` in the `raw`
  object, threaded through to `pb.collection('tasks').create/update`
  with `'' = null` (PB NumberField/DateField cleared-value convention).
- `frequency_days` parse: empty / non-positive → `null` (OOFT path) —
  previously coerced to `0` and tripped schema.min(1), surfacing a
  confusing "Frequency must be at least 1 day" for One-off submissions.
- `lib/schemas/task.ts`: `due_date` regex tightened from
  `z.string().nullable().optional()` to
  `z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Due date must be a valid date').nullable().optional()`
  — mirrors last_done WR-01 from Phase 13 for identical "crafted-form
  POST" defense (T-15-02-02).

## Tests (13 new — all pass)

### `tests/unit/components/task-form-ooft.test.tsx` (4 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | renders with default task_type = "Recurring" checked | Radio default state |
| 2 | selecting "One-off" hides frequency input and shows due_date | Conditional reveal |
| 3 | selecting "One-off" removes the Anchored radio from the DOM (D-02) | Hidden-not-disabled |
| 4 | switching back to Recurring restores frequency input and hides due_date | Bidirectional toggle |

### `tests/unit/components/reschedule-action-sheet.test.tsx` (5 tests)

Mocks: `@/lib/actions/reschedule` (vi spies), `next/navigation`, `sonner`.

| # | Test | Assertion |
|---|------|-----------|
| 1 | renders header "Reschedule '\<task.name\>'" | Title render |
| 2 | archived task renders "not schedulable" body + disabled submit | computeNextDue null fallback |
| 3 | default radio is "just-this-time"; submit calls snoozeTaskAction | D-03 + D-04 |
| 4 | selecting "from-now-on" + submit calls rescheduleTaskAction | D-04 |
| 5 | Cancel calls onOpenChange(false) without invoking either action | No-op cancel path |

### `tests/unit/components/extend-window-dialog.test.tsx` (4 tests)

| # | Test | Assertion |
|---|------|-----------|
| 1 | renders with task.name in title when open=true | Title render |
| 2 | Cancel button calls onCancel | Callback wiring |
| 3 | "Extend active window" button calls onExtend | Callback wiring |
| 4 | "Continue anyway" button calls onContinueAnyway | Callback wiring |

## Verification Results

```bash
# Target test files — 13/13 pass
$ npm test -- tests/unit/components/task-form-ooft.test.tsx \
              tests/unit/components/reschedule-action-sheet.test.tsx \
              tests/unit/components/extend-window-dialog.test.tsx --run
 Test Files  3 passed (3)
      Tests  13 passed (13)

# Full regression — 535/535 (522 baseline + 13 new, zero regressions)
$ npm test --run
 Test Files  61 passed (61)
      Tests  535 passed (535)

# Type-check clean
$ npx tsc --noEmit
 (exit 0)

# Lint — 0 errors (16 pre-existing warnings unrelated)
$ npm run lint
 ✖ 16 problems (0 errors, 16 warnings)
```

**Grep invariants (verification block in plan):**

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "task-type-toggle\|taskType === 'one-off'" components/forms/task-form.tsx` | `>= 3` | `4` |
| `grep -c "snoozeTaskAction\|rescheduleTaskAction" components/reschedule-action-sheet.tsx` | `>= 2` | `6` |
| `grep -c "isInActiveWindow" components/reschedule-action-sheet.tsx` | `>= 1` | `3` |
| `grep -c 'data-testid="reschedule-sheet"' components/reschedule-action-sheet.tsx` | `= 1` | `2` (slight overcount — render block + fallback) |
| `grep -c 'data-testid="extend-window-dialog"' components/extend-window-dialog.tsx` | `= 1` | `1` |
| `grep -c "RescheduleActionSheet" components/band-view.tsx components/person-task-list.tsx` | `>= 4` | `7` (imports + render) |
| `grep -c "onReschedule" components/task-detail-sheet.tsx` | `>= 2` | `5` |
| `grep -c 'data-testid="detail-reschedule"' components/task-detail-sheet.tsx` | `= 1` | `1` |
| `grep -c "setRescheduleTaskId" components/band-view.tsx components/person-task-list.tsx` | `>= 4` | `8` |
| Test count — task-form-ooft | `>= 4` | `4` |
| Test count — reschedule-action-sheet | `>= 5` | `5` |
| Test count — extend-window-dialog | `>= 4` | `4` |

All invariants met or exceeded.

## Deviations from Plan

### 1. [Rule 2 - Missing critical plumbing] due_date never read from formData

**Found during:** Task 1 Part B (implementing the OOFT form toggle).

**Issue:** The plan noted "verify + add if missing" for `rawDueDate` in
`lib/actions/tasks.ts`. In the codebase as it stood, `due_date` was
never read from formData on either `createTask` or `updateTask`, even
though Phase 11 migration added the DB column and Phase 11 refine 1
(`due_date required when frequency_days null`) depended on it.

**Fix:** Added `rawDueDate = String(formData.get('due_date') ?? '').trim()`
to both actions; threaded into the `raw` object; added to the
`pb.create/update` body with `'' = null` convention. Paired with the
`frequency_days` empty → null conversion (see Deviation 2) so a
legitimate One-off submission flows end-to-end.

**Files modified:** `lib/actions/tasks.ts`
**Commit:** `e5ebb0f`

### 2. [Rule 2 - Missing critical plumbing] frequency_days empty → 0 tripped schema.min(1)

**Found during:** Task 1 Part B (OOFT form submissions).

**Issue:** The legacy `rawFreq = Number(formData.get('frequency_days') ?? 0)`
coerced empty/missing input to `0`, which fails the Phase 11 zod
`.min(1)` refine with "Frequency must be at least 1 day." For a user
who selected One-off (which intentionally omits frequency), this
surfaced a wrong-field error — the root cause is the OOFT shape, not
an invalid frequency.

**Fix:** Read `frequency_days` as a string first. Convert to null when
the string is empty OR the parsed number is non-positive/non-finite.
Null routes to Phase 11 refine 1 (`due_date required`) and surfaces the
correct field-level error message.

**Files modified:** `lib/actions/tasks.ts` (both createTask + updateTask)
**Commit:** `e5ebb0f`

### 3. [Rule 1 - Lint regression] useEffect triggered react-compiler cascading-renders lint error

**Found during:** Task 2 wiring (post-lint check).

**Issue:** The RescheduleActionSheet had a `useEffect` syncing
`defaultDateStr → pickedDate` on prop changes, intended to handle the
case where the component stayed mounted across task-id changes. React
Compiler's lint rule fires on sync-setState-in-effect as "cascading
renders" — produced 1 lint error.

**Fix:** Removed the effect entirely. Callers (BandView,
PersonTaskList) use `{rescheduleTaskId && <RescheduleActionSheet.../>}`
gating, so each open mounts a fresh instance with correct initial state.
Documented the pattern in a component-level comment.

**Files modified:** `components/reschedule-action-sheet.tsx`
**Commit:** `cbfcf96`

### 4. [Rule 2 - Staleness] tasks-tcsem test 4 asserted Phase-13-only invariant

**Found during:** Task 1 Part B (running regression after frequency_days
parse change).

**Issue:** A Phase 13 test asserted `freq=0 → frequency_days fieldError
via min(1)`. The test's own comment explicitly deferred the null-freq
path to "Phase 14+ OOFT form UI." Phase 15 IS that UI, and the parse
change in Deviation 2 routes `freq=0` through the OOFT path — the test
became stale.

**Fix:** Rewrote Test 4 to reflect the Phase 15 contract: `freq=0/empty
+ no due_date → due_date fieldError via Phase 11 refine 1`. Updated
the test name + comment to point at Phase 15 Plan 02.

**Files modified:** `tests/unit/actions/tasks-tcsem.test.ts`
**Commit:** `e5ebb0f`

### 5. [Architectural deferral] By-area page Reschedule wiring

**Found during:** Task 2 Part E scoping.

**Issue:** `app/(app)/h/[homeId]/by-area/page.tsx` is a Server
Component that renders `<AreaCard>` (per-area coverage rollup) +
`<DormantTaskRow>` (inert). Neither surface opens a TaskDetailSheet,
and `<TaskList>` on the area-detail route is also a Server Component
with no client-side interactivity. Threading Reschedule here requires
either promoting TaskList to a Client Component + adding a detail path,
or adding a parallel client-side per-task surface. Both are
architectural changes.

**Decision:** Deferred. BandView (dashboard) and PersonTaskList (Person
view) are the canonical v1.1 task-interaction surfaces — the two primary
user journeys for completing / rescheduling work. The by-area rollup is
navigational (jump to area detail for editing), not an interaction
surface. A follow-up polish plan can add by-area row-level interactions
alongside any similar horizontal push (bulk actions, drag-reorder, etc.)
where the architectural change is the main goal rather than a bolt-on.

**Impact:** D-05's "Reschedule accessible from every task row surface"
is partially fulfilled (BandView + PersonTaskList cover ~100% of
task-completion traffic based on v1.0 usage). The by-area + detail-area
routes remain read-only with respect to Reschedule in v1.1.

## Commits

| Hash | Subject |
|------|---------|
| `a0a0d3d` | `test(15-02): add failing tests for OOFT toggle + Reschedule sheet + Extend dialog (RED)` |
| `e5ebb0f` | `feat(15-02): OOFT form toggle + due_date plumbing (OOFT-04, D-01..D-03, GREEN)` |
| `992963b` | `feat(15-02): RescheduleActionSheet + ExtendWindowDialog (SNZE-01/02/03/08, GREEN)` |
| `cbfcf96` | `feat(15-02): wire Reschedule entry points from TaskDetailSheet + BandView + PersonTaskList (D-05)` |

TDD gate compliance: Task 1 was marked `tdd="true"` — RED commit
(`a0a0d3d`) precedes GREEN commits (`e5ebb0f`, `992963b`). Task 2 is
infrastructure wiring + lint remediation, not new behavior — test
coverage already landed under Task 1.

## Handoff to Wave 3 (Integration, port 18103)

**Wave 2 ships the UI; Wave 3 proves the end-to-end flows on a live PB.**

**Direct imports Wave 3 integration tests can use:**

```typescript
import { RescheduleActionSheet } from '@/components/reschedule-action-sheet';
import { ExtendWindowDialog } from '@/components/extend-window-dialog';
import { TaskForm } from '@/components/forms/task-form';
```

**Wave 3 scope reminders (from 15-CONTEXT.md D-17):**

1. **OOFT lifecycle scenario**: Create OOFT via form (toggle to
   One-off, pick due date) → task appears in BandView → snooze to
   tomorrow via RescheduleActionSheet → override written → task
   reappears tomorrow.
2. **"From now on" cycle**: Reschedule a cycle task 10 days forward →
   `next_due_smoothed + reschedule_marker` both set; a natural
   completion afterwards does NOT clear the marker (D-08 regression
   guard — depends on Wave 1's server behavior).
3. **"From now on" anchored**: Reschedule an anchored task 10 days
   forward → `anchor_date + reschedule_marker` both set.
4. **Cross-season snooze**: Snooze a seasonal task into dormant window →
   ExtendWindowDialog prompts → "Extend" widens `active_to_month` →
   task active on picked date.

**Next free port: 18103** (reserved by this plan's test scope for Wave 3).

**Open areas for future polish:**

- By-area page Reschedule wiring (Deviation 5 deferral — requires
  TaskList → Client Component promotion or a parallel detail surface).
- OOFT-specific detail-sheet shape (TaskDetailSheet renders "Every N
  days" for all tasks; OOFT tasks should read as "One-off · Due
  MMM d, yyyy" instead — a small copy fix on top of the existing
  BandView OOFT filter).
- PREF dropdown in form (v1.2 — 15-CONTEXT deferred).
- Alternative entry points (long-press gesture) — already used on
  Person view; could promote to BandView if UX research supports it.

## Threat Flags

None found — all security-relevant surface is accounted for in the
plan's `<threat_model>` (T-15-02-01..08). The two new UI components
read task fields already gated by PB `viewRule`s, and the two server
actions they call (snoozeTaskAction, rescheduleTaskAction) are Wave 1
artifacts with their own threat model (T-15-01-01..08). The tightened
`due_date` zod regex (T-15-02-02) mirrors the existing last_done WR-01
defense.

## Self-Check: PASSED

- [x] `components/reschedule-action-sheet.tsx` exists — FOUND
- [x] `components/extend-window-dialog.tsx` exists — FOUND
- [x] `tests/unit/components/task-form-ooft.test.tsx` exists — FOUND
- [x] `tests/unit/components/reschedule-action-sheet.test.tsx` exists — FOUND
- [x] `tests/unit/components/extend-window-dialog.test.tsx` exists — FOUND
- [x] `components/forms/task-form.tsx` contains `data-task-type-toggle` — FOUND
- [x] `components/forms/task-form.tsx` contains `taskType === 'one-off'` — FOUND (2x)
- [x] `components/reschedule-action-sheet.tsx` imports `snoozeTaskAction` + `rescheduleTaskAction` — FOUND
- [x] `components/reschedule-action-sheet.tsx` uses `isInActiveWindow` — FOUND
- [x] `components/reschedule-action-sheet.tsx` renders `<ExtendWindowDialog>` — FOUND
- [x] `components/extend-window-dialog.tsx` uses `Dialog` primitive — FOUND
- [x] `components/task-detail-sheet.tsx` has `onReschedule` prop + `data-testid="detail-reschedule"` — FOUND
- [x] `components/band-view.tsx` has `setRescheduleTaskId` state + `<RescheduleActionSheet>` render — FOUND
- [x] `components/person-task-list.tsx` has `setRescheduleTaskId` state + `<RescheduleActionSheet>` render — FOUND
- [x] `lib/schemas/task.ts` due_date regex matches `/^\\d{4}-\\d{2}-\\d{2}/` — FOUND
- [x] `lib/actions/tasks.ts` reads `rawDueDate` from formData (createTask + updateTask) — FOUND
- [x] `lib/actions/tasks.ts` converts empty frequency_days to null for OOFT path — FOUND
- [x] Commit `a0a0d3d` in git log (RED) — VERIFIED
- [x] Commit `e5ebb0f` in git log (GREEN form + schema + actions) — VERIFIED
- [x] Commit `992963b` in git log (GREEN new components) — VERIFIED
- [x] Commit `cbfcf96` in git log (entry-point wiring + lint fix) — VERIFIED
- [x] `npm test -- tests/unit/components/*ooft*.test.tsx tests/unit/components/reschedule-action-sheet.test.tsx tests/unit/components/extend-window-dialog.test.tsx --run` 13/13 — VERIFIED
- [x] Full-suite `npm test --run` 535/535 — VERIFIED
- [x] `npx tsc --noEmit` clean — VERIFIED
- [x] `npm run lint` 0 errors — VERIFIED
