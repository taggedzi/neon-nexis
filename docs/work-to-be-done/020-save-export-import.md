# 020 — Export and import all save data

Status: Done

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

Approved by the owner on 2026-11-01:

- One JSON file. It holds file version 1, the stored checkpoint (or `null` when
  there is no checkpoint), and settings. Settings include control bindings,
  audio, and graphics. The co-op browser identity stays out of the file.
- Every import asks first and shows a short summary, including when this
  browser has no checkpoint. A file with no checkpoint removes the stored
  checkpoint after that confirmation.
- Invalid JSON, a file version other than 1, or a checkpoint that fails
  `canLoadSave` does not change local storage. Settings from that file are not
  applied either.
- Export and import live on Settings → Data. Export works from the main menu
  and from pause. Import works only from the main menu, so a live run cannot
  overwrite the file. Pause explains that the player quits to the menu first.
- The export is the last stored checkpoint, not the unsaved fight. The Data tab
  still has Sync for the live run.
- Later lists (named ships, stats, logbook) do not get keys in this version.
  They extend this file with a new file version instead of a second export.
- The incompatible-save dialog stays. This issue adds a voluntary backup for
  data the game can still load.

Agent implementation choices, 2026-11-01:

- The file is capped at one million characters. Unknown settings keys are
  dropped. Known settings go through `normalizeSettings`, the same clamps as
  a normal load.
- A failed write restores the previous checkpoint and settings.
- After a successful menu import, the in-memory run left behind by Save & Quit
  is cleared so Sync cannot write it back over the imported file.
- The download name is `neon-nexus-backup-<time>.json`. The recovery download
  keeps `neon-nexus-old-save-<time>.json`.

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

- [x] The player can download a file of their current save data from the menu.
- [x] The player can import that file in the same browser and in another browser
      profile at the same game version.
- [x] A bad file does not destroy the data already stored.
- [x] Replacing an existing checkpoint requires confirmation.
- [x] Settings included by the decision come back with the checkpoint.
- [x] Co-op still does not overwrite the single-player checkpoint.
- [x] An incompatible checkpoint still offers export or remove.

## Open questions

Resolved by the owner on 2026-11-01. See Decide. No open questions remain.

## Dependencies

This is the backup format later features should extend, not replace.
[Issue 024](024-named-ship-loadouts.md), [issue 025](025-player-stats.md), and
[issue 026](026-enemy-logbook.md) should say whether their data is inside this
file. They can be designed after this format is approved. They should not each
invent a second export path.

## Implementation and validation

Changed files: `js/save-transfer.js`, `js/util.js`, `js/ui.js`, `index.html`,
`tools/check-save-transfer.cjs`, `tools/ci/save-transfer.spec.cjs`, `README.md`,
`AGENTS.md`, `docs/development-and-releases.md`, `docs/decisions.md`,
`docs/work-to-be-done/README.md`, issues 024, 025, and 026, and this issue.

Implementation notes:

- `N.SaveTransfer` builds the file from stored checkpoint and settings. It does
  not read the live sim. `neon-coop-identity-v1` is not included.
- Import calls `canLoadSave` before any write. Save version other than 1 fails
  that check. A bad file leaves the checkpoint, settings, and unrelated keys.
- Co-op still returns before `writeSave` in `saveCheckpoint`.
- The Data tab starts a download and tells the player the page cannot confirm
  the file reached disk.

Checks and results, 2026-11-01, Windows, Node from `npm run check`:

- `npm run check` passed. Browser step: 106 passed, about 4.4 minutes.
  Playwright Chromium 156.0.8078.4 and Firefox 157.0.
- `tools/check-save-transfer.cjs` passed: round-trip, garbage, file version 2,
  a negative sector, a full storage write that rolls back, corrupt stored
  settings, and a co-op `saveCheckpoint` that does not call `writeSave`.
- `tools/ci/save-transfer.spec.cjs` passed on both browsers. One context
  downloaded the file. A second context rejected a broken file and a bad
  sector, cancelled a confirm, then imported. Continue loaded seed 11.
  Settings deadzone and the move-up binding came back. The co-op identity and
  an unrelated key stayed. Pause kept Import disabled and exported the stored
  checkpoint.
- `tools/ci/save-policy.spec.cjs` passed on both browsers, so the
  incompatible-save export or remove dialog still behaves as before.
- Same-browser replace is the Node apply onto an existing checkpoint, plus the
  Playwright confirm step. The second Playwright context is the other profile.

These are automated checks. The owner has not played the new Data tab yet.

Limitations: a browser download, including the Playwright download, shows that
the browser offered the file. It does not prove a player's own disk received it.

Remaining work: none in this issue. Owner play of the Data tab is optional.
The implementation commit hash is recorded in the pull request.
