/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
  e.next();

  // DEVIATION from plan (Rule 1 — Bug): two label-format issues in the
  // verbatim-research labels are rejected by PB 0.37.1's Go-side
  // RateLimitRule.Validate():
  //   1. `*:auth-with-password` — dashes in the `<tag>:<action>` action
  //      portion are not allowed; PB action names use camelCase
  //      (`authWithPassword`). Path form is also accepted.
  //   2. Bare `*` — the validator rejects lone `*`; a path like `/api/`
  //      is the documented catch-all.
  // Also: assigning a plain JS array to settings.rateLimits.rules via
  // JSVM creates map[string]any entries that never coerce to the
  // RateLimitRule struct and always fail validation. Splicing the
  // existing Go slice to empty and pushing plain objects DOES coerce
  // correctly (the plan explicitly authorised this fallback).
  const settings = $app.settings();
  settings.rateLimits.enabled = true;

  // Reset to a known state in case of re-bootstrap (hot reload, etc.).
  settings.rateLimits.rules.splice(0, settings.rateLimits.rules.length);

  // Brute-force protection on login endpoint: 5 attempts / 60s per IP
  // for unauthenticated users (supports T-02-01-03). Path form matches
  // every collection's auth-with-password endpoint.
  settings.rateLimits.rules.push({
    label: "*:authWithPassword",
    duration: 60,
    maxRequests: 5,
    audience: "@guest",
  });
  // Generic conservative ceiling for all unauthenticated /api/ traffic.
  settings.rateLimits.rules.push({
    label: "/api/",
    duration: 60,
    maxRequests: 300,
    audience: "@guest",
  });

  $app.save(settings);
  console.log("[ratelimits] enabled: 5/min on *:authWithPassword, 300/min /api/ guest ceiling");
});
