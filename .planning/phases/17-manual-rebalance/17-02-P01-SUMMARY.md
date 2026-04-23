---
phase: 17-manual-rebalance
plan: 02
subsystem: manual-rebalance
tags:
  - rebal
  - ui
  - settings
  - dialog
  - integration-tests
  - port-18105
  - wave-2
  - phase-close

# Dependency graph
requires:
  - phase: 17-manual-rebalance
    plan: 01
    provides: "rebalancePreviewAction + rebalanceApplyAction + RebalancePreview type + 4-bucket classifier — the server surface Wave 2 imports directly"
  - phase: 04-ownership-membership
    plan: 03
    provides: "/h/[homeId]/settings owner-gated Server Component + assertOwnership pattern (D-07 extends)"
  - phase: 15-one-off-reschedule-ui
    plan: 01
    provides: "shadcn Dialog + useTransition + Sonner toast + router.refresh client-action binding pattern (delete-home-button.tsx + 15-03 integration boot scaffold)"
  - phase: 12-load-smoothing-engine
    plan: 04
    provides: "placeNextDue deterministic placement — REBAL-07 threading proof in Scenario 2"
  - phase: 16-horizon-density-visualization
    plan: 01
    provides: "port 18104 allocation + integration scaffold template (tests/unit/horizon-density-integration.test.ts — byte-for-byte template for 18105)"

provides:
  - "app/(app)/h/[homeId]/settings/scheduling/page.tsx — owner-gated Server Component landing for household-wide scheduling controls"
  - "components/rebalance-card.tsx — Server-rendered card with preservation-copy description"
  - "components/rebalance-dialog.tsx — Client Component Dialog: preview-on-open, apply-on-click, Sonner toast, router.refresh"
  - "Settings → Scheduling nav link from existing /h/[homeId]/settings page"
  - "Port 18105 CLAIMED for rebalance-integration — next free 18106"
  - "All 7 REBAL REQs behaviorally locked (REBAL-01..07 via Wave 1 unit tests + Wave 2 live-PB integration evidence)"

affects:
  - "Phase 17 close — this is the final plan; /gsd-verify-work can run against the full 7-REQ evidence table below"
  - "STATE.md: milestone v1.1 advances another phase complete"
  - "ROADMAP.md: Phase 17 Manual Rebalance fully delivered"
  - "Phase 18+: rebalance UI live; SPEC.md v0.4 changelog can document REBAL semantics + D-06 marker-clear-on-apply contract"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-Component-shell + Client-Component-island pattern for Settings sub-pages. Scheduling page + RebalanceCard are Server Components (static descriptive copy + owner gate); RebalanceDialog is the only Client Component island. Matches the established pattern from components/delete-home-button.tsx + app/(app)/h/[homeId]/settings/page.tsx where mutations live in isolated 'use client' files."
    - "Preview-on-open via useTransition: onOpenChange fires rebalancePreviewAction inside startTransition, setting local preview state. Reset-on-close clears preview so the next open re-fetches fresh counts — important because household state may have changed between opens (tasks added, completions recorded, markers flipped)."
    - "Empty-state short-circuit: preview.update_count === 0 renders a friendly 'Nothing to rebalance' message + only a Close button. Cancel button's label flips between 'Cancel' and 'Close' depending on state (small UX win — no user ever sees a Cancel on a DO-NOTHING dialog)."
    - "Pluralization: 'Rebalanced 1 task' vs 'Rebalanced 5 tasks'. Single ternary, no i18n framework. Locked with dedicated Test 9."
    - "Radix Dialog jsdom polyfills: window.matchMedia + window.ResizeObserver + HTMLElement.prototype.hasPointerCapture + HTMLElement.prototype.scrollIntoView. Required because shadcn Dialog wraps Radix primitives that call all four in their default paths. Cataloged here for future 'use client' Dialog tests."
    - "Integration boot scaffold substitution: Phase 17 reused Phase 16's boot scaffold byte-for-byte with only 3 diffs (DATA_DIR name, PORT number, admin+user email addresses). Zero SQLite WAL races, zero boot-order bugs — the template is now 6 phases deep and rock-solid (18100 → 18105)."
    - "D-12 idempotency verified via 3-run proof: Run 1 bootstraps + clears marker; Run 2 establishes the post-marker stable rebalanceable set; Run 3 reproduces Run 2 bit-identically. This avoids the false-positive the 2-run formulation would catch (marker-clear changes the bucket membership between Run 1 → Run 2, shifting placements legitimately)."

key-files:
  created:
    - "app/(app)/h/[homeId]/settings/scheduling/page.tsx (55 lines) — owner-gated Scheduling Settings Server Component"
    - "components/rebalance-card.tsx (40 lines) — descriptive-copy card with RebalanceDialog island"
    - "components/rebalance-dialog.tsx (172 lines) — Client Component Dialog with preview + apply flow"
    - "tests/unit/rebalance-dialog.test.tsx (442 lines) — 9 RTL tests covering open/preview/loading/counts/empty/error/apply/apply-error/singular-plural"
    - "tests/unit/rebalance-integration.test.ts (531 lines) — 4 vitest tests (port-claim lock + 3 scenarios) on disposable PB port 18105"
  modified:
    - "app/(app)/h/[homeId]/settings/page.tsx — add Scheduling Card linking to /settings/scheduling (between Members + Danger zone)"

key-decisions:
  - "Scenario 3 reformulated from 2-run to 3-run idempotency. The PLAN text contemplated a 2-run comparison on the original 3 rebalanceable tasks, but the D-06 marker-clear semantics mean Run 2 sees a 4-task rebalanceable set (ex-marker joined), which legitimately shifts the 3-task cohort's placements via load-map threading. A 2-run expect(run2Rebal).toEqual(run1Rebal) assertion would be incorrect — idempotency is about determinism on a STABLE input, not about marker-clear being a no-op. Run 2 establishes the new steady state; Run 3 reproduces Run 2 bit-identically (zero state change between them). This matches D-12's literal claim: 'same baseIso + freq + same load map → same placedDate.'"
  - "Cancel button label flips 'Cancel' ↔ 'Close' based on isEmpty. Small UX lift — a button labelled 'Cancel' on a dialog whose only action is 'close this' is a dead-code confusion. Preserves the primary action (Apply rebalance) as the only button with Cancel semantics when there IS something to cancel."
  - "Singular-task pluralization gets its own test (Test 9, 'Rebalanced 1 task'). Locks the UX polish so a future refactor accidentally reverting to 'Rebalanced 1 tasks' trips CI."
  - "Radix jsdom polyfills cataloged in the test file header comment with rationale. When a future 'use client' dialog test fails with 'hasPointerCapture is not a function', future-us can grep this file as the canonical working polyfill stack."
  - "Reset-on-close pattern — setting preview + error to null when Dialog closes — means every open always starts with a fresh fetch. Correct for rebalance because household state changes in between opens invalidate the old counts. Slight extra PB roundtrip acceptable at v1.1 scale (single action, ~100-task ceiling)."
  - "Seed uses client-supplied `created` timestamp for the 3 rebalanceable tasks (back-dated 7d) so natural ideals cluster around now+7d. This is the ONLY way to force a threading-observable cohort without mocking time — PB allows client-side `created` on insert."

patterns-established:
  - "Pattern: Settings sub-page scaffolding. /h/[homeId]/settings/{subpage}/page.tsx as owner-gated Server Component + a single Client Component island per mutation surface. Future v1.2+ scheduling controls (auto-rebalance triggers, tolerance defaults) slot into the same /settings/scheduling page as siblings of RebalanceCard."
  - "Pattern: preview-then-apply Dialog. onOpenChange → startTransition → preview action → store local state → Apply button fires second action in same useTransition → toast + close + router.refresh on ok / toast-error + stay-open on error. Works for any read-then-write pair with bounded preview cost."
  - "Pattern: 3-run idempotency proof for algorithms that mutate their input set on first run. Run 1 bootstraps, Run 2 establishes the new steady state, Run 3 locks idempotency. Avoids the 2-run false positive when first-run has irreversible side effects (marker clear, state machine transitions, etc.)."
  - "Pattern: empty-state button label swap. When an action button is contextually absent (update_count === 0 → no Apply), the Cancel/Close label adapts so the remaining button's semantics match its actual role. Cheap polish that removes a real UX dead-code confusion."

requirements-completed:
  - REBAL-05
  - REBAL-06

# Metrics
duration: ~14min
completed: 2026-04-23
tasks: 2
files_created: 5
files_modified: 1
tests_added: 13
tests_total: 598 (585 baseline + 9 dialog + 4 integration)
---

# Phase 17 Plan 17-02: Manual Rebalance Wave 2 — UI + integration Summary

Wave 2 ships the USER surface + end-to-end integration lock for Phase 17 Manual Rebalance: Settings → Scheduling page with a preservation-copy RebalanceCard and a preview-then-apply Dialog, plus a 3-scenario disposable-PocketBase integration suite on port 18105 that behaviorally locks all 7 REBAL REQs.

With this plan, Phase 17 closes: users can click a "Rebalance schedule" button, see a counts-only preview, confirm Apply, and receive a sonner-toast receipt + refreshed dashboard. Wave 1 proved the server algorithm with mocks; Wave 2 proves it against live PB under realistic household state AND gives owners the clean Settings button promised by REBAL-05.

## What Was Built

### Task 1 — Scheduling Settings page + Rebalance card + preview Dialog + 9 RTL tests (REBAL-05, REBAL-06)

**Server-rendered route + card shell + Client Component island:**

`app/(app)/h/[homeId]/settings/scheduling/page.tsx` (55 lines) — owner-gated Server Component. `assertOwnership(pb, homeId)` throws on non-owner → redirect to `/h/[homeId]` matching Phase 4 Settings convention. `notFound()` for genuinely bogus home ids. Renders a back-to-settings link, the home name, and the RebalanceCard.

`components/rebalance-card.tsx` (40 lines) — Server Component with preservation-copy description: "Evenly redistribute your cycle-mode tasks across the next few months. We'll keep: anchored tasks (like fixed-date services), tasks with an active snooze, and tasks you've manually shifted with 'From now on.' Everything else gets re-placed using the current household load." Renders the RebalanceDialog island inside a CardContent.

`components/rebalance-dialog.tsx` (172 lines) — 'use client' Component that handles the preview + apply flow:

1. `onOpenChange(true)` → `startTransition(async () => { r = await rebalancePreviewAction(homeId); ... })`. Preview success sets local state, preview error sets local error.
2. While pending + no preview yet: renders a "Loading preview…" placeholder.
3. Preview success with `update_count > 0`: D-09 counts template — "Will update: N. Will preserve: M (A anchored, B active snoozes, C from-now-on)." Apply button visible.
4. Preview success with `update_count === 0`: "Nothing to rebalance — every task is already preserved or placed." Apply button absent. Cancel button label flips to "Close".
5. Apply button: `startTransition(async () => { r = await rebalanceApplyAction(homeId); ... })`. On `ok`: `toast.success('Rebalanced N task(s)')` + `setOpen(false)` + `router.refresh()`. On error: `toast.error(formError)` + Dialog stays open.
6. Reset-on-close — closing the Dialog clears preview + error so the next open re-fetches fresh counts.

**Settings page link** (`app/(app)/h/[homeId]/settings/page.tsx`): new "Scheduling" Card between Members + Danger zone with `<Link href="/h/{homeId}/settings/scheduling">Open Scheduling settings</Link>`.

**9 RTL tests** in `tests/unit/rebalance-dialog.test.tsx`:

| # | Test | Asserts |
|---|------|---------|
| 1 | Dialog closed by default | Trigger visible, content portal absent, preview action NOT called |
| 2 | Clicking trigger opens + fetches preview | `rebalancePreviewAction('home-17')` called exactly once |
| 3 | Loading state during pending preview | `[data-testid=rebalance-loading]` visible while preview pending |
| 4 | Preview renders 4 numeric counts per D-09 | `5`, `6`, `3 anchored`, `2 active snoozes`, `1 from-now-on` all present; Apply button visible |
| 5 | `update_count === 0` empty state | "Nothing to rebalance" copy, no Apply button, Cancel button labelled "Close" |
| 6 | Preview error surfaces formError | `[data-testid=rebalance-error]` with message; no Apply button |
| 7 | Apply success → toast + close + refresh | `rebalanceApplyAction('home-17')` called; `toast.success('Rebalanced 5 tasks')`; `router.refresh` called; Dialog closes |
| 8 | Apply error → toast.error + stay open | `toast.error('Could not apply rebalance')`; Dialog stays open; `router.refresh` NOT called |
| 9 | Singular pluralization | `updated=1` → `toast.success('Rebalanced 1 task')` (no trailing 's') |

**Radix jsdom polyfills** installed in `beforeAll` — `window.matchMedia`, `window.ResizeObserver`, `HTMLElement.prototype.hasPointerCapture`, `HTMLElement.prototype.scrollIntoView`. Required because shadcn Dialog wraps Radix primitives that call all four.

### Task 2 — Port 18105 integration suite + 3 REBAL scenarios

`tests/unit/rebalance-integration.test.ts` (531 lines) — 4 vitest tests (port-claim lock + 3 REBAL scenarios) running against disposable PocketBase on port 18105.

Boot scaffold copied from `tests/unit/horizon-density-integration.test.ts` (port 18104) with three diffs:
- `DATA_DIR = './.pb/test-pb-data-rebalance'`
- `PORT = 18105`
- `admin-17@test.test` / `alice17@test.com`

**Shared seed builder** (`seedRebalanceFixture`) creates a realistic household mix:
- 2 anchored tasks (`schedule_mode='anchored'`, future anchor_date)
- 1 cycle task + ACTIVE unconsumed schedule_overrides row
- 1 cycle task + `reschedule_marker` set + `next_due_smoothed` populated
- 3 cycle rebalanceable tasks with back-dated `created` (now-7d) and freq=14 so natural ideals cluster around now+7d (for REBAL-07 threading observability)
- 1 archived task (D-02 noise)
- 1 OOFT task (`frequency_days=null`, D-02 exclusion)

`wipeHome()` helper deletes all tasks + schedule_overrides between scenarios so each test starts from a clean slate.

**Scenario 1 — REBAL-06 preview counts:**

Asserts all 5 fields of `RebalancePreview` exactly:
- `update_count === 3` (rebalanceable bucket)
- `preserve_anchored === 2`
- `preserve_override === 1`
- `preserve_from_now_on === 1`
- `preserve_total === 4`

**Scenario 2 — REBAL-01..04, REBAL-07, D-06 marker-clear:**

1. Capture pre-apply state for every task.
2. Call `rebalanceApplyAction(aliceHomeId)` → expect `result.updated === 3`.
3. REBAL-01: both anchored tasks' `next_due_smoothed` byte-identical pre/post.
4. REBAL-02: override-preserved task's `next_due_smoothed` byte-identical pre/post.
5. REBAL-03: from-now-on task's `next_due_smoothed` byte-identical pre/post (VALUE preserved).
6. D-06 revision: from-now-on task's `reschedule_marker` now falsy (null or '').
7. REBAL-04: all 3 rebalanceable tasks now have non-empty ISO `next_due_smoothed` values matching `/^\d{4}-\d{2}-\d{2}/`.
8. REBAL-07 threading proof: `Set(postRebalanceable.map(t => String(t.next_due_smoothed).slice(0, 10))).size >= 2`. Without threading, all 3 same-freq same-created tasks would collapse to the same date; with threading, they distribute to ≥2 distinct dates.
9. D-02 exclusions: archived stays archived + untouched; OOFT's `due_date` untouched and `next_due_smoothed` remains falsy.

**Scenario 3 — D-12 idempotency (3-run proof):**

The original 2-run formulation in the PLAN would fail because D-06 marker-clear means Run 2 sees a 4-task rebalanceable set (ex-marker joined), legitimately shifting the 3-task cohort's placements. The correct formulation is 3 runs:

1. **Run 1**: bootstraps + clears marker. `updated === 3`.
2. **Run 2**: establishes steady-state placements for the 4-task stable rebalanceable set. `updated === 4`.
3. **Run 3**: D-12 proof — identical rebalanceable set + zero external state change → identical `next_due_smoothed` ISO strings. `updated === 4`, and `run3Smoothed === run2Smoothed` (strict deep-equal).

Also asserts preserved buckets (anchored + override) stable across Run 2 → Run 3, and marker stays cleared.

**Port allocation comment** at line ~30 updates the register:

```
18100 — load-smoothing-integration (Phase 12)
18101 — tcsem-integration (Phase 13)
18102 — seasonal-ui-integration (Phase 14)
18103 — reschedule-integration (Phase 15)
18104 — horizon-density-integration (Phase 16)
18105 — rebalance-integration (Phase 17 — THIS FILE)
18106+ — reserved for Phase 18+
```

## Verification Results

```bash
# Dialog tests — 9/9
$ npm test -- tests/unit/rebalance-dialog.test.tsx --run
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  1.68s

# Integration tests — 4/4 (port claim + 3 scenarios)
$ npm test -- tests/unit/rebalance-integration.test.ts --run
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  5.26s

# Full regression — 598/598
$ npm test --run
 Test Files  71 passed (71)
      Tests  598 passed (598)
   Duration  103.81s

# Type-check clean
$ npx tsc --noEmit
 (exit 0, no output)
```

**Test count delta vs plan projection:**

| Source | Plan projection | Actual | Notes |
|--------|----------------:|-------:|-------|
| RTL Dialog tests | ≥8 | 9 | Added singular-pluralization test (Test 9) |
| Integration tests | 3 scenarios | 4 (3 + port-claim lock) | Extra test locks `expect(PORT).toBe(18105)` per the PLAN verification block |
| **Total delta** | **+11** | **+13** | 585 → 598 (baseline + 13) |

**Grep invariants:**

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "'use client'" components/rebalance-dialog.tsx` | `=1` | `1` |
| `grep -c "rebalancePreviewAction" components/rebalance-dialog.tsx` | `≥1` | `3` (import + 1 call + 1 doc) |
| `grep -c "rebalanceApplyAction" components/rebalance-dialog.tsx` | `≥1` | `3` (import + 1 call + 1 doc) |
| `grep -c "router.refresh" components/rebalance-dialog.tsx` | `=1` | `2` (1 call + 1 doc) |
| `grep -c "assertOwnership" app/(app)/h/[homeId]/settings/scheduling/page.tsx` | `=1` | `3` (1 import + 1 call + 1 doc) |
| `grep -c "const PORT = 18105" tests/unit/rebalance-integration.test.ts` | `=1` | `1` |
| `grep -c "/settings/scheduling" app/(app)/h/[homeId]/settings/page.tsx` | `≥1` | `2` (1 doc + 1 href) |

Doc-heavy JSDoc legitimately bumps naive grep counts above the plan's "code call" intent — the CODE invocations each match the specified count (Phase 15 Plan 15-01 established this convention).

## Phase 17 REQ-ID Evidence Table (all 7 green)

| REQ-ID | Evidence |
|--------|----------|
| REBAL-01 | 17-01 classifier Test 1 (anchored priority) + **17-02 Scenario 2** (anchored task `next_due_smoothed` byte-identical pre/post apply) |
| REBAL-02 | 17-01 classifier Test 2 (active_snooze priority) + **17-02 Scenario 2** (override-preserved task byte-identical) |
| REBAL-03 | 17-01 classifier Test 3 (from_now_on priority) + **17-02 Scenario 2** (marker task `next_due_smoothed` byte-identical + `reschedule_marker` cleared per D-06) |
| REBAL-04 | 17-01 action Test A4 (only rebalanceable ids updated) + **17-02 Scenario 2** (3 rebalanceable tasks get populated ISO `next_due_smoothed`; archived + OOFT untouched) |
| REBAL-05 | **17-02 Task 1** — Settings → Scheduling page at `/h/[homeId]/settings/scheduling` with owner gate + descriptive RebalanceCard + `<Button>Rebalance schedule</Button>` trigger |
| REBAL-06 | **17-02 Task 1 Test 4** (Dialog renders 4 numeric counts per D-09) + **17-02 Scenario 1** (live-PB preview counts match seeded bucket sizes exactly) |
| REBAL-07 | 17-01 action Test A1 (ascending natural-ideal sort) + Test A2 (REAL placeNextDue via `vi.importActual` — distinct dates from threading) + **17-02 Scenario 2** (`Set(placedDates).size >= 2` on live PB — 3 same-freq tasks distribute across ≥2 distinct dates) |

## Port Allocation Register Update

**Port 18105 CLAIMED** for `tests/unit/rebalance-integration.test.ts` (Phase 17 Plan 17-02).

| Port | Phase | Suite |
|-----:|------:|-------|
| 18100 | 12 | load-smoothing-integration |
| 18101 | 13 | tcsem-integration |
| 18102 | 14 | seasonal-ui-integration |
| 18103 | 15 | reschedule-integration |
| 18104 | 16 | horizon-density-integration |
| **18105** | **17** | **rebalance-integration (THIS FILE)** |
| 18106 | — | reserved for Phase 18+ |

## Deviations from Plan

**1. [Rule 1 — Bug] Scenario 3 reformulated from 2-run to 3-run idempotency proof**

- **Found during:** Task 2, first run of `npm test -- tests/unit/rebalance-integration.test.ts`
- **Issue:** The PLAN's Scenario 3 asserted `expect(run2Rebal).toEqual(run1Rebal)` — that the 3 originally-rebalanceable tasks' `next_due_smoothed` would be bit-identical between Run 1 and Run 2. This fails legitimately: D-06 marker-clear on Run 1 means Run 2 sees a 4-task rebalanceable set (ex-marker joined the bucket), shifting the 3-task cohort's placements via load-map threading. The PLAN text itself was inconsistent — it flipped mid-scenario from "Assert: no marker-clear op fires on the second run..." to a "Correction" acknowledging `updated === 4`, but the `toEqual(run1Rebal)` assertion remained.
- **Fix:** Restructured to a 3-run proof:
  - Run 1 bootstraps + clears marker (`updated === 3`)
  - Run 2 establishes the post-marker steady-state (`updated === 4`)
  - Run 3 is the D-12 lock — identical rebalanceable set + zero state change → byte-identical placements (`run3Smoothed === run2Smoothed`)
- **Why this is correct:** D-12 literally says "same baseIso + freq + same load map → same placedDate." The marker-clear transition is NOT a same-load-map condition — it's a one-time state change. 3-run captures the true idempotency invariant: determinism on a stable input.
- **Files modified:** `tests/unit/rebalance-integration.test.ts` (Scenario 3 body)
- **Commit:** `c10eb05`

No Rule 2 (missing critical functionality) or Rule 3 (blocking) fixes needed.

No CLAUDE.md file exists in the project root; no CLAUDE.md-driven adjustments.

## Commits

| Hash | Subject |
|------|---------|
| `df4a37d` | `feat(17-02): Settings → Scheduling page + Rebalance card + preview Dialog (REBAL-05/06)` |
| `c10eb05` | `test(17-02): port 18105 integration suite — 3 REBAL scenarios on live PB` |

## Phase 17 Wrap Notes for /gsd-verify-work

Phase 17 Manual Rebalance is now complete across 2 waves / 2 plans:

**Wave 1 (17-01)** — server: classifier + actions
- `lib/rebalance.ts` — `classifyTasksForRebalance` + `RebalanceBuckets` type
- `lib/actions/rebalance.ts` — `rebalancePreviewAction` + `rebalanceApplyAction`
- 25 unit tests

**Wave 2 (17-02)** — UI + integration
- `/h/[homeId]/settings/scheduling` route + RebalanceCard + RebalanceDialog + Settings link
- 9 RTL tests + 4 live-PB integration tests (port 18105)

**7/7 REBAL REQs behaviorally locked** — see table above. Every REQ has evidence in BOTH unit tests (algorithmic correctness) and live-PB integration (end-to-end under realistic state).

**What a user can now do:**

1. Owner navigates to Home → Settings → click "Open Scheduling settings"
2. Arrives at `/h/[homeId]/settings/scheduling` with the Rebalance card + preservation-copy description
3. Clicks "Rebalance schedule" button → Dialog opens, fires rebalancePreviewAction on open
4. Reads counts: "Will update: N. Will preserve: M (A anchored, B active snoozes, C from-now-on)."
5. Clicks "Apply rebalance" → Sonner toast "Rebalanced N tasks" + Dialog closes + dashboard refreshes with new dates

Or if nothing to rebalance: "Nothing to rebalance — every task is already preserved or placed." + single Close button.

## Handoff for Phase 18+

**Immediate:**
- Rebalance is LIVE in the user-facing app at `/h/[homeId]/settings/scheduling`.
- SPEC.md v0.4 changelog should document:
  - The 4-bucket classifier (anchored > active_snooze > from_now_on > rebalanceable, D-01 priority)
  - The D-06 revision: `reschedule_marker` is CLEARED on apply for from-now-on bucket (marker has served its purpose; next rebalance treats the task normally)
  - REBAL-07 threading: `placeNextDue` consumes a household load map, contributions mutate in-place between placements, same-freq cohorts distribute across adjacent dates

**v1.2+ deferred (explicit v2 REQ-IDs already logged in ROADMAP.md):**
- REBAL-V2-01 per-task preview modal (show each task's old → new date)
- REBAL-V2-02 undo toast
- REBAL-V2-03 auto-triggered rebalance
- REBAL-V2-04 area-scoped rebalance

**Port allocation:** 18106+ is reserved for Phase 18 integration suites. Continue the 18100-block register pattern.

**Integration boot scaffold:** `tests/unit/rebalance-integration.test.ts` is the newest 1:1 template (18105, 2026-04-23). Phase 18 should copy it with the same 3-substitution diff (DATA_DIR, PORT, admin+user emails).

## Threat Flags

None found — no new security-relevant surface outside the plan's `<threat_model>`. The Dialog surfaces the Wave 1 action result shapes only; no new PB endpoints, no new auth paths, no new file access. T-17-02-01..05 enumerated the exact surface and all 5 mitigations are in place:

- T-17-02-01 (Spoofing): `assertOwnership` in the Scheduling Server Component → non-owners redirect.
- T-17-02-02 (Double-click apply): `useTransition` `isPending` latch disables Apply during transition.
- T-17-02-03 (Info disclosure): error text comes from the Wave 1 sanitized `formError`.
- T-17-02-04 (DoS): accepted at v1.1 scale (human click cadence + ~400ms batch roundtrip).
- T-17-02-05 (XSS): all preview numbers are JSON-parsed numbers; React auto-escapes text children; no `dangerouslySetInnerHTML`.

## Self-Check: PASSED

**Files verified exist:**
- `app/(app)/h/[homeId]/settings/scheduling/page.tsx` — FOUND
- `components/rebalance-card.tsx` — FOUND
- `components/rebalance-dialog.tsx` — FOUND
- `app/(app)/h/[homeId]/settings/page.tsx` (modified) — FOUND
- `tests/unit/rebalance-dialog.test.tsx` — FOUND
- `tests/unit/rebalance-integration.test.ts` — FOUND
- `.planning/phases/17-manual-rebalance/17-02-P01-SUMMARY.md` (this file) — FOUND

**Commits verified in git log:**
- `df4a37d feat(17-02): Settings → Scheduling page + Rebalance card + preview Dialog (REBAL-05/06)` — FOUND
- `c10eb05 test(17-02): port 18105 integration suite — 3 REBAL scenarios on live PB` — FOUND

**Acceptance criteria:**
- [x] `/h/[homeId]/settings/scheduling` owner-gated (non-owner redirects to /h/[homeId])
- [x] Settings page links to Scheduling sub-page via new Card
- [x] RebalanceCard has preservation-copy description
- [x] Dialog opens on trigger click; preview fetched via rebalancePreviewAction
- [x] D-09 counts template renders all 4 numeric values in the rebalance-counts element
- [x] `update_count === 0` → "Nothing to rebalance" copy + no Apply button (cancel label flips to "Close")
- [x] Apply success → `toast.success('Rebalanced N task(s)')` + Dialog closes + router.refresh
- [x] Apply error → `toast.error(formError)` + Dialog stays open
- [x] 9 RTL tests green (plan required ≥8)
- [x] 3 integration scenarios + port-claim lock green on port 18105
- [x] All 7 REBAL REQs have behavioral evidence (table above)
- [x] Full regression 598/598 green
- [x] `npx tsc --noEmit` clean

## Test Count Trajectory

| Plan | Delta | Cumulative |
|------|------:|-----------:|
| Phase 17 Wave 1 final | — | 585 |
| **17-02 Task 1** (RebalanceDialog RTL) | **+9** | **594** |
| **17-02 Task 2** (port 18105 integration) | **+4** | **598** |

Plan 17-02 total: +13 tests (plan projected +11; +2 from extra Test 9 pluralization + Scenario "port claim lock" test).
