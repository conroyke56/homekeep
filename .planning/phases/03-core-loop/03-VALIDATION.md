---
phase: 3
slug: core-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 3 — Validation Strategy

## Test Infrastructure
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + Playwright 1.x |
| Quick command | `npm run test` |
| Full suite | `npm run test && npm run test:e2e` |
| Runtime | ~110s unit / ~200s + e2e |

## Per-Plan Verification Map
| Plan | Requirement | Test Type | Command |
|------|-------------|-----------|---------|
| 03-01 | COMP-03, COMP-02, VIEW-05 | unit + integration | Vitest matrix on band/coverage/guard + completions migration integration |
| 03-02 | VIEW-01..04 | unit + component | Band/TaskRow/HorizonStrip render tests + coverage ring snapshot |
| 03-03 | COMP-01, VIEW-06 | e2e | Playwright: tap-to-complete, early-completion guard, task detail sheet |

## Wave 0 Requirements
- [ ] shadcn Sheet component installed (`npx shadcn@latest add sheet`)
- [ ] `lib/band-classification.ts`, `lib/coverage.ts`, `lib/early-completion-guard.ts` with passing Vitest matrices

## Manual-Only
- Coverage ring animation feel (subjective; spot-check on prefers-reduced-motion)
- Haptic tap feedback on real mobile device

**Approval:** pending
