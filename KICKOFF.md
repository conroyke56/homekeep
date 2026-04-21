# Claude Code Kickoff Prompt

Paste this into your first Claude Code session after installing GSD and UI/UX Pro Max skills.

---

I'm building **HomeKeep**, an open-source self-hosted household maintenance PWA. The full specification is in `SPEC.md` — read it end-to-end before asking me anything.

**Your operating instructions:**

1. Use the **GSD skill** to drive this project. Kick off with `/gsd-new` (or equivalent for your GSD version). Treat `SPEC.md` as the primary requirements input. Generate the phased plan in `.planning/`.

2. Use the **UI/UX Pro Max skill** whenever UI work happens, starting from Phase 2. The design direction is in §18 of the spec — warm, calm, domestic, not a SaaS cockpit.

3. **Ask clarifying questions before writing any code.** I'd rather answer 10 questions upfront than re-do work. GSD should force this anyway — don't skip it.

4. **Non-negotiables from the spec:**
   - Single Docker image, multi-arch (amd64 + arm64), published to GHCR
   - Three compose variants: LAN-only (default), Caddy, Tailscale
   - Works without HTTPS on LAN (graceful degradation, not failure)
   - ntfy for notifications (not web push) — default to `https://ntfy.sh`
   - All state in one `./data` volume
   - MIT license, public repo
   - No cloud dependencies, no telemetry, no paid APIs

5. **First deliverable before touching code:** show me the GSD phase plan for approval. I want to see how you're breaking the work down before you start Phase 0.

6. When you reach ambiguity the spec doesn't resolve, ask. Don't assume. Don't invent scope.

Let's go.
