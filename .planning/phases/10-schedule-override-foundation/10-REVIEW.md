---
phase: 10-schedule-override-foundation
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - app/(app)/h/[homeId]/by-area/page.tsx
  - app/(app)/h/[homeId]/page.tsx
  - app/(app)/h/[homeId]/person/page.tsx
  - components/band-view.tsx
  - components/person-task-list.tsx
  - components/task-list.tsx
  - lib/actions/completions.ts
  - lib/area-celebration.ts
  - lib/area-coverage.ts
  - lib/band-classification.ts
  - lib/coverage.ts
  - lib/schedule-overrides.ts
  - lib/scheduler.ts
  - lib/schemas/schedule-override.ts
  - lib/task-scheduling.ts
  - lib/weekly-summary.ts
  - pocketbase/pb_migrations/1745280000_schedule_overrides.js
  - tests/unit/area-celebration.test.ts
  - tests/unit/area-coverage.test.ts
  - tests/unit/band-classification.test.ts
  - tests/unit/coverage.test.ts
  - tests/unit/schedule-overrides-integration.test.ts
  - tests/unit/schedule-overrides.test.ts
  - tests/unit/scheduler.test.ts
  - tests/unit/task-scheduling.test.ts
  - tests/unit/weekly-summary.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-22
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 10 (schedule-override foundation) ships a clean, well-documented data-layer primitive. The core Phase 10 additions — `lib/schedule-overrides.ts`, `lib/schemas/schedule-override.ts`, the `computeNextDue` override branch, the atomic consumption batch in `completeTaskAction`, and the `schedule_overrides` migration — all land correctly against the focus criteria called out by the orchestrator:

- **PB filter parameterization in new Phase 10 code:** both helpers use `pb.filter('x = {:y}', {y})`; no string concatenation in the new override fetch paths (D-03 / T-04-01-08 mitigation intact).
- **Double-hop D-03 rule:** migration line 55 correctly uses the `?=` any-match operator on `home_members_via_user_id.home_id ?= task_id.home_id`, mirroring the `1714953602_update_rules_multi_member.js` exemplar. Integration Scenario 2 proves cross-home rejection (T-10-01).
- **Zod past-date refine:** 30-second clock-skew fudge is implemented correctly; test N verifies the +30s boundary accepts and test J verifies the -5min case rejects (T-10-03 mitigation).
- **Atomic batch in `completeTaskAction`:** `pb.createBatch()` bundles the completion write and `consumed_at` flip; PB rolls both back on any failure (T-10-02 mitigation). Integration Scenario 9 verifies end-to-end.
- **D-10 read-time filter:** `computeNextDue` checks `snoozeUntil > lastCompletedAt` defensively; `!override.consumed_at` covers `null / '' / undefined` per A2.
- **RSC boundary serialization:** dashboard and person pages correctly `Object.fromEntries(map)` on the server and `new Map(Object.entries(record))` on the client.

No critical issues. One warning about a pre-existing string-concat filter in `completeTaskAction` that now sits inside a file Phase 10 modified (so is technically in scope per the focus area, even though the bug predates this phase). Four info-level items capture redundant work, imprecise commentary, and latent defense-in-depth concerns that would make good todos for Phases 15/17 or a follow-up cleanup pass.

All 355/355 tests pass and every listed focus area has functional integration coverage.

## Warnings

### WR-01: Pre-existing string-concat filter still present in Phase 10-modified `completeTaskAction`

**File:** `lib/actions/completions.ts:138` and `lib/actions/completions.ts:185`
**Issue:** The Phase 10 focus area explicitly calls out "all filters must use `pb.filter('x = {:y}', {y})` — no string concat." Two filters in this file still use template-literal concatenation:

```ts
// Line 138 — completion fetch
.getFirstListItem(`task_id = "${taskId}"`, { ... });

// Line 185 — tasks-in-area fetch
filter: `home_id = "${homeId}" && area_id = "${areaId}" && archived = false`,
```

Both predate Phase 10 (`git show 7c32324` confirms they existed before this phase's first commit `f398f0f`), but Phase 10 added new imports and rewrote the batch flow in the same file without bringing these callsites up to standard. In the current caller chain `taskId` comes from a server-action argument (typed `string`) and `homeId`/`areaId` come from a PB `tasks.getOne` result — not raw user input — so direct injection risk is low. The concern is *defense-in-depth and consistency*: Phase 10 just finished proving (Scenario 6 + SUMMARY §A3) that PB 0.37.1 accepts parameterized filters; leaving these as concat makes the "never concat" rule a soft convention rather than an invariant. Future callers that forget to sanitize a new argument will copy the pattern they see.

**Fix:** Convert to parameterized form to match the Phase 10 helpers:

```ts
// Line 138
.getFirstListItem(
  pb.filter('task_id = {:tid}', { tid: taskId }),
  { sort: '-completed_at', fields: 'id,completed_at' },
);

// Line 185
filter: pb.filter(
  'home_id = {:hid} && area_id = {:aid} && archived = false',
  { hid: homeId, aid: areaId },
),
```

Out of strict Phase 10 scope (would enlarge the diff beyond the stated deliverable), but worth a follow-up ticket — `lib/scheduler.ts:166/210/313/319` and `lib/actions/seed.ts:66` / `lib/actions/areas.ts:82` share the same pattern and should migrate together.

## Info

### IN-01: Redundant per-task override fetch in `completeTaskAction`

**File:** `lib/actions/completions.ts:200-201`
**Issue:** Both helpers are called in sequence:

```ts
const activeOverride = await getActiveOverride(pb, taskId);
const overridesByTask = await getActiveOverridesForHome(pb, homeId);
```

The home-wide batch already contains the per-task row (if any). Only `activeOverride.id` is used downstream (line 220 — the batch `consumed_at` update), which can be retrieved from `overridesByTask.get(taskId)`. The extra `getFirstListItem` roundtrip costs one PB call per completion and adds nothing over the batch result.

**Fix:**
```ts
const overridesByTask = await getActiveOverridesForHome(pb, homeId);
const activeOverride = overridesByTask.get(taskId) ?? null;
```

Performance is out of v1 review scope, but this is a correctness-adjacent simplification — fewer network calls means fewer opportunities for the two reads to diverge under a concurrent snooze race (T-10-02 sibling). Plan 10-03 deliberately separated the reads to prove A3 (cross-table parameterized filter) works; now that's confirmed, collapsing is safe.

### IN-02: Imprecise comment about D-10 guard in `completeTaskAction` celebration block

**File:** `lib/actions/completions.ts:254-263`
**Issue:** The comment explains why passing the pre-consumption `overridesByTask` Map to `detectAreaCelebration` is safe:

> `detectAreaCelebration` uses `computeAreaCoverage` which calls `computeNextDue` which applies the D-10 read-time filter — since `latestAfter` now has the fresh completion at snooze_until's threshold, D-10 stales the entry correctly.

The phrase "at snooze_until's threshold" implies `lastCompletion.completed_at === snooze_until`, but that's generally not true — `snooze_until` is some arbitrary future date chosen by the snoozer, not equal to `now`. The actual reasoning is: for the just-completed task, the override's `snooze_until` is still in the future (`> now`) AND `lastCompletedAt = now`, so D-10's `snoozeUntil > lastCompletedAt` evaluates TRUE — which means the override is *applied* (not staled), and next-due = `snoozeUntil` → health = 1.0. That is also correct for the celebration predicate because the task was just completed, so health = 1.0 whichever branch wins.

**Fix:** Tighten the comment so a future reader does not trip on the logic during a T-10-02 debugging session:

```ts
// For the just-completed task, the override's snooze_until is still in
// the future (> now) and lastCompletedAt = now. D-10's guard `snoozeUntil
// > lastCompletedAt` evaluates TRUE → override applies → nextDue =
// snoozeUntil → health = 1.0. Alternatively, if D-10 had staled the
// override, the natural branch would still give `now + frequency_days` →
// future → health = 1.0. Either way, the predicate sees the correct
// "after" coverage for the just-completed task.
```

### IN-03: Silent fail-open in override helpers can hide misconfig during development

**File:** `lib/schedule-overrides.ts:82-87, 124-129`
**Issue:** Both helpers wrap the entire PB call in `try { ... } catch { return null|emptyMap }`. This is intentional per the module docstring ("Fail-open posture" / "mirrors the silent-on-404 posture of `hasNotified`"), and correct for production — a transient PB outage should fall through to natural next-due, not 500 the request. But during development a misconfigured rule (e.g. a future migration that typos the member rule) will silently manifest as "no snooze ever applies" rather than loudly failing. The existing pattern in `lib/notifications.ts:hasNotified` has the same shape, so this is consistent with the codebase.

**Fix:** Consider logging non-404 errors at `console.warn` level in a follow-up (NOT Phase 10 work — this would add noise in the hot path). Alternatively, add a SPEC-level note that "no snooze ever applies in dev" is a symptom of member-rule misconfig. No code change required for Phase 10.

### IN-04: Double-serialize overhead at RSC boundary is harmless but verbose

**File:** `app/(app)/h/[homeId]/page.tsx:117-118`, `app/(app)/h/[homeId]/person/page.tsx:164-165`, `components/band-view.tsx:154-156`, `components/person-task-list.tsx:78-80`
**Issue:** Server-component fetches `Map` → serializes via `Object.fromEntries` → crosses the RSC boundary as a plain object → client reconstructs a `new Map(Object.entries(...))`. The pattern is correct (Maps do not serialize over the RSC boundary in Next.js) and every callsite does it the same way. It is slightly noisy — a small helper `serializeOverrides`/`deserializeOverrides` in `lib/schedule-overrides.ts` could centralize the convention and make Phase 15's new callers (action sheet) fall into the pit of success.

**Fix:**
```ts
// lib/schedule-overrides.ts
export function serializeOverrides(m: Map<string, Override>): Record<string, Override> {
  return Object.fromEntries(m);
}
export function deserializeOverrides(r?: Record<string, Override>): Map<string, Override> {
  return new Map(Object.entries(r ?? {}));
}
```

Optional — the current inline pattern is clear and well-commented. Deferrable to Phase 15 when the second set of RSC boundaries (action sheet) ships and pressure for a helper increases.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
