# 047 — Integrate weapon selection, defensive quick-use and nonblocking reward UI

Status: Implemented — needs validation

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

- [ ] Keyboard/mouse and synthetic controller tests cover direct/cycle/quick-use, remapping, focus, pause, neutral/disconnect and repeat presses.
- [ ] Quick-use works without changing the active offensive weapon; defense is excluded from offensive cycling.
- [ ] Reward bursts coalesce and never steal focus, block firing or pause the match.
- [ ] HUD uses text/shapes alongside color; equivalent viewport captures preserve enemy readability and existing quality.
- [ ] Physical controller and owner accessibility/feel review are recorded honestly as passed or pending.
- [ ] Update this record and the backlog together with changed files, actual checks,
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

Planning only, 2026-11-06. No gameplay implementation or tests performed for this
issue. Changed file: this task specification. All acceptance remains pending.
Commit: none. Remaining work: dependencies, implementation, required checks and
owner review. Follow AGENTS.md for branch isolation, existing-source discovery,
proportional tests, save preservation and owner-managed delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/64
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/63
Local source: `docs/work-to-be-done/047-progression-controls-and-hud.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

