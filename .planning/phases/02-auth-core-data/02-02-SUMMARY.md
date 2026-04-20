---
phase: 02-auth-core-data
plan: 02
subsystem: ui
tags: [shadcn, tailwind4, react-hook-form, dnd-kit, sonner, lucide, pocketbase, ssr, cookies, next16, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-scaffold-infrastructure
    provides: "Next.js 16 app router + Tailwind 4 + Vitest jsdom + @/* path alias + lib/pocketbase.ts createClient factory"
  - phase: 02-auth-core-data plan 01
    provides: "homes/areas/tasks collections exist on PB 0.37.1; users.last_viewed_home_id; Whole Home auto-create hook; rate limits; SMTP env bootstrap"
provides:
  - "lib/pocketbase-server.ts createServerClient(): per-request PB client hydrated from pb_auth cookie via await cookies() (D-03 linchpin)"
  - "lib/pocketbase-server.ts createServerClientWithRefresh(): same + authRefresh with isValid guard, for trust boundaries"
  - "lib/pocketbase-browser.ts getBrowserClient(): singleton PB client pointed at window.location.origin, throws on SSR misuse"
  - "lib/pocketbase.ts Phase 1 back-compat shim exporting createClient() so the Phase 1 regression test stays green"
  - "11 shadcn/ui components vendored under components/ui/ (button, input, label, card, form, select, dialog, dropdown-menu, tabs, separator, sonner)"
  - "lib/utils.ts cn() helper (clsx + tailwind-merge)"
  - "app/globals.css Tailwind 4 @theme inline mapping warm-accent HSL tokens: --primary hsl(30 45% 65%) ≈ #D4A574, --radius 0.75rem, warm-hue neutrals for bg/muted/border"
  - "app/layout.tsx <Toaster /> mounted for sonner toasts"
  - "components.json shadcn config: style=new-york, baseColor=stone, iconLibrary=lucide"
  - "Exact-pinned runtime deps: react-hook-form 7.73.1, @hookform/resolvers 5.2.2, @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0, @dnd-kit/utilities 3.2.2, sonner 2.0.7, lucide-react 1.8.0, date-fns-tz 3.2.0"
  - "Exact-pinned shadcn peer deps: class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.5.0, next-themes 0.4.6, radix-ui 1.4.3, tw-animate-css 1.4.0"
  - "4 new Vitest unit tests for createServerClient: loopback baseURL, cookie-hydrated token+record, empty authStore on missing cookie, distinct instances per call (T-02-02-01)"
affects: [02-03-auth-ui, 02-04-homes-areas-crud, 02-05-tasks, 03-three-band-view, 04-collaboration]

# Tech tracking
tech-stack:
  added:
    - "react-hook-form 7.73.1 (client form state + validation)"
    - "@hookform/resolvers 5.2.2 (zod ↔ RHF bridge)"
    - "@dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0 + @dnd-kit/utilities 3.2.2 (drag-to-reorder for AREA-05)"
    - "sonner 2.0.7 (shadcn's replacement toast component)"
    - "lucide-react 1.8.0 (icon library for IconPicker + in-component icons)"
    - "date-fns-tz 3.2.0 (IANA timezone → UTC for home.timezone)"
    - "class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.5.0 (shadcn variant + class merging)"
    - "next-themes 0.4.6 (shadcn Toaster theme sync)"
    - "radix-ui 1.4.3 (meta package exporting all radix primitives under one namespace — shadcn 4.3.1 uses this instead of per-primitive @radix-ui/react-*)"
    - "tw-animate-css 1.4.0 (Tailwind 4-compatible tailwindcss-animate replacement)"
    - "shadcn CLI 4.3.1 (used once for init + component add; NOT left in deps)"
  patterns:
    - "Pattern: split PB client factories — one per-request server factory hydrated from cookie, one singleton browser factory guarded against SSR misuse. Phase 1 single factory kept as a thin shim for test back-compat."
    - "Pattern: Tailwind 4 CSS-first theme — :root holds HSL values, @theme inline maps them to Tailwind color names; no tailwind.config.js. Warm accent hue=30, low saturation."
    - "Pattern: TDD RED/GREEN cycle at plan-level — RED commit creates a failing import test for a non-existent module, GREEN commit implements it alongside a test-isolation fix surfaced during wiring."
    - "Pattern: exact-pin all runtime deps (carry Phase 1 pattern forward); strip the carets shadcn writes; remove the shadcn CLI from dependencies entirely."

key-files:
  created:
    - "lib/pocketbase-server.ts"
    - "lib/pocketbase-browser.ts"
    - "lib/utils.ts"
    - "components.json"
    - "components/ui/button.tsx"
    - "components/ui/input.tsx"
    - "components/ui/label.tsx"
    - "components/ui/card.tsx"
    - "components/ui/form.tsx"
    - "components/ui/select.tsx"
    - "components/ui/dialog.tsx"
    - "components/ui/dropdown-menu.tsx"
    - "components/ui/tabs.tsx"
    - "components/ui/separator.tsx"
    - "components/ui/sonner.tsx"
    - "tests/unit/pocketbase-server.test.ts"
  modified:
    - "package.json"
    - "package-lock.json"
    - "app/globals.css"
    - "app/layout.tsx"
    - "lib/pocketbase.ts"

key-decisions:
  - "02-02: shadcn 4.3.1 preset-based init (nova/vega/maia/lyra/mira/luma/sera) writes an empty form.json stub — switched to the classic style=new-york baseColor=stone because only new-york and default still ship a real <Form> component. components.json edited post-init to match."
  - "02-02: Removed the bogus `@import \"shadcn/tailwind.css\"` that the preset init wrote — no such package is published; the CSS-tokens-in-:root pattern provides all the theming directly."
  - "02-02: Stripped carets and removed `shadcn` from runtime dependencies — the CLI is a build-time tool, not a runtime dep; Phase 1 exact-pin pattern carried forward for all shadcn peer deps (cva, clsx, tailwind-merge, next-themes, radix-ui, tw-animate-css)."
  - "02-02: Test isolation fix — PocketBase's default LocalAuthStore persists to jsdom's localStorage between tests; added localStorage.clear() to beforeEach so the empty-cookie test doesn't inherit test 2's hydrated authStore."
  - "02-02: lib/pocketbase.ts kept as a 13-line back-compat shim re-exporting `createClient` so tests/unit/pocketbase.test.ts (Phase 1 regression sentinel) passes unchanged — new code imports the split factories."

patterns-established:
  - "Pattern: per-request `new PocketBase(...)` inside async factory — no module-level state, threat mitigation T-02-02-01 (no auth leakage between concurrent requests)."
  - "Pattern: 'use client' + SSR-throws guard on any module that mutates singleton browser state — fail-fast to prevent accidental server imports."
  - "Pattern: RHF + zod + shadcn Form component stack wired and ready — downstream plans (02-03 auth, 02-04 CRUD, 02-05 tasks) compose this stack without further bootstrap."

requirements-completed: [AUTH-02]

# Metrics
duration: 8min
completed: 2026-04-20
---

# Phase 2 Plan 2: Frontend Runtime + SSR Cookie Bridge Summary

**SSR cookie bridge stood up — `createServerClient()` hydrates a fresh PocketBase client from the HttpOnly `pb_auth` cookie via Next 16's async `cookies()`, a singleton browser factory throws fast on SSR misuse, and the 11 shadcn/ui components + warm-accent Tailwind 4 theme (#D4A574 terracotta-sand at hsl(30 45% 65%)) are vendored into the repo for downstream UI plans to compose.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-20T23:34:08Z
- **Completed:** 2026-04-20T23:42:27Z
- **Tasks:** 2
- **Files modified:** 21 (16 created, 5 modified)

## Accomplishments

- SSR cookie bridge (D-03 linchpin) live. Server Components, Route Handlers, and Server Actions get a fresh per-request PocketBase client hydrated from the `pb_auth` cookie — threat T-02-02-01 mitigated by a `new PocketBase(...)` on every call, verified by unit test 4 asserting two consecutive calls return distinct instances.
- Browser singleton (`getBrowserClient()`) scoped to `window.location.origin`, fail-fast guarded against SSR misuse (T-02-02-02). JSDoc documents Pitfall 5 — pb_auth is HttpOnly so the browser authStore stays a display-only cache; authed fetches rely on the browser cookie jar + PB server-side validation.
- 11 shadcn/ui components vendored under `components/ui/` in the classic **new-york** style with the **stone** base color. Peer deps (cva, clsx, tailwind-merge, next-themes, radix-ui, tw-animate-css) all exact-pinned to keep Phase 1 discipline.
- Tailwind 4 `@theme inline` block maps warm-hue HSL tokens — `--primary: hsl(30 45% 65%)` ≈ `#D4A574`, `--radius: 0.75rem` for rounded-lg per SPEC §19 — so every shadcn component inherits the HomeKeep design language without touching a single `tailwind.config.js` (which doesn't exist — CSS-first).
- 8 new runtime deps pinned exactly (react-hook-form 7.73.1, @hookform/resolvers 5.2.2, @dnd-kit core/sortable/utilities, sonner 2.0.7, lucide-react 1.8.0, date-fns-tz 3.2.0) — no semver carets, matching Phase 1's exact-pin pattern.
- Phase 1 regression sentinel `tests/unit/pocketbase.test.ts` still passes (2/2), now via the 13-line back-compat shim in `lib/pocketbase.ts` — the `createClient` export shape is preserved so nothing else had to move.
- 4 new unit tests for `createServerClient`: loopback baseURL, cookie-hydrated token+record, empty authStore on missing cookie, distinct instances per call. All four pass alongside the 7 Phase 1 tests (11/11 total).
- `<Toaster />` wired in `app/layout.tsx` ready for toast use in downstream plans.

## Task Commits

1. **Task 1: Install deps + shadcn init + warm theme + layout Toaster** — `165569a` (feat)
2. **Task 2 RED: failing tests for SSR cookie bridge** — `b4ca951` (test)
3. **Task 2 GREEN: implement createServerClient + getBrowserClient + Phase 1 shim** — `4592be0` (feat)

## Files Created/Modified

**Created:**
- `lib/pocketbase-server.ts` — `createServerClient()` + `createServerClientWithRefresh()`; `new PocketBase('http://127.0.0.1:8090')` per call, reads `pb_auth` via `await cookies()`, calls `authStore.loadFromCookie('pb_auth=' + value)` when present.
- `lib/pocketbase-browser.ts` — `'use client'`; `getBrowserClient()` singleton pointed at `window.location.origin`; throws `Error('getBrowserClient() called in server context ...')` when `typeof window === 'undefined'`.
- `lib/utils.ts` — shadcn-generated `cn(...)` helper = `twMerge(clsx(...))`.
- `components.json` — shadcn config: `style: new-york`, `baseColor: stone`, `cssVariables: true`, `iconLibrary: lucide`, aliases pointing at the existing `@/*` path.
- `components/ui/{button,input,label,card,form,select,dialog,dropdown-menu,tabs,separator,sonner}.tsx` — 11 vendored shadcn components in new-york style; internally they use `radix-ui` 1.x meta package (e.g. `import { Slot } from "radix-ui"`).
- `tests/unit/pocketbase-server.test.ts` — 4 Vitest tests mocking `next/headers` cookies(); covers baseURL, cookie hydration, empty authStore, per-call fresh instances.

**Modified:**
- `package.json` — 8 new runtime deps exact-pinned; 6 shadcn peer deps added and exact-pinned; `shadcn` CLI stripped from dependencies (not a runtime lib).
- `package-lock.json` — regenerated to match exact pins.
- `app/globals.css` — replaced shadcn's default OKLCH neutral theme with warm-hue HSL tokens per RESEARCH Pitfall 9 + D-18. `:root` defines the HSL values (bg/fg/card/popover/primary/secondary/muted/accent/destructive/border/input/ring/chart-1..5/sidebar-*/radius); `.dark` mirror; `@theme inline` maps `--color-*` and `--radius-{sm,md,lg,xl,2xl,3xl,4xl}` for Tailwind utility generation. Removed the bogus `@import "shadcn/tailwind.css"` that the preset init wrote.
- `app/layout.tsx` — imports `Toaster` from `@/components/ui/sonner`, mounts it after `{children}` inside the `<body>`. Preserves shadcn's Geist font wiring that init added.
- `lib/pocketbase.ts` — reduced to a 13-line back-compat shim exporting `createClient()`. Behavior preserved (loopback on server, origin in browser) so `tests/unit/pocketbase.test.ts` passes unmodified.

## Decisions Made

- **shadcn 4.3.1 preset vs classic style:** shadcn 4.3.1 ships a new preset system (nova/vega/maia/lyra/mira/luma/sera) that is now the "default" path — `shadcn init --yes -b radix --preset=nova` succeeds non-interactively but writes `style: "radix-nova"`. Plan D-14 and the acceptance grep explicitly require `new-york`. Tested the public registry: `/r/styles/radix-nova/form.json` is an **empty 4-line stub** with no actual form content, while `/r/styles/new-york/form.json` ships the full RHF-aware `<Form>` component. Concretely, the Nova-style `shadcn add form` command silently no-ops. Resolution: keep the plan's directive — manually rewrite `components.json` to `style: "new-york"` + `baseColor: "stone"` post-init, `rm` the placeholder components the preset wrote, and re-run `shadcn add` which then pulls the correct new-york versions from the registry. All 11 components land with real content. Documented as deviation #1 below.
- **shadcn peer deps exact-pinned:** shadcn's post-install rewrites `package.json` with semver carets (`^0.7.1`, `^2.1.1`, `^3.5.0`, ...) on the six peers it auto-installs. Phase 1's established pattern is exact-pin everything — stripped carets across the board and removed `shadcn` itself from the `dependencies` block (it's a build-time CLI, not a runtime package). `npm install` after the strip locked to the exact pinned versions cleanly.
- **Bogus `@import "shadcn/tailwind.css"` removed:** The preset-based init wrote `@import "shadcn/tailwind.css"` as the third line of `globals.css`. No such package is published (tried `npm view shadcn/tailwind.css` → 404). The full token catalogue lives in `:root` already, so the import was purely decorative — or more precisely, broken. Removed; CSS still compiles cleanly through `@tailwindcss/postcss`.
- **Test isolation via `localStorage.clear()`:** PocketBase's default `LocalAuthStore` persists to `localStorage` when one exists. In Vitest's jsdom environment, `localStorage` survives between tests in the same file, so after test 2 loaded a cookie into the authStore, test 3's fresh `new PocketBase()` picked up the persisted auth before my code got a chance to observe "no cookie → empty authStore". Adding `globalThis.localStorage.clear()` in `beforeEach` ensures each test starts with a clean browser-side PB cache. The production code is correct — the test isolation was the bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn 4.3.1 preset system silently writes empty form.json; `style: "new-york"` mandate unreachable via default init path**

- **Found during:** Task 1, right after the first `shadcn add form` silently no-op'd.
- **Issue:** The plan action step 2 instructs `shadcn@4.3.1 init` with style="new-york" + base="stone". In shadcn 4.3.1 the CLI has migrated to a preset system (Nova/Vega/Maia/Lyra/Mira/Luma/Sera presets driven by `-b radix|base`) that, when run non-interactively, picks `radix-nova` and writes `"style": "radix-nova"` to components.json. The new preset-based registry paths (`/r/styles/radix-nova/*.json`) contain only 4-line stubs for several components — `form`, most importantly. `shadcn add form` against radix-nova "succeeds" but creates zero files, breaking the plan's 11-component requirement and the D-15 RHF+zod story.
- **Fix:** 
  1. Ran the non-interactive init (`--base=radix --no-monorepo --preset=nova --force`) to get the scaffold (lib/utils.ts, initial globals.css, layout.tsx Geist wiring).
  2. Manually rewrote `components.json` to the classic style: `"style": "new-york"`, `"baseColor": "stone"`, kept the auto-generated aliases pointing at `@/*`.
  3. Deleted the 10 placeholder components the preset init had written under `components/ui/`.
  4. Re-ran `shadcn add button input label card form select dialog dropdown-menu tabs separator sonner --yes --overwrite` — with the classic style now set in `components.json` the CLI pulled all 11 from `/r/styles/new-york/*.json` (real content), including `form.tsx` with the `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormDescription>`, `<FormMessage>` exports that D-15 depends on.
- **Files modified:** components.json (manual override), components/ui/*.tsx (re-fetched after style switch).
- **Verification:** `grep -q '"style": "new-york"' components.json` passes; all 11 component files exist; `grep -l "react-hook-form" components/ui/form.tsx` confirms RHF wiring; `components/ui/form.tsx` is 169 lines (full content, not a 4-line stub).
- **Committed in:** 165569a

**2. [Rule 1 - Bug] shadcn auto-caret all deps and auto-added `shadcn` itself to runtime dependencies**

- **Found during:** Task 1, reviewing `package.json` after `shadcn add`.
- **Issue:** The `shadcn add` command writes `"react-hook-form": "^7.73.1"` (adds `^`) even though I had already pinned `"react-hook-form": "7.73.1"` exactly, and adds `"shadcn": "^4.3.1"` to dependencies. Phase 1's exact-pin pattern (documented at 01-01-SUMMARY.md) is: no carets, no shadcn CLI in runtime deps.
- **Fix:** Stripped carets across all affected fields in `package.json` (rhf, @hookform/resolvers, lucide-react, sonner, zod, class-variance-authority, clsx, tailwind-merge, next-themes, radix-ui, tw-animate-css). Removed the `shadcn` entry from `dependencies`. Ran `npm install` to re-lock to exact versions.
- **Files modified:** package.json, package-lock.json.
- **Verification:** `grep -E '"[^"]+": "\^[0-9]' package.json | wc -l` returns 0 under `dependencies`; `grep '"shadcn":' package.json` returns no match.
- **Committed in:** 165569a

**3. [Rule 1 - Bug] `app/globals.css` contained `@import "shadcn/tailwind.css"` (non-existent package)**

- **Found during:** Task 1 verifying the CSS after the preset init.
- **Issue:** The preset-based init emits `@import "shadcn/tailwind.css";` as a workflow for its "menu color" token system. `npm view shadcn/tailwind.css` 404s — this is not a published package. The CSS was compiling only because our `:root` already has the token catalogue; the missing import was silently dropped by `@tailwindcss/postcss` during build.
- **Fix:** Removed the bogus import when rewriting `globals.css` to the warm-accent theme.
- **Files modified:** app/globals.css.
- **Verification:** `grep -q 'shadcn/tailwind.css' app/globals.css` returns no match; `npm run build` still succeeds.
- **Committed in:** 165569a

**4. [Rule 1 - Bug] Test isolation: PB's LocalAuthStore persists to jsdom localStorage across tests**

- **Found during:** Task 2 GREEN — ran `npm test -- pocketbase-server` after creating the factories.
- **Issue:** Test 3 ("authStore is empty when no cookie") failed: expected `''`, got `'testtoken'`. Root cause: PB's default `LocalAuthStore` writes every authStore mutation to `window.localStorage`. In jsdom, `localStorage` is a single object shared across the whole test file run. Test 2 loaded a real cookie → authStore persisted `'testtoken'` to localStorage → test 3's `new PocketBase()` read it back during construction → empty-cookie assertion failed before our code even ran.
- **Fix:** Added `globalThis.localStorage.clear()` in `beforeEach` so each test starts with a fresh jsdom auth cache. Production behavior is unaffected — the fix is purely test hygiene.
- **Files modified:** tests/unit/pocketbase-server.test.ts.
- **Verification:** `npm test` passes 11/11 (4 new + 7 Phase 1) with the clear in place.
- **Committed in:** 4592be0 (same GREEN commit as the implementation — the fix was discovered during the GREEN run and is part of the "make tests pass" step).

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking). Scope creep: none. Each fix was in the path of success criteria and was required for lint/typecheck/test/build to pass.

## Assumption verification (from RESEARCH)

- **A6 ("stone" is shadcn's warmest base):** confirmed. `baseColor: "stone"` in components.json; the :root HSL values are our own override but stone provides the shadcn-default scaffolding compatible with those overrides.
- **Pitfall 5 (browser authStore is display-only):** confirmed in code + JSDoc. `lib/pocketbase-browser.ts` does not call `document.cookie` at runtime (proven by `grep -vE '^\s*(\*|//)' lib/pocketbase-browser.ts | grep -q 'document.cookie'` returning no match).
- **Pitfall 9 (Tailwind 4 CSS-first + `@theme inline`):** confirmed. No `tailwind.config.js` exists in repo; tokens live in `app/globals.css`.

## Issues Encountered

- **The shadcn preset migration is undocumented-for-existing-plans**: anyone following the Aug–Nov 2025 shadcn docs will see "style=new-york" as a valid init choice, but shadcn 4.3.1 has silently moved that under a non-default code path. The fix is trivial once diagnosed (edit components.json, re-add), but RESEARCH.md §Standard Stack lines 148–158 should be updated to note the discrepancy. Deferred doc update — not in scope for this plan.

- **Empty registry stubs are a silent failure mode**: `shadcn add form` against radix-nova prints `✔ Checking registry.` and exits with code 0 while creating no files. Losing faith in CLI exit codes is annoying but PB-like: verify artifacts, don't trust success prints. Mitigated in this plan by the `test -f components/ui/form.tsx` acceptance grep that caught it immediately.

## Threat Flags

None — this plan introduced exactly the surfaces listed in `<threat_model>` (T-02-02-01 through T-02-02-05). No new network endpoints, no new auth paths beyond the cookie-read contract, no schema changes.

Mitigation coverage:
- **T-02-02-01** (module-level PB instance leak): `grep -n '^(let|var|const) pb' lib/pocketbase-server.ts` returns no match; unit test 4 asserts distinct instances. PASS.
- **T-02-02-02** (server imports browser file by accident): `lib/pocketbase-browser.ts` starts with `'use client'` and throws when `typeof window === 'undefined'`. PASS.
- **T-02-02-03** (XSS reads `pb_auth` via `document.cookie`): browser file does not call `document.cookie` at runtime; the string only appears inside JSDoc. PASS.
- **T-02-02-04** (shadcn init breaks Phase 1 `@/*` alias): `tsconfig.json` still contains `"paths": { "@/*": ["./*"] }` and `"ignoreDeprecations": "6.0"`; Phase 1 test `tests/unit/pocketbase.test.ts` imports via `@/lib/pocketbase` and passes. PASS.
- **T-02-02-05** (toast PII leak): not in scope for this plan; enforcement in 02-03 server actions per the threat register disposition.

## Known Stubs

None — every file in this plan is fully implemented. The `createServerClientWithRefresh` export is usable today; 02-03 will import it from `proxy.ts`.

## Self-Check: PASSED

- `lib/pocketbase-server.ts` — FOUND
- `lib/pocketbase-browser.ts` — FOUND
- `lib/pocketbase.ts` (shim) — FOUND
- `lib/utils.ts` — FOUND
- `components.json` — FOUND (style=new-york verified)
- `components/ui/button.tsx` — FOUND
- `components/ui/input.tsx` — FOUND
- `components/ui/label.tsx` — FOUND
- `components/ui/card.tsx` — FOUND
- `components/ui/form.tsx` — FOUND (full content, not stub)
- `components/ui/select.tsx` — FOUND
- `components/ui/dialog.tsx` — FOUND
- `components/ui/dropdown-menu.tsx` — FOUND
- `components/ui/tabs.tsx` — FOUND
- `components/ui/separator.tsx` — FOUND
- `components/ui/sonner.tsx` — FOUND
- `app/globals.css` (warm theme, @theme inline, --primary hsl(30 45% 65%), --radius 0.75rem) — FOUND
- `app/layout.tsx` (Toaster imported) — FOUND
- `tests/unit/pocketbase-server.test.ts` (4 tests) — FOUND
- Commit `165569a` — FOUND
- Commit `b4ca951` — FOUND
- Commit `4592be0` — FOUND
- `npm run lint` — 0 errors
- `npm run typecheck` — 0 errors
- `npm test` — 11/11 pass
- `npm run build` — succeeds

## TDD Gate Compliance

- **RED gate:** `b4ca951` (test(02-02): add failing tests for SSR cookie bridge (RED)) — `tests/unit/pocketbase-server.test.ts` created; `npm test -- pocketbase-server` at that commit returns `Failed to resolve import '@/lib/pocketbase-server'`.
- **GREEN gate:** `4592be0` (feat(02-02): SSR cookie bridge + browser singleton PB client (GREEN)) — both factories implemented; all 4 new tests pass + all 7 Phase 1 tests still pass.
- **REFACTOR gate:** not needed — the implementation is the research-verbatim minimal form, no further cleanup warranted.

Plan-level TDD cycle RED → GREEN verified in git log.

## Next Phase Readiness

- **Ready for 02-03 (auth pages + proxy.ts):** `createServerClient` is callable from Server Actions today. The proxy route-guard pattern needs `createServerClientWithRefresh` — also exported. `zod` still at 4.1.0 (not bumped — Phase 1 pin held; 02-03 can share schemas without a major bump). The signup/login forms will compose `react-hook-form` + `@hookform/resolvers/zod` + shadcn `<Form>` off the shelf.
- **Ready for 02-04 (homes + areas CRUD):** all `<Card>`, `<DropdownMenu>`, `<Dialog>`, `<Select>` components present. Sortable area list has `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` pinned. IconPicker has `lucide-react` pinned.
- **Ready for 02-05 (tasks + computeNextDue):** `date-fns` 4.1.0 (Phase 1) + `date-fns-tz` 3.2.0 (this plan) cover the IANA-timezone math for `home.timezone` → `NextDueDisplay`.
- **Ready for downstream (Phase 3+):** `<Toaster />` is mounted — the three-band view's completion toast (Phase 3) has its render target. `next-themes` is in dependencies for future dark-mode toggle (not wired in this plan — deferred to 02-03's account menu).

**No blockers.** AUTH-02 (session persistence) is complete from the client-bridge side; the cookie write/read/delete dance on the server side lands in 02-03's server actions + proxy.ts.

---
*Phase: 02-auth-core-data*
*Completed: 2026-04-20*
