# 023 — Add skill levels

Status: Done

Implementation follows the owner-approved decisions in the implementation and
validation section. The original planning questions below are retained for context.

Priority 7 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

Single-player and co-op should offer easy, medium, hard, and hardcore. Skill
changes how many enemies appear, how strong they are, how fast they spawn, and
how fast they move. Hardcore is one life, and death loses everything.

## What exists today

There is no difficulty field. Enemy bodies come from `N.ROLES` in `js/content.js`:
hit points, speed, size, contact damage, attacks, and spawn weight. Styles are
`N.ENEMY_STYLES`. Spawn frequency was already reduced under
[issue 005](005-enemy-spawning.md). Further spawn changes need a new approval
so they do not silently undo that pass.

Single-player death calls `G.gameOver`. The game-over screen can restore the
last local checkpoint when one exists. Co-op death goes through
`N.Coop.onLocalDeath` and the revival rules in
[issue 014](014-coop-lobby-and-revival.md). Co-op does not use the local
checkpoint. The host owns the world, seed, enemies, and sector flow.

Medium is not defined in code. Current numbers are simply the game as it is.

## Determine

- Which spawn, health, damage, and speed numbers a sector uses today, at
  sector 1 and at a later sector. Record them so medium can mean "what players
  have now".
- What "lose everything" includes: the checkpoint only, or also settings,
  a future loadout list, and stats.
- Whether hardcore disables the game-over restore button, deletes the
  checkpoint, or both.
- How a co-op guest learns the host's choice, and what happens if the guest's
  client is older and has no skill field.

## Decide

- Numeric multipliers for easy, medium, and hard, for count, strength, spawn
  rate, and speed. Strength needs a split: hit points, contact damage, and
  shot damage, if those should not move together.
- Whether medium is exactly today's numbers.
- Whether the choice is stored in settings and shown before Engage.
- In co-op, the host chooses. Decide the allowed set and whether the guest can
  refuse.
- Hardcore versus co-op revives. One life for the player can mean the shared
  revive budget is zero, or that hardcore is single-player only.
- Hardcore versus [issue 024](024-named-ship-loadouts.md). Loading a powerful
  ship into a one-life run may remove the point of hardcore.

Proposal, not approved:

- Medium uses today's numbers with no change.
- Easy and hard are modest multipliers the owner tunes after a playtest, not
  values invented as final balance.
- The host's choice is part of the match start and is visible to the guest
  before ready.
- Hardcore is single-player at first: no checkpoint restore, and the checkpoint
  for that run is removed on death. Co-op keeps the current revive rules until
  a separate approval.
- Skill does not change hull stats. That is
  [issue 029](029-ship-stats-and-colors.md).

Balance feels are not done until the owner plays them.

## Do

After the decisions:

- Store the choice on the run and, if approved, in settings.
- Apply multipliers in the existing spawn and role-stat path. Do not copy a
  second enemy table.
- Send the host's choice through the existing match-start message. A guest that
  does not understand it must fail closed in a way the protocol already uses
  for a version mismatch, or the message must tolerate an older guest if that
  was the decision.
- Wire hardcore to the real game-over and save paths. Do not only hide the
  restore button.
- Add checks for each multiplier and for hardcore delete-on-death. Leave feel
  and fairness unchecked until the owner says so.
- Keep [issue 005](005-enemy-spawning.md) intact at medium.

## Acceptance criteria

- [x] Before a single-player run, the player can choose easy, medium, hard, or
      hardcore, and the choice is visible.
- [x] Medium matches the pre-change spawn counts, strength, and speeds at the
      recorded sectors.
- [x] Easy and hard change quantity, strength, spawn rate, and speed by the
      approved amounts.
- [x] Hardcore ends the run on death and removes the progress the owner named.
- [x] A co-op match uses the host's approved skill rule, and both players can
      see it.
- [x] Saves from before this feature still load.
- [x] Owner playtest of feel is recorded separately from the automated checks.

## Open questions

- Do enemy shot speeds change with "speed", or only movement speed?
- Does hardcore also remove a named loadout, once those exist?
- Should the last skill persist, or return to medium every new run?

## Dependencies

Can ship before four-player co-op ([issue 028](028-coop-four-players.md)).
The host-choice display should be shaped so a later player cap can sit beside
it, without blocking this issue on the protocol expansion.
[Issue 024](024-named-ship-loadouts.md) must respect the hardcore rule chosen
here.

## Implementation and validation

### Decisions — 2026-11-02

Approval source: owner answers in this chat on 2026-11-02. These replace the
unapproved proposals above where they differ.

- Medium preserves existing combat exactly. Remember the last selected skill
  in settings; store the actual skill on the run. Old checkpoints use Medium.
- Easy: quantity ×0.75, HP/shields and enemy damage ×0.8, routine spawn
  frequency ×0.8, movement ×0.9.
- Hard and Hardcore: quantity ×1.25, HP/shields and enemy damage ×1.25,
  routine spawn frequency ×1.2, movement ×1.1.
- Enemy projectile speeds stay unchanged. These are initial playtest values,
  not a claim that the owner has accepted balance feel.
- Hardcore applies in single-player and co-op. Fresh pilots only. Death offers
  no checkpoint restoration and deletes the single-player run checkpoint.
  Settings, named loadouts, lifetime stats and logbook are preserved. Co-op
  never deletes a separate single-player checkpoint.
- Hardcore has zero revives, including sector-transition revives. Dead players
  remain spectators for that match; the match ends when everyone is dead.
- Host chooses the co-op skill; both players see it before ready. A guest may
  decline by staying unready or leaving. Changing skill invalidates readiness.
- Implementation choices: round scaled enemy quantities to whole enemies;
  preserve graphics population ceilings and mandatory boss/warden encounters.
  Scale initial population, routine groups and surges; summon behavior and
  scripted encounter times remain unchanged. Scale enemy mines/explosions and
  anchor projectiles as enemy damage. Hull stats remain unchanged.
- Wire version advances to 2 to reject clients without the Hardcore life rule.
  Missing/unknown skill in lobby/recovery messages is rejected; both clients
  must update. Save version remains 1 with an optional validated skill field.

Rationale: preserve the current default while providing adjustable challenge
and enforce one life through actual save and co-op lifecycle paths.
Consequences: issue 024 must refuse saved builds in Hardcore; issues 025/026
must retain their profile records after a Hardcore death.

### Medium baseline before implementation

Verified against the original `js/content.js` and `js/enemies.js`. At high
quality and sector entry (elapsed 0), excluding elites/minions and using a
fixed random sample of 0.5:

| Measurement | Sector 1 | Sector 10 |
| --- | --- | --- |
| Initial regular enemies | 5 | 14 |
| Population cap | 15 | 120 |
| Routine group | 2 | 5 |
| Routine interval, seconds | 5 | 1.4125 |
| Rusher HP | 17 | 44.54 |
| Rusher movement, world units/second | 136 | 158.032 |
| Rusher contact damage | 11 | 22.88 |

For every role, existing HP/shield growth is `1 + (sector-1)*.18 +
elapsed/420*.28`; contact growth is `1 + (sector-1)*.12 + elapsed/420*.2`;
movement growth is `1 + (sector-1)*.018 + elapsed/420*.12`, with the original
random factor and speed cap. Medium multiplies all these by exactly 1.
Issue 005 tuning constants are unchanged.

### Changed files and checks

- `js/content.js`, `js/util.js`: shared skill definitions and settings default.
- `js/game.js`, `js/enemies.js`, `js/sim.js`: run/save validation, existing spawn
  and damage paths, and checkpoint deletion/restore prevention.
- `js/coop-host.js`, `js/coop.js`, `js/coop-session.js`, `js/coop-wire.js`,
  `js/net.js`: host lobby choice, sync, protocol compatibility and permanent
  Hardcore death across sectors.
- `index.html`, `js/ui.js`: existing neon choice buttons and keyboard/controller
  focus path, rule descriptions, host/guest selection and restore messaging.
- `tools/check-coop-lobby.cjs`, `tools/check-coop-wire.cjs`,
  `tools/ci/skill-levels.spec.cjs`, `tools/ci/coop-smoke.spec.cjs`: baseline,
  multipliers, real wave spawning, persistence, save compatibility, permanent
  co-op death, wipe and readiness coverage.
- Task branch: `codex/023-skill-levels`. Implementation commit: `4d19a4c`.
- Syntax/lint and the unit suite passed. Four new focused browser checks passed
  on Windows, Chromium 156.0.8078.4 and Firefox 157.0. Ten focused checks then
  passed, including compact keyboard access, shield scaling, preservation of a
  different checkpoint after a failed save, and visible wire-version rejection.
- The first full run passed 114 browser checks and failed two spawning fixtures
  because a wave-size argument was no longer passed to the existing observer.
  The interface is restored; the focused spawning checks and an actual wave-size
  assertion pass. The final `npm run check` passed syntax, lint, all unit
  checks, and 122 browser tests (5.1 minutes for the browser phase), including
  separate host-death and guest-death Hardcore cases on both browsers.
- Agent inspected the 1280×720 selection screenshot: skill buttons and launch
  controls are visible and match existing styling. No gameplay visual effects
  or quality defaults were removed.
- Compact 640×600 keyboard selection and launch checks passed in both browsers;
  agent inspected the Firefox screenshot. `git diff --check` passed.
- Owner validation, separate from agent checks: on 2026-11-02 the owner answered
  “Accept the initial balance” to the Easy/Hard/Hardcore playtest question for
  the completed local build. This accepts the initial values; no additional
  measured performance or physical-controller testing is claimed.
- All issue acceptance criteria have supporting evidence. Status: Done.
  Google Chrome and physical controller were not checked. No performance claim
  is made. The owner delegated merge delivery in this chat.

### Delivery follow-up

- The first pre-push run passed 121 browser tests and failed the new Firefox
  compact keyboard test once: it focused the skill button before the menu's
  delayed initial-focus callback finished. The fixture now waits for the first
  menu control to receive focus before moving focus and pressing Enter. No
  assertion was removed and no production behavior changed.
- The corrected compact keyboard test passed five repetitions in Chromium and
  five in Firefox (10 total). The required pre-push hook enforces the full
  suite again before delivery. Owner balance acceptance is recorded above.
