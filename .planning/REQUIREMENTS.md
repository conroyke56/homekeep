# Requirements: HomeKeep

**Defined:** 2026-04-20
**Core Value:** The household's recurring maintenance is visible, evenly distributed, and nothing falls through the cracks — without creating anxiety or guilt.

## v1 Requirements

### Authentication

- [x] **AUTH-01
**: User can sign up with email and password
- [x] **AUTH-02
**: User can log in and session persists across browser refresh
- [x] **AUTH-03
**: User can log out from any page
- [x] **AUTH-04
**: User can reset password via email link (PocketBase built-in)

### Homes

- [x] **HOME-01
**: User can create a home with name and optional address
- [x] **HOME-02
**: User can have multiple homes
- [x] **HOME-03
**: User lands on last-viewed home by default after login
- [x] **HOME-04
**: User can switch between homes via nav
- [x] **HOME-05
**: User can share a home via shareable invite link
- [x] **HOME-06
**: Invited user can accept invite and join a home
- [x] **HOME-07
**: Home owner can manage members (view, remove)

### Areas

- [x] **AREA-01
**: User can create areas within a home (location or whole_home scope)
- [x] **AREA-02
**: Each home auto-creates one "Whole Home" area that cannot be deleted
- [x] **AREA-03
**: User can set a default assignee per area
- [x] **AREA-04
**: Areas have name, icon, color, sort order
- [x] **AREA-05
**: User can edit and reorder areas

### Tasks

- [x] **TASK-01
**: User can create a task with name, frequency (days), area, optional notes
- [x] **TASK-02
**: User can assign a task to a specific member (overrides area default)
- [x] **TASK-03
**: Cascading assignment resolves: task assignee → area default → "Anyone"
- [x] **TASK-04
**: UI shows effective assignee with icon distinguishing inherited vs overridden
- [x] **TASK-05
**: User can set schedule mode per task (cycle or anchored, default: cycle)
- [x] **TASK-06
**: User can add custom tasks beyond seed library
- [x] **TASK-07
**: User can edit and archive tasks
- [x] **TASK-08
**: Next due date is computed, never stored (cycle: last_completion + frequency; anchored: next in fixed series)

### Completions

- [x] **COMP-01
**: User can complete a task with one tap (records who, when)
- [x] **COMP-02
**: Early-completion guard prompts when <25% of cycle elapsed since last completion
- [x] **COMP-03
**: Completions are append-only history (never deleted)

### Main View (Three-Band)

- [x] **VIEW-01
**: Default screen shows three bands: Overdue (top), This Week (middle), Horizon (bottom)
- [x] **VIEW-02
**: Overdue band only appears when tasks are actually overdue, sorted by days overdue
- [x] **VIEW-03
**: This Week band shows 7-day window, grouped by day if >5 items
- [x] **VIEW-04
**: Horizon band shows 12-month calendar strip with task dots/pills per month
- [x] **VIEW-05
**: Coverage ring at top shows % of annual maintenance on track (equal-weight, frequency-normalized)
- [x] **VIEW-06
**: Tapping a task allows completion or viewing details

### By Area View

- [x] **AREA-V-01
**: Card per area showing name, icon, coverage %, overdue/due/upcoming counts
- [x] **AREA-V-02
**: "Whole Home" card pinned to top
- [x] **AREA-V-03
**: Tapping an area card shows all its tasks

### Person View

- [x] **PERS-01
**: Shows tasks effectively assigned to the current user (via cascade)
- [x] **PERS-02
**: Shows user's completion history
- [x] **PERS-03
**: Shows personal streak and contribution to household stats
- [x] **PERS-04
**: Shows notification preferences (editable)

### History View

- [x] **HIST-01
**: Timeline of recent completions across the household
- [x] **HIST-02
**: Filterable by person, area, time range
- [x] **HIST-03
**: Shows who completed what and when

### Onboarding

- [x] **ONBD-01
**: First-run wizard offers seed task library with suggested frequencies and areas
- [x] **ONBD-02
**: User can accept/reject individual seed tasks
- [x] **ONBD-03
**: User can customize frequency and area assignment of seed tasks
- [x] **ONBD-04
**: Seed library covers Kitchen, Bathroom, Living areas, Yards, and Whole Home

### Notifications

- [x] **NOTF-01
**: Each user can configure a personal ntfy topic
- [x] **NOTF-02
**: Default ntfy server is ntfy.sh, configurable via NTFY_URL env var
- [x] **NOTF-03
**: Notification fires when a task becomes overdue (once, not repeatedly)
- [x] **NOTF-04
**: Notification fires when a task is assigned to you specifically
- [x] **NOTF-05
**: Optional notification when partner completes a task (off by default)
- [x] **NOTF-06
**: Optional weekly summary on Sunday (opt-in)
- [x] **NOTF-07
**: In-app scheduler (node-cron) runs hourly for overdue detection

### Gamification

- [x] **GAME-01
**: Household streak — consecutive weeks with at least one completion
- [x] **GAME-02
**: Per-area coverage percentages displayed
- [x] **GAME-03
**: Weekly summary: "Together you did X tasks. The house is Y% maintained."
- [x] **GAME-04
**: Small celebration animation when area first hits 100% coverage
- [x] **GAME-05
**: "Most neglected" card — the most overdue task, gentle nudge

### Infrastructure

- [x] **INFR-01
**: Single Docker image with Next.js + PocketBase (supervisord or similar)
- [x] **INFR-02
**: Multi-arch image: linux/amd64 + linux/arm64
- [x] **INFR-03
**: Final image under 300MB
- [x] **INFR-04
**: Single `./data` volume for all persistence (PB DB + uploads)
- [x] **INFR-05
**: `/api/health` endpoint for Docker / Uptime Kuma
- [x] **INFR-06
**: Three compose variants: LAN-only (default), Caddy (public domain), Tailscale (private HTTPS)
- [x] **INFR-07
**: App detects insecure context and informs user what's unavailable
- [x] **INFR-08
**: PWA manifest + service worker in HTTPS modes
- [x] **INFR-09
**: GitHub Actions CI/CD: lint, test on PR; multi-arch build → GHCR on tag
- [x] **INFR-10
**: Env-driven config — no hardcoded URLs, paths, or secrets
- [x] **INFR-11
**: `.env.example` with structure, real `.env` git-ignored
- [x] **INFR-12
**: MIT license, public GitHub repo

## v1.1 Requirements (Scheduling & Flexibility)

**Audit:** `.planning/v1.1/audit.md` (original 5-idea audit, all decisions still valid).
**Addendum:** `.planning/v1.1/audit-addendum-load.md` (LOAD/LVIZ/TCSEM/REBAL household-load thesis correction).
**Locked:** 2026-04-22 (audit), 2026-04-22 (addendum, with 3 riders approved).
**Constraints:** Additive migrations only. v1.0 data preserved. 311 unit + 23 E2E pass. Coverage ring + early-completion guard intact. `<100ms` placement budget for 100-task households. Anchored-mode tasks byte-identical to v1.0.

### One-Off Tasks (OOFT)

> **Rider 2 (2026-04-22):** OOFT-01..03 are draft pending Phase 11 discuss decision on first-due semantics. Three options on the table: (a) explicit "do by" date required, (b) default `creation + 7 days`, editable, (c) separate "To-do" list with promote-to-scheduled. User leans (a). Final shape locked in Phase 11 CONTEXT.md.

- [ ] **OOFT-01** (draft): User can create a task without a recurring frequency (one-off task; `tasks.frequency_days` nullable)
- [ ] **OOFT-02** (draft): One-off task automatically archives after first completion (atomic with completion write)
- [ ] **OOFT-03** (draft): One-off tasks have an explicit due date at creation (per rider 2 lean — confirm in Phase 11 discuss)
- [ ] **OOFT-04**: Task form distinguishes "Recurring" (with frequency) vs "One-off" (no frequency); anchored mode disallowed for one-off
- [ ] **OOFT-05**: One-off tasks contribute 1 to the LOAD density map on their due date but are themselves non-smoothable

### Preferred-Days Constraint (PREF)

> **Reframed:** PREF is now a hard *narrowing constraint applied BEFORE the LOAD load check*, not a standalone post-pass. The PREF-02 forward-search behavior remains, but it's part of the LOAD placement algorithm rather than its own post-step.

- [ ] **PREF-01**: User can set per-task `preferred_days` (any / weekend / weekday) on the task form
- [ ] **PREF-02**: LOAD placement narrows candidate dates to those matching `preferred_days` BEFORE scoring by load (LOAD-05)
- [ ] **PREF-03**: When the tolerance window contains no matching weekday, search widens forward in 1-day increments up to +6 days from natural ideal
- [ ] **PREF-04**: Constraint never produces an early date — result is always equal-or-later than the natural cycle date

### Seasonal Tasks (SEAS)

- [ ] **SEAS-01**: User can set `active_from_month` and `active_to_month` per task (both nullable; both null = year-round)
- [ ] **SEAS-02**: Out-of-window tasks return `null` from computeNextDue (invisible to scheduler, coverage, and main views)
- [ ] **SEAS-03**: When the active window opens, computeNextDue returns the start-of-window date (in home timezone) as next_due (smoothing skipped for the wake-up; LOAD resumes from second cycle)
- [ ] **SEAS-04**: Cross-year wrap supported: a window like Oct→Mar correctly includes Dec, Jan, Feb
- [ ] **SEAS-05**: Coverage ring excludes dormant tasks from its mean (treats them like archived)
- [ ] **SEAS-06**: Dormant tasks render dimmed with "Sleeps until <Mon Year>" badge in By Area and Person views
- [ ] **SEAS-07**: Task form gains an optional "Active months" section (from/to month dropdowns)
- [ ] **SEAS-08**: Form warns (does not block) when an anchored task's series falls predominantly outside its active window
- [ ] **SEAS-09**: Seed library extends with two seasonal task pairs (mowing warm/cool; HVAC seasonal pair)
- [ ] **SEAS-10**: History view always shows completions regardless of current season state

### Snooze & Permanent Reschedule (SNZE)

- [ ] **SNZE-01**: User can open a "Reschedule" action sheet from any task in any view
- [ ] **SNZE-02**: Action sheet includes a date picker defaulting to the natural next due
- [ ] **SNZE-03**: Action sheet has a "Just this time" / "From now on" radio (default: Just this time)
- [ ] **SNZE-04**: New `schedule_overrides` PB collection stores one-off snoozes `(id, task_id, snooze_until, consumed_at, created)`
- [ ] **SNZE-05**: computeNextDue consults the latest active (unconsumed) override BEFORE the smoothed-date branch (snooze trumps LOAD)
- [ ] **SNZE-06**: Overrides are consumed when the next completion lands after the override date
- [ ] **SNZE-07**: "From now on" mutates `tasks.anchor_date` (anchored mode) or `tasks.next_due_smoothed` with a marker flag (cycle mode) directly — no override row written. Marker flag detectable by REBAL preservation rules.
- [ ] **SNZE-08**: Snoozing into a dormant season prompts an "Extend the active window?" confirmation dialog
- [ ] **SNZE-09**: Coverage ring uses the snoozed (later) next_due (snoozed tasks don't drag coverage down)
- [ ] **SNZE-10**: Scheduler ntfy `ref_cycle` keys on the resulting next_due (one notification per effective due date — idempotent re-firing)

### Household Load-Aware Scheduling (LOAD)

- [ ] **LOAD-01**: New `tasks.next_due_smoothed DATE` field (nullable, additive migration). Stores the smoother's chosen date.
- [ ] **LOAD-02**: `computeNextDue` returns `next_due_smoothed` when set, falling back to natural; SNZE override still trumps
- [ ] **LOAD-03**: New pure helper `placeNextDue(task, householdLoad, now)` returns a date within tolerance window of natural ideal
- [ ] **LOAD-04**: Tolerance window = `min(0.15 * frequency_days, 5)` days each side of ideal (per rider 1 — initial ship; widen to `min(0.15 * freq, 14)` if Phase 12 validation against 30-task test household shows annual clusters remain bunched)
- [ ] **LOAD-05**: PREF narrows candidate dates BEFORE load scoring (hard constraint preserved)
- [ ] **LOAD-06**: Anchored-mode tasks bypass smoothing entirely (byte-identical to v1.0)
- [ ] **LOAD-07**: Seasonal tasks: anchor to window start at wake-up; smoother runs from second cycle onward
- [ ] **LOAD-08**: Snoozed tasks: SNZE override trumps smoother; snooze date contributes to load map for OTHER tasks' placement
- [ ] **LOAD-09**: One-off tasks: contribute to load map but not re-smoothable; first due determined by Phase 11 OOFT decision
- [ ] **LOAD-10**: Smoother runs on task creation AND on task completion (one placement call per event)
- [ ] **LOAD-11**: Smoothing is forward-only — placing one task never modifies existing tasks' `next_due_smoothed` values
- [ ] **LOAD-12**: Tiebreaker rules: closest-to-ideal wins, then earlier wins
- [ ] **LOAD-13**: Single placement call completes in <100ms for households with 100 active tasks (hard performance budget)
- [ ] **LOAD-14**: New helper `computeHouseholdLoad(tasks, now, windowDays): Map<string, number>` builds the load map from a single PB query
- [ ] **LOAD-15**: `computeNextDue` branch composition test matrix covers all 6 branches (override, smoothed, anchored, seasonal, one-off, natural) and every meaningful interaction — tests are a hard gate on Phase 12 completion

### Horizon Density Visualization (LVIZ)

- [ ] **LVIZ-01**: HorizonStrip month cells show density indicator proportional to task count in that month
- [ ] **LVIZ-02**: Tapping a heavy month opens the existing Sheet drawer (already implemented), now with density-aware rendering
- [ ] **LVIZ-03**: Task rows shifted by the smoother show a `⚖️` badge with tooltip explaining the shift
- [ ] **LVIZ-04**: Badge appears only when displacement > 0 days
- [ ] **LVIZ-05**: TaskDetailSheet "Schedule" section shows ideal vs scheduled dates when smoothed

### Task Creation Semantics (TCSEM)

- [ ] **TCSEM-01**: Task form gains optional "Last done" date field in an Advanced collapsible (default collapsed)
- [ ] **TCSEM-02**: When "Last done" provided in cycle mode: `first_ideal = last_done + frequency_days`, then load-smoothed
- [ ] **TCSEM-03**: When "Last done" blank: smart-default first-due based on cycle length (≤7d → tomorrow; 8-90d → cycle/4; >90d → cycle/3), then load-smoothed
- [ ] **TCSEM-04**: New tasks ALWAYS have `next_due_smoothed` populated by TCSEM at creation time
- [ ] **TCSEM-05**: `batchCreateSeedTasks` calls TCSEM individually per task, updating in-memory load map between tasks, producing a naturally distributed cohort
- [ ] **TCSEM-06**: SDST is removed: no synthetic `via='seed-stagger'` completions; no `completions.via` enum extension; History/stats/notification filters from SDST are not implemented
- [ ] **TCSEM-07**: v1.0 task migration: zero changes. Existing tasks with `next_due_smoothed = NULL` continue with natural cadence; LOAD writes a smoothed date at their next post-upgrade completion

### Manual Rebalance (REBAL)

> **Per rider 3:** Forward-only LOAD is only safe if users have a manual escape hatch. Minimal v1.1 surface; richer features (per-task preview, undo, auto-trigger, area-scoped) deferred to v1.2+.

- [ ] **REBAL-01**: Anchored-mode tasks preserved during rebalance (never re-placed)
- [ ] **REBAL-02**: Tasks with unconsumed `schedule_overrides` rows preserved (snooze user intent wins)
- [ ] **REBAL-03**: Tasks whose `next_due_smoothed` was last set via SNZE "From now on" preserved (per-task marker flag set by SNZE-07; preservation enforced here)
- [ ] **REBAL-04**: All other tasks re-run through `placeNextDue` with a fresh `computeHouseholdLoad` map
- [ ] **REBAL-05**: Settings → Scheduling → "Rebalance schedule" button surfaces the action
- [ ] **REBAL-06**: Preview modal shows counts only — "Will update: N" + "Will preserve: M" with breakdown by preservation reason (anchored / active snooze / "From now on")
- [ ] **REBAL-07**: Re-placement processes the bucket-4 residual in ascending ideal-date order, updating in-memory load map between placements (deterministic, matches TCSEM batch pattern)

### Documentation & Versioning (DOCS)

> **Updated per addendum:** SPEC.md bumps to **v0.4** (not v0.3) because the addendum changes the spec materially — household load smoothing is a new architectural commitment.

- [ ] **DOCS-01**: SPEC.md bumped to v0.4
- [ ] **DOCS-02**: SPEC.md three stale "MIT" references corrected to AGPL-3.0
- [ ] **DOCS-03**: SPEC.md gains a v1.1 changelog section documenting all new features (LOAD, LVIZ, TCSEM, REBAL, OOFT, PREF, SEAS, SNZE) and data-model changes (`tasks.next_due_smoothed`, `tasks.preferred_days`, `tasks.active_from_month`/`to_month`, nullable `tasks.frequency_days`, `schedule_overrides` collection)
- [ ] **DOCS-04**: PROJECT.md `INFR-12` corrected to AGPL-3.0
- [ ] **DOCS-05**: SPEC.md documents the new task fields, the `schedule_overrides` collection, the LOAD placement algorithm (tolerance window, tiebreakers, forward-only), and REBAL semantics
- [ ] **DOCS-06**: PROJECT.md "No SMTP" constraint reworded to "SMTP optional, never required"

## v1.2+ Candidates (deferred)

These were noted as v1.1 in earlier planning but did NOT make it into the locked v1.1 scope. Re-evaluate during v1.2 milestone start.

### Area Groups

- **AGRP-01**: User can create area groups (Inside / Outside / Outbuildings) for homes with 6+ areas
- **AGRP-02**: Groups only appear when needed; small homes see flat area list

### Task Rotation

- **TROT-01**: Per-task toggle that round-robins between members on completion

### Public API

- **API-01**: Documented REST API at `/api/v1/*` with stable contracts
- **API-02**: Webhooks (task.overdue, task.completed, area.full_coverage)

### Drag-to-Reschedule (deferred from v1.1; replaced by action-sheet snooze)

- **DRAG-01**: Drag tasks between cells in the Horizon strip to reschedule (re-evaluate after v1.1 telemetry on snooze use)

### REBAL extensions (deferred from v1.1 minimal cut)

- **REBAL-V2-01**: Task-by-task change preview in the Rebalance modal (show old → new date per task before applying)
- **REBAL-V2-02**: Undo toast after Apply rebalance (5-second window to revert)
- **REBAL-V2-03**: Auto-triggered rebalance — scheduled (e.g. monthly) or prompted ("your Saturdays look heavy this month")
- **REBAL-V2-04**: Area-scoped rebalance (e.g. "rebalance just Yard area" — needs UI for scope picker)

### LOAD extensions (deferred from v1.1)

- **LOAD-V2-01**: Effort/task-size weighting (quick / medium / big) — single-weight placement is v1.1; effort-weighted load is v1.2+
- **LOAD-V2-02**: Household capacity settings (max tasks/day, rest days)
- **LOAD-V2-03**: Completion feedback loop ("too often" / "just right" / "felt overdue") — captured implicitly via snooze patterns in v1.1
- **LOAD-V2-04**: Learned frequency adjustment based on completion timing patterns
- **LOAD-V2-05**: Effort-aware horizon visualization (LVIZ shows count, not effort, in v1.1)

### Additional

- **V2-01**: Year-in-review dashboard (December summary)
- **V2-02**: Photo attachment on completion (proof / before-after)
- **V2-03**: Task categories as cross-cutting tags (cleaning, maintenance, seasonal)
- **V2-04**: Export data as JSON
- **V2-05**: "Recent reschedules" surface (made cheap by v1.1's `schedule_overrides` collection)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Calendar integration (iCal, Google Cal) | Different problem space — maintenance isn't calendar-shaped |
| Shopping lists / inventory | Not home maintenance |
| Bill tracking / finance | Not home maintenance |
| Vendor/contractor contacts | Adds complexity without core value |
| Multi-tenant SaaS | Self-hosted first, always |
| Enterprise SSO (OIDC/SAML) | Not the target user |
| i18n (v1) | English only; strings extractable for later |
| Offline-first write sync | Reads cached, writes require connection |
| Real-time presence/cursors | Overkill for household app |
| Kids/chores mode | Post-1.1 — different mental model from adult maintenance |
| Points, XP, levels, leaderboards | Against cooperative design principle |
| Daily streak pressure | Weekly is humane, daily is toxic |
| SMTP email delivery | v1 uses link-only invites; no SMTP dependency |
| Native mobile apps | PWA is sufficient for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Pending |
| HOME-01 | Phase 2 | Pending |
| HOME-02 | Phase 2 | Pending |
| HOME-03 | Phase 2 | Pending |
| HOME-04 | Phase 2 | Pending |
| HOME-05 | Phase 4 | Complete |
| HOME-06 | Phase 4 | Complete |
| HOME-07 | Phase 4 | Complete |
| AREA-01 | Phase 2 | Pending |
| AREA-02 | Phase 2 | Pending |
| AREA-03 | Phase 2 | Pending |
| AREA-04 | Phase 2 | Pending |
| AREA-05 | Phase 2 | Pending |
| TASK-01 | Phase 2 | Pending |
| TASK-02 | Phase 4 | Complete |
| TASK-03 | Phase 4 | Complete |
| TASK-04 | Phase 4 | Complete |
| TASK-05 | Phase 2 | Pending |
| TASK-06 | Phase 2 | Pending |
| TASK-07 | Phase 2 | Pending |
| TASK-08 | Phase 2 | Pending |
| COMP-01 | Phase 3 | Complete (03-03) |
| COMP-02 | Phase 3 | Complete (03-01 + 03-03) |
| COMP-03 | Phase 3 | Complete (03-01) |
| VIEW-01 | Phase 3 | Complete (03-02) |
| VIEW-02 | Phase 3 | Complete (03-02) |
| VIEW-03 | Phase 3 | Complete (03-02) |
| VIEW-04 | Phase 3 | Complete (03-02) |
| VIEW-05 | Phase 3 | Complete (03-01 + 03-02) |
| VIEW-06 | Phase 3 | Complete (03-03) |
| AREA-V-01 | Phase 5 | Complete |
| AREA-V-02 | Phase 5 | Complete |
| AREA-V-03 | Phase 5 | Complete |
| PERS-01 | Phase 5 | Complete |
| PERS-02 | Phase 5 | Complete |
| PERS-03 | Phase 5 | Complete |
| PERS-04 | Phase 5 | Complete |
| HIST-01 | Phase 5 | Complete |
| HIST-02 | Phase 5 | Complete |
| HIST-03 | Phase 5 | Complete |
| ONBD-01 | Phase 5 | Complete |
| ONBD-02 | Phase 5 | Complete |
| ONBD-03 | Phase 5 | Complete |
| ONBD-04 | Phase 5 | Complete |
| NOTF-01 | Phase 6 | Complete |
| NOTF-02 | Phase 6 | Complete |
| NOTF-03 | Phase 6 | Complete |
| NOTF-04 | Phase 6 | Complete |
| NOTF-05 | Phase 6 | Complete |
| NOTF-06 | Phase 6 | Complete |
| NOTF-07 | Phase 6 | Complete |
| GAME-01 | Phase 6 | Complete |
| GAME-02 | Phase 6 | Complete |
| GAME-03 | Phase 6 | Complete |
| GAME-04 | Phase 6 | Complete |
| GAME-05 | Phase 6 | Complete |
| INFR-01 | Phase 1 | Complete (01-02) |
| INFR-02 | Phase 1 | Complete (01-02) |
| INFR-03 | Phase 1 | Complete (01-02) |
| INFR-04 | Phase 1 | Complete (01-02) |
| INFR-05 | Phase 1 | Complete (01-01) |
| INFR-06 | Phase 1 | Complete (01-05) |
| INFR-07 | Phase 7 | Complete |
| INFR-08 | Phase 7 | Complete |
| INFR-09 | Phase 7 | Complete |
| INFR-10 | Phase 1 | Complete (01-02) |
| INFR-11 | Phase 1 | Complete (01-01) |
| INFR-12 | Phase 1 | Complete (01-01) |
| OOFT-01 | Phase 11 | Pending |
| OOFT-02 | Phase 11 | Pending |
| OOFT-03 | Phase 11 | Pending |
| OOFT-04 | Phase 13 | Pending |
| PREF-01 | Phase 11 | Pending |
| PREF-02 | Phase 11 | Pending |
| PREF-03 | Phase 11 | Pending |
| PREF-04 | Phase 11 | Pending |
| SEAS-01 | Phase 11 | Pending |
| SEAS-02 | Phase 11 | Pending |
| SEAS-03 | Phase 11 | Pending |
| SEAS-04 | Phase 11 | Pending |
| SEAS-05 | Phase 11 | Pending |
| SEAS-06 | Phase 12 | Pending |
| SEAS-07 | Phase 12 | Pending |
| SEAS-08 | Phase 12 | Pending |
| SEAS-09 | Phase 12 | Pending |
| SEAS-10 | Phase 12 | Pending |
| SNZE-01 | Phase 13 | Pending |
| SNZE-02 | Phase 13 | Pending |
| SNZE-03 | Phase 13 | Pending |
| SNZE-04 | Phase 10 | Pending |
| SNZE-05 | Phase 10 | Pending |
| SNZE-06 | Phase 10 | Pending |
| SNZE-07 | Phase 13 | Pending |
| SNZE-08 | Phase 13 | Pending |
| SNZE-09 | Phase 10 | Pending |
| SNZE-10 | Phase 10 | Pending |
| ~~SDST-01~~ | ~~Phase 11~~ | **REMOVED** (superseded by TCSEM per addendum) |
| ~~SDST-02..07~~ | ~~Phase 14~~ | **REMOVED** (superseded by TCSEM per addendum) |
| LOAD-01..15 | TBD | Pending — re-roadmapper will assign |
| LVIZ-01..05 | TBD | Pending — re-roadmapper will assign |
| TCSEM-01..07 | TBD | Pending — re-roadmapper will assign |
| REBAL-01..07 | TBD | Pending — re-roadmapper will assign |
| OOFT-05 | TBD | Pending — re-roadmapper will assign |
| PREF-01..04 (reframed) | TBD | Pending — re-roadmapper will reassign per LOAD interaction |
| SNZE-07 (extended) | TBD | Pending — re-roadmapper will reassign per REBAL preservation flag |
| DOCS-06 | TBD | Pending — re-roadmapper will assign |
| DOCS-01 | Phase 15 | Pending — bumped to v0.4 per addendum |
| DOCS-02..05 | Phase 15 | Pending |

> **Traceability table partial — will be fully regenerated by the re-roadmapper after addendum approval.** Removed SDST rows are marked above for audit history; the rewritten table will drop them entirely.

**Coverage:**
- v1.0 requirements: 71 total → all mapped, all complete
- v1.1 requirements: 69 total → 30 partially mapped (Phase 10/11/13/15 stable from initial roadmap), 39 awaiting re-roadmap with revised phase shape (LOAD/LVIZ/TCSEM/REBAL inserted, SDST removed, ~9 phases total)
- OOFT-01..03 are draft pending Phase 11 discuss decision (rider 2)

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-22 — v1.1 scope expanded per LOAD addendum + 3 riders (LOAD/LVIZ/TCSEM/REBAL added, SDST removed, PREF reframed, OOFT draft, DOCS bumped to v0.4). Traceability table partial; re-roadmap pending. Total: 69 v1.1 REQs.*
