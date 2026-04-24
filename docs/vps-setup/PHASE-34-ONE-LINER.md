# Paste this single line into your root Claude Code session

```
Read @/srv/homekeep/docs/vps-setup/phase-34-directive.md and execute the Tasks section end-to-end. Preserve Caddy's ACME state (certs + account data) during the move so Let's Encrypt doesn't re-register or re-fetch. Expect ~10-30 sec of edge downtime on revproxy recreate; announce in the report but don't pause for confirmation. Ask before touching anything in /home/sprout/ OTHER than revproxy/ (the revproxy migration is authorized; sprout's other files are off-limits). Write the completion report to /opt/vps/reports/phase-34-<timestamp>.md. At the end, print TWO resume prompts — one for homekeep Claude, one for sprout Claude — so I can paste each into the matching session.
```

## What this phase does

Moves the shared reverse-proxy Caddy (`revproxy-caddy-1`) out of
`/home/sprout/revproxy/` and into `/opt/vps/revproxy/`. Moves the
vhost drop location to `/opt/vps/vhosts/` with POSIX ACLs so every
service user can drop their own project's vhost without needing
sprout's permission.

After this runs:
- `sprout` becomes a peer tenant (not "the ops user")
- HomeKeep's demo deploy unblocks entirely — no sprout handoff needed
- Every future project's onboarding (per `/opt/vps/CLAUDE.md`
  checklist) drops vhosts into `/opt/vps/vhosts/` directly
- `/opt/vps/CLAUDE.md` updated so future Claude sessions (any user)
  learn the new layout on session start

## Brief edge outage

Swapping the compose stacks requires `docker compose down` on the old
location, then `up -d` on the new. Revproxy-served domains will see
~10-30 sec of 502s during that window. TLS certs + ACME account state
are preserved via the data/ copy (Task 2) so there's no
re-registration with Let's Encrypt.

## After it lands

Root Claude prints TWO resume prompts at the end of its report:

- **For homekeep Claude** — update memory + commit docs + Phase 34
  SUMMARY + do the now-unblocked demo deploy
- **For sprout Claude** — rules of engagement change; they're a peer
  tenant now; old dir deletable in 7 days via systemd timer

Paste each into the matching session. Nothing breaks if you paste
only one or neither — the docs on disk are the source of truth.
