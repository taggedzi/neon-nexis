# 042 — Implement hull primaries and three offensive weapon slots

Status: Done

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

Revised 2026-11-07 on `feat/042-hull-primaries-and-slots` at the owner's
request. The earlier attempt remains in branch history at `912e40d`.
The branch is based on `2c5bde0`, where prerequisite 041 merged.

- `js/progression-content.js` defines the approved hull primaries and reserves
  the stable additional-weapon IDs. `js/progression-equipment.js` creates the
  fixed inventory, validates offensive slot categories, handles selection and
  simulation timers, and emits primary firing events.
- `js/game.js` and `js/coop.js` provide explicit shared-mode construction for
  local and remote players. Level and XP are read-only views of canonical state.
  Public launch, saves, and co-op continue using the existing mode.
- `js/sim.js` resolves new primary hits along the full traveled segment using
  existing wall geometry, hitboxes, and damage handlers. Hits resolve in travel
  order, then by stable target ID on a tie. The projectile keeps its original
  damage and owner after switching. Existing projectile collision is unchanged.
- `index.html` loads the modules. `tools/check-equipment.js` exercises them in
  the browser and is registered in `tools/ci/regression.spec.cjs`.

### Implementation choices

- D4/D7 supply the approved damage, intervals, speeds, lifetimes, cone, and
  three-enemy Rail limit. Talon's level-one rail hit is 35 before criticals.
  The earlier branch's projectile colors, sounds and sizes were retained.
- Primary shots start at the ship center so the first collision sweep includes
  nearby enemies and walls. Muzzle effects retain their offset. Anchors and
  caches take damage and stop the shot without spending Rail's enemy pierce.
- Fractional timing credit applies only to the selected weapon in the step it
  became ready. Holstering or waiting another step discards that credit, and a
  long step cannot bank multiple shots. The integration caller owns ticking only
  during advancing combat for live, connected participants.
- The new path stays inactive until 049. Additional weapon effects, defense,
  derived passives, input and HUD, save/network compatibility, and final
  playtesting remain with their assigned issues.

### Checks and results

- On Windows, `npm run check` passed syntax, lint, unit checks, and all 200
  browser tests in headless Chromium 156.0.8078.4 and Firefox 157.0. The
  equipment fixture passed 134 assertions in each browser, covering construction,
  hull damage, pellet spread, ordered rail impacts, walls, projectile expiry,
  objective damage, and firing cadence across simulation step sizes.
- The existing solo, co-op, and save regressions passed. The shared equipment
  checks use explicit fixtures. Public activation and owner playtesting are
  tracked in 049.
- Review on 2026-11-07 added hostile-mine collisions. The focused equipment
  suite passed 135 assertions in each browser. A subsequent full run was stopped
  after several co-op browser tests timed out under parallel load.
- `git diff --check` passed before commit.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/59
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/58
Local source: `docs/work-to-be-done/042-hull-primaries-and-slots.md`.
The planning handoff and 041 are merged. This issue is implemented behind the
inactive boundary; 049 still owns public activation.

