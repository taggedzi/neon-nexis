# 041 — Approve progression rules and define integration contracts

Status: Planned

## Problem or player need

Independent agents need one agreed equipment/reward model before changing combat.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 040 completed and handed off as a planning document. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Resolve the parent spec's open gameplay decisions with the owner: proposed numeric tables/caps; launch defense and replacement policy; reward weights/pacing/fallback including full health; repair/buff sharing; XP ownership/sequence/catch-up; retained versus retired cores/modifiers/rarity/protocols; boss/field stacking and simultaneous firing; saved-loadout compatibility.
- Inventory current equipment, input, save/loadout, co-op binary/grant and reward paths through the knowledge graph. Record actual symbols/files and existing regression coverage.
- Specify stable equipment IDs, offensive slots (primary + two), separate defensive slot, levels/stacks/cooldowns, selected slot, reward event/participant IDs, authoritative random outcomes, and versioned serialization boundaries.
- Define API ownership for activation, switching, stat rebuilding, reward resolution, persistence and UI notifications. Child implementations must consume these contracts rather than invent parallel state.
- Record owner-approved decisions and superseded rules; do not interpret proposed numbers as approved. Define an inactive integration boundary and explicit final cutover owner.

Discovery starting points (verify against actual code): Content, ships, simulation, input, game, UI, save/loadout and co-op modules; verify locations first.

## Alternatives and tradeoffs

More up-front design prevents agents implementing mutually incompatible defaults. Keep this focused on contracts, not a framework rewrite.

## Acceptance criteria

- [ ] Every material open rule has an owner answer or a precisely identified blocked child; dependent implementation does not proceed through an unresolved gate.
- [ ] Contract examples cover fresh solo, four players, full/maxed inventory, defense, downed/rejoining players and legacy saved ships.
- [ ] Map every existing equipment/reward kind to retained behavior, migration, or explicit incompatibility; no silent losses.
- [ ] Document measurable performance/playtest acceptance goals for 049 without inventing benchmark results.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/58
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/57
Local source: `docs/work-to-be-done/041-progression-contracts.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

