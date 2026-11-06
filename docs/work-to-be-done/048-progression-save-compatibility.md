# 048 — Preserve saved ships and version progression state and network compatibility

Status: Planned

## Problem or player need

Existing saves can contain excess weapons, pending rewards and old upgrades that cannot be silently discarded.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 047 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement 041-approved policy for checkpoints, named ships, exported/imported backups, old slot counts, retired equipment/cores/modifiers and pending tray/protocol rewards.
- Version and validate equipment IDs, levels/stacks, offensive selection, defense/cooldowns, pacing/XP and reward ledger state. Validate malformed and future versions explicitly.
- Preserve settings/remaps, owner data and existing save recovery export/remove offers. Never trim valuable gear or clear storage silently.
- Finalize 046's wire-version/serialization compatibility and explicit incompatible-peer rejection. Preserve authoritative event outcomes and reconnect recovery without duplicate grants.
- Preserve host permission for saved-loadout use, difficulty, run stats and logbook attribution; loading a strong ship must not become an implicit rebalance.
- Document supported migration cases and any deliberately unsupported cases before enabling the feature.

Discovery starting points (verify against actual code): Verified save-policy/transfer, game serialization, loadouts and co-op wire codecs.

## Alternatives and tradeoffs

Silent simplification of legacy builds would destroy earned progress; compatibility is a rollout requirement, not post-launch cleanup.

## Acceptance criteria

- [ ] Fixture matrix covers old/fresh/current saves, named ships, pending rewards/protocols, oversized inventories, capped items and malformed/future data.
- [ ] Backup round trips and repeated save/continue preserve equivalent state and do not duplicate upgrades or healing.
- [ ] Recovery offers export before removal or explicit removal; tests use isolated storage only.
- [ ] Host/guest version mismatch, reconnection and repeated grant snapshots are tested in multiplayer.
- [ ] No new-mode path is publicly enabled until complete compatibility and 049 cutover checks pass.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/65
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/64
Local source: `docs/work-to-be-done/048-progression-save-compatibility.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

