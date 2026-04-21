'use client';

import clsx from 'clsx';

/**
 * TaskRow (03-02 Plan, D-16, SPEC §19 "information, not alarm").
 *
 * The entire row is a single `<button>` — the whole row IS the tap
 * target (D-16). Min height 44px satisfies iOS/Android touch-target
 * accessibility guidance (Pitfall 8).
 *
 * Variants:
 *   - overdue:  warm-accent `border-l-4 border-l-primary` (NOT red
 *               — SPEC §19 explicitly rejects red panic bars).
 *   - thisWeek / horizon: default border, no accent.
 *
 * Pending state (`pending=true`) disables the button and dims it to
 * 60% opacity. The onComplete prop is invoked with the task id on
 * click; the parent owns the pending-id bookkeeping (03-03 will wire
 * it to the real server action).
 *
 * Label copy (right-aligned tabular-nums for mixed-width digits):
 *   - overdue (daysDelta < 0):  "{N}d late"
 *   - today (|daysDelta| < 1):  "today"
 *   - future (daysDelta ≥ 1):   "in {N}d"
 */
export function TaskRow({
  task,
  onComplete,
  pending,
  daysDelta,
  variant,
}: {
  task: { id: string; name: string; frequency_days: number };
  onComplete: (taskId: string) => void;
  pending: boolean;
  daysDelta: number;
  variant?: 'overdue' | 'thisWeek' | 'horizon';
}) {
  const label =
    variant === 'overdue'
      ? `${Math.max(1, Math.round(-daysDelta))}d late`
      : daysDelta < 1
        ? 'today'
        : `in ${Math.round(daysDelta)}d`;

  return (
    <button
      type="button"
      disabled={pending}
      aria-disabled={pending}
      data-task-id={task.id}
      data-task-name={task.name}
      data-variant={variant}
      onClick={() => onComplete(task.id)}
      className={clsx(
        'flex w-full min-h-[44px] items-center justify-between gap-2 rounded border p-3 text-left transition-colors',
        variant === 'overdue' && 'border-l-4 border-l-primary',
        pending
          ? 'pointer-events-none opacity-60'
          : 'hover:bg-muted active:scale-[0.99]',
      )}
    >
      <div className="flex flex-col">
        <span className="font-medium">{task.name}</span>
        <span className="text-xs text-muted-foreground">
          Every {task.frequency_days}{' '}
          {task.frequency_days === 1 ? 'day' : 'days'}
        </span>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{label}</span>
    </button>
  );
}
