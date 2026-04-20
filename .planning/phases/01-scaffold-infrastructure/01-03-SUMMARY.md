---
phase: 01-scaffold-infrastructure
plan: 03
subsystem: infra
tags: [s6-overlay, s6-rc, longrun, process-supervision, caddy, pocketbase, nextjs, s6-setuidgid, signal-propagation]

requires:
  - phase: 01-01
    provides: "project skeleton root used only as a prerequisite marker in the plan wave graph (no direct file dependency in this plan)"
  - phase: 01-02
    provides: "docker/Dockerfile that COPYs docker/s6-rc.d -> /etc/s6-overlay/s6-rc.d and sets ENTRYPOINT /init (s6-overlay v3); HOSTNAME=127.0.0.1 + PORT=3001 ENV for Next.js; /app/data and /app/pb_migrations pre-created and chowned to node:node"
provides:
  - Three longrun s6-rc services under docker/s6-rc.d/ (caddy, pocketbase, nextjs)
  - Per-service shape: type (single-word "longrun"), executable run script, empty dependencies.d/base marker
  - Default user-bundle registration via empty contents.d/{caddy,pocketbase,nextjs} marker files
  - Run-script contract: #!/command/with-contenv sh shebang + single `exec` call, no backgrounding
  - Privilege drop: `exec s6-setuidgid node` prefixes pocketbase and nextjs binaries (Pitfall #9)
  - Caddy stays root by design (static Go binary, unprivileged bind to :3000, ingress tier)
  - PocketBase binds 127.0.0.1:8090 (loopback only) with --dir=/app/data/pb_data, --migrationsDir=/app/pb_migrations
  - Next.js execs `node server.js` from /app WORKDIR, inheriting HOSTNAME/PORT from Dockerfile ENV
  - Parallel startup (no dependencies.d/* between services) -- Caddy retries upstreams, HEALTHCHECK start-period=30s absorbs 502s
affects: [01-04, 01-05, 01-06, 01-07, phase-7-compose-variants]

tech-stack:
  added:
    - s6-overlay-v3-service-tree (declarative /etc/s6-overlay/s6-rc.d layout)
  patterns:
    - "s6-overlay v3 longrun service: type file + exec-terminated run script + empty dependencies.d/base (RESEARCH.md §Pattern 2)"
    - "Privilege drop via s6-setuidgid wrapper per-service rather than a USER directive -- lets s6 run as PID 1 (root) for signal management while services drop to UID 1000"
    - "Parallel service startup with HEALTHCHECK absorbing transient 502s (no explicit dependencies.d ordering)"
    - "Default `user` bundle registration via empty marker files under contents.d/"

key-files:
  created:
    - docker/s6-rc.d/caddy/type
    - docker/s6-rc.d/caddy/run
    - docker/s6-rc.d/caddy/dependencies.d/base
    - docker/s6-rc.d/pocketbase/type
    - docker/s6-rc.d/pocketbase/run
    - docker/s6-rc.d/pocketbase/dependencies.d/base
    - docker/s6-rc.d/nextjs/type
    - docker/s6-rc.d/nextjs/run
    - docker/s6-rc.d/nextjs/dependencies.d/base
    - docker/s6-rc.d/user/contents.d/caddy
    - docker/s6-rc.d/user/contents.d/pocketbase
    - docker/s6-rc.d/user/contents.d/nextjs
  modified: []

key-decisions:
  - "All three services start in parallel (no dependencies.d/<peer> entries) -- Caddy's reverse_proxy retries upstreams during the ~1-2s startup window, and Docker HEALTHCHECK start-period=30s (set in 01-02) absorbs any transient 502s; matches RESEARCH.md §Pattern 2 and CONTEXT A3 assumption"
  - "Caddy stays root (no s6-setuidgid wrapper) per threat register T-01-03-03 (accept) -- static Go binary, minimal attack surface, unprivileged bind to :3000, revisit in Phase 7 hardening"
  - "PocketBase and Next.js each get `exec s6-setuidgid node <binary>` -- drops to UID 1000 (node user) which owns /app/data (chowned in 01-02 Dockerfile), mitigating threats T-01-03-01 and T-01-03-02"

patterns-established:
  - "s6 run script shape: shebang `#!/command/with-contenv sh` + optional `cd` + single `exec` line (no trap, no `&`, no while-loops) -- s6 supervises the binary directly"
  - "Bundle registration pattern: empty file at `<bundle>/contents.d/<service>` -- any future services (ntfy listener, backup-cron) follow the same template"

requirements-completed:
  - INFR-01

duration: 1min
completed: 2026-04-20
---

# Phase 01 Plan 01-03: s6-overlay v3 Service Tree Summary

**Three longrun services (caddy, pocketbase, nextjs) under docker/s6-rc.d/ with `s6-setuidgid node` privilege-drop for Next.js and PocketBase, default-user-bundle registration, and parallel-start semantics per RESEARCH.md §Pattern 2.**

## Performance

- **Duration:** ~1 min (77 s wall-clock)
- **Started:** 2026-04-20T21:41:45Z
- **Completed:** 2026-04-20T21:43:02Z
- **Tasks:** 1
- **Files created:** 12
- **Files modified:** 0

## Accomplishments

- Twelve files under `docker/s6-rc.d/` implementing the s6-overlay v3 service tree the Dockerfile (01-02) expects to COPY to `/etc/s6-overlay/s6-rc.d/`.
- Three `longrun` services declared -- caddy, pocketbase, nextjs -- each with the v3 triad (`type`, `run`, `dependencies.d/base`).
- All three `run` scripts use the exact `#!/command/with-contenv sh` shebang that s6-overlay v3 ships at `/command/with-contenv`, end in a single `exec` call, and contain no backgrounded processes (no `&`, no subshells, no trap handlers) -- signal propagation is guaranteed.
- Privilege model per threat register: **Caddy root** (T-01-03-03 accept -- static Go binary, ingress tier), **PocketBase `exec s6-setuidgid node pocketbase serve ...`** (T-01-03-01 mitigate), **Next.js `exec s6-setuidgid node node server.js`** (T-01-03-02 mitigate). Only PB and Next drop privileges; `grep -c 's6-setuidgid' docker/s6-rc.d/caddy/run` = 0 as required.
- Port/path contract respected: PocketBase `--http=127.0.0.1:8090` (loopback only), `--dir=/app/data/pb_data` (on the volume chowned to node:node in 01-02), `--migrationsDir=/app/pb_migrations` (pre-created in 01-02). Next.js execs `node server.js` from `/app` (WORKDIR set in 01-02), inheriting `HOSTNAME=127.0.0.1 PORT=3001` from 01-02's ENV. Caddy `run --config /etc/caddy/Caddyfile --adapter caddyfile` (Caddyfile lands in 01-04).
- All services registered in the default `user` bundle via empty marker files: `ls docker/s6-rc.d/user/contents.d | sort | tr '\n' ','` returns exactly `caddy,nextjs,pocketbase,`.
- Parallel-start decision honoured: zero `dependencies.d/<peer>` entries. Caddy's `reverse_proxy` retries upstreams during the ~1-2 s start-up window, and the 01-02 HEALTHCHECK `start-period=30s` absorbs any transient 502 (RESEARCH.md §Pattern 2).

## Task Commits

Each task was committed atomically on `master`:

1. **Task 1: Create s6-overlay service tree with three longrun services and user-bundle registration** -- `f9b8ead` (feat)

_No TDD in this plan; single task is a static-file deliverable verified by 26 acceptance-criteria greps + the plan's `<verification>` static block._

## Files Created/Modified

- `docker/s6-rc.d/caddy/type` -- 1 line: `longrun`
- `docker/s6-rc.d/caddy/run` -- 2 lines: `#!/command/with-contenv sh` + `exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile` (chmod 0755, no s6-setuidgid -- root by design)
- `docker/s6-rc.d/caddy/dependencies.d/base` -- 0 bytes (empty marker depending on s6 base bundle)
- `docker/s6-rc.d/pocketbase/type` -- 1 line: `longrun`
- `docker/s6-rc.d/pocketbase/run` -- 5 lines: shebang + `exec s6-setuidgid node pocketbase serve \` + three `\`-continued flag lines (`--http=127.0.0.1:8090`, `--dir=/app/data/pb_data`, `--migrationsDir=/app/pb_migrations`) (chmod 0755)
- `docker/s6-rc.d/pocketbase/dependencies.d/base` -- 0 bytes
- `docker/s6-rc.d/nextjs/type` -- 1 line: `longrun`
- `docker/s6-rc.d/nextjs/run` -- 3 lines: shebang + `cd /app` + `exec s6-setuidgid node node server.js` (chmod 0755)
- `docker/s6-rc.d/nextjs/dependencies.d/base` -- 0 bytes
- `docker/s6-rc.d/user/contents.d/caddy` -- 0 bytes (registers caddy in default user bundle)
- `docker/s6-rc.d/user/contents.d/pocketbase` -- 0 bytes
- `docker/s6-rc.d/user/contents.d/nextjs` -- 0 bytes

## Decisions Made

- **Followed plan exactly.** The `<action>` block prescribed every file byte-for-byte (shebangs, flag strings, chmod state, empty-marker semantics); there was nothing to interpret and no gap between `<action>`, `<verify>`, and `<acceptance_criteria>` -- all 26 acceptance criteria passed on first run without adjustment.
- **No `dependencies.d/<peer>` entries added.** Followed the plan's explicit "Do NOT create a `dependencies.d/caddy` or `dependencies.d/pocketbase` entry anywhere" instruction. Caddy's retry behaviour + HEALTHCHECK start-period handle start-up races (per CONTEXT A3 assumption, validated in RESEARCH.md §Pattern 2).
- **Kept `cd /app` in `nextjs/run`** even though the Dockerfile sets `WORKDIR /app`. Belt-and-braces: if a future operator runs `docker run --workdir /` to override WORKDIR, the service-level `cd` keeps `node server.js` finding the right CWD. Zero runtime cost, and it matches RESEARCH.md §Pattern 2's example verbatim.

## Deviations from Plan

None -- plan executed exactly as written.

The `<action>` block specified every file's contents character-by-character; the `<verify>` block was a 12-condition conjunction; the `<acceptance_criteria>` block listed 26 independent greps/stat-checks. All three gates passed on the first attempt without any auto-fix.

**Total deviations:** 0 (no Rule 1/2/3/4 invocations).
**Impact on plan:** None.

## Issues Encountered

None. The plan's inter-reference consistency (must_haves.artifacts <-> action block <-> acceptance_criteria <-> verification static block) was tight, and the 12 files are entirely static -- no build, no network, no daemon, no state.

## Known Gaps (deferred to later plans)

- **No runtime boot validation in this plan.** The plan's `<verification>` block explicitly defers `docker build` + `docker run` smoke tests to 01-06 CI (which also requires 01-04's Caddyfile). Static analysis (`grep`, `test -x`, `test ! -s`) is the strongest gate available at this wave position -- all 26 acceptance criteria plus the plan `<verify>` block plus the plan `<verification>` static block all pass green.
- **`s6-setuidgid` binary availability.** We assume it's present because s6-overlay v3 ships it as part of the `s6` bundle (`/command/s6-setuidgid` symlinks to the s6 helper). The Dockerfile (01-02) installs the full s6-overlay 3.2.2.0 tarball (noarch + arch), which bundles `s6-setuidgid`. If 01-06's first real `docker run` exposes that the path is different (e.g. missing from PATH under s6's env), the fallback per the plan's `<output>` guidance is to use `gosu` instead. This is a build-time verification that 01-06 will catch -- not a concern right now because the tarball contents are pinned via sha256 checksum in 01-02's Dockerfile.
- **`dependencies.d/base` is literally zero bytes.** s6-overlay v3 treats an empty file as "depend on the base bundle" (confirmed in RESEARCH.md §Pattern 2 and upstream README). If 01-06 runtime testing reveals s6 wants a single-word literal `base` inside the file instead (upstream docs are ambiguous on tolerance), the fix is `printf 'base\n' > docker/s6-rc.d/<svc>/dependencies.d/base` -- trivial, no schema change. Flagging so 01-06 can verify.

## User Setup Required

None -- no external service configuration, no credentials, no environment variables. All 12 files are inert on disk until 01-02's Dockerfile COPYs them into the image at build time.

## Threat Surface Scan

All six threat-register entries in the plan's `<threat_model>` are addressed:

| ID | Disposition | Addressed in this plan |
|----|-------------|----|
| T-01-03-01 | mitigate | Yes -- `exec s6-setuidgid node pocketbase serve` in `docker/s6-rc.d/pocketbase/run` |
| T-01-03-02 | mitigate | Yes -- `exec s6-setuidgid node node server.js` in `docker/s6-rc.d/nextjs/run` |
| T-01-03-03 | accept (phase 1) | Caddy stays root by design; documented above, revisit in Phase 7 |
| T-01-03-04 | mitigate | Yes -- `longrun` services auto-restart on non-zero exit (s6-overlay default; no config needed) |
| T-01-03-05 | mitigate | Yes -- s6 propagates SIGTERM to all services, PocketBase handles it (upstream WAL checkpoint behaviour); validated in RESEARCH.md §Pattern 2 |
| T-01-03-06 | accept (phase 1) | `/app/pb_migrations` is empty in phase 1; populated via PR review in phase 2 |

**No new threat surface introduced beyond the plan's register.** No new network endpoints (all three services bind where the plan says -- Caddy :3000 public, Next.js 127.0.0.1:3001, PocketBase 127.0.0.1:8090). No new auth paths. No new filesystem surface (writes confined to `/app/data/pb_data` and `/app/.next/cache`, both owned by `node:node` per 01-02 Dockerfile).

## Next Phase Readiness

Ready for 01-04 (Caddyfile) to land as the remaining wave-1 sibling, after which 01-06 CI can exercise the full `docker buildx build` + `docker run` smoke test:

- **01-04 contract honoured:** `docker/s6-rc.d/caddy/run` passes `--config /etc/caddy/Caddyfile` -- 01-04 must create `docker/Caddyfile` (which 01-02's Dockerfile COPYs to `/etc/caddy/Caddyfile`). Caddy 2.11.2 binary is already provisioned by 01-02.
- **Port contract honoured:** Caddy listens on :3000 (public, matches 01-02 EXPOSE), proxies `/api/*` + `/_/` -> PocketBase 127.0.0.1:8090, everything else -> Next.js 127.0.0.1:3001. Both backends bind loopback only, so only Caddy is reachable from outside the container.
- **01-06 readiness:** With 01-03 + 01-04 both landed, 01-06's `docker buildx build --platform linux/amd64 -t homekeep:test -f docker/Dockerfile . --load` will have every filesystem dependency it needs. The HEALTHCHECK `start-period=30s` + Caddy's retry behaviour + s6's supervision will combine to absorb the parallel-start window.
- **/app/pb_migrations empty ok:** 01-02 pre-creates it as an empty directory, and `pocketbase serve --migrationsDir=/app/pb_migrations` with zero migrations is a no-op at boot (no schema changes applied until phase 2 populates it).
- **SIGTERM path:** Docker stop -> s6 PID 1 -> SIGTERM to all three services in reverse dependency order -> PocketBase checkpoints SQLite WAL -> clean exit. No custom `finish` script needed for phase 1 (revisit if phase 7 adds e.g. backup snapshots on shutdown).

## Self-Check: PASSED

Verified claims on disk (2026-04-20T21:43:00Z):

- `test -d docker/s6-rc.d/caddy && test -d docker/s6-rc.d/pocketbase && test -d docker/s6-rc.d/nextjs && test -d docker/s6-rc.d/user/contents.d` -- all exist.
- All 12 files present under `docker/s6-rc.d/` matching the frontmatter `files_modified` list exactly.
- `test -x docker/s6-rc.d/{caddy,pocketbase,nextjs}/run` -- all three run scripts are executable (mode 0755).
- `head -n 1 docker/s6-rc.d/{caddy,pocketbase,nextjs}/run` -- all three equal the exact string `#!/command/with-contenv sh`.
- `grep -Fxq 'longrun' docker/s6-rc.d/{caddy,pocketbase,nextjs}/type` -- all three type files match.
- `test ! -s` passes for all 6 empty marker files (3 `dependencies.d/base` + 3 `user/contents.d/*`).
- All 26 Task 1 acceptance criteria pass (verified via scripted run -- 0 failures).
- Plan `<verify>` block (12-condition conjunction) passes.
- Plan `<verification>` static block: `grep -l '^longrun' docker/s6-rc.d/*/type | wc -l` = 3, executable count = 3, `grep -c 's6-setuidgid' docker/s6-rc.d/pocketbase/run docker/s6-rc.d/nextjs/run` = 2, `grep -c 's6-setuidgid' docker/s6-rc.d/caddy/run` = 0, `ls docker/s6-rc.d/user/contents.d | sort | tr '\n' ','` = `caddy,nextjs,pocketbase,`.
- Commit `f9b8ead` (Task 1) present in `git log --oneline` on master.

---
*Phase: 01-scaffold-infrastructure*
*Completed: 2026-04-20*
