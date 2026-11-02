# 021 — Add a dev mode for scenario setup

Status: Done

Implementation and owner validation are complete.

Priority 5 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

Testing a specific ship, enemy, weapon, key, or controller path means playing
until the game happens to reach that state. The request is a dev mode that can
set the ship, spawn specific enemies, and put the match in a chosen state.
A password or console command would open it, for a developer or an agent.

## What exists today

There is no dev console and no debug command. The playable client does not call
`console.log`. Runs start through the normal new-run and co-op paths. The host
owns the co-op world. A guest does not spawn the host's enemies.

`tools/` already has scenario checks that call game functions in a page. Those
are test harnesses, not an in-game mode. `N.RELEASE_VERSION` is `development`
in source. `tools/ci/package.cjs` replaces it only in the staged `dist/` copy.

Anything shipped in the JS file can be read by a player. A password stored in
the client is not a lock. It only stops accidental use.

## Determine

- Which states are actually needed for the first version. A useful short list
  is: hull and color, weapon set, player level, sector number, one named enemy
  style, god-mode or invulnerability, and kill-all. Confirm that list before
  building a general scripting tool.
- Which of those already have functions (`spawn`, `loadFromSave`, ship setup)
  that a dev command can call without a second simulation.
- How a published Pages build can be forced to keep the commands absent or
  inert. The stamp of `RELEASE_VERSION` is one signal. Confirm it is present
  in every public file set.

## Decide

- Is dev mode allowed in the published game at all?
- If it is source-only, is the switch "version is development", a query flag
  that `package.cjs` removes, or both?
- Is a password required? If yes, treat it as a speed bump, and do not put a
  real secret in the repository.
- May a co-op guest open dev mode? 

Approved scope (owner instruction, 2026-11-01):

- Dev commands work only when playing from source, where the version is
  `development`. The staged production file does not include the command
  entry. The source script also refuses installation outside `development`.
- No password. A console command such as a single named function is enough
  friction, and it is usable by an agent in a test page.
- Single-player only for the first version. In co-op the commands stay off,
  including for the host, until a later approval says the host may use them
  and guests may not inject them.
- Commands must not run while the shared co-op pause contract is in force
  unless they go through the normal pause and resume paths.

## Do

After the decisions:

- Add a small command surface that calls existing game functions. Do not add a
  second rules engine.
- Keep it out of the default play path. A normal Engage / New Run must not
  change.
- Refuse commands that would write a checkpoint the player did not ask to save.
  A dev setup can save only through the normal checkpoint action.
- Add a regression that the production bundle does not expose the command, and
  a source-page check that one ship setup and one enemy spawn work.
- Do not log secrets. The owner declined a logging subsystem; add debugging
  only when needed. See the [decision](../decisions.md#2026-11-02--add-debugging-only-when-needed)
  and [issue 022](022-debug-logging.md).

## Acceptance criteria

- [x] From a source session, a dev can set a ship and spawn a chosen enemy
      style without playing to that state.
- [x] The same commands do not run in the staged production file, under the
      rule the owner approved.
- [x] A normal run, save, and co-op session behave as they do today when the
      commands are not used.
- [x] A guest cannot inject a dev command into the host's world.
- [x] Using a command does not leave fire, pause, or focus stuck.

## Open questions

- Resolved: console commands are enough; no on-screen panel.
- Resolved: file loading stays with [issue 020](020-save-export-import.md).

## Dependencies

Useful before [issue 023](023-skill-levels.md) and
[issue 029](029-ship-stats-and-colors.md), because those need repeatable setups.
It does not block [issue 017](017-weak-cryptography-alert.md) or
[issue 019](019-pointer-lock-and-focus-pause.md).

## Implementation and validation

Owner approval on 2026-11-01: source-only, single-player-only console commands,
no password or panel; production packages omit the entry point. Approved commands:
hull/color, weapons, player level, sector, named enemy spawn, invulnerability,
and kill-all. File loading stays with issue 020. No automatic dev checkpoint saves.

Changed files: `js/dev.js`, `index.html`, `tools/ci/package.cjs`,
`tools/ci/dev-mode.spec.cjs`, `tools/ci/coop-smoke.spec.cjs`,
`tools/check-dev-package.cjs`, `docs/dev-mode.md`,
this issue, the backlog index, and `docs/decisions.md`.

Implementation choices: setup creates a fresh scenario through `loadFromSave`,
with seed 1 by default, levels/sectors bounded to 1 through 100, and normal initial
enemies. Mutating commands pause normally. Enemy spawn and kill use existing
combat functions, including population limits, rewards, and splitter children.
Dev runs suppress every checkpoint reason except the normal `manual` action,
including later timer, focus, reward and quit saves. Invulnerability is attached
to the live player only and is not serialized. See [usage](../dev-mode.md).

Automated validation on Windows, Node v24.14.1, PHP 8.4.13, Playwright
Chromium 156.0.8078.4 and Firefox 157.0:

- `npm run check` passed syntax, lint, unit checks, and 112 browser tests.
  This includes normal run/save/continue, pause/focus, save transfer, and co-op.
- The actual staging command passed its new regression: neither `js/dev.js`
  nor its script tag exists in `dist/`, including local development staging.
- Source tests verified hull/color, weapons, player level, sector, free enemy
  spawn position, immunity, splitter kill-all, unchanged browser storage,
  blocked automatic saves, deliberate manual saving, rejected invalid setup,
  pause/resume, and ordinary saving after a new normal run.
- Initial sandbox runs could not reach loopback PHP servers. The successful
  suite ran with local server access outside that restriction.
- Final focused follow-up passed 6 browser tests across both browsers after
  the last guard changes: lobby roles and both live co-op peers reject every
  mutating command; held fire clears; blur pauses and focus leaves it paused.
- Final lint and `git diff --check` passed.

Owner validation on 2026-11-02: the owner reported, "It works as expected,"
after the requested DevTools playtest. This completes the remaining owner
validation, including the command pause/input acceptance criterion.

Limitations: agent browser checks used synthetic input/focus events. Google
Chrome and physical controllers were not separately checked by the agent. The
owner did not specify browser or device details.

Delivery branch: `codex/feat/dev-mode`. The owner authorized committing,
pushing the branch, and opening a pull request on 2026-11-02; the owner will
merge it.
