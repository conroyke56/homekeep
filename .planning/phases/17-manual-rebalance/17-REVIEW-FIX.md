---
phase: 17-manual-rebalance
fixed_at: 2026-04-22T02:32:00Z
review_path: .planning/phases/17-manual-rebalance/17-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-04-22
**Source review:** `.planning/phases/17-manual-rebalance/17-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical + Warning)
- Fixed: 2
- Skipped: 0

All 598 unit tests still passing after both fixes. IN-01..IN-05 were
out-of-scope for this iteration (Info severity, deferrable).

## Fixed Issues

### WR-01: Pre-existing unparameterised PB filter in settings page

**Files modified:** `app/(app)/h/[homeId]/settings/page.tsx`
**Commit:** `8c75a75`
**Applied fix:** Migrated the pending-invites `getFullList` filter from
template-literal concatenation (`filter: \`home_id = "${homeId}" && accepted_at = ""\``)
to `pb.filter('home_id = {:hid} && accepted_at = ""', { hid: homeId })`.
Matches the parameter-binding pattern used in `lib/actions/rebalance.ts:135`
and `lib/membership.ts:37`. Defense-in-depth — `homeId` traces to typed
Next.js `params`, so the prior form was never exploitable, but the
consistency hardens audit posture and aligns with the "safe filter"
convention (02-04 anti-SQLi). Inline comment added noting the rationale
so the next author doesn't regress back to template-literal.

### WR-02: Empty-batch edge case can still report success with updated=0

**Files modified:** `components/rebalance-dialog.tsx`
**Commit:** `1df949f`
**Applied fix:** Two layered guards in `handleApply`:

1. **Pre-apply guard** — before calling `rebalanceApplyAction`, check
   `preview.update_count === 0`. If zero, skip the server action, show
   the info toast `"All tasks preserved — nothing to rebalance"`, and
   close the Dialog. Belt-and-suspenders since the Apply button is
   already hidden in the render block when `update_count === 0`, but
   protects against future regressions if the render gate is relaxed.
2. **Post-apply toast** — when `r.updated === 0` returns despite the
   preview showing N > 0 (every `placeNextDue` threw server-side and
   was swallowed by the D-06 best-effort `console.warn` branch), swap
   the misleading `"Rebalanced 0 tasks"` message for the neutral
   `"Rebalance complete — no placements changed"`. The pluralization
   path for `updated > 0` is unchanged, so all 9 existing
   `rebalance-dialog.test.tsx` tests (including Test 7's `"Rebalanced 5
   tasks"` and Test 9's singular `"Rebalanced 1 task"`) continue to
   pass.

Opted for Option B from the REVIEW (UI-side toast copy) rather than
Option A (server-side formError). Option B keeps the apply transaction
semantics intact — a swallowed-placement outcome is still a successful
batch (no write at all when `updateCount === 0 && from_now_on.length === 0`
per `rebalance.ts:364`), so surfacing it as an error would overclaim.

## Skipped Issues

None.

---

_Fixed: 2026-04-22_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
