# 024 — Save named ship loadouts

Status: Done

Implementation follows the owner-approved decisions recorded below. Original
planning notes are retained for context.

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

Voluntary backup export/import is implemented by
[issue 020](020-save-export-import.md). Incompatible checkpoints already offer export or remove.

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

- [x] The player can save, name, and delete ships up to the approved limit.
- [x] A new single-player run can start from a saved ship when the rules allow.
- [x] A saved ship survives reload in the same browser.
- [x] Export and import move the list under the rule shared with issue 020.
- [x] An older version's ship is upgraded or refused visibly, and is not
      applied half-way.
- [x] Co-op follows the approved host rule.
- [x] The owner has played a strong saved ship and accepted, or tightened, the
      anti-boredom rule.

## Open questions

- Can two saved ships share a name?
- Does deleting the checkpoint also delete the list?
- Is the hull still fixed for the whole checkpoint once a run has started?

## Dependencies

[Issue 002](002-ship-selection.md) stays the cosmetic-hull rule until
[issue 029](029-ship-stats-and-colors.md) explicitly replaces it. This issue
does not add hull stats.

[Issue 020](020-save-export-import.md) owns the backup file. File version 1 is
the checkpoint and settings only. Named ships should extend that file with a
new file version, not a second export.

[Issue 023](023-skill-levels.md) decides whether hardcore may load a ship.

## Implementation and validation

### Decisions — 2026-11-02

- Owner approved three named ships with unique names up to 32 characters.
  Store hull/color, level/XP, equipment, cores and slot counts as earned, without
  power scaling. Do not store map position or cleared-map state.
- Owner approved selecting a starting sector up to the highest sector that
  saved ship reached. Start a fresh map at that sector, not its old checkpoint.
- Hardcore always starts from a fresh pilot, under issue 023's accepted rules.
- Approval source: owner answers in this chat on 2026-11-02. These supersede
  the sector-1-only and unresolved contents/limit proposals above.
- Rationale: preserve earned builds and reach later sectors sooner while keeping
  a small list. Strong-build feel still needs owner review after implementation.
- Owner approved a host-controlled Allow saved ships option, off by default.
  Show each chosen ship and pilot level before ready. Host starting sector is
  limited by every selected pilot's unlock; fresh pilots limit it to sector 1.
- Owner approved adding ships to the existing backup, refusing unknown equipment
  visibly without deleting the ship, preserving the list when a checkpoint is
  deleted, and fixing hull/color for the run.
- These owner answers supersede the remaining conflicting proposals above.

### Work and validation

- Issue 023 merged through PR #27 at `df61def` before this issue started.
- Origin fetched; main fast-forwarded and clean; no open PRs.
- Task branch: `codex/024-named-ship-loadouts`.
- Changed files: `js/loadouts.js`, `js/loadouts-ui.js`, `js/game.js`,
  `js/save-transfer.js`, `js/ui.js`, `index.html`, co-op profile/lobby/session
  modules, and focused backup/loadout/co-op checks.
- Separate version-1 ship store; backup file version 2 carries the list. Older
  version-1 backups preserve an existing ship list. Imports roll back all three
  keys on failure. Unknown equipment stays stored and cannot launch.
- New bounded loadout modules preserve the existing namespace and menu controls.
  Loaded pilots begin healthy on a freshly generated selected sector. Saved
  hull/color are fixed, while missing protocol choices remain available.
- Co-op choices travel directly between browsers, with host permission and
  readiness revision checks. PHP introduction behavior is unchanged. Wire
  version 3 rejects clients without loadout consent enforcement.
- Syntax/lint, save-transfer unit checks and lobby/wire checks passed. Eight
  solo/backup browser checks and six co-op/Hardcore checks passed on Chromium
  156.0.8078.4 and Firefox 157.0. No physical controller check is claimed.
- Source inspection confirms backups currently use file version 1 and include
  checkpoint/settings only. This issue must extend that format.
- Final `npm run check` passed syntax, lint, unit checks and 128 browser tests
  (browser phase 5.5 minutes). `git diff --check` passed. Agent inspected saved-ship
  management and compact co-op screenshots; existing style is preserved.
- A final preview correction restores the fresh hull image when deselecting a
  saved ship. The required pre-push suite validates this delivery state.
- No Google Chrome or physical-controller check is claimed. No performance claim.
- All acceptance criteria have supporting automated or owner evidence. Status Done.

- Owner validation, separate from automated checks: on 2026-11-02 the owner
  answered “Accept the current strong-ship rule” to the completed local flow:
  three ships, earned power intact, starting up to the saved ship's highest
  reached sector. No additional power cap was approved.
- The first full run stopped at a new VM test fixture missing `location` while
  loading the game module. This is test setup; the fixture now supplies it.
