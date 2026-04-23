# Phase 28: SECURITY.md + Responsible Disclosure — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Autonomous (docs-only)

<domain>
## Phase Boundary

Publish the public face of the security milestone: SECURITY.md with threat model + disclosure policy, operator hardening checklist, SPEC.md v0.5 changelog. Docs-only phase; no code changes. Closes v1.2-security.

**In scope (4 REQ-IDs):**
- SECDOC-01 `SECURITY.md` at repo root with full policy
- SECDOC-02 `docs/deployment-hardening.md` — 15-item operator checklist
- SECDOC-03 README + SPEC.md link to SECURITY.md; docs/deployment.md cross-references hardening checklist
- SECDOC-04 SPEC.md v0.5 changelog documenting every SEC/HDR/RATE/SUPPLY item with CVE-style IDs

**Out of scope:**
- PGP key generation (user-driven — placeholder key / email for now)
- Third-party disclosure platform integration (HackerOne / Bugcrowd) — deferred
- Public demo launch decisions

**Deliverables:**
1. `SECURITY.md` at repo root
2. `docs/deployment-hardening.md`
3. Updated `README.md` + `SPEC.md` with cross-links
4. `SPEC.md` bumped to v0.5 + changelog section documenting v1.2-security
</domain>

<decisions>
## Implementation Decisions

### SECDOC-01: SECURITY.md

Sections + content:

- **Supported versions** — table: v1.1.x (supported), v1.1.0-rc1 (no longer supported), earlier (none). Security patches backport to latest patch of the last minor only.
- **Threat model summary** — 3 paragraphs: (1) what HomeKeep protects (household data isolation, admin isolation, supply-chain integrity); (2) what it doesn't (no MFA, open signup by default, no PII minimization on notes field); (3) deployment model assumptions (LAN-only safe, Tailscale preferred, public requires `docs/deployment-hardening.md`).
- **Reporting a vulnerability** — email `security@<domain>` (placeholder — user fills). PGP key attached (placeholder `TBD`). Response SLA: 7 days acknowledgment, 90 days fix-or-public-disclosure.
- **Scope** — what's in scope for disclosure (HomeKeep code, official GHCR images, Caddy/compose config, PB migrations). Out of scope: self-hosted instances with custom modifications; user-operator error; third-party deps (report upstream).
- **Safe harbor** — standard OSS language: good-faith researchers welcome; no threat of legal action; credit via changelog.
- **Past advisories** — empty placeholder table; v1.2-security audit findings listed with `HKSEC-2026-001` through `HKSEC-2026-00N` IDs if appropriate (all fixed pre-publication though, so might not need advisories).

### SECDOC-02: deployment-hardening.md

15-item checklist drawn from `public-facing-hardening.md` §Operator hardening. Each item has: description, why, how (command or config snippet), verify step.

Items:
1. Set `DOMAIN` + use Caddy overlay (auto-TLS)
2. Generate `PB_ADMIN_PASSWORD` via `openssl rand -base64 32`
3. Generate `ADMIN_SCHEDULER_TOKEN` via `openssl rand -hex 32`
4. Set `docker/.env` permissions to 600
5. Verify `/_/` returns 404 (PB admin blocked)
6. Verify HTTP security headers present (CSP/HSTS/X-Frame/etc)
7. Configure firewall: only 80/443 open
8. Disable `ALLOW_PUBLIC_ADMIN_UI` in production
9. Rotate PAT to fine-grained scope (if deploying from CI)
10. Set `HK_BUILD_STEALTH=true` to redact build ID
11. Review & customize row quotas via env vars
12. Plan 90-day secret rotation
13. Monitor CSP report endpoint for violations
14. Subscribe to releases for security updates
15. Verify image signatures via `cosign verify`

### SECDOC-03: Cross-links

- `README.md` — "Security" section linking SECURITY.md (under "What it is" or a new top-level section)
- `SPEC.md` — "License" section follow-up: "See SECURITY.md for reporting vulnerabilities"
- `docs/deployment.md` — "Public deployment" section links to `deployment-hardening.md`

### SECDOC-04: SPEC.md v0.5 changelog

Bump Version: 0.4 → 0.5. Status: "Release-ready for v1.2.0-security" (not -rc1 since no new user-visible features; pure hardening).

New changelog section `### v0.5 — Red Team Audit & Public-Facing Hardening (2026-04-23)`:

- Discovery paragraph (4 researchers + reports location)
- Emergency hotfix: admin /_/ block, secret rotation
- Code attack surface: 27 filter sites parameterized, schedule_overrides body-check, timing-safe scheduler compare, updateTask cross-home, last_viewed_home_id IDOR closed, password min 12, proxy refresh
- HTTP headers: CSP-Report-Only, HSTS, X-Frame DENY, X-Content-Type, Referrer-Policy, Permissions-Policy. CSP report endpoint.
- Rate limits: row quotas (homes/tasks/areas), signup 10/60s, invite-accept 5/60s + lockout, auth 20/60s, ntfy topic 12-char+digit
- Demo architecture: docker-compose.demo.yml, per-visitor ephemeral home, 2h/24h cleanup
- Supply chain: cosign keyless signing, SBOM, SLSA-3 provenance, SHA-pinned actions, digest-pinned bases, dev-pb checksum, telemetry off

### Test scope

- **D-01 (validation):** grep-based — verify all 4 files present + key strings found. No unit tests (pure docs).

### Versioning

- **D-02 (SPEC v0.5):** Pure hardening milestone = minor bump (no breaking change). Tag `v1.2.0` after Phase 28 ships.

### Claude's Discretion
- Exact email address — placeholder `security@homekeep.local` or use the maintainer's primary; user decides.
- PGP key — placeholder now, user generates real key later.
- Safe-harbor language — modeled on Dropbox / GitHub policies.
</decisions>

<canonical_refs>
- `.planning/v1.2-security/research/*` — all 4 research reports
- `.planning/phases/22-28-*/*-SUMMARY.md` — per-phase deliverables for the changelog
- `SPEC.md` — v0.5 bump target
- `README.md` — cross-link target
- `docs/deployment.md` — cross-link target
</canonical_refs>

<deferred>
- Real PGP key (user action)
- HackerOne / Bugcrowd listing (v1.3+)
- Numbered advisory site `security.homekeep.example` (v1.3+)
</deferred>

---

*Phase: 28-security-md-disclosure*
