# 024 — Save named ship loadouts

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 8 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The player wants a short list of named ships they can keep and choose when
starting a new run, in single-player or co-op, including on another copy of the
game. A ship here means a loadout they worked for, not only the hull picture.
They also want to start higher so they can reach later levels faster.

The same request says a perfect, nearly invincible build stops being fun. The
feature has to preserve earned ships without making every new run a solved game.

## What exists today

[Issue 002](002-ship-selection.md) stored hull and color on the one checkpoint.
Hulls are cosmetic. Stats, weapons, and abilities do not change with hull.
Hitboxes follow the shape. The selection lasts for that save. A new game is how
the player picks a different hull.

The checkpoint in `js/game.js` is the whole run: position, sector, level, XP,
weapons, passives, cores, and map progress. Starting a new run replaces it.
There is no second list of builds. Co-op does not load this checkpoint.

Export of a voluntary backup is [issue 020](020-save-export-import.md), not built
yet. Incompatible checkpoints already offer export or remove.

## Determine

- Which player fields define a "ship" the owner wants to keep. A likely set is
  hull, color, level, XP, weapons, passives, cores, and slot counts. Position
  and sector are a checkpoint, not a loadout. Confirm the split.
- How a new run today builds a fresh pilot, so a loaded ship replaces that
  pilot instead of also restoring a half-finished sector.
- What a co-op guest is allowed to bring. The host owns drops and sector flow.
  A guest with a late-game loadout changes the match for everyone.

## Decide

- How many named ships, and what character limit the name has.
- Whether level and equipment are capped, scaled down, or stored as-is.
- Whether hardcore ([issue 023](023-skill-levels.md)) can load a ship.
- Co-op policy: allow any saved ship, allow it only if the host agrees, or
  start everyone from the same fresh pilot.
- What "upgrade" means when a weapon id from an old version is gone. Drop it
  with a visible note, or refuse the ship.
- Whether these ships live inside the backup file from
  [issue 020](020-save-export-import.md).

Proposal, not approved:

- Cap the list at three named ships.
- A ship stores hull, color, level, weapons, passives, and cores. It does not
  store map position or a cleared sector.
- Loading a ship starts a new run at sector 1 with that pilot. It does not
  resume the old map.
- No silent power cap yet. The owner plays with the cap of three and sector 1
  before any further limit. If a build is boring, the next change is an
  approved cap, not a hidden nerf.
- Hardcore starts from a fresh pilot.
- In co-op, saved ships stay off until the host-agreement rule is approved.
  Do not let a guest apply a loadout the host did not accept.
- Unknown weapon ids are removed and listed before the run starts. The player
  can cancel.
- The list is part of the backup file once issue 020's format exists.

These caps are proposals. They are not balance approval.

## Do

After the decisions:

- Add a list beside the single checkpoint, with its own version field.
- Validate every ship with the same kind of field checks as `canLoadSave`.
  Reject a bad list without deleting the good checkpoint.
- Selection UI stays on the new-run flow and uses the existing menu input path.
- Export and import go through the issue 020 file if that issue lands first.
  If this issue lands first, include the list in a way issue 020 can adopt,
  and say so in both documents.
- Do not clear the owner's browser storage to test this.
- Checks: save, rename, load, delete, full list, bad JSON, missing weapon,
  old checkpoint still loads, co-op follows the approved rule.

## Acceptance criteria

- [ ] The player can save, name, and delete ships up to the approved limit.
- [ ] A new single-player run can start from a saved ship when the rules allow.
- [ ] A saved ship survives reload in the same browser.
- [ ] Export and import move the list under the rule shared with issue 020.
- [ ] An older version's ship is upgraded or refused visibly, and is not
      applied half-way.
- [ ] Co-op follows the approved host rule.
- [ ] The owner has played a strong saved ship and accepted, or tightened, the
      anti-boredom rule.

## Open questions

- Can two saved ships share a name?
- Does deleting the checkpoint also delete the list?
- Is the hull still fixed for the whole checkpoint once a run has started?

## Dependencies

[Issue 002](002-ship-selection.md) stays the cosmetic-hull rule until
[issue 029](029-ship-stats-and-colors.md) explicitly replaces it. This issue
does not add hull stats.

[Issue 020](020-save-export-import.md) should land first if both are approved,
so there is one file format.

[Issue 023](023-skill-levels.md) decides whether hardcore may load a ship.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
