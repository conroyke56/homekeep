# Phase 10: Schedule Override Foundation — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 10-schedule-override-foundation
**Areas discussed:** computeNextDue integration shape, Override fetch strategy, Override consumption semantics, Override scope (one active vs many), Override-fetch helper independence
**Note:** Discussion was paused mid-flight when v1.1 scope expanded per LOAD addendum (3 of 4 questions had been answered). Resumed after addendum approval and re-roadmap. The 3 prior recommendations all remained valid (LOAD additions are independent of the override mechanism). One open question + one new question were resolved on resume.

---

## computeNextDue integration shape

| Option | Description | Selected |
|--------|-------------|----------|
| Add `override?` parameter to computeNextDue | computeNextDue(task, lastCompletion, now, override?). One source of truth — every caller goes through computeNextDue and gets the right answer. Optional param means v1.0-shaped calls (no override) return identical results. Cost: ~313 unit-test fixtures need a signature update (mostly mechanical — tests pass `undefined` for the new param). | ✓ |
| Add a separate applyOverride() helper | computeNextDue unchanged. Callers compose: applyOverride(computeNextDue(task, last, now), override). Pro: zero test fixture churn. Con: two sources of truth — if a future caller forgets the helper they get wrong dates silently. v1.2 lurking-bug risk. | |

**User's choice:** Add `override?` parameter to computeNextDue (Recommended)
**Notes:** Single source of truth wins. Test fixture migration is mechanical and one-time. Forward-compatible: Phase 12 will add a second branch (next_due_smoothed) without restructuring.

---

## Override fetch strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-task + batch helpers | Both `getActiveOverride(pb, taskId)` (single) and `getActiveOverridesForHome(pb, homeId): Map<taskId, Override>` (batch). BandView/scheduler use batch — mirrors the existing `latestByTask` Map pattern in lib/coverage.ts. Single-task code uses per-task. Eliminates N+1 risk for households with many tasks. | ✓ |
| Per-task only | Just `getActiveOverride(pb, taskId)`. Simpler API, but BandView and the scheduler iterate 50+ tasks per render — 50 PB roundtrips on the dashboard render is a perf hit users will feel. | |
| PB expand back-relation eager-load | Fetch tasks with `expand: 'schedule_overrides_via_task_id'` in one query. Theoretically zero-roundtrip, but PB back-relation expand syntax is finicky and the codebase has consistently avoided it. | |

**User's choice:** Per-task + batch helpers (Recommended)
**Notes:** Mirrors established `latestByTask` pattern; batch eliminates N+1 for hot paths.

---

## Override consumption semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic write + read-time filter (defense in depth) | In completeTaskAction, batch-write the completion AND set consumed_at on any active override in one transaction. Read-time also filters on (consumed_at IS NULL AND snooze_until > latest_completion). If a write race or out-of-order completion misses the consumption, the read-time filter still does the right thing. Audit trail preserved when the write succeeds. | ✓ |
| Atomic write at completion time only | Same write logic, but read-time trusts consumed_at completely. Simpler reads, but a missed write (PB hiccup, race) leaves a stale active override that re-snoozes the task forever — silent bug. | |
| Lazy at read time only | Never write consumed_at. Reads compute consumption on the fly. Cheapest writes, but you can never answer 'when was this override actually consumed?' — audit trail dead. Also makes 'one active per task' enforcement (next question) harder. | |

**User's choice:** Atomic write + read-time filter (defense in depth) (Recommended)
**Notes:** Defense in depth. Audit trail preserved when the write succeeds; safety net catches the race case.

---

## Override scope — one active per task or many?

(Originally unanswered in the paused discuss; resolved on resume.)

| Option | Description | Selected |
|--------|-------------|----------|
| One active per task, replace on new snooze | When a new snooze is written, atomically set consumed_at = now on any existing active override for the same task. Always 0 or 1 active row per task. Simple semantics ('latest snooze wins'). Race handling: if two members snooze simultaneously, second-write naturally overrides first. Matches Phase 15's UX intent. | ✓ |
| Many active, latest by `created` wins at read | Allow stacking. `getActiveOverride` returns latest unconsumed by `created DESC`. More history rows accumulate but no extra value — 'which one is in effect?' has only one answer the user actually cares about (the latest). | |

**User's choice:** One active per task, replace on new snooze (Recommended)
**Notes:** Matches Phase 15 action-sheet UX (always shows current state). Race semantic is naturally clean: second writer's atomic-replace produces the only unconsumed row.

---

## Override-fetch helper independence (post-addendum follow-up)

(New question added after LOAD addendum to confirm forward-compatibility with Phase 12.)

| Option | Description | Selected |
|--------|-------------|----------|
| No — keep override fetch independent | getActiveOverride / getActiveOverridesForHome return ONLY override rows. computeNextDue's 3-branch read order does the composition: override > smoothed > natural. Keeps each helper single-purpose. Phase 10 ships with NO knowledge of LOAD; Phase 12 adds the smoothed branch to computeNextDue without touching the override helpers. | ✓ |
| Yes — fetch helper returns combined (override + smoothed) date | Fold override and smoothed lookups into one helper that returns the effective date. Saves a Map join in callers, but couples Phase 10 work to LOAD work that doesn't exist yet — the Phase 10 helper would need to ship with a NULL-safe smoothed branch as scaffolding for Phase 12. | |

**User's choice:** No — keep override fetch independent (Recommended)
**Notes:** Single-purpose helpers. Phase 10 ships clean of LOAD; Phase 12 adds the smoothed branch to computeNextDue with no helper-API churn.

---

## Claude's Discretion

(Items where decisions were left to the planner / executor.)

- Specific PB collection field IDs / names beyond the 5-tuple `(id, task_id, snooze_until, consumed_at, created)`. Names obvious; types follow PB conventions.
- Index choices on `schedule_overrides`. Recommendation: `(task_id, consumed_at)` for per-task active fetch and `(task_id)` for batch. Planner validates against query patterns.
- Whether to add `created_by_id` field for audit trail. Recommendation: yes (mirrors completions).
- Helper file organization: `lib/schedule-overrides.ts` (helpers) + `lib/schemas/schedule-override.ts` (zod). Standard split.
- Unit test count beyond the floor (~10-15). Planner's call based on edge cases shaken out during implementation.

## Deferred Ideas

(Captured in CONTEXT.md `<deferred>` section. Summary: per-task "From now on" marker flag → Phase 11 or 15; action-sheet UI → Phase 15; ExtendWindowDialog → Phase 15; LOAD smoothed-date branch → Phase 12; REBAL preservation reads → Phase 17; "Recent reschedules" surface → v1.2+; snooze sanity-check warnings → Phase 15.)
