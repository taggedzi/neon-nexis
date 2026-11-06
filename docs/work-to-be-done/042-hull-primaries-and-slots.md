# 042 — Implement hull primaries and three offensive weapon slots

Status: Planned

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

- [ ] Fresh construction for all hulls has correct stats/primary and capacity in solo and host/guest state.
- [ ] Primary damage, pellet totals and piercing distinct-target limits are tested; variable frame timing does not change intended firing rates.
- [ ] Switching cannot reset cooldowns or create duplicate fire; selected weapon remains valid after inventory changes.
- [ ] Existing run behavior stays unchanged while the new path is inactive.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/59
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/58
Local source: `docs/work-to-be-done/042-hull-primaries-and-slots.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

