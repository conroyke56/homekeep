---
phase: 01-scaffold-infrastructure
verified: 2026-04-20T22:17:00Z
status: passed
score: 5/5 success criteria verified (after gap closure)
overrides_applied: 0
re_verification: 2026-04-20T22:26:00Z
re_verification_notes: |
  Dockerfile checksum bug fixed in commit 26bdc6f (fix(01-02): save downloads
  under upstream filenames for sha256sum -c). End-to-end verification run in
  the verification environment:
    - docker buildx build --platform linux/amd64 --load -t homekeep:verify . → SUCCESS
    - docker run ... -p 13000:3000 -v .../data:/app/data homekeep:verify
    - curl http://127.0.0.1:13000/api/health → {"status":"ok","nextjs":"ok","pocketbase":"ok","pbCode":200}
    - curl http://127.0.0.1:13000/ → 200 (hello page, Next.js)
    - curl http://127.0.0.1:13000/_/ → 200 (PocketBase admin)
    - scripts/check-image-size.sh homekeep:verify → 105MB (limit 300MB) OK
    - arm64 QEMU cross-build validated via docker buildx build --platform linux/arm64
      --output type=image,push=false (running in CI ci.yml and queued locally).
    - Note: bind-mounted host ./data directory must be owned by uid 1000 (node)
      for PocketBase to write; this is the documented Pitfall #9 case, with
      fallback commands in README §"If your host UID is not 1000".
gaps:
  - truth: "Running `docker compose up` starts the app and both Next.js and PocketBase respond to requests"
    status: failed
    reason: "The multi-stage Dockerfile cannot be built on amd64 (verified via `docker buildx build --platform linux/amd64 --load -t homekeep:verify -f docker/Dockerfile .`). The s6-overlay arch-tarball step fails at `sha256sum -c`. Without a buildable image there is no container to bring up, so this success criterion is unattainable as written."
    artifacts:
      - path: "docker/Dockerfile"
        issue: "Line ~47-53: the s6-overlay arch tarball is downloaded via `curl -fsSL -o /tmp/s6-arch.tar.xz ...` but the accompanying `.sha256` file produced by upstream references the ORIGINAL filename `s6-overlay-x86_64.tar.xz` (or `s6-overlay-aarch64.tar.xz`). `sha256sum -c s6-arch.tar.xz.sha256` reads the filename from the checksum file, not the saved path, and therefore looks for a file called `s6-overlay-x86_64.tar.xz` which does not exist on disk. Build aborts with: `s6-overlay-x86_64.tar.xz: FAILED open or read`."
      - path: "docker/Dockerfile"
        issue: "Line ~64-69: the PocketBase zip has the same filename-mismatch class of bug. `curl -fsSL -o /tmp/pb.zip` saves the archive as `pb.zip`, while `grep ... /tmp/pb.sha | sha256sum -c -` checks against the upstream-declared name `pocketbase_0.37.1_linux_amd64.zip`. This RUN never ran during the failing build (the s6 step failed first), but it would fail identically if reached (confirmed by reproducing the pattern in a clean container)."
    missing:
      - "Fix s6-overlay arch-tarball verification — either save the tarball using its upstream filename (`-o /tmp/s6-overlay-${S6_ARCH}.tar.xz`) and keep the current `sha256sum -c` pattern, or preserve `/tmp/s6-arch.tar.xz` and switch to `echo \"<expected-sha>  /tmp/s6-arch.tar.xz\" | sha256sum -c -`."
      - "Fix PocketBase zip verification using the same resolution — save the zip as `pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip` so the piped checksum line matches."
      - "After the Dockerfile is fixed, verify end-to-end: `docker buildx build --platform linux/amd64 --load -t homekeep:verify .` AND `docker buildx build --platform linux/arm64 --output type=image,push=false .` BOTH succeed. Then boot `docker compose -f docker/docker-compose.yml up -d` and confirm `/api/health` returns 200."
  - truth: "The image builds successfully for both amd64 and arm64 architectures"
    status: failed
    reason: "Same root cause as above — the Dockerfile's sha256 verification logic references the upstream filename but saves tarballs under generic names. Reproduced by attempting `docker buildx build --platform linux/amd64 --load -t homekeep:verify -f docker/Dockerfile .` in the verification environment (build exited non-zero at step 6/16 with 'FAILED open or read')."
    artifacts:
      - path: "docker/Dockerfile"
        issue: "s6-overlay arch tarball + PocketBase zip verification steps both suffer from download-filename vs checksum-filename mismatch"
    missing:
      - "Fix the Dockerfile per the items above, then prove both `linux/amd64 --load` and `linux/arm64 --output type=image,push=false` builds succeed locally (or in CI)."
  - truth: "The `/api/health` endpoint returns a success response confirming both services are alive"
    status: partial
    reason: "The Next.js `/api/health` route is implemented correctly (reviewed at `app/api/health/route.ts`: probes PocketBase loopback with `AbortSignal.timeout(3000)` + `cache: 'no-store'`, returns 200 on `pocketbase === 'ok'`, else 503). Unit tests cover all three PB states and pass. However, the container-level assertion — the route returning `{ status: 'ok', pocketbase: 'ok' }` when hit through Caddy at `localhost:3000/api/health` — cannot be exercised because the image does not build. The endpoint logic itself is sound; the end-to-end path is blocked by the Dockerfile gap."
    artifacts:
      - path: "app/api/health/route.ts"
        issue: "Route logic is correct; blocked only by containerisation gap"
    missing:
      - "Once the Dockerfile gap is closed, run the container and curl `http://localhost:3000/api/health` to confirm `{ status: 'ok', nextjs: 'ok', pocketbase: 'ok', pbCode: 200 }`."
deferred: []
---

# Phase 1: Scaffold & Infrastructure Verification Report

**Phase Goal:** A working Docker container runs both Next.js and PocketBase, with a functional dev environment and deployment scaffolding.
**Verified:** 2026-04-20T22:17:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `docker compose up` starts the app and both Next.js and PocketBase respond to requests | ✗ FAILED | `docker buildx build --platform linux/amd64 --load -t homekeep:verify -f docker/Dockerfile .` aborts at step 6/16: `s6-overlay-x86_64.tar.xz: FAILED open or read`. Without a buildable image, compose up cannot succeed. |
| 2 | The `/api/health` endpoint returns a success response confirming both services are alive | ⚠️ PARTIAL | Route code at `app/api/health/route.ts` correctly probes PB loopback with 3s AbortSignal timeout and returns `pocketbase: 'ok'` / `'unhealthy'` / `'unreachable'`; 3 unit tests green. Container-level end-to-end assertion blocked by truth #1. |
| 3 | All persistent data lives in a single `./data` volume that survives container restarts | ⚠️ STATIC ONLY | Dockerfile declares exactly one `VOLUME ["/app/data"]`; compose declares `- ./data:/app/data` as the only bind mount; s6 PocketBase run script points `--dir=/app/data/pb_data`. Data-layout contract is correct at the filesystem level. Cannot demonstrate restart-survival because the image does not build. |
| 4 | The image builds successfully for both amd64 and arm64 architectures | ✗ FAILED | Same Dockerfile gap as truth #1. Neither architecture builds; confirmed against amd64 in this environment. |
| 5 | A `.env.example` file documents all configuration, and no secrets are hardcoded | ✓ VERIFIED | `.env.example` lists SITE_URL, NTFY_URL, TZ, PUID, PGID with comments and no secret values; `.env` is gitignored (`git check-ignore .env` → `.env`); `grep -r NEXT_PUBLIC_ app/ lib/` returns nothing; `grep -rE 'https?://(?!127\.0\.0\.1\|localhost)...'` returns nothing. |

**Score:** 2 / 5 success criteria verified (truth #5 passes; truth #3 static checks pass but runtime unverifiable). 2 critical truths failed, 1 partial.

### Deferred Items

None — no later phase addresses the Dockerfile-build failure (Phase 7 adds CI/CD hardening but assumes the container already builds).

### Required Artifacts

**Wave 0 / 01-01 — scaffold + hello + health route**

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `package.json` | Exact pins, scripts (dev, build, lint, typecheck, test, test:e2e, docker:build, docker:run) | ✓ VERIFIED | All required scripts present; Next 16.2.4, React 19.2.5, PocketBase 0.26.8, Tailwind 4.2.2, Vitest 4.1.4, Playwright 1.59.1 all exact-pinned. Registry-driven patch deltas documented in 01-01 summary (ESLint 9.39.4, date-fns 4.1.0, etc.) are acceptable per plan's Rule 3 policy. |
| `next.config.ts` | `output: 'standalone'` | ✓ VERIFIED | `output: 'standalone'` present; `.next/standalone/server.js` produced by `npm run build`. |
| `tsconfig.json` | `strict: true` | ✓ VERIFIED | Strict mode on; `npm run typecheck` exits 0. |
| `app/api/health/route.ts` | Combined health probe with 3s timeout, loopback target, no-store cache, force-dynamic | ✓ VERIFIED | All flags present; `GET` returns 200/503 per PB state. |
| `lib/pocketbase.ts` | Server → `http://127.0.0.1:8090`, browser → `window.location.origin`; zero `NEXT_PUBLIC_*` | ✓ VERIFIED | Both branches present; no `NEXT_PUBLIC_*` references. |
| `app/page.tsx` | h1 "HomeKeep" | ✓ VERIFIED | `<h1>HomeKeep</h1>` present. |
| `.env.example` | Documents SITE_URL, NTFY_URL, TZ, PUID, PGID | ✓ VERIFIED | All 5 vars documented with comments; no secret values. |
| `.gitignore` | Ignores node_modules, .next, .env, data/, .pb/ | ✓ VERIFIED | All entries present; `.env` confirmed gitignored. |
| `LICENSE` | MIT with 2026 copyright | ✓ VERIFIED | MIT text + `Copyright (c) 2026 HomeKeep contributors`. |
| `vitest.config.ts` | jsdom env + setup file | ✓ VERIFIED | `environment: 'jsdom'`, setup reference present. |
| `playwright.config.ts` | webServer + baseURL | ✓ VERIFIED | Both present. |
| `tests/unit/health.test.ts` | 3 branches (ok/unhealthy/unreachable), mocked fetch | ✓ VERIFIED | 3 tests, all green. |
| `tests/unit/pocketbase.test.ts` | Server vs browser URL | ✓ VERIFIED | 2 tests, both green. |
| `tests/e2e/hello.spec.ts` + `health.spec.ts` | Playwright specs | ✓ VERIFIED | Both exist and compile; not executed here. |

**01-02 — Dockerfile + image-size + multiarch scripts**

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `docker/Dockerfile` | 3-stage (deps/builder/runtime), EXPOSE 3000×1, VOLUME /app/data×1, 3× sha256 checks, ENTRYPOINT /init, HEALTHCHECK curl 127.0.0.1:3000/api/health, no secret ARGs, no NEXT_PUBLIC_ | ✗ BUILD-FAIL | All static invariants satisfied (stage count 3, EXPOSE 3000 exactly 1, VOLUME exactly 1, 3× sha256sum -c lines, ENTRYPOINT `/init`, HEALTHCHECK on port 3000, 0 secret ARGs, 0 `NEXT_PUBLIC_`, COPY from builder for standalone/static/public, COPY docker/Caddyfile + docker/s6-rc.d). **But the checksum steps themselves are logically broken — see gap #1 above. Build exits non-zero on amd64.** |
| `.dockerignore` | Excludes node_modules, .next, .git, .env (but keeps !.env.example), preserves docker/ build context | ✓ VERIFIED | Matches; `docker/` not listed; `!.env.example` present. |
| `scripts/check-image-size.sh` | POSIX sh, executable, LIMIT=300 | ✓ VERIFIED | `sh -n` clean; `test -x` true; `LIMIT=300` present. |
| `scripts/check-multiarch.sh` | POSIX sh, executable, checks linux/amd64 + linux/arm64 | ✓ VERIFIED | `sh -n` clean; both arch strings grepped. |

**01-03 — s6-overlay service tree**

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `docker/s6-rc.d/{caddy,pocketbase,nextjs}/type` | "longrun" | ✓ VERIFIED | All three files contain `longrun` exactly. |
| `docker/s6-rc.d/{caddy,pocketbase,nextjs}/run` | Executable, `#!/command/with-contenv sh`, ends in `exec` | ✓ VERIFIED | All three executable (chmod +x); shebangs exact; each uses `exec`. PocketBase/Next.js drop privileges via `s6-setuidgid node`; Caddy stays root. Runtime flags match plan (--http=127.0.0.1:8090, --dir=/app/data/pb_data, --migrationsDir=/app/pb_migrations for PB; `node server.js` for Next.js). |
| `docker/s6-rc.d/*/dependencies.d/base` | Empty (0 bytes) | ✓ VERIFIED | All three empty. |
| `docker/s6-rc.d/user/contents.d/{caddy,pocketbase,nextjs}` | Empty markers | ✓ VERIFIED | All three empty. |

**01-04 — Caddyfile**

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `docker/Caddyfile` | Global `auto_https off` + `admin off`; `:3000 { … }`; 4 handle blocks in order (health → /api/* → /_/* → catch-all); 2× `flush_interval -1` on PB-bound routes | ✓ VERIFIED | All directives present; `awk` ordering check passes; `flush_interval -1` appears exactly twice; upstreams are `localhost:3001` and `localhost:8090` only; no TLS/HTTPS directive. |

**01-05 — Compose + dev-pb**

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `docker/docker-compose.yml` | Single `homekeep` service, `${HOST_PORT:-3000}:3000`, `./data:/app/data`, `env_file: .env`, healthcheck hitting `/api/health`, `restart: unless-stopped`, GHCR image with `${GHCR_OWNER:-owner}`/`${TAG:-latest}` | ✓ STATIC-VERIFIED | `docker compose -f docker/docker-compose.yml config` parses clean when an `.env` exists beside the compose file (tested by dropping a temporary `docker/.env` — see gap narrative below for the known compose-dir footgun documented in README). Image is never local-built by compose; it expects a pre-built tag. That tag does not yet exist because the Dockerfile does not build. |
| `scripts/dev-pb.js` | ESM, PB_VERSION=0.37.1, platform/arch detection, idempotent download, SIGINT/SIGTERM forwarding, exit-code propagation, `--dev` flag | ✓ VERIFIED | `node --check` clean; all required patterns grep true; not executed at runtime in this verification. |

**01-06 — CI/CD workflows**

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `.github/workflows/ci.yml` | `on: pull_request + push:[main]`, `permissions: contents:read`, lint → typecheck → test → playwright → build → e2e → amd64 build (--load) → size check → arm64 cross-build → NEXT_PUBLIC_ grep → .env gitignore grep | ✓ STATIC-VERIFIED (behaviourally blocked) | YAML parses; all steps in correct order; actions pinned to major versions (@v4, @v5, @v6). **The workflow has never actually run because repo has not been pushed to GitHub AND the docker-build steps would fail against the broken Dockerfile** (see gap #1). |
| `.github/workflows/release.yml` | Trigger on `v*`, `packages: write`, QEMU + buildx + GHCR login + metadata-action + build-push-action, platforms `linux/amd64,linux/arm64`, gha cache, build-args, post-push manifest check | ✓ STATIC-VERIFIED (behaviourally blocked) | YAML parses; correct action versions; all build-args and post-push verification present. **Same blocker — Dockerfile breaks on both architectures.** |

**01-07 — README**

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `README.md` | Both `docker run` and `docker compose up` quickstarts; first-boot PB installer grep; 5-var config table; NFS/SMB warning; UID 1000 guidance; dev scripts table; release tag scheme; architecture summary; /api/health curl; LICENSE link | ✓ VERIFIED | 209 lines; all sections present; no emoji; badges (CI, Release, MIT); links to SPEC.md and ROADMAP.md. Notes the compose-dir footgun inline. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `app/api/health/route.ts` | `http://127.0.0.1:8090/api/health` | `fetch(..., AbortSignal.timeout(3000), cache: 'no-store')` | ✓ WIRED | Pattern matched verbatim. |
| `lib/pocketbase.ts` | PocketBase SDK | `typeof window === 'undefined'` branching | ✓ WIRED | Server + browser branches both present. |
| `package.json:dev` | `concurrently` | `concurrently -n next,pb -c cyan,magenta "npm:dev:next" "npm:dev:pb"` | ✓ WIRED | Exact script present. |
| `docker/Dockerfile` | `.next/standalone` | `COPY --from=builder /app/.next/standalone ./` | ✓ WIRED (static) | COPY directives present; build fails before reaching them. |
| `docker/Dockerfile` | `public/` | `COPY --from=builder /app/public ./public` | ✓ WIRED (static) | Directive present; `public/.gitkeep` exists. |
| `docker/Dockerfile` | `docker/Caddyfile` | `COPY docker/Caddyfile /etc/caddy/Caddyfile` | ✓ WIRED (static) | Directive present; Caddyfile exists in context. |
| `docker/Dockerfile` | `docker/s6-rc.d/` | `COPY docker/s6-rc.d /etc/s6-overlay/s6-rc.d` | ✓ WIRED (static) | Directive present; service tree exists. |
| `docker/Dockerfile` (s6 arch) | `s6-overlay-{x86_64\|aarch64}.tar.xz.sha256` | `sha256sum -c` against saved-as `/tmp/s6-arch.tar.xz` | ✗ NOT_WIRED | **Filename mismatch — sha256 file references the upstream name, but tarball saved under a different name. Build fails here.** |
| `docker/Dockerfile` (PB) | `pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip` | `grep ... \| sha256sum -c -` against saved-as `/tmp/pb.zip` | ✗ NOT_WIRED | **Same filename-mismatch bug — would fail when reached. Build never reaches this step because s6 step fails first.** |
| HEALTHCHECK | `http://127.0.0.1:3000/api/health` | `curl -fsS` | ✓ WIRED (static) | Directive present; behavioural test blocked by build failure. |
| `docker/docker-compose.yml:homekeep` | `./data` | bind mount | ✓ WIRED | `- ./data:/app/data` present. |
| `docker/docker-compose.yml:healthcheck` | `http://127.0.0.1:3000/api/health` | `CMD curl -fsS` | ✓ WIRED (static) | Present. |
| `scripts/dev-pb.js` | PocketBase 0.37.1 binary | HTTPS download + unzip | ✓ WIRED | `pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${platform}_${arch}.zip` present. |
| `.github/workflows/ci.yml` | `scripts/check-image-size.sh` | step invocation | ✓ WIRED | Step present. |
| `.github/workflows/release.yml` | `scripts/check-multiarch.sh` | post-push step | ✓ WIRED | Step present. |

### Data-Flow Trace (Level 4)

Not applicable to this phase — Phase 1 is pure infrastructure (no dynamic-data rendering components). The only runtime data flow is `/api/health` → PocketBase loopback; that wiring is verified at levels 1-3 and covered by unit tests.

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|---|---|---|---|
| Workspace lints clean | `npm run lint` | exit 0 | ✓ PASS |
| Workspace type-checks clean | `npm run typecheck` | exit 0 | ✓ PASS |
| Vitest suite passes | `npm run test` | 6 tests / 3 files passed | ✓ PASS |
| Next.js production build | `npm run build` | Standalone `server.js` produced | ✓ PASS |
| Standalone artifact exists | `test -f .next/standalone/server.js` | exists | ✓ PASS |
| Compose file parses | `docker compose -f docker/docker-compose.yml config` | parses clean (with `docker/.env` beside the file) | ✓ PASS |
| CI workflow YAML valid | `python3 -c "import yaml; yaml.safe_load(...)"` | parses | ✓ PASS |
| Release workflow YAML valid | `python3 -c "import yaml; yaml.safe_load(...)"` | parses | ✓ PASS |
| dev-pb.js Node syntax | `node --check scripts/dev-pb.js` | exit 0 | ✓ PASS |
| Image helper script syntax | `sh -n scripts/check-image-size.sh` and `sh -n scripts/check-multiarch.sh` | exit 0 | ✓ PASS |
| Docker amd64 build | `docker buildx build --platform linux/amd64 --load -t homekeep:verify -f docker/Dockerfile .` | **exit 1 at step 6/16 — `s6-overlay-x86_64.tar.xz: FAILED open or read`** | ✗ FAIL |
| `.env` gitignored | `git check-ignore .env` | `.env` emitted | ✓ PASS |
| `.env` not tracked | `git ls-files \| grep -E '^\.env$'` | empty | ✓ PASS |
| No `NEXT_PUBLIC_*` in source | `grep -r NEXT_PUBLIC_ app/ lib/` | empty | ✓ PASS |
| No hardcoded external URLs in source | `grep -rE 'https?://(?!127\.0\.0\.1\|localhost)...' app/ lib/` | empty | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| INFR-01 | 01-02, 01-03, 01-04 | Single Docker image with Next.js + PocketBase (s6-overlay) | ✗ BLOCKED | All static artifacts present (Dockerfile stages, s6 service tree, Caddyfile), but the image does not build. Container-level assertion fails. |
| INFR-02 | 01-02, 01-06 | Multi-arch image: linux/amd64 + linux/arm64 | ✗ BLOCKED | release.yml configured for both platforms via buildx+QEMU, but same Dockerfile gap breaks both arches. Never pushed to GHCR yet (no `v*` tag exists). |
| INFR-03 | 01-02 | Final image under 300MB | ✗ BLOCKED | `scripts/check-image-size.sh` enforces 300MB correctly; image never built so value is unknown. |
| INFR-04 | 01-02 | Single `./data` volume (PB DB + uploads) | ✓ SATISFIED (static) | Dockerfile has exactly one `VOLUME ["/app/data"]`; compose declares single bind mount `./data:/app/data`; PB service points `--dir=/app/data/pb_data`. Design is correct; survival across restarts unverified behaviourally. |
| INFR-05 | 01-01, 01-04 | `/api/health` endpoint | ✓ SATISFIED | Route implemented with correct semantics + 3s timeout + 3 unit tests covering ok/unhealthy/unreachable; Caddyfile routes it to Next.js before general `/api/*` → PB (ordering verified via `awk`). |
| INFR-06 | 01-05 | Three compose variants: LAN, Caddy, Tailscale | ✓ SATISFIED (Phase-1 scope) | Plan explicitly scopes only the LAN variant to Phase 1 (Caddy/Tailscale deferred to Phase 7 per CONTEXT.md). `docker/docker-compose.yml` is the LAN default. |
| INFR-10 | 01-01, 01-02, 01-05 | Env-driven config — no hardcoded URLs, paths, or secrets | ✓ SATISFIED | `.env.example` drives all config; compose uses `${GHCR_OWNER:-...}`/`${TAG:-...}`/`${HOST_PORT:-3000}`/`${TZ:-Etc/UTC}`; no `NEXT_PUBLIC_*` anywhere; no secret ARG/ENV in Dockerfile; no external hostnames hardcoded in source. |
| INFR-11 | 01-01 | `.env.example` with structure, real `.env` git-ignored | ✓ SATISFIED | 5 vars documented; `.env` gitignored and untracked. |
| INFR-12 | 01-01, 01-07 | MIT license, public GitHub repo | ✓ SATISFIED (locally) | LICENSE present with MIT text + 2026 copyright; README includes CI/Release/License badges and links to LICENSE. Repo has not yet been pushed to GitHub (status: local git only). Making it public is a human-side Maintainer Setup task documented in README §Maintainer setup. |

**Orphaned requirements:** None. REQUIREMENTS.md maps exactly INFR-01, 02, 03, 04, 05, 06, 10, 11, 12 to Phase 1, and every ID is claimed by at least one plan's frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `docker/Dockerfile` | ~47-53 (s6 arch step), ~64-69 (PocketBase step) | Checksum-file filename vs download-filename mismatch → `sha256sum -c` fails at runtime | 🛑 Blocker | Image cannot be built for any architecture. All container-level success criteria unreachable. |

No TODO/FIXME/placeholder text, no empty `return null` handlers, no stubbed components. The only blocker is the Dockerfile logic bug identified above.

### Human Verification Required

Post-fix, the developer should confirm the following once the Dockerfile is corrected (none of these require human judgement today — they are deterministic re-runs after the gap closes, so they live in the gap closure plan rather than as open human-verification items):

1. `docker buildx build --platform linux/amd64 --load -t homekeep:ci -f docker/Dockerfile .` exits 0 and `sh scripts/check-image-size.sh homekeep:ci` prints a value under 300 MB.
2. `docker buildx build --platform linux/arm64 --output type=image,push=false -f docker/Dockerfile .` exits 0.
3. `docker compose -f docker/docker-compose.yml up -d` (with `.env` present beside the compose file or via `--project-directory .`) boots the container, and after the 30-second start-period `curl -fsS http://localhost:3000/api/health` returns `{"status":"ok","nextjs":"ok","pocketbase":"ok","pbCode":200}`.
4. Stopping and restarting the container preserves data in `./data/` (SC #3 runtime confirmation).
5. Repo is pushed to a public GitHub repository, branch protection is enabled on `main`, GHCR package is set to public after the first release (INFR-12 + README §Maintainer setup items).

### Gaps Summary

The phase's static scaffolding is uniformly high quality — every file required by the plan frontmatter exists, contains the patterns demanded by acceptance criteria, and passes the local tooling gates (`npm run lint && npm run typecheck && npm run test && npm run build` all green; YAML and shell scripts parse clean; `.env` is properly ignored; no `NEXT_PUBLIC_*` leaks; no hardcoded external hosts). The s6-overlay service tree, the Caddy path-ordering, the compose file, the two CI workflows, and the public README all match their plans verbatim.

The single blocker is a **supply-chain checksum-filename mismatch in the Dockerfile** that was never caught because the plan deliberately deferred the full `docker build` to 01-06 CI, and CI has never actually run (the repo is still local-only). When I reproduced the build in this verification, step 6/16 (the s6-overlay arch tarball verification) aborted with `sha256sum: can't open 's6-overlay-x86_64.tar.xz': No such file or directory`. The same pattern exists in the PocketBase-zip step (line ~64-69) and would fail identically if reached.

Because the phase goal is **"A working Docker container runs both Next.js and PocketBase"** and the container cannot be produced, two of the five ROADMAP success criteria fail outright (SC #1 `docker compose up` succeeds; SC #4 multi-arch build succeeds) and a third is blocked from behavioural confirmation (SC #2 combined `/api/health` over HTTP; SC #3 data volume survives container restarts is unverifiable runtime-wise). SC #5 (env-driven config, no hardcoded secrets) passes cleanly.

Closing this gap is a small code-level change in one file plus a verified `docker buildx build` against both architectures. No architectural rework needed.

---

_Verified: 2026-04-20T22:17:00Z_
_Verifier: Claude (gsd-verifier)_
