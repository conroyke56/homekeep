# Phase 21: Image Size Budget Adjustment — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Autonomous (pure config/docs update)

<domain>
## Phase Boundary

Bump INFR-03 image budget from 300MB → 320MB reflecting v1.1's legitimate growth. Update `scripts/check-image-size.sh`, SPEC.md §15, PROJECT.md INFR-03 row. Single-task phase.

**In scope (1 REQ-ID):**
- INFRA-BUMP-01 Adjust INFR-03 budget + documentation

**Out of scope:**
- Actual image optimization (deferred — separate exercise)
- Multi-arch build changes
- Deployment changes

**Deliverables:**
1. `scripts/check-image-size.sh` LIMIT=320
2. SPEC.md §15 Docker requirements — target updated with v1.1 growth note
3. PROJECT.md INFR-03 row — reflect new 320MB target
4. Commit + push; next CI run green
</domain>

<decisions>
## Implementation Decisions

- **D-01 (new budget = 320MB):** 309MB observed + 11MB headroom for future small-deps growth. Generous enough to not re-breach on a patch, tight enough to catch runaway bloat.
- **D-02 (rationale documented):** SPEC.md §15 + PROJECT.md entry explain: v1.1 added ~9MB for 8 new UI components (shadcn Collapsible, Dialog, DropdownMenu variations), @radix-ui/react-collapsible, 4 new pb_migrations, expanded pb_hooks.
- **D-03 (no docker-layer optimization attempted this phase):** Separate v1.2 exercise if budget grows again. Phase 21 is policy update, not engineering work.
- **D-04 (no retroactive multi-arch rebuild):** Current GHCR :1.1.1-rc1 image already exists at ~309MB. Policy update lets CI pass on NEXT push; no image rebuild needed retroactively.
</decisions>

<canonical_refs>
- `scripts/check-image-size.sh` — target file
- `SPEC.md` §15 (Docker + distribution requirements) — target section
- `.planning/PROJECT.md` INFR-03 row — target row
- `.github/workflows/ci.yml` — references scripts/check-image-size.sh
</canonical_refs>

<deferred>
- Actual image optimization pass (v1.2 candidate)
- Splitting base runtime image vs app image (v1.2+ if budget pressure returns)
</deferred>

---

*Phase: 21-image-size-budget*
