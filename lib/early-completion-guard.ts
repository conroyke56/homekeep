/**
 * Early-completion guard (03-01 Plan, Pattern 9, D-07, COMP-02).
 *
 * PURE function: takes `now: Date` as a parameter (no clock reads).
 *
 * Returns `true` when the elapsed time since the last completion (or
 * task.created if the task has no completions yet) is STRICTLY less
 * than 25% of the task's frequency_days.
 *
 * Design decisions (from 03-CONTEXT D-07):
 *   - No prior completion → reference is `task.created`. This prevents
 *     "just created the task, marked it done immediately" accidents.
 *   - Anchored mode does NOT affect the guard — it's about "how long
 *     since the user last actually did it", not about anchor dates.
 *     A quarterly anchored task completed 3 days ago still triggers
 *     the guard if user taps complete again today.
 *   - Exactly at the 25% boundary: NO warn (strict less-than). This
 *     matches D-07's "strict" qualifier; the server action's acceptance
 *     test in tests/unit/early-completion-guard.test.ts includes the
 *     exact-boundary case.
 */
export function shouldWarnEarly(
  task: { created: string; frequency_days: number },
  lastCompletion: { completed_at: string } | null,
  now: Date,
): boolean {
  const referenceIso = lastCompletion?.completed_at ?? task.created;
  const reference = new Date(referenceIso);
  const elapsedDays = (now.getTime() - reference.getTime()) / 86400000;
  const threshold = 0.25 * task.frequency_days;
  return elapsedDays < threshold;
}
