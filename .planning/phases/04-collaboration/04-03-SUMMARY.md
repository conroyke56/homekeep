---
phase: 04-collaboration
plan: 03
subsystem: ui-wiring
tags: [assignee-cascade, avatar-primitives, home-switcher-swap, settings, members, leave-home, playwright-e2e, pure-function, rule-swap, users-view-rule]

# Dependency graph
requires:
  - phase: 04-collaboration
    plan: 01
    provides: "home_members + invites collections, membership-gated rules"
  - phase: 04-collaboration
    plan: 02
    provides: "createInvite/acceptInvite/revokeInvite, removeMember/leaveHome, assertMembership/assertOwnership, admin client"
  - phase: 03-core-loop
    provides: "BandView + TaskRow + TaskDetailSheet + HomeSwitcher scaffolding"
provides:
  - "lib/assignment.ts — pure resolveAssignee(task, area, members) with 6-case cascade matrix"
  - "components/avatar-circle.tsx — solid/wireframe/dashed primitive + initialsOf helper (no radix)"
  - "components/avatar-stack.tsx — overlapping row + overflow pill, optional Link wrap"
  - "components/assignee-display.tsx — effective-assignee renderer with data-assignee-kind"
  - "components/invite-link-card.tsx — createInvite + URL + Copy + pending list + revoke"
  - "components/members-list.tsx — per-row Remove confirm dialog"
  - "components/leave-home-menu-item.tsx — AccountMenu confirm dialog wired to leaveHome"
  - "components/delete-home-button.tsx — Danger zone confirm for deleteHome"
  - "/h/[homeId]/settings — owner-gated home details + invites + danger zone"
  - "/h/[homeId]/members — owner-gated members list"
  - "/h/[homeId]/leave — SSR confirm + server-action form fallback"
  - "pocketbase/pb_migrations/1714953603_users_view_rule_shared_home.js — users can view co-home members"
affects:
  - "Phase 5 Views & Onboarding — Person view can consume resolveAssignee + AvatarStack + members queries"
  - "Phase 5+ — all future TaskForm call sites must pass members prop (empty array safe)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure cascading resolver + discriminated union at the data boundary; UI reads `.kind` only"
    - "Playwright globalSetup spawns `pocketbase superuser upsert` CLI so invite flow is testable end-to-end"
    - "PB users.viewRule relaxation via `home_members_via_user_id.home_id.home_members_via_home_id.user_id ?= @request.auth.id` double-hop back-relation"
    - "Native <select> for TaskForm assignee picker (matches existing Area picker, no shadcn Select adoption required)"
    - "AvatarCircle minimal primitive (no @radix-ui/react-avatar dep) with three pure-CSS variants"

key-files:
  created:
    - "lib/assignment.ts (78 lines) — resolveAssignee + Member/AreaLite/TaskLite/EffectiveAssignee"
    - "components/avatar-circle.tsx (80 lines) — AvatarCircle + initialsOf"
    - "components/avatar-stack.tsx (64 lines) — AvatarStack with Link wrap"
    - "components/assignee-display.tsx (67 lines) — 3-variant renderer"
    - "components/invite-link-card.tsx (165 lines) — createInvite + copy + pending + revoke"
    - "components/members-list.tsx (155 lines) — row + confirm dialog"
    - "components/leave-home-menu-item.tsx (96 lines) — dialog + leaveHome"
    - "components/delete-home-button.tsx (82 lines) — dialog + deleteHome"
    - "app/(app)/h/[homeId]/settings/page.tsx (118 lines) — owner-gated route"
    - "app/(app)/h/[homeId]/members/page.tsx (66 lines) — owner-gated route"
    - "app/(app)/h/[homeId]/leave/page.tsx (64 lines) — SSR confirm"
    - "pocketbase/pb_migrations/1714953603_users_view_rule_shared_home.js (41 lines)"
    - "tests/unit/assignment.test.ts (82 lines) — 6-case matrix"
    - "tests/e2e/collaboration.spec.ts (138 lines) — Suites A + C"
    - "tests/e2e/task-assignment.spec.ts (168 lines) — Suite B"
    - "tests/e2e/global-setup.ts (94 lines) — PB superuser provisioner"
  modified:
    - "app/(app)/layout.tsx — Pattern 11 home_members swap + ownedHomeIds → AccountMenu"
    - "app/(app)/h/[homeId]/page.tsx — members + areas fetch + resolveAssignee + AvatarStack header"
    - "app/(app)/h/[homeId]/tasks/new/page.tsx — members fetch → TaskForm"
    - "app/(app)/h/[homeId]/tasks/[taskId]/page.tsx — members fetch + assigned_to_id passthrough"
    - "components/home-switcher.tsx — role prop + Owner badge inline"
    - "components/account-menu.tsx — usePathname-derived LeaveHomeMenuItem"
    - "components/band-view.tsx — TaskWithName gains effective + threading via attachMeta"
    - "components/task-band.tsx — forward effective to TaskRow"
    - "components/task-row.tsx — AssigneeDisplay inline + data-assignee-kind"
    - "components/task-detail-sheet.tsx — Assigned to section + effective prop"
    - "components/forms/task-form.tsx — members prop + assignee <select>"
    - "lib/actions/invites.ts — drop revalidatePath from acceptInvite (Rule 1)"
    - "playwright.config.ts — globalSetup + webServer env injection"
    - "tests/e2e/homes-areas.spec.ts — accept Owner-badge suffix in menuitem match (Rule 1)"

key-decisions:
  - "Native <select> for the TaskForm assignee picker, not shadcn Select — matches the existing Area picker's DOM + zero new dependency"
  - "Minimal AvatarCircle primitive with pure CSS variants — no @radix-ui/react-avatar; keeps bundle lean + matches D-10 wire-frame / dashed variants directly"
  - "users.viewRule relaxation via double-hop back-relation (`home_members_via_user_id.home_id.home_members_via_home_id.user_id ?= @request.auth.id`) over a @collection cross-join — back-relations are more performant in PB 0.37 (single SQL JOIN each, no OR-scan)"
  - "LeaveHomeMenuItem is not wrapped in DropdownMenuItem — Radix auto-closes on menu item click which would dismiss the Dialog trigger. Rendered as a lookalike button styled to match DropdownMenuItem visuals"
  - "acceptInvite's revalidatePath removed entirely — Next 16 rejects revalidate-during-render for RSC callers. The subsequent redirect() forces a fresh RSC render of the destination. /h sibling lists refresh on the next user navigation"
  - "Playwright globalSetup shells out to `pocketbase superuser upsert` CLI rather than the REST API — PB 0.37 requires superuser auth to create a superuser via REST once any exists; CLI writes directly to SQLite and is idempotent"
  - "TaskAssignment E2E uses 1-day frequency (not Weekly) so the task lands in ThisWeek band (renders TaskRow). Weekly tasks nextDue=+7d land in Horizon which is a month-grid, not per-task rows"

patterns-established:
  - "resolveAssignee as design fulcrum — pure function called from both Server Components and client-side places; single matrix under unit test"
  - "Threading effective through BandView → TaskBand → TaskRow via attachMeta map lookup (O(N) per band, bounded by home task count)"
  - "AvatarStack wraps in Link when href provided — whole cluster is tappable, no mixed-tap hacks"
  - "Data-attribute selectors (data-assignee-kind) for E2E asserting cascade state without parsing visible copy"

requirements-completed: [TASK-02, TASK-03, TASK-04, HOME-05, HOME-06, HOME-07]

# Metrics
duration: 25min
completed: 2026-04-21
---

# Phase 4 Plan 03: resolveAssignee + UI + E2E Summary

**Effective-assignee cascade (resolveAssignee + AssigneeDisplay variants) lights up on every TaskRow / TaskDetailSheet, HomeSwitcher now lists homes via home_members instead of homes.owner_id (with an Owner badge), dashboard header shows an avatar stack linking to the new owner-gated /members page, /settings ships a create-invite card + pending-invites revoke + delete-home danger zone, and three Playwright suites walk the full invite-roundtrip + assignment-cascade-on-member-remove + owner-gating scenarios end-to-end against a live PB with the admin-client auth pipeline working via a CLI-bootstrapped superuser.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-21T03:40:47Z
- **Completed:** 2026-04-21T04:06:32Z
- **Tasks:** 3
- **Files created:** 16
- **Files modified:** 14

## Accomplishments

- **Pure cascading resolver** (`lib/assignment.ts`) — `resolveAssignee(task, area, members)` returning a `{ kind: 'task'|'area'|'anyone' }` discriminated union, covering the full 6-case D-18 matrix (both null, area only, task only, task+area → task wins, removed-task-assignee fall-through, both removed → anyone). 6/6 unit tests green.
- **Avatar primitives** — `AvatarCircle` with `solid|wireframe|dashed` variants via pure CSS (no radix avatar dep), `initialsOf()` helper with edge-case coverage (empty, single-word, multi-word), and `AvatarStack` with overflow pill + optional `<Link>` wrap.
- **AssigneeDisplay** — three-variant renderer emitting `data-assignee-kind` so E2E can assert cascade state without copy-matching. Solid for task override, wireframe for area default, dashed placeholder for Anyone.
- **TaskForm assignee picker** — new `members: Array<{id, name}>` prop + native `<select>` with "Use area default (or Anyone)" as the empty-value option + member entries. Default inherits from `task.assigned_to_id` on edit.
- **Pattern 11 HomeSwitcher swap** — `app/(app)/layout.tsx` swaps the Phase 2 `homes?filter=owner_id=X` query for `home_members?filter=user_id=X&expand=home_id`. `HomeSwitcher` accepts `role` and renders an "Owner" badge inline.
- **AccountMenu → LeaveHomeMenuItem** — `usePathname()` extracts the current homeId; when the auth user is not in `ownedHomeIds`, the menu includes a "Leave home" item that opens a confirm Dialog and calls `leaveHome(homeId)`.
- **Dashboard header + effective-assignee threading** — `/h/[homeId]/page.tsx` fetches `home_members` (with `expand: user_id`) + `areas` (with `default_assignee_id`), runs `resolveAssignee` per task server-side, and threads `effective` into `TaskWithName`. `BandView` carries it through `attachMeta` into every `TaskRow` + `TaskDetailSheet`.
- **Settings route** (`/h/[homeId]/settings`) — owner-gated Server Component; renders `HomeForm` mode="edit", `InviteLinkCard` (createInvite + pending invites list + revoke), link to `/members`, and `DeleteHomeButton` in a red-outlined Danger zone card.
- **Members route** (`/h/[homeId]/members`) — owner-gated; lists every home_member with AvatarCircle + name + email + role badge + Remove button (except self + owner rows). Remove confirm uses a shadcn Dialog and calls `removeMember` with `router.refresh` on success.
- **Leave route** (`/h/[homeId]/leave`) — linkable SSR confirm page with a server-action form (zero-JS fallback); owners are redirected to `/settings` and non-members to `/h`.
- **users view-rule relaxation** (`1714953603_users_view_rule_shared_home.js`) — allows co-home members to read each other's user records via a double-hop back-relation: `home_members_via_user_id.home_id.home_members_via_home_id.user_id ?= @request.auth.id`. Unblocks the members-list expand + AvatarStack names + assignee-display labels.
- **Playwright E2E triad** — `collaboration.spec.ts` Suite A (invite roundtrip with two isolated browser contexts) + Suite C (non-owner redirected from /settings + /members) + `task-assignment.spec.ts` Suite B (owner assigns task to invitee → `data-assignee-kind="task"` → owner removes invitee → `data-assignee-kind="anyone"`). `global-setup.ts` shells to `pocketbase superuser upsert` so `acceptInvite`'s admin client has creds; `playwright.config.ts` injects `PB_ADMIN_EMAIL`/`PASSWORD` into the Next.js webServer env.
- **Full suite green:** `npm test` 174/174 + `npm run test:e2e` 14/14 + `npm run build` + `npx tsc --noEmit` + `npm run lint` (1 pre-existing 02-05 warning on RHF `watch()`).

## Task Commits

1. **Task 1 RED: resolveAssignee 6-case matrix** — `5d50ad8` (test)
2. **Task 1 GREEN: resolveAssignee + avatar primitives + AssigneeDisplay + TaskForm picker** — `39daf00` (feat)
3. **Task 2: home_members swap + header avatar stack + effective threading** — `ed1b859` (feat)
4. **Task 3a: settings + members + leave routes + InviteLinkCard + MembersList + DeleteHomeButton** — `d70618d` (feat)
5. **Task 3b: playwright e2e + globalSetup + acceptInvite revalidate fix + users viewRule migration** — `9de64aa` (test)

**Plan metadata commit:** pending (this summary + STATE + ROADMAP + REQUIREMENTS).

## Decisions Made

- **Pure fn over hook for resolveAssignee** — the plan called for pure input-output so it can be unit-tested alone and run in both Server Components and Client Components without state-layer contention. Shipped as a single pure function with a Map-backed member lookup; the UI callers narrow on `.kind` via TypeScript's discriminated-union inference.
- **No @radix-ui/react-avatar** — bundle already carries radix-ui for dialog/dropdown/sheet but not the avatar subcomponent. The D-10 variants (solid / wireframe / dashed) are trivially achievable via Tailwind class composition on a `<span>`. The extra dep would add ~3kb without adding behavior (just the Image-with-fallback pattern which we don't need for initials).
- **Native <select> for the assignee picker** — matches the existing Area picker in the same form, keeps the DOM/a11y story simple, and Playwright's `selectOption({ label })` has first-class support. shadcn Select would have added ~1kb + a Controller wiring.
- **users.viewRule relaxation as a NEW migration (1714953603)** rather than editing 1714780800 — migrations are immutable after application per Phase 2 established practice. The relaxed rule is a genuine security posture change so it's worth a dated migration row. DOWN restores self-only for a clean revert path.
- **Double-hop back-relation (`home_members_via_user_id.home_id.home_members_via_home_id.user_id`) over @collection cross-join** — PB 0.37 executes back-relations as single-JOIN subqueries; the `@collection` alternative would emit an EXISTS wrapper with OR-scan over home_members twice. Both are correct; the back-relation form runs cheaper on the SQLite planner.
- **acceptInvite drops revalidatePath** (Rule 1 fix) — Next 16 rejects revalidate-during-render for RSC callers with the error "used revalidatePath during render which is unsupported". The action is invoked from `/invite/[token]/page.tsx` which is a Server Component, not a Server Action. Since the page calls `redirect(\`/h/\${homeId}\`)` on success, the destination re-renders fresh RSC anyway. Non-destination cache invalidation (the /h sibling list) just waits for the user's next navigation — acceptable UX given how rare invite acceptance is.
- **Playwright globalSetup shells to the PB CLI** rather than HTTP-POSTing a superuser record. PB 0.37 returns 403 "Only superusers can perform this action" for unauthed `POST /api/collections/_superusers/records` once any superuser exists; on first-boot the endpoint also refuses because only the Admin UI bootstrap path is blessed for this. The CLI `pocketbase superuser upsert <email> <pw> --dir <path>` is idempotent, writes directly to SQLite with WAL-mode locking safety (per 02-01 pattern), and runs in ~30ms.
- **Removed Weekly task in Suite B E2E** — a brand-new Weekly task has nextDue=today+7d which lands in the Horizon band (month grid, not per-task rows). Suite B needs a row with `data-task-name`/`data-assignee-kind` attributes. Dropping to `[name=frequency_days]=1` puts the task in ThisWeek (nextDue=today+1d). Documented inline in the spec.
- **LeaveHomeMenuItem renders as a raw `<button>`, not a DropdownMenuItem** — Radix Menu's onPointerDown collapses the menu when any menu item is clicked, which dismisses the sibling Dialog before it can open. Wrapping the same styles onto a plain button preserves the menu-stay-open UX.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] acceptInvite's revalidatePath during RSC render**
- **Found during:** Task 3 E2E Suite A run.
- **Issue:** Next 16 surfaced a runtime error "Route /invite/[token] used revalidatePath /h during render which is unsupported." The `acceptInvite` action was called directly from the `/invite/[token]/page.tsx` Server Component during render, and its `revalidatePath('/h', 'layout')` call is not allowed in that context.
- **Fix:** Removed the revalidatePath from acceptInvite; the subsequent `redirect(\`/h/\${homeId}\`)` forces a fresh RSC render of the destination which is what actually matters. Documented inline as a 04-03 deviation comment.
- **Files modified:** `lib/actions/invites.ts`.
- **Verification:** Suite A now passes; the invitee lands on /h/[homeId] with the shared home visible and both users present in /members.
- **Committed in:** `9de64aa` (Task 3b commit).

**2. [Rule 2 - Auto-add missing critical functionality] users.viewRule blocks cross-member expand**
- **Found during:** Task 3 E2E Suite A second assertion (owner sees Bob in /members).
- **Issue:** The `/members` page uses `pb.collection('home_members').getFullList({ expand: 'user_id', ... })`. PB's default `users.viewRule` is `id = @request.auth.id` (self-only). The expand returns empty user records for co-members, so the members list shows "Member" + empty email for every row except the auth user. This breaks the entire Phase 4 multi-user visibility story (Members list, AvatarStack, AssigneeDisplay labels).
- **Fix:** Added migration `1714953603_users_view_rule_shared_home.js` that sets `users.viewRule` + `users.listRule` to `id = @request.auth.id || home_members_via_user_id.home_id.home_members_via_home_id.user_id ?= @request.auth.id`. Co-members can now read each other's name/email; non-members still cannot read any foreign user record.
- **Threat-model note:** T-04-03-08 (new, noted inline): household members already have social-level visibility of each other; the relaxation matches SPEC user expectation.
- **Files created:** `pocketbase/pb_migrations/1714953603_users_view_rule_shared_home.js`.
- **Verification:** Suite A's `getByText('Bob Invitee')` assertion passes; Suite B's Bob-user-id extraction from the members row works; AssigneeDisplay shows initials derived from real names.
- **Committed in:** `9de64aa`.

**3. [Rule 3 - Blocking] Playwright globalSetup for PB superuser provisioning**
- **Found during:** Task 3 E2E first Suite A run.
- **Issue:** The `acceptInvite` server action calls `createAdminClient()` which reads `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` from env and auths as a PB superuser. Neither the env vars nor the superuser were provisioned for E2E. Without them, `createAdminClient` throws and acceptInvite returns `{ ok: false, reason: 'error' }`.
- **Fix:** Created `tests/e2e/global-setup.ts` that (a) waits for PB to be healthy, (b) probes auth with the expected creds, (c) if absent, shells to `./.pb/pocketbase superuser upsert e2e-admin@test.local e2e-admin-password-12345 --dir ./.pb/pb_data`. Updated `playwright.config.ts` to reference the setup + inject the same creds into the Next.js webServer env.
- **Files created:** `tests/e2e/global-setup.ts`; modified `playwright.config.ts`.
- **Verification:** Suite A + B pass; the `Successfully saved superuser` log line is visible in the test output.
- **Committed in:** `9de64aa`.

**4. [Rule 1 - Bug] HomeSwitcher menuitem accessible-name regression broke homes-areas.spec**
- **Found during:** Full E2E suite run after Task 2 landed.
- **Issue:** The existing test `tests/e2e/homes-areas.spec.ts:126` used `getByRole('menuitem', { name: /^House A$/ })`. The 04-03 Owner-badge addition inside each menuitem changed the accessible name to "House A Owner", so the exact-equality regex no longer matched.
- **Fix:** Updated the regex to `/^House A(?:\s+Owner)?$/` — preserves the prefix-exact match while tolerating the new suffix. Inline comment documents why.
- **Files modified:** `tests/e2e/homes-areas.spec.ts`.
- **Verification:** homes-areas.spec 2/2 green alongside the new 04-03 specs.
- **Committed in:** `9de64aa`.

### Plan-spec trivial variances (noted, no correction needed)

**5. [Spec variance] Suite B task frequency**
- **Context:** The plan example spec said "Weekly vacuum" as the task name. A Weekly task nextDue=today+7d lands in the Horizon band (month grid), not ThisWeek. TaskRow with `data-assignee-kind` is only rendered in Overdue/ThisWeek bands.
- **Rationale:** Dropped to `frequency_days=1` so nextDue=today+1d → ThisWeek → TaskRow visible. Name retained as "Weekly vacuum" for intent clarity; the daily-frequency is a test fixture detail, not a product semantic.

**6. [Spec variance] Owner tracking in Suite A via ownerEmail at module-scope**
- **Context:** Suite C's "non-owner accessing /settings redirects" needs the invitee from Suite A. Plan hinted `test.describe.serial` + top-level closure variables for this. Shipped verbatim.

---

**Total deviations:** 4 auto-fixed (Rule 1 × 2, Rule 2 × 1, Rule 3 × 1) + 2 spec variances noted.
**Impact on plan:** All auto-fixes were correctness gates (Next 16 RSC-revalidate rule, users.viewRule blocking multi-user UI, missing admin creds in test env, test-fixture regression from my own menu-badge change). No scope creep.

## Issues Encountered

None beyond the deviations above. The resolveAssignee pure function + unit matrix landed in one shot. The HomeSwitcher swap was trivial once Pattern 11 was pasted verbatim. The E2E failure cascade (revalidate → users rule → admin creds) was painful but each fix was surgical.

## User Setup Required

**Phase 4.1 deploy still REQUIRES** (carried over from 04-02):

- `PB_ADMIN_EMAIL` — superuser email created via `./pocketbase superuser upsert <email> <password>`.
- `PB_ADMIN_PASSWORD` — that superuser's password.
- `SITE_URL` — no trailing slash.

**Additionally for 04-03 to work correctly on existing deployments:**

- Migration `1714953603_users_view_rule_shared_home.js` must apply. On container boot the auto-migration is enabled (PB `--automigrate` default true) so this is transparent for fresh deploys. For any existing production PB instance with prior 04-01/04-02 data, verify after restart:
  ```bash
  curl -s http://127.0.0.1:8090/api/collections/users -H "Authorization: $SUPERUSER_TOKEN" | jq '.viewRule'
  ```
  Expected: a string containing `home_members_via_user_id`.

## Next Phase Readiness

**Phase 5 (Views & Onboarding) unblocked:**

- `resolveAssignee` + `EffectiveAssignee` types are importable for the PERS-01 Person view: filter by current user, use resolveAssignee + check `effective.kind === 'task' && effective.user.id === authId` for "my tasks" semantics. Area-default fallback is already covered.
- `AvatarStack` + `AvatarCircle` can be reused for Person view row avatars, onboarding profile UI, and any future multi-user indicator (notifications from Phase 6).
- `components/forms/task-form.tsx` accepts `members` prop as optional; all existing call sites updated. Phase 5's Quick-add form from onboarding can simply omit the prop.
- PB queries: `home_members` expanded with `user_id` now works across the board thanks to the users.viewRule relaxation.
- `assertOwnership` + `assertMembership` preflights are already the baseline. Phase 5 routes just import them and go.

**Phase 4 success criteria (from ROADMAP):**
1. ✅ Invite link + second user joins (Suite A)
2. ✅ Owner removes member (Suite B + /members Remove button)
3. ✅ Effective assignee displayed with inherited-vs-overridden indicator (AssigneeDisplay data-assignee-kind + D-10 variants)
4. ✅ Task assignee overrides area default; unassigning falls back (resolveAssignee cases 3-5 + Suite B cascade)

**REQ-IDs completed:** TASK-02, TASK-03, TASK-04, HOME-05, HOME-06, HOME-07 (all six Phase 4 requirements).

**Known stubs:** None. Every AssigneeDisplay / AvatarStack / members row / invite card renders from live PB data — no placeholder props or mock arrays.

**Regressions to watch:**
- The `users.viewRule` double-hop back-relation is unusual — if PB 0.38+ changes back-relation semantics, the rule should be revisited. Integration test coverage in 04-01's rules-member-isolation.test.ts would surface any break early.
- AccountMenu's `parseHomeIdFromPath` regex assumes 15-char PB ids. If PB id format changes, update both here and all E2E URL regexes in tests/e2e/**/*.spec.ts.
- `LeaveHomeMenuItem` uses a raw `<button>` inside DropdownMenuContent instead of DropdownMenuItem. If Radix later starts auto-closing DropdownMenu on any pointerdown inside its content, this will need a different trigger pattern (maybe a `<DropdownMenuItem asChild>` wrapping a `<DialogTrigger>` from a parent Dialog).

## Self-Check: PASSED

All 16 created + 14 modified files verified on disk via `git log` + ls:
- 4 lib/ and components/ primitives FOUND (assignment.ts, avatar-circle, avatar-stack, assignee-display)
- 4 components/ UI modules FOUND (invite-link-card, members-list, leave-home-menu-item, delete-home-button)
- 3 app routes FOUND (settings/page.tsx, members/page.tsx, leave/page.tsx)
- 1 PB migration FOUND (1714953603_users_view_rule_shared_home.js)
- 1 unit test file FOUND (tests/unit/assignment.test.ts)
- 3 E2E files FOUND (collaboration.spec.ts, task-assignment.spec.ts, global-setup.ts)
- All 11 modified files FOUND (layout.tsx, dashboard page, tasks/new + taskId, home-switcher, account-menu, band-view, task-band, task-row, task-detail-sheet, task-form, invites.ts, playwright.config.ts, homes-areas.spec.ts)

All 5 task commits verified in git log:
- `5d50ad8` (Task 1 RED test) — FOUND
- `39daf00` (Task 1 GREEN feat) — FOUND
- `ed1b859` (Task 2 feat) — FOUND
- `d70618d` (Task 3a feat) — FOUND
- `9de64aa` (Task 3b test + deviations) — FOUND

Full gate results:
- `npm test` → 174/174 pass (26 test files including new assignment.test.ts)
- `npx playwright test` → 14/14 pass (all existing suites + 3 new 04-03 tests)
- `npm run build` → clean, all expected routes present
- `npx tsc --noEmit` → no errors
- `npm run lint` → 1 pre-existing warning on RHF `watch()` in task-form.tsx (02-05 carryover)

Grep gates (from plan):
- `grep -c "home_members" app/(app)/layout.tsx` → 2 (swap + comment)
- `grep -c "resolveAssignee" app/(app)/h/[homeId]/page.tsx` → 2 (import + call)
- `grep -c "assertOwnership" app/(app)/h/[homeId]/settings/page.tsx app/(app)/h/[homeId]/members/page.tsx` → 4 (2 imports + 2 calls)
- `grep -c "data-assignee-kind" components/task-row.tsx` → 1 (attribute)
- `grep -c "createInvite\|acceptInvite\|removeMember\|leaveHome" components/invite-link-card.tsx components/members-list.tsx components/leave-home-menu-item.tsx` → 4+ (imports + calls)

---

*Phase: 04-collaboration*
*Completed: 2026-04-21*
