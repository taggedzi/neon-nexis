# 045 — Implement stackable passives and predictable equipment upgrades

Status: Planned

## Problem or player need

Immediate rewards need clear, bounded improvements without random destructive mutations.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 044 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement approved five-level equipment curves and special Aegis/Repulsor upgrade rules from 040.
- Implement Reinforced Hull, Shield Capacitor, Thruster Tuning, Weapon Amplifier, Cooling System, Reactive Plating and Recovery Circuit with agreed caps.
- Centralize derived-stat rebuilding: additive base increments, bounded damage reduction, recharge formula, and exactly-once hull/weapon/passive multipliers.
- Apply approved capacity-increase healing and defensive/offensive modifier applicability; reconcile retained legacy modifiers/cores instead of layering duplicate bonuses.
- Expose eligibility, upgrade and capped-result APIs for 046. Do not independently grant pickups or invent conversion rewards.

Discovery starting points (verify against actual code): Verified content and derived-stat/upgrade subsystem.

## Alternatives and tradeoffs

Individually modest multipliers can create runaway combinations. Caps must cover all retained sources, not just new passives.

## Acceptance criteria

- [ ] Boundary tests cover zero/one/max/excess stacks and equipment levels with explicit invalid-data behavior.
- [ ] Repeated rebuilds and reload-equivalent reconstruction do not compound stats; cooldown formula and damage multipliers match approved examples.
- [ ] Capacity increments cannot fully heal by accident; capped items report eligibility correctly.
- [ ] Combination tests cover defense cooldown/barrier interactions and existing retained stat sources.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/62
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/61
Local source: `docs/work-to-be-done/045-passives-and-upgrades.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

