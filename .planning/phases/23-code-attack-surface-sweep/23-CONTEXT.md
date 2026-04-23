# Phase 23: Code Attack Surface Sweep — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Autonomous (SEC-01..07 fully spec'd in research reports)

<domain>
## Phase Boundary

Sweep remaining code-level security gaps identified in research. Most are hardening (defense-in-depth); one is a latent IDOR (SEC-05 last_viewed_home_id); one is a rule gap (SEC-02 schedule_overrides body-check).

**In scope (7 REQ-IDs):**
- SEC-01 template-literal PB filter sweep → parameterized `pb.filter(...)`
- SEC-02 `schedule_overrides.createRule` body-check migration (additive rule tightening)
- SEC-03 admin scheduler token comparison → `crypto.timingSafeEqual`
- SEC-04 updateTask cross-verifies area_id belongs to home_id (matches createTask)
- SEC-05 last_viewed_home_id write-path validates user IS member of home (IDOR fix)
- SEC-06 password min length 8 → 12 in zod schema
- SEC-07 proxy.ts token-refresh round-trip on authed navigations

**Out of scope:**
- HTTP headers (Phase 24)
- Rate limits (Phase 25)
- Demo architecture (Phase 26)
- Supply chain (Phase 27)
- Docs (Phase 28)
</domain>

<decisions>
## Implementation Decisions

### SEC-01: Filter parameterization sweep

Sites identified by research (auth-access-control.md §A-01, attack-surface.md §F-03):
- `app/(app)/h/[homeId]/page.tsx` (dashboard)
- `app/(app)/h/[homeId]/members/page.tsx`
- `app/(app)/h/[homeId]/areas/page.tsx`
- `app/(app)/h/[homeId]/areas/[areaId]/page.tsx`
- `app/(app)/h/[homeId]/by-area/page.tsx`
- `app/(app)/h/[homeId]/history/page.tsx`
- `app/(app)/h/[homeId]/onboarding/page.tsx`
- `app/(app)/h/[homeId]/person/page.tsx`
- `app/(app)/h/[homeId]/tasks/new/page.tsx`
- `app/(app)/h/[homeId]/tasks/[taskId]/page.tsx`
- `app/(app)/h/[homeId]/settings/page.tsx`
- `lib/actions/seed.ts:79`
- `lib/actions/areas.ts:82`
- `lib/scheduler.ts:166,210,313,319` (⚠ runs under admin client — highest-risk site)

**D-01 (grep-verify:** post-sweep, `grep -rn 'filter: \`' app/ lib/` returns zero matches.

**D-02 (pattern):** every site becomes `pb.filter('field = {:name}', { name: value })`. Documented convention already in use in `lib/actions/tasks.ts`, `lib/schedule-overrides.ts`, `lib/load-smoothing.ts`, `lib/actions/rebalance.ts`.

### SEC-02: schedule_overrides body-check

**D-03 (additive migration):** new migration `1745280004_schedule_overrides_body_check.js` amends `schedule_overrides.createRule` to add `@request.body.created_by_id = @request.auth.id`. Matches `completions.createRule` at `pocketbase/pb_migrations/1714867200_completions.js:38`.

**D-04 (test):** new integration scenario in `schedule-overrides-integration.test.ts` — forged attribution POST (user A creates override with `created_by_id = user B`) rejected by PB rule.

### SEC-03: Timing-safe scheduler token compare

**D-05:** `app/api/admin/run-scheduler/route.ts` — replace `!==` with `crypto.timingSafeEqual`. Wrap with try/catch for length mismatch (both strings must be same length). Fall back to `false` response on length mismatch (not leaking hint).

### SEC-04: updateTask cross-verify

**D-06:** in `lib/actions/tasks.ts` `updateTaskAction`, if `area_id` is in the payload, verify the resolved area's `home_id` matches the task's `home_id`. Mirror `createTaskAction:111` pattern.

### SEC-05: last_viewed_home_id IDOR

**D-07:** `users.last_viewed_home_id` setter path — check `pocketbase/pb_hooks/` + `lib/actions/homes.ts` for the setter. Add membership check: user must be in home_members of the target home before the value is written.

**D-08 (PB rule option):** alternatively, add a PB rule validation via JS hook that rejects writes where the target home isn't in the user's home_members. Recommend hook — rule-string for cross-collection check is awkward.

### SEC-06: Password minimum 12

**D-09:** `lib/schemas/auth.ts` zod signup + password-reset-confirm schemas: min 8 → min 12. No migration, no forced reset for existing users (grandfathered). Zod refine message: "At least 12 characters".

### SEC-07: proxy.ts token refresh

**D-10:** `proxy.ts` middleware — current implementation checks cookie presence only. Research A-01 notes the JSDoc at `app/(public)/invite/[token]/page.tsx:27-30` claims a layout Referrer-Policy is set which isn't true, AND proxy.ts JSDoc oversells the defense. The actual fix: use `createServerClientWithRefresh()` instead of `createServerClient()` in `(app)/layout.tsx` so the token is refreshed + validated on each authed render. Small cost (one PB roundtrip per authed page render); worth it.

**D-11 (testing):** E2E tests stay green — refresh is transparent.

### Test scope

- **D-12 (~10 unit tests + 2 integration):**
  - 7 filter-site grep tests (simplest: grep-based acceptance criteria in plan, no test needed)
  - 1 schedule_overrides forgery integration test (SEC-02)
  - 1 scheduler token timing-safe unit test (SEC-03)
  - 1 updateTask cross-home area_id reject test (SEC-04)
  - 1 last_viewed_home_id IDOR reject integration test (SEC-05)
  - 1 password min 12 reject test (SEC-06)
  - proxy.ts refresh: existing E2E coverage already exercises authed navigation; no new test needed

### Migration + port

- **D-13 (migration 1745280004):** adds body-check rule to schedule_overrides. Additive. No data change.
- **D-14 (integration port):** reuse 18098 for schedule-overrides (Phase 10's port) — the new SEC-02 test lives in `tests/unit/schedule-overrides-integration.test.ts`.

### Ordering
1. SEC-01 first (most-grepped, visible via git diff)
2. SEC-02 (migration — landing early so tests can depend on it)
3. SEC-03..07 can land in any order

### Claude's Discretion
- Whether to split the filter sweep into multiple commits per file group — recommend one commit for readability (all sites are mechanical `pb.filter(...)` conversions).
- Whether SEC-07 gets its own phase due to runtime cost impact — recommend no, it's a one-line change with measurable benefit.
</decisions>

<canonical_refs>
- `.planning/v1.2-security/research/attack-surface.md` §F-03, §F-04, §F-10
- `.planning/v1.2-security/research/auth-access-control.md` §A-01, §A-03, §A-05, §A-06, §A-08
- `lib/actions/*.ts` — server action surface
- `lib/schedule-overrides.ts` — exemplar of pb.filter pattern
- `pocketbase/pb_migrations/1714867200_completions.js` — exemplar of body-check rule
- `pocketbase/pb_migrations/1745280003_reschedule_marker.js` — last additive migration
</canonical_refs>

<deferred>
- Rate limits (Phase 25)
- Full audit log of admin actions (v1.3+)
- MFA for admin (v1.3+)
</deferred>

---

*Phase: 23-code-attack-surface-sweep*
