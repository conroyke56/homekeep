// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HorizonStrip } from '@/components/horizon-strip';
import type { ClassifiedTask } from '@/lib/band-classification';

/**
 * 03-02 Task 2 component tests for HorizonStrip.
 *
 * Covers:
 *   - Empty-tasks branch shows "looking clear" text + NO cells.
 *   - 12 cells render with correct month abbreviations in UTC.
 *   - Tasks bucketed into the right month (UTC + non-UTC tz).
 *   - Melbourne/LA-style cross-midnight bucketing (Pitfall 2).
 */
const mkTask = (
  id: string,
  name: string,
  nextDue: Date,
): ClassifiedTask =>
  ({
    id,
    created: '2026-01-01T00:00:00Z',
    archived: false,
    frequency_days: 30,
    schedule_mode: 'cycle',
    anchor_date: null,
    nextDue,
    daysDelta: 30,
    name,
  }) as ClassifiedTask & { name: string };

describe('HorizonStrip', () => {
  const now = new Date('2026-04-20T12:00:00Z');
  const tz = 'UTC';

  it('renders the empty-state message when tasks=[]', () => {
    const { container } = render(
      <HorizonStrip tasks={[]} now={now} timezone={tz} />,
    );
    expect(container.textContent).toMatch(/looking clear/i);
    expect(container.querySelector('button[data-month-key]')).toBeNull();
  });

  it('renders 12 month cells with labels starting at the current month (UTC)', () => {
    const t = mkTask('x', 'X', new Date('2026-06-15T00:00:00Z'));
    const { container } = render(
      <HorizonStrip tasks={[t]} now={now} timezone={tz} />,
    );
    const buttons = container.querySelectorAll('button[data-month-key]');
    expect(buttons.length).toBe(12);
    // April is index 0, May index 1, June index 2, and so on.
    expect(buttons[0].textContent).toMatch(/Apr/);
    expect(buttons[1].textContent).toMatch(/May/);
    expect(buttons[2].textContent).toMatch(/Jun/);
    expect(buttons[11].textContent).toMatch(/Mar/);
  });

  it('buckets a task into its month cell and leaves the cell enabled', () => {
    const t = mkTask('x', 'Paint fence', new Date('2026-07-10T00:00:00Z'));
    const { container } = render(
      <HorizonStrip tasks={[t]} now={now} timezone={tz} />,
    );
    const julBtn = container.querySelector(
      'button[data-month-key="2026-07"]',
    );
    expect(julBtn).toBeTruthy();
    expect(julBtn!.hasAttribute('disabled')).toBe(false);
    expect(julBtn!.getAttribute('data-month-count')).toBe('1');
  });

  it('disables month cells that hold no tasks', () => {
    const t = mkTask('x', 'Paint fence', new Date('2026-07-10T00:00:00Z'));
    const { container } = render(
      <HorizonStrip tasks={[t]} now={now} timezone={tz} />,
    );
    const augBtn = container.querySelector(
      'button[data-month-key="2026-08"]',
    );
    expect(augBtn).toBeTruthy();
    expect(augBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('buckets a task across UTC midnight into its LOCAL month (Melbourne canonical case)', () => {
    // 2026-06-30T15:00Z → Melbourne (UTC+10) = 2026-07-01 01:00 local → July bucket.
    const t = mkTask(
      'y',
      'Melbourne task',
      new Date('2026-06-30T15:00:00Z'),
    );
    const { container } = render(
      <HorizonStrip
        tasks={[t]}
        now={now}
        timezone="Australia/Melbourne"
      />,
    );
    const julBtn = container.querySelector(
      'button[data-month-key="2026-07"]',
    );
    expect(julBtn).toBeTruthy();
    expect(julBtn!.hasAttribute('disabled')).toBe(false);
    expect(julBtn!.getAttribute('data-month-count')).toBe('1');
  });

  it('renders 3 dots when a month has exactly 3 tasks and no overflow label', () => {
    const tasks = [
      mkTask('a', 'A', new Date('2026-06-05T00:00:00Z')),
      mkTask('b', 'B', new Date('2026-06-15T00:00:00Z')),
      mkTask('c', 'C', new Date('2026-06-25T00:00:00Z')),
    ];
    const { container } = render(
      <HorizonStrip tasks={tasks} now={now} timezone={tz} />,
    );
    const junBtn = container.querySelector(
      'button[data-month-key="2026-06"]',
    );
    expect(junBtn).toBeTruthy();
    expect(junBtn!.textContent).not.toMatch(/\+/);
    expect(junBtn!.getAttribute('data-month-count')).toBe('3');
  });

  it('renders +N overflow when a month has more than 3 tasks', () => {
    const tasks = [
      mkTask('a', 'A', new Date('2026-06-05T00:00:00Z')),
      mkTask('b', 'B', new Date('2026-06-10T00:00:00Z')),
      mkTask('c', 'C', new Date('2026-06-15T00:00:00Z')),
      mkTask('d', 'D', new Date('2026-06-20T00:00:00Z')),
      mkTask('e', 'E', new Date('2026-06-25T00:00:00Z')),
    ];
    const { container } = render(
      <HorizonStrip tasks={tasks} now={now} timezone={tz} />,
    );
    const junBtn = container.querySelector(
      'button[data-month-key="2026-06"]',
    );
    expect(junBtn).toBeTruthy();
    expect(junBtn!.textContent).toMatch(/\+2/);
  });
});
