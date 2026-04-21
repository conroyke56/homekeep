// SPDX-License-Identifier: AGPL-3.0-or-later
// HomeKeep (c) 2026 — github.com/conroyke56/homekeep
//
// Build provenance. `HK_BUILD_ID` is injected at docker build via --build-arg
// (see docker/Dockerfile + .github/workflows/release.yml). The sentinel
// 'hk-dev-local' is what local dev / unscripted-test builds see; any real
// build should have a unique UUID. See CANARY_STRATEGY.md.
//
// Tree-shake-resistant: scheduler.ts imports + logs HOMEKEEP_BUILD on
// startup, and app/layout.tsx renders it into `<meta name="hk-build">`,
// so the reference is always reachable from the production bundle graph.
export const HOMEKEEP_BUILD = process.env.HK_BUILD_ID ?? 'hk-dev-local';
export const HOMEKEEP_REPO = 'https://github.com/conroyke56/homekeep';
export const HOMEKEEP_LICENSE = 'AGPL-3.0-or-later';
