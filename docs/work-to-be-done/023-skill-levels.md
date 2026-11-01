# 023 — Add skill levels

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 7 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

Single-player and co-op should offer easy, medium, hard, and hardcore. Skill
changes how many enemies appear, how strong they are, how fast they spawn, and
how fast they move. Hardcore is one life, and death loses everything.

## What exists today

There is no difficulty field. Enemy bodies come from `N.ROLES` in `js/content.js`:
hit points, speed, size, contact damage, attacks, and spawn weight. Styles are
`N.ENEMY_STYLES`. Spawn frequency was already reduced under
[issue 005](005-enemy-spawning.md). Further spawn changes need a new approval
so they do not silently undo that pass.

Single-player death calls `G.gameOver`. The game-over screen can restore the
last local checkpoint when one exists. Co-op death goes through
`N.Coop.onLocalDeath` and the revival rules in
[issue 014](014-coop-lobby-and-revival.md). Co-op does not use the local
checkpoint. The host owns the world, seed, enemies, and sector flow.

Medium is not defined in code. Current numbers are simply the game as it is.

## Determine

- Which spawn, health, damage, and speed numbers a sector uses today, at
  sector 1 and at a later sector. Record them so medium can mean "what players
  have now".
- What "lose everything" includes: the checkpoint only, or also settings,
  a future loadout list, and stats.
- Whether hardcore disables the game-over restore button, deletes the
  checkpoint, or both.
- How a co-op guest learns the host's choice, and what happens if the guest's
  client is older and has no skill field.

## Decide

- Numeric multipliers for easy, medium, and hard, for count, strength, spawn
  rate, and speed. Strength needs a split: hit points, contact damage, and
  shot damage, if those should not move together.
- Whether medium is exactly today's numbers.
- Whether the choice is stored in settings and shown before Engage.
- In co-op, the host chooses. Decide the allowed set and whether the guest can
  refuse.
- Hardcore versus co-op revives. One life for the player can mean the shared
  revive budget is zero, or that hardcore is single-player only.
- Hardcore versus [issue 024](024-named-ship-loadouts.md). Loading a powerful
  ship into a one-life run may remove the point of hardcore.

Proposal, not approved:

- Medium uses today's numbers with no change.
- Easy and hard are modest multipliers the owner tunes after a playtest, not
  values invented as final balance.
- The host's choice is part of the match start and is visible to the guest
  before ready.
- Hardcore is single-player at first: no checkpoint restore, and the checkpoint
  for that run is removed on death. Co-op keeps the current revive rules until
  a separate approval.
- Skill does not change hull stats. That is
  [issue 029](029-ship-stats-and-colors.md).

Balance feels are not done until the owner plays them.

## Do

After the decisions:

- Store the choice on the run and, if approved, in settings.
- Apply multipliers in the existing spawn and role-stat path. Do not copy a
  second enemy table.
- Send the host's choice through the existing match-start message. A guest that
  does not understand it must fail closed in a way the protocol already uses
  for a version mismatch, or the message must tolerate an older guest if that
  was the decision.
- Wire hardcore to the real game-over and save paths. Do not only hide the
  restore button.
- Add checks for each multiplier and for hardcore delete-on-death. Leave feel
  and fairness unchecked until the owner says so.
- Keep [issue 005](005-enemy-spawning.md) intact at medium.

## Acceptance criteria

- [ ] Before a single-player run, the player can choose easy, medium, hard, or
      hardcore, and the choice is visible.
- [ ] Medium matches the pre-change spawn counts, strength, and speeds at the
      recorded sectors.
- [ ] Easy and hard change quantity, strength, spawn rate, and speed by the
      approved amounts.
- [ ] Hardcore ends the run on death and removes the progress the owner named.
- [ ] A co-op match uses the host's approved skill rule, and both players can
      see it.
- [ ] Saves from before this feature still load.
- [ ] Owner playtest of feel is recorded separately from the automated checks.

## Open questions

- Do enemy shot speeds change with "speed", or only movement speed?
- Does hardcore also remove a named loadout, once those exist?
- Should the last skill persist, or return to medium every new run?

## Dependencies

Can ship before four-player co-op ([issue 028](028-coop-four-players.md)).
The host-choice display should be shaped so a later player cap can sit beside
it, without blocking this issue on the protocol expansion.
[Issue 024](024-named-ship-loadouts.md) must respect the hardcore rule chosen
here.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
No multipliers are proposed as final numbers.
