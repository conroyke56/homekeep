# Phase 6: Notifications & Gamification - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 adds proactive notifications via **ntfy** (POST to HTTPS topics, no auth needed) and light gamification (household streaks, area coverage, celebrations, most-neglected). No paid services, no user data leaves the self-hosted deployment except the user's ntfy push.

**Scope:**
- Per-user ntfy topic config (NOTF-01)
- NTFY_URL env default ntfy.sh (NOTF-02)
- Overdue notification (once per task per overdue cycle) (NOTF-03, NOTF-07)
- Task-assigned notification (NOTF-04)
- Partner-completed (opt-in, off by default) (NOTF-05)
- Weekly summary (opt-in) (NOTF-06)
- Household streak (consecutive weeks) (GAME-01)
- Per-area coverage % (GAME-02 — already in By Area view from Phase 5; surface on dashboard)
- Weekly summary copy (GAME-03)
- Celebration animation when area hits 100% (GAME-04)
- Most-neglected card (GAME-05)

**NOT in Phase 6:**
- Web Push / Firebase / APNs — only ntfy
- Email notifications (scoped out)
- Discord/Slack integration (future)
- PWA push (needs HTTPS — Phase 7)
</domain>

<decisions>
## Implementation Decisions

### Notification transport (ntfy)

- **D-01:** ntfy sends via `POST ${NTFY_URL}/${topic}` with plain text body. No auth; topic acts as secret. `NTFY_URL` defaults to `https://ntfy.sh`; users can override via container env for self-hosted ntfy.
- **D-02:** Extend `users` collection with `ntfy_topic` (text, optional, 4-64 URL-safe chars), `notify_overdue` (bool, default true), `notify_assigned` (bool, default true), `notify_partner_completed` (bool, default false), `notify_weekly_summary` (bool, default false), `weekly_summary_day` (select: sunday/monday, default sunday). Users manage these via Person view's previously-stubbed "Notifications" section.
- **D-03:** `lib/ntfy.ts` — pure `sendNtfy(url, topic, { title, body, priority?, tags? })` function with fetch. Timeout 5s. Logs failures but never throws (notification is best-effort; never block completions or scheduler).

### Scheduler

- **D-04:** **In-process node-cron** scheduler inside the Next.js container, NOT a separate service. Starts in the Next.js `instrumentation.ts` file or a custom `/api/scheduler/start` route called at boot. Cron pattern: `0 * * * *` (top of every hour). Runs:
  - For each home, for each non-archived task: compute nextDue and lastCompletion. If nextDue < now AND NOT already notified for this overdue cycle, send ntfy to members' topics (filtered by their `notify_overdue=true`). Record notification state in a new `notifications` collection.
  - Sunday 9am local (home.timezone): for each member with `notify_weekly_summary=true`, compute + send weekly summary.
- **D-05:** **Notifications idempotency:** new `notifications` collection with fields: `user_id`, `home_id`, `task_id` (nullable for weekly summary), `kind` (select: overdue, assigned, partner_completed, weekly_summary), `sent_at` (date), `ref_cycle` (text — e.g. `task:{task_id}:overdue:{nextDueIso}` for overdue dedupe). Unique index on `(user_id, ref_cycle)`. Before sending, check if a record with the same ref_cycle exists for the user; if yes, skip.
- **D-06:** **Task-assigned notification:** fire synchronously from `updateTaskAction` when `assigned_to_id` changes to a non-null value different from the previous assignee. ref_cycle = `task:{task_id}:assigned:{timestamp}`.
- **D-07:** **Partner-completed:** fire synchronously from `completeTaskAction` (if opted in). For each other home member with `notify_partner_completed=true`, send "Alex completed Wipe benches". Uses completion id as ref_cycle.

### Scheduler runtime concerns

- **D-08:** Scheduler state: a process-local in-memory flag prevents duplicate startup (Next.js may reload modules). Use a module-level bool. The cron job is cheap (iterates tasks in memory, sends ntfy POSTs). For multi-instance deploys (future), add a leader-election primitive (deferred; single-container deploy for v1 = single scheduler).
- **D-09:** The scheduler ONLY starts when `process.env.DISABLE_SCHEDULER !== 'true'`. Tests disable it. Dev mode disables it unless `ENABLE_DEV_SCHEDULER=true`. Production runs it by default.

### Gamification computations

- **D-10:** **Household streak (GAME-01):** pure `computeHouseholdStreak(completions, now, timezone)` — consecutive weeks back from current week where the home had ≥1 completion by any member. Return streak weeks as integer. 0 if current week has no completion.
- **D-11:** Display household streak badge on dashboard (header area). "🏠 7-week streak" copy.
- **D-12:** **Weekly summary (GAME-03):** pure `computeWeeklySummary(completions, tasks, now, timezone)` → `{ completionsCount: number, coveragePercent: number, topArea: string, mostNeglectedTask?: Task }`.
- **D-13:** **Area-hit-100% celebration (GAME-04):** when any completion brings an area's coverage to 100% from <100%, trigger a client-side confetti/slide-in animation (use a lightweight CSS keyframe OR canvas-confetti package). Compute the before/after in `completeTaskAction` and return a `celebration: 'area-100'` flag in the response. Client reads the flag and plays the animation. No sound.
- **D-14:** **Most-neglected (GAME-05):** add a `MostNeglectedCard` component to the dashboard between Overdue band and This Week band. Shows the single most-overdue task (largest `daysOverdue`) with a gentle nudge. Tap → complete inline.

### UI changes

- **D-15:** **Person view → Notifications section** (PERS-04 placeholder from Phase 5) becomes real form: ntfy topic input + the 4 toggles + weekly_summary_day select. Server action `updateNotificationPrefs(prefs)`.
- **D-16:** **Dashboard header:** add streak badge on the left, existing CoverageRing on the right. Symmetric layout.
- **D-17:** **Admin info:** README + .env.example document the `NTFY_URL` env + "how to test ntfy" instructions (`curl -d "test" https://ntfy.sh/<topic>`).

### Testing

- **D-18:** Unit:
  - `lib/ntfy.ts` matrix (success, 4xx, 5xx, timeout, empty body — all return `{ok: false, error}` instead of throwing)
  - `lib/household-streak.ts` matrix (0, 1, multi-week, gap)
  - `lib/weekly-summary.ts` matrix
  - scheduler idempotency (ref_cycle dedupe)
- **D-19:** Integration: scheduler run on in-memory tasks produces one ntfy call for newly-overdue, zero for already-notified; sends correct body content; writes notifications record
- **D-20:** E2E (manual-ish; real ntfy.sh can't be asserted in CI — use a local mock receiver or check that the POST was attempted):
  - User sets ntfy topic → creates overdue task → runs scheduler manually via admin debug route → notification record exists → (optional: manual curl to ntfy.sh/<topic> to verify receipt)
  - Weekly summary opt-in → manually trigger summary cron → notification record
  - Celebration animation: create area, add task, complete it, verify celebration flag returned in action response

### Claude's Discretion
- Exact wording of notification titles/bodies
- Whether confetti is JS-driven or pure CSS
- Streak copy edge cases

</decisions>

<canonical_refs>
- SPEC.md §9 (gamification) and §10 (notifications)
- Phase 5 Person view (placeholder ready for real form)
- lib/completions.ts (completion creation hook point)
- lib/actions/tasks.ts (assignee change hook point)
- lib/coverage.ts (for celebration detection)
</canonical_refs>

<specifics>
- Keep notification copy warm and terse. "Your kitchen is ready for a wipe-down 👋" not "OVERDUE TASK ALERT"
- Streak on dashboard: small, warm, not yellow-trophy loud
- Celebration: one-time trigger (per area per 100%-crossing), not every completion once at 100%
</specifics>

<deferred>
- Leader election for multi-instance — future
- Custom per-task notification schedules — v1.1
- Push-to-discord/slack — future
</deferred>

---

*Phase: 06-notifications-gamification*
*Context gathered: 2026-04-21 via autonomous yolo-mode synthesis*
