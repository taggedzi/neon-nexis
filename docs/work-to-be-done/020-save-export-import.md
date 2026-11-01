# 020 — Export and import all save data

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 4 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

Saves and settings live in the browser's local storage for one site address.
Clearing site data, or moving to another browser or machine, drops that
progress. The player wants a file they can keep and import later, including on
a different browser.

## What exists today

There is one checkpoint. `js/game.js` writes `SAVE_VERSION` 1 through
`N.writeSave`. The blob holds the run seed and sector, player hull, color,
weapons, passives, core, and the sector's destroyed objects and ground items.
`G.canLoadSave` rejects a checkpoint that would break level generation. Co-op
does not write this checkpoint.

`js/save-policy.js` can download the raw checkpoint, but only as part of
removing an incompatible save. The download name is
`neon-nexus-old-save-<time>.json`. Export starts a browser download. The code
cannot confirm the file landed on disk. A failed export keeps the local data.
Settings are stored separately and are kept when an incompatible checkpoint is
removed. The README states that saves do not sync between devices.

The menu already shows `N.RELEASE_VERSION`, which is `development` in source
and stamped in `dist/` by `tools/ci/package.cjs`.

## Determine

- The full set of localStorage keys the game writes today: checkpoint, settings,
  and any other key. List them from `js/util.js` and the writers, not from memory.
- Which of those keys are safe to put in a file the player might share.
  Exclude nothing the player needs to restore their game. Do not add secrets
  the client does not have.
- How import should behave when the file's save version is not 1. The current
  rule is that developers own compatibility, and an unsupported save gets an
  explicit export or remove choice. See
  [the development guide](../development-and-releases.md).

## Decide

- One file for checkpoint plus settings, or separate files?
- Does import replace local data immediately, or ask first when a checkpoint
  is already present?
- What happens to a file that fails validation? Reject the file and leave local
  data untouched.
- Does a future named-ship list ([issue 024](024-named-ship-loadouts.md)) and
  logbook ([issue 026](026-enemy-logbook.md)) belong in this same file?

Proposal, not approved:

- One JSON file containing the checkpoint, settings, and a file version.
- Import shows a short summary and requires confirmation before replace.
- Invalid JSON or a failed `canLoadSave` does not change local storage.
- Leave room in the file for later lists, but do not invent those lists here.
- Keep the existing incompatible-save dialog. This issue adds a voluntary
  backup from the menu, for data the game can still load.

## Do

After the decisions:

- Add export and import actions where the menu already talks about saves.
- Build the file from the stored values. Do not scrape the live sim.
- Validate before write. Never clear storage as a test shortcut.
- Preserve compatible data. Unsupported data still offers export or removal
  rather than a silent wipe.
- Cover with a Node or browser check: round-trip, reject garbage, reject a bad
  sector, confirm an existing good save survives a rejected import, and confirm
  settings survive. State that a browser download cannot prove the file reached
  disk.

## Acceptance criteria

- [ ] The player can download a file of their current save data from the menu.
- [ ] The player can import that file in the same browser and in another browser
      profile at the same game version.
- [ ] A bad file does not destroy the data already stored.
- [ ] Replacing an existing checkpoint requires confirmation.
- [ ] Settings included by the decision come back with the checkpoint.
- [ ] Co-op still does not overwrite the single-player checkpoint.
- [ ] An incompatible checkpoint still offers export or remove.

## Open questions

- Should the file include settings the player may consider private, such as
  control bindings?
- Is a menu action enough, or is a pause-menu action also required?

## Dependencies

This is the backup format later features should extend, not replace.
[Issue 024](024-named-ship-loadouts.md), [issue 025](025-player-stats.md), and
[issue 026](026-enemy-logbook.md) should say whether their data is inside this
file. They can be designed after this format is approved. They should not each
invent a second export path.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
