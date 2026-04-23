# Phase 22: Emergency Deployment Hotfix — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Urgency:** Same-day — public VPS has admin UI visible right now

<domain>
## Phase Boundary

Triage 3 CRITICAL deployment exposures identified in `.planning/v1.2-security/research/public-facing-hardening.md`. Pure ops patch — no core app changes, no data migration. All fixes additive to v1.1.1.

**In scope (3 REQ-IDs):**
- HOTFIX-01 Block PB admin `/_/` from public at Caddy layer (LAN + prod compose)
- HOTFIX-02 Rotate live VPS secrets: PB_ADMIN_PASSWORD, ADMIN_SCHEDULER_TOKEN
- HOTFIX-03 Rotate GitHub PAT — replace classic PAT (admin:org, delete_repo, packages) with fine-grained PAT scoped to this repo only

**Out of scope (Phase 23+):**
- Template-literal filter sweep (SEC-01)
- Security headers (HDR-01..04)
- Rate limit changes (RATE-*)
- Demo architecture (DEMO-*)
- SECURITY.md (SECDOC-*)

**Deliverables:**
1. `docker/Caddyfile` + `docker/Caddyfile.prod` patched with `handle /_/* { respond 404 }` block BEFORE the reverse_proxy directive.
2. `docker/.env` on VPS regenerated with `openssl rand` for PB_ADMIN_PASSWORD (32 bytes base64) and ADMIN_SCHEDULER_TOKEN (32 bytes hex); file permission 600.
3. PB superuser password rotated via `pocketbase superuser update` exec inside the running container (matching new env value).
4. Fine-grained GitHub PAT created, old classic PAT revoked. `/root/projects/homekeep/.env` updated with new PAT.
5. VPS container restarted — verify health remains ok, `/_/` returns 404, scheduler endpoint requires new token.
</domain>

<decisions>
## Implementation Decisions

### HOTFIX-01: Admin UI block

- **D-01 (Caddy block at proxy layer):** PB admin UI is served by PB itself at `/_/`. Caddy reverse-proxies everything to the homekeep container which forwards to PB for `/_/*` paths. Block at Caddy BEFORE the reverse_proxy — this means PB still serves admin locally (for `docker exec` console work) but the internet can't reach it.
- **D-02 (404 not 403):** Return 404 so the admin UI is indistinguishable from "not installed". Reduces fingerprinting value for attackers.
- **D-03 (env-flag override):** `ALLOW_PUBLIC_ADMIN_UI=true` env can bypass the block for ops/debugging. Default is off. Document in README hardening checklist (Phase 28).

### HOTFIX-02: Live secret rotation

- **D-04 (PB_ADMIN_PASSWORD):** 32 bytes from `openssl rand -base64 32`. Saved to `docker/.env`. PB superuser updated via `docker exec homekeep pocketbase superuser update "${PB_ADMIN_EMAIL}" "${PB_ADMIN_PASSWORD}"`.
- **D-05 (ADMIN_SCHEDULER_TOKEN):** 32 bytes from `openssl rand -hex 32`. 64-char hex string. Used by `app/api/admin/run-scheduler/route.ts` token compare (still `!==` pre-Phase-23; SEC-03 will timing-safe it).
- **D-06 (permission 600):** `chmod 600 docker/.env` — owner read-write only.

### HOTFIX-03: PAT rotation

- **D-07 (fine-grained PAT scopes):** New PAT: Repository access = this repo only; Permissions = contents:read/write, packages:read/write, issues:read/write, pull requests:read/write, actions:read/write. NOT: admin:org, delete_repo, webhook:write.
- **D-08 (revoke old PAT):** Old classic PAT revoked in GitHub Settings → Developer settings → PAT → Revoke.
- **D-09 (user-driven step):** PAT rotation requires GitHub web UI clicks (creating + revoking). Document exact steps; user executes via browser while Claude confirms the env file gets updated.

### Verification

- **D-10 (post-patch checks):**
  - `curl -s http://46.62.151.57:3000/_/` → 404
  - `curl -s http://46.62.151.57:3000/api/health` → status ok
  - `docker compose logs homekeep | grep -i 'superuser'` → no errors on boot
  - `git push` with new PAT succeeds (confirms PAT works)
  - `git fetch` with old PAT fails (confirms old PAT revoked)

### Rollback

- **D-11 (rollback plan):** Keep old `.env` as `.env.pre-22` until verification complete. Caddy change is a single stanza — easy `git revert` if it breaks legit flows.

### Claude's Discretion
- Whether to also add Caddy rate-limit on `/_/*` path in addition to the block (belt + suspenders). Recommend: no — 404 is already safer.
- Whether to block PB admin API endpoints (`/api/_superusers`) too — recommend yes (same pattern).
</decisions>

<canonical_refs>
- `.planning/v1.2-security/research/public-facing-hardening.md` §C-1, §C-2, §C-3 (the 3 CRITICAL findings)
- `.planning/v1.2-security/research/attack-surface.md` §F-02 (admin UI exposure corroboration)
- `docker/Caddyfile` — LAN mode reverse-proxy
- `docker/Caddyfile.prod` — Caddy TLS overlay
- `docker/.env` — live secrets (VPS-specific copy)
- `/root/projects/homekeep/.env` — GitHub PAT
- `app/api/admin/run-scheduler/route.ts` — scheduler token compare site
- GitHub Settings → Developer settings → Personal access tokens (fine-grained)
</canonical_refs>

<deferred>
- SEC-03 timing-safe compare on scheduler token (Phase 23)
- HDR-01..04 security headers (Phase 24)
- RATE-05 auth rate-limit tighten (Phase 25)
- SECDOC-02 operator hardening checklist documenting /_/ block + PAT rotation policy (Phase 28)
</deferred>

---

*Phase: 22-emergency-deployment-hotfix*
