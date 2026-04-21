# Phase 3: Core Loop - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Source:** Autonomous yolo synthesis from SPEC.md §8.1, §8.5, §8.6, Phase 2 summaries.

<domain>
## Phase Boundary

Phase 2 delivered data (homes, areas, tasks with computed next-due). Phase 3 delivers the **core user experience** — the differentiating three-band main view plus task completion. After Phase 3, a single user can use HomeKeep as intended: open the app, see what's overdue, tap to complete, watch the coverage ring tick up.

**Scope:**
- `completions` collection + append-only completion history (COMP-03)
- One-tap task completion with optimistic UI (COMP-01)
- Early-completion guard — confirm dialog when <25% of cycle elapsed (COMP-02)
- Three-band view as the default authenticated landing page (VIEW-01..VIEW-04)
- Coverage ring at top (VIEW-05)
- Task detail sheet/dialog for tapping a task (VIEW-06)

**Explicitly NOT in Phase 3:**
- Multi-member cascading assignment (Phase 4)
- By Area / Person / History views as independent routes (Phase 5)
- Seed task library wizard (Phase 5)
- Notifications / ntfy (Phase 6)
- Streaks + celebrations (Phase 6)
- PWA manifest + offline (Phase 7)
</domain>

<decisions>
## Implementation Decisions

### Data Model Additions

- **D-01:** New **completions** collection via a new PB migration `1714867200_completions.js`. Fields: `task_id` (relation → tasks, required, cascade delete if task hard-deleted — but tasks archive instead), `completed_by_id` (relation → users, required), `completed_at` (date, required, default: now), `notes` (text, optional), `via` (select: `tap` | `manual-date` — default `tap` for Phase 3, `manual-date` reserved for future "mark done with back-date" UX). API rules: auth required; user must own the home that owns the task.

- **D-02:** **Never delete completions.** The collection has NO delete rule (delete always forbidden; SPEC §7.5). If a task is archived, its completions remain for the history view (Phase 5).

- **D-03:** Extend `computeNextDue` (Phase 2) to query the MOST RECENT completion per task. The function signature stays the same; the CALLER passes in `lastCompletion` as before. Phase 3 adds `getLastCompletion(taskId)` to data-access layer + `computeTaskBandAssignments(tasks, completions, now, homeTimezone)` which returns `{ overdue: Task[], thisWeek: Task[], horizon: Task[] }`.

### Computation Rules (pure, tested)

- **D-04:** **Band classification** (for display sorting):
  - `overdue`: `computeNextDue(task, lastCompletion, now) < now` (due date in past)
  - `thisWeek`: `now <= nextDue <= addDays(now, 7)` (due date today through +6 days)
  - `horizon`: `nextDue > addDays(now, 7)` (anything further out)
  - Archived tasks excluded from all bands.

- **D-05:** **Within-band sort:**
  - Overdue: by `daysOverdue DESC` (worst first — matches SPEC §8.1)
  - This Week: by `nextDue ASC` (soonest first)
  - Horizon: by `nextDue ASC` (soonest first, but rendered as month-aggregated calendar)

- **D-06:** **Coverage ring formula** (SPEC §8.1 "weighted average of (1 - overdue_ratio)"):
  ```ts
  // Per-task health: 1.0 = perfectly on schedule or better; drops linearly as overdue.
  // taskHealth = clamp(1 - max(0, (now - nextDue) / frequency_days), 0, 1)
  // Household coverage = mean(taskHealth) across all non-archived tasks in the home.
  // 0 tasks → 100 (empty house is perfectly maintained; show "Add your first task" CTA)
  ```
  Percentage rendered as `Math.round(coverage * 100)`. Pure function in `lib/coverage.ts` with Vitest matrix.

- **D-07:** **Early-completion guard (COMP-02):** Before creating a completion, compare `now - lastCompletion.completed_at` (or `now - task.created` if no completions) to `task.frequency_days`. If `elapsed < 0.25 * frequency_days`:
  - Show confirm dialog: `"{task.name} was last done {N} day(s) ago, every {frequency_days} days. Mark done anyway?"` [Cancel] [Mark done]
  - On confirm: proceed with completion. Cancel: close.
  - For tasks with NO prior completions, use `task.created` as the reference — guard still applies (prevents "just created it, marked it done immediately" accidents).

### Completion Flow

- **D-08:** **One-tap completion (COMP-01):** Tap target is the whole task row in the band. Optimistic UI: immediately move the task out of its current band (recompute on client using the new completion), show a soft toast "Done — next due {formatted}". The server action creates the completion record; if it fails, revert + show error toast.

- **D-09:** `completeTaskAction(taskId, { force?: boolean })` — if `force=false` and guard triggers, return `{ requiresConfirm: true, elapsed, frequency, lastCompletion }` without writing. Client shows confirm dialog, re-calls with `force=true`.

- **D-10:** **Append-only enforcement (COMP-03):** PB `updateRule = null` + `deleteRule = null` on `completions` — records are create-only from the API. Document in SUMMARY.md.

### UI — Three-Band View

- **D-11:** The default authenticated landing (`/h/[homeId]`) is the three-band view. Today's Phase-2 stub ("areas list + task counts") is replaced. Areas remain accessible at `/h/[homeId]/areas`.

- **D-12:** Layout (mobile-first, stacks to desktop):
  ```
  ┌─────────────────────────────┐
  │ HomeSwitcher | CoverageRing │
  │             73%             │
  ├─────────────────────────────┤
  │ OVERDUE   (only if count>0) │
  │   ⏰  Wipe benches  (-2d)    │
  │   ⏰  Clean filter  (-5d)    │
  ├─────────────────────────────┤
  │ THIS WEEK                    │
  │   Today                      │
  │     Take out bins            │
  │   Thu                        │
  │     Water plants             │
  │     Check mailbox            │
  ├─────────────────────────────┤
  │ HORIZON  (next 12 months)   │
  │   ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐ │
  │   │M│J│J│A│S│O│N│D│J│F│M│A│ │
  │   │•│ │•│•│ │•│ │ │ │•│ │ │ │
  │   └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘ │
  └─────────────────────────────┘
  ```
  Use shadcn Card for each band. Overdue accent: warm but not loud (terracotta-sand border-l-4, not a red panic bar — SPEC "information, not alarm").

- **D-13:** **This Week grouping:** If band has >5 items, group by day (today / tomorrow / weekday names). ≤5 items: flat list sorted ASC. Group headers are small, low-weight text (muted-foreground).

- **D-14:** **Horizon component:** 12 cells, each = one month (starting from current month). Each cell shows a muted month label + 0..N dots representing task occurrences in that month. Tap a month cell → open `<Sheet>` (shadcn sheet drawer) listing the tasks in that month with their exact due dates.

- **D-15:** **CoverageRing:** SVG ring with animated stroke-dashoffset. Stroke color uses the warm accent. Number in center. Small label beneath: "on schedule". Pure component, takes `percentage: number` prop. No libraries — hand-rolled SVG, accessible (role=img, aria-label="Coverage X%").

- **D-16:** **Task row (in any band):** single clickable row — icon + name + subtitle (`{freq_days}d · area_name`) + right-aligned badge showing days-overdue or days-until-due + tap→complete.  The ENTIRE row is the tap target. Long-press / right-click → open task detail sheet (VIEW-06).

- **D-17:** **Task detail sheet (VIEW-06):** shadcn `<Sheet>` opened from bottom on mobile / right side on desktop. Shows: task name, area, frequency, schedule mode, notes, computed next-due, "Complete" button (runs the same action as row tap), "Edit" → navigates to `/h/[id]/tasks/[taskId]` (Phase 2 route), "Archive" button (with confirm), recent completions list (last 5, from completions collection).

### Data Fetching

- **D-18:** Server Component at `/h/[homeId]` fetches in ONE round-trip (PB expand-based):
  1. All non-archived tasks for the home, with `expand=area_id`
  2. The most recent completion per task (PB doesn't support "top-1 per group" natively; query all completions for the home's tasks in the last 13 months — bounded by max frequency_days=365, plus slack — then reduce client-side to "latest per task")
  3. Pass server-computed `{ overdue, thisWeek, horizon, coverage }` to Client Components for rendering.

- **D-19:** Optimistic update uses React's `useOptimistic` hook to update the client-side task→completion map on tap; server action writes the real record; on success `router.refresh()` re-syncs.

### Testing

- **D-20:** Unit (Vitest):
  - `lib/task-scheduling.ts`: extend for "given a completion, what's next-due" (Phase 2 already covers this but re-verify)
  - `lib/band-classification.ts`: `computeTaskBands(tasks, completions, now)` matrix — empty, all-overdue, boundary (today), crossing week boundary, horizon-only
  - `lib/coverage.ts`: `computeCoverage(tasks, completions, now)` matrix — empty (100), all-perfect (100), half-overdue-by-full-cycle (~50), one-task-archived (ignored)
  - `lib/early-completion-guard.ts`: `shouldWarnEarly(task, lastCompletion, now)` matrix — no completions + just created (warn), completed 1d ago with 7d freq (warn), completed 5d ago with 7d freq (no warn), anchored mode edge (same rule, based on lastCompletion if present)
- **D-21:** E2E (Playwright):
  - Create home + task (freq=7d cycle) → visit `/h/[id]` → task in This Week band → tap → confirm guard (just-created task triggers guard) → accept → toast, task moved to horizon → reload, still gone from This Week, coverage ring updated
  - Seed a "stale" task (created 10d ago, freq=7) → reload → task in Overdue band → tap → no guard (past 25% threshold easily) → task moves out, coverage ticks up

### Claude's Discretion
- Exact animation duration on coverage ring (default 600ms ease-out)
- Colour tokens for overdue indicator (stays within warm palette)
- Tap feedback haptics (mobile-only, native, use via CSS `:active` for now)
- Sheet vs Dialog for task detail (Sheet chosen — slides from edge; more room)

</decisions>

<canonical_refs>
## Canonical References

- `SPEC.md` §7.5 — Completions append-only
- `SPEC.md` §8.1 — Three-band view with Coverage ring (this is the phase's soul)
- `SPEC.md` §8.5 — Cycle vs anchored; early-completion guard
- `SPEC.md` §8.6 — Dashboards summary
- `SPEC.md` §19 — Design direction (warm/calm/domestic)

### Phase 2 reusable
- `.planning/phases/02-auth-core-data/02-CONTEXT.md` — D-12 tasks fields, D-13 computeNextDue
- `.planning/phases/02-auth-core-data/02-05-SUMMARY.md` — task CRUD + scheduling lib
- `lib/task-scheduling.ts` — `computeNextDue` function
- `lib/schemas/task.ts` — zod schema (extend for archived filtering)
- `components/next-due-display.tsx` — formatInTimeZone renderer
- `lib/pocketbase-server.ts`, `lib/actions/tasks.ts` — action + server-client patterns
- `proxy.ts` — auth gate (no changes needed)
- shadcn components: Card, Button, Dialog (for guard), Sheet (for detail), Toast (sonner)

</canonical_refs>

<code_context>
### Reusable from Phase 2
- Server Component pattern for `/h/[homeId]`
- `computeNextDue` lives in `lib/task-scheduling.ts`
- `createServerClient()` in `lib/pocketbase-server.ts`
- `TaskList` Server Component in `components/task-list.tsx` — rewrite to delegate to new BandView
- `NextDueDisplay` — reuse inline in task rows

### New in Phase 3
- `lib/band-classification.ts` — pure `computeTaskBands`
- `lib/coverage.ts` — pure `computeCoverage`
- `lib/early-completion-guard.ts` — pure `shouldWarnEarly`
- `lib/actions/completions.ts` — `completeTaskAction`
- `components/band-view.tsx` — top-level container (Client)
- `components/coverage-ring.tsx` — SVG
- `components/task-band.tsx` — reusable band with header + task rows
- `components/task-row.tsx` — tappable row
- `components/horizon-strip.tsx` — 12-month mini-calendar
- `components/task-detail-sheet.tsx` — Sheet with detail + complete/edit/archive
- `components/early-completion-dialog.tsx` — confirm dialog
</code_context>

<specifics>
## Specific Ideas
- Coverage ring is **the** visual signature of HomeKeep. Get it calm-and-warm.
- Overdue band: warm accent border-left, NOT a red background. "Information, not alarm" — SPEC.
- Empty states:
  - No tasks at all → friendly CTA "Add your first task" with a warm illustration / icon
  - No overdue → band collapsed entirely (not even a header)
  - No horizon yet (tasks all in this week) → band shows "Nothing on the horizon yet — looking clear!"
- Tap target min-size 44×44 (accessibility)
- Reduce motion: respect `prefers-reduced-motion` — skip the ring animation, snap to final value
</specifics>

<deferred>
- Multi-user cascading assignee display on task rows — Phase 4
- By Area / Person / History dedicated routes — Phase 5
- Completion photos — v1.1
- Year-in-review — v1.1
</deferred>

---

*Phase: 03-core-loop*
*Context gathered: 2026-04-21 via autonomous yolo-mode synthesis*
