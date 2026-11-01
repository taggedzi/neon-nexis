# 027 — Let enemy fire damage other enemies

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 11 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

Enemy shots should be able to hurt other enemies, as a toggle. In a crowded
sector the enemies would thin each other out, which adds a tactical layer.
The toggle keeps the current fight available.

## What exists today

`G.updateEnemyBullets` in `js/sim.js` moves enemy shots and tests them against
the local player and, on the host, co-op remote players. A hit damages that
player and kills the shot. It does not test other enemies.

Player shots and some player area effects call `G.damageEnemy`. `G.explode` in
`js/game.js` can damage enemies inside a radius. Whether an enemy-owned
explosion already does that has to be confirmed from the callers before anyone
claims friendly fire is partly implemented. Contact damage is player-facing.
Enemies do not trade contact damage with each other in the bullet loop above.

The host simulates enemies and their shots. Guests render the host's world.
[Issue 001](001-performance.md) is still not fully validated. Extra collision
tests in a full wave are a real cost. Bullet caps already exist
(`MAX_ENEMY_BULLETS` is 850).

## Determine

- Which enemy attacks spawn a bullet, a mine, or an explosion. The toggle's
  scope depends on that list.
- Whether any enemy explosion already calls `G.damageEnemy`.
- A crowded-sector entity count from an existing performance note, so the new
  tests can be judged against a known load. Do not invent a frame-time budget.
- How a dead enemy from friendly fire awards XP, drops, and kill credit. Current
  kill credit assumes a player source.

## Decide

- Default of the toggle. 
- Bullets only, or bullets plus enemy explosions, mines, and contact.
- Do friendly-fire kills grant XP and drops?
- Does the killed enemy count in the player's kill stats and logbook?
- Co-op: host setting, and can it change mid-match?

Proposal, not approved:

- Default off, so current fights stay the same.
- When on, enemy bullets and enemy-owned explosions can damage other enemies.
  Contact between enemies stays off, to avoid crowd shove becoming instant death.
- A friendly-fire kill grants no XP and no drop. It does not increment the
  player's kill count or the logbook. The enemy simply leaves the field.
- The host chooses at match start. Guests cannot toggle it locally.
- Single-player uses a settings toggle that applies to the next run.

XP and drop rules are the balance decision. They need owner approval because
they change how crowded sectors pay the player.

## Do

After the decisions:

- Add the tests in the host sim only. Guests do not run a second damage pass.
- Tag the damage source so rewards and [issue 025](025-player-stats.md) can
  ignore non-player kills.
- Keep the bullet cap behavior. Do not raise it to "make room" for this feature.
- Setting and match-start message follow the same pattern as skill in
  [issue 023](023-skill-levels.md) if that issue has landed. If it has not,
  use a single boolean on the existing start message and note the overlap.
- Checks: toggle off does not hurt a neighboring enemy; toggle on does; a
  player is still damaged; no XP on a friendly-fire kill under the proposal.
- One browser pass in a dense wave, with browser, viewport, quality, and entity
  counts written down. This does not close issue 001.

## Acceptance criteria

- [ ] The toggle exists and defaults to the approved value.
- [ ] With the toggle off, enemy fire does not damage enemies.
- [ ] With the toggle on, the approved attack types damage other enemies.
- [ ] Players are still damaged as they are today.
- [ ] XP, drops, and kill credit follow the approved rule.
- [ ] In co-op, only the host's choice changes the sim.
- [ ] A dense-wave browser check is recorded and does not claim issue 001 is done.

## Open questions

- Should a sniper shot still be lethal to a rusher, or is friendly-fire damage
  reduced?
- Can the player use this on purpose, and should the How to Play page say so?

## Dependencies

Independent enough to build before four-player co-op. Reward results must match
[issue 025](025-player-stats.md) and [issue 026](026-enemy-logbook.md) if those
are already approved. Performance evidence stays under
[issue 001](001-performance.md).

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
