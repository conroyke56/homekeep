---
phase: 11
plan: 01
subsystem: task-model-extensions
tags:
  - pocketbase
  - migration
  - zod
  - scheduling
  - pure-helpers
  - wave-1
  - ooft
  - pref
  - seas
dependency_graph:
  requires:
    - "Phase 10 schedule_overrides migration (timestamp 1745280000)"
  provides:
    - "tasks.due_date DATE NULL"
    - "tasks.preferred_days SELECT NULL (any|weekend|weekday)"
    - "tasks.active_from_month INT? 1..12"
    - "tasks.active_to_month INT? 1..12"
    - "tasks.frequency_days required:false (flipped)"
    - "taskSchema.due_date + preferred_days + active_from/to_month (optional)"
    - "taskSchema 3 new cross-field refinements with explicit path:"
    - "preferredDaysEnum zod export"
    - "Task type widened to frequency_days: number | null + 4 optional Phase 11 fields"
    - "effectivePreferredDays(task): 'any' | 'weekend' | 'weekday'"
    - "narrowToPreferredDays(candidates: Date[], pref): Date[]"
    - "isInActiveWindow(monthOneIndexed, from?, to?): boolean (wrap-aware)"
    - "nextWindowOpenDate(now, from, to, timezone): Date"
  affects:
    - "Plan 11-02 (computeNextDue branch composition consumes isInActiveWindow + nextWindowOpenDate)"
    - "Plan 11-02 (computeCoverage dormant-filter consumes isInActiveWindow)"
    - "Plan 11-02 (completeTaskAction batch OOFT archive op)"
    - "Plan 11-03 (disposable-PB integration suite on port 18099)"
    - "Phase 12 LOAD smoother consumes narrowToPreferredDays + effectivePreferredDays"
    - "Phase 14 Seasonal UI consumes isInActiveWindow + active_from/to_month"
    - "Phase 15 OOFT Form UI consumes due_date + frequency_days=null semantic"
tech-stack:
  added: []
  patterns:
    - "PB 0.37.1 direct-mutation persist: field.required = false + app.save(collection) (A1 resolved)"
    - "PB 0.37.1 post-construction .fields.add() for new nullable fields (D-23)"
    - "Additive migration with idempotent down-migration (getByName guard, Pitfall 10)"
    - "Zod cross-field .refine with explicit path: for form-field error routing (Pitfall 2 / D-21)"
    - "Type-widening + local const freq narrowing inside guard body"
    - "Minimal as number casts at UI projection boundaries (v1.0 recurring-only UI; OOFT forms land Phase 15)"
    - "Pure helpers with UTC-day semantics + tz-aware wake-up via toZonedTime / fromZonedTime"
    - "Wrap-aware isInActiveWindow (from > to branch) with 12-month unit matrix (T-11-04 mitigation)"
key-files:
  created:
    - "pocketbase/pb_migrations/1745280001_task_extensions.js (99 lines)"
    - "tests/unit/task-extensions.test.ts (238 lines, 31 tests)"
  modified:
    - "lib/schemas/task.ts (64 → 120 lines; 3 new .refine + 4 new optional fields + preferredDaysEnum export)"
    - "lib/task-scheduling.ts (152 → 272 lines; Task type widened + 4 new pure helpers + const freq local in computeNextDue body)"
    - "lib/coverage.ts (+1 line; as number cast for task.frequency_days in health calc)"
    - "components/band-view.tsx (+3 lines; as number cast at TaskDetailSheet projection)"
    - "components/task-band.tsx (+4 lines; as number cast at two TaskRow projections)"
decisions:
  - "A1 RESOLVED: direct-mutation path freq.required = false + app.save persists in PB 0.37.1 (Wave 0 smoke 2026-04-22 A1-SMOKE-OK); no remove+re-add fallback needed"
  - "preferredDaysEnum exported from lib/schemas/task.ts for Plan 11-02 + Phase 14/15 form re-use (Claude's Discretion from D-25)"
  - "Rule 3 blocking: type widening rippled to 5 TS errors (band-view, task-band, coverage, computeNextDue). Resolved with 3 x `as number` casts at UI projection boundaries + local `const freq` in computeNextDue body. Smallest-cast approach per plan action step 4."
  - "computeNextDue guard extended from `!Number.isInteger || < 1` to include `=== null` short-circuit — null would throw on isInteger anyway, but explicit guard improves error clarity"
  - "Bonus test cases (31 vs plan target ~18) — single-month and degenerate assertions delivered as standalone test() blocks rather than inline in a larger test; actual assertion density matches plan intent"
metrics:
  duration: ~12min
  tasks: 3
  files_created: 2
  files_modified: 5
  lines_added: 437
  tests_added: 31
  total_tests: 386
  baseline_tests: 355
  completed: 2026-04-22
---

# Phase 11 Plan 01: Task Model Extensions — Data Foundation Summary

Ship the Phase 11 data-model foundation: additive PB migration (4 new nullable fields on `tasks` + `frequency_days` flipped nullable), zod schema extension with 3 cross-field refinements, and 4 pure helpers (`effectivePreferredDays`, `narrowToPreferredDays`, `isInActiveWindow`, `nextWindowOpenDate`) that Plan 11-02 composes into `computeNextDue` branches. Zero runtime behavior changes; 355 baseline tests still green unchanged (D-26 regression gate preserved).

## What Was Built

### Production files

| File | Lines | Purpose |
|------|-------|---------|
| `pocketbase/pb_migrations/1745280001_task_extensions.js` | 99 | Additive migration. 4 new nullable fields on `tasks`: `due_date` (DateField), `preferred_days` (SelectField, values `['any','weekend','weekday']`), `active_from_month` + `active_to_month` (NumberField min:1 max:12 onlyInt:true). Flips `frequency_days.required = false` via direct-mutation path (A1 resolved). Down migration idempotent (getByName guard) and reverts frequency_days to required:true. Zero backfill per D-24. |
| `lib/schemas/task.ts` | 120 | Extended taskSchema: frequency_days nullable; 4 new optional fields; 3 new `.refine()` calls each with explicit `path:` — OOFT requires due_date (path:['due_date']); paired seasonal months (path:['active_from_month']); OOFT+anchored incompatible (path:['schedule_mode']). New `preferredDaysEnum` exported alongside `scheduleModeEnum`. |
| `lib/task-scheduling.ts` | 272 | Task type widened to `frequency_days: number | null` plus 4 optional Phase 11 fields. Added import `{ fromZonedTime, toZonedTime } from 'date-fns-tz'`. 4 new pure helpers exported: `effectivePreferredDays` (null→'any'), `narrowToPreferredDays` (hard narrowing filter; UTC-day basis; PREF-04 subset invariant), `isInActiveWindow` (wrap-aware non-wrap + wrap branches; null-degenerate returns true), `nextWindowOpenDate` (tz-aware via toZonedTime + fromZonedTime with year-selection heuristic). computeNextDue body unchanged in observable behavior — added `task.frequency_days === null` short-circuit to the guard for type-narrowing, bound `const freq: number` for cycle/anchored branches. |
| `lib/coverage.ts` | +1 line | Minimal `(task.frequency_days as number)` cast inside computeCoverage health calc — absorbs the Task type widening. |
| `components/task-band.tsx` | +4 lines (2x cast + comment) | `as number` cast at two TaskRow projections — v1.0/v1.1-recurring UI projection; Phase 15 adds OOFT-shape handling. |
| `components/band-view.tsx` | +3 lines (cast + comment) | `as number` cast at TaskDetailSheet projection. |

### Test files

| File | Lines | Tests |
|------|-------|-------|
| `tests/unit/task-extensions.test.ts` | 238 | **31 new tests** across 7 describe blocks: effectivePreferredDays (4), narrowToPreferredDays (5 — PREF-02/03/04 subset invariant), isInActiveWindow non-wrap (5 — boundary + single-month edge), isInActiveWindow wrap (6 — 12-month matrix for T-11-04 mitigation), isInActiveWindow degenerate (2 — null defense-in-depth), nextWindowOpenDate (2 — same-year + next-year heuristic), taskSchema zod refinements (7 — OOFT/paired/anchored-OOFT across accept + reject paths with path-routing assertions). |

## A1 Resolution — Wave 0 Smoke

**A1 hypothesis:** PB 0.37.1 accepts `NumberField.required = true → false` via direct `field.required = false` + `app.save(collection)`, persisting the change.

**Method:** 30-second disposable-PB smoke in `/tmp/pb-a1-smoke/` with a throwaway migration that (1) fetches the freshly-migrated `tasks` collection, (2) pre-asserts `frequency_days.required === true`, (3) sets it to false and saves, (4) re-fetches the collection from scratch (defeats in-memory caching), (5) asserts `required === false`. Migration threw on any mismatch.

**Result:** `A1-SMOKE-OK: direct-mutation path works; required=false persisted`. The post-save re-read returned `required: false` as expected. No remove+re-add fallback needed.

**Impact:** Migration uses the direct-mutation path (cleaner, preserves field id + column metadata). The fallback remove+re-add pattern stays in the plan's action-step comment as documentation for the next contributor who might need to change NumberField types (direct mutation works for flag-like fields; type changes still need remove+re-add).

**Secondary REST verification (Task 1 acceptance):** Booted PB on `127.0.0.1:18099` with the real migration applied, superuser-authed, and fetched `GET /api/collections/tasks`. Returned JSON confirmed all 5 field conditions:

```
frequency_days: required:false, type:number, onlyInt:true, min:1, max:null
due_date:       required:false, type:date
preferred_days: required:false, type:select, values:["any","weekend","weekday"], maxSelect:1
active_from_month: type:number, onlyInt:true, min:1, max:12
active_to_month:   type:number, onlyInt:true, min:1, max:12
```

## Decisions Made During Execution

1. **A1 direct-mutation vs remove+re-add** — Wave 0 smoke confirmed direct mutation works; migration ships with the simpler path. Fallback kept as docstring reference.
2. **`preferredDaysEnum` exported** — plan's "Claude's Discretion" section recommended export for Phase 14/15 form re-use; committed to the export so Plan 11-02 and Phase 14 don't re-declare the enum.
3. **Null-short-circuit inside computeNextDue guard** — the widening from `number` to `number | null` made TypeScript refuse to narrow `task.frequency_days` back down to `number` automatically across the cycle/anchored branches. Solved two ways: (a) explicit `=== null` short-circuit at guard top (throws on null with the same semantics Plan 11-02 will replace), (b) local `const freq: number = task.frequency_days` bound once after the guard so both branches use the narrowed local. Minimally invasive; no existing-test assertions needed changes.
4. **Three `as number` casts at UI projection boundaries** (Rule 3 Blocking) — `lib/coverage.ts:66`, `components/band-view.tsx:425` (TaskDetailSheet projection), `components/task-band.tsx:80+155` (two TaskRow projections). All at projection sites that funnel the widened Task shape into tighter UI-only shapes (`frequency_days: number`). Casts annotated with a comment referencing Plan 11-02 / Phase 15 for OOFT-shape handling. This is the "smallest possible cast" posture the plan mandated.
5. **`getUTCDay()` in `narrowToPreferredDays`** — plan said "exactly one `getUTCDay()` call in the body"; grep finds `2` matches because one is the body call and one is the JSDoc description. Confirmed via line-number grep: only line 207 is a real call.
6. **Test count 31 vs plan target ~18** — exceeded by delivering a fuller matrix (12 wrap-window months + both degenerate null cases + path-routing assertions on all three zod refines). No bloat — each test is atomic and asserts a single behavior.
7. **Full-suite regression** — `npm test` before any change: 355 green. After all three tasks: 386 green (355 + 31 new). Zero existing tests needed assertion changes (D-26 gate preserved). `npx tsc --noEmit` exits clean.

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Migration grep (fields + removeById) | `node -e ...grep ... task_extensions.js` | OK |
| Migration applies cleanly | PB CLI `migrate up` against fresh `pb_data` | 11 migrations applied in order |
| Migration REST schema | `GET /api/collections/tasks` via superuser token | All 5 field conditions verified |
| Zod grep — 4 refines + 4 paths | `grep -nE "^\s+\.refine\($" + "^\s+path: \["` | 4/4 real calls, each with explicit path |
| Zod tests | `npm test -- tests/unit/task-extensions.test.ts` | 31/31 green |
| Existing scheduling tests | `npm test -- tests/unit/task-scheduling.test.ts` | 23/23 green (D-26) |
| Full regression | `npm test` | 386/386 green (355 + 31) |
| Type-check | `npx tsc --noEmit` | clean exit |

## Deviations from Plan

**None affecting behavior.** Three minor discretionary calls:

1. `preferredDaysEnum` exported (plan's Claude's Discretion recommended).
2. `=== null` short-circuit in computeNextDue guard alongside the pre-existing `!Number.isInteger || < 1` — defensive, same throw semantics.
3. `as number` casts at 3 UI/coverage call sites to absorb the type widening (plan action step 4 anticipated this and mandated the minimal-cast approach).

No architectural changes. No CLAUDE.md file in repo root — loaded `./CLAUDE.md` skipped (not present).

## Handoff for Plan 11-02

Plan 11-02 inherits from this foundation:

- **Migration timestamp claimed:** `1745280001`. Plan 11-02 will not add a new migration; it extends runtime logic.
- **Helper signatures exported** from `lib/task-scheduling.ts`:
  - `effectivePreferredDays(task: Pick<Task, 'preferred_days'>): 'any' | 'weekend' | 'weekday'`
  - `narrowToPreferredDays(candidates: Date[], pref: 'any' | 'weekend' | 'weekday'): Date[]`
  - `isInActiveWindow(monthOneIndexed: number, from?: number | null, to?: number | null): boolean`
  - `nextWindowOpenDate(now: Date, from: number, to: number, timezone: string): Date`
- **Task type widened:** `frequency_days: number | null` + 4 optional Phase 11 fields. Callers in `lib/actions/completions.ts:325` already use `as number` cast (confirmed still safe); Plan 11-02's branch work in `computeNextDue` will replace the throwing null-guard with the OOFT branch (due_date read + post-completion null return per D-05).
- **Zod schema ready** for OOFT, paired seasonal months, anchored+OOFT rejection — Phase 15 form UI can rely on these refines producing field-routed errors.
- **`preferredDaysEnum` export** available for Plan 11-02 completion action shape + Phase 14/15 forms.
- **Port 18099 RESERVED (not consumed):** Plan 11-03 owns the disposable-PB integration suite on this port. No integration tests landed in this plan.
- **D-26 regression gate green:** 355 existing → 386. Any Plan 11-02 additions start from 386, must preserve assertion-for-assertion.

## Commits

- `59d02dd` — `feat(11-01): add migration extending tasks with 4 nullable fields`
- `6d00dc9` — `feat(11-01): extend taskSchema with 4 optional fields + 3 cross-field refinements`
- `9a3fe2e` — `feat(11-01): add 4 pure helpers + Phase 11 Task type widening + 31 unit tests`

## Self-Check: PASSED
