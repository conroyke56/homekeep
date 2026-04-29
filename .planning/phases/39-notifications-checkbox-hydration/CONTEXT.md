<!-- gitleaks:allow (test fixture references, no secrets) -->
---
phase: 39
phase_name: Notifications Checkbox Hydration Root-Cause + Fix
parent_milestone: v1.4-infra-cleanup-and-test-fix
covered_reqs: [TESTFIX-07]
status: planned
---

# Phase 39 Context — Notifications Checkbox Hydration

## Background

v1.3 made three test-plumbing fix attempts on
`tests/e2e/notifications.spec.ts` Part 1 + Part 2:

1. `f04df45` — un-skipped + bumped `toBeChecked({timeout: 5_000})`.
2. `ffedf14` — replaced `.check()` with click+poll pattern.
3. `a3b7c7c` — replaced click+retry with single click + 10s wait.

All three failed. CI log on attempt 3 showed Playwright polling the
checkbox `checked` state 14 times over 10 seconds, with the input
**stuck at unchecked** AFTER the click event fired. This is not a
timing race a longer wait can fix.

`5bf1108` re-skipped both blocks with detailed TODO comments
deferring to v1.4. Unit coverage at
`tests/unit/lib/schemas/notification-prefs.test.ts` continues to
gate the schema + action paths.

## Root cause confirmed (H1)

The form root in `components/notification-prefs-form.tsx:100`
hardcodes a **string-literal** SSR attribute:

```tsx
<Card
  data-notification-prefs-form
  data-notifications-ready="true"   // ← always 'true', even pre-hydration
  ...
>
```

The E2E spec was written when the form was a Phase 5 placeholder
that didn't have RHF. Phase 6's real form added RHF `register()` to
attach refs + onChange handlers — but those refs only attach AFTER
client hydration runs. The `data-notifications-ready` attribute is
baked into the SSR HTML string and tells E2E "I'm ready" before
hydration even begins.

Playwright then:

1. Reads `data-notifications-ready="true"` from the hydration HTML.
2. Locates the checkbox (already visible in SSR markup).
3. Fires `click()` — browser updates DOM `checked = true` synchronously.
4. **No `onChange` handler is attached yet** — RHF's `register()`
   ref hasn't run because hydration is still in progress.
5. Hydration completes. React 19 reconciles its tree with the DOM.
   In some concurrent-mode codepaths, **React 19 re-syncs the
   uncontrolled input's `checked` back to its initial form value
   (`false`)** because RHF's defaultValues say so.
6. Playwright polls `toBeChecked()` — sees the post-reconciliation
   state — `false` forever.

This explains the 14-poll-stuck-unchecked symptom byte for byte.

## Fix approach (component-level, single PR)

**Primary fix:** make `data-notifications-ready` actually mean
"post-hydration." Replace the static literal with a `useState` +
`useEffect` flip pattern, then teach the test to wait for it.

```tsx
const [hydrated, setHydrated] = useState(false);
useEffect(() => { setHydrated(true); }, []);

// in JSX:
data-notifications-ready={hydrated ? 'true' : 'false'}
```

This is the same pattern already used in
`components/insecure-context-banner.tsx` (Phase 7 PWA, 07-01) and
matches the React 19 idiomatic "use external store for hydration
gating" guidance.

**Test side:** before the first checkbox interaction, add:

```ts
await expect(
  page.locator('[data-notification-prefs-form][data-notifications-ready="true"]'),
).toBeVisible({ timeout: 5_000 });
```

This blocks until RHF refs are attached + `onChange` is wired.

**Fallback (only if primary doesn't fully stabilize):** wrap the
weekly-summary checkbox in a `Controller`-driven shadcn-style
checkbox (controlled by RHF state rather than uncontrolled DOM).
Adds a Radix dependency we may not need. Decide based on CI signal
after primary fix lands.

## Files in scope

- `components/notification-prefs-form.tsx` — add hydration signal
  (small change, ~5 lines)
- `tests/e2e/notifications.spec.ts` — un-skip Part 1 + Part 2,
  insert `waitFor[data-notifications-ready=true]` before checkbox
  interaction
- `.planning/phases/39-notifications-checkbox-hydration/` — phase
  artifacts

## Out of scope

- Migrating other forms in the app to the same hydration signal —
  do it opportunistically as those tests flake, not preemptively.
- React 18 vs 19 bisect — only run if the primary fix fails CI.
- Any test-plumbing changes (timeouts, retries) beyond what's
  needed for the `data-notifications-ready` wait.

## Success criteria

1. Both `test.skip()` lines un-skipped in `notifications.spec.ts`.
2. `notifications.spec.ts` Part 1 + Part 2 pass green locally on a
   single Playwright run with no retries.
3. CI passes on the PR (1 cycle); soak counter advances toward the
   v1.3 10-consecutive-with-zero-retries criterion that's been
   stalled by no commits since 2026-04-24.
4. All 678 unit tests still green.
5. No regression in any other E2E spec (Phase 36 retry fix still
   covers the signup race).

## Decisions

- **D-01:** Hydration signal pattern uses `useState`+`useEffect`
  rather than `useSyncExternalStore`. Reason: `useSyncExternalStore`
  is overkill for a single boolean; the `set-state-in-effect` lint
  warning that pushed `insecure-context-banner` to the external
  store doesn't apply here because we run the effect ONCE
  (empty-deps array), not in response to external state.
- **D-02:** Single PR, primary fix only. Don't preemptively
  Controller-wrap the checkbox unless CI proves the primary
  insufficient.
- **D-03:** Don't migrate the same hydration signal pattern to
  other forms (`task-form`, `home-form`, etc.) in this phase —
  scope creep risk. Track as opportunistic v1.5 cleanup.
