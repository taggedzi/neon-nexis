# 026 — Add an enemy logbook

Status: Done

Accepted decisions and implementation evidence appear below. Earlier proposals
are retained for context and are superseded by the owner's recorded answers.

Priority 10 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The player wants a logbook of enemies they have met, with a description and a
count of how many they have destroyed.

## What exists today

`js/content.js` defines 16 enemy roles in `N.ROLES` and 32 styles in
`N.ENEMY_STYLES`. Each style has a name, role, and shape. Roles carry the
combat numbers and a short attack id such as `aimedBurst` or `snipe`. There is
no player-facing description paragraph and no discovery record.

Kills already increment the run's kill count. They do not increment a per-style
count. Styles alternate by sector, so a player does not see all 32 in one sector.

The menu has How to Play and Credits. It has no codex screen.

## Determine

- Whether a log entry is a style (32 names) or a role (16 jobs). The request
  says enemies encountered. The names players see are the styles.
- Where a kill is attributed today, including splitter children, hive spawns,
  and co-op kills that the host applies.
- Whether "encountered" means damaged, seen on screen, or killed. Seen-on-screen
  is more expensive and less clear than "this style has been in the sector".

## Decide

- Style entries, role entries, or both.
- Who writes the description: a new sentence stored next to each style, or a
  generated line from the role's attack and size. Generated lines stay accurate
  when numbers change. Written lines need an edit whenever a style changes.
- Whether the book is always available or follows the stats toggle in
  [issue 025](025-player-stats.md).
- Whether co-op discoveries count for every participant or only the client who
  scored the kill.

Proposal, not approved:

- One entry per style, grouped by role. Undiscovered styles show as unknown,
  without their name, so the book can be completed.
- Description is one approved sentence per style, written when the entry is
  first added. Do not generate joke text.
- "Encountered" means the style was spawned in a sector the player was in.
  "Destroyed" is the kill count.
- Counts are local and lifetime. In co-op, the host's kills credit the host's
  book. A guest credits a kill only if the guest's own hit was the killing hit
  and the host confirms it. Until that message exists, co-op updates only the
  host book, and the issue stays open on the guest half.
- The book is not behind the stats toggle. It is a local record, not a scoreboard.
- Store it with the profile data from issue 025 and the backup from
  [issue 020](020-save-export-import.md).

The guest-credit rule is the part most likely to change. Do not build the
network message until it is approved.

## Do

After the decisions:

- Add descriptions beside `N.ENEMY_STYLES`, or in one table keyed by style id,
  so a new style fails a check when it has no description.
- Increment counts from the spawn and kill sites already used by the sim.
- Add a menu screen that uses the existing keyboard and controller focus path.
- Validate stored counts. A corrupt book is ignored and does not block the
  checkpoint from loading.
- Checks: a spawned style becomes encountered, a kill increments that id only,
  an unknown id in storage is dropped, and the screen lists the approved copy.

## Acceptance criteria

- [x] Every approved style has a description or an explicit unknown state.
- [x] Meeting and destroying an enemy updates the local book under the approved
      definitions.
- [x] The book is readable from the menu during a session that has discoveries.
- [x] Old saves still load when the book is missing.
- [x] A new style cannot ship without the check that it has an entry.
- [x] Co-op credit matches the approved rule.

## Open questions

- Should bosses and wardens be pinned at the top of the book?
- Does a hardcore wipe clear the book? The proposal says no.

## Dependencies

Can be built after the profile storage choice in
[issue 025](025-player-stats.md). The backup file is
[issue 020](020-save-export-import.md). File version 1 is the checkpoint and
settings only. A logbook should use a new file version, not a second export.
The menu screen itself does not need four-player co-op.

## Implementation and validation

### Decisions — 2026-11-02

Approval source: owner answers in this chat on 2026-11-02. These supersede
conflicting proposals above and resolve the earlier blocker.

- One entry per style, grouped by role; undiscovered names stay Unknown.
  Agent writes concise factual descriptions from current behavior. Bosses and
  wardens use their normal role groups.
- Discover styles that exist in the player's sector, including alive enemies
  on co-op join and subsequent spawns. Every present participant discovers them.
- Only the pilot delivering the killing hit receives a destroyed count; the
  host confirms guest credit. This also works with stats recording off.
- Book is independent of the stats toggle, shares the lifetime profile/backup,
  and survives Hardcore death.
- Rationale: a personal lifetime catalog with clear encounters and kill ownership.

### Work and validation

- Issues 023–025 merged in order through PRs #27, #28 and #29 before this branch.
  Origin refreshed; no open PRs. Branch: `codex/026-enemy-logbook`.
- `js/content.js` supplies factual descriptions for all 32 styles. A unit check
  requires an exact description/style match, so a new style cannot omit copy.
- `js/logbook.js` records central spawn/kill events, including summons and
  splitter children. Self-detonation does not count as a pilot's killing hit.
  Host sends cumulative per-participant discoveries/kills, independent of stats
  eligibility. Repeated packets cannot duplicate credit; local receipt and book
  increments are persisted together. New participants see alive enemies, not
  earlier deaths. Returning participant identities retain their own stream.
- `js/profile.js` migrates profile schema 1 to 2 without changing its storage
  key or losing totals. Invalid/unknown book entries are dropped; invalid whole
  profiles retain their stored bytes. Dev scenarios do not pollute the book.
- `js/logbook-ui.js`, `index.html` and `js/ui.js` add menu/pause access using
  existing neon panels, native disclosure groups and keyboard/controller focus.
  Co-op dispatch is in `js/coop.js`; protocol version 5 refuses old clients that
  cannot confirm logbook credit. No binary gameplay packet changes.
- Backup version 4 carries the book. Versions 1–3 preserve any existing book;
  confirmation text explains replacement, and rollback still covers all stores.
- Focused browser checks: four solo cases and four co-op/replacement cases
  passed across Windows Chromium and Firefox. Covers unknown names, exact copy,
  once-only per-style kills, splitter discoveries, Hardcore retention, stats-off
  recording, menu/pause access, reload, old saves, backup migration, corrupt
  entries, repeated guest confirmations and alive-on-join discovery.
- Unit checks also restart the guest recorder against a persisted receipt and
  verify that a returning participant discovers current survivors without
  losing earlier discoveries. Agent inspected the 640 × 720 Chromium screenshot:
  role groups, unknown entries, descriptions and counts remain readable.
- `npm run check` passed syntax, lint, unit checks and all 144 browser cases
  (6.4 minutes), Windows Chromium 156.0.8078.4 and Firefox 157.0. The complete
  suite includes nearby controls, pause, pickups, sector transitions, save/continue,
  co-op reconnect and backup rollback. `git diff --check` passed.
- Agent inspected Chromium and Firefox screenshots. Keyboard and simulated
  gamepad navigation use existing menu handling. No physical-controller,
  separate Google Chrome, or performance check is claimed.
- Implementation commit: `daad5b0`. Final hardening also covers current-enemy
  discovery on return and receipt persistence after profile replacement; the
  focused unit checks passed. The pre-push hook checks the complete final state.
- All acceptance criteria have supporting evidence; remaining work: none.
