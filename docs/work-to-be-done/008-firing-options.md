# 008 — Add toggle and held-button firing modes

Status: Planned

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

- [ ] Both firing modes are selectable and explained in the controls UI.
- [ ] In toggle mode, one press enables continuous fire and the next disables it.
- [ ] Holding the toggle button does not repeatedly switch the state.
- [ ] In held-button mode, firing occurs only while the fire input is held during active gameplay.
- [ ] Both modes respect weapon fire rates, cooldowns, and any resource limits.
- [ ] The active continuous-fire state is visible to the player.
- [ ] Supported keyboard/mouse and controller fire inputs behave consistently.
- [ ] Menus and paused gameplay do not fire weapons; resume, focus-loss, mode-switch, and new-run behavior follow documented state rules without stuck firing.

## Open questions

Which mode should be the default, and should the preference persist? Should pausing
or losing focus reset continuous fire to off? Which buttons should control firing?
