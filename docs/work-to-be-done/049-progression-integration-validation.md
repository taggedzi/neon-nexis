# 049 — Activate and validate uninterrupted progression end to end

Status: Planned

## Problem or player need

Separate feature implementations need integrated proof before replacing the existing reward flow.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 048 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Integrate 042–048 against 041 contracts and activate the new progression only when all prerequisites are complete.
- Exercise all four hulls, three offensive slots and separate defense, every new weapon/passive, automatic levels, shared rewards and approved legacy transitions.
- Check solo and 2–4-player sessions including downing/revival, rejoin, packet loss/reordering, sector changes, pause/focus, resizing, menus and save/continue.
- Measure normal combat, heavy waves and extended runs with comparable workloads, entity/effect counts, frame times and memory; record browser versions, hardware/render mode, viewport, quality and duration.
- Run full npm run check and git diff --check, then obtain owner playtesting for pacing, randomness, primary-only viability, switching pressure, defenses, readability and friendly play.
- Record tuning changes separately from performance evidence. Update all child statuses and parent acceptance only with supporting evidence; do not close the epic because code alone is complete.

Discovery starting points (verify against actual code): Cross-module integration and existing test/scenario tooling; avoid new unrelated framework/tooling.

## Alternatives and tradeoffs

Automated correctness cannot establish feel, fairness or real-player performance. Retain Implemented — needs validation until required player review is complete.

## Acceptance criteria

- [ ] Full registered automated suite passes on recorded environments; desired Chrome/Chromium/Firefox support is not inferred from one browser.
- [ ] Real multiplayer/WAN and physical-device checks are recorded with limitations; unavailable checks remain pending.
- [ ] Owner accepts no reward-menu waiting, all hulls' solo viability and friendly team progression without mandatory roles or rapid cycling.
- [ ] Four-player area/defense effects meet 041's performance/readability goals without lowered default quality.
- [ ] All migration/reward/controls acceptance cases have evidence; no unresolved material design decision or required validation is hidden by closing the parent.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/66
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/65
Local source: `docs/work-to-be-done/049-progression-integration-validation.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

