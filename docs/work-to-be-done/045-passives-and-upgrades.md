# 045 — Implement stackable passives and predictable equipment upgrades

Status: Implemented — needs validation

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

- [x] Boundary tests cover zero/one/max/excess stacks and equipment levels with explicit invalid-data behavior.
- [x] Repeated rebuilds and reload-equivalent reconstruction do not compound stats; cooldown formula and damage multipliers match approved examples.
- [x] Capacity increments cannot fully heal by accident; capped items report eligibility correctly.
- [x] Combination tests cover defense cooldown/barrier interactions and existing retained stat sources.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Implementation, 2026-11-08, on `feat/uninterrupted-progression-batch`. The owner
explicitly authorized the 045–049 batch, parallel agents, implementation judgment,
review and commits; this supersedes the earlier serial handoff restriction for
this batch. Root integration owns the backlog update and final batch commit.

Changed files owned by 045: `js/progression-content.js`,
`js/progression-stats.js` (new), `js/progression-equipment.js`,
`tools/check-progression-stats.cjs` (new), and this record. The batch integration
also routes `G.rebuildStats` through the new derivation boundary.

- `ProgressionStats.derive(hullId, state)` calculates new stats from approved hull
  bases and canonical equipment/passives alone. Old player modifier/core arrays
  do not enter the new calculation. Invalid hulls, equipment levels, selections,
  passive IDs/stacks or timers return an explicit failure without mutation.
- Damage applies hull, weapon level and Amplifier once. Offensive activation uses
  Cooling and temporary overclock once; existing running cooldowns remain intact.
  Aegis capacity/cooldown and Repulsor damage/cooldown retain only their approved
  defense level rules. Plating applies before barrier/shield/HP through 044.
- `upgradeOutcome` returns deterministic eligibility/outcome descriptors without
  mutation or RNG. Install outcomes list stable eligible candidates for 046 to
  choose; upgrades preserve slot, selection and timer identity. Capped outcomes
  request 046 fallback rather than independently awarding repair/salvage.
- Agent implementation decision: `capacityDelta` returns absolute HP/shield
  results for one authoritative capacity-increase commit. Rebuild/restore calls
  `derive` alone. Downed participants receive no resource fill or life change;
  retained living offline participants receive their permanent added capacity
  once. This follows D5's alive-recipient rule; ordinary consumable/fallback
  connected-recipient restrictions remain separate. No temporary heal is banked.
- Automated checks run: `node tools/check-progression-stats.cjs` passed on Node
  v26.13.0. It covers all hull baselines; zero/one/max/excess passive stacks;
  invalid values/IDs; levels 1–5; cap eligibility and stable slot ties; 100 repeated
  derivations and JSON round-trip reconstruction; capacity-only resource gains;
  downed/offline handling; actual primary damage and Cooling/overclock firing;
  immutable in-flight damage; fixed defense values; and actual Plating-before-
  barrier damage absorption. Explicit zero-valued passive entries are invalid;
  absent entries represent zero. Focused ESLint and `git diff --check` passed.
- Limitations: this focused synthetic check does not establish integrated browser,
  multiplayer delivery, physical-controller behavior, performance, or player feel.
  Those remain 046–049 checks. D1–D12 starting values are implemented without
  claiming balance acceptance. Final batch checks, backlog synchronization and
  commit hash remain pending at this handoff.

Status remains Implemented — needs validation pending the integrated batch checks.
No separate 045 commit, push, PR, merge or deployment was performed.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/62
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/61
Local source: `docs/work-to-be-done/045-passives-and-upgrades.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

