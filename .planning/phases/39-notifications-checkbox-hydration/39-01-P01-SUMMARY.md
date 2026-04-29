<!-- gitleaks:allow (test references, no secrets) -->
---
phase: 39
plan: 39-01-P01
status: shipped_partial
covered_reqs: [TESTFIX-07]
shipped_part_1: true
shipped_part_2: false
new_followup_req: TESTFIX-08 (v1.5)
---

# Phase 39 Plan 01 Summary — Hydration Signal Fix

## What landed

**Component fix (5 lines):** `components/notification-prefs-form.tsx`
gained a `useState`+`useEffect` post-hydration signal. The
`data-notifications-ready` attribute now reads `"false"` in SSR HTML
and flips to `"true"` only after React commits the post-mount
effect, by which point RHF's `register()` refs are attached and
`onChange` handlers are wired.

```tsx
const [hydrated, setHydrated] = useState(false);
useEffect(() => { setHydrated(true); }, []);
// ...
data-notifications-ready={hydrated ? 'true' : 'false'}
```

**Test fix (Part 1):** `tests/e2e/notifications.spec.ts` Part 1
un-skipped + a hydration-gate assertion added before the checkbox
click:

```ts
await expect(
  page.locator(
    '[data-notification-prefs-form][data-notifications-ready="true"]',
  ),
).toBeVisible({ timeout: 5_000 });
```

## What didn't ship — Part 2 deferred to v1.5

Part 2 was un-skipped briefly, then **re-skipped** when local runs
revealed a separate, pre-existing bug masked by the v1.3 skip:

```
authPB notif-p2-...@test.local failed: 400 Bad Request
:: {"data":{},"message":"Failed to authenticate.","status":400}
```

Direct PB REST `POST /api/collections/users/auth-with-password`
fails for the freshly-signed-up user, even though the SAME
credentials succeeded in `signupAction`'s SDK `authWithPassword`
call moments earlier. Playwright's page snapshot confirms Part 2
DOES get past the hydration race — the form is interactive, the
checkbox click commits, the Save action fires, the success toast
is visible. The failure happens AFTER all that, on a totally
different code path.

This isn't TESTFIX-07's bug. It's a new finding that needed the
hydration fix to even surface. Logging it as **TESTFIX-08** for
v1.5; suspected causes documented inline in the spec's re-skip
TODO + tracked in v1.4 REQUIREMENTS for hand-off.

## Verification

```
npx vitest run                     → 678 passed (678)
npx playwright test tests/e2e/notifications.spec.ts
                                   → Part 1 ✓ 4.2s · Part 2 - skipped
npx tsc --noEmit                   → clean
```

The original v1.3 TESTFIX-02 symptom — checkbox stuck unchecked
through 14 polls over 10s — is **fully resolved**. Part 1 now
passes in 4.2s with first-try toBeChecked, no retries needed.

## Why the 5-line fix worked when 3 v1.3 attempts didn't

v1.3's three fix attempts were all on the test side: timeout
bumps, click+poll, click+wait. They were chasing a tick-race that
didn't exist. The actual bug was at the SSR→hydration→ref-attach
boundary in component code:

1. `data-notifications-ready="true"` was hardcoded as a literal in
   SSR HTML.
2. Playwright read it from hydration markup and considered the
   form "ready."
3. Clicked the checkbox.
4. RHF's `register()` ref hadn't attached the `onChange` handler
   yet (still mid-hydration).
5. Click fired — browser updated DOM `checked = true`
   synchronously, but no React state was updated.
6. Hydration completed. React 19 reconciled. The uncontrolled
   input snapped back to `defaultValues` (`false`).
7. Playwright polled `toBeChecked()` — saw `false` forever.

The hydration signal closes the race. Tests now wait for the
attribute flip, which can only happen AFTER React's first commit
cycle, by which time refs ARE attached.

## Headline lessons

1. **Read the test framework's symptom carefully before throwing
   timeouts at it.** v1.3's "14 polls over 10s, all unchecked"
   loglines were the single biggest clue — that's not "click hasn't
   committed yet," that's "click is being undone." Should have
   pointed at the SSR/hydration boundary on attempt 1.
2. **String-literal SSR attributes claiming "ready"-state are
   anti-patterns.** Anywhere this pattern appears, it lies to test
   harnesses. The few minutes to introduce a `useState`+`useEffect`
   flip pays for itself the first time it prevents a flaky-test
   spiral.
3. **Un-skipping a long-skipped test reveals two kinds of bugs at
   once.** Part 2's authPB 400 was hiding behind the v1.3 skip the
   whole time. Worth budgeting for when scoping un-skip work.

## Carry-forward to v1.5

- **TESTFIX-08:** root-cause + fix Part 2's `authPB` direct REST
  400 Bad Request. Diagnostic log message added to the helper to
  speed up the v1.5 investigation; kept on disk despite Part 2
  being skipped because it's strictly more informative than the
  bare `expect(res.ok()).toBeTruthy()` it replaced.
