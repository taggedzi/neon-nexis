# 044 — Implement the separate defensive quick-use slot

Status: Done

## Problem or player need

Players need defensive actions without interrupting offensive weapon selection.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 043 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement one separate reusable defensive slot, outside the three offensive slots, with Repulsor Pulse and Aegis Projector.
- Expose a deliberate activation API independent of offensive selection and toggled auto-fire. Preserve selected offensive weapon and its cooldown.
- Apply approved projectile-clear exclusions, boss displacement limits, barrier radius/capacity/duration/reapplication and damage absorption order.
- Use 041's spawn/replacement/upgrade policies and bounded cooldown/barrier stacking; include authoritative multiplayer effect events.
- 047 owns bindings and readiness HUD; this task owns simulation APIs, content and visual effects. 045 owns common level/stat calculation.

Discovery starting points (verify against actual code): Verified simulation, content, co-op effect transport and rendering boundaries.

## Alternatives and tradeoffs

An extra slot raises survivability for every build. Test defensive chaining and prevent permanent team immunity.

## Acceptance criteria

- [x] Activation while any offensive slot is selected leaves selection intact and follows approved simultaneous-fire rules. The isolated API fixture covers all three slots and switching delay; 047 still owns press-edge input.
- [x] Repulsor clears only eligible hostile projectiles, never allies or excluded attacks. Tests cover boss and unknown sources, allies, mines, range, walls and all anchor bullet patterns.
- [x] Barrier absorption, expiration, allied recipients and repeat casts are deterministic; four-player casts cannot create unbounded capacity. The isolated fixture covers resource order, range/occlusion, three step sizes and four casters; live co-op delivery remains with 048/049.
- [x] Cooldown and effect state handle pause, downed state, reconnect and rejected activation through agreed interfaces. The fixture exercises pause, retained offline timers, barrier restoration and rejection without mutation; 048 still owns live recovery and transport.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Started 2026-11-07 on `feat/044-defensive-quick-use` from `21713d7`, after
prerequisite 043 merged and was closed. `js/progression-content.js` defines the
approved defense values; `js/progression-equipment.js` validates and advances
the separate defense cooldown and exposes activation. `js/progression-defense.js`
contains repulse, recipient barrier logic, resource-revision and recovery
interfaces, and bounded guest visual projections; `js/sim.js` consumes barriers
on local shared-mode hits and advances connected participants' barrier timers
on the world clock. `js/render.js` draws barrier and guest effect projections.
`js/enemies.js` marks enemy-fired bullets with boss-origin eligibility;
`js/game.js` initializes resource revisions and clears the authority adapter on a new run;
`js/player-stats.js` counts hits absorbed by a barrier.
`js/coop.js` and `js/coop-session.js` guard shared-mode host state against legacy
guest resource/loadout snapshots and route host remote hits through an authority
adapter. `index.html` loads the module and `tools/check-equipment.js` exercises
the new interfaces. The [integration contract](../progression-contracts.md#044-defensive-integration-surface)
records the 2026-11-07 agent implementation choices and later owners.

The issue's simulation interfaces are implemented behind the inactive progression
boundary. All issue 044 acceptance criteria have supporting automated or visual
evidence below. Owner branch review remains pending. The full resource authority lifecycle,
retaining and ticking offline records, and validated wire delivery/reconnect
belong to 046/048; public
activation and integrated playtesting belong to 049. Commit: none.

Implementation decision, 2026-11-07: return host effect outcomes and complete
resource revisions through explicit adapters, and keep visual projections free
of simulation authority. This agent implementation choice follows 041's approved
rules; it lets later network work preserve the host's decisions without relying
on the legacy guest-hit path. It requires 048 to implement delivery, validation,
and retained offline records before activation. It supersedes no gameplay rule.

Checks so far, 2026-11-07: syntax, lint and `git diff --check` passed. The
focused equipment browser fixture passed 222 assertions in Windows Playwright
Chromium 156.0.8078.4 and Firefox 157.0, including initial barrier window,
cooldown, all three selected slots, four-caster lockout, resource snapshots,
recovery, host resource guards, wall/world boundaries and repulsor eligibility checks.
The first sandboxed run passed Chromium
but reported a Firefox failure and hung during shutdown; it was interrupted.
The completed run used alternate loopback ports outside the sandbox. These
checks do not establish the unimplemented co-op or lifecycle behavior.

A full `npm run check` was run outside the sandbox with alternate loopback ports
and two workers. Syntax, lint and unit checks passed; 196 of 200 browser tests
passed. Chromium's guest-pickup and guest-death cases timed out during co-op
setup; both passed on a separate single-worker retry. Firefox's three-player
case timed out returning to play and its four-player case timed out joining a
peer. The code changed while the full run was in progress, so it is not a clean
final-tree result. Both Firefox cases passed a subsequent single-worker retry.
Do not treat individual retries as a full-suite pass.
A clean single-worker run was started, then interrupted during unit checks when
review found a world-boundary push case that needed a code fix. No full-suite
result is claimed for that interrupted run.
A subsequent clean run reached Chromium browser tests without failures, but was
interrupted to fix a remote resource-identity validation gap found in review.
A later clean run stopped in the PHP co-op gate on a non-JSON response. The
same gate passed alone immediately afterward (899 assertions in Chromium
156.0.8078.4); the stopped run does not constitute a full-suite pass.
The next run passed the unit stage but was interrupted during browser checks
to fix a malformed-context activation rejection gap.

The final-code single-worker `npm run check` passed syntax, lint, all unit
checks, and 199 of 200 browser tests. Firefox's settings disclosure/controller
layout case timed out at its click after 60 seconds; that case passed alone on
retry in 3.5 seconds. The full command still failed and is not recorded as a
pass. Browser versions were Chromium 156.0.8078.4 and Firefox 157.0 on Windows.

A subsequent single-worker `npm run check` passed syntax, lint, all unit checks,
and all 200 browser tests on the same code in Chromium 156.0.8078.4 and Firefox
157.0 on Windows. The earlier timeout and retry remain recorded above.
Status set to Done after this clean full-suite pass; integrated playtesting and
owner acceptance gates belong to issue 049.

Agent visual check: matched 1920×1080, DPR 1, high-quality Playwright Chromium
156.0.8078.4 captures used the same paused arena with 15 enemies, one Aegis
activation ring and one barrier. The ring and barrier remained distinct from
the nearby visible anchors. The fixture projected the barrier onto a legacy
ship because the shared-mode HUD still expects legacy weapons; 047 owns that
HUD. This is not owner review or a multiplayer/performance measurement.

### Review follow-up — remote hit immunity

The owner requested the review fix on 2026-11-07. `js/coop.js` now advances
shared-mode remote hit invulnerability on the host during active play for living,
connected participants. Guest resource snapshots remain unable to overwrite it.
This is an agent implementation choice restoring the existing 0.68-second hit
immunity; other resource lifecycle work remains with 046/048. It supersedes no
gameplay decision. `tools/check-equipment.js` covers immediate rejection, later
accepted damage, pause, disconnect, downing, elapsed-time advancement and legacy
timer ownership. Syntax and lint passed. The focused equipment fixture passed
229 assertions in each of Windows Playwright Chromium 156.0.8078.4 and Firefox
157.0 outside the sandbox. The initial sandboxed attempt passed Chromium, then
Firefox crashed at `browserContext.newPage` before assertions; that run was
interrupted during shutdown. The full 200-test suite recorded above predates
this fix and was not rerun for the focused follow-up. `git diff --check` passed.
Status restored to Done after the focused checks; owner branch review remains
pending. Commit: none.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/61
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/60
Local source: `docs/work-to-be-done/044-defensive-quick-use.md`.
Planning and prerequisites were merged before implementation; 043 is on main
through PR #70. GitHub issue text is an older planning snapshot.

