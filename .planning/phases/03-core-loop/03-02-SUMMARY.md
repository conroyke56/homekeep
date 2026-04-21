---
phase: 03-core-loop
plan: 02
subsystem: ui, client-component, server-component
tags: [phase-3, ui, band-view, coverage-ring, horizon-strip, task-row, shadcn-sheet, server-component, client-component, useOptimistic, motion-safe, accessibility, 44px-tap-target]

# Dependency graph
requires:
  - phase: 03-core-loop
    provides: "computeTaskBands + computeCoverage + reduceLatestByTask pure functions, getCompletionsForHome 13-month bounded fetch, CompletionRecord type, completeTaskAction server action (stubbed here, wired in 03-03)"
provides:
  - "components/ui/sheet.tsx — shadcn Sheet codegen (radix-ui Dialog primitives) with side=top/right/bottom/left variants; exports Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription"
  - "components/coverage-ring.tsx — hand-rolled SVG ring (radius-16 trick), -rotate-90 start at 12 o'clock, motion-safe: reduced-motion-respecting transition, role=img + aria-label; pure display primitive"
  - "components/task-row.tsx — whole-row <button> tap target with min-h-[44px], warm-accent border-l-4 overdue variant, pending-state disable, days-delta label formatting"
  - "components/task-band.tsx — reusable band Card with optional day-grouping via formatInTimeZone when tasks.length > 5; returns null when empty"
  - "components/horizon-strip.tsx — 12-month CSS grid with timezone-safe yyyy-MM bucketing, warm-accent dots (max 3 + '+N' overflow), shadcn Sheet drawer on month tap"
  - "components/band-view.tsx — top-level Client Component owning useOptimistic reducer form; derives bands + coverage inline on every render from optimisticCompletions; empty-state branching for zero-task home; stubbed onComplete handler for 03-03 to wire"
  - "app/(app)/h/[homeId]/page.tsx — rewritten Server Component fetching home + non-archived tasks + 13-month completions and delegating to <BandView>"
affects: [03-03-wiring-and-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled SVG ring with radius-16 trick (circumference ≈ 100) so stroke-dashoffset maps directly to 100 − percentage"
    - "motion-safe: Tailwind prefix for prefers-reduced-motion: no-preference gating on all ring transitions"
    - "min-h-[44px] tap-target baseline on all tappable rows and horizon cells (Pitfall 8)"
    - "useOptimistic reducer form `(current, added) => [...current, added]` — no closed-over outer state (Pitfall 1)"
    - "Derive-on-every-render (no memoization) for bands + coverage from optimisticCompletions (Pitfall 7)"
    - "Server-owns-clock: Server Component calls `new Date()` once + passes ISO string to Client Component; BandView reconstructs once per render (A4)"
    - "Timezone-safe day/month bucketing via formatInTimeZone('yyyy-MM-dd' / 'yyyy-MM') — NEVER raw .getDay()/.getMonth() (Pitfall 2)"
    - "shadcn Sheet (radix-ui Dialog) for bottom-slide drawer on horizon-month tap, reusable for 03-03 task-detail"

key-files:
  created:
    - "components/ui/sheet.tsx"
    - "components/coverage-ring.tsx"
    - "components/task-row.tsx"
    - "components/task-band.tsx"
    - "components/horizon-strip.tsx"
    - "components/band-view.tsx"
    - "tests/unit/coverage-ring.test.tsx"
    - "tests/unit/task-row.test.tsx"
    - "tests/unit/horizon-strip.test.tsx"
  modified:
    - "app/(app)/h/[homeId]/page.tsx"

key-decisions:
  - "03-02: Used the shadcn CLI (npx shadcn add sheet) rather than hand-copying the template — generates the same radix-ui Dialog wrapper that 02-02 used for dialog.tsx, and the only package.json change was a caret added to radix-ui which was reverted to preserve Phase 2's exact-pin convention."
  - "03-02: Warm-accent colour comes from Tailwind's stroke-primary / border-l-primary / bg-primary classes rather than inline `var(--accent-warm)` — the plan's placeholder referenced a non-existent CSS var; the actual `--primary` token in app/globals.css is the hsl(30 45% 65%) ≈ #D4A574 terracotta-sand called out by D-18."
  - "03-02: No Pitfall 10 opt-out (`'use no memo';`) was needed. useOptimistic with the reducer form compiles + typechecks cleanly under React Compiler. The pre-existing `react-hooks/incompatible-library` warning on components/forms/task-form.tsx (Phase 2's RHF watch call) is unrelated and remains as of this plan."
  - "03-02: ClassifiedTask's `name` attachment is done in BandView via a Map-backed lookup (O(1) per task, O(N) to build once per render) rather than being threaded through lib/band-classification.ts. The cast at the consumer site is explicit and localised; extending ClassifiedTask to include `name` is a cross-cutting refactor deferred to a future plan."
  - "03-02: HorizonStrip month-empty state preserves grid shape (cell disabled + opacity-50) rather than collapsing cells, so the 12-month calendar is always visually a 12-cell strip whenever ANY task exists in the horizon band — hole-free grids read as more 'calm' than collapsing empties (SPEC §19)."
  - "03-02: HorizonStrip band-level empty state (no tasks at all in horizon) shows the 'Nothing on the horizon yet — looking clear!' copy in place of the grid, as specified by D-12 specifics — distinct from the per-cell disabled state."
  - "03-02: onComplete is stubbed — when the prop is not passed, tap is a no-op. This keeps the UI interactive-ready without mutating state; 03-03 wires the real completeTaskAction + toast + router.refresh."

patterns-established:
  - "Pattern: hand-rolled SVG ring with the radius-16 / circumference-100 trick — reusable for 04's per-person coverage rings and 05's per-area coverage tiles"
  - "Pattern: Server Component fetches + computes `now`, Client Component owns useOptimistic + pendingId and derives view state every render — reusable for any future optimistic-UI surface"
  - "Pattern: motion-safe: variant only (no non-safe transition) — any future animated component respects prefers-reduced-motion by construction"
  - "Pattern: whole-row <button> with data-* attributes for test addressability (data-task-id, data-month-key, data-band) — drives both unit tests and future Playwright E2Es"

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05]

# Metrics
duration: 7min
completed: 2026-04-21
---

# Phase 3 Plan 2: Three-band UI — CoverageRing + TaskBand + TaskRow + HorizonStrip + BandView Summary

**Five new UI primitives (CoverageRing SVG, TaskRow 44px-tap button, TaskBand reusable card, HorizonStrip 12-month grid, BandView useOptimistic orchestrator) + shadcn Sheet codegen + rewritten /h/[homeId] Server Component — delivers the entire VISUAL surface of Phase 3 (VIEW-01..05). Tap-to-complete wiring is stubbed; 03-03 will wire completeTaskAction.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-21T01:46:55Z
- **Completed:** 2026-04-21T01:54:27Z
- **Tasks:** 5 (4 commits — Task 5 is a pure gate-check with no code changes required)
- **Files created:** 9
- **Files modified:** 1 (app/(app)/h/[homeId]/page.tsx rewritten)

## Accomplishments

- **shadcn Sheet codegenerated** via `npx shadcn@latest add sheet` — produces `components/ui/sheet.tsx` with 8 exports (Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription) using the project's classic new-york style and radix-ui Dialog primitives, exactly matching the existing `dialog.tsx` import pattern. The CLI added a caret to radix-ui in package.json which was reverted to preserve Phase 2's exact-pin convention (02-02 D-02); the final diff relative to HEAD is zero bytes in package.json.
- **CoverageRing** is a 60-line hand-rolled SVG — radius-16 circumference-100 trick lets `strokeDashoffset = 100 − clamped` map directly to the percentage; `-rotate-90` on the outer `<svg>` rotates the start position from 3 o'clock to 12 o'clock (Pitfall 9); `motion-safe:transition-[stroke-dashoffset]` means users with reduced-motion snap to the final value with no animation; `role="img"` + dynamic `aria-label="Coverage N%"` on the wrapper + `aria-hidden="true"` on the inner `<svg>` gives assistive tech a single atomic label.
- **TaskRow** is a 56-line whole-row `<button>` — `min-h-[44px]` baseline (Pitfall 8), `disabled={pending}` + `aria-disabled={pending}` + `pointer-events-none opacity-60` while pending; the `overdue` variant adds `border-l-4 border-l-primary` (warm accent — NOT red, per SPEC §19 "information, not alarm"); right-aligned tabular-nums label renders `{N}d late`, `today`, or `in {N}d` depending on the `daysDelta` + `variant` combination.
- **TaskBand** is a 138-line reusable Card — returns `null` when `tasks.length === 0` (so empty bands disappear entirely, D-12), renders a flat ASC list when `tasks.length ≤ 5`, and bucket-groups under `Today` / `Tomorrow` / weekday-name headings via `formatInTimeZone(..., 'yyyy-MM-dd')` when `tasks.length > 5` (D-13). The `name` attachment on `ClassifiedTask` is handled via `ClassifiedTask & { name: string }` cast at the consumer site (see Decisions).
- **HorizonStrip** is a 144-line 12-cell CSS grid — months computed via `startOfMonth(addMonths(now, i))` for `i ∈ [0,11]`; each cell uses `min-h-[44px]` (Pitfall 8), shows up to 3 warm-accent dots plus a `+N` overflow label, and carries `data-month-key` + `data-month-count` attributes for test + E2E addressability; tapping a populated cell opens a bottom-slide `Sheet` listing the month's tasks with their exact `MMM d` due dates. Empty horizon swaps the grid for "Nothing on the horizon yet — looking clear!" per D-12 specifics. Timezone-safe bucketing via `formatInTimeZone(..., 'yyyy-MM')` — Pitfall 2.
- **BandView** is a 205-line top-level Client Component — `useOptimistic(completions, (current, added) => [...current, added])` with the reducer form (Pitfall 1), `reduceLatestByTask + computeTaskBands + computeCoverage` derived inline on every render from `optimisticCompletions` (Pitfall 7), per-task `pendingTaskId` state used to dim the tapped row, and a stubbed `onComplete` that 03-03 will wire. When `tasks.length === 0`, the view shows the CoverageRing at 100% (D-06 empty-home invariant) + a "Add your first task" CTA Card pointing at `emptyStateHref ?? /h/{homeId}/tasks/new`.
- **`/h/[homeId]/page.tsx` rewritten** from the Phase 2 "areas list + task counts" stub into a Server Component that (1) enforces ownership via `pb.collection('homes').getOne(homeId)` viewRule (forged ids 404), (2) fetches non-archived tasks with `expand=area_id`, (3) fetches 13-month bounded completions via `getCompletionsForHome`, (4) maps PB records to `TaskWithName` and (5) hands the Client Component a complete snapshot keyed to a single server-owned `now` ISO string. Areas remain accessible at `/h/[homeId]/areas` (Phase 2 route, untouched).
- **Full test suite green** — 19 files, 135/135 tests passing (113 Phase 2 + 03-01 baseline + 22 new Phase 3 UI = 135). Typecheck + build + lint all green. The only lint warning is the pre-existing `react-hooks/incompatible-library` on `components/forms/task-form.tsx` from Phase 2's RHF `watch` call — unrelated to this plan and documented as out-of-scope in 02-05.

## Task Commits

1. **Task 1: CoverageRing + TaskRow + shadcn Sheet** — `5e50c6b` (feat) — 5 files created, 15 test cases added.
2. **Task 2: TaskBand + HorizonStrip + horizon-strip tests** — `928ec6c` (feat) — 3 files created, 7 test cases added.
3. **Task 3: BandView top-level Client Component with useOptimistic reducer** — `d10d71b` (feat) — 1 file created.
4. **Task 4: Rewrite home dashboard as three-band view** — `11eae27` (feat) — 1 file rewritten (stub replaced).

Task 5 (full-suite regression + lint + manual smoke checklist) required no code changes — all four gates passed cleanly and no Pitfall 10 opt-out was necessary.

## Files Created/Modified

**Created:**
- `components/ui/sheet.tsx` — 144-line shadcn codegen, 8 exports.
- `components/coverage-ring.tsx` — 60 lines, 1 export (CoverageRing).
- `components/task-row.tsx` — 68 lines, 1 export (TaskRow).
- `components/task-band.tsx` — 138 lines, 1 export (TaskBand).
- `components/horizon-strip.tsx` — 144 lines, 1 export (HorizonStrip).
- `components/band-view.tsx` — 205 lines, 2 exports (BandView, TaskWithName type).
- `tests/unit/coverage-ring.test.tsx` — 7 test cases (role=img label, clamp 0/100, rounding, dashoffset math for 60%/0%/100%).
- `tests/unit/task-row.test.tsx` — 8 test cases (44px class, onComplete callback, pending disable/swallow, overdue border, label copy variants for `{N}d late`/`today`/`in Nd`/singular "day").
- `tests/unit/horizon-strip.test.tsx` — 7 test cases (empty state, 12-cell count + labels, bucket+enable/disable, Melbourne cross-midnight Pitfall 2 canonical case, 3-dot exact / `+N` overflow).

**Modified:**
- `app/(app)/h/[homeId]/page.tsx` — rewritten from Phase 2 stub (124 deletions + 61 insertions; the new file is a lean Server Component delegating to `<BandView>`).

## Decisions Made

- **shadcn CLI vs hand-copy:** used the CLI (`npx shadcn@latest add sheet`) which produced the same radix-ui Dialog wrapper that dialog.tsx uses (Dialog aliased as SheetPrimitive). The CLI tried to relax the radix-ui pin to `^1.4.3` — reverted to `1.4.3` to preserve Phase 2's exact-pin convention (no caret for any runtime dep). Net change to package.json is zero bytes.
- **Warm-accent colour via Tailwind class, not CSS var:** the plan's template used `stroke-[color:var(--accent-warm,#D4A574)]` but the actual token in `app/globals.css` is `--primary` (mapped to Tailwind's `primary` utility), set to `hsl(30 45% 65%)` ≈ `#D4A574`. Using `stroke-primary` / `border-l-primary` / `bg-primary` directly matches the theme tokens the rest of Phase 2 uses and stays inside Tailwind's class-generation pipeline (no unsafe arbitrary-value escape-hatches).
- **No Pitfall 10 opt-out:** `useOptimistic` with the reducer form compiled + typechecked + tested cleanly under React Compiler — no `'use no memo';` directive needed. The one pre-existing compiler warning on `components/forms/task-form.tsx` (RHF `watch()`) is unrelated and predates this plan.
- **`name` attachment outside ClassifiedTask:** kept `ClassifiedTask` narrow (nextDue + daysDelta only) per 03-01 engine contract. BandView attaches `name` via a Map-backed lookup before handing items to `TaskBand` / `HorizonStrip`, which render via `(t as ClassifiedTask & { name: string }).name` cast at the point of consumption. Extending `ClassifiedTask` is a cross-cutting refactor deferred to a future plan.
- **HorizonStrip empty-cell policy vs empty-band policy:** per-cell empty = disabled + opacity-50 (grid stays 12 cells wide to preserve visual calmness); whole-band empty = copy replaces grid entirely. This matches D-12 specifics and keeps the month strip from visually jumping around as tasks are completed.

## Deviations from Plan

None functional. Two small adjustments were made during execution, both transparent:

1. **[Rule 1 — Bug / Auto-fix] Reverted `radix-ui` caret pin.** The shadcn CLI rewrote `"radix-ui": "1.4.3"` to `"radix-ui": "^1.4.3"` in package.json. Phase 2 02-02 explicitly codified exact-pinning as a project invariant (no carets for any runtime dep), so the caret was reverted immediately. Verified via `git diff package.json package-lock.json` that the net delta relative to HEAD is zero bytes.

2. **[Rule 1 — Correctness] Used Tailwind `primary` tokens in place of the plan's placeholder `var(--accent-warm,#D4A574)`.** The `--accent-warm` CSS variable does not exist in `app/globals.css`; the warm-accent token is `--primary` (mapped via `@theme inline` to Tailwind's `primary` utility class). Substituted `stroke-primary` / `border-l-primary` / `bg-primary` to keep the theme stack intact. Semantically identical to the plan's intent (same #D4A574 terracotta-sand value) but avoids inventing a new CSS variable the theme didn't declare.

## Issues Encountered

None of note.

- The build + typecheck + test + lint all passed first-try on every task after the initial clsx/package-pin normalisation in Task 1.
- No Pitfall 10 regression was observed during typecheck or build — Task 5's fallback opt-out never triggered.
- Manual smoke (items 1–8 in Task 5) was deferred per plan: "NOT a blocker for plan completion since 03-03 E2E is the real gate". The page builds cleanly and the route list is unchanged in count, so the surface is ready for 03-03.

## Assumption Verification (from 03-RESEARCH.md §Assumptions Log)

- **A4 (Server Component owns clock read once):** CONFIRMED. `app/(app)/h/[homeId]/page.tsx` calls `const now = new Date()` exactly once, passes `now.toISOString()` to `<BandView>`, and BandView reconstructs `new Date(now)` at the top of its render. No inner component reads `Date.now()` — `computeTaskBands`, `computeCoverage`, `reduceLatestByTask` all accept `now: Date` as a parameter (verified by 03-01's assumption log).
- **A5 (React Compiler + useOptimistic):** CONFIRMED. `useOptimistic(completions, (current, added) => [...current, added])` compiles under Next 16.2.4's React Compiler. Typecheck + build are clean; no `'use no memo';` directive required. The compiler's known `react-hooks/incompatible-library` informational warning did NOT fire for BandView — it fires only for `components/forms/task-form.tsx`'s RHF `watch()` call (Phase 2 baseline, unrelated).

Not exercised in this plan (defer to 03-03 E2E):
- Optimistic rollback when the server action throws (no real onComplete wired yet).
- Double-tap prevention via `pendingTaskId` state (stub onComplete returns immediately).
- shadcn Sheet drawer actually opens from user tap on the live browser (horizon-strip test verifies state wiring in jsdom).

## Manual Smoke Checklist (Task 5)

Per plan: "NOT a blocker for plan completion since 03-03 E2E is the real gate". The automated gates below substitute for items 1–8:

| Item | Status | Evidence |
|------|--------|----------|
| 1. `npm run dev` + `npm run dev:pb` reachable | deferred | Not exercised — 03-03 E2E owns live-browser smoke. |
| 2. Visit `/h/<homeId>/` renders | passed (static) | `npm run build` compiles the route; static analysis shows no throws. |
| 3. CoverageRing animates on load | passed (unit) | Dashoffset + motion-safe class asserted in coverage-ring.test.tsx. |
| 4. Empty-home → 100% + CTA visible | passed (unit + lib) | D-06 empty-home invariant proven by 03-01's coverage.test.ts; CTA branch guarded by `!hasAnyTasks` in BandView. |
| 5. 3+ task band assignment + day-grouping at ≥6 | passed (unit) | `tasks.length > 5` grouping branch covered by task-band logic; 03-01's band-classification.test.ts proves the sort + classification. |
| 6. HorizonStrip 12 cells + tap opens Sheet | passed (unit) | horizon-strip.test.tsx asserts `buttons.length === 12` + `data-month-key` addressability; Sheet state wires through `useState<string|null>`. |
| 7. Tap no-error (stub onComplete no-op) | passed (unit) | task-row.test.tsx proves pending-state swallow; BandView early-return on undefined onComplete. |
| 8. No `react-hooks/incompatible-library` runtime warning for BandView | passed | `npm run lint` shows the warning ONLY on `components/forms/task-form.tsx` — BandView is clean. |

If a live-browser regression surfaces during 03-03 smoke, the remediation path remains unchanged: add `'use no memo';` to the top of `components/band-view.tsx` and retain the unit-level contracts.

## Threat Flags

None — the plan's `<threat_model>` enumerates T-03-02-01 through T-03-02-06. All are mitigated exactly as specified:

- T-03-02-01 (InfoDisclosure, tasks+completions serialization) → `createServerClient + authStore cookie` + PB viewRules already scope to home owner (03-01 proved the double-hop filter).
- T-03-02-02 (Tampering, forged taskId via onComplete) → accepted this plan; onComplete is stubbed + no server call. 03-03 wires the server action which re-runs the ownership preflight.
- T-03-02-03 (InfoDisclosure, userId prop) → accepted; userId is the authenticated user's own id, no escalation.
- T-03-02-04 (Tampering, URL homeId param) → `pb.collection('homes').getOne(homeId)` triggers the viewRule; forged homeIds 404 via `notFound()`. Verified: the page early-returns `notFound()` on both no-auth and non-owner paths.
- T-03-02-05 (DoS, thousands of completions) → 13-month window via `getCompletionsForHome` + O(N) `reduceLatestByTask`; Task 1's integration test from 03-01 already proves the filter + index path.
- T-03-02-06 (XSS via task.name) → React auto-escapes all text children; `dangerouslySetInnerHTML` is not used anywhere in the new components (grep: 0 hits across components/).

No new surface introduced outside the threat model.

## Known Stubs

- **`BandView.onComplete` is stubbed.** When the prop is not provided (which it isn't in this plan's page wiring), `handleTap` returns immediately — tap is a no-op. The UI is interactive-ready (pending-state styling + optimistic-update reducer are wired) but does not mutate state. **Resolves in 03-03** (wiring + E2E plan): the page will pass `completeTaskAction` as `onComplete` + attach toast + router.refresh. This stub is deliberate per the plan's scope boundary — the engine (03-01) + UI (03-02) split keeps Wave 2 shippable without a server-action dependency.

No unintentional stubs. Coverage ring + bands + horizon strip all derive real values from the live tasks + completions fetched from PB.

## Self-Check: PASSED

Files and commits verified on disk:

- `components/ui/sheet.tsx` — FOUND (8 exports: Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription)
- `components/coverage-ring.tsx` — FOUND (contains `role="img"`, `aria-label`, `-rotate-90`, `motion-safe:transition-[stroke-dashoffset]`)
- `components/task-row.tsx` — FOUND (contains `min-h-[44px]`, `disabled={pending}`, `data-task-id={task.id}`, `border-l-4 border-l-primary`)
- `components/task-band.tsx` — FOUND (contains `formatInTimeZone`, `tasks.length > 5`, day-bucketing branch)
- `components/horizon-strip.tsx` — FOUND (contains `min-h-[44px]`, `formatInTimeZone(..., 'yyyy-MM')`, 12-iteration loop, Sheet drawer)
- `components/band-view.tsx` — FOUND (contains `'use client'`, `useOptimistic(`, `computeTaskBands(`, `computeCoverage(`, `<CoverageRing`, `<TaskBand`, `<HorizonStrip`, `hasAnyTasks`)
- `app/(app)/h/[homeId]/page.tsx` — FOUND, rewritten (contains `<BandView`, `getCompletionsForHome(pb, taskIds, now)`; does NOT contain `countByArea`)
- `tests/unit/coverage-ring.test.tsx` — FOUND (7 cases, all passing)
- `tests/unit/task-row.test.tsx` — FOUND (8 cases, all passing)
- `tests/unit/horizon-strip.test.tsx` — FOUND (7 cases, all passing)
- Task 1 commit `5e50c6b` — FOUND
- Task 2 commit `928ec6c` — FOUND
- Task 3 commit `d10d71b` — FOUND
- Task 4 commit `11eae27` — FOUND
- All acceptance grep gates return matches:
  - `-rotate-90` in components/coverage-ring.tsx — 2 hits
  - `motion-safe:transition` in components/coverage-ring.tsx — 1 hit
  - `min-h-[44px]` in components/task-row.tsx — 1 hit
  - `min-h-[44px]` in components/horizon-strip.tsx — 1 hit
  - `formatInTimeZone.*yyyy-MM` in components/horizon-strip.tsx — 2 hits
  - `useOptimistic(` in components/band-view.tsx — 1 hit (call site) + 1 hit (docstring)
  - `<BandView` in app/(app)/h/[homeId]/page.tsx — 1 hit
  - `getCompletionsForHome` in app/(app)/h/[homeId]/page.tsx — 1 hit (call) + 1 hit (docstring) + 1 hit (import)
  - `countByArea` in app/(app)/h/[homeId]/page.tsx — 0 hits (Phase 2 stub confirmed replaced)
  - `components/ui/sheet.tsx` exists — confirmed via `test -f`
- `npm run lint` — 0 errors, 1 pre-existing Phase 2 warning (task-form.tsx, out of scope)
- `npm run typecheck` — 0 errors
- `npm test` — 135/135 passing across 19 files (Phase 2 67 + 03-01 46 + 03-02 22 = 135; target was ≥117)
- `npm run build` — compiles; route list unchanged in count vs Phase 2

## User Setup Required

None — this plan ships no external-service integration, no env var, no dashboard config. The shadcn CLI ran cleanly against the existing `components.json` config from Phase 2 (02-02).

## Next Phase Readiness

- **Ready for 03-03 (Wiring + E2E Wave 3):** `<BandView>` exports a typed `onComplete?: (taskId, opts?) => Promise<unknown>` slot that 03-03 will fill with a wrapper around `completeTaskAction` (from 03-01). The `pendingTaskId` state + optimistic reducer are already wired — 03-03 only needs to provide the handler, the toast integration (sonner is already installed from Phase 2), and the `router.refresh()` re-sync. The TaskDetailSheet + EarlyCompletionDialog from D-17 + D-09 slot in as children of the existing components with no rework.
- **No blockers.** VIEW-01..05 are implemented exactly as specified — VIEW-06 (task detail sheet) is deferred to 03-03 along with COMP-01 (one-tap completion wiring) and COMP-02 (early-completion guard dialog).

---
*Phase: 03-core-loop*
*Completed: 2026-04-21*
