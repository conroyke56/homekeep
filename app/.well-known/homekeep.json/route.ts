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
 * A machine-readable, cacheable, no-auth endpoint that announces:
 *   - what the app is
 *   - where its source lives
 *   - what licence it's under
 *   - which build UUID is serving the request
 *
 * Deliberately static + hourly-cached to keep it cheap on public networks.
 * No phone-home, no telemetry — purely read-only, originated from the server
 * that's serving it. Other repos / deploys that don't know about HomeKeep
 * simply won't ship this route.
 *
 * Caddyfile note: /.well-known/* falls through the default `handle { }`
 * block to Next.js (it is neither /api/* nor /_/*), so no reverse-proxy
 * config change is needed.
 */
export const dynamic = 'force-static';
export const revalidate = 3600;

export function GET() {
  return NextResponse.json(
    {
      app: 'HomeKeep',
      repo: HOMEKEEP_REPO,
      license: HOMEKEEP_LICENSE,
      build: HOMEKEEP_BUILD,
    },
    {
      headers: {
        'cache-control': 'public, max-age=3600',
      },
    },
  );
}
