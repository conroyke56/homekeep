---
phase: 11-task-model-extensions
doc: validation
dimension: 8e
generated: 2026-04-22
source: 11-RESEARCH.md §Validation Architecture
---

# Phase 11: Validation Architecture

**Purpose:** Dimension 8e compliance — a single sheet mapping every in-scope REQ-ID to the automated test command that verifies it. Executors and checkers read this BEFORE writing or validating tests.

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 |
| Config file | `vitest.config.ts` (repo root) |
| Unit-test runner | `npm test -- <file>` |
| Full suite | `npm test` |
| Integration port | **18099** (D-27; allocation log now 18090..18099) |

## Phase Requirements → Test Map

| REQ ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| OOFT-01 | Nullable frequency_days accepted by schema + DB | unit + integration | `npm test -- tests/unit/task-extensions-integration.test.ts -t "migration"` | `tests/unit/task-extensions-integration.test.ts` (NEW) |
| OOFT-02 | One-off auto-archives atomically with completion | integration | `npm test -- tests/unit/task-extensions-integration.test.ts -t "OOFT lifecycle"` | `tests/unit/task-extensions-integration.test.ts` (NEW) |
| OOFT-03 | Zod rejects OOFT without due_date; accepts with past due_date | unit | `npm test -- tests/unit/task-extensions.test.ts -t "zod OOFT"` | `tests/unit/task-extensions.test.ts` (NEW) |
| OOFT-05 | `computeNextDue` returns `due_date` for unborn OOFT, null post-completion | unit | `npm test -- tests/unit/task-scheduling.test.ts -t "OOFT"` | `tests/unit/task-scheduling.test.ts` (EXTEND) |
| PREF-01 | Schema accepts any/weekend/weekday; null reads as 'any' via `effectivePreferredDays` | unit | `npm test -- tests/unit/task-extensions.test.ts -t "effectivePreferredDays"` | `tests/unit/task-extensions.test.ts` (NEW) |
| PREF-02 | `narrowToPreferredDays` filters correctly (weekend keeps Sat/Sun; weekday drops Sat/Sun) | unit | `npm test -- tests/unit/task-extensions.test.ts -t "narrowToPreferredDays"` | `tests/unit/task-extensions.test.ts` (NEW) |
| PREF-03 | `narrowToPreferredDays` returns empty when no match (caller widens in Phase 12) | unit | `npm test -- tests/unit/task-extensions.test.ts -t "narrow empty"` | `tests/unit/task-extensions.test.ts` (NEW) |
| PREF-04 | Narrow never produces earlier date (trivially true — filters input list) | unit | `npm test -- tests/unit/task-extensions.test.ts -t "narrow identity"` | `tests/unit/task-extensions.test.ts` (NEW) |
| SEAS-01 | Schema accepts paired active_from/to months; rejects one-set-one-null | unit | `npm test -- tests/unit/task-extensions.test.ts -t "zod paired months"` | `tests/unit/task-extensions.test.ts` (NEW) |
| SEAS-02 | Dormant task returns null from `computeNextDue` | unit | `npm test -- tests/unit/task-scheduling.test.ts -t "seasonal dormant"` | `tests/unit/task-scheduling.test.ts` (EXTEND) |
| SEAS-03 | Wake-up returns start-of-window in home tz | unit | `npm test -- tests/unit/task-scheduling.test.ts -t "seasonal wakeup"` | `tests/unit/task-scheduling.test.ts` (EXTEND) |
| SEAS-04 | `isInActiveWindow` handles wrap (Oct-Mar active Dec; dormant Jul) | unit | `npm test -- tests/unit/task-extensions.test.ts -t "isInActiveWindow wrap"` | `tests/unit/task-extensions.test.ts` (NEW) |
| SEAS-05 | `computeCoverage` excludes dormant from mean | unit | `npm test -- tests/unit/coverage.test.ts -t "dormant"` | `tests/unit/coverage.test.ts` (EXTEND) |

**Regression gate (D-26):** `npm test` — all 355 existing tests (311 baseline + 44 Phase 10) still green, assertion-for-assertion unchanged.

## Test Files Inventory

| File | Status | Purpose |
|------|--------|---------|
| `tests/unit/task-scheduling.test.ts` | EXTEND | ~15 new cases: OOFT branch (D-05), seasonal dormant/wakeup (D-12), override × dormant composition (D-17) |
| `tests/unit/coverage.test.ts` | EXTEND | 1 new case: dormant exclusion (SEAS-05 / D-14) |
| `tests/unit/task-extensions.test.ts` | NEW | ~18 cases: PREF helpers + `isInActiveWindow` 12×3 matrix + zod refinement cases |
| `tests/unit/task-extensions-integration.test.ts` | NEW | 4 disposable-PB scenarios on port 18099: migration shape; OOFT lifecycle create→complete→archived atomically; seasonal lifecycle dormant→wakeup; override composes with dormant task (D-17) |

## Integration Test Port Allocation

- 18090 (02-01), 18091 (03-01), 18092/18093 (04-01), 18094 (04-02), 18095 (05-01), 18096 (06-01), 18097 (06-02), 18098 (10-01), **18099 (11 — this phase, D-27)**.
- Next free for Phase 12+: 18100.

## Sampling Rate

- **Per task commit:** `npm test -- tests/unit/task-scheduling.test.ts tests/unit/task-extensions.test.ts tests/unit/coverage.test.ts` (~3s)
- **Per wave merge:** `npm test` (full suite, 25-40s per Phase 10 benchmark)
- **Phase gate:** Full suite green before `/gsd-verify-work`. D-26 regression assertion: 355 existing tests pass + ~30 new.

## Wave 0 Gaps (must be closed before Plan 11-01 Task 1 lands)

- [ ] **A1 smoke — PB NumberField required mutation** — 30-second disposable PB smoke confirming `field.required = true → false` via direct lookup+assign is persisted by `app.save(collection)`. If rejected, fallback is remove+re-add (SQLite column metadata-only; no data loss). This is embedded as Plan 11-01 Task 1 Step 0.
- [ ] `tests/unit/task-extensions.test.ts` — NEW file scaffold (created in Plan 11-01 Task 3).
- [ ] `tests/unit/task-extensions-integration.test.ts` — NEW file scaffold (created in Plan 11-03 Task 1; copy `schedule-overrides-integration.test.ts` boot block verbatim, change port 18098→18099).

## Security Domain (ASVS Applicability)

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V4 Access Control | yes | New fields inherit `tasks.{list,view,create,update,delete}Rule`; no new rules needed |
| V5 Input Validation | yes | Zod cross-field refinements + PB `min:1 max:12` defense-in-depth |
| V7 Error Handling | yes | Branch guards fail-closed: invalid frequency throws; null/archived returns null |
| V11 Business Logic | yes | Branch-order composition (D-16) encodes the business logic; D-25 test matrix is the control |

## Known Threat Patterns (T-11-01..06)

Covered in full in each plan's `<threat_model>` block. Summary:

- **T-11-01** OOFT without due_date — validation bypass. Mitigated: D-21 zod refine; integration test asserts rejection.
- **T-11-02** Corrupt seasonal window (from=13, to=0) — schema bypass. Mitigated: PB `min:1 max:12` + zod range + paired refine. Three layers.
- **T-11-03** OOFT completion lands but archive fails — atomicity bypass. Mitigated: Phase 10's `pb.createBatch()` rollback semantics extend to the archive op.
- **T-11-04** Cross-year wrap off-by-one — logic bug. Mitigated: 12-month unit matrix covering every month of an Oct-Mar task; hard gate on phase completion.
- **T-11-05** Dormant override abuse (by-design per D-17). Documented as acceptable; Phase 15 UI warns.
- **T-11-06** Past-date OOFT (by-design per D-22). Legitimate "I forgot this, do it ASAP" pattern; documented as distinct from Phase 10 snooze past-date rejection.

---

*Extracted from `.planning/phases/11-task-model-extensions/11-RESEARCH.md` §Validation Architecture + §Security Domain.*
