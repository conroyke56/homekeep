import PocketBase from 'pocketbase';

export function createClient(): PocketBase {
  if (typeof window === 'undefined') {
    // Server-side: inside the container, PocketBase is on loopback.
    // In dev, scripts/dev-pb.js also binds to 127.0.0.1:8090 so this works uniformly.
    return new PocketBase('http://127.0.0.1:8090');
  }
  // Browser: same origin. Caddy proxies /api/* and /_/* to PocketBase in production.
  // Per D-03, no build-time URL env is used — the SDK always matches the page origin.
  return new PocketBase(window.location.origin);
}
