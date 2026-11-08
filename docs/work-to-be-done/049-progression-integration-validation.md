# 049 — Activate and validate uninterrupted progression end to end

Status: Implemented — needs validation

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

### Combined implementation — 2026-11-08

Owner authorized implementing and reviewing the remaining issues with agents,
focused commits and one combined playtest handoff. The branch is
`feat/uninterrupted-progression-batch`; it includes the existing committed 044
implementation and the owner-approved loopback-port test-tool changes.

Integration and automated validation are in progress. The cutover switch is
`N.PROGRESSION_ENABLED`; it coordinates new-run construction, persistence and
peer compatibility. Older mechanics are exercised by explicitly scoped legacy
test fixtures; public launch and new progression scenarios exercise shared mode.
No release, push, merge or deployment is authorized or performed.

Stat/upgrade implementation commit: `f68c649`. Final validation, actual browser
environments, review fixes and remaining owner/performance checks will follow.

### Performance observations and visual review — 2026-11-08

Recorded observations are in
[`tools/performance/results-049.json`](../../tools/performance/results-049.json).
These measurements preceded the final dash resource-state extension; they are
development observations, not measurements of a published release.
Environment: Windows, Intel Core i7-12700KF, 34,212,798,464 bytes RAM,
Playwright Chromium 156.0.8078.4. A separate WebGL context reported NVIDIA
GeForce RTX 3070 Ti through ANGLE/D3D11; this does not prove the Canvas/compositor
rendering path. Graphics remained High with particles, shake, scanlines and
glitch enabled. No effects, population defaults or quality were reduced.

| Scripted solo workload | Viewport / duration | Observed results |
| --- | --- | --- |
| Normal | 1920×1080, DPR 1; 10 simulated seconds / 10.90 wall seconds | 4 enemies at first sample, 10 at end; update p95 0.8 ms, Canvas submission p95 1.6 ms, callback interval p95 26.7 ms |
| Required large wave | Same viewport; 10 simulated seconds / 13.40 wall seconds | 120 deliberately spawned before warmup, 118 at first sample, 109 at end; update p95 3.8 ms, submission p95 4.2 ms, callback interval p95 27.0 ms |
| Accelerated retention | Same viewport; 1,200 simulated seconds / 28.49 wall seconds; one render per simulated second | Reached sector 3 in playing mode; final 38 enemies, 93 enemy bullets, 33 pickups; sampled uncollected JS heap ranged 6.31–46.21 MB, ending 18.26 MB |

The benchmark's old stress setup had been constrained by the ordinary population
gate. Its test-only setup now explicitly creates required encounters and asserts
at least 80 survive warmup. Earlier capped samples are not presented as stress
evidence. Normal spawning and game balance are unchanged.

Four local contexts, each 1280×720/High, exercised missiles, arc, bomb, mortar,
Aegis and Repulsor for two 20-second wall-time workloads. At 20 enemies, callback
p95 was 66.8–66.9 ms and simulation advanced about 17.6 seconds. At 80 enemies,
p95 was 120.1 ms and simulation advanced about 10.3 seconds. All clients remained
in playing mode. These observations **do not establish the performance target**;
the four clients shared one machine/GPU, no paired baseline was measured, and
the existing frame-step cap slows simulation under this load. Short before/after
heap samples and the accelerated run do not establish retained-memory behavior
or continuous 20-minute rendering. No tuning change is claimed as optimization.
The first paused measurement was discarded; host-owned test invulnerability and
an advancing-simulation check prevent that invalid fixture from recurring.

Agent visual inspection of the final desktop and 640×600 captures found the
three offensive rows, separate defense/barrier status, active weapon glyph/glow
and cooldown bar visible within their panels. Procedural wireframes, world
effects and default quality remain present. A paired full-scene baseline and
owner readability/feel acceptance remain pending; screenshots are local test
artifacts, not committed assets.

### Remaining owner/environment validation

The code is delivered for one combined playtest. Owner acceptance of pacing,
randomness, primary-only viability, switching pressure, defense readability,
accessibility and friendly co-op play remains pending. Physical controllers,
real WAN/separate-machine play, Google Chrome as a separate installed browser,
continuous extended rendering and real-machine performance acceptance have not
been established. The parent must remain open; automated correctness and the
headless observations do not close these gates.

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

