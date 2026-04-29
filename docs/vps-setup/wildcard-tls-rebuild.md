<!-- gitleaks:allow (vhost+config snippets, no secrets) -->
# Phase 40 — Wildcard TLS via DNS-01 (caddy-dns/godaddy plugin rebuild)

**Milestone:** v1.4-infra-cleanup-and-test-fix
**REQ:** INFRA-01
**Trigger:** `vps-followup-20260501.timer` fires 2026-05-01 10:00 UTC,
drops `/opt/vps/FOLLOWUP-2026-05-01.md` to surface the work.

## Context

`revproxy-caddy-1` currently issues per-subdomain certs via HTTP-01
on port 80. Works but slower to provision new subdomains and won't
cover wildcards. To get `*.the-kizz.com` wildcard via DNS-01 we need
a custom Caddy build with the `caddy-dns/godaddy` plugin compiled in.

Phase 34 (2026-04-24) decoupled revproxy to `/opt/vps/revproxy/` and
left it running on the upstream `caddy:2-alpine` image. This phase
swaps that for a locally-built image carrying the GoDaddy DNS plugin.

## Pre-flight checks (run first)

```bash
# Sanity: revproxy + dependents healthy NOW (rollback baseline)
docker ps --filter name=revproxy
curl -sI https://homekeep.demo.the-kizz.com/api/health | head -1
curl -sI https://sprout-m0.kizz.space/                  | head -1   # if sprout still serving
docker logs revproxy-caddy-1 --tail 30 --timestamps

# Confirm GoDaddy creds are reachable from the revproxy compose env
ls -l /etc/secrets/godaddy.creds
getfacl /etc/secrets/godaddy.creds | grep -i 'user:.*r'

# Confirm the timer dropped its FOLLOWUP file (sanity that we're acting on schedule)
ls -l /opt/vps/FOLLOWUP-2026-05-01.md
```

If ANY of the four service checks fail — STOP. Don't rebuild on a
sick revproxy.

## Change set

### 1. Drop a Dockerfile alongside the compose file

```bash
cat > /opt/vps/revproxy/caddy-godaddy/Dockerfile <<'EOF'
# Build Caddy 2.x with the caddy-dns/godaddy plugin baked in.
# Pinned to a specific Caddy minor for reproducibility; bump with
# the rest of the upstream image when revproxy upgrades wholesale.
FROM caddy:2.8-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/godaddy

FROM caddy:2.8-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
EOF

mkdir -p /opt/vps/revproxy/caddy-godaddy
mv /opt/vps/revproxy/caddy-godaddy/Dockerfile /opt/vps/revproxy/caddy-godaddy/Dockerfile  # idempotent
```

### 2. Update `/opt/vps/revproxy/docker-compose.yml`

Replace the existing `image: caddy:2-alpine` line with:

```yaml
services:
  caddy:
    build:
      context: ./caddy-godaddy
    # ... rest of service block unchanged
    environment:
      - GODADDY_API_KEY
      - GODADDY_API_SECRET
    env_file:
      - ./.env
```

(Keep `--network host`, the volume mounts, and the
`/etc/caddy/Caddyfile` mount as-is.)

### 3. Wire the credentials

```bash
# Copy GoDaddy creds INTO revproxy's local env (sourced format).
# /etc/secrets/godaddy.creds already contains:
#   GODADDY_API_KEY=...
#   GODADDY_API_SECRET=...
install -m 600 -o root -g root /etc/secrets/godaddy.creds /opt/vps/revproxy/.env
chmod 600 /opt/vps/revproxy/.env

# Sanity: file is shell-sourceable
( set -a; . /opt/vps/revproxy/.env; set +a; \
  test -n "$GODADDY_API_KEY" -a -n "$GODADDY_API_SECRET" \
    && echo "OK: env loadable" \
    || echo "FAIL: env empty" )
```

### 4. Update Caddyfile global block

Edit `/opt/vps/revproxy/Caddyfile` — add to the global options
block at the top of the file:

```caddyfile
{
    # Existing options preserved...
    acme_dns godaddy {env.GODADDY_API_KEY} {env.GODADDY_API_SECRET}
}
```

If a global block doesn't exist yet, create one above the first
site block.

### 5. Rebuild + restart

```bash
cd /opt/vps/revproxy
docker compose -p revproxy build
docker compose -p revproxy up -d

# Watch the cert provisioning (DNS-01 takes ~30-60s for propagation)
docker logs revproxy-caddy-1 --tail 100 --follow
# Look for: "obtained" + "*.the-kizz.com"
```

## Verification

```bash
# 1. Cert covers wildcard
echo | openssl s_client -connect homekeep.demo.the-kizz.com:443 \
  -servername homekeep.demo.the-kizz.com 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName

# Expect SAN list to include: DNS:*.the-kizz.com

# 2. Existing services still serve
curl -sI https://homekeep.demo.the-kizz.com/api/health | head -1
# Expect: HTTP/2 200

# 3. New subdomain provisions instantly via DNS-01 (no port-80 hit)
#    a. Add a test vhost
cat > /opt/vps/vhosts/test-wildcard.the-kizz.com.caddy <<'EOF'
test-wildcard.the-kizz.com {
    respond "wildcard test ok" 200
}
EOF
docker exec revproxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile

#    b. Resolve + curl
curl -sI https://test-wildcard.the-kizz.com/ | head -1
# Expect: HTTP/2 200 — should serve immediately if wildcard cert is in place

#    c. Clean up
rm /opt/vps/vhosts/test-wildcard.the-kizz.com.caddy
docker exec revproxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile

# 4. Caddy data persistence verified
docker exec revproxy-caddy-1 ls /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/
# Expect: a directory matching wildcard.the-kizz.com or similar
```

## Documentation update

Append a "Build flow" section to `/opt/vps/revproxy/README.md`:

```markdown
## Build flow (Phase 40 — wildcard TLS)

`revproxy-caddy-1` is built locally from
`./caddy-godaddy/Dockerfile`, which compiles Caddy with the
`caddy-dns/godaddy` plugin. This enables wildcard cert issuance via
DNS-01 challenge against GoDaddy's API.

To rebuild after a Caddy upstream version bump:

    cd /opt/vps/revproxy
    docker compose -p revproxy build --no-cache
    docker compose -p revproxy up -d

Credentials at `./.env` are sourced from `/etc/secrets/godaddy.creds`.
Rotate by re-running:

    install -m 600 -o root -g root \
      /etc/secrets/godaddy.creds /opt/vps/revproxy/.env
    docker compose -p revproxy restart caddy
```

## Rollback

If the rebuild breaks revproxy:

```bash
cd /opt/vps/revproxy

# Revert compose to the previous image-only directive
git -C /opt/vps/revproxy diff docker-compose.yml   # or check Caddy reports
# Manually edit docker-compose.yml: replace `build: ...` with `image: caddy:2-alpine`

docker compose -p revproxy up -d --force-recreate

# Existing per-subdomain HTTP-01 certs in caddy_data volume still valid;
# revproxy resumes serving on stored certs immediately.
```

The `caddy_data` named volume preserves the existing certs through
the rebuild — there's no cert-storage break, only the issuance path
changes.

## Closeout

```bash
# Disable + remove the timer
systemctl disable --now vps-followup-20260501.timer
rm /etc/systemd/system/vps-followup-20260501.{service,timer}
systemctl daemon-reload

# Remove the FOLLOWUP file
rm /opt/vps/FOLLOWUP-2026-05-01.md

# Log the work
mkdir -p /opt/vps/reports
cat > /opt/vps/reports/phase40-wildcard-tls-2026-05-01.md <<EOF
# Phase 40 — Wildcard TLS Rebuild (2026-05-01)

**Status:** shipped
**Commit:** N/A (out-of-tree work in /opt/vps/revproxy/)

caddy-dns/godaddy plugin compiled in. *.the-kizz.com cert
verified live; SAN list confirmed via openssl s_client.
homekeep.demo.the-kizz.com continued serving without
interruption. Test subdomain provisioned instantly (no port-80
hit) — DNS-01 path verified end-to-end.

Caddyfile global block updated with acme_dns godaddy directive.
EOF
```

## Reference

- Caddy DNS challenge plugins: https://github.com/caddyserver/caddy/wiki/Plugin-Repositories
- caddy-dns/godaddy: https://github.com/caddy-dns/godaddy
- xcaddy build instructions: https://caddyserver.com/docs/build
