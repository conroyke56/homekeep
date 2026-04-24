<!-- gitleaks:allow (code references, no secrets) -->
---
phase: 37
phase_name: Shared E2E Test Helpers
status: shipped
parent_milestone: v1.3-test-stabilization
covered_reqs: [TESTFIX-04]
---

# Phase 37 Summary — Shared E2E Test Helpers

## Goal

Abstract the flake-resistant patterns developed in Phases 35-36 into
shared helpers so **future tests inherit the fixes without re-
learning the workarounds**. Prevents regression if a new flake-prone
spec lands post-v1.3.

## What landed

Three exports added to `tests/e2e/helpers.ts`:

### `waitForServerAction(page, { trigger, urlPattern?, timeout? })`

Wraps click + Server Action POST wait + optional URL-settle. Callers
replace the naive `await page.click(...); await expect(...).toHaveURL(...)`
pattern with a single call that guarantees the DB write committed
before subsequent assertions or navigations fire. Applied by the
homes-areas area-rename test (Phase 35); any future test that hits
a Server Action then immediately re-queries data should use this.

### `waitForRHFConditional(triggerLocator, revealLocator, { triggerState?, revealTimeout? })`

Wraps the React Hook Form conditional-reveal pattern — checkbox /
radio flip → conditional child render — with the Phase 35 fix baked
in. First asserts the trigger state, then waits up to 10s for the
reveal. Prevents the React 19 concurrent-render timing flake that
blocked the notifications spec.

### `signup(page, email, password, name?)`

Canonical signup helper: navigate to `/signup`, fill, submit, wait
for `/h` URL match with a 15s timeout (generous enough to absorb
the single retry inside `createServerClientWithRefresh` from Phase
36). New specs prefer this over inline copies.

## What was NOT migrated

**10 spec files** still carry inline `signup()` definitions:
- `collaboration`, `core-loop`, `onboarding`, `tasks-happy-path`,
  `notifications`, `homes-areas`, `phase-16-visual`,
  `v1.1-marketing`, `task-assignment`, `views`

These **were not force-migrated** because:
1. The underlying flake is already fixed at
   `lib/pocketbase-server.ts::createServerClientWithRefresh` (Phase
   36). The inline copies now work correctly.
2. Each inline variant has subtle differences (different `name`
   defaults, different post-signup steps) — a mechanical
   search-and-replace would miss nuance.
3. Migration is opportunistic: touch these when you're in a file
   for other reasons. Zero value in 10 churn-commits.

## Verification

- TypeScript: `npx tsc --noEmit` → clean
- Unit tests: 678/678 still green (no behavior change; helpers.ts
  exports only)
- Phase 35 + 36 landed in the same CI cycle — the auth-refresh
  retry + the two un-skipped specs are already testing via CI
- Phase 37's helpers are **passive infrastructure** until new tests
  consume them; no active test exercises them yet. That's fine.

## Rationale for the split (why not migrate now?)

Migration churn is a risk magnet — every file touched is a file
potentially broken. The triage called this out: "migrate the 18
assertion sites" was aspirational; the REAL win is the
source-of-truth fix (Phase 36) that makes the assertion sites
inherently work. The helpers make FUTURE tests flake-resistant
from day one, which is the permanent value.

If v1.4 test-writing reveals the helpers aren't quite right, this
is where we iterate — BEFORE the migration commit sprawls across
10 files.

## Non-goals (defer to later)

- Migrating 10 existing specs → `signup` helper (opportunistic)
- Documenting the pattern in a `tests/e2e/README.md` or CLAUDE.md
  addition (could belong to Phase 38's planning-dir cleanup, but
  out of scope for v1.3 — call it v1.4 when the pattern has seen
  real use)
