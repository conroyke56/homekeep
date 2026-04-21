---
phase: 05-views-onboarding
plan: 02
subsystem: ui
tags: [server-components, pocketbase, date-fns-tz, lucide, e2e-playwright, url-params]

# Dependency graph
requires:
  - phase: 05-views-onboarding
    provides: NavShell (auto-scopes under /h/[homeId]/*); computeAreaCoverage + computeAreaCounts; computePersonalStreak; filterCompletions + HistoryFilter types
  - phase: 04-collaboration
    provides: resolveAssignee cascade; assertMembership; home_members expand pattern
  - phase: 03-core-loop
    provides: TaskBand + TaskRow + HorizonStrip; EarlyCompletionDialog; completeTaskAction + CompleteResult union; CompletionRecord type
  - phase: 02-auth-core-data
    provides: createServerClient; homes collection; areas collection (Phase 2 area detail route /h/[id]/areas/[id])
provides:
  - /h/[homeId]/by-area route (AreaCard grid, Whole Home pinned)
  - /h/[homeId]/person route (4 sections: your tasks / history / stats / notifications placeholder)
  - /h/[homeId]/history route (filtered reverse-chronological timeline with URL-param filters)
  - AreaCard presentational tile (coverage bar + counts + area color accent)
  - PersonalStats tiles (weekly / monthly / streak)
  - NotificationPrefsPlaceholder Phase 6 preview stub
  - PersonTaskList client wrapper (BandView minus CoverageRing/DetailSheet)
  - HistoryTimeline day-grouped (sticky headers, avatar + area chip + relative time)
  - HistoryFilters URL-param writer (person / area / range)
  - tests/e2e/views.spec.ts Phase 5 E2E suites B/C/D
affects: [05-03-onboarding-wizard, phase-06-notifications, phase-06-streaks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-Component fetch-and-compose — mirror /h/[homeId]/page.tsx shape (assertMembership + home + areas + tasks + completions); run pure helpers server-side; pass minimal snapshot to child components"
    - "URL-param filter round-trip — client writes via router.push(URLSearchParams), server reads via searchParams Promise, default values stripped from URL for clean reset"
    - "Validation whitelist on enum-typed URL params — T-05-02-03 range guard pattern; unknown values fall back to default"
    - "Thin client extraction — PersonTaskList re-uses BandView's useOptimistic + startTransition shape minus surface bits that don't fit the Person scope (CoverageRing, TaskDetailSheet)"
    - "Day-grouping via formatInTimeZone yyyy-MM-dd keys + Today/Yesterday via startOfDay(zonedNow) - 86400000ms (DST-safe derivation)"

key-files:
  created:
    - app/(app)/h/[homeId]/by-area/page.tsx
    - app/(app)/h/[homeId]/person/page.tsx
    - app/(app)/h/[homeId]/history/page.tsx
    - components/area-card.tsx
    - components/personal-stats.tsx
    - components/notification-prefs-placeholder.tsx
    - components/person-task-list.tsx
    - components/history-timeline.tsx
    - components/history-filters.tsx
    - tests/e2e/views.spec.ts
  modified:
    - pocketbase/pb_hooks/bootstrap_ratelimits.pb.js

key-decisions:
  - "PersonTaskList is a bespoke client wrapper (NOT a BandView prop variation) — keeps BandView focused on the dashboard; surface omissions (no CoverageRing, no TaskDetailSheet) are documented-intent for Person scope"
  - "PersonalStats streak=0 renders warm 'New week — let's go!' copy per CONTEXT §specifics; weekly/monthly still show literal counts including zero"
  - "HistoryFilters strips default values (empty person/area, range=month) from URL for clean /history URLs; server-side whitelist of range values mitigates T-05-02-03"
  - "History cap at 50 items with 'Showing 50 of N' footer over server-side pagination — keeps Phase 5 simple; Phase 6+ can layer pagination if needed (T-05-02-05 acknowledged)"
  - "Playwright E2E uses direct /by-area navigation (not bottom-nav click) because the NavShell BottomNav is md:hidden — desktop viewport would miss it; URL-driven assertion is more robust across viewports"
  - "Rate limit bumped 20→60/60s to handle Phase 5's added signup load (17-test serial + parallel runs both green); see Deviations"

patterns-established:
  - "Pattern: URL-param filter writer — client useRouter+useSearchParams+URLSearchParams, patch object per control, default-stripping for clean-URL reset; server reads via Promise<searchParams> and validates enum-typed values against a whitelist"
  - "Pattern: Server Component fetch shape — assertMembership gate → home.getOne (title+tz) → members (home_members+expand) → areas → tasks(archived=false) → getCompletionsForHome(13mo window) → reduceLatestByTask"
  - "Pattern: thin client extraction — when a Phase 3 client component has two reasonable scopes (dashboard vs person), fork the scope-specific variant rather than bolt optional props onto the original; keeps intent per-component unambiguous"

requirements-completed:
  - AREA-V-01
  - AREA-V-02
  - AREA-V-03
  - PERS-01
  - PERS-02
  - PERS-03
  - PERS-04
  - HIST-01
  - HIST-02
  - HIST-03

# Metrics
duration: 20min
completed: 2026-04-21
---

# Phase 5 Plan 02: Views — By Area / Person / History Summary

**Three Server-Component routes (/by-area, /person, /history) plus five presentational components and three Playwright suites, closing 10 requirement IDs (AREA-V-01..03, PERS-01..04, HIST-01..03) on top of 05-01 helpers.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-21T04:44:16Z
- **Completed:** 2026-04-21T05:04:21Z
- **Tasks:** 3
- **Files modified:** 10 created, 1 modified

## Accomplishments

- **By Area view** at `/h/[homeId]/by-area` — Server Component fetches home+areas+tasks+completions, runs `computeAreaCoverage` + `computeAreaCounts` per area (05-01 helpers), splits Whole Home pinned ABOVE a Separator from the rest in a responsive 1/2/3-column grid (D-05). Empty-home CTA links to `/areas` when only Whole Home exists (D-22). `AreaCard` tile has left-border accent at `area.color` via inline style (hex can't be Tailwind-ified at build), Lucide icon via dynamic PascalCase lookup with Home fallback, counts row (overdue · thisWeek · upcoming; warm-accent for overdue>0), flat coverage bar + %, entire card wrapped in `<Link>` to the existing Phase 2 `/areas/[areaId]` route (D-06).
- **Person view** at `/h/[homeId]/person` — 4 sections per D-07:
  1. **Your tasks** — `resolveAssignee` cascade filtered to `authId` (task-level OR area-default; 'anyone' excluded per PERS-01 contract). Renders via `PersonTaskList` (client) which preserves the full tap-to-complete + early-completion-guard flow from BandView.
  2. **Your history** — user's completions in the last 30 days as a reverse-chronological list (task name + relative time via `formatDistanceToNow`; tooltip shows absolute timestamp in home timezone).
  3. **Your stats** — `PersonalStats` tiles with weekly + monthly (anchored at local midnight via `fromZonedTime`) + `computePersonalStreak`. Streak=0 shows "New week — let's go!" per CONTEXT §specifics.
  4. **Notifications** — `NotificationPrefsPlaceholder` with disabled inputs and "coming in Phase 6" copy (PERS-04).
- **History view** at `/h/[homeId]/history` — Server Component reads `searchParams.{person,area,range}`, validates `range` against the canonical four values (T-05-02-03 mitigation: unknown → 'month'), applies `filterCompletions` (05-01), caps at 50 with "Showing 50 of N" footer when truncated. `HistoryTimeline` groups by local day (sticky backdrop-blur headers: Today / Yesterday / `EEEE, MMM d`), each row renders AvatarCircle + "{user} completed {task}" + color-dotted area chip + `formatDistanceToNow` relative time. `HistoryFilters` (client) writes URL params via `router.push(URLSearchParams)` with default-stripping.
- **Three Playwright E2E suites** (D-19) — all pass against live PB+Next.js:
  - **Suite B** (by-area): 3 areas (Whole Home + Kitchen + Bathroom), assert Whole Home pinned first in DOM, data-* attrs for counts/coverage correct, tap Kitchen card → `/areas/[id]` with "Tasks in Kitchen".
  - **Suite C** (person): 2 tasks (one 'anyone', one assigned to self), 1 completion seeded via PB REST; assert your-tasks-count=1 (Clean filter only, no Wipe benches), your-history-count=1, weekly=1, streak=1, notification-prefs placeholder visible with "coming in Phase 6" copy and disabled inputs.
  - **Suite D** (history): 2 tasks, 2 back-dated completions (today + yesterday via PB REST); assert 2 entries, Today+Yesterday headers, area filter URL round-trip, range=today narrows to 1, range=all restores to 2.

## Task Commits

Each task committed atomically.

1. **Task 1: By Area view + AreaCard** — `09f0e38` (feat)
2. **Task 2: Person view + PersonalStats + NotificationPrefsPlaceholder + PersonTaskList** — `ea4bca5` (feat)
3. **Task 3: History view + HistoryTimeline + HistoryFilters + E2E Suites B/C/D (+ rate-limit bump)** — `e15a09f` (feat)

**Plan metadata commit:** pending (created alongside SUMMARY + STATE updates).

## Files Created/Modified

- `app/(app)/h/[homeId]/by-area/page.tsx` — Server Component; assertMembership + home + areas + tasks(archived=false) + completions fetch; per-area `computeAreaCoverage` + `computeAreaCounts`; Whole Home + Separator + grid layout.
- `app/(app)/h/[homeId]/person/page.tsx` — Server Component; member/area fetches drive `resolveAssignee` filter to `authId`; homeCompletions(13mo) narrowed to user for stats + 30-day history; four sections with `data-section` anchors.
- `app/(app)/h/[homeId]/history/page.tsx` — Server Component; searchParams→filter object with range whitelist (T-05-02-03); `filterCompletions` (05-01) + 50-cap; entries shape built from tasks+areas+members maps.
- `components/area-card.tsx` — Link-wrapped Card with left-color-accent, Lucide icon, counts, coverage bar; E2E data-* attrs.
- `components/personal-stats.tsx` — 3-tile grid (weekly/monthly/streak); warm copy when streak=0.
- `components/notification-prefs-placeholder.tsx` — Client; disabled ntfy-topic Input + disabled email-summary checkbox + Phase 6 preview copy.
- `components/person-task-list.tsx` — Client; BandView minus CoverageRing + TaskDetailSheet; preserves optimistic + guard flow via `completeTaskAction`.
- `components/history-timeline.tsx` — Presentational; yyyy-MM-dd bucketing via formatInTimeZone; Today/Yesterday labels via startOfDay-1-day in tz; sticky backdrop-blur headers; AvatarCircle rows.
- `components/history-filters.tsx` — Client; useRouter+useSearchParams+URLSearchParams; person/area native selects + 4-button range group; default-stripping for clean URLs.
- `tests/e2e/views.spec.ts` — 3 `describe.serial` suites (B/C/D); shared helpers (signup, createHome, PB REST authPB/findAreaId/findTaskId/seedCompletion); unique-email `stamp()`.
- `pocketbase/pb_hooks/bootstrap_ratelimits.pb.js` — bumped `*:authWithPassword` 20/60s → 60/60s with inline `DEVIATION (05-02 Rule 3)` comment referencing the Phase 5 added suites.

## Decisions Made

- **PersonTaskList forked from BandView** (not a prop variation) — BandView's CoverageRing + TaskDetailSheet are fit for the dashboard; forking keeps each component's intent unambiguous. Both share the same `useOptimistic(completions, reducerForm)` + `startTransition(completeTaskAction)` + `EarlyCompletionDialog` pattern, so behaviour is identical where it matters.
- **Lucide icon dynamic lookup via `LucideIcons as unknown as Record<string, ComponentType>`** — AreaIcon names are stored kebab-case; converting to PascalCase and doing a runtime lookup avoids a 30-icon import manifest. Falls back to `Home` if missing (defence for legacy data or icons dropped between lucide versions).
- **HistoryFilters defaults stripped from URL** — person="", area="", range="month" are all considered defaults and removed from URLSearchParams; this keeps `/history` clean when a user resets filters and makes URL-share links meaningful.
- **HistoryTimeline passes taskAreaMap-less completions through** — the timeline receives pre-joined `HistoryEntry` shapes with user/task/area objects already populated on the server, so the component itself doesn't need a taskAreaMap. This separates fetch/compose (server) from presentation (client-safe).
- **E2E uses direct URL navigation, not bottom-nav tap** — NavShell's BottomNav is `md:hidden`, so Playwright's default desktop viewport would miss it. `page.goto(/h/{id}/by-area)` asserts the route works; Phase 5 manual smoke confirms the nav UX on narrow viewports. This is a conscious trade-off (E2E robustness over nav-UI click assertion).
- **50-item history cap with footer** — pagination state adds UX complexity we don't need at Phase 5. When `filtered.length > 50` a muted "Showing 50 of N" footer appears; Phase 6+ can upgrade to Load-More if real homes hit the ceiling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] HistoryFilter type widening for strict-null**
- **Found during:** Task 3 (history page.tsx initial compile)
- **Issue:** `HistoryFilter.personId` type is `string | null | undefined` (via the `?` modifier); TypeScript strict refused to narrow when I assigned a computed `string | null` value. Cast error: "Type 'string | null | undefined' is not assignable to type 'string | null'".
- **Fix:** Widened the local `filter` variable's type to `HistoryFilter & { personId: string | null; areaId: string | null }` — the intersection narrows the optional-null union to exactly `string | null` for the two keys I'm assigning. Upstream `filterCompletions` still accepts the base `HistoryFilter` so no API change needed.
- **Files modified:** `app/(app)/h/[homeId]/history/page.tsx`
- **Verification:** `npx tsc --noEmit` green; `filterCompletions` call compiles + runs.
- **Committed in:** `e15a09f` (Task 3 commit).

**2. [Rule 3 — Blocking] `*:authWithPassword` rate limit exhausted on full-suite E2E run**
- **Found during:** Task 3 E2E verification (`npx playwright test`)
- **Issue:** Full suite (17 tests total — 14 existing + 3 new) runs 15+ signup flows within a 60s window; 20/60s rate limit set in Phase 4 blocks the tail tests with "Could not create account". Affected both Suite C/D of the new spec AND the pre-existing `homes-areas.spec.ts:34:5` (which was already near the limit). Running `--workers=1` did not help (rate limit is wall-clock, not concurrent).
- **Fix:** Bumped `*:authWithPassword` 20/60s → 60/60s in `pocketbase/pb_hooks/bootstrap_ratelimits.pb.js`. Commented inline with `DEVIATION (05-02 Rule 3 - Blocking)` and the password-spray math (60 attempts/min still prohibitive for a 6-char dictionary attack).
- **Files modified:** `pocketbase/pb_hooks/bootstrap_ratelimits.pb.js`
- **Verification:** Full suite passes `npx playwright test` AND `--workers=1` — 17/17 green both ways. Suite B alone would have passed either way (first-in-queue).
- **Committed in:** `e15a09f` (Task 3 commit).
- **Note:** Also documented Phase 5 adds 3 suites; Phase 7 hardening may layer per-IP prefix or captcha. Not a security regression — Phase 2 had 5/60s, 02-04 already bumped to 20/60s for similar reason.

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking).
**Impact on plan:** Both essential to complete the plan — first is a type-system widening, second is infra (same class of bump as 02-04). No scope creep; plan shipped as written.

## Issues Encountered

- `HistoryFilter` type optional-null widening (see Deviation 1). Resolved in minutes with a local type intersection.
- Rate-limit collision on full-suite E2E run (see Deviation 2). Resolved by bumping the limit with documented rationale.
- None beyond the two deviations.

## Acceptance Grep Results

| Gate | Expected | Actual |
|------|----------|--------|
| `computeAreaCoverage\|computeAreaCounts` in by-area/page.tsx | ≥ 2 | 4 |
| `is_whole_home_system` in by-area/page.tsx | ≥ 2 | 5 |
| `assertMembership` in by-area/page.tsx | ≥ 1 | 3 |
| `AreaCard` in components/area-card.tsx | ≥ 1 | 2 |
| `data-area-id\|data-overdue-count\|data-coverage` in area-card.tsx | ≥ 3 | 5 |
| `/areas/` link in area-card.tsx | ≥ 1 | 2 |
| `/h/[homeId]/by-area` in route map | present | present |
| `resolveAssignee` in person/page.tsx | ≥ 1 | 3 |
| `computePersonalStreak` in person/page.tsx | ≥ 1 | 2 |
| `assertMembership` in person/page.tsx | ≥ 1 | 3 |
| `PersonalStats\|NotificationPrefsPlaceholder\|PersonTaskList` in person/page.tsx | ≥ 3 | 7 |
| `completed_by_id.*authId` filter in person/page.tsx | ≥ 1 | 1 |
| `data-person-view\|data-streak\|data-weekly-count\|data-monthly-count` across person files | ≥ 4 | 6 (1 page + 5 stats) |
| `completeTaskAction` in person-task-list.tsx | ≥ 1 | 2 |
| `/h/[homeId]/person` in route map | present | present |
| `filterCompletions` in history/page.tsx | ≥ 1 | 3 |
| `HistoryTimeline\|HistoryFilters` in history/page.tsx | ≥ 2 | 6 |
| `sticky` in history-timeline.tsx | ≥ 1 | 2 |
| `router.push\|searchParams` in history-filters.tsx | ≥ 1 | 6 |
| `describe.*Suite B\|by-area` in views.spec.ts | ≥ 1 | 1 |
| `describe.*Suite C\|person` in views.spec.ts | ≥ 1 | 1 |
| `describe.*Suite D\|history` in views.spec.ts | ≥ 1 | 1 |
| `/h/[homeId]/history` in route map | present | present |

## Test Suite Metrics

| Metric | Before | After |
|--------|--------|-------|
| Unit test files | 31 | 31 (no new unit tests; 05-01 already covered the pure helpers this plan consumed) |
| Unit tests | 220 | 220 (no regressions) |
| E2E suite files | 8 | **9** (+1: views.spec.ts) |
| E2E tests | 14 | **17** (+3: Suite B / Suite C / Suite D) |
| Failures | 0 | 0 |

- `npm test` — 220/220 green (35.5s).
- `npm run lint` — 0 new warnings (1 pre-existing `react-hooks/incompatible-library` in task-form.tsx).
- `npx tsc --noEmit` — 0 errors.
- `npm run build` — clean; route map includes `/h/[homeId]/by-area`, `/h/[homeId]/person`, `/h/[homeId]/history`.
- `npx playwright test` — 17/17 green both in parallel (`1.1m`) AND `--workers=1` (`1.1m`).

## User Setup Required

None — the rate-limit change applies automatically on next `pb serve` / `node scripts/dev-pb.js` via the bootstrap hook.

## Self-Check: PASSED

- [x] `app/(app)/h/[homeId]/by-area/page.tsx` exists
- [x] `app/(app)/h/[homeId]/person/page.tsx` exists
- [x] `app/(app)/h/[homeId]/history/page.tsx` exists
- [x] `components/area-card.tsx` exists
- [x] `components/personal-stats.tsx` exists
- [x] `components/notification-prefs-placeholder.tsx` exists
- [x] `components/person-task-list.tsx` exists
- [x] `components/history-timeline.tsx` exists
- [x] `components/history-filters.tsx` exists
- [x] `tests/e2e/views.spec.ts` exists
- [x] All commit hashes present in git log: `09f0e38`, `ea4bca5`, `e15a09f`
- [x] `/h/[homeId]/by-area`, `/h/[homeId]/person`, `/h/[homeId]/history` all appear in `npm run build` route map
- [x] Phase 5 views E2E suite B/C/D — 3/3 green alongside Phase 2-4 suites (17/17 total)

## Next Phase Readiness

**05-03 (Wave 3 onboarding wizard) can now:**
- Read `homes.onboarded=false` via Phase 5 layout guard to redirect new homes to `/onboarding`.
- Import `SEED_LIBRARY` (05-01) to render the seed accept/edit/skip UI; batch-create tasks post-submit; flip `homes.onboarded=true`.
- Re-use `AreaCard` if a "preview your areas" step is wanted.
- Re-use the URL-param + validation-whitelist pattern from HistoryFilters for onboarding step navigation.

**Phase 6 (notifications) can now:**
- Replace `NotificationPrefsPlaceholder` with a real form using the same disabled-inputs shape as scaffolding (no layout re-work needed).
- Hook into `PersonalStats` streak count for celebration fires.
- Use the `HistoryTimeline` day-grouping pattern for the notification history if that surface is added.

**No blockers.** All 10 requirement IDs closed (AREA-V-01..03, PERS-01..04, HIST-01..03). Rate-limit bump is monitored for Phase 7 hardening.

---
*Phase: 05-views-onboarding*
*Plan: 02*
*Completed: 2026-04-21*
