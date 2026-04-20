---
phase: 01-scaffold-infrastructure
plan: 01
subsystem: infra
tags: [nextjs, react, typescript, tailwind, vitest, playwright, pocketbase, eslint]

requires: []
provides:
  - Next.js 16 + App Router scaffold with TypeScript strict mode and Tailwind 4
  - Exact-pinned package.json (runtime + dev deps, no caret ranges)
  - Vitest jsdom test harness + Playwright E2E config (webServer + baseURL)
  - Environment-aware PocketBase client factory (lib/pocketbase.ts)
  - Combined /api/health route polling PB at 127.0.0.1:8090 with 3s AbortSignal timeout
  - Standalone build output (.next/standalone/server.js) for Dockerfile COPY in 01-02
  - public/.gitkeep (precondition for 01-02 Dockerfile `COPY /app/public`)
  - .env.example documenting SITE_URL, NTFY_URL, TZ, PUID, PGID
  - LICENSE (MIT, 2026 HomeKeep contributors)
  - .gitignore covering node_modules, .next, .env*, .pb/, data/, tsbuildinfo
  - eslint.config.mjs flat config wiring eslint-config-next entries directly
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, phase-2, phase-3]

tech-stack:
  added:
    - next@16.2.4
    - react@19.2.5 + react-dom@19.2.5
    - pocketbase@0.26.8 (SDK)
    - typescript@6.0.3
    - tailwindcss@4.2.2 + @tailwindcss/postcss@4.2.2
    - zod@4.1.0
    - date-fns@4.1.0 (delta: planned 4.3.6, latest 4.x on npm)
    - vitest@4.1.4 + @vitejs/plugin-react@5.0.0 + jsdom@29.0.2
    - "@testing-library/react@16.3.2 + @testing-library/jest-dom@6.6.3"
    - "@playwright/test@1.59.1"
    - concurrently@9.2.1
    - eslint@9.39.4 (delta: planned 10.2.1, eslint-plugin-react v7.37.x incompat w/ ESLint 10)
    - eslint-config-next@16.2.4
    - "@eslint/eslintrc@3.2.0"
    - "@types/node@22.19.17" (delta: planned 22.10.5, vite7 peer dep)
    - "@types/react@19.2.5"
    - "@types/react-dom@19.2.3" (delta: planned 19.2.5, unpublished on npm)
  patterns:
    - "Environment-aware client factory: typeof window branch for server vs browser URL"
    - "Combined health endpoint: Next.js route polls PB loopback with AbortSignal timeout"
    - "Exact-pin all deps (no carets) for reproducibility in infra-critical foundation phase"
    - "Flat-config ESLint with per-glob overrides (tests/** relaxes no-explicit-any for global mocks)"
    - "TDD cycle at plan level: RED (failing tests) -> GREEN (implementation) as separate commits"

key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - next.config.ts
    - next-env.d.ts
    - postcss.config.mjs
    - eslint.config.mjs
    - vitest.config.ts
    - playwright.config.ts
    - .gitignore
    - .env.example
    - LICENSE
    - README.md
    - app/layout.tsx
    - app/page.tsx
    - app/globals.css
    - app/api/health/route.ts
    - lib/pocketbase.ts
    - public/.gitkeep
    - tests/setup.ts
    - tests/unit/smoke.test.ts
    - tests/unit/pocketbase.test.ts
    - tests/unit/health.test.ts
    - tests/e2e/hello.spec.ts
    - tests/e2e/health.spec.ts
  modified: []

key-decisions:
  - "Bumped @types/node 22.10.5 -> 22.19.17 (latest 22.x) to satisfy vite@7 peer '>=22.12.0'"
  - "Downgraded ESLint 10.2.1 -> 9.39.4 because eslint-plugin-react@7.37.x (transitive via eslint-config-next) crashes on ESLint 10's rule context API"
  - "Used date-fns@4.1.0 (latest 4.x on npm) instead of 4.3.6 which is not published"
  - "Used @types/react-dom@19.2.3 (latest published 19.2.x) instead of 19.2.5 which is not published"
  - "Replaced `next lint` (removed in Next 16) with `eslint .` in package.json scripts"
  - "Added ignoreDeprecations: '6.0' to tsconfig.json because TS6 deprecated baseUrl"
  - "eslint.config.mjs consumes eslint-config-next flat entries directly (not via FlatCompat) — Next 16.2.4 ships a flat config array"
  - "Added eslint override disabling @typescript-eslint/no-explicit-any for tests/** — production code remains strict"
  - "Next build auto-rewrote tsconfig.json: jsx 'preserve' -> 'react-jsx' and appended '.next/dev/types/**/*.ts' to include (accepted, matches Next 16 automatic runtime)"
  - "Removed NEXT_PUBLIC_POCKETBASE_URL reference from lib/pocketbase.ts comment so the acceptance-criteria grep passes cleanly (D-03 rejected that env var; comment was stale)"

patterns-established:
  - "Wave 0 gate: lint + typecheck + test + build all pass clean before task commit"
  - "Plan-level TDD: RED commit (test) -> GREEN commit (feat) with both landing under the same plan"
  - "Documenting registry-driven version deltas in README §Version Pins + SUMMARY key-decisions"

requirements-completed:
  - INFR-05
  - INFR-10
  - INFR-11
  - INFR-12

duration: 9min
completed: 2026-04-20
---

# Phase 01 Plan 01-01: Scaffold Infrastructure Summary

**Next.js 16 App Router scaffold with exact-pinned deps, TypeScript strict, Tailwind 4, Vitest + Playwright harness, environment-aware PocketBase client, and combined /api/health endpoint — all Wave 0 gates (lint/typecheck/test/build) green.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-20T21:21:00Z
- **Completed:** 2026-04-20T21:30:18Z
- **Tasks:** 2 (both TDD)
- **Files created:** 25
- **Files modified:** 0

## Accomplishments

- Greenfield Next.js 16 + TypeScript + Tailwind 4 project scaffolded from zero with exact-pinned versions (no semver carets on runtime deps)
- Vitest 4.1.4 with jsdom + `@/*` alias via `fileURLToPath` — 6 unit tests green (smoke, pocketbase server/browser, health ok/unhealthy/unreachable)
- Playwright 1.59.1 config with webServer + `E2E_BASE_URL` override for live-container testing in later plans
- `lib/pocketbase.ts` factory implementing D-03 (loopback on server, `window.location.origin` in browser) — zero `NEXT_PUBLIC_*` references anywhere (mitigates Pitfall #3 + T-01-01-02)
- `app/api/health/route.ts` probing PB at `127.0.0.1:8090/api/health` with `AbortSignal.timeout(3000)` + `cache: 'no-store'` — returns 200/degraded with pocketbase `ok|unhealthy|unreachable` (INFR-05, T-01-01-04)
- `.next/standalone/server.js` artifact produced — precondition satisfied for 01-02 Dockerfile `COPY`
- `public/.gitkeep` committed — precondition for 01-02 `COPY /app/public`
- MIT LICENSE (2026 HomeKeep contributors), `.env.example` documenting SITE_URL/NTFY_URL/TZ/PUID/PGID, `.gitignore` covering `.env`, `.pb/`, `data/`, `.next/`, `*.tsbuildinfo`
- `eslint-config-next@16.2.4` wired as flat config with per-glob override relaxing `no-explicit-any` for tests

## Task Commits

1. **Task 1: Scaffold Next.js 16 project + TypeScript strict + Tailwind 4 + Vitest/Playwright** — `f0b0886` (feat)
2. **Task 2 RED: Add failing tests for pocketbase client + /api/health route** — `288ad53` (test)
3. **Task 2 GREEN: Implement pocketbase client factory + /api/health combined route** — `179e568` (feat)

_Task 2 uses TDD — RED commit introduces the tests (failing because @/lib/pocketbase and @/app/api/health/route did not yet exist), GREEN commit adds the implementation and flips them to passing._

## Files Created/Modified

**Config / tooling:**
- `package.json` + `package-lock.json` — exact-pinned deps; scripts for dev/build/lint/typecheck/test/test:watch/test:e2e/docker:build/docker:run
- `tsconfig.json` — strict, bundler resolution, `@/*` paths, `ignoreDeprecations: "6.0"`; Next auto-added `.next/dev/types/**/*.ts` on first build
- `next.config.ts` — `output: 'standalone'` (D-06 / RESEARCH §Pattern 3)
- `next-env.d.ts` — Next auto-generated type references
- `postcss.config.mjs` — `@tailwindcss/postcss` v4 plugin
- `eslint.config.mjs` — flat config extending `eslint-config-next` + core-web-vitals + typescript; tests override disabling `no-explicit-any`
- `vitest.config.ts` — jsdom env, globals on, `@/*` alias via `fileURLToPath`, excludes `tests/e2e/**`
- `playwright.config.ts` — `baseURL` defaults to `http://localhost:3001`, webServer runs `npm run build && npm run start`

**Repo metadata:**
- `.gitignore` — node_modules, .next, .env*, .pb/, data/, *.tsbuildinfo
- `.env.example` — SITE_URL, NTFY_URL, TZ, PUID, PGID (no secrets)
- `LICENSE` — MIT (2026 HomeKeep contributors)
- `README.md` — stub + Version Pins table documenting registry deltas

**Application code:**
- `app/layout.tsx` — RootLayout with Metadata (HomeKeep title/description) and globals.css import
- `app/page.tsx` — hello page with h1 "HomeKeep" + Tailwind styling
- `app/globals.css` — `@import "tailwindcss"` (Tailwind 4 CSS-first)
- `app/api/health/route.ts` — combined health endpoint (Pattern 4)
- `lib/pocketbase.ts` — client factory (Pattern 5)
- `public/.gitkeep` — empty, precondition for 01-02 Dockerfile COPY

**Tests:**
- `tests/setup.ts` — imports `@testing-library/jest-dom/vitest`
- `tests/unit/smoke.test.ts` — arithmetic sanity
- `tests/unit/pocketbase.test.ts` — server (loopback) vs browser (origin) URL resolution
- `tests/unit/health.test.ts` — ok/unhealthy/unreachable branches with mocked fetch
- `tests/e2e/hello.spec.ts` — h1 contains "HomeKeep"
- `tests/e2e/health.spec.ts` — JSON payload with `nextjs === 'ok'` + valid `pocketbase` state

## Decisions Made

See `key-decisions` frontmatter. Highlights:

- Exact-pinned every runtime and dev dep; documented registry-driven deltas in README §Version Pins so reproducibility is preserved and future devs know why versions differ from `01-RESEARCH.md §Standard Stack`.
- Downgraded ESLint to `9.39.4` (from planned `10.2.1`) because `eslint-plugin-react@7.37.x` — pulled transitively by `eslint-config-next@16.2.4` — uses the pre-ESLint-10 rule-context API and crashes on ESLint 10. Next.js 16 itself declares peer `eslint >=9.0.0`, so this is well-inside the supported window.
- Replaced the removed `next lint` subcommand with `eslint .`. Next 16 no longer ships a `lint` CLI (Next lint removal was upstream in Next 15 deprecation -> Next 16 removal).
- Flat-config ESLint: `eslint-config-next@16.2.4` ships a flat config array directly; the planned `FlatCompat` approach crashes ESLint 10 and is unnecessary. Imported the three entry points (default, `/core-web-vitals`, `/typescript`) and spread them directly.
- Added a per-glob override to disable `@typescript-eslint/no-explicit-any` for `tests/**`. Global mocks (`global.fetch = ...`, `(globalThis as any).window = ...`) are unavoidable and universal in Vitest — production code keeps the stricter rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `@types/node@22.10.5` incompatible with `vite@7` peer**
- **Found during:** Task 1, `npm install`
- **Issue:** `vite@7.3.2` (transitive via `vitest@4.1.4`) declares peerOptional `@types/node >=22.12.0`; pinned `22.10.5` failed ERESOLVE.
- **Fix:** Bumped `@types/node` to `22.19.17` (latest `22.x` patch, matches spirit of "Node 22 LTS types").
- **Files modified:** `package.json`
- **Verification:** `npm install` succeeds; typecheck + build green.
- **Committed in:** `f0b0886` (Task 1 commit).

**2. [Rule 3 — Blocking] `@types/react-dom@19.2.5` does not exist on npm**
- **Found during:** Task 1, `npm install` after fix #1
- **Issue:** `npm error notarget No matching version found for @types/react-dom@19.2.5`. Plan version is unpublished; latest `19.2.x` is `19.2.3`.
- **Fix:** Pinned `@types/react-dom` to `19.2.3`.
- **Files modified:** `package.json`.
- **Verification:** `npm install` succeeds, TSX typecheck passes.
- **Committed in:** `f0b0886`.

**3. [Rule 3 — Blocking] `date-fns@4.3.6` does not exist on npm**
- **Found during:** Task 1, `npm install` after fix #2
- **Issue:** `date-fns@4.3.6` unpublished. Registry tops out at `4.1.0` in the 4.x line.
- **Fix:** Pinned `date-fns` to `4.1.0`.
- **Files modified:** `package.json`.
- **Verification:** `npm install` succeeds; date-fns is not consumed yet in this plan.
- **Committed in:** `f0b0886`.

**4. [Rule 2 — Missing Critical] `@eslint/eslintrc@3.2.0` not transitively installed**
- **Found during:** Task 1, eslint config setup
- **Issue:** The plan's original eslint config used `FlatCompat` from `@eslint/eslintrc`, which was not pulled by `eslint-config-next`. Plan note directs adding it pinned at `3.2.0` if absent.
- **Fix:** Added `"@eslint/eslintrc": "3.2.0"` to devDependencies (kept even though we later switched away from `FlatCompat` — harmless and useful for future tooling).
- **Files modified:** `package.json`.
- **Verification:** `npm ls @eslint/eslintrc` resolves to 3.2.0.
- **Committed in:** `f0b0886`.

**5. [Rule 1 — Bug] `next lint` subcommand removed in Next 16**
- **Found during:** Task 1, running `npm run lint`
- **Issue:** `next lint` exits with `Invalid project directory provided, no such directory: /root/projects/homekeep/lint`. Next 16 deprecated and then removed the `lint` CLI subcommand.
- **Fix:** Changed `"lint": "next lint"` to `"lint": "eslint ."` in `package.json`. Rewrote `eslint.config.mjs` to import `eslint-config-next` flat entries directly (the `FlatCompat` approach produced `TypeError: Converting circular structure to JSON` on ESLint 10).
- **Files modified:** `package.json`, `eslint.config.mjs`.
- **Verification:** `npm run lint` exits 0.
- **Committed in:** `f0b0886`.

**6. [Rule 3 — Blocking] ESLint 10 + `eslint-plugin-react@7.37.x` incompatibility**
- **Found during:** Task 1, `npm run lint`
- **Issue:** `TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function` — `eslint-plugin-react@7.37.5` (transitive via `eslint-config-next@16.2.4`) uses the pre-ESLint-10 rule-context API. ESLint 10 changed context shape; plugin is not yet compatible.
- **Fix:** Downgraded `eslint` from `10.2.1` to `9.39.4` (latest 9.x, matches `eslint-config-next` peer `>=9.0.0` and `eslint-plugin-react` peer `^9.7`). `npm warn ERESOLVE` messages during earlier install had already flagged this mismatch.
- **Files modified:** `package.json`; reinstalled `node_modules` + `package-lock.json`.
- **Verification:** `npm run lint` exits 0 with only cosmetic `import/no-anonymous-default-export` warnings (cleaned up separately by assigning configs to a `const` before exporting).
- **Committed in:** `f0b0886`.

**7. [Rule 1 — Bug] TypeScript 6 deprecated `baseUrl` option**
- **Found during:** Task 1, `npm run typecheck`
- **Issue:** `tsconfig.json(17,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.`
- **Fix:** Added `"ignoreDeprecations": "6.0"` to `compilerOptions` in `tsconfig.json`. Kept `baseUrl` + `paths` because Next 16's App Router still consumes them for `@/*` aliasing.
- **Files modified:** `tsconfig.json`.
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `f0b0886`.

**8. [Rule 3 — Blocking] Vitest could not resolve `@/*` alias**
- **Found during:** Task 2 RED, `npm run test`
- **Issue:** `Failed to resolve import "@/lib/pocketbase" from "tests/unit/pocketbase.test.ts"`. Vite (and therefore Vitest) needs `resolve.alias` — it does not read `tsconfig.json` paths by default.
- **Fix:** Added `resolve.alias: { '@': fileURLToPath(new URL('./', import.meta.url)) }` to `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`.
- **Verification:** Unit tests resolve imports and run; RED tests fail for the correct reason (missing production files) rather than import errors.
- **Committed in:** `288ad53` (Task 2 RED commit).

**9. [Rule 1 — Bug] `@typescript-eslint/no-explicit-any` blocked test files from linting**
- **Found during:** Task 2 GREEN, `npm run lint`
- **Issue:** 12 lint errors from `any` casts in `tests/unit/*.test.ts`. The plan explicitly prescribes `as any` for the global mocks (fetch, globalThis.window), so simply rewriting the tests would be a deviation from spec; adding a local override is the idiomatic fix.
- **Fix:** Added a per-glob override in `eslint.config.mjs` disabling `no-explicit-any` for `tests/**/*.{ts,tsx}` only. Production code (`app/`, `lib/`) remains strict.
- **Files modified:** `eslint.config.mjs`.
- **Verification:** `npm run lint` exits 0 across all files.
- **Committed in:** `179e568` (Task 2 GREEN commit).

**10. [Rule 1 — Bug] Stale `NEXT_PUBLIC_POCKETBASE_URL` mention in `lib/pocketbase.ts` comment**
- **Found during:** Task 2 GREEN, re-running acceptance criterion `! grep -q "NEXT_PUBLIC_" lib/pocketbase.ts`
- **Issue:** The plan's canonical code block for `lib/pocketbase.ts` included a comment referencing `NEXT_PUBLIC_POCKETBASE_URL`. D-03 explicitly rejects that approach, and the acceptance grep flags any occurrence. A comment reference is not a code reference but still leaves a misleading dev hint.
- **Fix:** Rewrote the comment to cite D-03 and drop the stale env var name.
- **Files modified:** `lib/pocketbase.ts`.
- **Verification:** `! grep -q "NEXT_PUBLIC_" lib/pocketbase.ts` now passes; `grep -rE 'NEXT_PUBLIC_' app/ lib/` returns nothing.
- **Committed in:** `179e568`.

### Accepted automatic rewrites (not deviations)

- Next.js build auto-rewrote `tsconfig.json` on first build: `jsx: "preserve"` → `jsx: "react-jsx"` and appended `.next/dev/types/**/*.ts` to `include`. Per Next 16 docs this is expected behaviour; kept the change and subsequent typecheck still passes.

---

**Total deviations:** 10 auto-fixed (Rule 1 × 4, Rule 2 × 1, Rule 3 × 5).
**Impact on plan:** All fixes were registry-driven (unpublished versions), upstream-toolchain compat (ESLint 10 breakage), or Next 16 CLI changes (`next lint` removal). No scope creep — the scaffold delivered matches the plan's semantic intent and all success criteria. Deltas are documented in `README.md §Version Pins` so downstream plans know which pins are authoritative.

## Issues Encountered

- Registry gaps for `@types/react-dom@19.2.5`, `date-fns@4.3.6`, and `@types/node@22.10.5`-compat: all handled under Rule 3.
- ESLint 10 is ecosystem-too-new for `eslint-plugin-react@7.37.x` (also the `eslint-config-next` devDep notes `typescript@5.9.2` and `@types/eslint@9.6.1`, confirming 9.x remains the supported bedrock). Downgraded.
- Next.js 16 silently removed `next lint`. Replaced with direct `eslint .` invocation.

## Threat Surface Scan

No new endpoints, auth paths, or trust-boundary surface introduced beyond what `<threat_model>` covered. `/api/health` (T-01-01-03, -04) and `.env`/`NEXT_PUBLIC_*` hygiene (T-01-01-01, -02) already in register and mitigated as planned. MIT license placed verbatim (T-01-01-05).

## User Setup Required

None — no external services. Dev loop depends on `scripts/dev-pb.js` which lands in 01-05.

## Next Phase Readiness

Ready for 01-02 (Dockerfile / multi-arch build):

- `.next/standalone/server.js` exists — Dockerfile `COPY --from=builder /app/.next/standalone ./` will succeed.
- `public/.gitkeep` ensures `public/` exists for `COPY --from=builder /app/public ./public`.
- `package.json` `docker:build` + `docker:run` scripts are already stubbed with expected targets.
- `/api/health` route is wired and passes the `pocketbase: 'unreachable'` → 503 path in isolation (which is correct when PB is not yet running — Docker HEALTHCHECK in 01-02 will exercise the `pocketbase: 'ok'` → 200 path once s6-overlay supervises both processes).

Downstream plans should reference the updated Version Pins (see README.md §Version Pins) when they add to or update the dependency graph.

## Self-Check: PASSED

Verified claims on disk (2026-04-20T21:30:18Z):

- All 25 created files exist at the paths listed above.
- Commits `f0b0886`, `288ad53`, `179e568` present in `git log --oneline` on current branch.
- `test -f .next/standalone/server.js` → exists.
- `npm run lint && npm run typecheck && npm run test` all exit 0 on post-plan snapshot.

---
*Phase: 01-scaffold-infrastructure*
*Completed: 2026-04-20*
