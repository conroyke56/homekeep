import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Geist, Lora } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { HOMEKEEP_BUILD as HK_BUILD_ID } from '@/lib/constants';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
// Lora: warm humanist serif per SPEC §19 ("readable serif or humanist sans for headings").
// Used for page titles, section headings, and the coverage-ring number.
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HomeKeep',
  description: 'Household maintenance, visible and evenly distributed.',
  // 07-01 (D-01, D-03): PWA manifest + iOS install affordance.
  // Next 16 emits `<link rel="manifest" href="/manifest.webmanifest">`
  // for the manifest field and `<link rel="apple-touch-icon">` for
  // icons.apple. The apple entry MUST be the 192px icon per D-03 —
  // iOS ignores the manifest icons[] for home-screen installs and
  // reads the apple-touch-icon link instead.
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HomeKeep',
  },
};

// 07-01 (D-01, D-03): Next 16 moved themeColor out of `metadata` and
// into a dedicated `viewport` export. Emits
// `<meta name="theme-color" content="#D4A574">` — browsers colour the
// address bar + PWA splash screen chrome with this value.
export const viewport: Viewport = {
  themeColor: '#D4A574',
};

// HOMEKEEP_BUILD (re-imported above as HK_BUILD_ID) is the public build
// fingerprint. It's injected at docker build via HK_BUILD_ID --build-arg and
// falls back to the 'hk-dev-local' sentinel when unset. See lib/constants.ts
// and .planning/phases/07-pwa-release/07-CONTEXT.md for the canary strategy.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable, lora.variable)}>
      <head>
        {/* Provenance marker — intentional, survives minification. Do not remove. */}
        <meta name="generator" content={`HomeKeep v1 (${HK_BUILD_ID})`} />
        <meta name="hk-build" content={HK_BUILD_ID} />
      </head>
      <body className="min-h-screen antialiased">
        {/* HomeKeep (https://github.com/conroyke56/homekeep) — AGPL-3.0-or-later. */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
