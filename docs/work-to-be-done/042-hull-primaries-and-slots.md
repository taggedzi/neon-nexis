# 042 — Implement hull primaries and three offensive weapon slots

Status: Implemented — needs validation

## Problem or player need

Ships need distinct starting playstyles and a bounded inventory that supports active selection.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 041 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement Kite/Pulse Repeater, Dart/Needle Blaster, Delta/Scatter Cannon and Talon/Rail Lance using 041-approved values. Preserve issue 029 hull bases, geometry and cosmetic colors.
- Create one permanent primary and two additional offensive slots plus a separate defensive slot in the agreed state model. Primary cannot be displaced by a pickup.
- Implement offensive selection/switching simulation APIs with persistent per-weapon cooldowns, empty-slot skipping and approved switch delay; exclude defense from selection.
- Apply hull damage exactly once, preserve existing projectile behavior after switching, and retain unlimited primary ammunition. Keep the new path inactive until 049.
- Expose content IDs/capacity/selection APIs for later tasks; 047 owns user-facing binding/HUD integration and 048 owns old-data conversion.

Discovery starting points (verify against actual code): Verified content/ships/player construction and simulation weapon dispatch.

## Alternatives and tradeoffs

Distinct primaries may amplify Talon's existing damage advantage; do not rebalance approved hull stats implicitly.

## Acceptance criteria

- [x] Fresh construction for all hulls has correct stats/primary and capacity in solo and host/guest state.
- [x] Primary damage, pellet totals and piercing distinct-target limits are tested; variable frame timing does not change intended firing rates.
- [x] Switching cannot reset cooldowns or create duplicate fire; selected weapon remains valid after inventory changes.
- [x] Existing run behavior stays unchanged while the new path is inactive.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Implemented 2026-11-06 on branch `feat/042-hull-primaries-and-slots`, based on
`2c5bde05c7ff600d3946fcc62654cf1081071bc0` (`origin/main`, after 041 merged).
No commit, push, PR, merge or deployment was performed. The owner selected the
concurrent `progression-equipment` implementation after an overlapping second
OpenCode session briefly wrote a duplicate design; the duplicate module was
removed with owner authorization.

### Changed files

- `js/progression-content.js` (new): versioned catalog, stable primary order,
  hull-to-primary mapping, approved primary values, and reserved additional
  offense IDs for 043.
- `js/progression-equipment.js` (new): canonical equipment state, creation,
  selection/cycling, cooldown ticking, state validation and hull-primary firing.
- `js/game.js`: internal `makePlayer(selection, progressionMode)` boundary.
  `shared_v1` attaches `player.progression`; default construction and
  `G.newRun` remain `legacy`.
- `js/coop.js`: optional progression mode forwarded by `makeRemotePlayer` for
  host/guest construction fixtures; existing callers still default to legacy.
- `index.html`: load the catalog and equipment modules before gameplay code.
- `tools/check-equipment.js` (new): browser regression coverage.
- `tools/ci/regression.spec.cjs`: register the equipment suite.
- This issue and the backlog index.

### Implementation notes and agent decisions

- Approved values come from D4/D7: Pulse Repeater 10 / .20 s / 900 / .8 s;
  Needle Blaster 6 / .12 s / 1200 / .6 s; Scatter Cannon 5 pellets of 5 / .55 s
  / .62-radian cone; Rail Lance 28 / .70 s / 1800 / .6 s / three distinct
  targets. Talon's existing 1.25 hull multiplier makes its level-one rail hit
  35. Approved hull stats and geometry are unchanged.
- Primary colors, labels, sounds and the `needle` visual kind are agent choices;
  no owner balance or feel approval is claimed.
- `pierce` is `maxDistinctTargets - 1` because the existing bullet collision
  counts extra hits after the first. Rail therefore stops after its third
  distinct enemy and its `hitSet` prevents repeat damage.
- Additional offensive slots exist in state and selection/cycling, but firing
  an additional slot returns `weapon-not-implemented`; 043 owns those effects.
  Defense remains a separate field and is excluded from offensive cycling.
- Switching uses the approved .15 s delay, skips empty slots, never resets
  individual cooldowns, and preserves already-created projectiles. Selection
  normalizes back to a valid slot if inventory changes.
- Cooldowns advance only through `tick(elapsedSeconds)`; no wall clock or frame
  count is used. Overshoot time is retained in a bounded per-state credit so
  ready weapons do not lose fractional simulation time. Validation found and
  fixed a floating-point case where 12 ticks at 1/60 s left a tiny positive
  cooldown instead of zero.
- `shared_v1` is an internal construction fixture. Public `G.newRun` records
  `progressionMode: 'legacy'`, and legacy weapons/passives/slots remain the live
  path until 049. No save, wire, HUD, input-binding or reward path was changed;
  those remain with 046–049.
- Primary projectiles carry `ownerParticipantId` and `activationId` when supplied,
  plus the existing `coopPlayer` attribution field. Critical parameters remain
  the approved 5% / 1.75 values for later combat integration.

### Checks and results

- `npm run check` passed on 2026-11-06: syntax, lint, all unit checks and 200
  browser tests in Chromium 156.0.8078.4 and Firefox 157.0. The equipment suite
  ran 126 assertions in each browser.
- Coverage includes fresh state and capacity for all four hulls, solo and
  host/guest construction, approved hull stats, primary damage/pellet totals,
  real rail collision against four enemies, cooldown persistence, switch delay,
  empty-slot cycling, inventory fallback, attribution metadata, invalid state
  rejection and 30/60 Hz timing equivalence.
- `git diff --check` passed. Agent manual checks compared the implementation with
  D4/D7 and the integration contract, verified that `G.newRun` remains legacy,
  and reviewed the actual collision test rather than only descriptor values.
- An earlier overlapping `npm run check` from the second OpenCode session failed
  on co-op timeouts and the temporary duplicate-module mismatch. After that
  session exited and the selected implementation was wired in, the clean rerun
  above passed.
- Not run: owner playtesting, physical-controller checks, real co-op/WAN play,
  balance/feel review, performance measurement, save/checkpoint migration or
  wire compatibility. Those are 049/integration work or unavailable devices,
  not claimed by this issue.

### Remaining work and limitations

- Owner review of the branch/PR remains. No primary feel, pacing or balance
  acceptance is claimed.
- 043 must add additional-weapon effects and firing; 044 defense; 045 derived
  stats/passives; 046 shared rewards/XP; 047 input/HUD; 048 persistence/wire;
  049 activation and end-to-end validation.
- The new path is intentionally inactive in public play. `shared_v1` fixtures
  must not be treated as a released mode.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/59
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/58
Local source: `docs/work-to-be-done/042-hull-primaries-and-slots.md`.
The planning handoff and 041 are merged. This issue is implemented behind the
inactive boundary; 049 still owns public activation.

