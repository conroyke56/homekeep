---
phase: 01-scaffold-infrastructure
plan: 07
subsystem: docs
tags: [readme, documentation, ghcr, docker, public-repo, mit-license, infr-12]

requires:
  - phase: 01-01
    provides: "Stub README.md to replace; .env.example documenting SITE_URL/NTFY_URL/TZ/PUID/PGID; LICENSE (MIT); package.json scripts (dev, build, lint, typecheck, test, docker:build, docker:run)"
  - phase: 01-02
    provides: "docker/Dockerfile with EXPOSE 3000 + VOLUME /app/data + HEALTHCHECK on /api/health; image-name contract (ghcr.io/OWNER/homekeep); /app/data is chowned to node:node (UID 1000)"
  - phase: 01-03
    provides: "s6-overlay service tree naming the three processes (caddy + pocketbase + nextjs) the README describes in Architecture"
  - phase: 01-04
    provides: "Caddyfile routing contract: /api/health -> Next.js, /api/* + /_/* -> PocketBase, catch-all -> Next.js -- README's Architecture + PB-admin-at-/_ claims both trace to this"
  - phase: 01-05
    provides: "docker/docker-compose.yml LAN-only variant; scripts/dev-pb.js -- both referenced by name in README quickstart/dev sections"
  - phase: 01-06
    provides: "CI + release workflows (badges link here); three user_setup items (branch protection, GHCR visibility, Actions write permissions) that README Maintainer setup repeats"
provides:
  - "Public-facing README.md at repo root: badges, quickstart (both docker run and docker compose flows), env-var config table, first-boot PB admin guidance, Pitfall #1 filesystem warning, Pitfall #9 UID fallback with --entrypoint sh override AND host-side sudo chown, dev workflow, release tag scheme, architecture summary, health verification, maintainer (fork) setup checklist, MIT license link"
  - "INFR-12 closure: public-repo-ready documentation referencing MIT LICENSE, linking ROADMAP + SPEC, and using placeholder OWNER for reproducibility"
affects: [phase-2, phase-7]

tech-stack:
  added: []
  patterns:
    - "Documentation of compose-dir footgun (env_file/volumes resolve relative to docker/, not cwd) -- surfaces the hidden runtime detail from 01-05 decisions"
    - "Two-option UID-mismatch recovery: Option A runs chown inside the container with --entrypoint sh -u 0 override (defeats s6 /init so the trailing -c chown actually executes); Option B runs sudo chown on the host side -- either leaves ./data owned by UID 1000"
    - "Single-line + multi-line dual rendering of the docker run command: one-liner for discoverability (must_haves.key_links pattern `docker run .*ghcr\\.io/.*/homekeep` regex requires both tokens on one line), multi-line for readability"

key-files:
  created:
    - .planning/phases/01-scaffold-infrastructure/01-07-SUMMARY.md
  modified:
    - README.md

key-decisions:
  - "Dual-rendered docker run command: added a one-line form sentence before the multi-line code block so `must_haves.key_links.pattern 'docker run .*ghcr\\.io/.*/homekeep'` matches (same class of plan-vs-pattern tension seen in 01-02 HEALTHCHECK and 01-05 env_file short-form). Content semantically unchanged; both forms visible to readers, but the one-liner also makes quick copy-paste trivial"
  - "Added 'Maintainer setup (forking the repo)' section covering the three 01-06 user_setup items (workflow permissions, branch protection on main, GHCR visibility flip to public). Plan's verbatim action block did not include this checklist; objective success criteria explicitly required it. Classified as deviation Rule 2 (missing critical functionality -- INFR-12 public-repo polish for forked deployments)"
  - "Added 'Compose-dir footgun' callout quoting the 01-05 decision about env_file: .env resolving relative to the compose-file directory. Operators running `docker compose -f docker/docker-compose.yml up -d` from project root hit this the first time; surfacing it in the README closes the 01-05 summary's open documentation gap"
  - "Kept plan's verbatim Status section text ('Phase 1 of 7 -- Scaffold & Infrastructure') and utilitarian tone per SPEC §19 aesthetic guard. No emoji. No hype adjectives"
  - "Used `npm run lint` description 'ESLint via `eslint .`' instead of the plan's 'ESLint via `next lint`' since `next lint` was removed in Next 16 (per 01-01 decisions). Rule 1 bug: plan text contradicted the actual npm script registered in package.json"

patterns-established:
  - "README as the public-facing interface contract: it documents the image path, compose invocation, dev workflow, and first-boot flow that downstream operators rely on -- therefore README changes ARE interface changes"
  - "Maintainer checklist lives in README (not only in plan frontmatter user_setup) -- operators forking into their own GHCR namespace see the same checklist the plan executor saw"
  - "Placeholder OWNER everywhere the repo path appears -- operators replace via search-and-replace or via `.env` GHCR_OWNER when using compose"

requirements-completed:
  - INFR-12

duration: 2min
completed: 2026-04-20
---

# Phase 01 Plan 01-07: Public-Polish README Summary

**Rewrote the 01-01 stub README.md into the public-facing Phase-1 documentation: badges, both D-04 quickstart flows (`docker run` standalone and `docker compose up`), first-boot PocketBase admin via log-grep, env-var configuration table, Pitfall #1 filesystem warning, Pitfall #9 UID fallback (both container `--entrypoint sh` override and host `sudo chown`), native dev workflow (D-06), release tag scheme, architecture summary, health verification, maintainer (fork) setup checklist mirroring 01-06 `user_setup`, and MIT license link -- closing INFR-12.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-20T22:05:18Z
- **Completed:** 2026-04-20T22:08:13Z
- **Tasks:** 1
- **Files created:** 0 (SUMMARY is tracked separately in the docs commit)
- **Files modified:** 1 (`README.md` -- stub replaced with 209-line public-polish version)

## Accomplishments

- `README.md` rewritten from 37-line 01-01 stub to 209-line public-facing doc. Structure: H1 + badges + Status -> Quickstart (docker run + docker compose + first-boot PB) -> Configuration (env-var table + UID fallback subsection) -> Backup (with Pitfall #1 NFS/SMB warning) -> Development (native workflow per D-06 + scripts table + three local-build commands) -> Releases (git tag v* -> GHCR tags) -> Architecture (s6-overlay + Caddy + Next.js + PocketBase) -> Verifying your deployment (`curl /api/health`) -> Maintainer setup (fork checklist: workflow permissions, branch protection, GHCR visibility) -> License (MIT) -> Contributing.
- Both D-04 quickstart flows documented: `docker run -d -p 80:3000 -v ./data:/app/data --env-file .env ghcr.io/OWNER/homekeep:latest` (one-liner + multi-line form) AND `docker compose -f docker/docker-compose.yml up -d`. `HOST_PORT`, `GHCR_OWNER`, `TAG`, `TZ` env-var defaults surfaced inline with the compose block (mirrors 01-05 compose file).
- First-boot PB admin guidance: `docker compose ... logs homekeep | grep -i installer` AND `docker logs homekeep | grep -i installer`. RESEARCH Open Question #4 recommendation honored verbatim. Admin UI path `/_/` documented per D-05.
- Configuration table covers all five `.env.example` vars (SITE_URL, NTFY_URL, TZ, PUID, PGID) with Purpose + Default columns. INFR-10/11 traceability.
- Pitfall #1 warning: "./data/ must live on a local filesystem. NFS, SMB, and most NAS-mounted paths will silently corrupt the SQLite WAL." Synology/Unraid named as likely trip points.
- Pitfall #9 UID fallback ("If your host UID is not 1000") with TWO options:
  - **Option A** -- `docker run --rm --entrypoint sh -u 0 -v ./data:/app/data ghcr.io/OWNER/homekeep:latest -c "chown -R 1000:1000 /app/data"`. Explicit `--entrypoint sh` override is load-bearing: without it, s6's `/init` entrypoint starts the services and the trailing `-c "chown ..."` is never executed because `/init` does not pass its CMD argument through.
  - **Option B** -- `mkdir -p data && sudo chown -R 1000:1000 data` from the host. No container involved. Works even if the image is not yet pulled.
- Compose-dir footgun call-out in a blockquote under the compose flow: `env_file: .env` and `./data` resolve relative to `docker/`, not cwd. Fixes documented: `--project-directory .` flag or symlink `.env` to `docker/.env`. This answers the 01-05 summary's "documented pattern" open item.
- Dev workflow (D-06): `npm install && npm run dev` on native Node 22+; `concurrently` runs Next.js on :3001 and PocketBase on :8090 via `scripts/dev-pb.js`. Full scripts table documenting `dev:next`, `dev:pb`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, `build`, `docker:build`, `docker:run`.
- Release tag scheme documented: `git tag v0.1.0 && git push origin v0.1.0` -> `ghcr.io/OWNER/homekeep:v0.1.0`, `:0.1`, `:latest`. Mirrors 01-06 `docker/metadata-action` output.
- Architecture section names the three s6-managed processes and their ports (Caddy :3000 exposed, Next.js :3001 loopback, PocketBase :8090 loopback). Links to `SPEC.md` for the full spec.
- Maintainer setup section repeats the three 01-06 user_setup items: Workflow permissions -> Read and write; Branch protection on main with `lint-test-build` required check; GHCR package visibility flip to Public after first `v*` tag. INFR-12's "public GitHub repo + MIT license" requirement now has a discoverable operator-facing doc.
- MIT badge (shields.io) + LICENSE anchor `(./LICENSE)`. Placeholder `OWNER` throughout. No emoji (SPEC §19).

## Task Commits

1. **Task 1: Write public-polish README.md covering quickstart, dev, config, first-boot, caveats, and license** -- `0f53340` (docs)

_No TDD in this plan; deliverable is a single documentation artifact validated by 21 static-grep acceptance criteria + plan `<verification>` block + objective-specific criteria (--entrypoint sh, host sudo chown, maintainer checklist)._

## Files Created/Modified

- `README.md` -- 209 lines (+192/-19 from the 01-01 stub). Replaces the 37-line stub from 01-01 with the full public-facing Phase-1 documentation. The 01-01 stub's "Version Pins" table is dropped -- exact-pinned versions are documented in-place in `package.json` and in the 01-01 SUMMARY's decisions section, which is where future devs looking for "why did they pin X?" will naturally land. Keeping it in the public README was noise for operators.

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **Dual-rendered docker run command.** The plan's `must_haves.key_links` declares a regex pattern `docker run .*ghcr\.io/.*/homekeep` that requires both tokens on a single line. The plan's verbatim `<action>` block rendered the command multi-line via backslash continuation, which fails the single-line grep. Same class of tension seen in 01-02 (HEALTHCHECK) and 01-05 (env_file short form). Resolution: added a one-line form `docker run -d -p 80:3000 -v ./data:/app/data --env-file .env ghcr.io/OWNER/homekeep:latest` as an intro sentence before the multi-line code block. Both forms visible to readers; regex satisfied.
- **Maintainer setup checklist added.** Plan's verbatim action block stops at "Contributing" and omits the three 01-06 user_setup items (workflow permissions, branch protection, GHCR visibility). Objective success criteria explicitly required them. Classified as Rule 2 (missing critical functionality -- INFR-12 public-repo polish is incomplete without the fork-setup guidance).
- **Compose-dir footgun blockquote.** 01-05 summary's Decisions section called out this as "01-07 README will document the canonical invocation pattern." Delivered inline with the compose flow rather than as a separate "Known Gotchas" section, so operators see it at the exact moment they are about to hit it.
- **lint script description corrected.** Plan's action table said "ESLint via `next lint`". `next lint` was removed in Next 16 per 01-01 decisions. Changed to "ESLint via `eslint .`" to match the actual `package.json` script. Rule 1 bug fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 -- Missing Critical] Maintainer / fork setup checklist absent from plan's verbatim README content**

- **Found during:** Task 1 (objective success-criteria review before commit)
- **Issue:** Plan's verbatim `<action>` code block ends at the "Contributing" section. Objective's success criteria require: "GHCR branch-protection / visibility / workflow-permissions user_setup checklist from 01-06 included". INFR-12 is the plan's sole requirement; its "public GitHub repo + MIT license" intent is incomplete for forkers without the three 01-06 user_setup items surfaced in the README.
- **Fix:** Added a "Maintainer setup (forking the repo)" section between "Verifying your deployment" and "License" with three numbered items: (1) Workflow permissions -> Read and write, (2) Branch protection on main with `lint-test-build` required check, (3) Change GHCR package visibility to Public after first `v*` tag push. Wording mirrors 01-06 SUMMARY's User Setup Required section verbatim so the two stay in sync.
- **Files modified:** `README.md` (added ~20 lines in a new `## Maintainer setup (forking the repo)` section).
- **Verification:** `grep -qiE 'workflow permissions|Read and write permissions' README.md` -> PASS. `grep -qiE 'branch protection|Protect.*main|Require a pull request' README.md` -> PASS. `grep -qiE 'visibility.*public|Change visibility|Make the GHCR package public' README.md` -> PASS.
- **Committed in:** `0f53340` (Task 1 commit, bundled).

**2. [Rule 1 -- Bug] Plan's docker run command rendering broke `must_haves.key_links` regex**

- **Found during:** Task 1 (post-write acceptance verification)
- **Issue:** Plan `must_haves.key_links` entry: `from: "README.md Quickstart" -> to: "ghcr.io/OWNER/homekeep" via: "docker run standalone command" pattern: "docker run .*ghcr\\.io/.*/homekeep"`. The regex requires both tokens on one line. Plan's verbatim `<action>` content block rendered `docker run -d \<NL>  --name homekeep \<NL>  ...<NL>  ghcr.io/OWNER/homekeep:latest`, splitting the two tokens across six lines. Grep returns no match -> key_links pattern fails.
- **Fix:** Added a one-line form of the command as an intro sentence before the multi-line code block: `` One-liner form: `docker run -d -p 80:3000 -v ./data:/app/data --env-file .env ghcr.io/OWNER/homekeep:latest` ``. Followed by `Or with readable line-continuations:` and the original multi-line block. Both forms coexist; readers scanning quickly see the terse version, readers wanting explanations see the expanded version.
- **Files modified:** `README.md` (added 4 lines between the `### With \`docker run\` (standalone)` heading and the existing code block).
- **Verification:** `grep -qE 'docker run .*ghcr\.io/.*/homekeep' README.md` -> PASS.
- **Committed in:** `0f53340` (Task 1 commit, bundled).

**3. [Rule 1 -- Bug] Plan's scripts-table `lint` row described removed Next.js subcommand**

- **Found during:** Task 1 (cross-referencing `package.json` scripts)
- **Issue:** Plan's action block wrote `| \`npm run lint\` | ESLint via \`next lint\` |`. But `next lint` was removed in Next 16 per 01-01 decision (`"Replaced next lint (removed in Next 16) with 'eslint .'"`). The project's actual `package.json` has `"lint": "eslint ."`. Documenting the removed-upstream command would mislead readers trying to add rules or debug lint failures.
- **Fix:** Changed table row to `| \`npm run lint\` | ESLint via \`eslint .\` |`. Tracks actual package.json content.
- **Files modified:** `README.md` (one table cell).
- **Verification:** `grep -q 'ESLint via \`eslint \.\`' README.md` -> PASS (and `grep -q 'next lint' README.md` returns no match -> also good, stale references purged).
- **Committed in:** `0f53340` (Task 1 commit, bundled).

---

**Total deviations:** 3 auto-fixed (Rule 1 x 2, Rule 2 x 1).
**Impact on plan:** All three were reconciliations -- the plan's verbatim `<action>` block drifted from (a) its own `must_haves.key_links` regex, (b) the objective's explicit success criteria for the maintainer checklist, and (c) the upstream Next 16 CLI reality documented in 01-01. Net effect: README is richer and more correct than the plan's literal text. All 21 plan acceptance criteria + all 13 plan `<verification>` gates + all 6 objective special-criteria gates now PASS.

## Issues Encountered

- Plan's `<action>` content block hit the same "verbatim plan text vs acceptance criteria" tension seen in 01-02 (HEALTHCHECK multi-line vs single-line grep) and 01-05 (env_file short form). Handled inline as Rule 1 deviations. Pattern noted for future plans: when a plan's `must_haves.key_links.pattern` specifies a single-line regex, the `<action>` code block MUST render that content on a single line too -- backslash line-continuation inside fenced code blocks does not join lines for grep purposes.
- Plan's verbatim content omitted the three 01-06 user_setup items that the objective success criteria explicitly required. The plan's `user_setup: []` frontmatter field also said this plan has no user_setup -- but the objective is re-surfacing 01-06's items in the README as a fork-maintainer checklist. Handled inline as Rule 2.

## Threat Surface Scan

No new threat surface introduced. README is a documentation artifact, not a network endpoint, auth path, or file-system surface. All five register entries from the plan's `<threat_model>` honored:

- **T-01-07-01 (Info Disclosure - secrets in example commands):** MITIGATED. Every command uses only non-secret placeholders (`OWNER` for GHCR path, `.env.example` for variables). No tokens, credentials, or real domains.
- **T-01-07-02 (Tampering - untrusted commands):** MITIGATED. Every command uses official tools (`docker`, `npm`, `git`) and official images (ghcr.io/OWNER/homekeep from the reader's own fork). No curl-pipe-sh patterns.
- **T-01-07-03 (Data Loss - NFS/SMB backing store):** MITIGATED. Backup section contains explicit "local filesystem only" warning naming NFS, SMB, Synology, Unraid.
- **T-01-07-04 (Permission Denied - non-1000 UID):** MITIGATED. Dedicated "If your host UID is not 1000" subsection with two alternative commands (container `--entrypoint sh` override + host `sudo chown`).
- **T-01-07-05 (Confusion - Phase 2+ feature expectations):** MITIGATED. Prominent Status section explicitly labels this as Phase 1 of 7 with "No application features yet." Links to ROADMAP for the full plan.

No new threat flags surfaced beyond the register.

## User Setup Required

**None for this plan's deliverable directly.** However, the README now surfaces the three 01-06 user_setup items (workflow permissions, branch protection, GHCR visibility) under "Maintainer setup (forking the repo)" -- operators forking HomeKeep into their own GitHub namespace will see this checklist at the canonical entry-point document. That closes the documentation side of the 01-06 user_setup deferral.

## Next Phase Readiness

This is the final plan of Phase 1. Ready for **phase verification** and **Phase 2 kickoff**:

- All seven Phase-1 plans complete (01-01 scaffold, 01-02 Dockerfile, 01-03 s6 tree, 01-04 Caddyfile, 01-05 compose + dev-pb, 01-06 CI/release, 01-07 README).
- All five Phase-1 success criteria from ROADMAP.md documented and discoverable:
  1. `docker run -p 3000:3000 -v ./data:/app/data ghcr.io/<you>/homekeep:latest` serves `/api/health` -> documented in README Quickstart + Verifying sections.
  2. `docker-compose.yml` deploys with LAN defaults -> documented in README Quickstart (compose flow) and the file itself at `docker/docker-compose.yml`.
  3. `npm run dev` gives hot reload on both Next.js + PB -> documented in README Development.
  4. Container builds for amd64+arm64 -> documented in README Releases (tag -> multi-arch push) and enforced by `.github/workflows/ci.yml` + `release.yml` from 01-06.
  5. GitHub repo has CI passing, MIT license, branch protection on main -> documented in README (CI badge, MIT license badge + link, Maintainer setup section describing branch protection as a one-time fork step).
- INFR-05, -10, -11 completed in 01-01; INFR-01 through -04 in 01-02; INFR-06 in 01-05; INFR-02 in 01-06; INFR-12 completed in this plan. All eight Phase-1 infrastructure requirements now traceable to commits + SUMMARYs.

**Phase-7 carry-forwards (deferred hardening, not Phase-2 gates):**
- Runtime PUID/PGID honor instead of fixed UID 1000 chown dance (README documents current state as "future versions will honor PUID/PGID at runtime -- Phase 7").
- HTTPS / Tailscale via compose variants (README Architecture intentionally omits these; scope-creep guard).
- PWA install instructions (deferred until HTTPS; not documented).
- cosign / OIDC image signing (01-06 carry-forward; README Releases does not mention signatures yet).

**Phase 2 (data layer) readiness:**
- `pocketbase/pb_migrations/.gitkeep` already committed by 01-05; Phase 2 can `git add` migration files into the tracked directory.
- README's PB admin UI guidance (`/_/`) lets Phase 2 collection-creation walkthroughs reference the same path operators have already seen.

## Self-Check: PASSED

Verified claims on disk (2026-04-20T22:08:13Z):

- `test -f README.md` -> exists (209 lines, up from 37-line stub).
- Commit `0f53340` present in `git log --oneline` on master: `docs(01-07): rewrite README with public-polish quickstart + maintainer setup`.
- All 21 Task-1 acceptance criteria PASS (basic structure x4, quickstart x3, first-boot x1, config table x1, pitfalls x2, dev + scripts x2, releases x1, architecture x1, health x1, links x3, no-emoji x1, length x1).
- All 13 plan `<verification>` static gates PASS (h1 + 7 section headings + no-emoji + 3 key commands + length).
- All 6 objective special-criteria gates PASS (--entrypoint sh override, container chown /app/data, host-side sudo chown, workflow permissions, branch protection, GHCR visibility).
- All 4 must_haves.key_links pattern gates PASS (compose one-liner, docker run + ghcr.io one-liner, LICENSE link, docker logs installer).
- All 3 "three local build commands" must_haves PASS (docker:build, docker:run, compose up -d).
- No deletions in commit (`git diff --diff-filter=D --name-only HEAD~1 HEAD` empty).

---
*Phase: 01-scaffold-infrastructure*
*Completed: 2026-04-20*
