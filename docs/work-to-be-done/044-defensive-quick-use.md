# 044 — Implement the separate defensive quick-use slot

Status: Planned

## Problem or player need

Players need defensive actions without interrupting offensive weapon selection.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 043 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement one separate reusable defensive slot, outside the three offensive slots, with Repulsor Pulse and Aegis Projector.
- Expose a deliberate activation API independent of offensive selection and toggled auto-fire. Preserve selected offensive weapon and its cooldown.
- Apply approved projectile-clear exclusions, boss displacement limits, barrier radius/capacity/duration/reapplication and damage absorption order.
- Use 041's spawn/replacement/upgrade policies and bounded cooldown/barrier stacking; include authoritative multiplayer effect events.
- 047 owns bindings and readiness HUD; this task owns simulation APIs, content and visual effects. 045 owns common level/stat calculation.

Discovery starting points (verify against actual code): Verified simulation, content, co-op effect transport and rendering boundaries.

## Alternatives and tradeoffs

An extra slot raises survivability for every build. Test defensive chaining and prevent permanent team immunity.

## Acceptance criteria

- [ ] Activation while any offensive slot is selected leaves selection intact and follows approved simultaneous-fire rules.
- [ ] Repulsor clears only eligible hostile projectiles, never allies or excluded attacks.
- [ ] Barrier absorption, expiration, allied recipients and repeat casts are deterministic; four-player casts cannot create unbounded capacity.
- [ ] Cooldown and effect state handle pause, downed state, reconnect and rejected activation through agreed interfaces.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/61
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/60
Local source: `docs/work-to-be-done/044-defensive-quick-use.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

