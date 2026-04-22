// SPDX-License-Identifier: AGPL-3.0-or-later
// HomeKeep (c) 2026 — github.com/conroyke56/homekeep
import { addDays, differenceInDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { Override } from '@/lib/schedule-overrides';

/**
 * Task scheduling — next-due computation (02-05 Plan, D-13 + SPEC §8.5;
 * 10-02 Plan adds the override branch per D-06 + D-10).
 *
 * PURE module: no I/O, no wall-clock Date construction, no Date.now. Every
 * call is deterministic given its arguments, which makes the edge-case matrix in
 * tests/unit/task-scheduling.test.ts straightforward to cover.
 *
 * Timezone posture: all Dates here are UTC-equivalent instants. Storage in
 * PocketBase is UTC ISO strings. Rendering in the home's IANA timezone is a
 * *separate concern* handled by components/next-due-display.tsx via
 * date-fns-tz.formatInTimeZone — NEVER do date math in a non-UTC zone.
 * date-fns' addDays / differenceInDays operate on the UTC epoch and are
 * DST-safe by construction (RESEARCH §Pattern: Next-Due Computation
 * timezone handling note line 1217).
 */

export type Task = {
  id: string;
  created: string; // ISO 8601 UTC
  archived: boolean;
  // Phase 11 (OOFT-01, D-02): nullable — one-off tasks carry null
  // frequency + a concrete `due_date`. Plan 11-01 widens the type only;
  // computeNextDue body still rejects null via Number.isInteger (Plan
  // 11-02 inserts the OOFT branch that short-circuits before the guard).
  frequency_days: number | null;
  schedule_mode: 'cycle' | 'anchored';
  anchor_date: string | null; // ISO 8601 UTC; must be non-null when schedule_mode === 'anchored'
  // Phase 11 extensions — all optional for v1.0 row compatibility.
  due_date?: string | null; // D-03 OOFT
  preferred_days?: 'any' | 'weekend' | 'weekday' | null; // D-07 PREF
  active_from_month?: number | null; // D-11 SEAS
  active_to_month?: number | null; // D-11 SEAS
};

export type Completion = {
  completed_at: string; // ISO 8601 UTC — Phase 3+; in Phase 2 this is always null.
};

/**
 * Compute the next-due date for a task.
 *
 * Branch order (short-circuit precedence):
 *   1. archived → null
 *   2. frequency validation → throw
 *   3. **override branch** (Phase 10, D-06 + D-10): active + unconsumed
 *      override whose `snooze_until` post-dates the last completion wins.
 *   4. (Phase 12 will insert the `next_due_smoothed` LOAD branch here — D-07
 *      forward-compatibility.)
 *   5. cycle branch — base + frequency_days.
 *   6. anchored branch — step forward by whole cycles past `now`.
 *
 * Returns:
 *   - `null` if the task is archived.
 *   - `new Date(override.snooze_until)` when an active unconsumed override
 *     applies (see D-10 guard below).
 *   - For `cycle` mode: base = lastCompletion?.completed_at ?? task.created;
 *     next_due = base + frequency_days.
 *   - For `anchored` mode:
 *     - If the anchor is in the future, the anchor itself IS the next due.
 *     - Otherwise, step by whole frequency cycles until STRICTLY after now.
 *       We compute `cycles = floor(elapsed/freq) + 1` so that `elapsed == freq`
 *       lands two cycles out (the current cycle end IS now — we want the NEXT).
 *
 * Throws when `frequency_days` is not a positive integer — this is a defence
 * in depth alongside the zod `.int().min(1)` at the schema layer.
 *
 * Parameters:
 *   @param task             The task record (non-null, member-gated).
 *   @param lastCompletion   The latest completion for this task, or `null`
 *                           when there is none.
 *   @param now              Caller-supplied wall-clock instant (keeps this
 *                           function pure; tests pass fixed Dates).
 *   @param override         Optional (Phase 10 D-06). When present AND
 *                           `!override.consumed_at` AND
 *                           `snooze_until > lastCompletion.completed_at`
 *                           (D-10 read-time filter), returns
 *                           `new Date(override.snooze_until)`. Omitting the
 *                           argument yields byte-identical v1.0 behavior.
 *
 *                           The D-10 guard is defense-in-depth: if the
 *                           atomic consumption write (Plan 10-03) ever
 *                           misses — or an admin blanks `consumed_at` back
 *                           to null after the task has been completed —
 *                           we fall through to the natural branch rather
 *                           than leaving the task "perma-snoozed" past a
 *                           real completion.
 *
 * Override `consumed_at` interpretation (A2 from Plan 10-01): PB 0.37.1 may
 * return `null`, `''`, or `undefined` for a fresh row with no consumed_at
 * set. The falsy check `!override.consumed_at` covers all three.
 */
export function computeNextDue(
  task: Task,
  lastCompletion: Completion | null,
  now: Date,
  override?: Override,
): Date | null {
  if (task.archived) return null;

  if (
    task.frequency_days === null ||
    !Number.isInteger(task.frequency_days) ||
    task.frequency_days < 1
  ) {
    throw new Error(`Invalid frequency_days: ${task.frequency_days}`);
  }
  // After the guard, TypeScript narrows `task.frequency_days` to `number`
  // only in the expression immediately following — bind once to a local
  // so cycle + anchored branches can reference it without re-narrowing.
  const freq: number = task.frequency_days;

  // ─── Phase 10 override branch (D-06, D-10 read-time filter) ─────────
  // Override wins when:
  //   (a) override is present
  //   (b) override.consumed_at is falsy (null, '', or undefined per A2)
  //   (c) snooze_until > lastCompletion.completed_at
  //       (D-10 read-time filter — defense in depth against missed
  //        atomic-consumption writes / admin-UI consumed_at reset)
  //
  // When (c) fails, the snooze is stale (completion landed after the
  // snooze date); fall through to the natural branch. Without (c),
  // a post-completion race that missed the consumption write would
  // leave the task "perma-snoozed" forever — user would complete
  // daily and still see it as "due next month". NEVER do that.
  //
  // Phase 12 will insert the `next_due_smoothed` branch BETWEEN this
  // override branch and the cycle/anchored branches (D-07
  // forward-compatibility).
  if (override && !override.consumed_at) {
    const snoozeUntil = new Date(override.snooze_until);
    const lastCompletedAt = lastCompletion
      ? new Date(lastCompletion.completed_at)
      : null;
    if (!lastCompletedAt || snoozeUntil > lastCompletedAt) {
      return snoozeUntil;
    }
    // else: stale override; fall through to cycle/anchored natural branch.
  }

  if (task.schedule_mode === 'cycle') {
    const baseIso = lastCompletion?.completed_at ?? task.created;
    const base = new Date(baseIso);
    return addDays(base, freq);
  }

  // anchored
  const baseIso = task.anchor_date ?? task.created;
  const base = new Date(baseIso);

  // Anchor in the future: the anchor IS the next due (no cycling yet).
  if (base.getTime() > now.getTime()) return base;

  // Otherwise find the next cycle boundary strictly after `now`.
  // floor(elapsed/freq) + 1 guarantees we step past `now` even when
  // elapsed is an exact multiple of freq.
  const elapsedDays = differenceInDays(now, base);
  const cycles = Math.floor(elapsedDays / freq) + 1;
  return addDays(base, cycles * freq);
}

// ─── Phase 11 pure helpers (D-18, D-19, D-20) ───────────────────────────
// Added by Plan 11-01 Task 3. Consumed by Plan 11-02 (computeNextDue
// branch composition) and Plan 11-02 (coverage dormant filter). Pure —
// no I/O, no Date.now, no hidden wall-clock reads.

/**
 * Phase 11 (D-07): project null preferred_days → 'any'. Keeps the
 * narrowing code uniform over v1.0 rows (no preferred_days field) and
 * v1.1 rows with explicit 'any'.
 */
export function effectivePreferredDays(
  task: Pick<Task, 'preferred_days'>,
): 'any' | 'weekend' | 'weekday' {
  return task.preferred_days ?? 'any';
}

/**
 * Phase 11 (D-08, PREF-02 / PREF-04): hard narrowing constraint.
 * Returns a filtered COPY of `candidates` (never mutates input) that
 * keeps only the dates matching `pref`. 'any' returns a shallow copy.
 *
 * Weekend = getUTCDay() === 0 (Sun) || 6 (Sat). UTC-day is chosen to
 * match the module's UTC-equivalent-instant posture (see computeNextDue
 * timezone-posture JSDoc). Caller MUST pass candidates already aligned
 * to home-midnight-in-UTC if home-timezone day semantics matter.
 *
 * PREF-03 contract: empty return means the caller (Phase 12 LOAD) must
 * widen the tolerance window. This helper ONLY filters — it does NOT
 * retry, extend, or shift any dates.
 *
 * PREF-04 contract: filter → result dates are always a subset of input
 * dates → never produces an earlier date than the natural cycle.
 */
export function narrowToPreferredDays(
  candidates: Date[],
  pref: 'any' | 'weekend' | 'weekday',
): Date[] {
  if (pref === 'any') return candidates.slice();
  return candidates.filter((d) => {
    const dow = d.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    return pref === 'weekend' ? isWeekend : !isWeekend;
  });
}

/**
 * Phase 11 (D-13, SEAS-04): wrap-aware active-window check. Pure fn
 * over month integers (D-20) — caller extracts month from a Date in
 * home tz via toZonedTime(now, tz).getMonth() + 1.
 *
 * Invariants:
 *   - monthOneIndexed, from, to all in 1..12 (caller enforces).
 *   - from === to → single-month active window (e.g. active Jan only).
 *   - from > to → wrap window (e.g. Oct..Mar returns true for Dec).
 *   - Either from or to null/undefined → returns true (degenerate;
 *     caller's hasWindow check should short-circuit this, but defense
 *     in depth keeps the helper robust).
 */
export function isInActiveWindow(
  monthOneIndexed: number,
  from?: number | null,
  to?: number | null,
): boolean {
  if (from == null || to == null) return true;
  if (from <= to) return monthOneIndexed >= from && monthOneIndexed <= to;
  // Wrap: e.g. from=10, to=3 → Oct,Nov,Dec,Jan,Feb,Mar active.
  return monthOneIndexed >= from || monthOneIndexed <= to;
}

/**
 * Phase 11 (D-12 seasonal-wakeup, SEAS-03): first day of
 * active_from_month in `timezone` at midnight, returned as a
 * UTC-equivalent instant.
 *
 * Year selection: if nowMonth < from (home tz), target same calendar
 * year; else target next year. Wrap windows (from > to) still open
 * on the from side — this helper is unaware of wrap; wake-up always
 * means "next occurrence of from-month-at-midnight-in-home-tz".
 *
 * Caller invariant: only invoke when last-in-prior-season is true
 * (seasonal-wakeup branch in computeNextDue, Plan 11-02). If now is
 * already inside the window, this still returns the most recent from
 * boundary, which would be "before now" — wake-up branch never hits
 * that case.
 */
export function nextWindowOpenDate(
  now: Date,
  from: number,
  to: number,
  timezone: string,
): Date {
  // `to` is accepted for signature symmetry with isInActiveWindow and
  // forward-compat with future wake-up heuristics; unused in the
  // body because wake-up always opens on the `from` side.
  void to;
  const zonedNow = toZonedTime(now, timezone);
  const nowYear = zonedNow.getFullYear();
  const nowMonth = zonedNow.getMonth() + 1; // 1..12
  const targetYear = nowMonth < from ? nowYear : nowYear + 1;
  // Build 00:00 of (targetYear, from, 1) in home tz → UTC instant.
  const localMidnight = new Date(
    Date.UTC(targetYear, from - 1, 1, 0, 0, 0, 0),
  );
  return fromZonedTime(localMidnight, timezone);
}
