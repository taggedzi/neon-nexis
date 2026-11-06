# 047 — Integrate weapon selection, defensive quick-use and nonblocking reward UI

Status: Planned

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

