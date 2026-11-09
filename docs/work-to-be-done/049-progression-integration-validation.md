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

- [x] Full registered automated suite passes on recorded environments; desired Chrome/Chromium/Firefox support is not inferred from one browser.
- [ ] Real multiplayer/WAN and physical-device checks are recorded with limitations; unavailable checks remain pending.
- [ ] Owner accepts no reward-menu waiting, all hulls' solo viability and friendly team progression without mandatory roles or rapid cycling.
- [ ] Four-player area/defense effects meet 041's performance/readability goals without lowered default quality.
- [ ] All migration/reward/controls acceptance cases have evidence; no unresolved material design decision or required validation is hidden by closing the parent.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

### Combined implementation — 2026-11-08

Owner authorized implementing and reviewing the remaining issues with agents,
focused commits and one combined playtest handoff. The branch is
`feat/uninterrupted-progression-batch`; it includes the existing committed 044
implementation and the owner-approved loopback-port test-tool changes.

Integration and automated validation are complete as recorded below. The cutover switch is
`N.PROGRESSION_ENABLED`; it coordinates new-run construction, persistence and
peer compatibility. Older mechanics are exercised by explicitly scoped legacy
test fixtures; public launch and new progression scenarios exercise shared mode.
No release, push, merge or deployment is authorized or performed.

Stat/upgrade implementation commit: `f68c649`; integration commit: `18ae201`.

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

### Final integrated verification — 2026-11-08

Implementation is committed on `feat/uninterrupted-progression-batch`:
`f68c649` (045 stats/upgrades), `c68bf80` (owner-approved loopback tooling),
and `18ae201` (046–049 integration, regressions and implementation records).
The final `npm.cmd run check` exited 0: syntax, ESLint, all registered Node
checks, and **220 browser tests passed; two opt-in measurement cases skipped**.
Environment: Windows, Node v26.13.0, Playwright Chromium 156.0.8078.4 and
Firefox 157.0; two workers, zero retries. The run used
`NEON_TEST_ENABLED_PORT=44321`, `NEON_TEST_SAMPLE_PORT=44322` and
`NEON_TEST_WORKERS=2`. The skipped measurements were exercised separately in
Chromium; see 049 for observations and their limits. `git diff --check` passed.

This clean run supersedes earlier intermediate failed/hung attempts recorded
above. Test-only Firefox loopback ICE preferences make disposable local peers
independent of LAN multicast discovery; production networking is unchanged.
Physical controllers, separate-machine/WAN play, separately installed Chrome,
owner feel/balance/readability and real-player performance remain unverified.
No owner's browser storage was cleared. No push, PR, merge or deployment was
performed. See [049](049-progression-integration-validation.md) for the combined
handoff and remaining validation.

Public cutover is active and implementation/review are complete. Review corrected
roster/rejoin hull restoration, stale lifecycle resource rewinds, source-ID reuse,
legacy packet mutation, atomic checkpoint preflight/profile side effects,
authoritative guest dash, and paused Repulsor bullet suppression. Existing
procedural weapon glyphs, glow and cooldown bars remain in the HUD. Approved
numeric rules and default effects/quality were preserved.

Optional Chromium measurements passed separately: two solo/hull cases and one
four-player case. These establish that the fixtures ran, not performance
acceptance. The four-context stress observations below are slow and remain an
explicit limitation. No further implementation task or material design decision
is concealed by the pending owner/environment validation.

Suggested PR title: **Integrate uninterrupted shared progression**.
Suggested description: Activate automatic shared rewards, bounded upgrades,
remappable equipment controls and versioned save/network recovery; preserve
existing effects and record Chromium/Firefox regression and performance evidence.
Owner gameplay and real-player performance acceptance remain pending.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/66
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/65
Local source: `docs/work-to-be-done/049-progression-integration-validation.md`.
Delivered locally on `feat/uninterrupted-progression-batch` under the owner's combined-batch authorization. GitHub issue closure and PR delivery remain owner-managed; the local tracker records current validation.

### Owner-authorized GitHub delivery — 2026-11-08

The owner requested verification of whether GitHub issues #57–#66 were committed,
pushed and merged, and explicitly authorized pushing and merging the remaining
work. This supersedes the earlier delivery-authorization restriction above.
Inspection found #58–#60 already merged through PRs #68–#71, with parent planning
merged through PR #67. The remaining implementation is six local commits,
`88fb7bf` through `badbdc5`, on `feat/uninterrupted-progression-batch`; neither that
branch nor `feat/044-defensive-quick-use` existed on origin when checked.

Deliver the combined branch as one pull request because it already contains the
defensive-slot commit and all subsequent integration work. Do not merge the
older defensive branch separately. Local main matches fetched origin/main at
`21713d7`, which is an ancestor of this branch; no rebase is currently needed.
The preceding production-readiness review ran the full suite against `badbdc5`:
syntax, lint, registered Node checks and 220 browser tests passed, with two
opt-in performance cases skipped. The pre-push hook must still run normally.

Delivery does not establish the outstanding owner/device/WAN/visual/performance
criteria or resolve the separately tracked review findings. Keep 040, 047 and
049 at Implemented — needs validation. Final PR, merge and verification evidence
will be recorded in the GitHub handoff and task report.
