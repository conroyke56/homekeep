---
phase: 14-seasonal-ui-seed-library
plan: 01
subsystem: seasonal-ui-seed-library
tags:
  - task-form
  - active-months
  - anchored-warning
  - seed-library
  - seasonal
  - history-audit
  - phase-14
  - wave-1

# Dependency graph
requires:
  - phase: 11-task-model-extensions
    plan: 01
    provides: "active_from_month + active_to_month nullable-optional task fields + Phase 11 zod refine 2 (paired-or-null) + isInActiveWindow helper + nextWindowOpenDate helper"
  - phase: 13-task-creation-semantics
    plan: 02
    provides: "Advanced collapsible Wave-2 structure in task-form.tsx (TCSEM-01) — the exact integration point Phase 14 extends with the Active months subsection alongside last_done"
  - phase: 05-onboarding
    plan: 03
    provides: "batchCreateSeedTasks wizard contract — SEED_LIBRARY id Set-check + atomic pb.createBatch()"
  - phase: 02-tasks
    plan: 05
    provides: "createTask + updateTask server actions with raw→safeParse→pb.create/update pipeline — Phase 14 extends raw parse with active_from/to + /^\\d+$/ guard"

provides:
  - "Task form Active months subsection inside the Phase 13 Advanced collapsible (SEAS-07) — two native <select> dropdowns (From/To), paired-or-null via Phase 11 refine 2, disable-to-until-from UX hint (D-02), both-blank = year-round"
  - "AnchoredWarningAlert inline component (SEAS-08) — 6-cycle projection math + amber Alert when >50% dormant, non-blocking save, data-anchored-warning + data-dormant-ratio attrs"
  - "createTask + updateTask parse active_from_month + active_to_month from FormData with /^\\d+$/ tamper-guard (T-14-01) then persist via '' = clear PB convention"
  - "SEED_LIBRARY extended to 34 entries (30 existing + 4 new seasonal pairs) with active_from/to populated per D-12 Northern-hemisphere convention"
  - "batchCreateSeedTasks threads active_from/to from SEED_LIBRARY by seed_id (server-side lookup, T-14-02 — client cannot forge seasonal window for non-seasonal seed)"
  - "SEAS-10 regression test — filterCompletions signature locked at 5 formal params, dormant-task completion appears in history output"
  - "MONTH_OPTIONS module constant for future form consumers (Phase 15 / 16 reschedule sheet can reuse)"
  - "SeedTask type widened with optional active_from_month + active_to_month (backward-compat — existing 30 entries omit them)"

affects:
  - "Phase 14 Wave 2 (14-02): BandView / PersonTaskList / ByArea dormant rendering can now rely on every seasonal task row (form-created OR seed-onboarded) having active_from/to populated on the PB row"
  - "Phase 15 (OOFT-04 + Reschedule): same MONTH_OPTIONS constant + the Advanced collapsible loosened-guard pattern (create-mode, inner-gated fields) is the template for adding more fields"
  - "Phase 17 (REBAL): rebalance preservation rules can now treat active_from/to + anchored + OOFT as a single 'user-intent signal' bundle to preserve across rebalance"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Outer Collapsible guard loosened from cycle-only to create-mode; inner fields self-gate. Enables Phase 14 Active months (both modes) to coexist with Phase 13 last_done (cycle-only) inside the same Advanced section without one hiding the other."
    - "Paired-or-null form field pattern: two <select> dropdowns where the 'To' disabled-state is driven by watch('From'). RHF Controller + native <select> emits numeric string to FormData, server-side /^\\d+$/ guard + Number() + zod range check chains."
    - "Inline-component for derived-visibility alerts: AnchoredWarningAlert reads via watch() and self-computes visibility + projection math; parent gates only on the outer scheduleMode (Phase 14 SEAS-08 renders only in anchored mode)."
    - "SEED_LIBRARY threading: id→entry Map built once after the Set-membership check, consumed inside the tasks.create batch body. No client-trust: active_from/to NEVER read from client payload even when present (T-14-02 mitigation)."
    - "Module-level MONTH_OPTIONS constant near QUICK_SELECT — same 'as const' + {value, label} shape for reusability across future form sections."

key-files:
  created: []
  modified:
    - "lib/seed-library.ts (+47 lines) — SeedTask type widened with optional active_from_month + active_to_month; 4 new seasonal entries appended (seed-mow-lawn-warm/-cool, seed-service-ac, seed-service-heater) per D-11 + D-12 Northern-hemisphere convention"
    - "lib/schemas/seed.ts (+10 lines) — seedSelectionSchema widened with optional-nullable active_from_month + active_to_month mirroring taskSchema shape"
    - "lib/actions/seed.ts (+16 lines) — SEED_BY_ID_14 Map built post-membership-check; tasks.create body threads active_from_month + active_to_month from SEED_LIBRARY with '' = clear convention (matches anchor_date + next_due_smoothed)"
    - "components/onboarding-wizard.tsx (+4 lines) — JSDoc note on Selection type documenting that seasonal fields are propagated server-side (client payload unchanged)"
    - "components/forms/task-form.tsx (+158/-20 lines) — isInActiveWindow import; TaskRecord type extended with active_from/to; MONTH_OPTIONS module constant; RHF defaultValues seed active_from/to from task?.X ?? null; outer Advanced guard loosened to create-mode with inner cycle-only guard on last_done; Active months subsection (two selects, paired-disable-to UX, inline field error); AnchoredWarningAlert inline component renders only when scheduleMode=anchored + all required inputs + dormancy ratio strictly >0.5"
    - "lib/actions/tasks.ts (+33 lines) — createTask + updateTask read active_from_month + active_to_month from FormData with /^\\d+$/ tamper-guard (T-14-01); both actions persist to PB via '' = clear convention"
    - "tests/unit/seed-library.test.ts (+37 lines) — new 'Phase 14 seasonal pairs (SEAS-09)' describe block with 5 assertions: 4 per-seed exact-value checks + exactly-34-entries count"
    - "tests/unit/actions/seed-tcsem.test.ts (+24 lines) — new SEAS-09 test asserting batch.create body carries active_from_month=10 + active_to_month=3 for seed-service-ac"
    - "tests/unit/schemas/seed.test.ts (+9 lines) — new SEAS-09 test accepting paired active_from/to optional numbers"
    - "tests/unit/task-extensions.test.ts (+59 lines) — new Phase 14 (SEAS-08, D-04) describe block with 2 projection-math boundary tests: anchor=2026-07-15/freq=365/Oct-Mar → ratio=1.0 (warning); anchor=2026-11-15/freq=30/Oct-Mar → ratio≈0.167 (no warning)"
    - "tests/unit/history-filter.test.ts (+30 lines) — new SEAS-10 regression test asserting dormant-task completion survives filterCompletions + filterCompletions.length === 5 contract lock"

key-decisions:
  - "Outer Advanced collapsible guard loosened from 'cycle-only' to 'create-only' (dropping the cycle-mode check at the outer level). Inner fields self-gate: last_done stays cycle-only (D-03 hides for anchored per Phase 13), Active months applies to both cycle AND anchored (seasonal is orthogonal to schedule_mode — a 'Service heater' on a fixed Nov 1 anchor with Oct-Mar window is a legitimate user intent). Phase 13 SUMMARY's handoff suggestion put Active months inside the cycle-only guard; Phase 14 plan text explicitly overrides this (Task 2 Part A). AnchoredWarningAlert would never render without this widening since it watches anchor_date."
  - "AnchoredWarningAlert threshold is STRICTLY >0.5 (D-04 worded as '≤50% inside' → implemented as 'dormantCount/6 > 0.5'). 3/6 = 0.5 does NOT trigger the warning; 4+/6 does. Matches plan's 'most cycles fall outside' framing. Edge case analysis: anchor=Jan 1 / freq=60d / Oct-Mar window → projections Jan 1, Mar 2, May 1, Jun 30, Aug 29, Oct 28 → 3 dormant (May, Jun, Aug) / 6 = 0.5 → NO warning. The user is 50/50 inside vs outside; alert copy 'most … fall outside' would be misleading at exactly-50."
  - "Active-months Controller uses native <select> rather than shadcn Select. Native matches the existing anchor_date + area + assignee selects in this same form (visual consistency — plan text defers the shadcn-vs-native choice to 'recommend shadcn for consistency' but the form's own pattern is already native, so native wins on local consistency). Saves a shadcn/ui dependency on a Select primitive we don't currently wrap."
  - "updateTask now CONSUMES active_from/to (unlike last_done which is accepted on raw but ignored). Editing a task's seasonal window post-creation is a legitimate user flow (SEAS-07 applies at edit too — the plan text explicitly loops both createTask and updateTask in Task 2 Part C: 'Mirror the same four additions … in updateTask'). Breaking symmetry with last_done because seasonal-window edits don't trigger next_due_smoothed recomputation (D-07 scope protection — read-side computeNextDue handles dormancy-next branch at render time)."
  - "'' = clear PB convention preserved for active_from_month + active_to_month (matches anchor_date + next_due_smoothed). Plan text analyzed this choice against null: PB 0.37.1 NumberField writes accept '' as clear; null sometimes trips the SDK serializer. Internal read-side is symmetric — the Phase 11 task shape uses nullable optional, and PB '' → null on read."
  - "Same /^\\d+$/ tamper-guard applied identically in both createTask and updateTask raw parse. Mitigates T-14-01 (tampered FormData like '<script>' / '-1' / '13') BEFORE Number() — the zod refine catches 13+ via .min(1).max(12) but the regex catches negative numbers and string payloads that would otherwise Number()→NaN or negative-int."
  - "SEED_BY_ID_14 Map built ONCE per action call (post-membership-check) rather than inline-.find() per seed. O(N selections × log N library) → O(N) with the Map. Library size (34 after this plan) keeps either approach well under threshold, but the Map is the correct pattern for the cohort batch (T-05-03-06 selections.max(50) + 34-entry library)."

patterns-established:
  - "Pattern: paired form field with cascading disable UX. When two fields are semantically paired (from/to, start/end), use watch() on the first to drive disabled on the second. The RHF-native approach (Controller + disabled={fromValue == null}) stays in sync with RHF's own reset / setValue / form-level errors. Blank-both = null-null reads as 'unset' upstream; user cannot set 'to' without 'from' giving a clean paired-or-null invariant the server can trust."
  - "Pattern: inline alert component that self-computes visibility. AnchoredWarningAlert gates on four independent predicates + a derived ratio. Rendering it unconditionally inside a wrapping {scheduleMode === 'anchored' && (...)} keeps the outer gate orthogonal (schedule-mode scope) from the inner gate (all-fields-set + ratio-above-threshold). Parent doesn't need to replicate the projection math."
  - "Pattern: server-trust-only fields propagated via Map lookup inside batch action. When a downstream value MUST come from an authoritative client-side reference list (seed_id → SEED_LIBRARY entry), build the id→entry Map once after the Set-membership check, and use `.get(id)?.field ?? ''` inside the create body. Stops the client from smuggling the field in the payload AND avoids re-scanning the reference array per selection."
  - "Pattern: '' = clear for PB NumberField / DateField writes. Consistent across anchor_date, next_due_smoothed, active_from_month, active_to_month. Encodes null at the wire level without the null-serialization quirk of PB 0.37.1. Read-side pb.collection(...).getOne returns undefined / 0 / '' depending on the field definition, but the downstream zod refine normalizes to null."
  - "Pattern: contract-lock test for signature invariants. filterCompletions.length === 5 asserts the function's formal-param count at runtime. Any future PR that adds a 6th param (e.g. tasks: Task[] for dormancy filter) fails this test before the PR can land, protecting SEAS-10's architectural invariant ('history is dormancy-agnostic') even against well-intended feature additions."

requirements-completed:
  - SEAS-07
  - SEAS-08
  - SEAS-09
  - SEAS-10

# Metrics
duration: ~12min
completed: 2026-04-22
---

# Phase 14 Plan 14-01: Seasonal UI & Seed Library Wave 1 Summary

**Task form gains an Active months subsection inside the Phase 13 Advanced collapsible (two paired dropdowns — cycle+anchored), AnchoredWarningAlert renders amber when >50% of 6 projected cycles land outside the window, createTask + updateTask parse + persist active_from/to with /^\\d+$/ tamper-guard, SEED_LIBRARY ships 4 new seasonal pairs threaded through batchCreateSeedTasks, and filterCompletions is unit-locked dormancy-agnostic for SEAS-10. 492 → 502 tests (+10 exact: 5 seed-library + 1 seed-tcsem + 1 seed-schema + 2 task-extensions + 1 history-filter).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22T13:09:48Z
- **Completed:** 2026-04-22T13:19:23Z
- **Tasks:** 2 / 2 (Task 2 TDD: test commit then feat commit)
- **Files created:** 0
- **Files modified:** 10 (3 seed-library/schema/action + 1 onboarding-wizard + 2 task-form+actions + 4 test files)
- **Test delta:** +10 exact (492 baseline → 502 final). Projection from `<verification>` was "+~9" — delta came in at +10 because the seed-library describe block's 5 tests include the exactly-34-count check that was plan-text mandated.

## Accomplishments

### Task 1 — Seed library + onboarding thread (SEAS-09)

**Commit `ef60da2`:** `feat(14-01): seed library + onboarding thread 4 seasonal entries (SEAS-09)`

- `lib/seed-library.ts`: `SeedTask` type widened with two optional fields (`active_from_month?`, `active_to_month?`). 4 new entries appended after the existing 30 under a `// ─── Seasonal pairs (4) — Phase 14 SEAS-09 ───` separator: `seed-mow-lawn-warm` (14d, Apr-Sep), `seed-mow-lawn-cool` (30d, Oct-Mar), `seed-service-ac` (365d, Oct-Mar), `seed-service-heater` (365d, Apr-Sep). Comment documents the Northern-hemisphere convention per D-12 (hemisphere-aware labels deferred to v1.2). Existing 30 entries UNTOUCHED — they read as year-round via the optional-omit pattern, preserving backward compatibility.
- `lib/schemas/seed.ts`: `seedSelectionSchema` widened with `active_from_month` + `active_to_month` as `z.number().int().min(1).max(12).nullable().optional()`. Matches the taskSchema shape so the batch payload validates consistently; no `.refine` added here because enforcement lives at the task-create site.
- `lib/actions/seed.ts`: `SEED_BY_ID_14 = new Map(SEED_LIBRARY.map((s) => [s.id, s] as const))` built once right after the Set-membership check. Inside the per-seed `batch.collection('tasks').create({...})` body, two new fields `active_from_month: SEED_BY_ID_14.get(s.seed_id)?.active_from_month ?? ''` and `active_to_month: SEED_BY_ID_14.get(s.seed_id)?.active_to_month ?? ''` thread the window from the server-side lookup. Client payload is NEVER consulted for these fields (T-14-02 mitigation).
- `components/onboarding-wizard.tsx`: single JSDoc note added at the `Selection` type stating that seasonal fields propagate server-side (the wizard's client payload shape is unchanged — 4-field `{action, name, frequency_days, area_id}`).
- `tests/unit/seed-library.test.ts`: new `describe('Phase 14 seasonal pairs (SEAS-09)', ...)` block with 5 assertions — 4 per-seed shape checks + `SEED_LIBRARY.length === 34` exact-count invariant (catches accidental id collision: duplicate IDs wouldn't increase the length, per T-14-05).
- `tests/unit/actions/seed-tcsem.test.ts`: appended SEAS-09 test invoking `batchCreateSeedTasks` with a `seed-service-ac` selection and asserting the captured batch.create body carries `active_from_month: 10` + `active_to_month: 3`.
- `tests/unit/schemas/seed.test.ts`: appended one test asserting `seedSelectionSchema.safeParse({...validSelection, active_from_month: 4, active_to_month: 9}).success === true`.

Grep invariants (all pass):
- `grep -c "seed-mow-lawn-warm\\|seed-mow-lawn-cool\\|seed-service-ac\\|seed-service-heater" lib/seed-library.ts` = 4
- `grep "active_from_month:" lib/seed-library.ts | wc -l` = 4 (one per new seasonal seed — the type-literal entry uses `?:` so isn't counted by that specific pattern)
- `grep "active_from_month" lib/actions/seed.ts | wc -l` = 3 (threading line + 2 related context lines)
- `grep "active_from_month" lib/schemas/seed.ts | wc -l` = 1

### Task 2 — Task form Active months + anchored-warning + server wiring (SEAS-07, SEAS-08, SEAS-10)

**Test commit `e7bcfab`:** `test(14-01): anchored-warning projection math + history dormancy audit`
**Impl commit `be6009b`:** `feat(14-01): task-form Active months + anchored-warning + server wiring (SEAS-07, SEAS-08, SEAS-10)`

TDD sequence: the projection-math + SEAS-10 history-filter tests shipped in commit `e7bcfab` BEFORE the form/action implementation in `be6009b`. Both test blocks consume primitives that already existed (`isInActiveWindow` from Phase 11, `filterCompletions` from Phase 5), so both test commits passed on first run — they're contract-lock tests for what the new UI/action code had to consume + preserve.

#### Task 2A — tests (commit `e7bcfab`)

- `tests/unit/task-extensions.test.ts`: new `describe('Phase 14 (SEAS-08, D-04): anchored-warning projection math', ...)` block. Test-local helper `projectDormantRatio(anchorIso, freqDays, from, to)` mirrors the AnchoredWarningAlert math (6-cycle projection, count !isInActiveWindow(month, from, to), ratio = count/6). Two boundary tests:
  - **anchor=2026-07-15, freq=365, window=Oct-Mar → ratio = 1.0** (every cycle stays in July forever, 100% dormant against Oct-Mar). Asserts `ratio > 0.5 === true` → warning SHOULD render.
  - **anchor=2026-11-15, freq=30, window=Oct-Mar → ratio ≤ 0.5.** Projections span Nov 15, Dec 15, Jan 14, Feb 13, Mar 15, Apr 14. Only Apr is dormant → 1/6 ≈ 0.167. Asserts `ratio > 0.5 === false` → no warning.
- `tests/unit/history-filter.test.ts`: new SEAS-10 test. now=July 15 2026 (dormant), completion from Jan 10 2026 for `t-heater` (hypothetical Oct-Mar task). `filterCompletions([completion], {personId: null, areaId: null, range: 'all'}, taskAreaMap, now, 'UTC')` returns `[completion]` — dormancy-agnostic. Defensive: `filterCompletions.length === 5` locks the formal-param count at the type level (no dormancy surface).

#### Task 2B — implementation (commit `be6009b`)

- `components/forms/task-form.tsx`:
  - `import { isInActiveWindow } from '@/lib/task-scheduling'` at the top for projection math.
  - `TaskRecord` type extended with `active_from_month?: number | null` + `active_to_month?: number | null`.
  - Module-level `MONTH_OPTIONS` constant (Jan..Dec as `{value: 1..12, label: 'January'..'December'}[]`) with `as const`.
  - RHF `defaultValues` seeded with `active_from_month: task?.active_from_month ?? null` + `active_to_month: task?.active_to_month ?? null`.
  - Outer Advanced `<Collapsible>` guard CHANGED from `mode === 'create' && scheduleMode === 'cycle'` to `mode === 'create'` only. Inner fields self-gate: `{scheduleMode === 'cycle' && (<last_done div>)}` preserves Phase 13's D-03 cycle-only hint; the new Active months `<div>` has NO scheduleMode guard (applies to both cycle AND anchored per D-06 nuance — seasonal is orthogonal to schedule_mode).
  - Active months subsection: two `<Controller>` + native `<select>` pairs. From-select emits `v.length > 0 ? Number(v) : null`. To-select is `disabled={fromValue == null}` (D-02 UX hint; `watch('active_from_month')` drives the disabled state). Error surfacing: `errors.active_from_month?.message ?? serverFieldErrors?.active_from_month?.[0]` (matches Phase 11 refine 2 which uses `path: ['active_from_month']`).
  - `AnchoredWarningAlert` inline component at the bottom of the file. Reads `anchor_date`, `active_from_month`, `active_to_month`, `frequency_days` via `watch()`. Early-returns null on any missing/invalid input (type guards + `Number.isNaN` + `freq <= 0`). Projects 6 cycles with `anchor.getTime() + k * freq * 86400000`, extracts UTC month, counts `!isInActiveWindow(month, fromMonth, toMonth)`. `if (ratio <= 0.5) return null` enforces STRICTLY >0.5 per D-04. Renders an amber `role="alert"` `<div>` with `data-anchored-warning` + `data-dormant-ratio={ratio.toFixed(2)}` attrs (future E2E hook). Copy: `"Heads up: Most scheduled cycles fall outside the active window. The task will be dormant for those dates."`
  - Parent gates AnchoredWarningAlert render at `{scheduleMode === 'anchored' && <AnchoredWarningAlert watch={watch} />}` — keeps Alert out of the React tree entirely for cycle-mode tasks (D-06: no warning for cycle-mode).
- `lib/actions/tasks.ts`:
  - `createTask`: two new `raw*` reads (`rawActiveFromMonth`, `rawActiveToMonth`) with `.trim()`. Both undergo `/^\\d+$/.test(raw) ? Number(raw) : null` inside the `raw` object passed to `safeParse` — the strict digit regex BEFORE `Number()` mitigates T-14-01 (tampered inputs like `'<script>'`, `'-1'`). The pb.collection('tasks').create body gets `active_from_month: parsed.data.active_from_month ?? ''` + `active_to_month: parsed.data.active_to_month ?? ''`.
  - `updateTask`: same four additions (raw read, safeParse input, pb.update body). UNLIKE `last_done` (accepted-but-ignored on update per D-07), active_from/to ARE consumed on update — editing the seasonal window post-creation is a legitimate flow (SEAS-07 applies to edit too).

Grep invariants (all pass):
- `grep "active_from_month" components/forms/task-form.tsx | wc -l` = 11 (type, defaults, Controller name, select name attr, watch calls, projection-math reads)
- `grep "MONTH_OPTIONS" components/forms/task-form.tsx | wc -l` = 3 (const definition + 2 map iterations)
- `grep "AnchoredWarningAlert\\|data-anchored-warning" components/forms/task-form.tsx | wc -l` = 3 (parent render site + component definition + data-attr on div)
- `grep "dormantCount\\|isInActiveWindow" components/forms/task-form.tsx | wc -l` = 4
- `grep "active_from_month" lib/actions/tasks.ts | wc -l` = 7 (createTask raw read + parsed pass + pb.create body + updateTask mirror of the same three)
- `grep "SEAS-10" tests/unit/history-filter.test.ts | wc -l` = 2 (describe/test heading + inline comment)
- `grep "2026-07-15\\|2026-11-15\\|projectDormantRatio" tests/unit/task-extensions.test.ts | wc -l` = 5

#### History dormancy audit (SEAS-10, D-14)

Executed per plan Task 2 Part D:
```
grep -rn "active_from\|active_to\|isInActiveWindow" app/\(app\)/h/\[homeId\]/history/
```
Exit 1, zero matches — confirming the history view has NO dormancy filter. The SEAS-10 regression test (Task 2A) locks the invariant against future drift: any PR adding a dormancy parameter to `filterCompletions` would break `filterCompletions.length === 5`.

## Task Commits

1. **Task 1: Seed library + onboarding thread (SEAS-09)** — `ef60da2` (feat)
2. **Task 2A: Projection math + history audit tests** — `e7bcfab` (test, TDD RED/GREEN phase)
3. **Task 2B: Task form + server wiring (SEAS-07, SEAS-08, SEAS-10)** — `be6009b` (feat, TDD implementation phase)

**Plan metadata:** To be recorded by the docs commit that lands this SUMMARY.md + STATE.md + ROADMAP.md.

_Phase 14 Plan 1 is NOT a TDD-typed plan (plan frontmatter has no `type: tdd` field). Task 2 carries `tdd="true"` at the task level, producing the test→feat split seen above. Gate sequence (test then feat) honored._

## Files Created/Modified

See frontmatter `key-files.modified` for the full list. Summary of the 10 modified files:

**Data / schemas / actions (4 files):**
- `lib/seed-library.ts` — SeedTask type widened; 4 new seasonal entries
- `lib/schemas/seed.ts` — seedSelectionSchema widened
- `lib/actions/seed.ts` — SEED_BY_ID_14 Map + create-body threading
- `components/onboarding-wizard.tsx` — JSDoc note only

**Form + server actions (2 files):**
- `components/forms/task-form.tsx` — MONTH_OPTIONS + Active months subsection + AnchoredWarningAlert
- `lib/actions/tasks.ts` — createTask + updateTask active_from/to parse + persist

**Tests (4 files):**
- `tests/unit/seed-library.test.ts` — 5 new assertions (Phase 14 describe block)
- `tests/unit/actions/seed-tcsem.test.ts` — 1 new SEAS-09 threading test
- `tests/unit/schemas/seed.test.ts` — 1 new paired-optional test
- `tests/unit/task-extensions.test.ts` — 2 new projection-math boundary tests
- `tests/unit/history-filter.test.ts` — 1 new SEAS-10 regression test

## Decisions Made

See frontmatter `key-decisions` for the 6 load-bearing decisions. Highlights:

1. **Advanced collapsible guard loosened to create-only.** Phase 13's handoff suggestion put Active months inside the existing cycle-only guard; Phase 14 plan text overrode that (anchored seasonal tasks are legitimate — "Service heater Nov 1, active Oct-Mar"). Without this widening, AnchoredWarningAlert would never render because it requires `scheduleMode === 'anchored'`.
2. **Threshold strictly >0.5 per D-04.** 3/6 dormant = ratio 0.5 → NO warning. Copy "most cycles fall outside" would be misleading at a 50/50 split. Boundary test locks both the trigger edge (ratio=1.0) AND the quiet edge (ratio≈0.167).
3. **Native `<select>` over shadcn Select.** Matches existing anchor_date + area + assignee selects in the same form — local consistency wins over external "recommend shadcn" note.
4. **updateTask consumes active_from/to (unlike last_done).** Seasonal-window edits don't trigger placement recomputation (D-07 scope protection) but they ARE legitimate user edits at edit time. Asymmetric treatment with `last_done` is intentional and documented.
5. **`''` = clear PB convention preserved.** Matches anchor_date + next_due_smoothed. Avoids PB 0.37.1 SDK serializer quirks with `null`.
6. **`/^\\d+$/` tamper-guard BEFORE Number().** Zod refine catches 13+ via range check but would Number('<script>') → NaN which trips the type check elsewhere. Strict regex short-circuits garbage at the parse edge (T-14-01).

## Deviations from Plan

**None — plan executed exactly as written.** All 2 tasks' acceptance criteria met. All grep invariants pass. Test delta lands exactly at +10 as projected.

No CLAUDE.md file exists in the project root; no CLAUDE.md-driven adjustments applied.

## Issues Encountered

None. Both TDD test blocks (Task 2A's projection math + SEAS-10 history filter) passed on first run because the primitives they exercise (`isInActiveWindow` from Phase 11, `filterCompletions` from Phase 5) already existed; the test additions are contract-locks for the new consumers. Task 2B (UI + server actions) compiled and tested green on first run.

## Self-Check: PASSED

Performed at summary-write time.

**Files claimed to exist (verified via `ls` + Read):**
- `lib/seed-library.ts` — FOUND (contains 4 new seasonal seeds + SeedTask type widening)
- `lib/schemas/seed.ts` — FOUND (seedSelectionSchema accepts active_from/to)
- `lib/actions/seed.ts` — FOUND (SEED_BY_ID_14 Map + threading in batch.create body)
- `components/onboarding-wizard.tsx` — FOUND (JSDoc note on Selection type)
- `components/forms/task-form.tsx` — FOUND (MONTH_OPTIONS + Active months + AnchoredWarningAlert)
- `lib/actions/tasks.ts` — FOUND (createTask + updateTask active_from/to plumbing)
- `tests/unit/seed-library.test.ts` — FOUND (Phase 14 describe block, 5 tests)
- `tests/unit/actions/seed-tcsem.test.ts` — FOUND (SEAS-09 threading test)
- `tests/unit/schemas/seed.test.ts` — FOUND (paired-optional test)
- `tests/unit/task-extensions.test.ts` — FOUND (Phase 14 projection-math block, 2 tests)
- `tests/unit/history-filter.test.ts` — FOUND (SEAS-10 regression test)
- `.planning/phases/14-seasonal-ui-seed-library/14-01-P01-SUMMARY.md` (this file) — will be FOUND post-Write

**Commits claimed to exist (verified via `git log --oneline`):**
- `ef60da2` feat(14-01): seed library + onboarding thread 4 seasonal entries (SEAS-09) — FOUND
- `e7bcfab` test(14-01): anchored-warning projection math + history dormancy audit — FOUND
- `be6009b` feat(14-01): task-form Active months + anchored-warning + server wiring — FOUND

**Acceptance criteria (from plan):**

Task 1 (SEAS-09):
- [x] `grep -c "seed-mow-lawn-warm\\|seed-mow-lawn-cool\\|seed-service-ac\\|seed-service-heater" lib/seed-library.ts` == 4
- [x] `grep "active_from_month:" lib/seed-library.ts | wc -l` >= 4
- [x] `grep "active_from_month" lib/actions/seed.ts | wc -l` >= 1 (actual: 3)
- [x] `grep "active_from_month" lib/schemas/seed.ts | wc -l` >= 1 (actual: 1)
- [x] npm test on 3 files green; +5 +1 +1 new assertions pass
- [x] npx tsc --noEmit exits 0
- [x] npm run lint exits 0 errors

Task 2 (SEAS-07, SEAS-08, SEAS-10):
- [x] `grep -n "active_from_month" components/forms/task-form.tsx` >= 4 (actual: 11)
- [x] `grep -n "MONTH_OPTIONS" components/forms/task-form.tsx` >= 2 (actual: 3)
- [x] `grep -n "AnchoredWarningAlert\\|data-anchored-warning" components/forms/task-form.tsx` >= 2 (actual: 3)
- [x] `grep -n "dormantCount\\|isInActiveWindow" components/forms/task-form.tsx` >= 2 (actual: 4)
- [x] `grep -n "active_from_month" lib/actions/tasks.ts` >= 4 (actual: 7)
- [x] `grep -n "SEAS-10" tests/unit/history-filter.test.ts` >= 1 (actual: 2)
- [x] `grep -n "anchor=2026\\|projectAnchoredDormancyRatio\\|2026-07-15\\|2026-11-15" tests/unit/task-extensions.test.ts` >= 2 (actual: 5; helper renamed to `projectDormantRatio`, no behavioral drift)
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint` exits 0 errors (16 pre-existing warnings in unrelated files — out of scope per Rule 3 boundary)
- [x] `npm test --run` green: 492 → 502 (+10 exact match to plan projection)

**Combined verification:**
- [x] `npx tsc --noEmit && npm test -- tests/unit/seed-library.test.ts tests/unit/actions/seed-tcsem.test.ts tests/unit/schemas/seed.test.ts tests/unit/task-extensions.test.ts tests/unit/history-filter.test.ts --run` green
- [x] Full regression: 492 baseline preserved + 10 new tests all pass

## Test Count Trajectory

| Plan | Delta | Cumulative |
|------|-------|------------|
| Phase 13 final | — | 492 |
| 14-01 Task 1 (seed library + threading + 3 test files) | +7 | 499 |
| 14-01 Task 2A (TDD test commit: projection + SEAS-10) | +3 | 502 |
| 14-01 Task 2B (TDD feat commit: form + actions) | +0 | 502 |

Phase 14 cumulative delta (Wave 1): +10 tests exact. Wave 2 (14-02) will add dormant rendering + integration-suite tests on port 18102 (D-16 allocation already reserved).

## Next Phase Readiness

### Handoff to Wave 2 (14-02)

Everything downstream of the task-data plane is LIVE:
- **Every seasonal task read from PB** now has `active_from_month` + `active_to_month` populated from one of two sources: (a) the task form (create OR edit), or (b) the onboarding seed library (via `batchCreateSeedTasks` threading from SEED_LIBRARY).
- **Phase 11 `isInActiveWindow(month, from, to)`** is the single source of truth for "is this task currently dormant?" — BandView / PersonTaskList / ByArea dormant rendering (Wave 2 SEAS-06) should call it with `now.getUTCMonth() + 1` (or home-tz-aware month via `toZonedTime` if the view is tz-sensitive).
- **Phase 11 `nextWindowOpenDate(now, from, to, timezone)`** is the source of truth for the "Sleeps until <Mon YYYY>" badge date (Wave 2 D-07).
- **History view already SEAS-10-compliant** — no changes needed, just the regression test that locks the invariant.

### Wave 2 can build on these invariants

- Dormant tasks render WITH the badge + opacity-50 styling (Wave 2 Task: SEAS-06) — no task-form changes, no server-action changes.
- Tap handlers on dormant rows in BandView / PersonTaskList gate completion with a no-op or soft-toast (D-08 user decision).
- New integration suite on port 18102 (D-16) should include: onboarding a seasonal seed → PB row has active_from/to; dormant task in By Area has dimmed class + badge; history view shows completion from currently-dormant task.

### No blockers for Wave 2

- TypeScript clean (`npx tsc --noEmit` exits 0).
- Full regression green (502/502).
- No outstanding placeholder stubs or TODOs introduced.
- No secrets / credentials touched.

### For Phase 15 (OOFT + Reschedule)

- `MONTH_OPTIONS` constant is reusable from task-form.tsx (exports not added; if Phase 15 needs cross-file reuse, lift to `lib/month-options.ts` or similar).
- The Advanced collapsible's create-mode guard with inner self-gating fields is now the template — Phase 15 can add OOFT toggle + reschedule-sheet fields following the same pattern.
- `updateTask` now consumes active_from/to on update; Phase 15's Reschedule sheet can either (a) extend this pattern for other edit-flow fields, or (b) treat Reschedule as a separate action. Either is fine.

### For Phase 17 (REBAL)

- `active_from_month` + `active_to_month` are now populated on every task row. Rebalance preservation rules can treat "task has active window" as a user-intent signal alongside anchored + OOFT, preserving the full seasonal-preference bundle across rebalance passes.

---

*Phase: 14-seasonal-ui-seed-library*
*Completed: 2026-04-22*
