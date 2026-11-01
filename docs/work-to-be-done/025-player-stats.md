# 025 — Track player stats and an end-of-run tally

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 9 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The player wants counts for shots fired, shots that hit, ships killed,
objectives destroyed, shots taken, items picked up, and items dropped or lost.
The tally can be turned off. It stays on the client with that player's ships.
It is not a public leaderboard. At the end of a single-player or co-op match,
a board shows each player's stats for that match. In co-op, the remote numbers
come from that remote player.

## What exists today

A run already stores kills, damage, and time. Sector completion and game over
show a small grid: sector, time, kills, damage, pilot level, anchors, and, on
death, sectors cleared. See `UI.showGameOver` and `UI.showComplete` in
`js/ui.js`.

Those screens describe one local summary. They do not list shots, hits, items,
or a row per co-op player. Co-op death does not use the single-player game-over
screen. It uses the shared death and revive path.

Nothing in the checkpoint is a lifetime stat block beyond the current run's
kills and damage. There is no cross-player score server.

## Determine

- Where shots, hits, kills, anchor destroys, damage taken, pickups, and item
  losses already happen, so counters can sit on those events once.
- Which of those events the guest is allowed to count locally. The guest owns
  their own shots and inventory. The host owns enemy deaths and objectives.
  A kill credited on both machines would double-count.
- What "end of a game" means in co-op: party wipe, leave to menu, or both.
- Whether "with their ships" means the one checkpoint, a future loadout
  ([issue 024](024-named-ship-loadouts.md)), or a separate profile.

## Decide

- The exact counter list and the display names.
- Match-only tally, lifetime totals, or both.
- Default for the toggle. A hidden tally should still be definable so a later
  session can turn it on without lost history, or it should stop recording.
  Those are different.
- Who is authoritative for each co-op number.
- Whether the board replaces the current game-over grid or sits under it.

Proposal, not approved:

- Record the requested counters for the current match.
- Also keep lifetime totals in local storage, because the request says the
  numbers stay with the player. The end board shows the match, not the lifetime.
- Toggle default on. Off hides the board and stops new recording. It does not
  delete old totals until the player clears site data or a backup restore says
  so.
- Host credits kills and objectives. Each client credits their own shots fired,
  shots taken, and items. Hits are credited by the client that applied the hit.
- Guest sends their row to the host for the board. The host does not recompute
  the guest's shots.
- No server tally. A tampered local row only changes that player's own board.

## Do

After the decisions:

- Add counters at the existing event sites. Do not scan the whole sim at the end
  to reconstruct them.
- Extend the end screens. Keep the current numbers unless the owner asked to
  remove one.
- In co-op, send the guest row with the existing channel when the match ends.
  Ignore a row from a peer who is not in the match.
- Store lifetime totals under a versioned local key, and include them in the
  backup file if [issue 020](020-save-export-import.md) has a slot for them.
- Checks: counters move on one scripted shot, kill, hit, pickup, and drop.
  Toggle off does not show the board. A co-op fixture shows two rows without
  double-counting a host kill.

## Acceptance criteria

- [ ] The approved counters change when the matching event happens.
- [ ] Single-player end of run shows that match's tally.
- [ ] Co-op end of match shows one row per participant, with remote rows supplied
      by those clients under the authority rule.
- [ ] Turning the feature off follows the approved record and display rule.
- [ ] Totals stay on the client. No new score server is added.
- [ ] Existing game-over information is still available unless a removal was
      approved.

## Open questions

- Do missed shots and shots that hit a wall count as shots fired?
- Does a dropped item mean a discarded weapon, a death loss, or both?
- Should lifetime totals reset when a hardcore run deletes the checkpoint?

## Dependencies

Display can ship before named ships. Persistence "with their ships" must be
updated if [issue 024](024-named-ship-loadouts.md) defines a ship list.
Backup inclusion belongs to [issue 020](020-save-export-import.md).
The logbook ([issue 026](026-enemy-logbook.md)) should share the profile store
if both are approved, rather than two independent lifetime files.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
