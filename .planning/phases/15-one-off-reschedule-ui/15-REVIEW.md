---
phase: 15-one-off-reschedule-ui
reviewed: 2026-04-22T15:11:28Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - components/band-view.tsx
  - components/extend-window-dialog.tsx
  - components/forms/task-form.tsx
  - components/person-task-list.tsx
  - components/reschedule-action-sheet.tsx
  - components/task-detail-sheet.tsx
  - components/task-row.tsx
  - lib/actions/reschedule.ts
  - lib/actions/tasks.ts
  - lib/schemas/task.ts
  - pocketbase/pb_migrations/1745280003_reschedule_marker.js
findings:
  critical: 0
  warning: 1
  info: 7
  total: 8
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-22T15:11:28Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 15 delivers the One-Off/Reschedule UI on top of the Phase 15-01 data layer (`reschedule_marker` migration + reschedule server actions). Review covered all focus areas called out in the brief. 539-pass test suite correlates with what was observed in code — invariants are well-enforced:

- **snoozeTaskAction** (lib/actions/reschedule.ts:107-119) uses a single `pb.createBatch().send()` transaction to consume any prior active override and create the new one atomically. The D-02 unique-active invariant has no orphan-window.
- **rescheduleTaskAction** (lib/actions/reschedule.ts:192-199) branches correctly: `schedule_mode === 'anchored'` writes `{ anchor_date, reschedule_marker }`, otherwise `{ next_due_smoothed, reschedule_marker }`. Crucially there is **no `schedule_overrides` create** in rescheduleTaskAction — the "From now on" path mutates only the task, matching D-09.
- **reschedule_marker** is set by rescheduleTaskAction (server-timestamped, never from client input) and **never referenced in `lib/actions/completions.ts`** — the completion path does not touch it, preserving "user intent persists through natural completions" (D-08).
- **ExtendWindowDialog** is correctly gated: `isCrossWindow()` (reschedule-action-sheet.tsx:127-141) returns false when either seasonal bound is null, so the dialog only fires when both bounds are set AND the picked month falls outside.
- **OOFT form toggle** (task-form.tsx:280-302) forces `schedule_mode='cycle'` and nulls `frequency_days` when "One-off" is chosen. Schema refine 3 is defense-in-depth. Due date input renders only in one-off mode and is required via Phase 11 refine 1.
- **PB filter parameterization**: reschedule.ts uses only `getOne(id)` — no string-concat filter. The broader reschedule path (schedule-overrides.ts helpers) uses `pb.filter('...{:tid}...', {tid})` binding.
- **Membership gate**: both snoozeTaskAction (line 94) and rescheduleTaskAction (line 178) call `assertMembership(pb, task.home_id)` before any write. Two-layer defense (PB viewRule + application-layer gate).
- **Pure helpers** (task-scheduling.ts) remain free of `Date.now()` / wall-clock reads. Clock is plumbed in as `now: Date` from callers.

One Warning (missing outer catch around the reschedule submit path) and a handful of Info-level quality nits. No Critical issues.

## Warnings

### WR-01: `RescheduleActionSheet.doSubmit` has no outer catch — unexpected throws leave stuck state

**File:** `components/reschedule-action-sheet.tsx:143-170`
**Issue:** `doSubmit` awaits `snoozeTaskAction` / `rescheduleTaskAction` inside a `try { ... } finally { setPending(false) }`. There is **no catch block**. Both server actions return `{ ok: false, formError }` for business errors (never throw), so happy/unhappy business outcomes are covered. However:

1. A network-layer failure that causes the `await` itself to reject (fetch throws, transport error, aborted Server Action) will propagate out of `doSubmit`. `setPending(false)` still fires via `finally`, but **no toast is shown**, **the sheet is not closed**, and **no `router.refresh()` runs**. The user sees the spinner vanish and the sheet still open with no feedback.
2. `new Date(pickedDate).toISOString()` on line 147 will throw `RangeError: Invalid time value` if `pickedDate` somehow holds an unparseable string. An `<input type="date">` normally prevents this, but the same input's value flows through React state without explicit runtime validation.

Compare to `components/band-view.tsx:234-275` where `handleTap` wraps the action call in `try { ... } catch { toast.error('Could not complete task'); } finally { setPendingTaskId(null); }`.

**Fix:**
```tsx
async function doSubmit(which: 'just-this-time' | 'from-now-on') {
  if (!pickedDate) return;
  setPending(true);
  try {
    const iso = new Date(pickedDate).toISOString();
    const res =
      which === 'just-this-time'
        ? await snoozeTaskAction({ task_id: task.id, snooze_until: iso })
        : await rescheduleTaskAction({ task_id: task.id, new_date: iso });
    if (res.ok) {
      toast.success(which === 'just-this-time' ? 'Snoozed' : 'Rescheduled');
      onOpenChange(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(res.formError);
    }
  } catch {
    // Mirror band-view.tsx handleTap — generic sanitized message so a
    // network exception or a malformed pickedDate surfaces feedback
    // instead of a silent stuck sheet.
    toast.error(
      which === 'just-this-time'
        ? 'Could not save snooze'
        : 'Could not reschedule task',
    );
  } finally {
    setPending(false);
  }
}
```

## Info

### IN-01: Unnecessary `as any` cast on RHF errors.due_date

**File:** `components/forms/task-form.tsx:237`
**Issue:** `(errors as any).due_date?.message` — `due_date` is a valid field in `TaskInput` (schema exposes it as `z.string().regex(...).nullable().optional()`), so `errors.due_date?.message` should type-check without the `any` cast. The cast was likely added because `due_date` can be `undefined` in the flattened error type; a narrower `FieldError | undefined` assertion works. Defeats TS's ability to catch real type mismatches here.
**Fix:**
```tsx
const dueDateError =
  errors.due_date?.message ?? serverFieldErrors?.due_date?.[0];
```
Drop the eslint-disable comment above it.

### IN-02: Redundant double-cast `as unknown as Task & { name: string }` on RescheduleActionSheet task prop

**File:** `components/band-view.tsx:527`, `components/person-task-list.tsx:302`
**Issue:** `task={rt as unknown as Task & { name: string }}` — `rt` is already `TaskWithName` / `PersonTask`, both of which extend `Task` and add `name: string`. The conversion is already structurally compatible; the double-cast is dead safety-net code that silences a non-existent error. If a future schema drift breaks the structural match, TS would now silently accept mismatched shapes.
**Fix:** Remove both casts.
```tsx
task={rt}
```
If TS does complain (e.g. due to `assigned_to_id?` nullable differences), narrow the type at the `PersonTask` / `TaskWithName` level instead.

### IN-03: Duplicated `onExtendWindow` FormData construction across BandView and PersonTaskList

**File:** `components/band-view.tsx:530-544`, `components/person-task-list.tsx:305-321`
**Issue:** Identical 14-line FormData construction block appears in both call sites. A future update to the task schema (e.g. adding a required `preferred_days` field to updateTask's required set) would silently diverge if only one call site is updated. Both blocks also need to be kept in sync with the canonical task schema.
**Fix:** Extract to `lib/helpers/reschedule-extend-form-data.ts`:
```ts
export function buildExtendWindowFormData(
  task: Task & { area_id: string; name: string },
  homeId: string,
  newFrom: number,
  newTo: number,
): FormData {
  const fd = new FormData();
  fd.set('home_id', homeId);
  fd.set('area_id', task.area_id);
  fd.set('name', task.name);
  fd.set(
    'frequency_days',
    task.frequency_days == null ? '' : String(task.frequency_days),
  );
  fd.set('schedule_mode', task.schedule_mode);
  if (task.anchor_date) fd.set('anchor_date', task.anchor_date);
  fd.set('active_from_month', String(newFrom));
  fd.set('active_to_month', String(newTo));
  if (task.due_date) fd.set('due_date', task.due_date);
  return fd;
}
```
Then both callers become `await updateTask(rt.id, { ok: false }, buildExtendWindowFormData(rt, homeId, newFrom, newTo));`.

### IN-04: `reschedule-action-sheet.tsx` naturalTask strips `next_due_smoothed` but leaves `reschedule_marker`

**File:** `components/reschedule-action-sheet.tsx:104`
**Issue:** `const naturalTask: Task = { ...task, next_due_smoothed: null };` — the comment explains why `next_due_smoothed` is stripped (want the natural baseline, not the LOAD-smoothed projection). `reschedule_marker` also does not affect `computeNextDue` branching in the current implementation, so leaving it is behaviourally fine. But the intent of the line is "reconstruct the pre-v1.1 baseline Task for default-date computation" — if Phase 17 REBAL introduces a reschedule_marker-aware read branch, this shortcut would silently bake the old marker into the default date.
**Fix:** Either strip both v1.1 fields for symmetry, or document the narrower intent.
```ts
// Strip all v1.1 write-through fields so computeNextDue runs the
// natural cadence baseline regardless of prior user actions.
const naturalTask: Task = {
  ...task,
  next_due_smoothed: null,
  reschedule_marker: null,
};
```

### IN-05: `as unknown as number` cast to write `null` into `frequency_days`

**File:** `components/forms/task-form.tsx:295`
**Issue:** `setValue('frequency_days', null as unknown as number, { shouldValidate: true })` — the schema allows null (`z.number().min(1).nullable()`), but RHF's `setValue` typing requires the branch type. The double-cast defeats TS checking and is awkward to grep for.
**Fix:** The inferred `TaskInput` type has `frequency_days: number | null`; use that.
```tsx
setValue('frequency_days', null, { shouldValidate: true });
```
If RHF's typing complains, widen the `useForm<TaskInput>` generic path instead of casting at the callsite.

### IN-06: `RescheduleActionSheet` extracts `userId` only in snooze path; asymmetry is fine but not documented

**File:** `lib/actions/reschedule.ts:85, 168-171`
**Issue:** `snoozeTaskAction` extracts `userId` from `pb.authStore.record?.id` to stamp `created_by_id` on the override row. `rescheduleTaskAction` validates `pb.authStore.isValid` but does not extract userId at all (the action only updates the task; no `created_by` field in the payload). The asymmetry is intentional and correct, but a reader scanning both functions may wonder if the omission is a bug.
**Fix:** Add a one-line comment in `rescheduleTaskAction`:
```ts
// No userId extraction here — the task update has no created_by
// field (the reschedule is a mutation on the existing row, not a
// new audit record). Contrast with snoozeTaskAction which stamps
// created_by_id on the schedule_overrides row.
```

### IN-07: Threat-register comment on T-15-01-04 claims "exactly ONE date field" but payload writes two fields

**File:** `lib/actions/reschedule.ts:43-46`
**Issue:** The threat-register comment says "T-15-01-04 Payload conflation: ternary writes EXACTLY ONE date field per mode — unit test asserts .not.toHaveProperty on the other branch field." The payload object actually contains **two** date fields: `reschedule_marker` plus one of `{anchor_date, next_due_smoothed}`. The invariant being tested is "exactly one of the two branch fields"; the reschedule_marker is orthogonal. The behaviour is correct — but the doc phrasing could mislead future readers or the auditor scanning for the literal text.
**Fix:** Tighten the wording:
```ts
//   - T-15-01-04 Payload conflation: ternary writes EXACTLY ONE of the
//     two branch fields ({anchor_date} XOR {next_due_smoothed}) per
//     mode — unit test asserts .not.toHaveProperty on the other branch.
//     reschedule_marker is always set and is orthogonal to the XOR.
```

---

_Reviewed: 2026-04-22T15:11:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
