# 008 — Add toggle and held-button firing modes

Status: Implemented — needs validation

## Problem

The player wants both continuous fire that can be toggled on/off and a mode that
fires only while the fire button is pressed.

## Work requested

Provide a selectable firing mode: toggle continuous fire, or hold to fire. In toggle
mode, each deliberate press switches firing on or off. In held-button mode, firing
stops when the button is released. Keep aiming behavior and weapon cooldowns intact.

## Associated information

Use clear labels and a visible indication when continuous fire is active. Handle
keyboard repeat and controller inputs so one physical press causes one toggle.
Coordinate the input mapping with 004. Define what happens to the toggle state
when pausing, changing modes, losing window focus, or starting a new run.

## Acceptance criteria

- [x] Both firing modes are selectable and explained in the controls UI.
- [x] In toggle mode, one press enables continuous fire and the next disables it.
- [x] Holding the toggle button does not repeatedly switch the state.
- [x] In held-button mode, firing occurs only while the fire input is held during active gameplay.
- [x] Both modes respect weapon fire rates, cooldowns, and any resource limits.
- [x] The active continuous-fire state is visible to the player.
- [ ] Supported keyboard/mouse and controller fire inputs behave consistently.
- [x] Menus and paused gameplay do not fire weapons; resume, focus-loss, mode-switch, and new-run behavior follow documented state rules without stuck firing.

## Open questions

Owner decisions (2026-10-29): hold-to-fire is the default; persist the preference.
Reset toggle fire OFF on menus, pause, focus loss, mode changes and new runs.
Fire inputs: LMB, remappable keyboard Fire (default F), mapped controller Fire
(default RT). Keep right-stick firing as an optional directional-mode setting.

## Implementation and validation

- Earlier decision blocker is resolved. Implementation started after completing 002.
- `js/firing.js`: shared held/toggle state and release blocking after interruptions.
  `js/input.js`: mouse/key/controller edge/release integration; repeats and repeated
  aim reads never toggle. Menus, pause, blur/hidden, disconnect/reconnect, mode
  changes, restore and new runs reset continuous fire; held inputs require release
  before rearming. Fresh physical mouse/key presses can recover a release missed
  while the window was unfocused. Right-stick firing remains optional in directional
  mode, with neutral-to-aim counting as one press; driving aim stays independent.
- `js/util.js`: hold default and persistent validated mode, optional right-stick
  setting, remappable Fire key. Legacy settings retain existing bindings; if F is
  occupied, use G or V, otherwise leave Fire unbound until remapped. No storage reset.
- `js/ui.js`, `js/render.js`: selectors, descriptions, Fire binding and AUTO FIRE
  ON/OFF HUD label; help reflects mode/remapping. `js/game.js` handles lifecycle
  resets. `index.html` loads firing state before input. Weapon cooldown/resource
  code remains unchanged.
- Automated browser: all 38 assertions in `tools/check-firing.js` passed in an
  isolated `/?test=firing` page. Covers held and toggle input, repeat/movement/aim
  reads, actual weapon firing and cooldown, resets, remapping, legacy conflicts,
  persistence, synthetic controller edges/holds/pause/reconnect and optional stick
  firing. Actual mouse/keyboard and synthetic controller inputs were exercised;
  physical controller confirmation remains pending.
- Agent UI: mode buttons and persistence passed at 640×720; a real keyboard F
  press produced the rendered `AUTO FIRE: ON` label at 1920×1080. Adjacent browser
  regressions passed: driving 31, camera 33, discarded items 35. No captured errors.
- Changed-JavaScript syntax and `git diff --check` passed.
- Pending: physical controller check and owner firing/aiming review.
- Implementation commit: pending.
