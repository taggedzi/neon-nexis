# 043 — Add missiles, lightning, bombs and area-denial weapons

Status: Implemented — needs validation

## Problem or player need

Random additional weapons should offer distinct tactical choices, including area damage.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 042 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement Seeker Missiles, Arc Projector, Gravity Bomb and Plasma Mortar from 040 using finalized 041 rules.
- Use existing world-space aiming/input data and bounded projectile travel; controller aiming must not depend on mouse-only target coordinates.
- Enforce distinct chain targets, per-owner field stacking rules, boss slow limits and no allied damage/knockback.
- Provide procedural/local visual and sound effects while preserving threat readability and graphic quality. Bound effect lifetimes/entity counts.
- Expose weapon definitions and effects through 042's dispatch; do not add reward rolls, alternate input handlers or persistence formats.

Discovery starting points (verify against actual code): Verified content, simulation, collision, rendering and procedural audio/effects.

## Alternatives and tradeoffs

Area effects increase multiplayer damage and visual load; keep performance evidence separate from balance changes.

## Acceptance criteria

- [x] Seeded scenes verify missile targeting, chain ordering/no repeated hits, radius boundaries, field duration and overlap, and boss resistance.
- [ ] Damage/slow/expiry remain consistent across frame intervals and pause/resume.
- [x] Host/guest representation and kill/stat attribution have focused coverage using agreed interfaces.
- [x] Record equivalent-scene visual review and representative effect counts; do not equate headless FPS with real-player performance.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Started 2026-11-07 on `codex/043-offensive-area-weapons`, based on
`5f25ad58ec8506de0bbf516c85f6e4803e655377`. Prerequisite 042 was merged in
PR #69. Before this change, its equipment dispatch rejected additional weapons.

- `js/progression-content.js` records approved D6/D7 starting values.
  `js/progression-equipment.js` dispatches all four additional weapons through
  the existing cooldown and aim path. `index.html` loads the new
  `js/progression-offense.js` module.
- `js/sim.js` reuses swept collision for seekers and advances area effects on
  the combat clock. `js/enemies.js` applies the bomb's slow to movement without
  slowing attack timers. `js/render.js` draws plasma field outlines.
- Implementation choices (2026-11-07): use existing projectile, bolt, ring
  and audio styles. Store fields by sector and slow timers by enemy so their
  lifetime follows the world. Split overlapping field time at starts and
  expirations to preserve strongest-per-owner DPS and partial steps. Plasma
  uses the field outline, impact effects and normal kill effects rather than
  playing a hit sound and spawning floating text for every DPS sample.
- The host exposes a snapshot of projectile, field and flash geometry. The
  guest renderer consumes it separately from simulation. Issue 048 owns the
  validated wire codec and delivery. No public run uses this path yet.
- Automated: syntax, lint and whitespace checks passed. The isolated equipment
  fixture in `tools/check-equipment.js` passed 157 assertions each in Windows
  Chromium 156.0.8078.4 and Firefox 157.0 using Playwright request interception.
  Firefox required launching outside the sandbox. The sandboxed unit suite
  stopped at the PHP loopback startup gate. Coverage includes
  guest projection and rejection of guest-authority fire, remote kill credit,
  wall occlusion, pause, seeker reacquisition and plasma crossing time.
- Movement timing: interpolate the enemy's step segment to measure time inside
  the field, then sample line of sight at the midpoint of that interval.
  Crossing an occlusion boundary within a single step remains approximate.
- Agent visual comparison: inspected paired 1920×1080 high-quality Chromium
  captures of the same arena, camera and 24 enemies. The effect frame had two
  distinct seeker trails, one plasma field and three transient effects
  including the arc and two impacts. Enemy silhouettes remained visible in
  this scene. This is visual evidence only. Owner playtesting remains pending.
- Standard suite outside the sandbox: syntax, lint and all unit checks passed,
  including PHP co-op checks. The full browser stage timed out before running
  tests because the Playwright readiness probe could not connect to
  `127.0.0.1:4173`. A direct Node probe reproduced the connection timeout.
- Remaining: independent review, full browser regression on an environment
  that can reach the test server, and owner playtesting. Cross-step field
  timing has focused evidence. The broader timing acceptance remains open
  for moving or occluded targets and integrated play. Commit: none.

### Independent review fixes — 2026-11-07

- Gravity Bomb detonations are resolved in step-time order. Range and line of
  sight use interpolated target positions at impact. The newly slowed portion
  of movement is reduced immediately, with the remaining duration carried
  forward. This uses the realized movement segment as an approximation of
  the enemy's path through the step.
- Plasma resolves the interval boundaries across all owners in time order.
  During a simultaneous lethal interval, contributors accrue damage up to
  the kill time. The highest DPS receives the final hit, with participant ID
  breaking ties. This is an implementation choice for simultaneous damage.
- The focused fixture passed 161 assertions each in Chromium 156.0.8078.4
  and Firefox 157.0. New cases cover entering and leaving the blast radius
  after detonation, immediate slow movement, and lethal fields inserted in
  either order. Syntax, lint and whitespace checks passed after these fixes.
  The full suite result above predates these fixes.

### Settings readability for owner validation — 2026-11-07

- Owner requested this fix on issue #60 because the existing settings screen
  shrank its text to fit the full binding list, blocking controller validation.
- `js/ui.js` excludes settings from automatic shrink-to-fit. `css/style.css`
  gives tabs, labels and bindings readable text sizes and makes the options
  scroll independently. In very short windows, the whole panel scrolls.
  `index.html` makes the options region keyboard focusable for scrolling.
- Browser layout check passed in headless Chromium 156.0.8078.4 and Firefox
  157.0 at 1280×720, 480×400 and 320×280. Focusing the last controller binding
  scrolled it into view at 14 CSS pixels with no horizontal screen overflow.
  Controls and Audio tabs and Apply & Back were reachable. Syntax, lint and
  whitespace checks passed. The owner confirmed the readability problem was
  addressed on 2026-11-07. Physical controller validation remains pending.

The owner approved merging issue #60 on 2026-11-07. Public activation and
regular-play validation remain with issue 049.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/60
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/59
Local source: `docs/work-to-be-done/043-offensive-area-weapons.md`.
Planning and prerequisites merged in PRs #67, #68 and #69.

