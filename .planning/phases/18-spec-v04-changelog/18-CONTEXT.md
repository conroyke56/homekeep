# Phase 18: SPEC v0.4, AGPL Drift & v1.1 Changelog — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Autonomous (docs-only, no gray areas)

<domain>
## Phase Boundary

Docs-only phase. SPEC.md catches up to reality — bumped v0.3 → v0.4 (material changes from addendum), three stale "MIT" references corrected to AGPL-3.0, v1.1 changelog documents every new field/collection/algorithm/UI surface from phases 10-17, PROJECT.md INFR-12 + SMTP nit corrected. Release-ready for v1.1.0-rc1.

**In scope (6 REQ-IDs):**
- DOCS-01 SPEC.md version bump to v0.4
- DOCS-02 SPEC.md MIT→AGPL-3.0 corrections (3 occurrences)
- DOCS-03 SPEC.md v1.1 changelog section
- DOCS-04 PROJECT.md INFR-12 → AGPL-3.0
- DOCS-05 SPEC.md documents new task fields (next_due_smoothed, preferred_days, active_from/to_month, nullable frequency_days), schedule_overrides collection, LOAD algorithm (tolerance, tiebreakers, forward-only), REBAL semantics
- DOCS-06 PROJECT.md SMTP constraint reworded "No SMTP" → "SMTP optional, never required"

**Out of scope:**
- Code changes (none)
- Tests (none — docs only)

**Deliverables:**
1. SPEC.md updates: version v0.4, changelog section, new sections documenting data model + LOAD + REBAL + snooze + seasonal + OOFT + PREF semantics.
2. PROJECT.md updates: INFR-12 AGPL-3.0, SMTP wording.
3. Success criterion SC #4: new reader can understand from SPEC alone: snooze, LOAD pick, anchored bypass, seasonal wrap, manual rebalance.
</domain>

<decisions>
## Implementation Decisions

### Version bump (DOCS-01)

- **D-01:** SPEC.md frontmatter `version: v0.4`. v0.3 → v0.4 because the addendum (LOAD, LVIZ, TCSEM, REBAL) is materially new, not incremental.

### MIT→AGPL corrections (DOCS-02, DOCS-04)

- **D-02:** grep SPEC.md for "MIT" — should find 3 occurrences. Each corrected to "AGPL-3.0-or-later".
- **D-03:** PROJECT.md INFR-12 row: change from "MIT" to "AGPL-3.0".

### v1.1 Changelog section (DOCS-03)

- **D-04 (location):** New section near end of SPEC.md titled `## Changelog — v1.1 Scheduling & Flexibility`.
- **D-05 (contents):** Bulleted list organized by category:
  - Data model additions: 4 new nullable fields on `tasks` + `frequency_days` nullable + new `schedule_overrides` collection + `tasks.reschedule_marker`
  - Algorithms: LOAD placement (tolerance min(0.15*freq, 5), tiebreakers lowest-load→closest→earliest, forward-only), PREF narrowing hard constraint, seasonal dormancy + wake-up branches in computeNextDue
  - UI surfaces: Advanced collapsible ("Last done" + "Active months"), ⚖️ ShiftBadge, HorizonStrip density tint, DormantTaskRow, RescheduleActionSheet (just-this-time vs from-now-on), ExtendWindowDialog, Settings → Scheduling Rebalance

### New semantic sections (DOCS-05)

- **D-06 (snooze section):** Document schedule_overrides collection + D-02 atomic replace + D-10 read-time filter + consumption-at-completion.
- **D-07 (LOAD section):** Document placeNextDue pipeline (candidates → PREF narrow → widen+6 → load-score → tiebreakers) + 6-branch computeNextDue order + anchored bypass.
- **D-08 (seasonal section):** Document active_from/to nullable pair + cross-year wrap + dormant/wakeup branches + coverage exclusion.
- **D-09 (OOFT section):** Document frequency_days null + due_date required + atomic archive on completion.
- **D-10 (REBAL section):** Document 4-bucket classifier + fresh load map + ascending ideal-sort + idempotency + marker clear.

### SMTP wording (DOCS-06)

- **D-11:** Find "No SMTP" phrase in PROJECT.md (scheduler/notifications constraints). Replace with "SMTP optional, never required" — reflects that ntfy is primary but SMTP works if user configures it.

### Test scope

- **D-12 (validation):** Post-docs, run `grep -c "MIT" .planning/SPEC.md` → 0. `grep "v0.4" .planning/SPEC.md` present. `grep "changelog" -i .planning/SPEC.md` section present. Link check optional.
</decisions>

<canonical_refs>
- `.planning/SPEC.md` (primary target)
- `.planning/PROJECT.md` (INFR-12 + SMTP)
- `.planning/phases/10..17/*/SUMMARY.md` (source material for changelog entries)
- `.planning/v1.1/audit-addendum-load.md` (LOAD + REBAL context)
</canonical_refs>

<deferred>
- SPEC.md reformatting beyond changelog (out-of-scope nit)
- Updating inline comments in code with SPEC v0.4 reference (deferred — code comments reference decisions, not SPEC version)
</deferred>

---

*Phase: 18-spec-v04-changelog*
*Context gathered: 2026-04-22*
