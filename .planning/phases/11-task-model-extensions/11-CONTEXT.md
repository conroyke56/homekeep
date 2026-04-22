# Phase 11: Task Model Extensions — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (user locked OOFT option (a) explicitly; remaining grey areas resolved with recommended defaults documented inline)

<domain>
## Phase Boundary

The task data model and `computeNextDue` absorb one-off semantics, preferred-weekday constraints (as hard narrowing constraint), and seasonal-window dormancy in a single coherent schema pass. **No UI in this phase.** All scheduler logic unit-tested before any Phase 14/15 surface shows it.

**In scope (13 REQ-IDs):**
- OOFT-01, OOFT-02, OOFT-03, OOFT-05 — one-off task data model + first-due semantics + completion-archives + LOAD contract
- PREF-01, PREF-02, PREF-03, PREF-04 — preferred_days hard narrowing constraint (data + scheduler logic only — no form UI)
- SEAS-01, SEAS-02, SEAS-03, SEAS-04, SEAS-05 — active window data model + dormancy semantics + cross-year wrap + coverage-ring exclusion

**Out of scope (Phases 14, 15, 17):**
- Task form UI changes (OOFT-04, SEAS-06..09) — Phases 14, 15
- Action sheet reschedule (SNZE) — Phase 15
- LOAD smoother itself — Phase 12 (this phase provides the data model + narrowing primitive + OOFT contract only)
- REBAL reads of these fields — Phase 17
- "Active months" form UI and "Sleeps until" badge — Phase 14
- "Recurring vs one-off" form toggle — Phase 15

**Deliverables:**
1. New task fields: `frequency_days` made nullable (OOFT-01), `due_date DATE NULL` (OOFT-03), `preferred_days` (PREF-01), `active_from_month INT? 1..12` + `active_to_month INT? 1..12` (SEAS-01).
2. Extension of `computeNextDue` with three new branches (one-off, seasonal dormancy, seasonal wake-up) composed with Phase 10's override branch.
3. New pure helper `narrowToPreferredDays(candidates, preferredDays, tolerance)` — returns filtered candidate list, does NOT score by load (Phase 12 owns scoring).
4. Completion flow extension: OOFT tasks auto-archive atomically with completion write (extends the batch pattern from Phase 10).
5. Coverage ring extension: dormant tasks excluded from mean (SEAS-05).
6. Unit tests: ~30 new cases covering the one-off / preferred-days / seasonal / cross-year-wrap matrix.
</domain>

<decisions>
## Implementation Decisions

### OOFT first-due semantics — USER-LOCKED 2026-04-22

- **D-01 (OOFT-03 LOCKED): Explicit "do by" date required at creation.** Option (a) from rider 2. User must pick a `due_date` when creating a one-off task. Field: `tasks.due_date DATE NULL` (nullable only because recurring tasks don't use it). Validation: `due_date REQUIRED when frequency_days IS NULL` (enforced at app layer via zod + in migration rule). Simple mental model, no surprising default. No separate "To-do list" surface. Option (b) `creation + 7 days` rejected (arbitrary default, copied CONTEXT debates flagged it as "why 7"). Option (c) separate list rejected (adds a second surface + promotion flow to Phase 14/15).

### OOFT schema shape

- **D-02 (OOFT-01): `tasks.frequency_days` becomes nullable.** Migration: `allowEmpty: true` on the existing NumberField. Existing rows keep their frequency; new one-off rows set it to null. No backfill needed.
- **D-03 (OOFT-01+03): `tasks.due_date DATE NULL` added.** PB DateField, `required: false`, no default, no index (low-read cardinality per household). ISO-8601 UTC storage, rendered in home timezone at UI boundary (Phase 14/15 concern).
- **D-04 (OOFT-02 — auto-archive): Atomic archive in completeTaskAction batch.** When `task.frequency_days IS NULL` (one-off), append `batch.collection('tasks').update(task.id, { archived: true })` to the same `pb.createBatch()` already built by Phase 10's atomic-consumption refactor. One batch write — completion + override consumption (Phase 10) + one-off archive (Phase 11).
- **D-05 (OOFT-03 read behavior): `computeNextDue` for OOFT returns `due_date` if lastCompletion is null, else null.** No cycles — a completed OOFT is archived, so computeNextDue can only see one completion at most. If called with a completed OOFT (race condition between completion write and batch commit): natural fallback to `null`, treat as archived.
- **D-06 (OOFT-05 LOAD contract): OOFT contributes `1` to the household load map on its `due_date`, but its own `next_due_smoothed` is NEVER set.** Phase 12 LOAD reads the contract: for each task with `frequency_days IS NULL`, skip smoothing but include `due_date` in the density map. Phase 11 ships the data shape; Phase 12 consumes it.

### PREF narrowing constraint

- **D-07 (PREF-01 data shape): `tasks.preferred_days TEXT NULL`, enum `'any' | 'weekend' | 'weekday'`.** PB SelectField with those three values + `required: false` (null = 'any' semantically but stored as null to match PB idioms). Migration backfills existing rows: `null` (interpreted as 'any' at read time). Helper function `effectivePreferredDays(task): 'any' | 'weekend' | 'weekday'` abstracts the null-to-'any' projection.
- **D-08 (PREF-02+04 narrowing, not shifting): Hard narrowing constraint, applied BEFORE LOAD scoring, never shifts earlier.** New pure helper `narrowToPreferredDays(candidates: Date[], pref: 'any' | 'weekend' | 'weekday'): Date[]` filters the input list. Returns empty array if no candidates match (caller widens — D-09).
- **D-09 (PREF-03 forward widening): If narrowed candidates is empty, caller (Phase 12 LOAD) re-invokes with tolerance+1, +2, ... up to +6 days.** Phase 11 ships the narrow helper + the contract; Phase 12 owns the retry loop. Unit tests in Phase 11 cover the "empty result" case — Phase 12 tests cover the widening retry.
- **D-10 (PREF integration with computeNextDue in Phase 11): minimal — preferred_days does NOT affect computeNextDue's natural-cycle branch in Phase 11.** Phase 11's computeNextDue treats preferred_days as advisory metadata; the actual narrowing happens in Phase 12's `placeLoadSmoothed` helper BEFORE computing `next_due_smoothed`. Rationale: Phase 11 ships only the data model + helper; Phase 12 wires it into the scheduler. This keeps Phase 11 purely schema+primitives.

### SEAS seasonal-window dormancy

- **D-11 (SEAS-01 data shape): Two integer fields `active_from_month` + `active_to_month`, both `1..12`, both NULL = year-round.** PB NumberField with `min: 1, max: 12, onlyInt: true, required: false`. Null-or-both-null = year-round active (pre-v1.1 default behavior preserved for all existing rows).
- **D-12 (SEAS-02+03 dormancy + wake-up in computeNextDue): New branches in computeNextDue.**
  - Branch order (final after Phase 11): override → (Phase 12 smoothed) → seasonal-dormant → seasonal-wakeup → OOFT → anchored/cycle-natural.
  - Seasonal-dormant: if `now` is outside the active window AND task has an active window AND lastCompletion exists → return `null` (task invisible to scheduler, coverage, main views).
  - Seasonal-wakeup: if task has active window AND no lastCompletion (first cycle) OR last completion was in a prior season → next_due = start-of-window-date in home timezone, at midnight. "Start-of-window" means the first day of `active_from_month` in the next applicable year.
- **D-13 (SEAS-04 cross-year wrap): Window like `active_from=10, active_to=3` means Oct-Mar (Oct, Nov, Dec, Jan, Feb, Mar = 6 months active, Apr-Sep = 6 months dormant).** Helper `isInActiveWindow(nowMonth, from, to): boolean` handles wrap: if `from <= to`, it's a non-wrap window (e.g. 4-9 = Apr-Sep); if `from > to`, it's a wrap window (months >= from OR months <= to).
- **D-14 (SEAS-05 coverage-ring exclusion): `computeCoverage` filters out dormant tasks before computing the mean** — identical treatment to archived tasks. Dormancy check uses `isInActiveWindow(now.getMonth()+1, task.active_from_month, task.active_to_month)` when window fields are non-null. Excluded tasks still appear in history (SEAS-10 concern, Phase 14) but don't drag the coverage number.
- **D-15 (SEAS wake-up + Phase 12 LOAD interplay): LOAD-07 contract surfaced.** When a seasonal task wakes up, Phase 12's smoother anchors it to start-of-window (skipping smoothing for the wake-up cycle only). From the second cycle onward, LOAD runs normally. Phase 11 doesn't implement this — it just documents the contract so Phase 12's planner sees it.

### Integration with Phase 10 override branch

- **D-16 (Branch order in computeNextDue after Phase 11):** Override (Phase 10) → Seasonal-dormant → Seasonal-wakeup → OOFT → Anchored/cycle-natural. The one inserted between override and OOFT is seasonal; LOAD's smoothed branch lands in Phase 12 between override and seasonal.
- **D-17 (D-10 Phase 10 read-time filter preserved):** Override branch still runs FIRST. If a dormant task has an active override (user snoozed while dormant — edge case, Phase 15 UI will warn but Phase 11 data layer accepts), the override wins. Integration test covers.

### Helper API

- **D-18 (pure helpers in `lib/task-scheduling.ts` — extending, not new file):** `narrowToPreferredDays`, `isInActiveWindow`, `nextWindowOpenDate` added alongside existing `computeNextDue`. Keeps scheduling logic co-located for Phase 12 LOAD's consumption.
- **D-19 (No new helper file for OOFT):** OOFT logic is a branch inside `computeNextDue`, not a standalone helper. Rationale: OOFT shape reads `task.due_date` + completion state — no reusable primitive to extract.
- **D-20 (`isInActiveWindow(monthOneIndexed, from?, to?)` signature — explicit parameters, no Date):** Pure function, testable without clock mocking. Caller extracts `now.getMonth()+1` or the month-of-a-candidate-date in the home timezone.

### Validation

- **D-21 (Zod schema `lib/schemas/task.ts` extended — NOT split):** Existing task schema gains the new fields with refinements: `due_date REQUIRED when frequency_days IS NULL` (zod `.refine()` with path); `active_from_month` and `active_to_month` must both be set or both null (paired); if set, both in 1..12 range.
- **D-22 (No past-date check on OOFT `due_date` at creation):** Distinct from Phase 10's snooze past-date rejection. A user creating a one-off task with a past due date is legitimate ("I forgot this, do it ASAP"). The task appears overdue in the red band immediately. Validation stays at "required when one-off" only.

### Migration

- **D-23 (Additive migration `1745280001_task_extensions.js` — single file, all Phase 11 fields):** Timestamp +1 from Phase 10's `1745280000_schedule_overrides.js`. Additive — no existing rows touched. Post-construction `.fields.add()` pattern (PB 0.37.1 silent-drop workaround from 01-02 decision), reusing Phase 10's pattern exactly. Down migration removes the four new fields.
- **D-24 (No data backfill needed):** Existing rows default to: frequency_days = current value (kept), due_date = null, preferred_days = null, active_from_month = null, active_to_month = null. All null-or-absent fields read as "year-round recurring task" — byte-identical v1.0 behavior preserved.

### Test scope

- **D-25 (~30 new unit tests):**
  - 8 OOFT cases: create → read shows due_date; complete → archived + not in scheduler; computeNextDue returns due_date / null; zod rejects OOFT without due_date; zod accepts OOFT with past due_date.
  - 8 PREF cases: narrow to weekend (keeps Sat/Sun, drops M-F), narrow to weekday (keeps M-F, drops Sat/Sun), narrow to any (identity), narrow with empty input (empty), narrow with all-eliminated (empty for Phase 12 to widen), null pref defaults to any, each direction for weekend/weekday boundary.
  - 10 SEAS cases: in-window (active), out-of-window (dormant → null), window wake-up (first cycle from null completion), cross-year wrap (Oct-Mar, test each month), coverage excludes dormant, isInActiveWindow unit tests (non-wrap + wrap + boundary months).
  - 4 integration cases in `tests/unit/task-extensions-integration.test.ts`: disposable PB on port **18099** (after 18098 from Phase 10). Covers: migration creates all 4 fields; full one-off lifecycle (create → complete → archived atomically); full seasonal lifecycle (dormant during off-season, wakes at start-of-window); override (Phase 10) composes correctly with dormant seasonal task.
- **D-26 (D-14 Phase 10 regression gate preserved):** All 355 existing tests (311 baseline + 44 from Phase 10) pass without assertion changes. Mechanical churn: zero, because all new task fields are additive and default to the existing v1.0 behavior path.

### Test port allocation

- **D-27 (Port 18099 claimed):** Next free after Phase 10's 18098. Allocation log now 18090..18099.

### Claude's Discretion

- Exact zod refinement message strings (plan-time detail).
- Whether to split test file (PREF helper tests vs SEAS helper tests) — recommend single file `tests/unit/task-extensions.test.ts` + integration file on 18099.
- Field ordering inside migration file (order doesn't matter to PB — recommend alphabetical for diff clarity).
- Whether to export `effectivePreferredDays` from `lib/task-scheduling.ts` or keep internal — recommend export (Phase 12 will need it).
- Whether `isInActiveWindow` takes `month: number (1..12)` or `month: number (0..11)` — recommend 1..12 to match the PB stored shape; document in the helper docstring.
</decisions>

<canonical_refs>
## Canonical References

### Audit & scope
- `.planning/v1.1/audit.md` §"Q2" — original OOFT + PREF + SEAS cross-cutting decisions (preferred_days as narrowing, not shifting; seasonal two-task pattern deferred to Phase 14 seed library).
- `.planning/v1.1/audit-addendum-load.md` §"Rider 2" — OOFT three-option debate + user lean (a); §"10. LOAD branch order" — final computeNextDue branch order including Phase 11's seasonal branches.
- `.planning/ROADMAP.md` §"Phase 11" — success criteria + pre-planning gate note (rider 2 OOFT locking).

### Migration exemplars
- `pocketbase/pb_migrations/1745280000_schedule_overrides.js` — Phase 10's additive-migration pattern; post-construction `.fields.add()` workaround; down-migration idempotence.
- `pocketbase/pb_migrations/1714953605_users_notification_prefs.js` — additive fields on EXISTING collection pattern (Phase 11 adds 4 fields to `tasks`, NOT a new collection).

### Code to extend
- `lib/task-scheduling.ts:50-130` (Phase 10-extended) — `computeNextDue`; Phase 11 adds seasonal-dormant, seasonal-wakeup, OOFT branches AFTER override (Phase 10) and BEFORE anchored/cycle-natural. See D-16 for final branch order.
- `lib/coverage.ts:35-61` — `computeCoverage`; Phase 11 extends to filter dormant tasks from mean (SEAS-05).
- `lib/schemas/task.ts` — existing zod schema; Phase 11 extends with 4 new field refinements (D-21).
- `lib/actions/completions.ts` — Phase 10 batch pattern; Phase 11 appends `tasks.update(id, { archived: true })` to the batch when OOFT completes (D-04).

### Tests to extend (mechanical)
- `tests/unit/task-scheduling.test.ts` — existing fixtures pass `undefined` override; Phase 11 adds ~15 cases for OOFT + SEAS branches. preferred_days unit tests go in a new file `tests/unit/task-extensions.test.ts` (D-25).
- `tests/unit/coverage.test.ts` — Phase 10 added override cases; Phase 11 adds dormant-exclusion case (SEAS-05).

### Forward contracts
- Phase 12 LOAD consumes: `effectivePreferredDays`, `narrowToPreferredDays`, `isInActiveWindow`, `tasks.due_date` (OOFT density contribution).
- Phase 14 Seasonal UI consumes: `active_from_month`, `active_to_month`, `isInActiveWindow` for the "Sleeps until" badge.
- Phase 15 One-Off UI consumes: `tasks.due_date`, `tasks.frequency_days = null` semantic.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 10 `pb.createBatch()` pattern in `lib/actions/completions.ts`** — Phase 11 appends one more op (tasks.update archive) for OOFT auto-archive (D-04). Same error semantics, same rollback.
- **Phase 10 `computeNextDue` branch-order precedent** — override branch was inserted AFTER archived + frequency validation, BEFORE cycle branch. Phase 11 follows the same pattern for seasonal + OOFT.
- **Existing `tasks.archived` field + filter** — already in use by coverage ring and scheduler; Phase 11's OOFT auto-archive reuses this field, no new flag needed.
- **Timezone handling via home.timezone + formatInTimeZone** — established in Phase 5+; Phase 11's seasonal wake-up uses `new Date()` converted to home tz before extracting month. Helper signature decision: `isInActiveWindow` takes pre-extracted month integer to keep tz handling at the caller.

### Established Patterns
- Pure helpers in `lib/`, validation via zod in `lib/schemas/`, migration via timestamped files in `pocketbase/pb_migrations/`.
- Port allocation chain: 18090, 18091 (02-01), 18092, 18093 (04-01), 18094 (04-02), 18095 (05-01), 18096 (06-01), 18097 (06-02), 18098 (Phase 10), **18099 claimed for Phase 11**.
- All dates stored as ISO-8601 UTC; Phase 11 adds no new timezone surface (month-only fields are home-timezone-agnostic at rest; tz applied at read-time in computeNextDue).

### Integration Points
- `computeNextDue` signature stays `(task, lastCompletion, now, override?)` — Phase 11 adds branches internally, no new params. Phase 12 will add a 5th param for `smoothed?` (forward-compat).
- `computeCoverage` signature gains nothing — dormant filter checks `task.active_from_month` and `task.active_to_month` directly from the passed-in task rows.
- `completeTaskAction` batch gains one conditional op (`if (task.frequency_days == null) batch.tasks.update({archived: true})`). Error semantics preserved.
</code_context>

<specifics>
## Specific Ideas

### Threat model deltas
- **T-11-01 — OOFT without due_date**: User crafts a task create request with `frequency_days = null, due_date = null`. Mitigated by D-21 zod refine + migration-level `required: false` (PB doesn't enforce cross-field; app layer must). Integration test asserts rejection.
- **T-11-02 — Seasonal task with corrupt window (from=13, to=0)**: Zod schema caps at 1..12; migration NumberField `min: 1, max: 12` provides defense-in-depth.
- **T-11-03 — OOFT race: complete before archive-batch commits**: Phase 10 batch atomicity handles this — the whole batch rolls back on any failure. Same guarantee extends to Phase 11's added archive op.
- **T-11-04 — Cross-year wrap month-boundary bug**: Most common mistake is off-by-one month comparison. Mitigated by D-13 unit tests covering EVERY month of a wrap window (Oct-Mar case: test Apr, May, Jun, Jul, Aug, Sep as dormant; Oct, Nov, Dec, Jan, Feb, Mar as active). 12 unit tests in the SEAS matrix.

### Performance notes
- `isInActiveWindow` is O(1) month comparison; coverage ring adds one branch per task iteration (negligible vs existing work).
- No new PB queries — all Phase 11 work is data-model + pure-helper; existing task fetches now also carry the 4 new fields (fields: '*' is already used in callers).
- OOFT archive-batch adds one write op to an already-atomic batch — no extra roundtrip.
</specifics>

<deferred>
## Deferred Ideas

### Out of Phase 11 scope
- **OOFT-04 (Form distinguishes recurring vs one-off)**: Phase 15 (One-Off & Reschedule UI).
- **SEAS-06 (Dormant tasks render dimmed with "Sleeps until" badge)**: Phase 14.
- **SEAS-07 (Task form gains "Active months" section)**: Phase 14.
- **SEAS-08 (Form warns when anchored task falls outside window)**: Phase 14.
- **SEAS-09 (Seed library extends with 2 seasonal task pairs)**: Phase 14.
- **SEAS-10 (History view always shows completions regardless of season)**: Phase 14.
- **PREF-* UI**: Phase 14 or 15 (the preferred_days dropdown on the task form — Phase 11 is data layer only).
- **LOAD's consumption of PREF + OOFT + SEAS contracts**: Phase 12.
- **SPEC.md documentation of the 4 new fields**: Phase 18 (DOCS-05).

### v1.2+ candidates (not surfaced, referenced for context)
- OOFT "To-do" list separate surface (option (c) from rider 2 debate) — rejected for v1.1; may re-emerge if user feedback shows explicit-date friction.
- Per-day-of-week granularity on preferred_days (beyond weekend/weekday) — rejected for v1.1 (keep simple).
- Multiple active windows per task (e.g., a task active in Mar-Apr AND Oct-Nov) — rejected for v1.1 (cover via two tasks, consistent with v1.1 "two-task-per-season" pattern).
</deferred>

---

*Phase: 11-task-model-extensions*
*Context gathered: 2026-04-22 via autonomous smart-discuss (OOFT option (a) user-locked; remaining grey areas resolved with recommended defaults per inline rationale)*
