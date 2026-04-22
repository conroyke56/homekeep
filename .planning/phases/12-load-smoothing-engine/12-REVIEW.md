---
phase: 12-load-smoothing-engine
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - lib/actions/completions.ts
  - lib/load-smoothing.ts
  - lib/schemas/task.ts
  - lib/task-scheduling.ts
  - pocketbase/pb_migrations/1745280002_next_due_smoothed.js
  - tests/unit/load-smoothing-integration.test.ts
  - tests/unit/load-smoothing-perf.test.ts
  - tests/unit/load-smoothing.test.ts
  - tests/unit/task-scheduling.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 12 (LOAD smoother) lands cleanly on the strong invariants the plan set up. The focus-area checklist passes in every load-bearing position:

- **LOAD-11 forward-only**: `placeNextDue` is purely functional — no sibling mutation in `lib/load-smoothing.ts`, and the `completeTaskAction` placement block writes `batch.collection('tasks').update(task.id, ...)` against the argument task only (line 356). Test T8 snapshot-asserts no mutation of input Map or task.
- **LOAD-12 tiebreakers**: sort chain at `lib/load-smoothing.ts:165-170` is `score → distanceFromIdeal → time`. Matches spec; asserted by test T7 (both sub-cases).
- **LOAD-06 anchored bypass**: guarded on read side at `lib/task-scheduling.ts:250` (`schedule_mode !== 'anchored' && task.next_due_smoothed`) AND write side at `lib/actions/completions.ts:311` (`task.schedule_mode === 'cycle' && !freqOoft`). Helper itself throws on anchored as defense in depth (line 100-102).
- **LOAD-09 OOFT bypass**: centralized `isOoftTask` (null OR 0) called in the write-side guard (line 264-265) AND placeNextDue throws (line 103-105). Tests T10/T30 cover both null and 0 variants.
- **D-15 seasonal wake-up handshake**: smoothed branch (`lib/task-scheduling.ts:249-271`) checks `treatAsWakeup` inline and falls through to seasonal block without returning — correct.
- **T-12-07 Invalid Date defense**: `if (smoothed.getTime() > 0)` at line 267 blocks `NaN` from propagating.
- **Placement error fallback**: `try/catch` at `completions.ts:312-367` logs to `console.warn` and preserves completion success — the placement op is never appended to `batch` when placement throws, so the atomic contract of the completion/override/archive ops is intact.
- **PB filter parameterization**: the new home-tasks fetch uses `pb.filter('home_id = {:hid} && archived = false', { hid: homeId })` at line 314 — properly parameterized.
- **Perf (LOAD-13)**: 100-task benchmark <100ms with 20-33× headroom.

Five issues found — one warning on a subtle seasonal wake-up accounting gap in `computeHouseholdLoad`, plus four info-level observations about robustness and observability.

## Warnings

### WR-01: `computeHouseholdLoad` dormant pre-filter drops prior-season wake-ups from the load map

**File:** `lib/load-smoothing.ts:235-252`
**Issue:** The pre-filter at lines 235-252 is intended to skip tasks `computeNextDue` would return `null` for — i.e. same-season dormant tasks (out-of-window now + in-season completion). The comment at lines 231-234 acknowledges this, but the guard is too aggressive:

```ts
if (!isInActiveWindow(nowMonth, task.active_from_month, task.active_to_month)) {
  const last = latestByTask.get(task.id) ?? null;
  if (last) continue; // prior completion → dormant → skip
  // else: first-cycle wake-up → fall through to computeNextDue below.
}
```

Any out-of-window task with any prior completion is skipped — but `computeNextDue`'s seasonal-dormant branch ONLY returns null when `!lastInPriorSeason` (same-season; `lib/task-scheduling.ts:311-314`). When the completion is in a PRIOR season (last year's cycle, or out-of-window month), `computeNextDue` falls through to the wake-up branch at line 320-327 and returns `nextWindowOpenDate(...)` — which may legitimately land inside `windowEnd`.

**Impact:** Under-counting. Sibling `placeNextDue` calls won't see these about-to-wake-up tasks contributing to clusters on the from-month-1st anchor. Practical effect: seasonal onset (e.g. October 1 for an Oct-Mar task household) may be under-smoothed the first time a sibling is placed while dormant tasks are about to wake up. Unit test `task-scheduling.test.ts:540-555` ("last completion 400d ago (prior season) → next window open") proves the read branch treats prior-season as wake-up, but `load-smoothing.test.ts` does not exercise this combination in `computeHouseholdLoad` (T3 only tests same-season dormant).

**Fix:** Either (a) drop the pre-filter entirely and let `computeNextDue`'s null-return line 261 handle it (~30-100 extra calls max on a 100-task home — the windowDays bound is the perf guard, not this shortcut), or (b) add the prior-season check to match `computeNextDue`:

```ts
if (last) {
  // Only same-season completion is dormant; prior-season falls through to wake-up.
  const lastMonth = timezone
    ? toZonedTime(new Date(last.completed_at), timezone).getMonth() + 1
    : new Date(last.completed_at).getUTCMonth() + 1;
  const lastInWindow = isInActiveWindow(
    lastMonth, task.active_from_month, task.active_to_month,
  );
  const daysSince =
    (now.getTime() - new Date(last.completed_at).getTime()) / 86400000;
  if (lastInWindow && daysSince <= 365) continue; // same-season dormant
  // else: prior-season → fall through to wake-up via computeNextDue.
}
```

Option (a) is simpler and removes duplicated heuristic logic at negligible perf cost. Recommended. Add a `computeHouseholdLoad` unit test for the prior-season wake-up case to lock the behavior.

## Info

### IN-01: Outer catch swallows PB errors without logging

**File:** `lib/actions/completions.ts:508-510`
**Issue:** The outer `try/catch` at the end of `completeTaskAction` is:

```ts
} catch {
  return { ok: false, formError: 'Could not record completion' };
}
```

No `console.warn(e)`, no `console.error(e)`. Compare to the placement `catch` at line 359-363 and the ntfy `catch` at line 451-456 which both log `(e as Error).message`. Under PB outage, network blip, or unexpected schema drift, operators get a silent user-facing failure with no server-log breadcrumb. The placement/ntfy catches log because they're non-fatal; the outer catch is MORE critical — its error is the one you want to find in logs.

**Fix:** Capture and log:

```ts
} catch (e) {
  console.warn('[completeTask] action failed:', (e as Error).message);
  return { ok: false, formError: 'Could not record completion' };
}
```

### IN-02: `placeNextDue` can return a past date for heavily overdue tasks (T-12-04 documented deferral)

**File:** `lib/load-smoothing.ts:107-111`
**Issue:** The `void now;` at line 111 is documented as "handled implicitly via naturalIdeal ≥ lastCompletion + freq which is ≥ now by construction for non-overdue tasks." This assumption is false for overdue tasks. Example:

- `freq_days=14`, `lastCompletion=60 days ago` → `naturalIdeal = now - 46d`
- `tolerance=2` → candidates = `[now-48d, ..., now-44d]` — all past
- Result: a past-date placement gets written to `next_due_smoothed`

The doc comment acknowledges this ("forward-compat with future 'don't place earlier than now' guards"), so it's a known deferral — flagging for Phase 17 REBAL traceability and because integration test scenario 2 specifically back-dates the completion only 5 days (naturalIdeal = +9d future) — it doesn't exercise the overdue path.

**Fix (deferred):** Add a guard `if (naturalIdeal <= now) return addDays(now, freq);` or floor candidates at `max(candidate, now)` during step 3. Track in Phase 17 REBAL scope. For v1.1 ship, the practical impact is: an overdue cycle task gets "re-smoothed" to a past date on completion, and the next `computeNextDue` read returns that past date — which renders as overdue UI (the same state as before). No crash, no data corruption.

### IN-03: Invalid-date guard uses `getTime() > 0` rather than `!Number.isNaN(getTime())`

**File:** `lib/task-scheduling.ts:267`
**Issue:** The T-12-07 defense at line 267 is `if (smoothed.getTime() > 0) return smoothed;`. Works for `Invalid Date` (NaN fails the comparison) and any sensible task date (positive epoch ms from 1970-01-01 onward). Edge-case concern only: any stored timestamp before the Unix epoch would be rejected. No realistic task scenario hits this, but the idiomatic form is:

```ts
if (!Number.isNaN(smoothed.getTime())) return smoothed;
```

**Fix:** Stylistic only. Current guard is safe for all real-world task dates. Defer unless Phase 17 backfill allows historical imports.

### IN-04: `home.timezone as string` cast is unguarded against a missing timezone field

**File:** `lib/actions/completions.ts:337, 352, 489, 492`
**Issue:** Multiple `home.timezone as string` casts after `pb.collection('homes').getOne(homeId, { fields: 'id,timezone' })`. If the row were ever returned with no `timezone` populated (unlikely — seed always sets it, schema defaults it), the cast produces `undefined` typed as `string`. Downstream:
- `computeHouseholdLoad` would pass `undefined` to `formatInTimeZone` → throws.
- `formatInTimeZone(nextDue, undefined, ...)` at line 492 → throws.

Any throw from these sites lands in the outer `catch {}` and returns generic `'Could not record completion'` (see IN-01). Silent failure mode.

**Fix:** Resolve a fallback:

```ts
const tz = (home.timezone as string | null | undefined) ?? 'UTC';
```

Then pass `tz` instead of the cast. Defensive; zero downside; aligns with the "UTC default" posture in `computeNextDue`'s 5th-param contract (`lib/task-scheduling.ts:143-154`).

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
