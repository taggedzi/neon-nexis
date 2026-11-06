# 043 — Add missiles, lightning, bombs and area-denial weapons

Status: Planned

## Problem or player need

Random additional weapons should offer distinct tactical choices, including area damage.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 042 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement Seeker Missiles, Arc Projector, Gravity Bomb and Plasma Mortar from 040 using finalized 041 rules.
- Use existing world-space aiming/input data and bounded projectile travel; controller aiming must not depend on mouse-only target coordinates.
- Enforce distinct chain targets, per-owner field stacking rules, boss slow limits and no allied damage/knockback.
- Provide procedural/local visual and sound effects while preserving threat readability and graphic quality. Bound effect lifetimes/entity counts.
- Expose weapon definitions and effects through 042's dispatch; do not add reward rolls, alternate input handlers or persistence formats.

Discovery starting points (verify against actual code): Verified content, simulation, collision, rendering and procedural audio/effects.

## Alternatives and tradeoffs

Area effects increase multiplayer damage and visual load; keep performance evidence separate from balance changes.

## Acceptance criteria

- [ ] Seeded scenes verify missile targeting, chain ordering/no repeated hits, radius boundaries, field duration and overlap, and boss resistance.
- [ ] Damage/slow/expiry remain consistent across frame intervals and pause/resume.
- [ ] Host/guest representation and kill/stat attribution have focused coverage using agreed interfaces.
- [ ] Record equivalent-scene visual review and representative effect counts; do not equate headless FPS with real-player performance.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/60
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/59
Local source: `docs/work-to-be-done/043-offensive-area-weapons.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

