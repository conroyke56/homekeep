# Phase 20: E2E Test Stabilization — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Autonomous (no grey areas — root cause fully diagnosed)

<domain>
## Phase Boundary

Unblock CI E2E by fixing 2 pre-Phase-12 core-loop specs. Root cause diagnosed: `core-loop.spec.ts` seeds back-dated completions via PB REST, but since TCSEM-04 (Phase 13) `createTaskAction` writes a placed `next_due_smoothed` at task-insert time. `computeNextDue`'s smoothed branch short-circuits before the natural-cycle branch sees the seeded completion → task renders in the wrong band → spec assertions fail.

**In scope (2 REQ-IDs):**
- TEST-01 Fix core-loop Scenario 1 + 2 seed methodology
- TEST-02 CI E2E goes green; GHCR tiered tags can advance

**Out of scope:**
- Any production code changes
- Rewriting other E2E specs
- CI workflow structural changes beyond what's needed for these 2 specs

**Deliverables:**
1. Updated `seedCompletion` helper in `tests/e2e/core-loop.spec.ts` — after seeding a back-dated completion, also force `tasks.next_due_smoothed = ''` AND `tasks.reschedule_marker = ''` via PB PATCH so the smoothed branch doesn't shadow the completion. This is the "test-only escape" for LOAD semantics.
2. If `completeTaskAction`'s post-completion re-placement re-shadows the task (landing it in thisWeek when the spec expects it gone from overdue), restructure the spec's POST-completion assertion to match LOAD reality: completion of an overdue task lands it in thisWeek/horizon, NOT "gone entirely". Scenario 2's current assertion "task leaves Overdue" becomes "task in thisWeek after completion".
3. Document the seed-helper pattern in a top-of-file block comment for future specs that need LOAD-aware fixtures.
</domain>

<decisions>
## Implementation Decisions

### Seed helper patch (TEST-01)

- **D-01 (PATCH both fields):** After POSTing the completion, PATCH the task to null BOTH `next_due_smoothed` and `reschedule_marker` (reschedule_marker was added in Phase 15 — defensive; these specs won't set it but the test should be future-proof).
- **D-02 (PATCH timing):** Issue the PATCH AFTER the completion POST so PB record-validator doesn't reject the patch on a no-completions task. Separate HTTP calls, both awaited.
- **D-03 (Scenario 1 assertion preserved):** After user accepts early-completion guard, LOAD re-places (naturalIdeal = now + 7 for a 7-day cycle → ±1 day tolerance → placed in thisWeek but at a DIFFERENT date than pre-completion). The original spec assertion `locator('[data-band="thisWeek"] [data-task-name="Wipe benches"]').toHaveCount(0)` expected the task to leave thisWeek entirely. Under LOAD semantics, the task STAYS in thisWeek (within 7±1 days). Revise assertion: after completion, the task is still in thisWeek — the VALUE that changes is the row's data-next-due attribute (or the day-grouping within thisWeek). Check the data-next-due attribute shifted forward.
- **D-04 (Scenario 2 assertion preserved):** Overdue task (10 days ago, 7d freq → natural next_due = 3 days ago). After completion at now, natural next_due = now + 7 = thisWeek. Under LOAD, placed ±1 day → still thisWeek. Spec expects "left Overdue" — still true (task no longer in overdue band). Keep assertion.

### Re-placement shadow handling (TEST-01)

- **D-05 (option A — mock computeNextDue):** Not viable. Production code paths run the real scheduler; mocking would defeat the E2E purpose.
- **D-06 (option B — direct task.create via PB, skip createTaskAction):** Create tasks via raw PB REST so LOAD's creation-placement never runs. But then `completeTaskAction` still re-places on completion. Only helps before-completion state.
- **D-07 (option C — adjust spec assertions to match LOAD reality — RECOMMENDED):** Core-loop is testing the COMPLETION FLOW, not LOAD placement semantics. What matters: (a) guard fires/doesn't fire correctly, (b) completion record is written, (c) toast appears. The "band exit" assertions were a 2026-04 pre-Phase-12 implementation detail. Rewrite assertions to verify (a)+(b)+(c) directly: guard modal visibility, completions count via PB REST, toast text. Drop the band-exit assertion entirely — it's redundant with unit coverage of computeNextDue.

### Documentation (TEST-01)

- **D-08 (top-of-file comment block):** Add a section explaining: "Specs that need to control task placement must either (1) use `{tasks, next_due_smoothed: ''}` patch pattern, or (2) skip createTaskAction entirely by POSTing to PB. Post-Phase-12, LOAD writes next_due_smoothed on BOTH create AND completion — plan seed strategy accordingly."

### Test scope

- **D-09 (2 tests updated + 0 new):** Pure test-methodology fix. No new behavior tested. Unit coverage already asserts the underlying logic (early-completion guard in `tests/unit/early-completion-guard.test.ts`; band classification in `tests/unit/band-classification.test.ts`).

### Risk

- **D-10 (TEST-02 unblocks Release):** Once CI E2E green, next push of a stable tag (`v1.1.1` or `v1.1.0`) will advance GHCR `:latest` + `:1.1` per the tier strategy in `.github/workflows/release.yml`.
</decisions>

<canonical_refs>
- `tests/e2e/core-loop.spec.ts` — target file
- `tests/unit/early-completion-guard.test.ts` — unit coverage of the guard logic (the E2E was a smoke test)
- `tests/unit/band-classification.test.ts` — unit coverage of band transitions
- `lib/actions/tasks.ts` — createTaskAction writes next_due_smoothed (Phase 13 TCSEM-04)
- `lib/actions/completions.ts` — completeTaskAction re-places on completion (Phase 12 LOAD-10)
- `.planning/phases/19-seasonal-load-patch/19-01-P01-SUMMARY.md` — prior related test-methodology fixes
</canonical_refs>

<deferred>
- Broader E2E rewrite pass (other pre-Phase-12 specs that may have similar latent issues) — v1.2 milestone
- PB-level test fixture helper library (`tests/e2e/fixtures.ts`) for LOAD-aware task seeding — v1.2 if it becomes a pattern
</deferred>

---

*Phase: 20-e2e-test-stabilization*
