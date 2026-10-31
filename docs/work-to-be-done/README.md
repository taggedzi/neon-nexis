# Work to be done

These Markdown documents are the authoritative local tracker. Numbers are local
tracking IDs; GitHub issues are optional.

Changes are delivered on task branches through owner-managed GitHub pull requests,
as specified in [AGENTS.md](../../AGENTS.md#git-and-delivery). These documents
preserve scope, decisions, and validation evidence. Project-wide decisions live
in [the decision log](../decisions.md).

| ID | Issue | Status |
| --- | --- | --- |
| 001 | [Improve overall performance, especially during large enemy waves](001-performance.md) | Implemented — needs validation |
| 002 | [Choose ship type and color before a run](002-ship-selection.md) | Implemented — needs validation |
| 003 | [Center the ship and improve camera tracking](003-camera-follow.md) | Implemented — needs validation |
| 004 | [Add ship-relative driving controls](004-control-options.md) | Implemented — needs validation |
| 005 | [Reduce enemy spawn frequency](005-enemy-spawning.md) | Implemented — needs validation |
| 006 | [Remove discarded items](006-discarded-items.md) | Implemented — needs validation |
| 007 | [Generate varied map sizes and shapes](007-procedural-maps.md) | Implemented — needs validation |
| 008 | [Add toggle and held-button firing modes](008-firing-options.md) | Implemented — needs validation |
| 009 | [Preserve auto-fire through item selection and interruptions](009-autofire-persistence.md) | Implemented — needs validation |
| 011 | [Controller parity and control reference](011-controller-parity.md) | Implemented — needs validation |
| 010 | [Pace equipment rewards and defer choices](010-reward-pacing.md) | Done |
| 012 | [Prepare GitHub community and release documentation](012-github-community.md) | Done |
| 013 | [Establish CI/CD and release policy](013-deployment-and-changelog.md) | Implemented — needs validation |
| 014 | [Persistent co-op lobby, revival, and rejoining](014-coop-lobby-and-revival.md) | Implemented — needs validation |

### 009 implementation and validation update

Auto-fire now preserves its session toggle through interruptions; mode changes
explicitly clear it. See [issue 009](009-autofire-persistence.md) for implementation
and evidence. The browser firing suite passed 53 assertions during issue 010 work,
following 40 earlier Node VM checks. Physical controller testing and owner review
specifically of firing persistence remain pending. Shared-folder access is fixed
and issue/index status is synchronized.

## Implementation sequence and validation

Delivered in order: 001, 006, 003, 004, 002, 008, 005, 007. Ship selection proceeded
while firing decisions were pending. Performance baselines preceded balance and
map changes; 007 includes a separate final-map performance smoke check.

All eight issues have focused implementation commits and follow-up hash records
in their documents. None is Done: owner visual/handling/pacing review, physical
controller checks, and performance/memory acceptance remain where documented.
The software-rendered automated browser does not meet the agreed 16.7 ms p95
display target; accelerated 20-minute simulations are supplemental checks rather
than full-duration rendering or retained-memory validation.

## Scope and decisions

Acceptance criteria describe intended behavior, not a prescribed implementation.
Unchecked boxes are future validation tasks. Open questions should be resolved
before implementing the affected behavior; proposed defaults are not approved
design decisions. Reported symptoms come from the player's experience and have
not yet been verified through profiling or a code review.

GitHub community documentation and MIT licensing are authorized under
[issue 012](012-github-community.md). Publishing, website deployment, and broader
code organization remain separate work. The gameplay issues do not choose a
hosting setup or prescribe a rewrite.

## 010 — Reward pacing and deferred choices

Status: Done. See [issue 010](010-reward-pacing.md) for
implementation decisions, acceptance evidence and the full validation record.

Paced equipment and player-opened rewards are implemented. Browser checks passed:
53 reward assertions, 39 discarded-item assertions and 53 firing assertions.
Shared-folder access is repaired, unused files are removed, and issue/index status
is synchronized. The owner confirmed validation passed on 2026-10-29. Physical
controller testing is not claimed; recorded controller checks use synthetic input.

## 011 — Controller parity and weapon visibility

Status: Implemented — needs validation. The owner approved the delivered changes
on 2026-10-29 (“I like the changes”). Physical-controller usability and remaining
menu-action validation are still pending; see [issue 011](011-controller-parity.md).

## Production readiness — GitHub #6 through #12

Status: Done. Code is on `fix/production-readiness`. The owner reported testing
complete on 2026-10-30. A later review added two fixes: invalid sector numbers
are rejected before a load changes the live run, and an unanswered guest grant
stays reserved until its acknowledgement. `node tools/check-saves.cjs` and
`node tools/check-grants.cjs` cover those cases. The owner has not repeated a
playtest of them. GitHub #13 is only a private-security contact request and is
not part of this fix. Two private findings were fixed on the same branch; their
notes stay local and are not in the commit history.

| GitHub | Commit | Automated evidence on 2026-10-30 |
| --- | --- | --- |
| [#6](https://github.com/taggedzi/neon-nexis/issues/6) | `275a261` | Signaling checks keep a live pair, including a paused pair, through an accelerated sweep. A local two-socket wait of 335 seconds also kept the room, both sockets, and pause. |
| [#7](https://github.com/taggedzi/neon-nexis/issues/7) | `3b7c435` | Chromium 156.0.8078.4 and Firefox 157.0 retried pause and ready after a dropped signaling socket. The pause menu stayed up. |
| [#8](https://github.com/taggedzi/neon-nexis/issues/8) | `ddd7b7e` | The same browsers stayed paused when resume was withheld, then resumed only after the server answered. |
| [#9](https://github.com/taggedzi/neon-nexis/issues/9) | `3992bfb` | The same browsers kept a guest pickup through a failed send and a full reward tray, then delivered it once. |
| [#10](https://github.com/taggedzi/neon-nexis/issues/10) | `456a477` | Node save checks and both browsers routed invalid version 1 checkpoints to recovery and continued a legacy version 1 checkpoint. |
| [#11](https://github.com/taggedzi/neon-nexis/issues/11) | `3821370` | Node settings checks and both browsers booted with malformed groups and kept stored settings bytes. |
| [#12](https://github.com/taggedzi/neon-nexis/issues/12) | `a9779b8` | `ws` 8.22.0 is locked. `npm audit` reported 0 vulnerabilities. Clean install is recorded with the final check. |

Environment: Windows, Node v24.14.1, Playwright Chromium 156.0.8078.4, Playwright Firefox 157.0. `npm ci --ignore-scripts` installed 82 packages. `npm audit` reported 0 vulnerabilities. `npm run check` then passed syntax, lint, unit checks, and 68 browser tests. An earlier run of the same command timed out once while Firefox was joining a room; that test passed on an immediate rerun and in the clean suite. Google Chrome was not run separately from Chromium.

GitHub Actions run 41094372550 on pull request #14 failed the same Firefox room join three times. The host already had a code, and `Net.peer` stayed false for 30 seconds. The smoke setup now opens the guest after that code exists, brings forward a page whose peer message has not been applied, and closes contexts left open by a failed setup. An inbound signaling message also marks the socket alive so a missed ping does not drop it on the next sweep. After that change, `node tools/check-coop-server.cjs` passed 69 assertions, and Playwright Firefox 157.0 passed `tools/ci/coop-smoke.spec.cjs` twice (10 tests each time). The full `npm run check` was not rerun for this follow-up. GitHub Actions run 41098022986 then passed on `e378d88`.
