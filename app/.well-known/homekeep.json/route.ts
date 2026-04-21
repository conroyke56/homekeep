// SPDX-License-Identifier: AGPL-3.0-or-later
// HomeKeep (c) 2026 — github.com/conroyke56/homekeep
import { NextResponse } from 'next/server';
import {
  HOMEKEEP_BUILD,
  HOMEKEEP_REPO,
  HOMEKEEP_LICENSE,
} from '@/lib/constants';

/**
 * Public provenance probe — /.well-known/homekeep.json
 *
 * A machine-readable, no-auth endpoint that announces:
 *   - what the app is
 *   - where its source lives
 *   - what licence it's under
 *   - which build UUID is serving the request
 *
 * No phone-home, no telemetry — purely read-only, originated from the server
 * that's serving it. Other repos / deploys that don't know about HomeKeep
 * simply won't ship this route.
 *
 * Runtime-dynamic: HK_BUILD_ID is injected by the Dockerfile `runtime`
 * stage, not the `builder` stage, so the value ONLY exists at container
 * boot time. Pre-rendering this endpoint at build time would snapshot the
 * 'hk-dev-local' sentinel into the bundle. `force-dynamic` keeps the
 * reference fresh while the `cache-control` header still gives us hourly
 * caching at the edge (Caddy/CDN) for essentially zero origin cost.
 *
 * Caddyfile note: /.well-known/* falls through the default `handle { }`
 * block to Next.js (it is neither /api/* nor /_/*), so no reverse-proxy
 * config change is needed.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  // Re-resolve HK_BUILD_ID from the container's live process.env so that
  // the response reflects the running image's fingerprint even in edge
  // cases where HOMEKEEP_BUILD may have been frozen at an earlier module
  // evaluation. HOMEKEEP_BUILD is still imported to keep the module in
  // the bundle graph (tree-shake guard).
  void HOMEKEEP_BUILD;
  const build = process.env.HK_BUILD_ID ?? 'hk-dev-local';

  return NextResponse.json(
    {
      app: 'HomeKeep',
      repo: HOMEKEEP_REPO,
      license: HOMEKEEP_LICENSE,
      build,
    },
    {
      headers: {
        'cache-control': 'public, max-age=3600',
      },
    },
  );
}
