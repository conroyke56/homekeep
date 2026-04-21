# Phase 07 — Deferred items

## Generated service worker lint noise (out of scope for 07-02)

- **File:** `public/sw.js` (Serwist-generated from `app/sw.ts` by `next build --webpack`)
- **Discovered:** 2026-04-21 during 07-02 lint sweep
- **Count:** 1 error (`@typescript-eslint/no-this-alias`) + ~85 warnings (`@typescript-eslint/no-unused-expressions`, `@typescript-eslint/no-unused-vars`)
- **Pre-existing:** yes — identical count when 07-02 changes are stashed (shipped by 07-01, Serwist precache blob is intentionally minified/anon-ed)
- **Why deferred:** `public/sw.js` is generated build output; committing it is already gitignored per 07-01 decision. The correct fix is an ESLint ignore entry for `public/sw.js` + `public/swe-worker-*.js`, not source edits. Not blocking v1 release.
- **Suggested follow-up:** add `public/sw.js` and `public/swe-worker-*.js` to `eslint.config.mjs` `ignores`. Sub-5-minute fix in a Phase 7.3 or post-v1 cleanup plan.
