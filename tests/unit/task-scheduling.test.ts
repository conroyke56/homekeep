import { describe, test, expect } from 'vitest';
import { addDays } from 'date-fns';
import { computeNextDue, type Task } from '@/lib/task-scheduling';

/**
 * 02-05 Task 1 RED → GREEN: computeNextDue pure function.
 *
 * Covers the 8 edge-case rows from RESEARCH §Pattern: Next-Due Computation
 * (lines 1204-1215) plus additional robustness cases for leap-year / DST /
 * invalid-frequency / archived / future completion.
 *
 * All tests use fixed Dates — never `new Date()` inside a test — so no CI
 * clock skew can cause flakiness. The implementation itself accepts `now`
 * as a parameter (testability guarantee).
 */

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    created: '2026-01-01T00:00:00.000Z',
    archived: false,
    frequency_days: 7,
    schedule_mode: 'cycle',
    anchor_date: null,
    ...overrides,
  };
}

describe('computeNextDue — cycle mode', () => {
  test('never completed, created today, freq=7 → created+7d', () => {
    const created = new Date('2026-04-01T00:00:00.000Z');
    const task = makeTask({
      created: created.toISOString(),
      frequency_days: 7,
      schedule_mode: 'cycle',
    });
    const now = created;
    const result = computeNextDue(task, null, now);
    expect(result).toEqual(addDays(created, 7));
  });

  test('last completed 2 days ago, freq=7 → lastCompletion+7d (= now+5d)', () => {
    const now = new Date('2026-04-10T00:00:00.000Z');
    const completedAt = addDays(now, -2);
    const task = makeTask({
      created: '2026-03-01T00:00:00.000Z',
      frequency_days: 7,
      schedule_mode: 'cycle',
    });
    const result = computeNextDue(
      task,
      { completed_at: completedAt.toISOString() },
      now,
    );
    expect(result).toEqual(addDays(completedAt, 7));
  });
});

describe('computeNextDue — anchored mode', () => {
  test('anchor in future → returns the anchor itself', () => {
    const now = new Date('2026-04-10T00:00:00.000Z');
    const anchor = addDays(now, 10);
    const task = makeTask({
      schedule_mode: 'anchored',
      anchor_date: anchor.toISOString(),
      frequency_days: 7,
    });
    const result = computeNextDue(task, null, now);
    expect(result).toEqual(anchor);
  });

  test('anchor today, freq=7, now=anchor → anchor+7d', () => {
    const anchor = new Date('2026-04-10T00:00:00.000Z');
    const task = makeTask({
      schedule_mode: 'anchored',
      anchor_date: anchor.toISOString(),
      frequency_days: 7,
    });
    const result = computeNextDue(task, null, anchor);
    expect(result).toEqual(addDays(anchor, 7));
  });

  test('anchor 30d ago, freq=7 → next cycle strictly after now (floor(30/7)+1 = 5 → anchor+35d)', () => {
    const now = new Date('2026-04-10T00:00:00.000Z');
    const anchor = addDays(now, -30);
    const task = makeTask({
      schedule_mode: 'anchored',
      anchor_date: anchor.toISOString(),
      frequency_days: 7,
    });
    const result = computeNextDue(task, null, now);
    expect(result).toEqual(addDays(anchor, 35)); // = now+5d
  });

  test('anchor 90d ago, freq=30 → anchor+120d (floor(90/30)+1 = 4 cycles)', () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    const anchor = addDays(now, -90);
    const task = makeTask({
      schedule_mode: 'anchored',
      anchor_date: anchor.toISOString(),
      frequency_days: 30,
    });
    const result = computeNextDue(task, null, now);
    // floor(90/30) + 1 = 4 cycles from anchor → anchor+120d = now+30d
    expect(result).toEqual(addDays(anchor, 120));
  });

  test('anchor exactly one full cycle ago → next cycle is anchor+2*freq', () => {
    // Exact-boundary case flagged in RESEARCH edge-case table — when
    // elapsed == freq exactly, floor(elapsed/freq)+1 = 2, so the next
    // due is two cycles out (we strictly step PAST now).
    const now = new Date('2026-04-10T00:00:00.000Z');
    const anchor = addDays(now, -7);
    const task = makeTask({
      schedule_mode: 'anchored',
      anchor_date: anchor.toISOString(),
      frequency_days: 7,
    });
    const result = computeNextDue(task, null, now);
    expect(result).toEqual(addDays(anchor, 14)); // = now+7d
  });
});

describe('computeNextDue — edge cases', () => {
  test('archived task returns null', () => {
    const task = makeTask({ archived: true });
    expect(computeNextDue(task, null, new Date('2026-04-10T00:00:00.000Z'))).toBeNull();
  });

  test('frequency 0 throws', () => {
    const task = makeTask({ frequency_days: 0 });
    expect(() =>
      computeNextDue(task, null, new Date('2026-04-10T00:00:00.000Z')),
    ).toThrow();
  });

  test('frequency 1.5 throws', () => {
    const task = makeTask({ frequency_days: 1.5 });
    expect(() =>
      computeNextDue(task, null, new Date('2026-04-10T00:00:00.000Z')),
    ).toThrow();
  });

  test('negative frequency throws', () => {
    const task = makeTask({ frequency_days: -5 });
    expect(() =>
      computeNextDue(task, null, new Date('2026-04-10T00:00:00.000Z')),
    ).toThrow();
  });

  test('DST transition day (Europe/London 2026-03-29) — UTC math unaffected', () => {
    // Internal math uses UTC-equivalent instants via date-fns; DST is a
    // RENDERING concern (see NextDueDisplay / formatInTimeZone).
    const anchor = new Date('2026-03-28T00:00:00.000Z');
    const now = new Date('2026-04-01T00:00:00.000Z');
    const task = makeTask({
      schedule_mode: 'anchored',
      anchor_date: anchor.toISOString(),
      frequency_days: 7,
    });
    const result = computeNextDue(task, null, now);
    // anchor+7d = 2026-04-04, regardless of DST.
    expect(result).toEqual(addDays(anchor, 7));
  });

  test('leap year — Feb 29 2028 anchor math works', () => {
    const anchor = new Date('2028-02-29T00:00:00.000Z');
    const now = new Date('2028-03-15T00:00:00.000Z');
    const task = makeTask({
      schedule_mode: 'anchored',
      anchor_date: anchor.toISOString(),
      frequency_days: 30,
    });
    const result = computeNextDue(task, null, now);
    // 15 days elapsed < 30, so first cycle lands at anchor+30d = 2028-03-30.
    expect(result).toEqual(addDays(anchor, 30));
  });

  test('cycle mode with lastCompletion in the future is still completedAt+freq (documented behavior)', () => {
    // Phase 3 may disallow future completions via UI; for now, follow the
    // math. If a completion record has a completed_at in the future, we
    // still compute next_due = that + freq. Business layer must validate
    // completion timestamps separately.
    const now = new Date('2026-04-10T00:00:00.000Z');
    const completedAt = addDays(now, 2);
    const task = makeTask({
      schedule_mode: 'cycle',
      frequency_days: 7,
    });
    const result = computeNextDue(
      task,
      { completed_at: completedAt.toISOString() },
      now,
    );
    expect(result).toEqual(addDays(completedAt, 7));
  });
});
