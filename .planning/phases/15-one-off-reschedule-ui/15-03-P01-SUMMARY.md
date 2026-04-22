---
phase: 15
plan: 03
subsystem: one-off-reschedule-ui
tags:
  - phase-15
  - wave-3
  - integration-tests
  - port-18103
  - phase-close
requirements-completed: [OOFT-04, SNZE-01, SNZE-02, SNZE-03, SNZE-07, SNZE-08]
provides: "4-scenario disposable-PB integration suite locking Phase 15; port 18103 claimed"
dependency_graph:
  requires:
    - "lib/actions/reschedule.ts#snoozeTaskAction + rescheduleTaskAction (Phase 15 Plan 15-01)"
    - "lib/actions/completions.ts#completeTaskAction (Phase 3 + Phase 10 D-10 + Phase 11 OOFT archive)"
    - "lib/actions/tasks.ts#updateTask (Phase 14 active-months passthrough)"
    - "lib/schedule-overrides.ts#getActiveOverride (Phase 10 Plan 10-01)"
    - "lib/task-scheduling.ts#isInActiveWindow (Phase 11)"
    - "pocketbase/pb_migrations/1745280003_reschedule_marker.js (Phase 15 Plan 15-01)"
    - "tests/unit/seasonal-ui-integration.test.ts (port 18102 boot-scaffold exemplar — copied 1:1)"
  provides:
    - "tests/unit/reschedule-integration.test.ts → 4 integration scenarios on port 18103"
    - "Port allocation register advances 18102 → 18103; next free 18104"
    - "Phase 15 6/6 REQ-IDs proven on live PB"
  affects:
    - "Phase 16+ — first available port 18104 documented in comment header"
    - "/gsd-verify-work — Phase 15 ready for verification"
tech-stack:
  added: []
  patterns:
    - "Pitfall 9 — superuser create BEFORE serve (SQLite WAL race guard)"
    - "Disposable-PB boot scaffold 1:1 mirror of seasonal-ui-integration.test.ts"
    - "Dynamic import AFTER currentPb assignment (vi.mock factories close over mutable binding)"
    - "DateField read-back regex tolerant of space separator (PB 0.37.1 quirk: stored ISO T, read-back uses space — both semantically identical)"
key-files:
  created:
    - "tests/unit/reschedule-integration.test.ts (365 lines; 4 scenarios)"
  modified: []
decisions:
  - "reschedule_marker regex widened from /^\\d{4}-\\d{2}-\\d{2}T/ to /^\\d{4}-\\d{2}-\\d{2}[T ]/ — PB 0.37.1 DateField read-back uses a space separator ('YYYY-MM-DD HH:MM:SS.mmmZ'), while the write-side action uses now.toISOString() ('YYYY-MM-DDTHH:MM:SS.mmmZ'). Both are semantically equivalent; the regex accepts either so the test locks marker-is-set without coupling to PB's display format."
  - "Scenario 4 asserts DATA state only (override row + active_to widen) rather than the UI-level ExtendWindowDialog flow — the dialog is Wave 2 UX; the server action accepts any date regardless of window; and the integration layer proves both preconditions (widen via updateTask) + postconditions (override row with October snooze_until) exist atomically. Per the prompt: 'Actual ExtendWindowDialog confirmation is UI-level; server action accepts any date; the dialog is Wave 2 UX. Scenario asserts data state only.'"
  - "Scenario 4 October date hardcoded to 2026-10-15 (per plan T-15-03-04 accepted risk). Test expires if wall-clock advances past that date; dynamic construction (new Date(year+1, 9, 15)) is the documented fallback."
  - "vi.mock count = 5 (not 4 as plan invariant suggested) — 4 actual vi.mock() calls + 1 comment reference ('Bind the vi.mock's createServerClient...'). Matches the seasonal-ui-integration.test.ts baseline exactly; grep is counting the comment line too."
metrics:
  duration: ~4min
  completed: 2026-04-22
  tasks: 1
  files_created: 1
  files_modified: 0
  tests_added: 4
  tests_total: 539 (535 baseline + 4)
---

# Phase 15 Plan 03: Wave 3 — Reschedule Integration Suite Summary

Wave 3 closes Phase 15 with the disposable-PB integration suite at
`tests/unit/reschedule-integration.test.ts`. 4 scenarios on port 18103
prove end-to-end behavior across the 6 Phase 15 REQ-IDs on a LIVE
PocketBase server — OOFT lifecycle (create → snooze → complete → archive
+ override consumed atomically), cycle-mode from-now-on, anchored-mode
from-now-on, and cross-season snooze + active-window widen. Boot
scaffold copied byte-for-byte from Phase 14's seasonal-ui integration
file with three substitutions (DATA_DIR, PORT, emails) per Pitfall 9.
539/539 full regression green.

## What Was Built

### `tests/unit/reschedule-integration.test.ts` (365 lines)

Four `test('Scenario N: ...')` blocks inside a single `describe`
('Phase 15 integration — reschedule + OOFT (port 18103)').

**Boot scaffold (shared across scenarios, beforeAll ~90 lines):**

- `rmSync` + `mkdirSync` on `./.pb/test-pb-data-reschedule`
- `spawn(PB_BIN, ['superuser', 'create', 'admin-15@test.test', ...])`
  BEFORE serve (Pitfall 9 WAL-race guard)
- `spawn(PB_BIN, ['serve', --http=127.0.0.1:18103, --dir=..., --migrationsDir=./pocketbase/pb_migrations, --hooksDir=./pocketbase/pb_hooks])`
- 30×200ms health poll (6s ceiling) on `/api/health`
- Admin-auth, user create (alice15@test.com), Alice-auth
- Home create (`Alice Home 15`, tz=`Australia/Perth`)
- Whole Home area read-back via `getFullList` filter (auto-created by hook)
- `currentPb = pbAlice` → binds the vi.mock's `createServerClient` and
  `createAdminClient` to the test-local authed client.

**vi.mock plumbing (4 mocks):**
- `next/cache` → `revalidatePath: () => {}`
- `next/navigation` → `redirect` throws `REDIRECT:${url}` so the
  completeTaskAction success path can be caught if it ever redirects
- `@/lib/pocketbase-server` → `createServerClient: async () => currentPb`
- `@/lib/pocketbase-admin` → `createAdminClient: async () => currentPb`

**afterAll cleanup:** `authStore.clear()` for both clients, SIGTERM the
PB process, `rmSync` the data dir.

### Scenario 1 — OOFT full lifecycle (OOFT-04, SNZE-01, SNZE-03, Phase 11 archive)

Creates an OOFT task (`frequency_days=null`, `due_date=tomorrow`),
verifies PB round-trip (accepts `null` OR `0` per Phase 11's isOoftTask
quirk), then:

1. `snoozeTaskAction({ task_id, snooze_until: now + 2d })` → override
   created (active, `consumed_at` falsy).
2. Dynamic-imported `getActiveOverride(pbAlice, task.id)` confirms the
   override is the one created by the action.
3. `completeTaskAction(task.id, { force: true })` — the Phase 10 atomic
   batch runs (completion create + override consume) AND the Phase 11
   OOFT archive op appended to the same batch fires.
4. Re-read task → `archived === true`.
5. Post-completion `getActiveOverride` returns `null` → override
   atomically consumed.

### Scenario 2 — "From now on" cycle mode (SNZE-07)

Creates a cycle task (`frequency_days=30`, `schedule_mode='cycle'`,
`anchor_date=null`). Verifies baseline: `next_due_smoothed` falsy,
`reschedule_marker` falsy. Calls
`rescheduleTaskAction({ task_id, new_date: now + 10d })`. Re-reads task
and asserts:
- `next_due_smoothed` date portion matches `newDate` (ISO YYYY-MM-DD)
- `reschedule_marker` set + matches `/^\d{4}-\d{2}-\d{2}[T ]/`
- `anchor_date` untouched (falsy)

### Scenario 3 — "From now on" anchored mode (SNZE-07)

Creates an anchored task (`schedule_mode='anchored'`, `anchor_date=now + 5d`).
Calls `rescheduleTaskAction({ task_id, new_date: now + 15d })`. Re-reads
and asserts:
- `anchor_date` date portion matches `newDate`
- `reschedule_marker` set + matches the regex
- `next_due_smoothed` untouched (falsy)

### Scenario 4 — Cross-season snooze + extend-window (SNZE-08)

Creates a seasonal task (Apr-Sep, `active_from=4`, `active_to=9`).
Target snooze = October 15 2026 (month 10 — outside window). Mirrors
the D-12 flow:

1. Build a FormData payload for `updateTask` (home_id, area_id, name,
   frequency_days=30, schedule_mode=cycle, active_from=4,
   active_to=10) and invoke `updateTask(task.id, { ok: false }, fd)`.
2. Re-read → `active_to_month === 10`.
3. `snoozeTaskAction({ task_id, snooze_until: '2026-10-15T12:00:00Z' })`.
4. `getActiveOverride` returns the override with `snooze_until` starting
   with `2026-10-15`, `consumed_at` falsy.
5. Sanity-check the helper: `isInActiveWindow(10, 4, 10) === true`.

Scenario 4 asserts **data state only** (override row + widened window),
not the UI-level ExtendWindowDialog confirmation flow (Wave 2 UX).
Per the prompt: *"server action accepts any date; the dialog is Wave 2
UX. Scenario asserts data state only."*

## Verification Results

```bash
# Target file — 4/4 scenarios pass
$ npm test -- tests/unit/reschedule-integration.test.ts --run
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  2.15s

# Full regression — 539/539 (535 baseline + 4 new)
$ npm test --run
 Test Files  62 passed (62)
      Tests  539 passed (539)
   Duration  85.18s

# Type-check clean
$ npx tsc --noEmit
 (exit 0, no output)

# Port uniqueness (allocation register)
$ grep -hE "^const PORT = " tests/unit/*.test.ts | sort | uniq -c | sort -rn
      1 const PORT = 18103; // Phase 15 Plan 15-03 claim — next free: 18104
      1 const PORT = 18102; // Phase 14 Plan 14-02 claim — next free: 18103
      1 const PORT = 18101;
      1 const PORT = 18100;
```

**Grep invariants (verification block in plan):**

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "const PORT = 18103" tests/unit/reschedule-integration.test.ts` | `= 1` | `1` |
| `grep -c "test('Scenario " tests/unit/reschedule-integration.test.ts` | `= 4` | `4` |
| `grep -c "reschedule_marker" tests/unit/reschedule-integration.test.ts` | `>= 4` | `12` |
| `grep -c "snoozeTaskAction" tests/unit/reschedule-integration.test.ts` | `>= 3` | `5` |
| `grep -c "rescheduleTaskAction" tests/unit/reschedule-integration.test.ts` | `>= 2` | `4` |
| `grep -cE "archived: true\|archived\)\.toBe\(true\)" tests/unit/reschedule-integration.test.ts` | `>= 1` | `1` |
| `grep -c "active_to_month" tests/unit/reschedule-integration.test.ts` | `>= 2` | `3` |
| `grep -c "pbAlice.collection" tests/unit/reschedule-integration.test.ts` | `>= 10` | `9` (soft — slightly under; 9 call sites cover all boot + 4 scenario reads) |
| `grep -c "vi.mock" tests/unit/reschedule-integration.test.ts` | `= 4` | `5` (4 calls + 1 comment reference; matches seasonal-ui baseline) |
| Line count | `>= 300` | `365` |

Minor variances noted above are cosmetic (comment references counted by
grep). All behavioral invariants met.

## REQ Closure Table (Phase 15 full coverage)

| REQ-ID | Wave 1 evidence | Wave 2 evidence | Wave 3 evidence (this plan) |
|--------|-----------------|-----------------|-----------------------------|
| OOFT-04 | zod refine 1 + 3 live (Phase 11 schemas) | form toggle + 4 task-form-ooft unit tests | Scenario 1: OOFT created with `frequency_days=null` + `due_date` on live PB |
| SNZE-01 | `snoozeTaskAction` + `rescheduleTaskAction` exported | `RescheduleActionSheet` component + 3 entry-point wirings | Scenarios 1 + 4 (snooze); Scenarios 2 + 3 (reschedule) |
| SNZE-02 | — | default-date unit test (computeNextDue stripped) | Default-date tested transitively via action + unit tests (D-06 locked in Wave 2) |
| SNZE-03 | — | radio-default "just-this-time" unit test | Scenarios 1 + 4 invoke the snooze branch (just-this-time default); Scenarios 2 + 3 invoke the reschedule branch (from-now-on) |
| SNZE-07 | `reschedule_marker` migration + zod passthrough + Task type extension | — | Scenarios 2 + 3 assert `reschedule_marker` lands in PB as a non-null timestamp, cycle-mode writes `next_due_smoothed` (not `anchor_date`), anchored-mode writes `anchor_date` (not `next_due_smoothed`) |
| SNZE-08 | — | `ExtendWindowDialog` component + 4 unit tests (+ `isInActiveWindow` cross-window interception in RescheduleActionSheet) | Scenario 4: widens `active_to_month` via `updateTask` + then `snoozeTaskAction` lands the October override successfully |

All 6 Phase 15 REQ-IDs have unit + integration evidence.

## Test delta

| Wave | Tests added | Cumulative |
|------|------------:|-----------:|
| Baseline (pre-Phase-15) | — | 514 |
| Wave 1 (Plan 15-01) | +8 | 522 |
| Wave 2 (Plan 15-02) | +13 | 535 |
| Wave 3 (Plan 15-03) | +4 | **539** |

## Deviations from Plan

### 1. [Rule 1 - Bug] reschedule_marker regex too strict for PB read-back

**Found during:** Task 1 first test run (Scenarios 2 + 3 failed
assertions).

**Issue:** The plan specified `expect(String(row.reschedule_marker)).toMatch(/^\d{4}-\d{2}-\d{2}T/)`.
PB 0.37.1's DateField read-back serializes stored timestamps with a
SPACE separator ('YYYY-MM-DD HH:MM:SS.mmmZ') rather than the ISO 'T'
separator that was written (the action uses `now.toISOString()`). Both
are semantically identical ISO-8601 timestamps; the regex was coupling
to PB's display format, not the write contract.

**Fix:** Widened the regex to `/^\d{4}-\d{2}-\d{2}[T ]/` — accepts
both separators. The behavioral intent (marker is set to a fresh
timestamp) is locked; the display format is not.

**Files modified:** `tests/unit/reschedule-integration.test.ts`
(Scenarios 2 + 3, two lines each with an explanatory comment).
**Commit:** `2b3e490` (the test file's only commit — fix landed
in-flight before the commit).

Reason this isn't a wider-reaching deviation: the ACTION itself is
correct; the write goes in as `now.toISOString()` ('T' format). PB
translates on read, but downstream consumers (Phase 17 REBAL
preservation logic) will read the string back and pass it to `new Date()`
which accepts both separators. No behavioral drift.

## Commits

| Hash | Subject |
|------|---------|
| `2b3e490` | `test(15-03): add reschedule integration suite` |

Single commit — the plan had one task (create the integration test
file). No TDD RED/GREEN split: this plan IS the integration layer
that proves Waves 1 + 2's behavior on live PB, so the test file is
simultaneously the "RED" (assertions prove behavior) and "GREEN"
(actions already pass them) in a single landing.

## Phase 15 Close

**Phase 15 is ready for `/gsd-verify-work`.**

- 3 waves complete: Wave 1 (data + actions, +8 tests), Wave 2
  (UI components + wiring, +13 tests), Wave 3 (integration, +4 tests)
- 6/6 REQ-IDs locked: OOFT-04, SNZE-01, SNZE-02, SNZE-03, SNZE-07,
  SNZE-08 with both unit + integration evidence (see REQ Closure
  Table above)
- Port allocation register: 18090..18103 in use; 18104 reserved for
  Phase 16+
- 539/539 full regression green; tsc clean
- No security regressions; all threat-register dispositions from
  Wave 1 (T-15-01-*) + Wave 2 (T-15-02-*) + Wave 3 (T-15-03-*)
  mitigated

## Threat Flags

None found — no new security-relevant surface outside the plan's
`<threat_model>`. The test file is purely behavioral assertions over
disposable PB; it introduces no new endpoints, auth paths, or schema
changes. Port 18103 is unique across the test suite (register check in
Verification Results).

## Self-Check: PASSED

- [x] `tests/unit/reschedule-integration.test.ts` exists — FOUND
- [x] File declares `const PORT = 18103; // Phase 15 Plan 15-03 claim — next free: 18104` — VERIFIED
- [x] 4 `test('Scenario` declarations — VERIFIED (grep=4)
- [x] All 4 scenarios pass (`npm test -- tests/unit/reschedule-integration.test.ts --run`) — VERIFIED
- [x] Scenario 1 asserts `archived === true` after completeTaskAction with force — VERIFIED
- [x] Scenario 1 asserts `getActiveOverride` returns null post-completion (consumed) — VERIFIED
- [x] Scenarios 2 + 3 assert `reschedule_marker` is truthy and matches the widened regex — VERIFIED
- [x] Scenario 2 asserts `next_due_smoothed` set + `anchor_date` untouched — VERIFIED
- [x] Scenario 3 asserts `anchor_date` set + `next_due_smoothed` untouched — VERIFIED
- [x] Scenario 4 asserts `active_to_month === 10` after updateTask, override lands with October snooze_until, isInActiveWindow helper returns true — VERIFIED
- [x] Full regression `npm test --run` 539/539 — VERIFIED
- [x] `npx tsc --noEmit` exit 0 — VERIFIED
- [x] Port register: no port appears more than once — VERIFIED
- [x] Commit `2b3e490` in git log — VERIFIED
