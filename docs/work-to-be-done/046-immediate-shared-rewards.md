# 046 — Implement immediate shared rewards, automatic levels and team pacing

Status: Planned

## Problem or player need

Equipment and level rewards currently require choices and can slow a whole co-op run.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 045 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement primary/offensive/defensive/passive reward categories with immediate grants, per-player authoritative random offensive/defensive installation, and shared passive type.
- Fill empty additional slots before upgrades; use the approved full/maxed slot, tie-break and fallback rules. Never auto-replace or auto-select equipment.
- Implement unique event identity, participant outcome storage and idempotent application across simultaneous collection, retry, downing, disconnection and rejoin.
- Preserve locked starting roster and host-approved saved-loadout policies; reward original eligible participants regardless of collection proximity.
- Replace pending level-up choices with 041-approved automatic progression; implement repair/buff sharing and capped outcomes.
- Implement team-wide pacing including early weapon opportunity, boss/cache/luck behavior and difficulty/saved-level interaction. Expose summary notifications for 047.
- Own live grant/transport sequencing; coordinate version constants and serialization adapters with 048. Do not activate the new player experience before 049.

Discovery starting points (verify against actual code): Verified game reward/pacing, XP, co-op grant and wire modules.

## Alternatives and tradeoffs

Shared grants multiply team power; counting enemy drops per player would over-accelerate progression. Network correctness needs concrete outcomes, not shared random seeds alone.

## Acceptance criteria

- [ ] Controlled reward sequences prove deterministic upgrades and independent recorded random outcomes without requiring all players to differ.
- [ ] Duplicate/reordered/retried messages and simultaneous collection yield one outcome per eligible participant; reconnect does not reroll.
- [ ] Downed/disconnected original players recover rewards; new mid-run participants are not introduced.
- [ ] XP/drops and full/maxed inventories cannot open a choice screen, silently lose progression or generate unlimited fallback healing.
- [ ] Solo and 2–4-player pacing measurements use comparable workloads and record actual reward counts.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/63
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/62
Local source: `docs/work-to-be-done/046-immediate-shared-rewards.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

