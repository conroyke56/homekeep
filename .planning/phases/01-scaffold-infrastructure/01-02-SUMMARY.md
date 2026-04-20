---
phase: 01-scaffold-infrastructure
plan: 02
subsystem: infra
tags: [docker, alpine, s6-overlay, caddy, pocketbase, multi-arch, dockerfile]

requires:
  - phase: 01-01
    provides: ".next/standalone build output, public/ dir, package.json with docker:build/docker:run scripts — Dockerfile builder stage COPYs from these"
provides:
  - Multi-stage Dockerfile (deps -> builder -> runtime) on node:22-alpine
  - Multi-arch scaffold via TARGETARCH -> S6_ARCH / PB_ARCH case mapping (amd64, arm64)
  - Checksum-verified binaries: s6-overlay 3.2.2.0 (noarch + arch), PocketBase 0.37.1
  - Caddy 2.11.2 binary sourced from the official caddy:2.11.2-alpine image
  - Single EXPOSE 3000 + single VOLUME /app/data (INFR-01 + INFR-04)
  - HEALTHCHECK curling 127.0.0.1:3000/api/health (single-line so acceptance grep matches)
  - HOSTNAME=127.0.0.1 + PORT=3001 + S6_KEEP_ENV=1 + S6_BEHAVIOUR_IF_STAGE2_FAILS=2
  - /app/data chowned to node:node (Pitfall #9)
  - /app/pb_migrations pre-created so 01-03 pocketbase run script has a dir to reference
  - Zero secret ARGs, zero NEXT_PUBLIC_* (INFR-10 + Pitfall #3)
  - .dockerignore excluding node_modules/.next/.git/.env/data/.pb/coverage/test-results/.planning — keeps docker/ in build context
  - scripts/check-image-size.sh — enforces 300MB ceiling per INFR-03
  - scripts/check-multiarch.sh — asserts linux/amd64 + linux/arm64 in pushed manifest per INFR-02
affects: [01-03, 01-04, 01-05, 01-06, 01-07, phase-7-compose-variants]

tech-stack:
  added:
    - docker-alpine-node@22
    - s6-overlay@3.2.2.0
    - pocketbase-binary@0.37.1
    - caddy@2.11.2 (via caddy:2.11.2-alpine image)
  patterns:
    - "Three-stage Dockerfile: deps (lockfile-only npm ci) -> builder (next build) -> runtime (Alpine + s6 + caddy + pb + next standalone)"
    - "TARGETARCH -> per-project arch name mapping (x86_64/aarch64 for s6, amd64/arm64 for PB)"
    - "Checksum verification gate on every externally downloaded artifact (sha256sum -c x3)"
    - "HEALTHCHECK on single line so acceptance-criteria grep and must_haves.key_links pattern both match"
    - "POSIX /bin/sh scripts with set -eu and CLI-defaulted positional args"

key-files:
  created:
    - docker/Dockerfile
    - .dockerignore
    - scripts/check-image-size.sh
    - scripts/check-multiarch.sh
  modified: []

key-decisions:
  - "Collapsed HEALTHCHECK and CMD onto one line so the plan's own acceptance grep pattern `HEALTHCHECK.*curl.*127.0.0.1:3000/api/health` matches — the plan's `<action>` block used backslash line-continuation which breaks single-line grep; this collapse is a pure Rule 1 fix with no functional change (Docker treats `HEALTHCHECK \\<NL>  CMD ...` and `HEALTHCHECK ... CMD ...` identically)"
  - "Used `docker buildx build --check -f docker/Dockerfile .` instead of a full `docker build` as the runnable sanity gate — full build is explicitly deferred in plan <verification> until 01-03/01-04 land (the runtime stage COPYs docker/Caddyfile and docker/s6-rc.d, which don't exist yet); --check validated Dockerfile syntax, stage references, and base-image availability without needing those files"

patterns-established:
  - "Plan-level HEALTHCHECK discipline: single-line form so both Docker and verification grep pass"
  - "Checksum-verified supply chain: every ADD/curl of an external tarball is paired with sha256sum -c against publisher-provided .sha256 or checksums.txt"
  - "CI helper scripts live under scripts/ and are POSIX sh + executable + arg-defaulted, so they run identically on dev/macOS/Linux CI"

requirements-completed:
  - INFR-01
  - INFR-02
  - INFR-03
  - INFR-04
  - INFR-10

duration: 3min
completed: 2026-04-20
---

# Phase 01 Plan 01-02: Multi-Arch Dockerfile + Image-Size/Multiarch Helpers Summary

**Three-stage multi-arch Dockerfile (Next.js standalone + PocketBase 0.37.1 + Caddy 2.11.2 + s6-overlay 3.2.2.0) with checksum-verified supply chain, plus POSIX-sh helpers enforcing the 300MB ceiling (INFR-03) and the linux/amd64+linux/arm64 manifest guarantee (INFR-02).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-20T21:34:21Z
- **Completed:** 2026-04-20T21:37:09Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 0

## Accomplishments

- `docker/Dockerfile` (100 lines, exceeds min_lines=80): three stages — `deps` (npm ci only), `builder` (`next build` -> `.next/standalone`), `runtime` (Alpine + xz/ca-certificates/tzdata/curl/unzip, s6-overlay noarch + arch tarballs, Caddy copied from `caddy:2.11.2-alpine`, PocketBase unzipped into `/usr/local/bin/`, Next.js standalone + explicit `public/` and `.next/static/` copies per Pitfall #2).
- All three Pattern-1 invariants encoded: `EXPOSE 3000` (once), `VOLUME ["/app/data"]` (once), `ENTRYPOINT ["/init"]` (s6-overlay v3 stage-1 init).
- Security gate is live: zero `*_TOKEN`/`*_KEY`/`*_SECRET` ARGs, zero `NEXT_PUBLIC_*` anywhere, three `sha256sum -c` invocations (s6 noarch + s6 arch + PocketBase zip checksums parsed out of `checksums.txt`), `/app/data` chowned to `node:node`.
- `.dockerignore` excludes everything the spec calls out (node_modules, .next, .git, .github, .env.*, data, .pb, coverage, playwright-report, test-results, *.md except README, .planning, editor dirs) while pointedly *not* excluding `docker/` — the Dockerfile COPYs `docker/Caddyfile` and `docker/s6-rc.d` at build time, so `docker/` must remain in context.
- `scripts/check-image-size.sh` + `scripts/check-multiarch.sh`: both are `#!/bin/sh` + `set -eu`, executable, CLI-arg defaulted, POSIX-valid (`sh -n` clean), enforce `LIMIT=300` and the `linux/amd64`+`linux/arm64` manifest guarantee respectively.
- `docker buildx build --check -f docker/Dockerfile .` returned **"Check complete, no warnings found"** — static syntax, base-image availability (`node:22-alpine`, `caddy:2.11.2-alpine`), stage references, and .dockerignore all validate. Full build is deferred per plan `<verification>` until 01-03/01-04 land (they provide `docker/Caddyfile` and `docker/s6-rc.d`).

## Task Commits

Each task was committed atomically on `master`:

1. **Task 1: Write multi-stage Dockerfile and .dockerignore** — `16c1a1f` (feat)
2. **Task 2: Helper scripts for image-size and multi-arch manifest validation** — `8c8f57c` (feat)

_No TDD in this plan; both tasks are config/tooling deliverables with static-verification acceptance criteria._

## Files Created/Modified

- `docker/Dockerfile` — 100 lines, three-stage multi-arch build; matches RESEARCH.md §Pattern 1 with the plan's three corrections (unzip in apk line, `mkdir -p /app/pb_migrations`, no trailing blank lines after ENTRYPOINT) plus a one-line HEALTHCHECK collapse (see Deviations).
- `.dockerignore` — excludes secrets/large dirs, preserves docker/ build context.
- `scripts/check-image-size.sh` — `docker inspect <image>` -> bytes -> MB; exits non-zero if > 300.
- `scripts/check-multiarch.sh` — `docker buildx imagetools inspect <image>` -> greps for `linux/amd64` and `linux/arm64`, exits non-zero if either missing.

## Decisions Made

- **Single-line HEALTHCHECK.** The plan's own `acceptance_criteria` enforces `grep -q 'HEALTHCHECK.*curl.*127.0.0.1:3000/api/health'`, and the `<must_haves.key_links>` pattern `"HEALTHCHECK.*curl.*3000/api/health"` assumes a single line. The plan's `<action>` block, however, showed `HEALTHCHECK --interval=... \` with the `CMD curl ...` on the next line. Writing it literally (multi-line via backslash) failed the single-line grep. Collapsed to one line — Docker parses the two forms identically (backslash is shell line-continuation inside the Dockerfile parser) so image behaviour is unchanged. Classified as Rule 1 (bug fix to satisfy acceptance criteria the plan itself declared authoritative).
- **No full `docker build` in this plan.** Plan `<verification>` explicitly defers the full build to 01-06 CI because the runtime stage's `COPY docker/Caddyfile /etc/caddy/Caddyfile` and `COPY docker/s6-rc.d /etc/s6-overlay/s6-rc.d` require files that 01-04 and 01-03 produce respectively — neither has landed. Substituted `docker buildx build --check` (static-only syntax/reference analysis) as the strongest runnable sanity gate available at this wave's position. Result: "Check complete, no warnings found."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] HEALTHCHECK line-continuation broke acceptance grep**
- **Found during:** Task 1 (acceptance-criteria replay)
- **Issue:** The plan's verbatim `<action>` code block wrote HEALTHCHECK with `\` line-continuation — the CMD ended up on its own line. Two of the plan's own authoritative patterns (`acceptance_criteria` grep and `must_haves.key_links`) require a single-line match.
- **Fix:** Collapsed the HEALTHCHECK directive onto one line. Semantically identical at Dockerfile-parser level (backslash is a syntactic line-joiner there). The functional behaviour of the HEALTHCHECK — interval 30s, timeout 5s, start-period 30s, retries 3, `curl -fsS http://127.0.0.1:3000/api/health || exit 1` — is unchanged.
- **Files modified:** `docker/Dockerfile` (line 98 collapsed from 2 lines to 1).
- **Verification:** `grep -q 'HEALTHCHECK.*curl.*127.0.0.1:3000/api/health' docker/Dockerfile` now returns 0 (PASS). All 28 acceptance criteria green, plan `<verify>` block green, plan `<verification>` static block green.
- **Committed in:** `16c1a1f` (Task 1 commit — issue found and fixed before the Task 1 commit landed).

---

**Total deviations:** 1 auto-fixed (Rule 1 × 1 — consistency fix between plan's action block and plan's acceptance criteria).
**Impact on plan:** Zero semantic impact. The fix reconciles two authoritative sections of the plan that disagreed on HEALTHCHECK formatting; the chosen form matches the acceptance gate and is byte-for-byte equivalent to Docker.

## Issues Encountered

- Plan's verbatim `<action>` block vs. `acceptance_criteria` disagreement on HEALTHCHECK format — handled inline as Rule 1 (see Deviations).
- Docker daemon is present locally (v29.3.1 c2be9cc), so `docker buildx build --check` was available as a static gate. A full `docker build` was NOT attempted because the Dockerfile references `docker/Caddyfile` and `docker/s6-rc.d/` which land in 01-04 and 01-03 — plan `<verification>` explicitly says full build is a 01-06 CI concern.

## Known Gaps (for 01-06 + phase verification)

- **Full `docker build` not yet exercised in this plan.** Plan `<verification>` defers it to after 01-03 + 01-04 have landed. 01-06 CI workflow will run `docker buildx build --platform linux/amd64 -t homekeep:test -f docker/Dockerfile . --load` and then `sh scripts/check-image-size.sh homekeep:test` — that is the first end-to-end validation moment. Static analysis (`buildx --check`) returned clean, base images resolve, so the build is expected to succeed once 01-03/01-04 deliver their filesystem contributions.
- **`caddy:2.11.2-alpine` publish lifetime.** We pin the Caddy binary via `COPY --from=caddy:2.11.2-alpine /usr/bin/caddy`. Docker Hub retains official image tags indefinitely (caddy is a Docker Official Image), so this is not a concern for the v1 release window, but if 01-06's release workflow runs years from now and the tag has been garbage-collected, the build will fail. Mitigation path: pin by digest (`caddy:2.11.2-alpine@sha256:...`) in 01-06 or vendor the binary directly via GitHub release + sha256sum. Not a phase-1 blocker — flagging so 01-06 can weigh in.
- **`node:22-alpine` is a floating Node 22.x tag.** Same story: Docker Hub won't remove it, but the patch version drifts. For v1 reproducibility this is acceptable; post-v1, consider pinning to a specific digest in release workflows.

## User Setup Required

None — no external service configuration. The Dockerfile downloads s6-overlay and PocketBase from their public GitHub releases and verifies checksums at build time. No GHCR/Docker Hub credentials are needed to build the image locally (only 01-06's release workflow needs GHCR auth, via `GITHUB_TOKEN`).

## Threat Surface Scan

No new threat surface beyond what `<threat_model>` covered. All six register entries are either mitigated in this plan (T-01-02-01 checksums, T-01-02-02 no secret ARGs, T-01-02-03 no NEXT_PUBLIC_*, T-01-02-05 check-image-size.sh, T-01-02-06 check-multiarch.sh) or explicitly accepted for phase 1 (T-01-02-04: s6 runs as root PID 1; per-service `setuidgid` to `node` is 01-03's responsibility via run scripts).

No new network endpoints, no new auth paths, no new file-system surface outside `/app/data` (single VOLUME already in register).

## Next Phase Readiness

Ready for 01-03 (s6 service tree) and 01-04 (Caddyfile), which land in parallel as wave-1 siblings:

- Dockerfile expects `docker/s6-rc.d/{caddy,pocketbase,nextjs}/{type,run,dependencies.d/base}` plus `docker/s6-rc.d/user/contents.d/{caddy,pocketbase,nextjs}` — that is 01-03's deliverable.
- Dockerfile expects `docker/Caddyfile` with `handle /api/health` → Next.js before `handle /api/*` → PocketBase (Pitfall #8 ordering) — that is 01-04's deliverable.
- Internal port contract: Caddy 3000 (public), Next.js 3001 (loopback via `HOSTNAME=127.0.0.1 PORT=3001`), PocketBase 8090 (loopback). Both 01-03 and 01-04 must honour these exact ports.
- `/app/pb_migrations` exists at runtime (pre-created as empty dir) — 01-03's pocketbase run script can safely pass `--migrationsDir=/app/pb_migrations` without an existence check.
- `/app/data/pb_data/` exists and is `node:node`-owned — 01-03's pocketbase service can `s6-setuidgid node pocketbase serve ...` against it.

Once 01-03 and 01-04 both land, 01-06 CI can run the full `docker buildx build` + `sh scripts/check-image-size.sh homekeep:test`.

## Self-Check: PASSED

Verified claims on disk (2026-04-20T21:37:09Z):

- `test -f docker/Dockerfile` — exists (100 lines).
- `test -f .dockerignore` — exists.
- `test -x scripts/check-image-size.sh` — exists + executable.
- `test -x scripts/check-multiarch.sh` — exists + executable.
- Commits `16c1a1f` (Task 1) and `8c8f57c` (Task 2) present in `git log --oneline` on master.
- All 28 Task 1 acceptance criteria + all 14 Task 2 acceptance criteria pass (42 total).
- `docker buildx build --check -f docker/Dockerfile .` returns "Check complete, no warnings found."
- Plan `<verification>` static block passes (FROM×3, EXPOSE×1, VOLUME×1, ENTRYPOINT, sha256sum×3, no NEXT_PUBLIC_, no secret ARG/ENV).

---
*Phase: 01-scaffold-infrastructure*
*Completed: 2026-04-20*
