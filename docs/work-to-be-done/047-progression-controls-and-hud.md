# 047 — Integrate weapon selection, defensive quick-use and nonblocking reward UI

Status: Done (remaining validation transferred to 050 / GitHub #75)

Current disposition follows the owner-authorized scope transfer to
[050](050-live-multiplayer-validation.md), recorded below.

## Problem or player need

Players need clear controls and reward feedback without reopening choice menus.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 046 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Bind direct offensive slot selection and next/previous cycling through existing remapping/controller systems; add a distinct deliberate defensive quick-use action.
- Preserve held/toggled offensive fire. Defense uses one activation per deliberate press and never repeats merely because auto-fire or a held key is active.
- Handle focus loss, pause/resume, release, neutral/disconnect and conflicting bindings without stuck inputs or phantom activations.
- Display three offensive slots/selection plus a separate defensive readiness/cooldown indicator; show concise reward summaries and optional nonblocking history.
- Remove reward-tray, replacement and level-choice entry points for the new progression mode, including menu/help references; preserve legacy handling required by 048.
- Update ship descriptions/control help and explain immediate shared rewards. Follow landing-page-design skill for changed UI, preserving established visual style.

Discovery starting points (verify against actual code): Verified input, UI, shell markup, styles and HUD rendering; use agreed simulation APIs.

## Alternatives and tradeoffs

Extra actions can overwhelm players. Keep primary-only play effective, use familiar existing controls, and do not hard-code a duplicate input path.

## Acceptance criteria

- [x] Keyboard/mouse and synthetic controller tests cover direct/cycle/quick-use, remapping, focus, pause, neutral/disconnect and repeat presses.
- [x] Quick-use works without changing the active offensive weapon; defense is excluded from offensive cycling.
- [x] Reward bursts coalesce and never steal focus, block firing or pause the match.
- [ ] HUD uses text/shapes alongside color; equivalent viewport captures preserve enemy readability and existing quality.
- [x] Physical controller and owner accessibility/feel review are recorded honestly as passed or pending.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

### Combined implementation — 2026-11-08

Owner authorized a combined 045–049 handoff with delegated implementation,
review, commits and one final playtest. This supersedes the serial branch and
separate owner handoff prerequisites above for this task only.

Changed files: `js/progression-controls.js`, `js/input.js`, `js/util.js`,
`js/ui.js`, `js/render.js`, `js/ships.js`, `js/loadouts-ui.js`, `index.html`,
and `tools/ci/progression.spec.cjs`. Gameplay and transport hooks are recorded
in 046/048.

- Remappable direct slots default to 1/2/3 and controller D-pad left/up/right;
  existing Q/E, wheel and bumpers cycle installed offensive slots only.
- R/controller X deliberately activates the separate defense once per press.
  Per-button release arming prevents held input across focus, pause or reconnect
  from becoming a fresh action. Simultaneous deliberate selection and defense
  remain possible; held/toggled offensive fire is preserved.
- HUD projects canonical slot levels, selection, defensive readiness, barrier
  window/lockout and bounded four-simulation-second reward summaries. Inventory
  presents read-only equipment/passives and the most recent twelve rewards.
  Shared-mode reward tray and choice entry points are disabled; help describes
  immediate team rewards. Existing neon rendering and quality are preserved.
- Save recovery uses the affected checkpoint or saved-ship storage key, and
  labels the explicit export/remove choice accordingly.

Agent validation: all six focused Chromium scenarios passed assertions on
Chromium 156.0.8078.4, Windows. Runners hung during PHP-server teardown and
were interrupted after assertions; this is not a clean full-suite pass.
The initial Firefox attempt crashed before tests and provides no pass evidence.
Focused ESLint and whitespace checks passed. Combined suite and equivalent
viewport visual inspection remain pending at this intermediate record.

Physical-controller testing and owner accessibility/feel review remain pending.
No subjective acceptance is inferred from synthetic controller input.
Commit hashes and final combined evidence are recorded in 049 after integration.

Final control integration preserves guest dash invulnerability through a
host-validated deliberate intent, without moving guest movement prediction to
the host. Remaining dash charges/timers and input-sequence watermarks survive
rejoin. The existing dash key/button and tuning are unchanged. Shared-resource
fields and focused/live validation are recorded in 048/049.

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

The final browser suite covers keyboard/mouse, synthetic controller selection/cycling/defense, remapping, release/focus/pause/disconnect, reward summaries and guest dash authority. Quick-use preserves offensive selection and reward feedback does not take focus. Desktop and compact HUD captures were inspected as described in 049. Equivalent paired world-scene comparison, physical-controller usability and owner accessibility/feel remain pending; this issue stays Implemented — needs validation.

### Owner-deferred validation — 2026-11-09

The owner explicitly deferred all remaining validation for GitHub #57, #64 and
#66 until the game is live and other players are available. Implementation is
merged in [PR #74](https://github.com/taggedzi/neon-nexis/pull/74). Completed
automated checks, owner playtesting and solo performance evidence remain recorded
in [049](049-progression-integration-validation.md).

Status is Blocked because the remaining checks depend on access to live players
and the required devices/environments. The issues stay open for later follow-up.
Outstanding acceptance boxes remain unchecked. Resume when the owner has live
players available, inventory the pending cases in 049 and the progression
contract, and record each result before completing the relevant criteria.
This deferral covers multiplayer/WAN, four-player performance/readability,
disconnect/rejoin retention, physical-device/accessibility review and any other
still-unverified gameplay/browser/retention criteria. No completion date is set.

Approval source is the owner's explicit instruction on 2026-11-09. This decision
supersedes immediate follow-up requests for the remaining validation. See the
[decision log](../decisions.md#2026-11-09---defer-remaining-progression-validation).
Validation for this documentation update is `git diff --check`. Gameplay code
is unchanged, so application tests were not rerun.

### Validation transferred to follow-up — 2026-11-09

The owner explicitly requested closing GitHub #57, #64 and #66 and creating a
separate issue for validation when the game is live and other players are
available. Implementation is merged through PR #74. The remaining scope now
belongs to [050 — Live multiplayer validation](050-live-multiplayer-validation.md)
([GitHub #75](https://github.com/taggedzi/neon-nexis/issues/75)).

This tracker is Done for its delivered implementation and evidence handoff.
Unchecked historical acceptance boxes are transferred to 050 and do not claim
passing results. The follow-up preserves multiplayer/WAN, four-player effects,
disconnect/rejoin retention, physical-device/accessibility review and the other
still-unverified gameplay/browser/retention cases. This supersedes the earlier
instruction to keep the original issues open. Completed evidence is preserved.

Documentation-only update. `git diff --check` passed. Application tests were
not rerun because application code was unchanged. Validation notes remain on
`docs/066-firefox-performance-validation` pending commit/delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/64
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/63
Local source: `docs/work-to-be-done/047-progression-controls-and-hud.md`.
Delivered locally on `feat/uninterrupted-progression-batch` under the owner's combined-batch authorization. GitHub issue closure and PR delivery remain owner-managed; the local tracker records current validation.
