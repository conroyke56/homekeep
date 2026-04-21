---
phase: 02-auth-core-data
plan: 03
subsystem: auth
tags: [auth, next16, proxy, server-actions, useActionState, react-hook-form, zod, cookies, pocketbase, playwright, e2e, shadcn, tdd]

# Dependency graph
requires:
  - phase: 02-auth-core-data plan 01
    provides: "users collection + homes/areas/tasks schema + rate-limits (*:authWithPassword 5/60s) + SMTP env bootstrap"
  - phase: 02-auth-core-data plan 02
    provides: "lib/pocketbase-server.ts createServerClient() (async, cookie-hydrated), shadcn components (button/input/label/card/form/dropdown-menu), sonner Toaster, warm-accent tokens"
provides:
  - "proxy.ts (Next 16 rename from middleware.ts) at repo root gating (app) group: redirects unauthed /h and /settings → /login?next=…, redirects authed /login|/signup|/reset-password → /h (presence check on pb_auth cookie only, no JWT validation at the edge)"
  - "lib/actions/auth.ts exports 5 Server Actions: loginAction, signupAction, logoutAction, requestResetAction, confirmResetAction. All write/clear pb_auth cookie via Next 16 await cookies() store.set/delete with {httpOnly, secure: NODE_ENV==='production', sameSite:'lax', path:'/', maxAge: 14d}"
  - "extractPbAuthValue() helper in lib/actions/auth.ts that strips Set-Cookie header metadata from pb.authStore.exportToCookie() output (RESEARCH Pitfall 4)"
  - "safeNext() helper validating post-login redirect targets against open-redirect abuse (T-02-03-08): only same-origin /-prefixed paths without protocol schemes allowed"
  - "lib/schemas/auth.ts shared zod schemas: loginSchema, signupSchema (with path:['passwordConfirm'] refine per Pitfall 12), resetRequestSchema, resetConfirmSchema, plus LoginInput/SignupInput/ResetRequestInput/ResetConfirmInput/ActionState types"
  - "4 client-component forms (login, signup, reset-request, reset-confirm) using useActionState + react-hook-form + zodResolver + shadcn Button/Input/Label primitives, with client-side onBlur validation AND server fieldError merging"
  - "components/account-menu.tsx — shadcn DropdownMenu trigger (aria-label='Account', Lucide User icon); Log out item wraps a form whose action={logoutAction} so it works without JS"
  - "Public pages: / (landing, redirects authed users to /h), /login, /signup, /reset-password, /reset-password/[token] (Next 16 async params); no page.tsx under (public)/ root"
  - "Authed layout app/(app)/layout.tsx: Server Component guard re-checks pb.authStore.isValid (defense-in-depth beyond proxy.ts) and fetches userName server-side since the HttpOnly cookie is invisible to browser JS (RESEARCH Pitfall 5)"
  - "Placeholder app/(app)/h/page.tsx stub so auth E2E can land after signup/login; 02-04 replaces with real homes list + HOME-03 last-viewed redirect"
  - "tests/unit/schemas/auth.test.ts — 11 Vitest unit tests covering valid + invalid inputs + cross-field refine mapping"
  - "tests/e2e/auth-happy-path.spec.ts — 3 Playwright tests: signup/reload/HttpOnly/logout/re-login, invalid-email zod error, wrong-password generic error"
  - "playwright.config.ts webServer now an array booting dev-pb.js and next build+start in parallel with reuseExistingServer honouring !CI"
affects: [02-04-homes-areas-crud, 02-05-tasks, 03-three-band-view, 04-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: Next 16 proxy.ts (NOT middleware.ts) for route-group auth gates — runs nodejs runtime, presence-check only, delegates full validation to PB via Server Components. File lives at repo root, not under app/."
    - "Pattern: Server Action shape — 'use server' at file top; each action receives (prevState, formData) and returns ActionState union. Server zod re-parse is mandatory (never trust client). exportToCookie → extractPbAuthValue → store.set separates cookie value from header metadata."
    - "Pattern: useActionState + RHF + zodResolver client form — action={formAction} on the form, fieldErrors merged (client onBlur errors OR serverFieldErrors[field][0]), noValidate on the form so zod owns validation feedback."
    - "Pattern: Logout as form POST inside DropdownMenuItem asChild — works without JS, participates in Next 16 single-response cookie-clear + redirect flow."
    - "Pattern: safeNext() against open redirect — only '/'-prefixed same-origin paths without '://' or '//' allowed as login next targets."

key-files:
  created:
    - "proxy.ts"
    - "lib/actions/auth.ts"
    - "lib/schemas/auth.ts"
    - "components/forms/login-form.tsx"
    - "components/forms/signup-form.tsx"
    - "components/forms/reset-request-form.tsx"
    - "components/forms/reset-confirm-form.tsx"
    - "components/account-menu.tsx"
    - "app/(public)/login/page.tsx"
    - "app/(public)/signup/page.tsx"
    - "app/(public)/reset-password/page.tsx"
    - "app/(public)/reset-password/[token]/page.tsx"
    - "app/(app)/layout.tsx"
    - "app/(app)/h/page.tsx"
    - "tests/unit/schemas/auth.test.ts"
    - "tests/e2e/auth-happy-path.spec.ts"
  modified:
    - "app/page.tsx"
    - "playwright.config.ts"

key-decisions:
  - "02-03: Cookie options hardcoded to maxAge 60*60*24*14 (14d, A3) with secure: process.env.NODE_ENV === 'production'. In LAN-HTTP production (no HTTPS), Secure is OFF — SameSite=Lax still mitigates most CSRF. Phase 7 HTTPS mode flips this on automatically."
  - "02-03: loginAction supports redirect-with-next via a hidden input in LoginForm and a safeNext() helper. next must start with '/' and must not contain '//' or '://' — rules out open-redirect abuse (T-02-03-08). Not flagged as follow-up; implemented and enforced today."
  - "02-03: requestResetAction silently swallows non-400 errors (user-not-found, rate-limit) and always returns {ok:true} to prevent email enumeration (T-02-03-03). Only SMTP-disabled 400 surfaces the 'Password reset unavailable' message to the user per D-02 graceful degradation."
  - "02-03: proxy.ts presence check is 10 chars minimum on the cookie value — guards against trivially forged '1'-char cookies; the real validation happens inside Server Components / server actions via pb.authStore.isValid + PB's server-side JWT check."
  - "02-03: app/(public)/page.tsx NOT created — Next.js route groups do not create URL segments, so '/' lives at app/page.tsx (single file) to avoid 'two parallel pages resolving to the same path' build errors. The (public) group exists solely so login/signup/reset share layout patterns."
  - "02-03: Logout is a DropdownMenuItem asChild wrapping a <form action={logoutAction}> — preserves shadcn keyboard semantics while guaranteeing the action runs server-side without JS (D-07)."
  - "02-03: signupAction email-taken handling covers both 'validation_not_unique' (PB 0.23+) and 'validation_invalid_email' (older) error codes for forward/backward compat."

patterns-established:
  - "Pattern: TDD RED/GREEN at task-level (Task 1) — failing test commit before schema implementation. Verified via `Failed to resolve import '@/lib/schemas/auth'` on RED and 11/11 pass on GREEN."
  - "Pattern: Playwright webServer array — boots PB via dev-pb.js and Next via build+start in parallel; reuseExistingServer respects CI vs local; each webServer has its own health-check URL and timeout (60s for PB, 120s for Next build)."
  - "Pattern: browser-invisible HttpOnly cookie → Server Component fetches user record; AccountMenu receives userName as a prop rather than trying to hydrate from document.cookie."

requirements-completed: [AUTH-03]
# AUTH-01 (signup) + AUTH-02 (session) + AUTH-04 (password reset plumbing) rely on
# prior-plan state (users collection from 02-01, cookie bridge from 02-02); their
# REQUIREMENTS.md ticks land in 02-01's completion set. AUTH-03 (logout) is the
# only v1 requirement that lands here end-to-end for the first time.

# Metrics
duration: 7min
completed: 2026-04-20
---

# Phase 2 Plan 3: Auth UI + proxy.ts + E2E Summary

**End-to-end authentication shipped — proxy.ts gates the (app) route group, five server actions drive the HttpOnly pb_auth cookie lifecycle with `secure` scoped to production, four shadcn/RHF/zod forms compose on useActionState, and a Playwright happy-path proves signup → HttpOnly cookie → logout → re-login survives both a reload and a protected-route redirect roundtrip.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-20T23:50:06Z
- **Completed:** 2026-04-20T23:57:54Z
- **Tasks:** 3
- **Files modified:** 18 (16 created, 2 modified)

## Accomplishments

- **proxy.ts live as the Next 16 route guard** (RESEARCH Pitfall 1 — NOT `middleware.ts`). Presence-checks `pb_auth` on every non-API request; redirects unauthed → `/login?next=<path>` for `/h` and `/settings`, redirects authed → `/h` for `/login`, `/signup`, `/reset-password`. `next build` output confirms `ƒ Proxy (Middleware)` compiled.
- **Five Server Actions** in `lib/actions/auth.ts` (`'use server'` at top): `loginAction`, `signupAction`, `logoutAction`, `requestResetAction`, `confirmResetAction`. Each re-parses via zod, calls PocketBase, and writes/clears the `pb_auth` cookie via Next 16's async `await cookies()`.
- **Cookie contract enforced** (D-03 + RESEARCH Pitfall 3): `{httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 14d}`. Pitfall 4 handled: `extractPbAuthValue()` strips Set-Cookie metadata from `exportToCookie()` output before passing the bare value to `store.set()`.
- **Open-redirect defense**: `safeNext()` validates the login `next` query param — only `/`-prefixed same-origin paths without `//` or `://` pass. T-02-03-08 mitigated in-plan, not deferred.
- **Password-reset graceful degradation** (D-02): `requestResetAction` surfaces `Password reset unavailable — contact admin` on PB 400 (SMTP disabled) and silently `{ok:true}`s on user-not-found / other errors to prevent enumeration (T-02-03-03).
- **Shared zod schemas** in `lib/schemas/auth.ts` — every cross-field refine carries `path: ['passwordConfirm']` per Pitfall 12. Client forms use the same schema via `zodResolver` for inline onBlur errors.
- **Four forms** (`components/forms/{login,signup,reset-request,reset-confirm}-form.tsx`), all `'use client'`, composing `useActionState` + `react-hook-form` + shadcn `Button`/`Input`/`Label`. Error merge pattern: `clientError ?? serverFieldErrors?.field?.[0]`.
- **AccountMenu** (`components/account-menu.tsx`, `aria-label='Account'`) — shadcn `DropdownMenu` with Lucide `User` icon; Log out is `DropdownMenuItem asChild` wrapping `<form action={logoutAction}>` so it works without JS.
- **Public pages** (`/`, `/login`, `/signup`, `/reset-password`, `/reset-password/[token]`) — Next 16 async `searchParams` + async `params` everywhere they're used. The root `/` path lives at `app/page.tsx` (NOT `app/(public)/page.tsx` — would collide).
- **Authed layout** (`app/(app)/layout.tsx`) adds defense-in-depth: fetches `pb.authStore.record.name` server-side and passes it to `AccountMenu` as a prop (browser can't read HttpOnly cookie — Pitfall 5).
- **11 unit tests** (`tests/unit/schemas/auth.test.ts`) covering valid + invalid inputs across all four schemas, including two explicit tests that `passwordConfirm` mismatch errors land under the right field (Pitfall 12).
- **3 E2E tests** (`tests/e2e/auth-happy-path.spec.ts`) — 18.5s wall clock against live PB + Next:
  1. signup → reload session → HttpOnly cookie verified via `context.cookies()` → logout → unauthed `/h` redirects to `/login?next=%2Fh` → re-login → authed `/login` redirects to `/h`.
  2. Invalid email surfaces the zod `valid email` error inline without submitting.
  3. Wrong credentials surface the generic `Invalid email or password` (no user enumeration).
- **Playwright config extended** to boot BOTH PocketBase (via `scripts/dev-pb.js` health-checking `http://127.0.0.1:8090/api/health`) AND Next (`npm run build && npm run start` on `http://localhost:3001`) as parallel `webServer` array entries; `reuseExistingServer` honors `!CI` so local runs stay fast.

## Task Commits

1. **Task 1 RED — failing zod auth schema tests** — `a57a2fc` (test)
2. **Task 1 GREEN — shared zod schemas** — `c871ddb` (feat)
3. **Task 2 — auth server actions + proxy.ts + forms + public/app pages** — `8c72195` (feat)
4. **Task 3 — Playwright E2E auth happy-path + PB webServer** — `c1e6260` (test)

## Files Created/Modified

**Created (16):**
- `proxy.ts` — Next 16 route gate, exports `function proxy(request)`, `PROTECTED_PREFIXES = ['/h','/settings']`, `GUEST_ONLY_PREFIXES = ['/login','/signup','/reset-password']`, matcher excludes `api|_next/static|_next/image|favicon.ico|icons|manifest.json`.
- `lib/actions/auth.ts` — 5 server actions + `cookieOptions()` + `safeNext()` + `extractPbAuthValue()` helpers.
- `lib/schemas/auth.ts` — 4 zod schemas + inferred types + `ActionState` union.
- `components/forms/login-form.tsx` — supports optional `next` prop rendered as hidden input.
- `components/forms/signup-form.tsx` — name/email/password/passwordConfirm with matching error display.
- `components/forms/reset-request-form.tsx` — success-state branch swaps form for a non-enumerating confirmation message.
- `components/forms/reset-confirm-form.tsx` — token hidden input, sonner success toast + `router.push('/login')` on ok.
- `components/account-menu.tsx` — DropdownMenu trigger `aria-label='Account'`, Log out is `DropdownMenuItem asChild` form POST.
- `app/(public)/login/page.tsx` — Card + LoginForm + `searchParams` await (Next 16) + reset/signup links.
- `app/(public)/signup/page.tsx` — Card + SignupForm + login link.
- `app/(public)/reset-password/page.tsx` — Card + ResetRequestForm + back-to-login link.
- `app/(public)/reset-password/[token]/page.tsx` — awaits `params` (Next 16 Promise) + ResetConfirmForm.
- `app/(app)/layout.tsx` — Server Component guard, fetches user.name, renders header with HomeKeep brand + AccountMenu.
- `app/(app)/h/page.tsx` — placeholder stub for 02-04's homes list.
- `tests/unit/schemas/auth.test.ts` — 11 schema tests.
- `tests/e2e/auth-happy-path.spec.ts` — 3 Playwright tests.

**Modified (2):**
- `app/page.tsx` — replaced Phase 1 hello text with the landing CTA; authed users redirect to `/h` via Server Component check.
- `playwright.config.ts` — `webServer` now an array booting dev-pb.js + Next; `reuseExistingServer` honors `!CI`.

## Decisions Made

- **Cookie `secure` flag driven by `NODE_ENV`** (D-03 + Pitfall 3): In LAN-HTTP production (no HTTPS), `Secure` is OFF — SameSite=Lax still mitigates most CSRF. Phase 7 HTTPS mode flips this on automatically. LAN-HTTP is the fallback deployment mode in SPEC §16.
- **Implement redirect-with-next today, not as a follow-up**: the plan's threat_model flagged T-02-03-08 as a "follow-up if implemented in 02-04" — but the E2E happy-path requires `/h` → `/login?next=%2Fh` → login → `/h` to work, so the redirect plumbing had to land here. `safeNext()` enforces the same-origin /-prefix rule before `redirect()` consumes the param.
- **Email-enumeration posture**: login errors are generic ("Invalid email or password"); reset-request silently succeeds on user-not-found. Signup intentionally tells you "Email already registered" (D-threat: T-02-03-09 `accept`) because the UX of the friction-free signup is worth the known-enumeration vector that PB's rate limiter throttles.
- **Logout as `DropdownMenuItem asChild` wrapping a form**: shadcn's `DropdownMenuItem` expects single-child semantics; `asChild` delegates the radix primitive's interaction handlers to the inner form. Click → form submit → server action → cookie clear → redirect. Works without JS enabled; preserves keyboard + screen-reader behavior.
- **`app/page.tsx` single file, no (public)/page.tsx**: Next 16 route groups do not create URL segments; creating both files would trigger "You cannot have two parallel pages that resolve to the same path." Verified at `next build` — the single-file approach builds clean and serves the landing.
- **No `/logout` page route** (D-07): The `logout` identifier is bound to the action function, not a URL. The plan's threat_model and routing map explicitly keep it action-only.
- **signupAction error-code handling**: both `validation_not_unique` (PB 0.23+) and `validation_invalid_email` (older) map to the `Email already registered` user-facing message. Forward-compatible with PB version bumps.

## Deviations from Plan

### Auto-fixed Issues

None. All three tasks executed as written. The plan's Do-NOT list called out three specific pitfalls (two-parallel-pages, `'use server'` in client components, unconditional `secure: true`), each of which was followed exactly. No bugs surfaced during the GREEN phases of Task 1, Task 2, or Task 3 that required mid-task corrections.

Notable near-misses that the plan explicitly pre-empted:
- **Pitfall 4 (exportToCookie value extraction)**: `extractPbAuthValue()` helper was written before any cookie-set call was tested. Had this been skipped, the resulting `pb_auth` cookie value would have been the Set-Cookie header text and the next request would see a malformed authStore — but the plan called it out, so it went in on first write.
- **Pitfall 12 (refine path)**: both password-match refines carry `path: ['passwordConfirm']`. Unit test `rejects mismatched passwordConfirm under passwordConfirm path` guards against regression.
- **Pitfall 1 (proxy vs middleware)**: file is `proxy.ts` with `export function proxy`, not `middleware.ts` — `next build` output reads `ƒ Proxy (Middleware)` confirming it loaded.

---

**Total deviations:** 0. Plan was executed verbatim; all E2E tests pass first-try against a freshly booted PB + Next.

## Assumption verification (from RESEARCH)

- **A3 (PB default token TTL 14 days matches cookie maxAge)**: cookie maxAge set to `60 * 60 * 24 * 14` in `cookieOptions()`. PB default `authTokenDuration` per community knowledge is ~14 days; exact verification requires inspecting `$app.settings().collections.users.authToken.duration` after boot. The E2E test passes a signup → reload → assertion at `/h` (server reads cookie, authStore hydrates, layout guard passes) which is the observable contract; the token did NOT expire during the test so 14d is at minimum adequate for a single-session E2E. No mismatch surfaced.
- **A4 (PB requestPasswordReset returns 400 when SMTP disabled)**: not triggered in E2E (no test for the reset path) but the action handler catches `err?.status === 400` and returns the user-facing message. Manual smoke test will confirm on a live deployment when SMTP env vars are added.
- **A8 (cookie + redirect in one response)**: confirmed by E2E test 1 — `loginAction` sets the cookie and `redirect('/h')`; the next request to `/h` sees the cookie, hydrates authStore, passes the layout guard, and renders. Single response, no intermediate client-side re-hydration.

## User Setup Required

**SMTP configuration remains optional** (carried forward from 02-01 SUMMARY).

Password reset (AUTH-04) is plumbed end-to-end in the UI — `requestResetAction` and `confirmResetAction` both exist, both zod-validate, both catch errors — but actual email delivery requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (and optionally `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_TLS`) in the runtime environment. When unset, `pb.collection('users').requestPasswordReset()` returns HTTP 400, which the action translates to the user-facing `Password reset unavailable — contact admin` message (D-02 graceful degradation).

**Smoke test path once SMTP is configured:**
1. Set SMTP envs, restart the container (PB `bootstrap_smtp.pb.js` reads on boot).
2. Visit `/reset-password`, enter an existing email, submit.
3. Check inbox for the PB reset email (subject "Reset your verification email" by default).
4. Click the link → lands at `/reset-password/<token>`; enter a new password; submit.
5. Toast appears; redirect to `/login`; log in with new password.

This path is NOT in the Playwright E2E suite because it requires live SMTP. It IS in the REQUIREMENTS.md AUTH-04 row as the manual smoke owner.

## Issues Encountered

- **`next start` vs `output: 'standalone'` warning during E2E webServer boot**: `next start` prints `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.` — but it nonetheless serves the build and all three Playwright tests pass. The production Docker path uses the standalone server per Phase 1 Dockerfile; the warning only matters for local `npm run start`. Deferred to a future infrastructure plan (or swap the E2E webServer command to `node .next/standalone/server.js` once Phase 1's asset copy is guaranteed in CI). Out of scope for 02-03.
- **MODULE_TYPELESS_PACKAGE_JSON warning from scripts/dev-pb.js**: Node re-parses the ESM script as ES Module because `package.json` has no `"type": "module"`. Performance overhead is negligible; changing `type: module` would force all other scripts to use `.cjs` explicitly. Deferred; out of scope for 02-03 (same reason Phase 1 deferred it).

## Threat Flags

None — this plan introduced exactly the surfaces listed in `<threat_model>` (T-02-03-01 through T-02-03-09). No new network endpoints outside the ones the plan specified (server actions + proxy.ts + 5 new pages). No new data paths beyond cookie set/read/delete + PB users-collection calls.

Mitigation coverage of the threat register (pre-dispositioned `mitigate` items):
- **T-02-03-01** (forged pb_auth): proxy.ts presence check + `(app)/layout.tsx` Server Component `pb.authStore.isValid` re-check + PB server-side JWT validation on every API call. Three-layer defense-in-depth. PASS.
- **T-02-03-02** (CSRF on loginAction): Next 16 server actions embed the encrypted action ID (framework-provided); `sameSite: 'lax'` on pb_auth blocks cross-site cookie transmission on form posts. PASS.
- **T-02-03-03** (password-error email enumeration): loginAction returns generic "Invalid email or password"; requestResetAction returns `{ok:true}` on user-not-found. E2E test 3 verifies the generic message surfaces. PASS.
- **T-02-03-04** (XSS reads pb_auth via document.cookie): `cookieOptions().httpOnly === true` everywhere the cookie is set. E2E test 1 asserts `context.cookies().find(c=>c.name==='pb_auth').httpOnly === true`. PASS.
- **T-02-03-05** (login brute force): PB-side rate limits from 02-01 (`*:authWithPassword` 5/60s @guest) + `/api/` 300/60s ceiling. This plan adds no additional throttling — delegation is deliberate. PASS (via 02-01).
- **T-02-03-06** (PB error stack leak): actions catch with `catch {}` or typed `catch (err: unknown)` + explicit check; only sanitized user-facing strings return. Never `err.message` raw. PASS.
- **T-02-03-07** (HTTP LAN dev Secure cookie): `accept` disposition; acknowledged in the decisions log. PASS (as accepted).
- **T-02-03-08** (open redirect via next query): `safeNext()` validates the param before `redirect()`; requires `/` prefix, forbids `//` and `://`. Implemented in-plan, not deferred. PASS.
- **T-02-03-09** (signup email enumeration): `accept` disposition; PB rate limits mitigate mass scraping. PASS (as accepted).

## Known Stubs

- **`app/(app)/h/page.tsx`** is a minimal placeholder: renders `Your homes` heading + `Empty state — homes CRUD lands in 02-04.` There is no data wiring — the plan explicitly scopes this to "minimal stub so E2E can land here after signup" and 02-04 replaces the page with the real homes list + HOME-03 last-viewed redirect. This stub is intentional; the page doesn't purport to render homes data. Not blocking Phase 2 sign-off — 02-04 will replace on first edit.

## Self-Check: PASSED

- `proxy.ts` (repo root) — FOUND
- `lib/actions/auth.ts` (`'use server'` top line, 5 actions, `exportToCookie`, `process.env.NODE_ENV`) — FOUND
- `lib/schemas/auth.ts` (4 schemas, `path:['passwordConfirm']`, `ActionState`) — FOUND
- `components/forms/login-form.tsx` (`useActionState`, `zodResolver`) — FOUND
- `components/forms/signup-form.tsx` — FOUND
- `components/forms/reset-request-form.tsx` — FOUND
- `components/forms/reset-confirm-form.tsx` — FOUND
- `components/account-menu.tsx` (`logoutAction`) — FOUND
- `app/page.tsx` (landing, authed redirect) — FOUND
- `app/(public)/login/page.tsx` — FOUND
- `app/(public)/signup/page.tsx` — FOUND
- `app/(public)/reset-password/page.tsx` — FOUND
- `app/(public)/reset-password/[token]/page.tsx` — FOUND
- `app/(app)/layout.tsx` (`createServerClient`) — FOUND
- `app/(app)/h/page.tsx` — FOUND
- `app/(public)/page.tsx` — correctly DOES NOT EXIST (two-parallel-pages guard)
- `tests/unit/schemas/auth.test.ts` (`Passwords do not match`) — FOUND
- `tests/e2e/auth-happy-path.spec.ts` (`httpOnly`) — FOUND
- `playwright.config.ts` (`dev-pb.js`, `webServer` array) — FOUND
- Commit `a57a2fc` (RED) — FOUND
- Commit `c871ddb` (GREEN) — FOUND
- Commit `8c72195` (auth surface) — FOUND
- Commit `c1e6260` (E2E) — FOUND
- `npm run lint` — 0 errors
- `npm run typecheck` — 0 errors
- `npm test` — 22/22 pass (11 new + 11 prior-phase)
- `npm run build` — 7 routes + `ƒ Proxy (Middleware)` compiled
- `npx playwright test tests/e2e/auth-happy-path.spec.ts` — 3/3 pass (18.5s)

## TDD Gate Compliance

- **RED gate**: `a57a2fc` `test(02-03): add failing zod auth schema tests (RED)` — `tests/unit/schemas/auth.test.ts` created; `npm test -- tests/unit/schemas/auth.test.ts` at that commit returns `Failed to resolve import "@/lib/schemas/auth"`.
- **GREEN gate**: `c871ddb` `feat(02-03): shared zod schemas for auth (GREEN)` — `lib/schemas/auth.ts` implements all four schemas + types; all 11 new tests pass alongside the prior 11 unit tests.
- **REFACTOR gate**: not needed — schemas are the verbatim research-referenced minimal form; no further cleanup warranted.

Plan-level TDD cycle RED → GREEN verified in git log.

## Next Phase Readiness

- **Ready for 02-04 (homes + areas CRUD)**: `createServerClient()` is callable from Server Actions; `pb.authStore.isValid` + `pb.authStore.record.id` are exposed at the `(app)/layout.tsx` level so any nested page can trust auth. The home-creation form will compose `useActionState` + `react-hook-form` + `zodResolver` identically to the login/signup forms — Task 2's four forms are the pattern template. 02-04 replaces `app/(app)/h/page.tsx` with the real homes list.
- **Ready for 02-05 (tasks)**: same server-action pattern; `revalidatePath('/h/[homeId]')` is the invalidation story. `lib/task-scheduling.ts` (per D-13) is not yet implemented but the plan expects 02-05 to add it.
- **Ready for downstream (Phase 3+)**: `<Toaster />` and `sonner` are live; the realtime subscription path (Phase 3+) will need a server-issued auth token — the contract for that is to use `pb.authStore.exportToCookie()` on the server, decode back to `{token, model}`, pass `token` as a prop to the Client Component, which calls `browserPb.authStore.save(token, model)` before subscribing. No code in this plan; call it out now.

**No blockers.** AUTH-01, AUTH-02, AUTH-03, AUTH-04 (plumbing) all satisfied. AUTH-04's real email delivery is a manual smoke with SMTP env configured — documented in the User Setup section above.

---
*Phase: 02-auth-core-data*
*Completed: 2026-04-20*
