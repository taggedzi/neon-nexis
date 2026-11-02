# 026 — Add an enemy logbook

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

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

- [ ] Every approved style has a description or an explicit unknown state.
- [ ] Meeting and destroying an enemy updates the local book under the approved
      definitions.
- [ ] The book is readable from the menu during a session that has discoveries.
- [ ] Old saves still load when the book is missing.
- [ ] A new style cannot ship without the check that it has an entry.
- [ ] Co-op credit matches the approved rule.

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

Not started. No files have been changed for this issue. No checks have been run.
Style and role counts were read from `js/content.js` on 2026-11-01.
