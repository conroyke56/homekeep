# HomeKeep v1.1 — Discovery Audit

**Status:** Phase A complete. **No code changes made.** Awaiting user review before Phase B.
**Scope:** 5 proposed improvements + 2 cross-cutting questions.
**Reviewer:** Read this top-to-bottom; the cross-cutting questions inform every idea below.

---

## 0. Verification facts (read first — some user assumptions need correction)

| Claim | Source | Verified value | Notes |
|---|---|---|---|
| 311 unit tests | brief | **311 ✓** | `grep -rE "^\s*(test\|it)\(" tests/unit/ \| wc -l` confirms 311. |
| 23 E2E tests | brief | **23 ✓** | `tests/e2e/*.spec.ts` × 12 files, 23 `test()` invocations. |
| AGPL-3.0 license | brief | **AGPL-3.0 ✓** | `LICENSE` is GNU AGPL v3. |
| MIT license | `PROJECT.md` line 47 (`INFR-12`) AND `SPEC.md` v0.2 line 5 | **stale — drift** | Both still say MIT. Correcting these is in v1.1 scope (you asked for it). |
| `SPEC.md` exists | brief | **`SPEC.md` (repo root), v0.2 "pre-build"** | Lives at root, not in `.planning/`. v1.1 will bump to v0.3. |
| `next_due` is computed, not stored | spec | **Confirmed** | `lib/task-scheduling.ts:50-83` (`computeNextDue`). Pure fn, parameterised on `now`. |
| `@dnd-kit` is wired | (you implied uncertainty) | **Yes** — `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` already used by `components/sortable-area-list.tsx`. Drag-to-reschedule does not need a new dep. |
| `archived` mechanism exists | (relevant for Idea 1) | **Yes** — `archiveTask(taskId)` at `lib/actions/tasks.ts:260` sets `archived: true` + `archived_at`. Tasks collection has both fields (`pocketbase/pb_migrations/1714780800_init_homekeep.js`). All views filter `archived = false`. |
| Seed flow writes `last_completion` | (relevant for Idea 3) | **No** — `lib/actions/seed.ts:94-108` calls `batch.collection('tasks').create({...})` for every seed; **never inserts a completion row.** Confirmed: this is the cause of "first-due clumping". |
| Stagger/spread/distribute logic anywhere | (relevant for Idea 3) | **No matches in `lib/`.** Greenfield. |

**Implication:** Of the 5 proposed ideas, **zero are already built**. There is no partial implementation to integrate around. The ideas are well-aligned with the existing data model — they extend it rather than fight it.

---

## Q1 — Manual overrides vs. the scheduler

### What the code currently does
- `next_due` is computed every render by `computeNextDue(task, lastCompletion, now)` (`lib/task-scheduling.ts:50-83`).
  - **Cycle mode:** `(lastCompletion?.completed_at ?? task.created) + frequency_days`.
  - **Anchored mode:** `anchor_date + ceil((now - anchor_date)/freq) * freq`.
- The scheduler (`lib/scheduler.ts`) doesn't *write* schedule state anywhere — it just calls `computeNextDue` itself, compares to `now`, and decides whether to send a notification.
- The scheduler de-duplicates ntfy pushes via `(user_id, ref_cycle)` UNIQUE index where `ref_cycle = "task:{id}:overdue:{nextDueIso}"` (`lib/notifications.ts:51-76`). **One notification per `next_due` value, ever.**

### Why this matters for overrides
Today there is no "scheduled date" to override — there is only `frequency_days`, `schedule_mode`, `anchor_date`, and the latest completion. To "manually reschedule" a task in the current model, you have exactly three primitives:

1. Mutate `anchor_date` (only meaningful in anchored mode).
2. Mutate `frequency_days` (changes the cadence forever, not "this cycle").
3. Insert a completion row (shifts the cycle in cycle mode, but is a *lie* — pretends the work happened).

None of those map cleanly to "snooze this one occurrence by a week". The model needs a new primitive: a **schedule shift** — a stored offset that the next-due computation respects. This is the data-model change Q1 forces.

### Recommended semantics

| Mode | What "drag to a new month" should mean | What the next scheduler tick should do |
|---|---|---|
| **Cycle** | Shift just *this* cycle. Cadence resumes from the new date. | Respect the override on this tick. After the next completion, schedule resumes normally from `completed_at + frequency_days`. |
| **Anchored** | Same default, BUT: anchored tasks have a fixed series. A "just this time" shift breaks that series intentionally. | Respect the override on this tick. After the next completion, the *anchor sequence* re-asserts itself — i.e. the next-next-due jumps back onto the original quarterly grid, even if that's only 2 weeks later. This is the correct surprise: anchored tasks are anchored. Don't pretend otherwise. |

**Default UX:** "Snooze to [month]" — one-off, applies to this occurrence only.
**Opt-in escalation:** A second action "...and update the cadence" which, in cycle mode, also rewrites `last_completion` to align future cycles to the new rhythm; in anchored mode, rewrites `anchor_date`.

### Coverage ring impact
The coverage ring is `mean(per-task health)` where `health = clamp(1 - overdueDays / frequency_days, 0, 1)` (`lib/coverage.ts:35-61`). If a snoozed task uses the new (later) `next_due` for `health`, the ring will *not* drag down while snoozed — exactly what users want. **No formula change needed**, just plumb the override through `computeNextDue`.

### Data-model delta
**Yes — this requires schema work.** Two reasonable shapes:

- **Option A — `schedule_overrides` table.** New collection: `(id, task_id, snooze_until DATE, applies_to ENUM[next_cycle, permanent], created)`. `computeNextDue` reads the latest active override, applies it, marks it consumed when a completion lands afterward. Clean, history-preserving, supports "show all snoozes" surface later. **~1 migration, ~1 pure-fn extension, ~1 server action.**
- **Option B — Two nullable fields on `tasks`.** `snoozed_until DATE` + `snooze_consumed_at DATE`. `computeNextDue(task, lastCompletion, now)` returns `max(computedNextDue, snoozed_until)` until consumption. Smaller schema footprint but no history if you ever override more than once.

**Recommendation: Option A.** Once a user can drag dates, they will drag dates often, and they'll want a "Recent reschedules" surface in v1.2. Option B paints us into a corner.

### Verdict
- Default: **snooze-this-cycle** is the least-surprising UX. Drag is "snooze".
- Opt-in: a follow-up "...and update going forward" button changes cadence permanently.
- The ntfy `ref_cycle` already keys on the resulting `nextDueIso` — so a snooze automatically generates a *new* `ref_cycle`, and the user gets one notification at the new date. Idempotency holds for free.

---

## Q2 — Seasonal dormancy semantics

### What the code currently does
- `computeNextDue` knows nothing about months. It is purely arithmetic on `frequency_days`.
- `computeCoverage` (`lib/coverage.ts`) iterates **every non-archived task** and divides by `counted` (skipping only tasks where `nextDue === null`).
- `processOverdueNotifications` (`lib/scheduler.ts:188-257`) iterates every non-archived task and fires for any with `nextDue < now`.
- Views (BandView, By Area, Person, History) filter only on `archived = false`. There is no "dormant" rendering branch. No code mentions `seasonal`, `dormant`, `sleep`, or `inactive` outside test descriptions.

### The seven specific questions, answered

**1. Out-of-window: how does "overdue" get computed?**
Cleanest rule: **a task with `active_from_month` / `active_to_month` set is silently invisible to the scheduler when `now`'s month is outside the window.** Implementation: `isWithinSeason(task, now, timezone)` pure helper, gated at the scheduler iteration level *and* inside `computeNextDue` (returns `null` when out-of-season → already understood as "no next due" by the existing pipeline).

**2. Window re-opens — what is the first `next_due`?**
Anchor to the **first day of the new window in the home's local timezone**. Concretely: when `now` enters the window, `computeNextDue(task, lastCompletion, now)` returns `max(startOfWindow(now, task), defaultNextDue)`. This means a summer-only task waking in October is due *October 1*, not "47 weeks ago".

This rule subsumes a subtle case: if the task was completed late in the previous active window (e.g. last completion was March 28 of a Oct–Mar mowing window, then dormant Apr–Sep, window reopens Oct 1) → next_due should be Oct 1, not "April 4 + 7 days = April 11" (which was suppressed during dormancy).

**3. Coverage ring — does dormancy drag it down?**
**No.** Two ways to achieve this; pick one and document:
- **(a)** `computeCoverage` skips out-of-season tasks (treat exactly like archived). Cleanest, matches user intuition ("the lawn isn't a problem in winter").
- **(b)** Out-of-season tasks contribute `health = 1.0`. Mathematically equivalent to (a) when there's at least one in-season task; differs when ALL tasks are dormant (rare).

**Recommendation: (a)** — skip them. Identical to current archived-task handling. One-line change in `computeCoverage`'s filter.

**4. History view — gaps between seasons?**
Completions persist forever (append-only by design — `completions.updateRule = null`, `deleteRule = null`). History naturally shows: 6 completions Oct–Mar, then nothing for 6 months, then 6 more. **No gap-rendering work needed.** Optional polish later: a faint divider in the timeline labelled "spring/summer".

**5. Anchored mode interaction**
This is the trickiest case. An anchored task has a fixed series — say "service furnace every Oct 1". If `active_months = Oct-Mar` and `anchor_date = 2024-10-01` with `frequency_days = 365`, then `computeNextDue` would compute `2025-10-01`, which is *inside* the window, so dormancy never fires. **It just works.** But: if someone sets `active_months = May-Sep` on an annually-anchored Oct task, every fired anchor will land outside its own window — which is a config bug.

**Recommendation:** at form save time, validate that `frequency_days` and `active_months` are compatible — flag (don't block) when more than 50% of fired due-dates would fall outside the window. UI warning: *"This task is anchored to October but only active May–Sep. The schedule will be skipped every year."*

**6. Cross-year wrap (Oct → Mar)**
`isWithinSeason` rule:
```
function isWithinSeason(from: 1..12, to: 1..12, monthNow: 1..12): boolean {
  if (from <= to) return monthNow >= from && monthNow <= to        // May..Sep
  return monthNow >= from || monthNow <= to                        // Oct..Mar (wraps)
}
```
Single-line wrap rule, fully testable with a 12×12 matrix. December (`12`) on an Oct→Mar task: `12 >= 10 || 12 <= 3` → true. Good.

**7. `computeNextDue` for cycle-mode dormant tasks**
The current cycle-mode formula is `(lastCompletion ?? created) + frequency_days`. With dormancy, the modified formula:

```
let candidate = base + frequency_days
if (isWithinSeason(task, candidate, tz)) return candidate
// candidate falls in dormant period: snap to start of next active window
return startOfNextWindow(task, candidate, tz)
```

This handles: a 7-day mowing cycle finishing March 28 in an Oct–Mar window → naive candidate is April 4, which is dormant → snap to October 1 of the *same* year (or next year if we've already passed it).

### Data-model delta
**Yes — additive.** Two nullable integer fields on `tasks`:
- `active_from_month` (`NumberField`, `min: 1`, `max: 12`, optional)
- `active_to_month` (`NumberField`, `min: 1`, `max: 12`, optional)

Both null = current behavior (year-round). Both set = seasonal. Exactly-one-set = invalid (refine in zod). Single migration, idempotent, additive — old rows get nulls, all existing tests stay green by construction.

### Verdict
The proposal is good. The "two tasks per season" UX pattern (cool-season mow vs warm-season mow) is correct — trying to vary frequency over months in one task is a UX trap. Keep the model simple: a window, a frequency, a cadence.

---

## Idea 1 — One-off tasks

### Already-built check
- **Not built.** `frequency_days` is currently `NumberField({ min: 1, onlyInt: true })` — required, non-null. Zod also requires it (`lib/schemas/task.ts`).
- **Adjacent infra exists:** `archiveTask(taskId)` at `lib/actions/tasks.ts:260` already implements the "move to history" pattern (sets `archived: true` + `archived_at: nowISO`). Archived tasks are filtered out of every view. **Reuse this.**

### Impact check
Files touched (estimate):
- `pocketbase/pb_migrations/<new>.js` — make `frequency_days` nullable. *Caveat:* PB 0.37 requires post-construction field updates; adapt the existing pattern in 1714953605.
- `lib/schemas/task.ts` — `frequency_days: z.number().int().min(1).nullable()`. Update `.refine()` to require `frequency_days` only when not one-off, and forbid `schedule_mode = 'anchored' + frequency_days = null` (anchored requires a cadence).
- `lib/task-scheduling.ts:50-83` — `computeNextDue`: if `frequency_days === null`, return `lastCompletion ? null : task.created` (one-off pre-completion shows up immediately as overdue once `created` is past; once completed, `lastCompletion != null` → return `null` so it disappears from all views).
- `lib/coverage.ts` — already skips tasks with `nextDue === null`. ✓ no change.
- `lib/scheduler.ts:188-257` — already skips `nextDue === null`. ✓ no change. **But one-off tasks should still trigger an "overdue" notification while pending** — verify that `nextDue === task.created` correctly flows through.
- `lib/actions/completions.ts` — after writing the completion row for a one-off, also call `archiveTask(taskId)` (or set `archived` + `archived_at` in the same transaction via a batch). Atomic.
- `components/forms/task-form.tsx` — Frequency input becomes "Frequency (or one-off)". Probably a checkbox "One-off task" that disables/clears the frequency field. UI/UX Pro Max should pass over this.
- `components/task-detail-sheet.tsx` (if it surfaces frequency) — handle nullable.
- `components/horizon-strip.tsx` — one-off tasks have `nextDue = task.created` (immediate); they show up in the current month. After completion, they don't appear. ✓ correct by construction.

### Design critique
- **Net positive.** "Replace smoke detector battery this week" is an obvious gap and PWA-aligned.
- **One subtle question:** should one-off tasks appear in the History view alongside recurring? Yes — completions are completions, and the History timeline already groups by date, not by task type.
- **One subtle question:** what happens if a one-off task is *un-archived*? Today there's no UI for unarchive (Agent 2 confirmed). For v1.1, recommend keeping it that way — one-offs are intentionally fire-and-forget.
- **Push back on:** the brief says "On completion, task archives (moves to history)". I'd phrase it as "archives" only — "moves to history" implies a separate state. The existing `archived = true` + filter-out behavior IS the "moves to history" semantic. Don't invent a new state.
- **Edge case:** what if someone creates a one-off, never completes it, and it sits there forever? It will accrue overdue ntfy spam (one notification when `task.created < now`, and then forever — except the existing `(user_id, ref_cycle)` dedup prevents repeats since `ref_cycle = task:{id}:overdue:{nextDueIso}` and `nextDueIso = task.created` never changes). ✓ already handled.

### Effort
**Small.** ~1 migration, ~1 schema tweak, ~1 pure-fn branch, ~1 server-action coupling, ~1 form field, ~5 new tests. **Estimate: 1 plan, ~half a day.**

### Data-model delta
- `tasks.frequency_days` → nullable (was required, min 1).

---

## Idea 2 — Task-level `preferred_days`

### Already-built check
- **Not built.** No code references `preferred_days`, `weekend`, `weekday`, or weekday-aware scheduling.

### Impact check
Files touched:
- `pocketbase/pb_migrations/<new>.js` — add `preferred_days` SelectField (`any`/`weekend`/`weekday`), default `any`.
- `lib/schemas/task.ts` — add field.
- `lib/task-scheduling.ts` — extend `computeNextDue` to accept a preference and nudge ±1 day. **This is the load-bearing question:** see critique below.
- `components/forms/task-form.tsx` — add a small toggle.
- Tests — at least 8 new cases (cycle/anchored × any/weekend/weekday × edge cases).

### Design critique — push back recommended
This is the most fragile of the five proposals.

**Problem 1 — what does "nudges ±1 day" actually mean?**
The current `computeNextDue` returns ONE `Date` from a pure function. For "nudge to weekend if possible", the function would need to:
- Compute the natural `nextDue`.
- Check if its weekday matches the preference.
- If not, search ±1 day for a match.
- If still not (e.g. `weekend` preference, natural date is a Wednesday), give up and return the natural date? Or search wider?

A pure ±1 day window helps almost nothing: a Wednesday is 3 days from Saturday. So "preferred" becomes "preferred only when the natural date is already adjacent to the preferred range" — which sounds like a no-op for most tasks.

**Problem 2 — drift accumulates.**
If the preference shifts the date by +1, the next cycle's base is `completion_date + frequency_days`. Either:
- (a) The user completes on the nudged date → cycle rebases to `nudged + freq` → next time, the nudge is from a different starting point. Drift compounds over the year.
- (b) We *recompute* from an "ideal" cadence ignoring nudges → contradicts "next_due is computed from `last_completion + frequency_days`". Requires storing an ideal-cycle anchor separately.

**Problem 3 — interacts with weekly-frequency tasks awkwardly.**
A 7-day task always lands on the same weekday. A `weekend` preference on a 7-day task either:
- Always nudges (if the cycle started on a Wednesday) → effectively becomes an 8-day task forever.
- Never nudges (if the cycle started on a Saturday) → ✓ but the user got that for free by completing on Saturday once.

So `preferred_days` is meaningfully different from "complete on a Saturday" only for tasks whose `frequency_days` is NOT a multiple of 7.

**Problem 4 — UX trap.**
A small toggle on the task form gives no preview. The user toggles "weekend" and gets... what? They have to wait for the next due date to find out the toggle did anything. Discoverable UX would need a hint like "Tasks will land on Sat/Sun when possible".

### Suggested reshape
Two saner alternatives to put on the table for Phase B:

- **(A) Drop it for v1.1.** Q1 (manual snooze) gives users the same outcome on demand: drag the dishwasher-cleaning to Saturday once, every cycle thereafter rebases off Saturday. No new field needed.
- **(B) Replace with a `preferred_weekday` field** (1-7 or null). Wider semantic: nudge up to ±3 days to land on the preferred weekday, drop the nudge if it'd drift the date by more than 25% of `frequency_days`. Still has drift problems but at least gives users a meaningful knob.

### Effort if kept as-proposed
**Medium.** Pure-fn complexity is bounded but the drift/preview design needs UX work. ~1 plan, ~1 day. **Net value: questionable.**

### Data-model delta
- `tasks.preferred_days` SelectField, optional. Defaultable, additive.

### Recommendation
**Defer to v1.2 or drop.** The cost-to-value ratio is the worst of the five.

---

## Idea 3 — First-run offset algorithm

### Already-built check
- **Not built.** `lib/actions/seed.ts:94-108` writes `tasks` only — no completion rows. No `stagger`, `spread`, `distribute`, or "first_due_offset" appears anywhere in `lib/`.
- Confirmed mechanism: every seeded task's `next_due = task.created + frequency_days`. Seeding 30 tasks at 12:00:00 on May 1 → all 30 next-dues are exact-time-of-day stacked across various days. The user's pain ("clumps on day 1") is real for *frequency cohorts*: e.g. all 7-day tasks land same-day, all 14-day tasks land same-day, etc.

### Impact check
Files touched:
- `lib/actions/seed.ts:90-113` — extend the batch loop to also write a synthetic completion row per task with `completed_at = now - offset` so that natural `nextDue = (now - offset) + frequency_days` distributes due dates across the upcoming cycle.
- `lib/seed-offset.ts` (new) — pure offset-computation helper. Important: must respect Idea 5's seasonal window. Pseudo:
  ```ts
  function computeSeedCompletionOffset(
    task: { frequency_days: number, active_from_month?: 1..12, active_to_month?: 1..12 },
    now: Date,
    timezone: string,
    indexInCohort: number,    // 0-based within same-frequency group
    cohortSize: number,
  ): { syntheticCompletedAt: Date }
  ```
- `tests/unit/seed-offset.test.ts` — distribution test (no two tasks with same `frequency_days` produce same `nextDue`), seasonal-respect test (no offset can place `nextDue` outside `active_months`).
- `lib/actions/seed.ts` — second collection write per task in the batch. **Critical:** completions are append-only and the createRule requires `completed_by_id = @request.auth.id` (`pocketbase/pb_migrations/1714867200_completions.js`). The seed flow uses an authenticated user pb client, so this works — but: do we want History to show "user X completed 30 tasks just now"? **Probably not.** Synthetic completions will pollute History and the user's personal stats.

### Design critique — major UX issue with the proposed mechanism
The brief proposes synthetic completions but doesn't address: **synthetic completions are visible.** They will:
- Appear in the History timeline as 30 fake completions on day 1.
- Inflate the user's PERS-03 personal-stats counts.
- Show up in weekly summaries for partners ("@user did 30 tasks this week!").
- Trigger the partner-completed notification path if any partner has it on (NOTF-05).
- Trigger the area-100% celebration if a single completion of an empty area pushes coverage to 1.0.

**Two cleaner alternatives:**

- **(A) Add a `via` enum value.** `completions.via` is currently `'tap' | 'manual-date'`. Add `'seed-stagger'`. Filter History/stats/notifications to exclude `via = 'seed-stagger'`. This is the smallest semantic shift and preserves the synthetic-completion approach.
- **(B) Don't write completions; write `last_completion_override` directly to tasks.** Add a nullable `seed_offset_anchor` DateField on tasks. `computeNextDue` reads it as a base when `lastCompletion === null`. Migrations get heavier; no completion pollution. **My pref: (A).** Smaller schema delta, named-and-traceable, easy to filter.

### Cross-cutting interactions
- **Q1 (overrides):** independent — happens after onboarding.
- **Q2 (seasonal):** the offset MUST respect the active window. A summer-only task seeded in March cannot get a March synthetic-completion that would push `nextDue` to April-still-dormant. The offset helper needs the season-aware computation from Q2.

### Effort
**Small-medium.** Pure offset fn + seed.ts wiring + History filter + 1 migration (only if going with via=seed-stagger). ~1 plan, ~half a day plus one for tests.

### Data-model delta
- `completions.via` SelectField — add value `'seed-stagger'` to the enum.

### Net value
**Yes, ship it.** Every onboarding user benefits. UX win is large for ~half a day of work.

---

## Idea 4 — Manual drag-to-reschedule in Horizon view

### Already-built check
- **Drag infra: yes.** `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` already installed. `components/sortable-area-list.tsx` (202 lines) is a working reference: stable IDs (`useSortable({ id: area.id })`), optimistic UI, server rollback. New drag UI does NOT need a new dep.
- **Override mechanism: not built.** No `snooze`, `reschedule`, or `override` in `lib/`.
- **Horizon view: display-only.** `components/horizon-strip.tsx` renders a 12-cell month grid. Cells are buttons that open a bottom Sheet listing tasks for that month. Tap-target is the cell, not individual tasks. **There is no per-task draggable element in Horizon today.**

### Impact check
Files touched:
- `pocketbase/pb_migrations/<new>.js` — new `schedule_overrides` collection per Q1 Option A.
- `lib/schedule-overrides.ts` (new) — pure helper: `applyOverride(nextDue, override, lastCompletion)`.
- `lib/task-scheduling.ts:50-83` — `computeNextDue` consults an override before returning. **Signature change** — adds an `override?: Override` parameter. Every caller (`lib/coverage.ts`, `components/horizon-strip.tsx`, `lib/scheduler.ts`, all server pages computing band classification) must thread it through. **This is the biggest reach** of any v1.1 idea.
- `lib/actions/snooze.ts` (new) — server action `snoozeTask(taskId, newDate, mode: 'this_cycle' | 'permanent')`.
- `components/horizon-strip.tsx` — substantial rework. Currently the sheet drawer lists tasks; for drag-to-reschedule, EITHER:
  - **(a)** Make individual tasks draggable INSIDE the sheet drawer, drop targets are other month cells. Mobile-friendly because drag happens in the drawer (large UI).
  - **(b)** Make the closed Horizon strip itself drag-accept (drag a task FROM the dashboard's Overdue/This Week band INTO a Horizon cell). Cross-component drag — much more complex with `DndContext` boundary issues.
- `components/sortable-area-list.tsx` — pattern reused (DnD provider + Optimistic + rollback).
- `components/extend-window-dialog.tsx` (new) — confirmation dialog modeled on `EarlyCompletionDialog`. Reusable Radix Dialog pattern.
- 8+ new tests (override application, drag E2E, season-window guard).

### Design critique — push back on the UX choice
**A 12-month strip is bad drag-target UX on mobile.**
- 12 cells in 6×2 (mobile) means each cell is ~58px wide on iPhone SE. Tasks per cell = often 2-4. Tap-and-drag a task from cell 3 (May) to cell 9 (November) requires either a long-press trigger that competes with the existing tap-to-open-sheet gesture, or a dedicated "Edit horizon" mode.
- The proposal says "tap-drag a task in the 12-month strip" but the strip currently has NO per-task UI at the cell level — only dot-indicators (max 3 dots, then `+N`). To drag a task you must first open the sheet. So the actual gesture is: tap cell → sheet opens → drag task within sheet → drop into another cell visible behind the sheet? That's a Radix Sheet over a backdrop. Drag through the backdrop is fragile.

**Two cleaner alternatives:**

- **(A) Drag inside the sheet, drop on a re-rendered mini-strip *inside* the sheet.** Open a month → see tasks for that month → drag any task to a small in-sheet 12-cell row. No backdrop drag, no precision issue.
- **(B) Skip drag entirely. Add a "Snooze" button per task in the sheet (and in `TaskDetailSheet`).** A simple action sheet: "Snooze 1 week", "Snooze 1 month", "Pick a date". Solves the same user problem (move this task somewhere later) without drag UX cost. Drag is sexy in a demo and frustrating on a 6.1" phone.

I'd push hard for **(B)**. Drag-to-reschedule in a 12-month overview is a desktop-power-user feature for an app that's mobile-first PWA-shaped.

### Cross-cutting interactions
- **Q1:** This idea IS the surface for Q1's override semantics. They are inseparable — ship Q1's data model with this idea.
- **Q2 (seasonal):** the proposal correctly says drag mustn't escape the active window without explicit confirm. Implement as a guard in the server action: if `newDate` outside `active_months`, return `{ requiresConfirm: true, reason: 'extend_window' }`; client renders an `ExtendWindowDialog` that, on confirm, BOTH applies the override AND extends `active_to_month` (or shifts `active_from_month`).
- **Coverage ring:** snoozed tasks → new `nextDue` → no overdue penalty → ring stays high. ✓ matches user intuition.
- **Scheduler:** the new `nextDue` after a snooze creates a new `ref_cycle` for ntfy. ✓ idempotent re-firing.

### Effort
**Large.** Bigger than the other four combined IF kept as drag-from-strip. ~3-4 plans:
1. `schedule_overrides` migration + `computeNextDue` extension (signature change touching ~8 files).
2. `snoozeTask` server action + `ExtendWindowDialog` reuse pattern.
3. Drag UI in HorizonStrip OR snooze action surface.
4. E2E coverage.

If reshaped to **(B) action-sheet snooze**: drops to **medium**, ~2 plans, half the surface area.

### Data-model delta
- New collection `schedule_overrides` (per Q1 Option A).
- `computeNextDue` signature change — touches every caller.

### Recommendation
**Re-shape, then ship.** Keep Q1's data model. Drop the drag gesture; ship a snooze action. Re-evaluate drag in v1.2 when there's user telemetry on whether anyone wants it.

---

## Idea 5 — Seasonal tasks (active-months window)

### Already-built check
- **Not built.** No `active_from_month`, `active_to_month`, `season`, or related fields.
- Seed library has lawn-care tasks (`seed-mow-lawn`, 14-day cycle) but no seasonal pairing.

### Impact check
Files touched:
- `pocketbase/pb_migrations/<new>.js` — add `active_from_month` + `active_to_month` (`NumberField`, `min:1, max:12`, both nullable).
- `lib/schemas/task.ts` — add fields, `.refine()` rule: both null OR both set, both ints in [1,12].
- `lib/season.ts` (new) — pure helpers: `isWithinSeason(from, to, monthNow)`, `startOfNextWindow(from, to, now, timezone)`. Per Q2.
- `lib/task-scheduling.ts:50-83` — `computeNextDue` calls `isWithinSeason` and `startOfNextWindow`. Signature unchanged (already has `task` and `now`). **This is the smallest reach** for Idea 5.
- `lib/coverage.ts:35-61` — filter step adds `&& isWithinSeason(t, now, tz)`. One line.
- `lib/scheduler.ts:188-257, 261-363` — same filter.
- `components/horizon-strip.tsx` — bucketing already uses `formatInTimeZone`; out-of-season tasks return `null` from `computeNextDue` so they auto-disappear from buckets. ✓ no change.
- `components/forms/task-form.tsx` — new optional "Active months" section with a simple from/to month dropdown pair.
- `components/task-detail-sheet.tsx` — surface "Sleeps until [month]" badge for dormant tasks.
- `components/by-area/area-card.tsx` and `components/person/person-task-list.tsx` — add the dimmed + badge rendering branch for dormant tasks. **NB:** today these views filter to only-active tasks (`archived=false`); seasonal tasks are NOT archived — they need to appear, just dimmed. So the filter widens but the renderer narrows. New rendering branch.
- `lib/seed-library.ts` — add `active_from_month?` and `active_to_month?` fields to the SeedTask type. Add the four seasonal seed tasks (mow lawn warm/cool season, heater filter winter, AC service pre-summer).
- ~12 new unit tests (12×12 wrap matrix at minimum), 2 new E2E (seasonal task lifecycle, seed library includes seasonal pairs).

### Design critique
- **Strongly positive.** Solves a real, recurring user complaint ("the lawn isn't a problem in winter, why is it red?"). Two-tasks-per-season pattern is the right UX call — keeps the data model boring.
- **Push back on:** the brief says seasonal tasks render dimmed in By Area / Person views. **Question:** do they appear in History when dormant? Yes — completions are evergreen. Don't dim History entries based on current month; the entry was a real completion at a real point in time.
- **Push back on:** the "Sleeps until [month]" badge needs to specify the YEAR if the wake-up is far enough away. "Sleeps until October" in mid-October is confusing if it means *next* October. Concrete copy: "Sleeps until Oct 1" (current season) or "Sleeps until Oct 2026" (future).
- **One subtle question:** what if a user marks a dormant task done? Today, completing a task is one tap. If a seasonal task is dimmed, should the tap-target be disabled? Or should completing a dormant task reset its season? Recommendation: tap is disabled in views; only the detail sheet has a "Mark done anyway (out of season)" option, which writes a completion but doesn't shift the next active window. Cycle rebases off the completion *for the next time the season is active*.
- **Validation interaction with anchored mode:** see Q2 §5. Form should warn if anchor + season produces an always-dormant series.

### Cross-cutting interactions
- **Q2:** This idea IS Q2. Inseparable.
- **Idea 3 (seed offset):** seasonal seed tasks need their offset computation to land within the active window. The seed-offset helper signature already includes `task` per my Idea 3 spec — it has the season fields. ✓ composable.
- **Idea 4 (drag/snooze):** snoozing a task inside its window is fine. Snoozing a task to outside its window triggers the `ExtendWindowDialog` (per Idea 4 critique). ✓ composable.
- **Coverage ring:** dormant tasks excluded from `computeCoverage` mean. ✓ user intuition.

### Effort
**Medium.** ~2 plans:
1. Migration + schema + `lib/season.ts` + `computeNextDue` integration + scheduler/coverage filter + tests.
2. Form UI + view rendering (dimmed badge) + seed library extension + E2E.

### Data-model delta
- `tasks.active_from_month` — NumberField, nullable, `min:1, max:12`.
- `tasks.active_to_month` — NumberField, nullable, `min:1, max:12`.
- `lib/seed-library.ts` SeedTask type adds two optional fields.

### Recommendation
**Ship in v1.1.** Largest UX payoff per migration delta of any of the five.

---

## Roll-up

### Data-model deltas (consolidated)

| Migration | Collection | Field / Change | Default | Source idea |
|---|---|---|---|---|
| `<ts>_one_off_tasks.js` | `tasks` | `frequency_days` → nullable | (no backfill) | Idea 1 |
| `<ts>_completions_via_seed.js` | `completions` | `via` enum gains `'seed-stagger'` | (no backfill) | Idea 3 |
| `<ts>_seasonal_tasks.js` | `tasks` | `active_from_month` (NumberField, min:1, max:12, nullable), `active_to_month` (same) | both null = year-round | Idea 5 |
| `<ts>_schedule_overrides.js` | new `schedule_overrides` | `(id, task_id, snooze_until, applies_to enum, consumed_at, created)` | empty table | Idea 4 (Q1) |

All four migrations are **additive and backward-compatible**. No existing column types change semantics; nullable additions never invalidate v1.0 data; the new collection is empty by default. **A v1.0 install upgrading to v1.1 will lose nothing.**

### Cross-checks against constraints

| Constraint | Verdict |
|---|---|
| No breaking changes to v1.0 data | ✓ All migrations additive. |
| No new external dependencies | ✓ `@dnd-kit` already installed; everything else is pure Next.js + Zod + PB. |
| Coverage ring math intact | ✓ Formula unchanged; filter widens to skip dormant. |
| Early-completion guard intact | ✓ `shouldWarnEarly` untouched. |
| 311 unit + 23 E2E tests pass | ✓ All existing tests run on unchanged fields; nullable additions don't affect them. New tests added for new behavior. |
| SPEC.md → v0.3 with changelog | ⚠ Bundle into the milestone-completion phase; SPEC.md also needs **MIT → AGPL-3.0 fix** (current drift). |
| AGPL-3.0 compat | ✓ All changes in-tree. |

### Recommended scope shape for Phase B

**Strong yes for v1.1:**
- Idea 1 (one-off tasks) — Small, high-clarity payoff.
- Idea 3 (first-run offset, with `via='seed-stagger'`) — Small, large UX win, every onboarding user benefits.
- Idea 5 (seasonal tasks) — Medium, biggest payoff per migration.
- Q1 + Q2 data models — load-bearing for everything.
- SPEC.md → v0.3 with MIT→AGPL fix and changelog.

**Reshape before deciding:**
- Idea 4 (drag-to-reschedule) — recommend reshape to action-sheet **snooze** instead of drag-in-strip. Same user problem solved at half the cost.

**Defer or drop:**
- Idea 2 (`preferred_days`) — drift problems, weak UX preview, marginal value over manual snooze. Recommend defer to v1.2 or drop.

### What to discuss in Phase B
1. **Q1 data model:** Option A (`schedule_overrides` table) vs Option B (two nullable fields). Vote.
2. **Q1 default semantics:** "snooze just this cycle" vs "shift permanently". Confirm just-this-cycle.
3. **Idea 2 fate:** drop, defer, or reshape.
4. **Idea 4 fate:** drag UI vs action-sheet snooze.
5. **Idea 3 mechanism:** `via='seed-stagger'` filter vs `seed_offset_anchor` field. Confirm `via`.
6. **SPEC.md license fix:** confirm scope (1-line change, AGPL-3.0).
7. **Test budget:** estimated ~30-40 new unit tests + ~6 new E2E. OK?
8. **Phase numbering:** continue from Phase 7 (next phase = 8) or reset to 1?

---

**Phase A complete. No code touched. Awaiting review before Phase B.**
