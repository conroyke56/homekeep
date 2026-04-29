<!-- gitleaks:allow (path + service references, no secrets) -->
# Phase 41 — `/home/sprout/revproxy/` Decommission

**Milestone:** v1.4-infra-cleanup-and-test-fix
**REQ:** INFRA-02
**Trigger:** `vps-followup-phase34-cleanup.timer` fires 2026-05-01
10:00 UTC, drops `/opt/vps/FOLLOWUP-PHASE34-CLEANUP.md` with a
built-in health-check gate.

## Context

Phase 34 (2026-04-24) moved revproxy from `/home/sprout/revproxy/`
to `/opt/vps/revproxy/` so it's no longer scoped to the `sprout`
service user's home. The old directory was kept "for 7 days as a
rollback safety net."

This phase verifies the new revproxy has been continuously healthy
since the move, then removes the now-obsolete copy.

## Pre-flight gate (must ALL pass)

```bash
# 1. New revproxy at /opt/vps/revproxy/ has been continuously up
#    since 2026-04-24
docker ps --filter name=revproxy --format '{{.Names}} {{.Status}}'
# Expect: revproxy-caddy-1 Up <N> days (>= 5 days)

journalctl --since "2026-04-24" -u 'docker-revproxy*' \
  | grep -iE 'fail|error|crash' | head -20
# Expect: empty or only transient ACME-renewal logs that recovered

# 2. Demo service healthy
curl -sS https://homekeep.demo.the-kizz.com/api/health
# Expect: {"status":"ok","nextjs":"ok","pocketbase":"ok",...}

# 3. Sprout's own service still healthy (move didn't strand it)
curl -sI https://sprout-m0.kizz.space/  | head -1
# Expect: HTTP/2 200 (or whatever sprout-m0 normally returns)

# 4. /home/sprout/revproxy/ is the OLD copy — verify it isn't running
docker ps --filter "name=^sprout" --format '{{.Names}}' | head
# Expect: empty (no containers from /home/sprout/revproxy/'s compose project)
ls /home/sprout/revproxy/ 2>/dev/null | head -5
# Expect: directory exists; rollback safety net in place
```

**If ANY check fails** — STOP. Don't delete. Update the FOLLOWUP
file with failure detail, defer cleanup another week, escalate to
the operator.

## Removal (only if all 4 checks pass)

```bash
# 1. Final inventory before delete (in case we need to reference)
ls -la /home/sprout/revproxy/
du -sh /home/sprout/revproxy/

# 2. Tar a one-shot snapshot for cold archival, just-in-case
tar czf /var/backups/sprout-revproxy-snapshot-2026-05-01.tgz \
  -C /home/sprout revproxy
ls -lh /var/backups/sprout-revproxy-snapshot-*.tgz

# 3. Remove the directory
rm -rf /home/sprout/revproxy/

# 4. Update sprout's CLAUDE.md if it references the old path
grep -n 'sprout/revproxy' /home/sprout/.claude/CLAUDE.md 2>/dev/null
# If hits found: edit them to point at /opt/vps/revproxy/ (or remove
# stale references) — be conservative; sprout owns this file.

# 5. Verify dependent services still serving (sanity)
curl -sS https://homekeep.demo.the-kizz.com/api/health
curl -sI https://sprout-m0.kizz.space/  | head -1
```

## Closeout

```bash
# Disable + remove the timer
systemctl disable --now vps-followup-phase34-cleanup.timer
rm /etc/systemd/system/vps-followup-phase34-cleanup.{service,timer}
systemctl daemon-reload

# Remove the FOLLOWUP file
rm /opt/vps/FOLLOWUP-PHASE34-CLEANUP.md

# Log the cleanup
mkdir -p /opt/vps/reports
cat > /opt/vps/reports/phase34-cleanup-2026-05-01.md <<EOF
# Phase 34 Cleanup — /home/sprout/revproxy/ Decommissioned (2026-05-01)

**Status:** shipped (or deferred — record outcome here)

Pre-flight gate (4 health checks): PASSED.
- New revproxy uptime: <N> days continuous since 2026-04-24
- homekeep.demo.the-kizz.com /api/health: 200
- sprout-m0.kizz.space: 200
- /home/sprout/revproxy/ confirmed not running

Snapshot archived to /var/backups/sprout-revproxy-snapshot-2026-05-01.tgz
(retention: 90 days minimum — review after Q3 2026).

Directory removed. Both dependent services serving green
post-removal.
EOF
```

## Rollback (if needed within 90 days)

```bash
tar xzf /var/backups/sprout-revproxy-snapshot-2026-05-01.tgz \
  -C /home/sprout/

# Decide whether to bring it up:
cd /home/sprout/revproxy
docker compose -p sprout-revproxy up -d   # if sprout's flow needs it
# Otherwise leave the copy on disk for inspection only.
```

The cold snapshot is the rollback. Don't restore from this unless
the new `/opt/vps/revproxy/` has materially failed and Phase 40's
build-time changes need to be backed out simultaneously.

## Reference

- Phase 34 decoupling SUMMARY:
  `/srv/homekeep/.planning/phases/34-revproxy-decouple/34-01-P01-SUMMARY.md`
- Phase 33 root-sync report:
  `/opt/vps/reports/phase33-root-sync-2026-04-24.md`
- VPS-wide infra layout:
  `/opt/vps/CLAUDE.md` § "Shared infrastructure locations"
