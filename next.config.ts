import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

/**
 * 07-01 (D-04, D-05) — wrap Next.js config with @serwist/next so
 * `npm run build` emits public/sw.js from app/sw.ts. Dev-mode SW
 * generation is disabled per D-04 to avoid stale precache during
 * hot-reload; service workers only ship in production builds.
 *
 * `output: 'standalone'` stays intact so the Phase 1 Dockerfile still
 * copies the minimal server tree.
 */
const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  register: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default withSerwist(nextConfig);
