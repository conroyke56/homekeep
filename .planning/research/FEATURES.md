# Feature Landscape: Household Maintenance Apps

**Domain:** Self-hosted household maintenance / chore management
**Researched:** 2026-04-20
**Confidence:** MEDIUM (based on training data knowledge of Tody, Sweepy, OurHome, Nipto, HomeRoutines, FlyLady; web verification unavailable)

## Competitive Landscape Summary

Six apps define this space. They split into two categories:

**Cleaning-focused (schedule-driven):** Tody, Sweepy, HomeRoutines
**Family chore/task-focused (assignment-driven):** OurHome, Nipto, FlyLady

HomeKeep sits squarely in the cleaning-focused camp but borrows the multi-user sharing from the family camp. This is the right positioning -- the cleaning-focused apps are better loved but weaker on collaboration; the family apps have collaboration but shallow scheduling.

### App-by-App Feature Summary

| App | Strength | Weakness | Monetization |
|-----|----------|----------|-------------|
| **Tody** | Visual dirtiness indicator per area, no fixed schedule -- things get "dirtier" over time. Beautiful UI. | Single-user only (no sharing). Paid upfront. No notifications. | One-time purchase (~$8) |
| **Sweepy** | Room-based cleaning with effort estimation, multi-user, daily task generation based on room "cleanliness level" | Aggressive subscription ($30/yr), many features paywalled, ads in free tier | Freemium + subscription |
| **OurHome** | Family-oriented, points/rewards for kids, grocery lists, shared calendar | Jack of all trades, master of none. Cleaning scheduling is shallow. | Freemium |
| **Nipto** | Simple, couples-focused, fairness tracking (who does more) | Very basic feature set, limited areas, no long-cycle tasks | Free with ads |
| **HomeRoutines** | FlyLady methodology (zones, routines, daily/weekly focus areas) | Dated UI, iOS only, no longer actively maintained | One-time purchase |
| **FlyLady** | Zone-based cleaning system, strong community/methodology | App is terrible -- the value is the system, not the software. Cluttered, ad-heavy. | Ads + merchandise |

---

## Table Stakes

Features users expect. Missing any of these and the app feels incomplete or unusable for its stated purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Recurring tasks with configurable frequency** | Core purpose of the app. Every competitor has this. | Low | Tody uses decay curves; Sweepy uses levels. HomeKeep's integer-days approach is simpler and sufficient. |
| **Room/area organization** | Users think in spaces ("the kitchen is dirty"), not abstract task lists. Tody, Sweepy, HomeRoutines all organize by room. | Low | HomeKeep's area model with location/whole_home scope is better than most competitors. |
| **Visual "what needs doing now" view** | The primary interaction. Tody shows dirtiness bars, Sweepy shows a daily list. Users open the app to answer "what should I clean?" | Medium | HomeKeep's three-band view (overdue/this-week/horizon) is a strong answer. |
| **One-tap task completion** | Must be frictionless. Users complete tasks while standing in the kitchen with wet hands. Two taps max. | Low | Every competitor gets this right. |
| **Per-area health/status indicator** | Users want to scan "which room needs attention" at a glance. Tody's colored bars and Sweepy's room cards both do this. | Medium | HomeKeep's coverage % per area in the By Area view covers this. |
| **Overall household health score** | A single number/visual for "how's the house doing." Tody has overall dirtiness; Sweepy has cleanliness %. | Low | HomeKeep's coverage ring. |
| **Multi-user / household sharing** | Couples and families share a home. The #1 complaint about Tody is that it's single-user. Sweepy and OurHome both support this. | Medium | HomeKeep has this. Critical differentiator over Tody. |
| **Task assignment** | When sharing, users need to know who does what. OurHome and Sweepy both have assignment. | Low | HomeKeep's cascading assignment (task -> area -> anyone) is more sophisticated than competitors. |
| **Notifications/reminders** | Users forget. Push notifications for overdue items are expected. Sweepy does daily reminders; OurHome does per-task. | Medium | HomeKeep's ntfy approach is unique (self-hosted friendly) but functionally equivalent. |
| **Starter/template tasks** | Nobody wants to manually enter 30+ household tasks. Sweepy and Tody both offer room-specific starter sets. | Low | HomeKeep's seed library with first-run wizard addresses this well. |
| **Custom task creation** | Every house is different. Users must be able to add their own tasks beyond templates. | Low | Universal across all competitors. |
| **Mobile-first / responsive UI** | Used while walking around the house, not at a desk. Every competitor is mobile-first (most are native apps). | Medium | PWA is the right call for self-hosted. Must feel native-quality on mobile. |
| **Activity history** | "When did we last clean the oven?" is a common question. Tody and Sweepy both show completion history per task. | Low | HomeKeep's History view and per-task completion log. |

---

## Differentiators

Features that set HomeKeep apart. Not expected by default, but valued when present. These are where HomeKeep can win.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Self-hosted / data ownership** | No competitor offers this. Tody, Sweepy, OurHome are all proprietary cloud apps. Privacy-conscious users and self-hosters have zero options today. | High (infra) | This is HomeKeep's primary differentiator. The entire self-hosted home lab community (Home Assistant, Immich, Paperless-ngx users) has no household chore app. |
| **Open source (MIT)** | Enables community contributions, trust, and longevity. No competitor is open source. | N/A | Differentiator by license, not by feature. |
| **Calm, non-competitive shared model** | Sweepy has a fairness meter that breeds resentment. OurHome has points/leaderboards. Nipto explicitly tracks "who does more." HomeKeep's "us vs. the house" framing is deliberately different. | Low | Design philosophy, not feature complexity. The spec's gamification rules (household streak, no leaderboard) embody this. |
| **Three-band temporal view** | No competitor separates overdue/this-week/horizon this cleanly. Tody shows everything as a gradient. Sweepy shows today only. HomeKeep lets you see the full year while focusing on this week. | Medium | The horizon band (12-month strip) is genuinely novel in this space. |
| **Cycle vs. anchored scheduling** | No competitor distinguishes "clean every 7 days from last cleaning" vs. "service air-con every March." This matters for maintenance (not just cleaning). | Low | Simple toggle, big conceptual win. Extends the app from "cleaning tracker" to "home maintenance companion." |
| **Long-cycle task support** | Tody and Sweepy focus on daily/weekly cleaning. Annual tasks (gutter cleaning, pest inspection, smoke alarm checks) are afterthoughts. HomeKeep treats a 365-day task as a first-class citizen. | Low | The horizon view makes long-cycle tasks visible without cluttering the daily view. This is the core insight from the spec. |
| **Cascading assignment** | No competitor has three-level assignment inheritance (task -> area -> anyone). Sweepy and OurHome have flat per-task assignment only. | Medium | Reduces setup friction for homes where one person "owns" certain areas. |
| **Early-completion guard** | No competitor prevents accidental double-completions or "did my partner already do this?" collisions. | Low | Small feature, high UX value for couples. |
| **Webhook / API integration** | No household app integrates with Home Assistant, Node-RED, or automation platforms. v1.1 feature but a significant differentiator for the self-hosted audience. | Medium | Planned for v1.1. Mention in marketing from day one. |
| **No subscription / no ads** | Sweepy is $30/yr with ads in free tier. Tody is paid upfront. OurHome has premium tier. HomeKeep is free, forever. | N/A | Self-hosted means no recurring cost model. Major draw for the target audience. |
| **Forgiveness model (no guilt)** | Miss a week and the app redistributes rather than showing a wall of red. Tody and Sweepy both accumulate overdue shame. | Low | Spec principle #3. Implemented via the coverage ring declining gracefully rather than task-count-based guilt. |
| **Multi-home support** | Tody is single-home. Sweepy supports multiple homes in premium only. HomeKeep includes it in the base product for holiday houses, parents' places. | Low | Common for the self-hosted audience to manage a second property. |

---

## Anti-Features

Features to explicitly NOT build. These are things competitors do that annoy users, or features that would distract from HomeKeep's core value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Subscription paywalling of core features** | Sweepy's #1 complaint in app store reviews. Users hate paying monthly for a to-do list. Multi-user, history, and scheduling are paywalled. | Free and open source. All features available to all users. |
| **Ads** | Sweepy free tier and FlyLady app are ad-supported. Ads in a household utility app feel cheap and break focus. | No ads, ever. Self-hosted means no ad infrastructure. |
| **Partner-vs-partner leaderboards** | Nipto's "fairness meter" and OurHome's points system create household conflict. "The app says you did 30% less than me" is a relationship problem, not a feature. | Household streak (shared), coverage % (shared). Person view shows your own stats, never ranked against partner. |
| **Points / XP / gamification treadmill** | OurHome's reward points work for kids but feel patronizing for adults. Duolingo-style daily streaks create anxiety. | Light-touch gamification: weekly household streak, area celebrations, gentle "most neglected" nudge. No points, no levels, no badges. |
| **Daily streak pressure** | Every streak-based app creates "don't break the chain" anxiety. Daily is toxic; weekly is humane. | Weekly household streak only. Missing a day is normal. Missing a week gently decrements. |
| **Aggressive push notifications** | Sweepy sends multiple daily reminders by default. Users report notification fatigue. | Conservative defaults: overdue fires once (not repeatedly), weekly summary is opt-in, partner-completion notifications are off by default. |
| **Calendar/iCal sync** | Sounds useful but creates clutter. Home maintenance tasks in your work calendar is noise. Different problem space. | The horizon view IS the calendar for home maintenance. Keep it contained. |
| **Shopping lists / grocery integration** | OurHome bundles chores + groceries + calendar. Feature bloat dilutes the core value. | Out of scope explicitly. HomeKeep does one thing well. |
| **Bill tracking / finance** | Some "home management" apps try to track bills, subscriptions, home value. Completely different domain. | Out of scope explicitly. |
| **Complex recurrence rules (RRULE)** | "Every 2nd Tuesday" or "first Monday of the month" adds complexity without matching how cleaning actually works. Integer days is simpler and sufficient. | Frequency in days. Anchored mode for calendar-fixed tasks. Covers 99% of real use cases. |
| **Effort estimation / time tracking** | Sweepy estimates task duration and daily cleaning time. Over-engineered -- users don't care how long wiping benches takes, they care whether it's been done. | No effort/time tracking. Completion is binary: done or not done. |
| **AI-generated cleaning schedules** | Trendy but adds complexity, cloud dependency, and unpredictability. Users want control over their schedule, not an algorithm deciding what to clean. | User sets frequencies (with sensible defaults from seed library). Predictable, transparent, user-controlled. |
| **Social features / sharing outside household** | No one wants to share their cleaning habits publicly. | Strictly private to household members. No social, no public profiles. |
| **Cluttered onboarding** | FlyLady's app requires understanding the "zone" methodology before you can use it. HomeRoutines assumes FlyLady knowledge. | Seed library wizard: check what applies, adjust frequencies, done. Zero methodology required. Progressive disclosure of advanced features. |

---

## Feature Dependencies

```
Auth system
  -> Home creation
    -> Area creation (incl. auto Whole Home)
      -> Task creation (requires area)
        -> Task completion (requires task)
          -> History view (requires completions)
          -> Coverage calculation (requires completions + tasks)
            -> Coverage ring (requires coverage calc)
            -> By Area view (requires coverage calc)
          -> Notifications (requires overdue detection from completions)
    -> Home sharing / invites
      -> Task assignment (requires members)
        -> Cascading assignment (requires areas + members)
        -> Person view (requires assignment resolution)

Seed library -> First-run wizard (requires areas to exist first)

Three-band view requires:
  - Task list with computed due dates
  - Coverage ring
  - Overdue detection

Gamification (streak, celebrations) requires:
  - Completions over time
  - Coverage calculation
```

**Critical path:** Auth -> Home -> Areas -> Tasks -> Completions -> Coverage -> Three-band view

**Parallel work possible:**
- Seed library JSON can be authored independently of UI
- Notification infrastructure (ntfy integration) can be built independently of task UI
- Gamification can be layered on after core completion model works

---

## MVP Recommendation

**Prioritize (v1 core -- must ship):**

1. Auth + home + areas + tasks + completions (the data backbone)
2. Three-band main view with one-tap completion (the primary interaction)
3. By Area view with coverage % (the "scan the house" interaction)
4. Coverage ring (the "how's the house doing" headline number)
5. Multi-user sharing with cascading assignment (the couples use case)
6. Seed task library with first-run wizard (reduces time-to-value from 30 min to 3 min)
7. Notifications via ntfy (overdue alerts -- without this, the app is passive)
8. History view (answers "when did we last..." and "did you actually...")
9. Person view (answers "what's mine to do")

**Defer to v1.1:**
- Area groups: Only matters for 6+ areas. Most homes have 4-5 areas initially.
- Task rotation: Nice but not essential. Manual reassignment works for v1.
- Photo attachments: Adds storage/upload complexity. Completions are text-only in v1.
- Webhooks / documented API: Power user feature. PocketBase raw API is available for tinkerers in v1.
- Year-in-review: End-of-year feature. Not needed until December.
- Task categories/tags: Flat task list per area is sufficient. Tags add UI complexity.

**Defer to post-v1.1:**
- Kids/chores mode: Different mental model, different UI, different gamification. Separate initiative.
- MCP server: Cool but niche.
- Home Assistant integration: Requires HA addon packaging, sensor mapping. Separate initiative.
- i18n: English first, extract strings for later.

---

## Competitor Gap Analysis: Where HomeKeep Wins

| User Need | Tody | Sweepy | OurHome | HomeKeep |
|-----------|------|--------|---------|----------|
| Self-hosted | No | No | No | **Yes** |
| Open source | No | No | No | **Yes** |
| Multi-user free | No (single-user) | Paid only | Free | **Free** |
| Long-cycle tasks (annual) | Weak | Weak | No | **First-class** |
| No subscription | $8 one-time | $30/yr | Freemium | **Free forever** |
| Home Assistant integration | No | No | No | **Planned v1.1** |
| API / webhooks | No | No | No | **Planned v1.1** |
| Non-competitive sharing | N/A | Fairness meter | Points/leaderboard | **Cooperative only** |
| Calm UX | Good | Pushy notifications | Cluttered | **By design** |
| Data portability | No export | No export | No export | **JSON export, single file DB** |

---

## Sources and Confidence

| Claim | Confidence | Basis |
|-------|------------|-------|
| Tody is single-user, visual dirtiness model | MEDIUM | Training data (app store listings, reviews through early 2025) |
| Sweepy subscription model and feature gating | MEDIUM | Training data (widely discussed in app reviews) |
| OurHome points/rewards system | MEDIUM | Training data (app marketing and reviews) |
| Nipto fairness tracking for couples | LOW | Training data (less popular app, fewer sources) |
| HomeRoutines/FlyLady methodology | MEDIUM | Training data (well-documented cleaning methodology) |
| No open-source household maintenance app exists | MEDIUM | Training data; no known competitor identified. Could not verify via web search. |
| Feature expectations (table stakes list) | HIGH | Consistent across all competitors reviewed; corroborated by spec analysis |
| Anti-feature patterns (subscription complaints, notification fatigue) | MEDIUM | Common themes in app store reviews across training data |

**Note:** Web search and web fetch were unavailable during this research. All competitive analysis is based on training data knowledge (cutoff ~May 2025). Feature details of competitors may have changed since then. The table stakes and differentiator categorizations are high confidence because they reflect structural patterns across the entire category, not individual app version details.
