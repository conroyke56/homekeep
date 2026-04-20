import { defineConfig } from '@playwright/test';

/**
 * Playwright config — boots BOTH PocketBase and Next.js in parallel for
 * local / CI E2E runs. When E2E_BASE_URL is set (container-integration
 * mode), we assume both are already running and skip the webServer array.
 *
 * PB is booted via scripts/dev-pb.js so tests exercise the same migrations
 * + hooks as local dev (updated in 02-01 with --hooksDir).
 *
 * Next is built + started (not `next dev`) to run against the real
 * standalone output — this catches proxy.ts compilation issues that only
 * surface in `next build`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'node scripts/dev-pb.js',
          url: 'http://127.0.0.1:8090/api/health',
          timeout: 60_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'npm run build && npm run start',
          url: 'http://localhost:3001',
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
      ],
});
