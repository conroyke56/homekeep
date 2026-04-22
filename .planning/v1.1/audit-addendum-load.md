# HomeKeep v1.1 — Audit Addendum: Household Load-Aware Scheduling

**Status:** Phase A redux. **No code changes made.** Awaiting user review before any roadmap or REQUIREMENTS revision.
**Triggered by:** User re-read SPEC.md and original requirements; original audit's per-task flexibility features (Ideas 1-5) don't deliver the product thesis ("spread the year's work evenly across weeks"). Tasks must know about each other.
**Companion to:** `.planning/v1.1/audit.md` (original 5-idea audit, all decisions still valid).

---

## 0. The thesis correction

The original audit framed v1.1 as five additive task properties. That's task-local thinking. The product thesis from PROJECT.md is **household-global load smoothing** — the household's recurring maintenance is *evenly distributed*, not just visible. A household with 40 tasks all due on the same Sunday is not "evenly distributed" no matter how nicely each individual task is configured.

`computeNextDue(task, lastCompletion, now)` is the wrong abstraction once tasks know about each other. The new abstraction is:

```
placeNextDue(task, householdLoad, now): Date
```

Where `householdLoad` is "all other tasks' next-due dates within the relevant window". That changes the physics of every other v1.1 idea — `preferred_days` becomes a candidate-narrowing step before load check, snooze becomes a user-initiated override that load-smoothing must respect, and seasonal dormancy interacts with smoothing at season boundaries.

**This addendum doubles v1.1's scope.** Confirmed accepted in user brief.

---

## 1. What changes vs. original audit

### Adding (3 new categories)
- **LOAD** — Household load-aware placement algorithm replacing naive `last_completion + frequency_days`
- **LVIZ** — Horizon density visualization showing load per month
- **TCSEM** — Task creation semantics with optional "Last done" field and smart-default first-due

### Removing
- **SDST** (seed-stagger first-run offset) — superseded by TCSEM. The synthetic `via='seed-stagger'` completion was a special-case hack for one symptom (onboarding clumping). TCSEM solves the general case (all task creation goes through load-smoothed placement). Bulk onboarding becomes "create tasks individually, each routed through TCSEM" and the load-smoother handles distribution naturally.

### Reframed (no scope change, but semantics shift)
- **PREF** is now a *narrowing constraint applied before load check*, not a standalone post-pass nudge.
- **SEAS** wake-up gets explicit interaction with the smoother (anchor to window start, then smooth subsequent cycles).
- **SNZE** trumps load-smoothing — user intent always wins.
- **OOFT** contributes to density on its due date but is itself non-smoothable.
- **Anchored mode** is now the explicit opt-out for users who want fixed cadence.

### Net REQ-ID delta
Original v1.1: 40 REQs across 6 categories.
Revised v1.1: roughly 55-60 REQs across 8 categories (-7 SDST, +~22 LOAD/LVIZ/TCSEM).

---

## 2. Pivotal architectural decision: where does the smoothed date live?

The user's Q3 says "next_due is now fuzzy — is that a problem?". It's only fuzzy if we don't pick a storage strategy. Five options I considered:

| Option | Storage | Pro | Con |
|---|---|---|---|
| (a) `tasks.next_due_override DATE` | Per-task field | Single source of truth, fast read | Tasks change shape every cycle; loses audit trail |
| (b) `tasks.smoothing_offset_days INT` | Per-task field | Tiny field, derivable | Doesn't survive cycle change; constant rewrites |
| (c) Recompute on every render | No storage | Pure | 40+ task placement calc per render = >100ms |
| (d) `completions.smoothed_next_due DATE` | Per-completion field | Audit trail intact, computed once | Requires reading latest completion to get next_due |
| (e) `tasks.next_due_smoothed DATE` | Per-task field, set by TCSEM + LOAD | One field, set on creation AND completion, simple read | Rewrites on each completion; must NULL-default for v1.0 backcompat |

**Recommendation: (e) `tasks.next_due_smoothed DATE` (nullable).**

Rationale:
- **TCSEM needs it.** New tasks have no completion yet; they need a placement decision recorded somewhere. (d) doesn't work for new tasks.
- **One field beats two.** (d) would require both a per-completion field AND a per-task `first_due` for new tasks. Two storage locations for one concept = bug surface.
- **NULL-default preserves v1.0 backcompat.** Existing v1.0 tasks read NULL → fall back to `naturalNextDue(task, lastCompletion)`. Zero migration scripts needed. After their next post-upgrade completion, LOAD writes a value.
- **Read path stays cheap.** `computeNextDue` becomes:
  ```typescript
  function computeNextDue(task, lastCompletion, now, override?: Override): Date | null {
    if (override && !override.consumed_at) return new Date(override.snooze_until);
    if (task.next_due_smoothed) return new Date(task.next_due_smoothed);
    return naturalNextDue(task, lastCompletion);  // existing v1.0 logic
  }
  ```
  Three short-circuiting branches, no schema changes to existing fields.
- **Snooze (SNZE) trumps cleanly.** The override branch fires before the smoothed branch. User intent wins, as required.

**One subtle question:** when `next_due_smoothed` is set, what triggers it to update? Two events:
1. Task created → TCSEM places initial value.
2. Task completed → LOAD computes next cycle's value, written in same batch as completion.

What about *other tasks getting created* affecting *this task's* placement? See Q3.5 (forward-only smoothing) — answer is no, retroactive ripples are explicitly rejected.

---

## Q3 — Load-smoothing semantics

### Q3.1 — How does "load" get computed?

**Recommendation: per-day count, no weighting.** Per user's "v1.1 NOT adding" list: "single-weight placement for v1.1. Load = task count, not effort-weighted count."

Concretely:
```typescript
function computeHouseholdLoad(
  tasks: Task[],
  now: Date,
  windowDays: number = 90,  // look 90 days forward
): Map<string, number> {  // YYYY-MM-DD → task count due that day
  const load = new Map<string, number>();
  for (const t of tasks) {
    if (t.archived) continue;
    if (!isWithinSeason(t, now)) continue;
    const dueDate = computeNextDue(t, latestCompletion(t), now);
    if (!dueDate) continue;
    const key = formatInTimeZone(dueDate, home.timezone, 'yyyy-MM-dd');
    load.set(key, (load.get(key) ?? 0) + 1);
  }
  return load;
}
```

**Granularity:** per-day. Per-week would smooth at the wrong granularity ("Monday has 3, Tuesday has 1" feels different from "this week has 7").

**Tiebreaker rules (when multiple days in window have equal load):**
1. **Closest-to-ideal wins** — minimize displacement from naive `last_completion + frequency_days`.
2. **Earlier wins** — never push tasks later than necessary; biased toward "do it sooner" over "do it later".

### Q3.2 — What if the tolerance window has no sparse slot?

The window always contains *some* days; the question is what to do when every day has equal (high) load. Per Q3.1's tiebreaker: pick closest-to-ideal. The smoother doesn't widen its window — that would defeat the "spread evenly" promise (running the smoother over the entire year compresses the schedule into the algorithmic equivalent of clumping it everywhere).

**UI honesty:** if the smoother picks the ideal date (no improvement found), don't show a "rebalanced" badge. Only badge when displacement > 0.

### Q3.3 — Coverage ring math interaction

**No formula change needed.** Coverage = `mean(per-task health)` where `health = clamp(1 - overdueDays / frequency_days, 0, 1)`. The smoother only affects *what date is in `next_due`* — once stored in `next_due_smoothed`, the coverage ring reads it and computes health normally.

Subtle case: if smoothing pushes a task ±3 days from ideal, `overdueDays` is computed against the *smoothed* date, not the ideal. So a smoothed task is on-schedule (`overdueDays = 0`) until its smoothed date passes, even if the ideal date already passed. **This is the right behavior** — the smoother explicitly rescheduled the task, so the schedule of record is the smoothed one.

### Q3.4 — UI copy: how do users see this?

**Recommendation: discreet badge on shifted dates, expanded reason in TaskDetailSheet.**

```
Main view (BandView, By Area):
  "Tue Jun 11 ⚖️"        (shifted from ideal)
  "Mon Jun 10"            (no shift; no badge)

Tooltip on ⚖️ icon:
  "Rebalanced from Sun (Sunday already had 4 tasks)"

TaskDetailSheet:
  Section: Schedule
    Ideal: Sun Jun 9
    Scheduled: Tue Jun 11 (shifted +2 days to balance the week)
    [Reschedule] [Mark done]
```

**Show only when displacement > 0.** A task that lands on its ideal date shows nothing different from v1.0. The badge surface is small and signals only when there's a story to tell.

**Copy decisions:**
- "Rebalanced" — neutral, technical-but-friendly
- Avoid "moved", "shifted" — implies user action when it was algorithmic
- Avoid "smoothed", "load-balanced" — system-y jargon
- ⚖️ icon (lucide `scale`) — visual mnemonic for balance

### Q3.5 — Re-smooth retroactively or only forward?

**Recommendation: forward-only.**

**Forward-only** means: when a task is created or completed, the smoother runs *for that task only*. Existing `next_due_smoothed` values on other tasks are untouched.

Reasons to reject retroactive smoothing:
1. **Predictability > optimality.** Users will be more upset by silent date shifts on existing tasks than by suboptimal global distribution. "Why did my Tuesday clean move to Wednesday?" with no user action = trust loss.
2. **Cascading ripples.** Adding one task could shift 5 others, each of which would need re-notification considerations (ntfy ref_cycle invalidation), conflict with snooze overrides, etc. Surface area explodes.
3. **Performance.** 100 tasks × 100ms placement = 10s on every task creation. Even with memoization, the cascade is unbounded.
4. **Conflicts with SNZE semantics.** A snoozed task has user-explicit dating — if the smoother shifts other tasks around it, the snooze becomes inconsistent with the new distribution.

**Escape hatch:** add an explicit "Rebalance schedule" action in Settings for power users who want to re-smooth their entire schedule after major changes (e.g. completing onboarding, deleting many tasks). Single-click, runs the smoother for every non-archived task in dependency order. Out of scope for v1.1's first cut — defer to v1.2 unless there's a strong reason to ship it now.

### Q3.6 — Performance

**Single-task placement (the hot path):**
- Compute load map: 1 PB query (`tasks` filtered by home + season-active + archived=false), in-memory iteration
- Score each candidate date in tolerance window (±5 days = 11 candidates), apply PREF narrowing
- Return chosen date
- **Estimate: <20ms for 100 tasks** (single PB roundtrip dominates)

**Aggregate consumers (BandView, scheduler):**
- Don't run the placement algorithm. They read the already-stored `next_due_smoothed` field.
- **Zero additional cost over v1.0** at read time.

**Memoization:** not needed. Placement is O(1) cycles per task event (creation, completion). Each call is independent. Caching would add staleness risk for negligible benefit.

**Constraint check:** user said "<100ms for a household with 100 active tasks." A single placement call is well under. The expensive path would be retroactive smoothing (rejected per Q3.5). Forward-only keeps us under budget by construction.

---

## Q4 — Interaction with other v1.1 features

### Q4.1 — Snooze (SNZE)

**User intent always wins.** When the user snoozes a task to a specific date, the smoother does NOT second-guess. The snooze date is honored. After the snooze override is consumed (by the next completion), the smoother resumes for the *next* cycle.

Concretely: `computeNextDue` reads override BEFORE `next_due_smoothed`. Override branch returns first.

**Reshuffling around snoozes:** the smoother does NOT re-place other tasks to compensate for a snoozed task. Snoozes contribute to the load map (the snoozed date counts as a "task due" on that day), so future placements naturally avoid clumping into the snoozed slot. But existing tasks aren't shifted.

### Q4.2 — Seasonal re-entry (SEAS)

When a seasonal task wakes up in October:
1. **Anchor to window start.** Per original audit Q2: `computeNextDue` returns `startOfWindow(now, task)` as the first next_due in the new active period.
2. **Smoother runs at first completion in the new window.** The October 1 anchor places the task at the start of the season. When the user completes it, LOAD picks the next cycle's date with smoothing applied.

**Edge case:** if `startOfWindow` lands on a heavily-loaded day, the season-start anchor "wins" over smoothing. Wake-up day is precise. The first POST-wake-up cycle is when smoothing kicks in. This is the right call — users expect "the lawn becomes a thing again on October 1", not "the lawn becomes a thing again on October 4 because Wednesday had 2 things".

### Q4.3 — Preferred days (PREF)

**Confirmed user instinct: PREF is evaluated BEFORE load check.**

Algorithm:
```
1. Compute ideal date = last_completion + frequency_days
2. Generate candidate dates = [ideal - 5d ... ideal + 5d]  (tolerance window)
3. If preferred_days is set:
     candidates = candidates.filter(d => matchesPreferredDays(d, preferred_days))
4. If candidates is empty (PREF eliminated everything in the window):
     widen search forward in 1-day increments until a matching weekday is found,
     up to a hard cap of +6 days from the natural ideal (matches PREF-02 cap from main audit)
5. Score remaining candidates by load
6. Pick lowest-load (tiebreak: closest to ideal, then earlier)
```

**PREF as hard constraint persists.** PREF narrows BEFORE load. If "weekend" PREF eliminates Mon-Fri from the window, the smoother only chooses among Sat/Sun.

### Q4.4 — One-off tasks (OOFT)

**Confirmed: contribute to density, but not re-smoothable themselves.**

- A one-off task with `next_due = task.created` (immediate) contributes 1 to the load on `task.created`'s day.
- TCSEM does NOT smooth one-off tasks at creation — a one-off is "do this thing", and shifting it days later would be wrong (the user wanted it done sooner). One-offs land on their natural date.
- After completion, one-off tasks auto-archive (per OOFT-02), so they leave the load map.

**Subtle consequence:** if a household creates 5 one-off tasks at once (e.g. a moving-in checklist), they all land on day-zero in the load map. The smoother doesn't help here. But the SPEC's "evenly across weeks" promise was about *recurring* maintenance, not one-off chores. Users adding 5 one-offs in a row are explicitly opting out of cadence.

### Q4.5 — Anchored mode

**Confirmed: explicit opt-out from smoothing.**

```
if (task.schedule_mode === 'anchored') {
  // No smoothing. anchor_date + cycles formula, byte-identical to v1.0.
  return naturalAnchoredNextDue(task, now);
}
```

Anchored tasks STILL contribute to the load map (they take real time slots), so cycle-mode tasks AROUND them get smoothed away. But anchored task placement is fixed.

**UI hint:** the task form should explicitly mention "anchored = fixed cadence, won't be auto-rebalanced" so users picking anchored understand they're opting out.

---

## Q5 — Task creation semantics and migration

### Q5.1 — "Last done" field UX

**Recommendation: optional field in Advanced collapsible section, default collapsed.**

```
Task form (cycle mode shown):
┌────────────────────────────────────────────┐
│ Name:        [Mow lawn          ]          │
│ Area:        [Yard          ▾   ]          │
│ Frequency:   [14 days       ]              │
│ ...                                        │
│ ▸ Advanced  (last done, anchor, etc.)      │
│   [collapsed by default]                   │
└────────────────────────────────────────────┘

Expanded:
│ ▾ Advanced                                 │
│   Last done:  [optional date]              │
│              "When was this task last       │
│               completed? Leave blank for    │
│               smart default."               │
│   Notes: ...                                │
```

Most users never expand Advanced. Power users (migrating from a paper system, recreating a task, recording a recently-done chore) use it. Smart default (next sub-question) handles the rest.

### Q5.2 — Smart default first-due (TCSEM)

When "Last done" is blank, TCSEM picks the first due based on cycle length:

| Cycle length | First-due suggestion (then load-smoothed) |
|---|---|
| ≤7 days (daily/weekly) | Tomorrow |
| 8-90 days (biweekly to quarterly) | ~cycle/4 from now |
| >90 days (quarterly+) | ~cycle/3 from now |

Then the smoother shifts within tolerance to pick a sparse slot.

**Rationale for the divisors:**
- Short cycles want to be "engaging soon" — tomorrow keeps the user oriented.
- Medium cycles want enough breathing room not to land on day 1 (the original clumping problem) but not so far out that the user forgets they made the task. Quarter-cycle is a recognizable interval.
- Long cycles need wider distribution; third-cycle out gives a comfortable buffer.

**Anchored-mode tasks with no "last done"**: anchored requires `anchor_date`, which is the source of truth. "Last done" doesn't apply. If anchor_date is in the future, that's the first due. If it's in the past, formula picks the next cycle normally.

### Q5.3 — Migration of v1.0 data

**Recommendation: do NOT migrate.**

- v1.0 tasks have `next_due_smoothed = NULL` → fall back to natural `last_completion + frequency_days`. Behavior unchanged.
- After their FIRST post-upgrade completion, LOAD writes a value. The whole household is on the smoother within one cycle of upgrade.
- **No migration scripts.** Zero risk to v1.0 data integrity. Constraint satisfied.

**Why not retroactively smooth?**
- Same reasons as Q3.5: silently moving dates on upgrade = trust loss.
- Users running v1.0 already have a schedule that works for them. Forcing a re-smooth on upgrade is invasive.
- The smoother's value comes from preventing FUTURE clumping. It can do that with forward-only adoption.

### Q5.4 — Bulk onboarding flow

**Confirmed: each task goes through TCSEM individually with smart-default first-due.** No SDST hack.

Concretely, `batchCreateSeedTasks` becomes:
```typescript
async function batchCreateSeedTasks(homeId, selections) {
  const home = await loadHome(homeId);
  const tz = home.timezone;
  const now = new Date();
  
  // Build the load map ONCE (empty for new household)
  let loadMap = await computeHouseholdLoad(allTasks(homeId), now, 90);
  
  for (const seed of selections) {
    // Run TCSEM placement with current load map
    const firstDue = placeNewTask(seed, loadMap, now, tz);
    
    await pb.collection('tasks').create({
      ...seed,
      next_due_smoothed: firstDue.toISOString(),
    });
    
    // Update load map for the next iteration
    const key = formatInTimeZone(firstDue, tz, 'yyyy-MM-dd');
    loadMap.set(key, (loadMap.get(key) ?? 0) + 1);
  }
}
```

The first task lands on its ideal smart-default. The second task sees 1 load on the first task's date and may shift. The third task sees up to 2... cohort distribution emerges naturally.

**Performance check:** 30 seeds × ~20ms placement = ~600ms total onboarding write time. Acceptable for the once-in-a-household-lifetime onboarding flow.

---

## 3. Proposed REQ-IDs

### LOAD — Household load-aware scheduler

- [ ] **LOAD-01**: New `tasks.next_due_smoothed DATE` field (nullable, additive migration). Stores the smoother's chosen date.
- [ ] **LOAD-02**: `computeNextDue` returns `next_due_smoothed` when set, falling back to natural. Override (SNZE) still trumps.
- [ ] **LOAD-03**: New pure helper `placeNextDue(task, householdLoad, now)` returns a date within tolerance window of natural ideal.
- [ ] **LOAD-04**: Tolerance window = `min(0.15 * frequency_days, 5)` days each side of ideal.
- [ ] **LOAD-05**: PREF narrows candidate dates BEFORE load scoring (hard constraint preserved).
- [ ] **LOAD-06**: Anchored-mode tasks bypass smoothing entirely (byte-identical to v1.0).
- [ ] **LOAD-07**: Seasonal tasks: anchor to window start at wake-up; smoother runs from second cycle onward.
- [ ] **LOAD-08**: Snoozed tasks: override trumps smoother; snooze date contributes to load map.
- [ ] **LOAD-09**: One-off tasks: contribute to load map but not re-smoothable; first due = `task.created`.
- [ ] **LOAD-10**: Smoother runs on task creation AND on task completion (one placement call per event).
- [ ] **LOAD-11**: Smoothing is forward-only — placing one task never modifies existing tasks' `next_due_smoothed` values.
- [ ] **LOAD-12**: Tiebreaker rules: closest-to-ideal wins, then earlier wins.
- [ ] **LOAD-13**: Single placement call completes in <100ms for households with 100 active tasks (hard performance budget).
- [ ] **LOAD-14**: New helper `computeHouseholdLoad(tasks, now, windowDays): Map<string, number>` builds the load map for a single PB query.

### LVIZ — Horizon density visualization

- [ ] **LVIZ-01**: HorizonStrip month cells show density indicator proportional to task count in that month.
- [ ] **LVIZ-02**: Tapping a heavy month opens the existing Sheet drawer (already implemented), now with density-aware rendering.
- [ ] **LVIZ-03**: Task rows shifted by the smoother show a ⚖️ badge with tooltip explaining the shift.
- [ ] **LVIZ-04**: Badge appears only when displacement > 0 days.
- [ ] **LVIZ-05**: TaskDetailSheet "Schedule" section shows ideal vs scheduled dates when smoothed.

### TCSEM — Task creation semantics

- [ ] **TCSEM-01**: Task form gains optional "Last done" date field in an Advanced collapsible (default collapsed).
- [ ] **TCSEM-02**: When "Last done" provided in cycle mode: `first_ideal = last_done + frequency_days`, then load-smoothed.
- [ ] **TCSEM-03**: When "Last done" blank: smart-default first-due based on cycle length (≤7d → tomorrow; 8-90d → cycle/4; >90d → cycle/3), then load-smoothed.
- [ ] **TCSEM-04**: New tasks ALWAYS have `next_due_smoothed` populated by TCSEM at creation time.
- [ ] **TCSEM-05**: `batchCreateSeedTasks` calls TCSEM individually per task, updating in-memory load map between tasks, producing a naturally distributed cohort.
- [ ] **TCSEM-06**: SDST is removed: no synthetic `via='seed-stagger'` completions; no completions.via enum extension; History/stats/notification filters from SDST drop.
- [ ] **TCSEM-07**: v1.0 task migration: zero changes. Existing tasks with `next_due_smoothed = NULL` continue with natural cadence; LOAD writes a smoothed date at their next post-upgrade completion.

### Net REQ count
LOAD (14) + LVIZ (5) + TCSEM (7) = **26 new requirements**.
SDST removed = **-7 requirements**.
**Net delta: +19. New v1.1 total: 59 requirements.**

---

## 4. Phase plan impact

**Constraint:** "Other v1.1 work (OOFT, PREF, SEAS, SNZE, DOCS) can proceed in parallel to addendum production — they're prerequisites for LOAD anyway. But DO NOT start LOAD / LVIZ / TCSEM implementation until addendum is approved."

This means:
- Phase 10 (Schedule Override Foundation) can stay where it is and be planned/executed.
- Phase 11 (Task Model Extensions — fields for OOFT, PREF, SEAS) can stay where it is.
- New phases for LOAD, LVIZ, TCSEM are inserted AFTER Phase 11 but BEFORE the UI phases that depend on them (Phase 12 Seasonal UI, Phase 13 One-Off & Reschedule UI).

### Proposed revised phase shape

| # | Name | Status | Notes |
|---|---|---|---|
| 10 | Schedule Override Foundation | Unchanged | SNZE-04..06, 09, 10. `schedule_overrides` collection + `computeNextDue` extension. |
| 11 | Task Model Extensions | Unchanged minus SDST-01 | OOFT-01..03, PREF-01..04, SEAS-01..05. Drop SDST-01 (no enum extension). |
| **12 (NEW)** | **Load-Smoothing Engine** | NEW | LOAD-01..14. `tasks.next_due_smoothed` field, `placeNextDue` + `computeHouseholdLoad` helpers, integration into `computeNextDue`. PREF/SEAS/SNZE/OOFT interactions. No UI. |
| **13 (NEW)** | **Task Creation Semantics** | NEW | TCSEM-01..07. Form Advanced section + "Last done" field, smart-default first-due, batchCreateSeedTasks rewrite, SDST removal cleanup. UI hint: yes. |
| 14 (was 12) | Seasonal UI & Seed Library | Mostly unchanged | SEAS-06..10. Now uses `next_due_smoothed` from Phase 12 for dimmed-task wake-up display. |
| 15 (was 13) | One-Off & Reschedule UI | Mostly unchanged | OOFT-04, SNZE-01..03, 07, 08. |
| **16 (NEW)** | **Horizon Density Visualization** | NEW | LVIZ-01..05. HorizonStrip density indicators, ⚖️ badge in BandView/By Area/Person, TaskDetailSheet "Schedule" section. UI hint: yes. |
| 17 (was 14, smaller) | History/Notification Cleanup | Reduced | SDST-related filters dropped (TCSEM-06). May fold into Phase 13 or 16 if too small. |
| 18 (was 15) | SPEC v0.4 + Drift Fixes + v1.1 Changelog | Updated | DOCS bumped to v0.4 (because original audit + addendum is a meaningful spec change). Documents LOAD/LVIZ/TCSEM additions and SDST removal. |

**Net phase count: 9** (was 6). Confirmed: scope roughly doubles.

**Phase 10 still ships first** (override foundation is independent of LOAD), so the user's "discuss-phase 10 in parallel" intent works. The discuss-phase 10 questions I started asking remain valid — the override mechanism is unchanged by LOAD.

### Phases that need re-discussion before planning
- **Phase 12 (NEW Load-Smoothing Engine)** — entire phase is new; needs `/gsd-discuss-phase 12`.
- **Phase 13 (NEW Task Creation Semantics)** — new phase; needs discuss.
- **Phase 16 (NEW Horizon Density Visualization)** — new phase, UI; needs discuss + UI-spec.

Phases 10, 11, 14, 15, 17, 18 can proceed without re-discussion (their scope is stable; LOAD adds context but doesn't restructure them).

---

## 5. Test budget update

Original estimate: ~30-40 new unit + ~6 new E2E.
Revised estimate: ~70-90 new unit + ~10-12 new E2E.

New test surface:
- LOAD: ~25 unit (placement matrix, tolerance edge cases, tiebreaker rules, PREF/SEAS/SNZE/OOFT interactions, performance assertion)
- LVIZ: ~5 unit (badge logic), ~3 E2E (visual regression on HorizonStrip + badge)
- TCSEM: ~10 unit (smart-default matrix, "Last done" handling), ~2 E2E (form interaction, batch onboarding distribution)
- SDST removal: net -3 unit, -1 E2E

Net: +37 unit, +4 E2E added on top of original budget.

---

## 6. Constraints check

| Constraint (from user brief) | Verdict |
|---|---|
| All v1.0 tests still pass with load-smoothing enabled | ✓ NULL-default for `next_due_smoothed` preserves v1.0 behavior on all existing tasks |
| Anchored-mode tasks byte-identical to v1.0 | ✓ Anchored mode bypasses LOAD entirely (LOAD-06) |
| Migration: no v1.0 data modified | ✓ No migration scripts. Existing tasks read NULL → fall back to natural |
| <100ms for 100 active tasks | ✓ Forward-only smoothing, single PB query per placement, ~20ms estimate |
| UI honesty when smoother shifts dates | ✓ ⚖️ badge appears only when displacement > 0 (LVIZ-03, LVIZ-04) |

| Constraint (from original audit) | Verdict |
|---|---|
| No new external dependencies | ✓ All in-tree |
| Coverage ring math intact | ✓ Formula unchanged; reads `next_due_smoothed` when present |
| Early-completion guard intact | ✓ `shouldWarnEarly` reads `lastCompletion.completed_at` — unaffected by smoother |
| AGPL-3.0 maintained | ✓ All in-tree |

---

## 7. Decisions queued for sign-off (Phase B redux)

Before re-roadmapping, confirm:

1. **Storage architecture:** `tasks.next_due_smoothed DATE` (nullable). [recommended (e) above]
2. **Granularity:** per-day load count, no weighting.
3. **Tiebreaker:** closest-to-ideal, then earlier.
4. **Tolerance window:** `min(0.15 * freq, 5)` days each side. Confirm formula or override.
5. **Forward-only smoothing:** yes (no retroactive ripples). "Rebalance all" deferred to v1.2.
6. **PREF order:** narrow before load check (hard constraint).
7. **UI: ⚖️ badge:** appears only when displacement > 0; tooltip explains shift; full detail in TaskDetailSheet.
8. **Smart default for "Last done" blank:**
   - ≤7d → tomorrow
   - 8-90d → cycle/4 from now
   - >90d → cycle/3 from now
9. **Migration:** zero scripts; v1.0 tasks adopt smoothing at next post-upgrade completion.
10. **SDST removal:** confirm full removal of SDST REQ-IDs and the synthetic completion mechanism.
11. **Phase numbering:** insert LOAD/TCSEM as phases 12-13, push existing 12-13 to 14-15, add LVIZ as 16, History/Notification cleanup as 17, DOCS becomes 18 (and SPEC bumps to v0.4 instead of v0.3 since the addendum changes the spec materially).
12. **"Rebalance all" Settings action:** v1.2 (don't ship in v1.1 first cut).

---

## 8. Phase 10 discuss-phase resumption notes

The 4 gray areas asked in the paused discuss-phase 10 are still valid for the override mechanism. 3 of 4 had recommendations confirmed:

- ✓ **`computeNextDue` integration shape:** `override?` parameter (recommended). Now: signature also gains the existing `next_due_smoothed` short-circuit branch. Same parameter approach.
- ✓ **Override fetch strategy:** per-task + batch helpers (recommended).
- ✓ **Consumption semantics:** atomic write + read-time filter (defense in depth) (recommended).
- ❓ **One active vs many:** unanswered. Pre-existing question, unchanged by LOAD. Will re-ask on resume.

After this addendum is approved and REQUIREMENTS/ROADMAP are updated, resuming `/gsd-discuss-phase 10` will:
- Skip the 3 confirmed answers (they're locked).
- Ask only the unanswered "one active vs many" question.
- Add one new question: "Does the override fetch helper need to know about `next_due_smoothed`?" (Probably no — they're independent fields, both consulted in `computeNextDue`. But worth confirming.)

---

**Phase A redux complete. No code touched. Awaiting addendum approval before any REQUIREMENTS / ROADMAP revision or code work.**
