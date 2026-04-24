# Phase 34 — Decouple shared reverse proxy from sprout user

**Audience:** a Claude Code session running as root (or a user with
full sudo) on `aom-wiki` (46.62.151.57).

**Purpose:** migrate the shared reverse-proxy Caddy (`revproxy-caddy-1`)
out of `/home/sprout/revproxy/` and into `/opt/vps/revproxy/`, with
vhost drops relocated to `/opt/vps/vhosts/` (POSIX-ACL'd so each
service user can drop their own project's vhost without needing
sprout's permission). After this phase, `sprout` becomes a peer
tenant alongside `homekeep`, `claude-dev`, etc. — no longer "the ops
user."

**Idempotency:** every task has `verify` → `skip if already done` →
`apply`. Safe to re-run; safe to abort mid-run.

---

## Paste this one line into root Claude to execute

```
Read @/srv/homekeep/docs/vps-setup/phase-34-directive.md and execute the Tasks section end-to-end. Preserve Caddy's ACME state (certs + account data) during the move so Let's Encrypt doesn't re-register or re-fetch. Expect ~10-30 sec of edge downtime on revproxy recreate; announce in the report but don't pause for confirmation. Ask before touching anything in /home/sprout/ OTHER than revproxy/ (the revproxy migration is authorized; sprout's other files are off-limits). Write the completion report to /opt/vps/reports/phase-34-<timestamp>.md. At the end, print TWO resume prompts — one for homekeep Claude, one for sprout Claude — so I can paste each into the matching session.
```

---

## Context: why this phase exists

The shared reverse proxy currently lives in `/home/sprout/revproxy/`
because sprout was the first user and handled ops. But the revproxy
serves **every project on the VPS** (`aom-wiki`, `homekeep`,
`homekeep-demo`, future projects). This creates a false coupling —
HomeKeep's demo-deploy blocks on "sprout needs to let me drop a vhost
file," which is architecturally backwards. Shared infrastructure
should live under a neutral root-owned location with ACL access for
consumers, not inside one tenant's home dir.

### What changes

| Before | After |
|---|---|
| `/home/sprout/revproxy/Caddyfile` | `/opt/vps/revproxy/Caddyfile` |
| `/home/sprout/revproxy/docker-compose.yml` | `/opt/vps/revproxy/docker-compose.yml` |
| `/home/sprout/revproxy/data/` (ACME state) | `/opt/vps/revproxy/data/` |
| `/home/sprout/revproxy/config/` (Caddy cache) | `/opt/vps/revproxy/config/` |
| `/home/sprout/revproxy/vhosts/*.caddy` | `/opt/vps/vhosts/*.caddy` (ACL'd for project users) |
| Vhost drop requires sprout write access | Each project user drops into `/opt/vps/vhosts/` directly |
| Sprout is "the ops user" | Sprout is a peer tenant running Sprout M0, nothing more |

### What does NOT change

- Container name stays `revproxy-caddy-1` (compose project `revproxy`)
- Image stays `caddy:2-alpine` (plugin rebuild for wildcard TLS is
  a separate, deferred item — see `FOLLOWUP-2026-05-01.md`)
- Host-network binding, Let's Encrypt HTTP-01 challenges, all TLS
  certs (preserved via the data/ copy) — unchanged
- Sprout's own files: `/home/sprout/bin/gd-add-subdomain`,
  `/home/sprout/.config/godaddy/credentials`, Sprout M0 project,
  shell history, etc. — all stay with sprout
- Individual project docker stacks (homekeep, aom-wiki, homekeep-demo)
  — completely unaffected
- `/etc/secrets/godaddy.creds`, `/opt/vps/CLAUDE.md`,
  `/opt/vps/PORTS.md`, `/etc/gitignore-vps-baseline` — already in
  good locations, no changes

### Non-goals

- Do **NOT** rotate any secrets
- Do **NOT** change Caddy image or plugins
- Do **NOT** touch sprout's other projects or personal files
- Do **NOT** delete `/home/sprout/revproxy/` in this phase — leave
  as read-only fallback for 7 days; a subsequent cleanup task (or
  sprout themselves) removes it after confirmation the migration is
  stable
- Do **NOT** migrate `gd-add-subdomain` unless sprout requests —
  sprout may still want to own that helper

## Pre-flight (run first, bail if any check fails)

```bash
# Not already migrated?
if [ -d /opt/vps/revproxy ] && [ -f /opt/vps/revproxy/docker-compose.yml ]; then
  echo "Phase 34 appears already partially/fully done. Read existing"
  echo "state at /opt/vps/revproxy/ and compare to /home/sprout/revproxy/"
  echo "before proceeding. If fully done, write a completion report"
  echo "noting 'no-op — already migrated' and exit."
fi

# Source compose directory exists?
test -d /home/sprout/revproxy \
  && test -f /home/sprout/revproxy/docker-compose.yml \
  && test -f /home/sprout/revproxy/Caddyfile \
  && test -d /home/sprout/revproxy/data \
  && test -d /home/sprout/revproxy/vhosts \
  && echo "pre-flight: source looks complete"

# Revproxy currently running?
docker inspect revproxy-caddy-1 --format '{{.State.Status}}' 2>/dev/null \
  | grep -q running && echo "pre-flight: source revproxy is running"

# /opt/vps/ is writable by root?
touch /opt/vps/.writable-test && rm /opt/vps/.writable-test && echo "pre-flight: /opt/vps/ writable"

# No other vhost drop location already exists?
test -d /opt/vps/vhosts && echo "NOTE: /opt/vps/vhosts already exists — will merge, not clobber"
```

## Tasks

Each task follows `verify` → `apply` → `post-verify`. Rollback notes
at the end of each.

### Task 1 — Create `/opt/vps/revproxy/` structure + `/opt/vps/vhosts/`

**Verify:**
```bash
[ -d /opt/vps/revproxy ] && [ -d /opt/vps/vhosts ] && echo "structure exists, skip to Task 2"
```

**Apply:**
```bash
# New revproxy home — mode 755 so anyone can traverse to read Caddyfile
install -d -m 755 -o root -g root /opt/vps/revproxy
install -d -m 700 -o root -g root /opt/vps/revproxy/data       # Caddy state (certs)
install -d -m 755 -o root -g root /opt/vps/revproxy/config

# Shared vhost drop location — root-owned, secrets group, default ACL for
# each service user so new vhost files they create are writable by them
# AND readable by the revproxy container (which runs as root inside).
install -d -m 775 -o root -g secrets /opt/vps/vhosts

# Default ACLs — NEW files dropped here inherit these perms
setfacl -d -m u:homekeep:rwx /opt/vps/vhosts
setfacl -d -m u:claude-dev:rwx /opt/vps/vhosts
setfacl -d -m u:sprout:rwx /opt/vps/vhosts
setfacl -d -m g::rx /opt/vps/vhosts
setfacl -d -m o::rx /opt/vps/vhosts

# Named ACLs on the dir itself (for existing file access + write)
setfacl -m u:homekeep:rwx /opt/vps/vhosts
setfacl -m u:claude-dev:rwx /opt/vps/vhosts
setfacl -m u:sprout:rwx /opt/vps/vhosts
```

**Post-verify:**
```bash
getfacl /opt/vps/vhosts
# Expected: named ACLs for homekeep, claude-dev, sprout all with rwx
# + default ACL mirroring same pattern.

# Smoke test — can homekeep write?
sudo -u homekeep touch /opt/vps/vhosts/.homekeep-write-test \
  && rm /opt/vps/vhosts/.homekeep-write-test \
  && echo "homekeep can write ✓"
```

**Rollback:** `rm -rf /opt/vps/revproxy /opt/vps/vhosts`. No other state touched.

### Task 2 — Copy Caddy state atomically to new home (ACME preservation)

This is the CRITICAL step — Caddy's `data/` dir contains Let's Encrypt
account registration + private keys + issued certs. Copying it
**preserves** those so the new container picks up where the old left
off. If we skip this, the new Caddy re-registers with Let's Encrypt
and re-fetches every cert → rate limits, brief 502s on cold cert
request.

**Verify:**
```bash
[ -s /opt/vps/revproxy/data/caddy/acme/acme-v02.api.letsencrypt.org-directory/users/*/metadata.json ] \
  && echo "ACME state already at destination, skip copy"
```

**Apply:**
```bash
# Rsync preserves perms, times, symlinks, sparse files.
# Trailing slashes matter — copy *contents* of source, not source dir itself.
rsync -aHAX --delete /home/sprout/revproxy/data/    /opt/vps/revproxy/data/
rsync -aHAX --delete /home/sprout/revproxy/config/  /opt/vps/revproxy/config/

# Caddyfile + compose — copy, will edit after.
install -m 644 -o root -g root /home/sprout/revproxy/Caddyfile \
  /opt/vps/revproxy/Caddyfile
install -m 644 -o root -g root /home/sprout/revproxy/docker-compose.yml \
  /opt/vps/revproxy/docker-compose.yml

# Existing vhost files — migrate into the new shared location.
# Loop so we can see each one copy (not rsync --delete, don't want to
# blow away any vhost the earlier Phase 33 already dropped at
# /opt/vps/vhosts/ if any).
for v in /home/sprout/revproxy/vhosts/*.caddy; do
  [ -f "$v" ] || continue
  base=$(basename "$v")
  if [ -f "/opt/vps/vhosts/$base" ]; then
    echo "skip: $base already at destination"
  else
    install -m 644 -o root -g secrets "$v" "/opt/vps/vhosts/$base"
    # Set ACL for each service user to edit their own vhost going forward
    # (simplified — every service user can edit any vhost here; the
    # expectation is "drop your own project's vhost". Stricter per-file
    # ACLs are a follow-up if operational discipline needs tightening.)
  fi
done
```

**Post-verify:**
```bash
ls -la /opt/vps/revproxy/
diff -q /home/sprout/revproxy/Caddyfile /opt/vps/revproxy/Caddyfile && echo "Caddyfile match ✓"
ls /opt/vps/vhosts/*.caddy | wc -l  # count should match /home/sprout/revproxy/vhosts/*.caddy
```

**Rollback:** `rm -rf /opt/vps/revproxy/data /opt/vps/revproxy/config /opt/vps/revproxy/Caddyfile /opt/vps/revproxy/docker-compose.yml /opt/vps/vhosts/*.caddy`. Source at `/home/sprout/revproxy/` unchanged.

### Task 3 — Edit the new `docker-compose.yml` to use `/opt/vps/` paths

The copied `docker-compose.yml` still references `./data`, `./config`,
`./Caddyfile`, `./vhosts` — those resolve relative to the compose-file
dir. Since we're running from `/opt/vps/revproxy/`, those relative
paths now resolve correctly to the new locations FOR THE FIRST THREE.
But the vhosts dir moved to `/opt/vps/vhosts/` (not
`/opt/vps/revproxy/vhosts/`), so THAT bind-mount needs an explicit
path edit.

**Verify:**
```bash
grep -c '/opt/vps/vhosts' /opt/vps/revproxy/docker-compose.yml
# Expected: >= 1 after apply
```

**Apply:** edit `/opt/vps/revproxy/docker-compose.yml`. Change the
vhosts bind mount from `./vhosts:...` to `/opt/vps/vhosts:...`:

```yaml
    volumes:
      - ./data:/data
      - ./config:/config
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - /opt/vps/vhosts:/etc/caddy/vhosts:ro    # ← absolute, not ./vhosts
```

Also verify the compose file has no other relative paths pointing
outside the new dir (env_file, build context, etc.). If any, convert
to absolute or copy the referenced files into `/opt/vps/revproxy/`.

**Post-verify:**
```bash
cd /opt/vps/revproxy
docker compose config --quiet && echo "compose config parses ✓"
grep -n 'vhosts' docker-compose.yml
```

### Task 4 — Edit Caddyfile if needed (likely no change)

The main `Caddyfile` currently has an `import` directive for the
vhosts. With the new bind mount (`/opt/vps/vhosts → /etc/caddy/vhosts`),
the in-container path stays `/etc/caddy/vhosts` — same as before —
so the `import /etc/caddy/vhosts/*.caddy` line needs no change.

**Verify:**
```bash
grep -E 'import\s+/etc/caddy/vhosts' /opt/vps/revproxy/Caddyfile \
  && echo "import directive correct — no change needed"
```

If the import line uses an absolute host path (`/home/sprout/...`)
instead of the in-container path (`/etc/caddy/vhosts`), change it.
Host paths in a Caddyfile inside a container are wrong anyway; fix
it if present.

### Task 5 — Graceful swap (brief ~10-30 sec outage window)

This is the only task with observable impact. Announce in the report
that edge traffic pauses for ~10-30 sec during container recreate.

**Apply (fast, no pauses):**
```bash
# Stop the old stack — this releases the container name and host
# network bindings (80/443).
cd /home/sprout/revproxy && docker compose -p revproxy down

# Start the new stack — same compose project name ("revproxy") so
# the container name remains "revproxy-caddy-1". Caddy reads its
# state from the copied data/ dir and resumes immediately without
# re-ACMEing.
cd /opt/vps/revproxy && docker compose -p revproxy up -d

# Wait for healthy state
sleep 5
docker inspect revproxy-caddy-1 --format '{{.State.Status}}'
```

**Post-verify:**
```bash
# All previously-served domains still respond?
for domain in $(grep -hoE '^\S+\.the-kizz\.com' /opt/vps/vhosts/*.caddy /opt/vps/revproxy/Caddyfile 2>/dev/null | sort -u); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' "https://$domain/" --max-time 5)
  echo "$domain: HTTP $code"
done

# Also test any aom-wiki / Sprout-M0 domains by sampling /etc/hosts
# or sprout's known port. At minimum check the Caddy container's
# own admin API health:
docker exec revproxy-caddy-1 wget -qO- http://localhost:2019/config/ \
  | head -c 100 && echo "... Caddy admin API responsive ✓"
```

**Rollback (if new stack misbehaves):**
```bash
cd /opt/vps/revproxy && docker compose -p revproxy down
cd /home/sprout/revproxy && docker compose -p revproxy up -d
# Source state was not modified; restarting from source is clean.
```

### Task 6 — Update `/opt/vps/CLAUDE.md` to codify the new layout

Future Claude sessions on any user learn the new structure from the
shared manual. This is how "Claude's knowledge for future projects"
propagates.

**Apply:** edit `/opt/vps/CLAUDE.md`. Find and replace these sections:

1. Under **Host** / **Projects live under**:
   ```
   - `/home/sprout/<stuff>/` — sprout-owned ops: revproxy-caddy, godaddy
     creds, primary dev work
   ```
   REPLACE with:
   ```
   - `/opt/vps/<thing>/` — VPS-wide shared infrastructure (revproxy,
     reports, PORTS.md ledger, bin helpers). Root-owned, ACL'd for
     project users as needed.
   - `/home/sprout/<stuff>/` — sprout's personal dev work (Sprout M0
     etc.). Peer tenant; no special ops status as of Phase 34.
   ```

2. Under **Multi-project serving pattern** → **TLS**:
   ```
   - Caddyfile at `/home/sprout/revproxy/Caddyfile` imports vhosts from
     `/home/sprout/revproxy/vhosts/*.caddy`.
   ```
   REPLACE with:
   ```
   - Caddyfile at `/opt/vps/revproxy/Caddyfile` imports vhosts from
     `/opt/vps/vhosts/*.caddy`. Project users drop their own project's
     vhost directly into `/opt/vps/vhosts/` — ACL'd for write (Phase 34).
   ```

3. Under **Per-project onboarding checklist** step 5:
   ```
   # 5. Caddy vhost
   cat > "/home/sprout/revproxy/vhosts/$PROJECT.caddy" <<EOF
   ```
   REPLACE with:
   ```
   # 5. Caddy vhost — drop into the shared /opt/vps/vhosts/ location.
   # As project user, you have ACL write access (inherited from default
   # ACL on the dir, granted in Phase 34).
   cat > "/opt/vps/vhosts/$PROJECT.caddy" <<EOF
   ```

4. Step 6 in the onboarding:
   ```
   docker exec revproxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
   ```
   stays the same (container name unchanged).

5. Add a new block near the top of the file, under the intro:
   ```
   ### Shared infrastructure locations (root-owned, project users ACL'd)
   
   | Path | Owner | Purpose |
   |---|---|---|
   | /opt/vps/CLAUDE.md | root:root 644 | this file; imported by each service user |
   | /opt/vps/PORTS.md | root:root 644 | port allocation ledger |
   | /opt/vps/revproxy/ | root:root | shared reverse proxy (Phase 34) |
   | /opt/vps/vhosts/ | root:secrets 775 + default ACL rwx:homekeep,claude-dev,sprout | per-project vhost snippets |
   | /etc/secrets/ | root:secrets | shared creds (godaddy.creds, future: ntfy.creds, etc.) |
   | /etc/gitignore-vps-baseline | root:root 644 | system-wide git excludesFile |
   | /opt/vps/bin/ | root:root | shared helper scripts |
   | /opt/vps/reports/ | root:root 755 | Claude-session execution reports |
   | /opt/vps/FOLLOWUP-*.md | root:root 644 | surfaced by systemd timers for deferred work |
   ```

Also bump the `Install location` line near the top to reflect that
imports (not symlinks) are the actual propagation mechanism — already
captured in the deviation note of the Phase 33 report.

**Post-verify:** sync the repo source to match:
```bash
# Update the canonical source in the homekeep repo so next sync
# shows diff=empty. root can't push git directly, but it can cp
# the file back so the homekeep user sees the update next session.
install -m 664 -o homekeep -g homekeep-dev \
  /opt/vps/CLAUDE.md \
  /srv/homekeep/docs/vps-setup/CLAUDE.md.proposed
```

The homekeep Claude will notice the updated file on its next session
and commit the change to the repo.

### Task 7 — Mark the old sprout location as deprecated (keep for 7 days)

Do NOT delete `/home/sprout/revproxy/` yet. Instead, drop a README
there so anyone (or any Claude session) reading that dir in the next
week knows it's superseded:

**Apply:**
```bash
cat > /home/sprout/revproxy/MIGRATED-TO-OPT-VPS.md <<EOF
# Revproxy migrated to /opt/vps/revproxy/

As of $(date -u -Iseconds), the shared reverse proxy no longer lives
here. See /opt/vps/revproxy/ (compose, Caddyfile, data, config) and
/opt/vps/vhosts/ (where project users drop their own vhosts).

Migration was Phase 34 (HomeKeep GSD). Full report at
/opt/vps/reports/phase-34-$(date -u +'%Y-%m-%dT%H-%M-%SZ').md.

This directory will be removed after one week of stable operation on
the new location — around $(date -u -d '+7 days' +%Y-%m-%d). Until
then it's kept as a rollback fallback.

Do NOT:
- Edit files here (changes won't affect live traffic)
- Run docker compose up from here (would collide with /opt/vps/revproxy)

Do:
- Drop new vhost snippets into /opt/vps/vhosts/ as your project user
- Check /opt/vps/CLAUDE.md "Shared infrastructure locations" table
EOF

chown sprout:sprout /home/sprout/revproxy/MIGRATED-TO-OPT-VPS.md
```

Also create a follow-up systemd timer (like Phase 33 did for
`2026-05-01`) to surface the "old dir is safe to remove" reminder at
`now + 7 days`:

```bash
STAMP=$(date -u +%Y%m%d)
FIRE_DATE=$(date -u -d '+7 days' +'%Y-%m-%d %H:00:00')
cat > /opt/vps/bin/followup-phase34-cleanup.sh <<EOF
#!/bin/sh
# Phase 34 cleanup reminder — surfaces after 7 days of stable operation.
REPORT="/opt/vps/FOLLOWUP-PHASE34-CLEANUP.md"
cat > "\$REPORT" <<'INNER'
# Phase 34 cleanup — safe to remove /home/sprout/revproxy/

Seven days have passed since the Phase 34 revproxy migration. If the
new location at /opt/vps/revproxy/ has been stable, remove the old
sprout-home copy:

  ls -la /home/sprout/revproxy/   # review what's there one last time
  rm -rf /home/sprout/revproxy/   # delete (sprout does this, not root)

Or sprout can just move the MIGRATED-TO-OPT-VPS.md README somewhere
else and keep the empty dir if they have sentimental attachment.

Verify revproxy still healthy before + after:
  docker inspect revproxy-caddy-1 --format '{{.State.Status}}'
  curl -sk https://homekeep.the-kizz.com/api/health
INNER
chmod 644 "\$REPORT"
EOF
chmod 755 /opt/vps/bin/followup-phase34-cleanup.sh

cat > /etc/systemd/system/vps-followup-phase34-cleanup.service <<EOF
[Unit]
Description=Phase 34 cleanup reminder

[Service]
Type=oneshot
ExecStart=/opt/vps/bin/followup-phase34-cleanup.sh
EOF

cat > /etc/systemd/system/vps-followup-phase34-cleanup.timer <<EOF
[Unit]
Description=Fire Phase 34 cleanup reminder 7 days after migration

[Timer]
OnCalendar=$FIRE_DATE
Persistent=true
Unit=vps-followup-phase34-cleanup.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now vps-followup-phase34-cleanup.timer
```

## Reporting

After all tasks complete (or skip with reason), write the report.
Same pattern as Phase 33: timestamped file in `/opt/vps/reports/`,
per-task outcome, deviations documented, TWO resume prompts (one
per Claude session that cares about the change).

```bash
REPORT="/opt/vps/reports/phase-34-$(date -u +'%Y-%m-%dT%H-%M-%SZ').md"

{
  echo "# Phase 34 — Revproxy decoupling report"
  echo ""
  echo "- timestamp: $(date -u -Iseconds)"
  echo "- executed as: $(id)"
  echo "- source doc: /srv/homekeep/docs/vps-setup/phase-34-directive.md"
  echo ""
  echo "## Task outcomes"
  echo ""
  echo "### Task 1 — /opt/vps/revproxy/ + /opt/vps/vhosts/"
  echo '```'
  ls -la /opt/vps/revproxy/ /opt/vps/vhosts/
  echo ""
  getfacl /opt/vps/vhosts | grep -E '^(user|group|other|default)'
  echo '```'
  echo ""
  echo "### Task 2 — Caddy state copied (ACME preserved)"
  echo '```'
  du -sh /opt/vps/revproxy/data /opt/vps/revproxy/config /opt/vps/vhosts
  echo ""
  ls /opt/vps/vhosts/*.caddy 2>&1 | head -10
  echo '```'
  echo ""
  echo "### Task 3 — docker-compose.yml edited"
  echo '```'
  grep -nE 'vhosts|volume' /opt/vps/revproxy/docker-compose.yml
  echo '```'
  echo ""
  echo "### Task 4 — Caddyfile import directive"
  echo '```'
  grep -nE 'import' /opt/vps/revproxy/Caddyfile
  echo '```'
  echo ""
  echo "### Task 5 — Graceful swap"
  echo '```'
  docker inspect revproxy-caddy-1 --format '{{.Name}} {{.State.Status}} started={{.State.StartedAt}}'
  echo ""
  echo "Downtime window observed: <fill in — eyeball between down and up timestamps>"
  echo ""
  echo "Post-swap smoke: <fill in curl results for each served domain>"
  echo '```'
  echo ""
  echo "### Task 6 — /opt/vps/CLAUDE.md updated"
  echo '```'
  diff /srv/homekeep/docs/vps-setup/CLAUDE.md.proposed /opt/vps/CLAUDE.md \
    && echo "source and installed in sync ✓"
  echo '```'
  echo ""
  echo "### Task 7 — Old sprout location marked"
  echo '```'
  ls /home/sprout/revproxy/MIGRATED-TO-OPT-VPS.md
  systemctl list-timers 'vps-followup-phase34-*' --no-pager
  echo '```'
  echo ""
  echo "## Observations / deviations"
  echo ""
  echo "<fill in anything unexpected>"
  echo ""
  echo "---"
  echo ""
  echo "## Resume prompt A — paste into homekeep Claude"
  echo ""
  echo '```'
  echo "Phase 34 complete (report at $REPORT). Revproxy moved to"
  echo "/opt/vps/revproxy/. Vhost drops now go to /opt/vps/vhosts/ (not"
  echo "/home/sprout/revproxy/vhosts/). You have direct write access"
  echo "there via POSIX ACL — no sprout involvement needed ever again."
  echo ""
  echo "Apply these updates:"
  echo "1. Update memory: vps_setup_root_prompt.md, domain_strategy.md,"
  echo "   and create phase_34_complete.md memory pointing at report."
  echo "2. Update MEMORY.md index."
  echo "3. Commit the refreshed docs/vps-setup/CLAUDE.md.proposed"
  echo "   (root copied the updated /opt/vps/CLAUDE.md back to the"
  echo "   repo source during Task 6 post-verify) to master."
  echo "4. Update docker/docker-compose.demo-vps.yml + HANDOFF docs +"
  echo "   Phase 30/33 SUMMARYs to reference the new vhost location"
  echo "   /opt/vps/vhosts/ instead of /home/sprout/revproxy/vhosts/."
  echo "5. Write Phase 34 SUMMARY under .planning/phases/34-revproxy-decouple/"
  echo "   with covered INFRA-15..18 REQ-IDs (the move + ACL wiring +"
  echo "   CLAUDE.md update + old-location-deprecation)."
  echo "6. Demo deploy now unblocked — proceed with vhost drop +"
  echo "   'docker exec revproxy-caddy-1 caddy reload' + 'docker compose"
  echo "   -p homekeep-demo up -d' entirely under the homekeep user."
  echo '```'
  echo ""
  echo "## Resume prompt B — paste into sprout Claude"
  echo ""
  echo '```'
  echo "Phase 34 complete (HomeKeep GSD). Full report at $REPORT."
  echo ""
  echo "What this changes for you:"
  echo "1. Shared revproxy has moved out of /home/sprout/revproxy/ to"
  echo "   /opt/vps/revproxy/. Container name unchanged (revproxy-caddy-1)."
  echo "2. Vhost snippets now drop into /opt/vps/vhosts/ — you have ACL"
  echo "   write access same as homekeep and claude-dev."
  echo "3. Your /home/sprout/revproxy/ has a MIGRATED-TO-OPT-VPS.md"
  echo "   README. Container does NOT serve from there anymore. It's a"
  echo "   rollback fallback for 7 days, then safe to delete."
  echo "4. Your 'gd-add-subdomain' helper at /home/sprout/bin/ is"
  echo "   untouched. If you want to promote it to shared VPS tooling,"
  echo "   move it to /opt/vps/bin/ and setfacl for project users."
  echo "5. You're now a peer tenant — no special 'ops user' role."
  echo "   Your Sprout M0 and other personal projects are unaffected."
  echo ""
  echo "Action items for you:"
  echo "- If you edit your own local ~/.claude/CLAUDE.md, remove any"
  echo "  references to /home/sprout/revproxy (they're stale now)."
  echo "- At ~$(date -u -d '+7 days' +%Y-%m-%d), the systemd timer will"
  echo "  drop /opt/vps/FOLLOWUP-PHASE34-CLEANUP.md with the 'safe to"
  echo "  remove /home/sprout/revproxy/' prompt."
  echo "- If you want the 'sprout' user renamed (e.g. to 'sprout-m0') to"
  echo "  reflect peer-tenant status, that's Phase 35 material. Speak up."
  echo '```'
} > "$REPORT"

chmod 644 "$REPORT"
echo ""
echo "=== Report: $REPORT ==="
cat "$REPORT"
```

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Edge downtime during stop/start | Certain | 10-30 sec 502s on all served domains | Expected; announced in report. Schedule off-hours if traffic-sensitive. |
| Let's Encrypt re-registration if data copy failed | Low | Rate limit hit on reissue; 5-min soft block | Task 2 verify step checks ACME state landed at destination before proceeding. |
| vhosts ACL misconfigured, project users can't write | Low | Phase 34 regresses to current state (need sprout again) | Task 1 post-verify includes `sudo -u homekeep touch` smoke test. |
| /opt/vps/CLAUDE.md edits break formatting | Low | Future Claude sessions see malformed import | Task 6 uses simple find-and-replace; verify with `head -20 /opt/vps/CLAUDE.md` after. |
| Sprout's Caddyfile has custom content I don't know about | Medium | New install loses something on copy | We do a full copy (not a replay); any custom block carries over. |
| Container name collision | Not possible | N/A | Both stacks use `-p revproxy`; `down` before `up -d` releases the name. |

## Checked and NOT needed (answering "does the same apply to docker hosting demos?")

The scope of this phase is narrow because **only the revproxy has a
`/home/sprout/` dependency.** Confirmed via:

```bash
$ docker ps -a --format '{{.Names}}' | while read n; do
    mounts=$(docker inspect "$n" --format '{{range .Mounts}}{{.Source}} {{end}}' 2>/dev/null)
    echo "$mounts" | tr ' ' '\n' | grep -q '/home/sprout' && echo "$n uses /home/sprout"
  done
revproxy-caddy-1 uses /home/sprout
# (no other hits)
```

Other containers on this VPS — including whatever runs aom-wiki and
the `homekeep` personal instance — each live under their respective
service user's home dir and do NOT depend on sprout. Demo stacks
(like the upcoming `homekeep-demo`) run under their originating
project's user; they never needed sprout permission for their own
containers' lifecycle.

So **the revproxy is the only piece with a cross-user coupling that
needs correcting.** Everything else is already clean.
