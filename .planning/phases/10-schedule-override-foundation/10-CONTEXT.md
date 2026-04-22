# Phase 10: Schedule Override Foundation — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A durable, history-preserving schedule-override primitive in the data layer, consulted by every consumer of `computeNextDue` (coverage ring, scheduler, horizon strip, band classification, completion flow), so later UI phases (15 reschedule action sheet, 17 rebalance) can snooze tasks without surprising the scheduler or coverage ring.

**No UI in this phase.** No user-visible feature. The deliverable is a foundation: data model, helpers, and the signature extension to `computeNextDue`. UI surfaces ride on top in Phases 15 and 17.

**In scope:**
- New `schedule_overrides` PocketBase collection with member-gated rules.
- Pure helpers in `lib/schedule-overrides.ts`: per-task fetch, batch fetch (Map), atomic consumption write.
- `computeNextDue` signature extension (additive `override?` parameter), threaded through all callers.
- Atomic consumption in `completeTaskAction` (override marked consumed in same write batch as completion).
- Unit tests for the new helpers; integration tests against disposable PocketBase.
- All v1.0 callers continue to work without behavioral change (override defaults to undefined).

**Out of scope (Phase 15+):**
- Action-sheet UI for triggering snoozes.
- ExtendWindowDialog for cross-window snoozes (depends on SEAS in Phase 11).
- "From now on" mutation of `tasks.anchor_date` / `tasks.next_due_smoothed` (Phase 15).
- LOAD smoothed-date branch (Phase 12 adds this; Phase 10 stays unaware).
- Rebalance preservation logic (Phase 17 reads override rows but doesn't define new behavior).
</domain>

<decisions>
## Implementation Decisions

### Data model

- **D-01: New `schedule_overrides` PocketBase collection.** Shape: `(id, task_id, snooze_until, consumed_at, created)`. Per-task override storage; one row per snooze event. Decision over `snoozed_until` + `snooze_consumed_at` fields on the `tasks` table — preserves snooze history and supports the v1.2+ "Recent reschedules" surface without refactor (locked in v1.1 audit Q1, confirmed in scope summary).
- **D-02: One active override per task.** When a new snooze is written, atomically set `consumed_at = now` on any existing active override for the same task in the same write batch. Always 0 or 1 active row per task. Race semantic: second writer wins (the explicit "consume the predecessor" pattern means simultaneous snoozes resolve naturally — last-writer's row is the only unconsumed row).

### Schema rules

- **D-03: Member-gated rules mirroring `tasks` collection.** Use the double-hop relation `@request.auth.home_members_via_user_id.home_id ?= task_id.home_id` for `listRule` / `viewRule` / `createRule` / `updateRule` / `deleteRule`. Anyone in the household can snooze any task. Mirrors the established pattern from `pocketbase/pb_migrations/1714867200_completions.js`.
- **D-04: createRule additionally enforces auth context.** No body-check for `created_by` since the override doesn't carry an author field — `task_id` membership is sufficient. (Different from completions, which also constrains `completed_by_id = @request.auth.id`.)
- **D-05: `updateRule` allows member writes** (needed for `consumed_at` updates from `completeTaskAction` and from D-02 atomic-replace). `deleteRule` member-allowed too — household members may want to "undo" a snooze before its consumption (future Phase 15 affordance).

### `computeNextDue` integration

- **D-06: Add `override?: Override` parameter to `computeNextDue`.** Signature becomes `computeNextDue(task, lastCompletion, now, override?)`. Optional — calls without `override` get v1.0-identical behavior. Single source of truth for date computation; every caller goes through `computeNextDue` and gets the right answer. Cost: ~313 unit-test fixtures need a signature update (most pass `undefined` for the new param; mechanical change).
- **D-07: Phase 12 will add a second branch.** When LOAD ships, `computeNextDue` becomes a 3-branch read order: `override` → `next_due_smoothed` → natural. Phase 10's signature is forward-compatible — Phase 12 just adds the second branch without restructuring. Phase 10 ships ONLY the override branch + natural fallback.

### Helper API

- **D-08: Two fetch helpers in `lib/schedule-overrides.ts`.**
  - `getActiveOverride(pb, taskId): Promise<Override | null>` — single-task fetch for one-off paths (TaskDetailSheet, individual server actions).
  - `getActiveOverridesForHome(pb, homeId): Promise<Map<string, Override>>` — batch fetch returning `Map<taskId, Override>`. Used by aggregate consumers (BandView render, scheduler iteration). Mirrors the existing `latestByTask: Map<string, CompletionRecord>` pattern in `lib/coverage.ts`.
  - Eliminates N+1 query risk for households with 50+ tasks (avoiding the dashboard render perf hit of 50 PB roundtrips).
- **D-09: Helpers stay independent of `next_due_smoothed`.** Phase 10's helpers return ONLY override rows. Composition of override + smoothed + natural lives in `computeNextDue`. Keeps each helper single-purpose and avoids coupling Phase 10 work to LOAD work that doesn't exist yet.

### Consumption semantics

- **D-10: Atomic write at completion + read-time filter (defense in depth).**
  - In `completeTaskAction`: when a completion is written, also set `consumed_at = now` on any active override for that task in the same PB batch. Atomic per the existing batch-completion pattern.
  - At read time: `getActiveOverride` filters on `(consumed_at IS NULL AND snooze_until > <latest_completion_ts>)`. If a write race or out-of-order completion misses the consumption, the read-time filter still does the right thing.
  - Audit trail preserved when the write succeeds (you can answer "when was this override actually consumed?").

### Validation

- **D-11: Past-date snooze rejected at app layer.** Zod refine on the snooze write schema requires `snooze_until > now` (with a small fudge factor — say 30 seconds — to absorb client clock skew). PocketBase allows the row, but the app's write actions reject. Past-date snoozes are nonsensical; the action sheet (Phase 15) will use a date picker that disallows past dates anyway.
- **D-12: Far-future snooze allowed but unlimited.** No upper bound on `snooze_until` in v1.1. A user snoozing 50 years out is allowed — they'll forget about the task, the algorithm doesn't care. Phase 15 may add a sanity-check warning ("Snooze for 5 years? Are you sure?") but that's UI, not data layer.

### Test scope

- **D-13: Unit + integration coverage.**
  - Unit tests in `tests/unit/schedule-overrides.test.ts`: pure helpers (override application logic in `computeNextDue`, consumption boundary cases — exact-tie timestamps, expired-but-unconsumed, consumed-but-not-yet-replaced).
  - Integration test in `tests/integration/schedule-overrides.test.ts`: against disposable PB. Uses port **18098** (next free after 18097 from `06-02`).
  - Coverage targets: write override → read override → write completion → verify `consumed_at` set → verify `getActiveOverride` returns null. Plus rules enforcement (cross-home access denied, member access allowed).
- **D-14: All 311 existing unit + 23 E2E tests pass.** Test fixture migration is mechanical: add `undefined` as the 4th argument to existing `computeNextDue` calls. No behavioral test changes for v1.0 paths.

### Migration

- **D-15: Additive migration following 1714953605 pattern.** Post-construction `fields.add()` after `findCollectionByNameOrId` (PB 0.37.1 silent-drop bug workaround). New collection only — no existing collection touched. v1.0 data unaffected. Down migration removes the collection entirely.

### Phase 12 forward-compatibility

- **D-16: SNZE-07 marker flag deferred.** SNZE-07 in REQUIREMENTS.md ("From now on" mutates `tasks.anchor_date` or `tasks.next_due_smoothed` with marker flag) requires a per-task flag detectable by REBAL preservation (Phase 17). The marker FIELD design is Phase 11 work (task model extensions) or Phase 15 work (action sheet implementation). Phase 10 ships only the `schedule_overrides` collection itself; the marker field on `tasks` is NOT part of Phase 10.

### Claude's Discretion

- Specific PB collection field IDs / names beyond the 5-tuple (id, task_id, snooze_until, consumed_at, created). Names are obvious; types follow PB conventions (RelationField, DateField, AutodateField).
- Index choices on `schedule_overrides` (recommend at least `(task_id, consumed_at)` for the per-task active fetch and `(task_id)` for batch). Planner can validate against query patterns.
- Whether to add a `created_by_id` field for audit trail. Recommendation: yes, mirrors completions; cheap and useful for debugging "who snoozed this".
- Helper file organization: `lib/schedule-overrides.ts` (helpers) + `lib/schemas/schedule-override.ts` (zod). Standard split.
- Unit test count beyond the floor: planner's call based on how many edge cases shake out during implementation.

### Folded Todos

(None — no relevant todos in backlog.)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit & scope
- `.planning/v1.1/audit.md` §"Q1 — Manual overrides vs. the scheduler" — original cross-cutting decisions on override storage strategy (collection vs. fields), consumption semantics, snooze-this-cycle vs. permanent-shift defaults
- `.planning/v1.1/audit-addendum-load.md` §"8. Phase 10 discuss-phase resumption notes" — explicit forward-compatibility statement: Phase 10 ships override branch only; LOAD branch lands in Phase 12 without restructuring

### Migration exemplars
- `pocketbase/pb_migrations/1714867200_completions.js` — exemplar for double-hop ownership rules (`task_id.home_id...`) and `updateRule = null` / `deleteRule = null` patterns. Phase 10 follows this rule shape but allows updates/deletes for member-driven snooze management.
- `pocketbase/pb_migrations/1714953605_users_notification_prefs.js` — exemplar for additive field migration with post-construction `.add()` pattern (PB 0.37.1 silent-drop bug workaround). Phase 10 creates a new collection; this file shows the add-then-save pattern that applies to new collection creation too.

### Code to extend
- `lib/task-scheduling.ts:50-83` — `computeNextDue`. Pure function, parameterised on `now: Date`. Phase 10 adds optional 4th `override?` parameter. v1.0 callers without override get identical behavior.
- `lib/coverage.ts:35-61` — `computeCoverage`. Uses `latestByTask: Map<string, CompletionRecord>` pattern. Mirror this pattern for `getActiveOverridesForHome` returning `Map<taskId, Override>`.
- `lib/scheduler.ts:188-257` — `processOverdueNotifications`. Iterates non-archived tasks per home; needs the batch override fetch added before the loop.
- `lib/notifications.ts:51-76` — `buildOverdueRefCycle(taskId, nextDueIso)`. Already keys on the `nextDueIso` string. Snooze automatically gets a new `nextDueIso` → new `ref_cycle` → one notification at the new date for free. No notification code changes needed in Phase 10.
- `lib/actions/completions.ts` — `completeTaskAction`. Phase 10 extends to write `consumed_at` on any active override in the same PB batch as the completion write.

### Schema validation
- `lib/schemas/completion.ts` — exemplar for zod schema with `path: ['field']` refinements for form-field error routing.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `latestByTask: Map<string, CompletionRecord>` pattern (`lib/coverage.ts:35-61`) — direct template for `Map<taskId, Override>` return shape on the batch helper.
- Existing batch-completion atomic write in `completeTaskAction` (`lib/actions/completions.ts`) — extend this batch to include the `consumed_at` update on any active override.
- Existing `pb.filter('a = {:x}', { x })` parameterized filter pattern — use for all override fetches (T-04-01-08 injection mitigation).
- Disposable PB integration test pattern (`tests/integration/*.test.ts`) — port allocation chain reaches `18097` (06-02 scheduler test); Phase 10 claims **18098**.

### Established Patterns
- Pure helpers in `lib/`, integration via server actions in `lib/actions/`. Phase 10 adds `lib/schedule-overrides.ts` (helpers) + extends `lib/actions/completions.ts` (consumption).
- Zod schemas in `lib/schemas/` with `.refine()` for cross-field validation. Phase 10 adds `lib/schemas/schedule-override.ts`.
- ISO 8601 UTC for all stored dates; rendering to local timezone via `formatInTimeZone` only at the UI boundary. Override storage follows: `snooze_until` and `consumed_at` are PB DateField, ISO 8601 UTC.
- Migration files timestamp-prefixed in `pocketbase/pb_migrations/`. Next available timestamp is in 2026 — pick a UTC-based timestamp matching the addendum date (`2026-04-22`).
- `computeNextDue` is pure and accepts `now: Date` as a parameter. Phase 10 preserves this contract for the override branch — the helper at the call site fetches the override; the function itself stays pure given (task, lastCompletion, now, override).

### Integration Points
- `lib/task-scheduling.ts` — signature extension (D-06).
- `lib/coverage.ts` — caller update: fetch overrides for home, pass per-task override into `computeNextDue`.
- `lib/scheduler.ts` — caller update: same pattern as coverage; batch fetch before the iteration loop.
- `lib/actions/completions.ts` — extend the batch to write `consumed_at` (D-10).
- Server-component pages computing `next_due` for individual tasks (e.g. detail pages) — minor caller update.
- Test fixtures across `tests/unit/` — mechanical signature update for `computeNextDue` calls.
</code_context>

<specifics>
## Specific Ideas

### Threat model deltas
- **T-10-01 — Cross-home snooze attack**: User X snoozes a task in home Y where they're not a member. Mitigated by member-gated `createRule` (D-03).
- **T-10-02 — Simultaneous snooze race**: Two members of the same household snooze the same task within milliseconds. Mitigated by D-02 atomic-replace semantic — second writer's `consumed_at` update on the first row + new row insert wins. Both writes complete; reads see only the second row as active.
- **T-10-03 — Past-date snooze nonsense**: User submits `snooze_until` in the past. Mitigated by D-11 zod refine. PB row never created.
- **T-10-04 — Consumed-row resurrection**: A consumed override's `consumed_at` is set back to NULL via direct PB write (e.g. via Admin UI or future API). Read-time filter on `snooze_until > latest_completion` (D-10) ensures the override only re-applies if the snooze date is still meaningful relative to the latest completion. If both `consumed_at = NULL` AND `snooze_until > latest_completion`, this is a legitimate "I undid the consumption", and the override re-applies. Acceptable.

### Performance notes
- Batch fetch query: `pb.collection('schedule_overrides').getList(1, 200, { filter: pb.filter('task_id.home_id = {:hid} && consumed_at = null', { hid: homeId }) })`. Single PB roundtrip per home dashboard render.
- Per-task fetch: `pb.collection('schedule_overrides').getFirstListItem(pb.filter('task_id = {:tid} && consumed_at = null', { tid: taskId }), { sort: '-created' })`. Single PB roundtrip per individual task path.
- Write batch in `completeTaskAction`: existing batch already writes the completion atomically. Extending to also update the override is one additional batch operation, no extra roundtrip.

### Snooze "From now on" forward note
- SNZE-07 ("From now on" mutates `tasks.anchor_date` for anchored mode OR `tasks.next_due_smoothed` with a marker flag for cycle mode) is Phase 15 (action sheet UI) work. Phase 10 does NOT add the marker flag field. The marker field design lives in Phase 11 (task model extensions) or Phase 15 (UI action sheet implementation). Phase 10 ONLY ships the `schedule_overrides` collection.
</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
None — no relevant pending todos.

### Out of Phase 10 scope
- **Per-task "From now on" marker flag**: Phase 11 or Phase 15. Required for REBAL (Phase 17) preservation logic but not part of override foundation.
- **Action-sheet UI surface**: Phase 15.
- **ExtendWindowDialog for cross-window snoozes**: Phase 15 (depends on SEAS data from Phase 11).
- **LOAD smoothed-date branch in computeNextDue**: Phase 12 — Phase 10's signature extension is forward-compatible; Phase 12 adds the second branch.
- **REBAL preservation reads on schedule_overrides**: Phase 17 — reads only, no schema additions.
- **"Recent reschedules" surface**: v1.2+ (parked in REQUIREMENTS.md v1.2+ Candidates as V2-05).
- **Snooze sanity-check warnings (e.g. "Snooze 5 years?")**: Phase 15 UI concern; Phase 10 data layer accepts any future date.
</deferred>

---

*Phase: 10-schedule-override-foundation*
*Context gathered: 2026-04-22*
