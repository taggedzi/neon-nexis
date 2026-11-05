# 025 — Track player stats and an end-of-run tally

Status: Done

Implementation follows the owner-approved decisions below. Original planning
notes are retained for context.

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

- [x] The approved counters change when the matching event happens.
- [x] Single-player end of run shows that match's tally.
- [x] Co-op end of match shows one row per participant, with remote rows supplied
      by those clients under the authority rule.
- [x] Turning the feature off follows the approved record and display rule.
- [x] Totals stay on the client. No new score server is added.
- [x] Existing game-over information is still available unless a removal was
      approved.

## Open questions

- Do missed shots and shots that hit a wall count as shots fired?
- Does a dropped item mean a discarded weapon, a death loss, or both?
- Should lifetime totals reset when a hardcore run deletes the checkpoint?

## Dependencies

Display can ship before named ships. Persistence "with their ships" must be
updated if [issue 024](024-named-ship-loadouts.md) defines a ship list.
Backup inclusion extends [issue 020](020-save-export-import.md). File version 1
is the checkpoint and settings only. Stats should use a new file version, not
a second export.
The logbook ([issue 026](026-enemy-logbook.md)) should share the profile store
if both are approved, rather than two independent lifetime files.

## Implementation and validation

### Decisions — 2026-11-02

Approval source: owner answers in this chat on 2026-11-02. These supersede
conflicting proposals above.

- Match tallies plus lifetime totals in a separate local profile shared by all
  saved ships, included in the existing backup and preserved by Hardcore death.
- Default on. Off hides the board and stops recording without deleting totals.
  The board sits below existing end-of-run information.

### Decision — 2026-11-05

Approval source: owner. The main menu no longer shows the last match tally.
Player Stats remains the lifetime view. The death screen and the co-op end
board still show that match.
- Shots fired: each emitted projectile/pellet, beam, mine or strike, including
  misses and wall hits. Shots hit: at most once per shot when it damages an
  enemy or objective. Persistent orbitals are individual emitted projectiles;
  chain arcs are single emitted attacks. Secondary effects inherit their shot.
- Ships destroyed; Objectives destroyed (anchors); Hits taken (events that
  remove HP or shield, including contact/explosions); Items picked up;
  Items discarded; Items lost on death (only inventory/rewards actually removed).
- Host confirms hit, kill and objective attribution to the attacking pilot.
  Each client records its own shots, damage taken and inventory events, and
  supplies its own board row. Show the board on team wipe and leaving a match;
  departing players see the latest available remote row.
- Rationale: local ownership, clear shot accuracy semantics and no double credit.
  No score server. Issue 026 will use the same profile storage.

### Work and validation

- Issue 024 merged in PR #28 (`2d83974`) before this issue started.
- Origin fetched; main current and clean; no open PRs.
- Task branch: `codex/025-player-stats`. Implementation: `83230db`.
- Added `js/profile.js` and `js/player-stats.js`: validated local lifetime store,
  match counters, per-shot identity, damage-event attribution and row exchange.
- Connected emitted projectiles, orbitals, beams/arcs, mines and strikes to their
  damage paths, including chain and area effects. Host confirmations use the
  repeated cumulative confirmation totals, so repeated/late delivery does not
  double-count across lives or sectors. Wire version 4 carries fire IDs.
- Added death-loss events, lifetime viewer/toggle, end boards and backup file
  version 3. Versions 1/2 preserve an existing profile; failed profile writes
  roll back all four storage keys. Profile imports do not transfer peer identity
  or active-match confirmation state.
- Current match counters are stored with checkpoints; loading a checkpoint
  restores that snapshot without rolling back lifetime totals. A checkpoint's
  equipment/reward entries protect those items from being counted as death
  losses; Hardcore protects none. Discard/loss counts are inventory entries,
  not the number of upgrades integrated into an entry.
- On a team wipe the world stops while the host requests the guest's final row.
  Requests retry; after two seconds an unavailable peer uses its latest row,
  visibly marked Unavailable when none has arrived. Leaving uses the latest
  remote row. Existing end data remains available beside the new board.
- Local session counters and confirmation watermarks flush atomically with
  lifetime totals, preserving guest tally across reload without replaying credit.
  Storage writes are batched, not performed for every projectile.
- Dev scenario activity updates its match tally but not lifetime totals. It
  preserves the existing no-automatic-storage rule; explicit manual checkpoint
  remains the authorized persistence action. Normal source gameplay records.
- Syntax/lint and save-transfer/wire unit checks passed. Twelve focused solo,
  loadout and backup checks passed on Chromium 156.0.8078.4 and Firefox 157.0.
  Eight nearby co-op/Hardcore/loadout checks and eight stats/recovery checks also
  passed. Agent inspected the co-op table screenshot; names and counts are
  readable and existing styling is preserved.
- Full `npm run check` passed syntax, lint, unit checks and 136 browser tests
  before final hardening. Additional checks cover copied in-memory checkpoint
  tallies, ignored optional tally corruption, real storage write failure/retry,
  and separate cumulative credits/rows for replacement participants.
- The final focused run had four Chromium startup/link timeouts before feature
  assertions, with all seven Firefox cases passing. Re-running the same seven
  Chromium cases with two workers passed. No assertions were weakened.
- Stats follow participant identities, including delayed shots and rows from
  departed guests; a new guest never inherits the prior guest's credit stream.
  Existing lifetime/confirmation state is preserved for returning identities.
- Optional tally corruption is ignored without invalidating playable progress.
  In-memory checkpoint counters are copied, failed profile writes are reported,
  and import strips active-match state instead of transferring a peer's session.
- The final ownership check passed in both browsers. Numeric table cells use
  the existing keyboard/controller focus path, including horizontally scrolled
  participant columns. Agent inspected single-player and co-op screenshots.
- Changed files include `js/profile.js`, `js/player-stats.js`, `js/stats-ui.js`,
  event propagation in simulation/game/co-op, save transfer, script loading,
  menu/table styling and focused tests. Dev scenario introspection preserves its
  existing storage policy. No score server or dependency was added.
- All acceptance criteria have supporting evidence. Status: Done. The required
  pre-push suite runs against the final delivery state before merge.
  No physical-controller or Google Chrome check is claimed. No performance claim.
