# 004 — Add ship-relative driving controls

Status: Implemented — needs validation

## Problem

Current directional controls move the ship in screen/world directions (for example,
S moves down). The player also wants an RC-car-style option where W moves forward
relative to the ship's facing direction.

## Work requested

Keep the existing directional movement as a selectable mode. Add a ship-relative
driving mode for keyboard and controller, with explicit control descriptions.
The proposed keyboard mapping is W for forward thrust, A/D for steering, and S
for braking/reversing; the exact S behavior requires a decision.

## Associated information

Define how steering, acceleration, reversing, and weapon aiming interact. Do not
assume the ship must face the weapon's aim direction. Define a controller mapping
and analog dead zone (the small input range treated as neutral) to prevent drift.
Coordinate with camera tracking (003) and firing modes (008).

## Acceptance criteria

- [x] The player can select either existing directional movement or ship-relative driving.
- [x] Existing directional mode retains its current movement behavior.
- [x] In driving mode, W moves along the ship's forward direction at any heading.
- [x] Steering and S behavior match the agreed mapping and are explained in the controls UI.
- [ ] Controller input supports both movement modes with documented mappings and no neutral-stick drift.
- [x] Movement and aiming behave as documented when used simultaneously.
- [ ] Pausing, changing input device, or disconnecting a controller does not leave movement stuck on.

## Open questions

Owner decisions (2026-10-29): S brakes before reversing; A/D can rotate while
stationary. Weapon aim is independent of driving heading. Controller left stick
horizontal steers, vertical provides forward/brake/reverse; right stick aims;
existing mapped fire/dash buttons remain. Persist the selected mode between sessions.

## Implementation and validation

- `js/driving.js`: independent hull heading; steering 2.8 radians/second; forward
  braking while longitudinal speed exceeds 5 units/second, then reverse thrust.
  Forward/reverse use the existing movement speed. Exponential velocity response
  uses rate 12/second, or 18/second while braking. These handling constants need
  player review. `js/sim.js` applies this only in driving mode, including hull-relative
  dashes; `js/render.js` and trails use the hull heading while weapons retain aim.
- `js/util.js`, `js/ui.js`: validated persistent movement mode, controls selector,
  remapped labels and descriptions. Older settings default to directional mode;
  unknown mode values fall back to it. `js/game.js` saves/validates optional heading
  without changing the save version or deleting legacy saves. `index.html` loads
  the bounded driving helper before sim.
- `js/input.js`: shared remapped driving input; left-stick radial deadzone plus
  per-axis driving neutral thresholds using the existing adjustable deadzone
  (default 22%). Input releases on pause, overlays, blur/hidden and disconnect;
  a held stick must return to neutral after release. Repeated keyboard events do
  not rearm cleared inputs. Driving right-stick aiming does not imply firing;
  the mapped fire button remains. Directional right-stick firing is preserved.
- Existing directional mode remains the default and keeps its movement formula.
- Automated browser: `tools/check-driving.js` passed all 31 assertions in an
  isolated `/?test=driving` page. Includes four headings, unchanged directional
  acceleration/diagonal normalization, braking/reverse, stationary turning,
  remapping, independent simultaneous controller aim/movement, controller fire,
  persistence, checkpoint heading, pause/blur/repeat, neutral drift, disconnect
  and neutral rearming. Controller tests use a synthetic `navigator.getGamepads`.
- Agent UI checks: both movement buttons and persistence passed at 640×720 with
  no horizontal overflow. Camera regression: all 33 assertions passed; its fixture
  now explicitly requests default directional settings. No captured game errors.
  One initial test compared +π and −π directly; corrected it to compare angular
  equivalence, then reran successfully.
- Changed-JavaScript syntax and `git diff --check` passed.
- Implementation commit: pending.
- Physical controller/player handling review remains required.
