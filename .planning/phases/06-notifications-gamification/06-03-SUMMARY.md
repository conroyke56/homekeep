---
phase: 06-notifications-gamification
plan: 03
subsystem: notifications-ui
tags:
  - notification-prefs-form
  - household-streak-badge
  - most-neglected-card
  - area-celebration
  - band-view-wiring
  - e2e-suite-e
  - tailwind-motion-safe
  - react-hook-form
  - useActionState

# Dependency graph
requires:
  - phase: 06-02
    provides: "updateNotificationPrefsAction + notificationPrefsSchema + CompleteResult.celebration + /api/admin/run-scheduler"
  - phase: 06-01
    provides: "computeHouseholdStreak pure fn + users prefs fields + notifications collection (with unique index)"
  - phase: 05-02
    provides: "Person view shell + NotificationPrefsPlaceholder stub to replace"
  - phase: 03-02
    provides: "BandView + completeTaskAction consumer + CoverageRing warm-accent palette"

provides:
  - "components/notification-prefs-form.tsx — RHF+zod form bound to updateNotificationPrefsAction (NOTF-01/05/06)"
  - "components/household-streak-badge.tsx — presentational Flame badge (GAME-01, D-11, D-16)"
  - "components/most-neglected-card.tsx — null-when-no-overdue warm nudge card (GAME-05, D-14)"
  - "components/area-celebration.tsx — one-shot Tailwind motion-safe overlay (GAME-04, D-13)"
  - "BandView celebration state + MostNeglectedCard insertion between Overdue and This Week"
  - "Dashboard header HouseholdStreakBadge next to home.name (D-16 symmetric layout)"
  - "Person view wired to real prefs form (placeholder file deleted)"
  - "E2E Suite E (Part 1 prefs roundtrip + Part 2 scheduler roundtrip + idempotency)"
  - "playwright.config.ts ADMIN_SCHEDULER_TOKEN env injection + DISABLE_SCHEDULER retention"

affects:
  - 07 (PWA) — Web Push fallback for non-ntfy users will integrate alongside NotificationPrefsForm; celebration animation palette may reappear in PWA install prompt

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useActionState + RHF hybrid: form's action prop drives the Server Action while RHF zodResolver provides client-side inline validation; errors merge (client wins on display)"
    - "useFormStatus for Save button pending state — works only inside the form, decouples from useActionState isPending dual-source-of-truth"
    - "useRef + useEffect for one-shot toast dispatch per ActionState object identity (prevents duplicate toast firing on re-render)"
    - "Tailwind motion-safe: variants for CSS keyframe animations — zero JS animation code, a11y fallback free via motion-reduce:"
    - "Dashboard page header as the household-status bar (streak left, avatars right); CoverageRing stays inside BandView (symmetric above-the-fold layout, not identical DOM node)"
    - "MostNeglectedCard consumes bands.overdue[0] (already sorted most-negative daysDelta first via lib/band-classification); Math.abs(Math.floor(daysDelta)) derives non-negative daysOverdue"
    - "Celebration state keyed on Date.now() so back-to-back crossovers remount + reset the 2500ms timer"

key-files:
  created:
    - "components/notification-prefs-form.tsx"
    - "components/household-streak-badge.tsx"
    - "components/most-neglected-card.tsx"
    - "components/area-celebration.tsx"
    - "tests/e2e/notifications.spec.ts"
    - "tests/unit/components/household-streak-badge.test.tsx"
    - "tests/unit/components/most-neglected-card.test.tsx"
  modified:
    - "components/band-view.tsx"
    - "app/(app)/h/[homeId]/page.tsx"
    - "app/(app)/h/[homeId]/person/page.tsx"
    - "tests/e2e/views.spec.ts"
    - "playwright.config.ts"
  deleted:
    - "components/notification-prefs-placeholder.tsx"

key-decisions:
  - "06-03: celebration animation is pure Tailwind motion-safe:animate-in + slide-in-from-top-4 (no canvas-confetti, no JS keyframes) — leverages tw-animate-css already in deps; motion-reduce falls back to static pill"
  - "06-03: CoverageRing remains inside BandView (03-02 contract preserved); HouseholdStreakBadge takes the left side of the dashboard header — 'symmetric' per D-16 interpreted as 'both visible above the fold', not identical DOM node"
  - "06-03: MostNeglectedCard pending prop scoped per-task (pendingTaskId === task.id) NOT per-any (pendingTaskId !== null) — stricter double-tap guard; matches TaskRow contract"
  - "06-03: NotificationPrefsPlaceholder file DELETED (not re-exported) — cleaner history; views.spec.ts Suite C updated with 1-line anchor rename; Suite C contract upgrade documented inline"
  - "06-03: playwright.config.ts exports E2E_ADMIN_SCHEDULER_TOKEN (46 chars) + injects ADMIN_SCHEDULER_TOKEN into Next.js webServer env; retained DISABLE_SCHEDULER=true from 06-02 (cron off; tests trigger manually)"
  - "06-03: useRef-guarded useEffect toast dispatch (state object identity check) — prevents the toast from re-firing on unrelated re-renders; matches the React 19 useActionState reducer contract"
  - "06-03: MostNeglectedCard warm-accent uses bg-primary/5 + border-primary/20 — visibly distinct from alarming red; AlertCircle icon in text-primary (warm orange per 02-02 theme)"
  - "06-03: celebration mount key = Date.now() so a second crossover reset animation + timer even if prior overlay still visible"

patterns-established:
  - "useActionState + RHF hybrid form pattern: <form action={formAction}> drives server action; RHF handles inline client validation; field errors merge via nullish coalescing (client wins on display)"
  - "Conditional-reveal form field pattern: watch('toggle') gates a sibling div's render; submit-time values still flow via registered form fields"
  - "Motion-safe celebration overlay: fixed-position + pointer-events-none + z-50 + Tailwind motion-safe:animate-in; motion-reduce auto-fallback via lack of the variant"
  - "Per-task precise pending prop for shared card-as-alternative-complete-surface pattern — avoids disabling unrelated action affordances"

requirements-completed:
  - GAME-01
  - GAME-02
  - GAME-04
  - GAME-05

# Metrics
duration: 13min
completed: 2026-04-21
---

# Phase 6 Plan 3: Notifications & Gamification UI Summary

**Real NotificationPrefsForm (replaces Phase 5 placeholder), HouseholdStreakBadge in the dashboard header, MostNeglectedCard between Overdue and This Week bands, CSS-keyframe area-100% celebration overlay, and full-stack Suite E E2E (prefs roundtrip + scheduler trigger + idempotency) — closes the visible surface of Phase 6 in 13 minutes.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-04-21T06:23:36Z
- **Completed:** 2026-04-21T06:37:00Z
- **Tasks:** 3 (all TDD: 2 RED+GREEN cycles + 1 direct GREEN on Task 3 using the RED spec written in Task 1)
- **Files created:** 7 (4 components + 1 E2E spec + 2 unit tests)
- **Files modified:** 5 (band-view.tsx, dashboard page, person page, views.spec.ts, playwright.config.ts)
- **Files deleted:** 1 (notification-prefs-placeholder.tsx)
- **Net LOC:** +890 (code + tests)

## Accomplishments

- **Real notification preferences form** (`components/notification-prefs-form.tsx`): RHF + zodResolver on top of `useActionState(updateNotificationPrefsAction)`. 6 fields (ntfy_topic text input, 4 boolean toggles, weekly_summary_day select revealed only when notify_weekly_summary is on). Sonner toast success/error on server response. `useFormStatus` drives Save button pending state. Per-field error rendering merges RHF + server zod errors (client wins on display). `data-notification-prefs-form` anchor + per-field `data-field=…` attrs for E2E.
- **Household streak badge** (`components/household-streak-badge.tsx`): 38 LOC pure presentational component. Warm-accent Flame icon + 0/1/N copy matrix. `data-household-streak-badge` + `data-streak-count` for E2E + unit tests. Aria-hidden icon; visible text is sole a11y label.
- **Most-neglected card** (`components/most-neglected-card.tsx`): 95 LOC. Null-when-no-overdue (CONTEXT §critical). Warm AlertCircle nudge card with task name, area chip, days-overdue badge, "Been a while — ready to tackle this?" muted copy, and Complete button invoking `onComplete(task.id)`. `pending` scoped per-task for precise double-tap guard alignment with the row path.
- **Area celebration** (`components/area-celebration.tsx`): 62 LOC `'use client'` overlay. Fixed-position + pointer-events-none + z-50, Tailwind `motion-safe:animate-in fade-in slide-in-from-top-4 duration-500`. `motion-reduce:` users get a non-animated static pill (celebration still renders — no silent skip). Auto-dismiss via `useEffect` + `setTimeout(2500ms)` + cleanup.
- **BandView wiring**: added `celebration` + `setCelebration` state (keyed on `Date.now()` for remount on retrigger); `handleTap` success branch now reads `result.celebration` and sets state. `<AreaCelebration>` renders conditionally at the top of the returned JSX. `<MostNeglectedCard>` inserted between Overdue and This Week `<TaskBand>`s, deriving `daysOverdue` from `Math.abs(Math.floor(bands.overdue[0].daysDelta))`.
- **Dashboard header** (`app/(app)/h/[homeId]/page.tsx`): compute `computeHouseholdStreak(completions, now, home.timezone)` server-side; render `<HouseholdStreakBadge>` between home name and AvatarStack. CoverageRing stays inside BandView (preserving the 03-02 contract) — "symmetric" per D-16 interpreted as "both visible above the fold", not "identical DOM node".
- **Person view**: fetch user's current prefs via `pb.collection('users').getOne(authId, { fields: 'id,ntfy_topic,notify_*,weekly_summary_day' })`, compose `NotificationPrefs` initialPrefs, replace placeholder JSX + import. Placeholder file deleted. Suite C E2E in `tests/e2e/views.spec.ts` rewritten to assert the new `data-notification-prefs-form` anchor.
- **Suite E E2E** (`tests/e2e/notifications.spec.ts`):
  - Part 1: signup → home → /person → fill topic + weekly summary + Monday → Save → assert toast → reload → round-trip assertions (topic value, checkbox checked, Monday selected).
  - Part 2: unauthed POST /api/admin/run-scheduler → 401 micro-test. Set topic + notify_overdue via form. Create task via UI (waitForURL on area redirect). Seed 5-day-ago completion via PB REST (cycle-mode makes next_due = 4 days ago — naturally overdue). POST /api/admin/run-scheduler with `x-admin-token` → assert `overdueSent >= 1` + PB notifications row exists with `ref_cycle` matching `task:{taskId}:overdue:`. Second POST → `overdueSent === 0` (idempotent). Notifications count unchanged.
- **Unit tests** (6 cases total):
  - HouseholdStreakBadge: streak=0 "Fresh week" copy, streak=1 singular, streak=7 plural, Flame icon aria-hidden.
  - MostNeglectedCard: null task → component returns null, rendered task → data-attrs + Complete button fires onComplete(task.id).
- **Test count growth:** 293 → 299 vitest (+6); Playwright 19 → 21 (+2 Suite E).

## Task Commits

Each task used full RED → GREEN TDD gating; Task 3 reused the RED spec written during Task 1 (one file, three-part flow).

1. **Task 1 RED: failing Suite E E2E spec** — `3bc1691` (test)
2. **Task 1 GREEN: NotificationPrefsForm + Person view wire + placeholder delete + Suite C rename** — `464b7ec` (feat)
3. **Task 2 RED: failing household-streak-badge + most-neglected-card component tests** — `cff1cb0` (test)
4. **Task 2 GREEN: streak badge + most-neglected card + area celebration + BandView wiring + dashboard header** — `0ec587a` (feat)
5. **Task 3 GREEN: playwright token env + Suite E Part 2 scheduler roundtrip** — `6d38372` (feat)

Five commits; four exercises of the TDD contract (two RED commits, three GREEN commits; Task 3 leverages the Task-1 RED spec).

## Files Created/Modified

**Created:**

- `components/notification-prefs-form.tsx` — 263 LOC RHF+zod+useActionState form bound to updateNotificationPrefsAction.
- `components/household-streak-badge.tsx` — 38 LOC presentational Flame badge (0/1/N copy matrix).
- `components/most-neglected-card.tsx` — 95 LOC warm-accent nudge card, null-when-no-overdue.
- `components/area-celebration.tsx` — 62 LOC motion-safe overlay, 2.5s auto-dismiss.
- `tests/e2e/notifications.spec.ts` — 331 LOC Suite E (Part 1 prefs roundtrip + Part 2 scheduler+idempotency + 401 micro-test).
- `tests/unit/components/household-streak-badge.test.tsx` — 48 LOC, 4 cases.
- `tests/unit/components/most-neglected-card.test.tsx` — 53 LOC, 2 cases.

**Modified:**

- `components/band-view.tsx` — celebration state + setCelebration in handleTap success branch + MostNeglectedCard insertion + AreaCelebration conditional render + imports.
- `app/(app)/h/[homeId]/page.tsx` — computeHouseholdStreak + HouseholdStreakBadge in header (left side, next to home name).
- `app/(app)/h/[homeId]/person/page.tsx` — users.getOne fetch + NotificationPrefs composition + placeholder → form swap + import.
- `tests/e2e/views.spec.ts` — Suite C data-notification-prefs-placeholder → data-notification-prefs-form rename (1-line maint).
- `playwright.config.ts` — export E2E_ADMIN_SCHEDULER_TOKEN + inject ADMIN_SCHEDULER_TOKEN into webServer env.

**Deleted:**

- `components/notification-prefs-placeholder.tsx` — superseded by the real form; views.spec.ts anchor renamed.

## Decisions Made

- **Celebration animation is pure Tailwind motion-safe variants, not canvas-confetti or hand-rolled keyframes.** `tw-animate-css` already ships; `motion-safe:animate-in fade-in slide-in-from-top-4` gives a clean slide-in; `motion-reduce:` users get a static pill (celebration still renders so the feedback isn't silently skipped — just non-animated).
- **CoverageRing stays inside BandView; streak badge goes in the dashboard page header.** D-16 says "symmetric layout"; the 03-02 contract has CoverageRing mounted as BandView's first child. Moving it to the page header would break every downstream caller (/by-area, /areas/[areaId] which also use BandView). Reading D-16 as "both visible above the fold" rather than "identical DOM node" keeps 03-02's contract intact while still achieving the visual intent.
- **NotificationPrefsPlaceholder file deleted, not re-exported.** The plan flagged Option B (re-export as back-compat). After audit, only tests/e2e/views.spec.ts referenced the old anchor — a one-line test edit is cleaner than a zombie re-export file that would pollute the import graph forever. The Suite C contract rename is inline-commented as legitimate maintenance.
- **MostNeglectedCard `pending` is per-task precise, not per-any.** The plan called this out as a choice point: `pending={pendingTaskId !== null}` or `pending={pendingTaskId === task.id}`. Chose the stricter per-task match — aligns with TaskRow's contract, avoids disabling the Complete affordance when an unrelated task is in flight (rare case but real).
- **Celebration mount key is `Date.now()`.** Guarantees remount + fresh 2500ms timer when a second crossover fires back-to-back. Without it, a user who completes two tasks quickly in different areas would see the first overlay's `onDone` fire while the second areaName is visible, dismissing it early.
- **useRef-guarded useEffect toast dispatch.** `useActionState` returns a new state object on each server response; `useEffect([state])` fires once per object. The ref-comparison pattern prevents a stale render from re-firing the toast unnecessarily.
- **Separate test-file location `tests/unit/components/`.** The prior tests (coverage-ring, task-row, horizon-strip) lived flat under `tests/unit/`. New tests nested under `components/` for future-proofing as Phase 6 components multiply. No vitest config change needed — the include glob `tests/unit/**/*.test.{ts,tsx}` picks them up.

## Deviations from Plan

Only minor adjustments — no Rule 4 architectural decisions.

### Auto-fixed Issues

**1. [Rule 3 — Blocking] E2E Part 2 `findTaskId` raced the PB write**

- **Found during:** Task 3 first playwright-full run
- **Issue:** After `page.click('button:has-text("Create task")')` the spec immediately called `findTaskId(...)` via PB REST. On a slow CI-like start, the server action's `pb.collection('tasks').create()` + redirect hadn't committed yet → `expect(items.length).toBeGreaterThan(0)` failed.
- **Fix:** Added `await page.waitForURL(/\/h\/[a-z0-9]{15}\/areas\/[a-z0-9]{15}$/)` between the click and the REST query — mirrors the pattern from `tests/e2e/views.spec.ts createTaskInArea` which Suite B+C rely on.
- **Files modified:** `tests/e2e/notifications.spec.ts`
- **Commit:** `6d38372` (included in the Task 3 feat commit).

No other deviations. The three component unit tests landed clean on first GREEN pass. The BandView wiring compiled clean on first pass. The form's `useActionState` + RHF hybrid landed green on the first Part-1 E2E run.

## Issues Encountered

- **Lint warnings on `watch()` in NotificationPrefsForm.** `react-hooks/incompatible-library` fires on `useForm().watch('notify_weekly_summary')` — same warning that's been green-outstanding on `components/forms/task-form.tsx` since 02-05. Two warnings, zero errors, non-blocking. If it ever becomes a hard error, the remediation is to wrap the form in `'use no memo';` (same remediation the plan anticipated for BandView if needed). Not needed here.

## Authentication Gates

None. The E2E Part 2 flow uses the 06-02 admin-route pattern (pre-shared `ADMIN_SCHEDULER_TOKEN` injected via playwright.config.ts); no real external services touched. Real ntfy.sh is never hit because E2E users have unique topics that no subscriber claims — the `sendNtfy` 5s timeout + never-throws contract from 06-01 guarantees the absence of a subscriber can't block the notification write.

## TDD Gate Compliance

- **Task 1:**
  - RED: `3bc1691 test(06-03): add failing Suite E notifications E2E` — playwright fails on `[data-notification-prefs-form]` visibility (the component doesn't exist yet).
  - GREEN: `464b7ec feat(06-03): implement NotificationPrefsForm` — Part 1 of the Suite E spec passes; full vitest 293/293; tsc clean.

- **Task 2:**
  - RED: `cff1cb0 test(06-03): add failing household-streak-badge + most-neglected-card component tests` — both fail with `Failed to resolve import` (components don't exist).
  - GREEN: `0ec587a feat(06-03): HouseholdStreakBadge + MostNeglectedCard + AreaCelebration + BandView wiring` — 6/6 component tests pass; full vitest 299/299; tsc + build clean.

- **Task 3:**
  - No fresh RED commit — the Task 1 RED spec already covered Part 2 in the same file (single test.describe.serial block). Task 3's job was wiring the env + making Part 2 pass.
  - GREEN: `6d38372 feat(06-03): Suite E Part 2 scheduler roundtrip + playwright admin token env` — 21/21 playwright tests pass.

No REFACTOR commits needed — each GREEN landed clean except the one raceable test fix (see Deviations §1).

## User Setup Required

No new env vars or manual steps beyond 06-02's `ADMIN_SCHEDULER_TOKEN` + `NTFY_URL` plumbing. End-users hitting the new UI need nothing; they just visit /person, fill their ntfy topic, and toggle the prefs.

Manual verification checklist:

- [ ] Visit `/h/<home>` — confirm household streak badge appears in the header next to the home name.
- [ ] Complete all tasks in an area — confirm the sparkle slide-in appears ~500ms after the tap and dismisses after ~2.5s.
- [ ] On a reduced-motion device — confirm the pill appears without animation (still shows + dismisses).
- [ ] Mark a task as overdue (seed past completion or wait out the next_due) — confirm MostNeglectedCard appears between Overdue and This Week bands with gentle copy.
- [ ] Tap MostNeglectedCard → confirm it completes the task (same flow as row tap).
- [ ] Visit `/h/<home>/person` → scroll to Notifications section → form is live (not disabled); fill topic + save; reload → values persist.
- [ ] Toggle "Send me a weekly summary" → confirm Sunday/Monday selector reveals.

## Threat Model Adherence

All `mitigate` dispositions in the plan's `<threat_model>` are implemented:

- **T-06-03-01** (client validation bypass): Server action `updateNotificationPrefsAction` re-parses via `notificationPrefsSchema.safeParse()` on every submit (06-02 code path); PB users.updateRule gates the write to `auth.id = self`. Client-side RHF is UX only.
- **T-06-03-03** (admin route DoS / brute force): Token length + equality check in the route handler (06-02 code path); route returns 401 identically for unset/too-short/mismatch. Playwright injects a 46-char token for the E2E; production uses `openssl rand -hex 24` per .env.example.
- **T-06-03-04** (celebration flag client forgery): `celebration` is set server-side inside `completeTaskAction` (06-02 flow); client never forges it. The BandView's `handleTap` reads it off the server action result and sets celebration state — zero client-controllable inputs.
- **T-06-03-05** (MostNeglectedCard completing someone else's task): Reuses `handleTap` → `completeTaskAction` which has full T-03-01-01..08 coverage (ownership preflight + membership assertion + guard re-check). MostNeglectedCard is a UI surface; the server action is the security boundary.
- **T-06-03-07** (celebration overlay blocks UI): `pointer-events-none` on the overlay so underlying rows stay tappable; `position: fixed` + `z-50` + backdrop; `setTimeout(2500ms)` cleanup in useEffect.
- **T-06-03-08** (prefs save with no server state): `useActionState` returns `{ok:true}` only after PB's `users.update` resolved; form renders fresh prefs on reload via Server Component fetch.

`accept`-disposition threats (T-06-03-02 ntfy_topic visible to self; T-06-03-06 area name in celebration) inherit unchanged.

## Threat Flags

None found. The form reuses the 06-02 server action + PB write path; the admin route is untouched; MostNeglectedCard and celebration rely on the existing completeTaskAction security boundary. No new network endpoints, no new auth paths, no new file-access patterns, no new schema surface.

## Phase 6 Requirement Close-Out

All 12 Phase 6 REQ-IDs close this plan:

| Req ID  | Shipped by    | Artifact                                                                                     |
|---------|---------------|----------------------------------------------------------------------------------------------|
| NOTF-01 | 06-02 + 06-03 | updateNotificationPrefsAction + NotificationPrefsForm                                        |
| NOTF-02 | 06-01 + 06-02 | lib/ntfy.ts + NTFY_URL env plumbing                                                          |
| NOTF-03 | 06-02         | processOverdueNotifications + unique-index idempotency                                       |
| NOTF-04 | 06-02         | sendAssignedNotification wired into updateTaskAction                                         |
| NOTF-05 | 06-02 + 06-03 | sendPartnerCompletedNotifications + notify_partner_completed toggle in form                  |
| NOTF-06 | 06-02 + 06-03 | processWeeklySummaries + weekly_summary_day select + notify_weekly_summary toggle in form    |
| NOTF-07 | 06-01 + 06-02 | ref_cycle builders + hasNotified / recordNotification + unique index on (user_id, ref_cycle) |
| GAME-01 | 06-01 + 06-03 | computeHouseholdStreak + HouseholdStreakBadge                                                |
| GAME-02 | 03-02 + 06-03 | CoverageRing (03-02) surfaced on dashboard above the fold via BandView unchanged             |
| GAME-03 | 06-01 + 06-02 | computeWeeklySummary + scheduler weekly pass                                                 |
| GAME-04 | 06-01 + 06-02 + 06-03 | detectAreaCelebration + completeTaskAction celebration flag + AreaCelebration overlay |
| GAME-05 | 06-03         | MostNeglectedCard component + BandView insertion                                             |

## Next Phase Readiness

**Phase 7 (PWA & Release) integration points:**

- **Web Push fallback for non-ntfy users:** NotificationPrefsForm is the natural place to add a "Install to enable browser push" CTA. Phase 7 can add the Web Push permission-request button inside the Notifications Card next to the ntfy topic input. No refactor of the form needed; just an additional section.
- **Celebration palette continuity:** the motion-safe slide-in + primary/10 backdrop palette used in AreaCelebration is a candidate for re-use in the PWA install prompt + offline banner. Same Tailwind utilities; same a11y contract.
- **Service Worker + offline:** MostNeglectedCard reads from the server-rendered bands prop — safe to consume from an offline Service-Worker cache without special handling. The Complete button will need the Phase 7 outbox pattern to queue completions while offline.

**No blockers.** Phase 7 can begin immediately.

## Self-Check: PASSED

Verified (via `test -f` + `git log` + grep):

- FOUND: `components/notification-prefs-form.tsx` (contains `updateNotificationPrefsAction`, `useActionState`, `ntfy_topic`, `weekly_summary_day`, `data-notification-prefs-form`)
- FOUND: `components/household-streak-badge.tsx` (contains `Flame`, `data-household-streak-badge`)
- FOUND: `components/most-neglected-card.tsx` (contains `return null`, `data-most-neglected-card`, `AlertCircle`)
- FOUND: `components/area-celebration.tsx` (contains `motion-safe`, `data-area-celebration`, `Sparkles`, `setTimeout`)
- MISSING-AS-EXPECTED: `components/notification-prefs-placeholder.tsx` (deleted).
- FOUND: `app/(app)/h/[homeId]/page.tsx` contains `computeHouseholdStreak`, `HouseholdStreakBadge`.
- FOUND: `components/band-view.tsx` contains `AreaCelebration`, `MostNeglectedCard`, `celebration`, `setCelebration`, `result.celebration`, `mostNeglected`.
- FOUND: `app/(app)/h/[homeId]/person/page.tsx` contains `NotificationPrefsForm`, `initialPrefs`.
- FOUND: `tests/e2e/notifications.spec.ts` contains `/api/admin/run-scheduler`, `kind.*overdue`, `data-notification-prefs-form`.
- FOUND: `playwright.config.ts` contains `ADMIN_SCHEDULER_TOKEN`, `DISABLE_SCHEDULER`, token length ≥32.
- FOUND: commits `3bc1691`, `464b7ec`, `cff1cb0`, `0ec587a`, `6d38372` in git log.
- FULL VITEST: 299/299 passing (42 test files).
- FULL PLAYWRIGHT: 21/21 passing (19 prior + 2 new Suite E).
- TSC: clean (zero errors).
- BUILD: clean (`npm run build` succeeds with /api/admin/run-scheduler in route manifest).

---

*Phase: 06-notifications-gamification*
*Plan: 03*
*Completed: 2026-04-21*
