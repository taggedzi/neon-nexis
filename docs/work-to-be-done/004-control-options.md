# 004 — Add ship-relative driving controls

Status: Planned

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

- [ ] The player can select either existing directional movement or ship-relative driving.
- [ ] Existing directional mode retains its current movement behavior.
- [ ] In driving mode, W moves along the ship's forward direction at any heading.
- [ ] Steering and S behavior match the agreed mapping and are explained in the controls UI.
- [ ] Controller input supports both movement modes with documented mappings and no neutral-stick drift.
- [ ] Movement and aiming behave as documented when used simultaneously.
- [ ] Pausing, changing input device, or disconnecting a controller does not leave movement stuck on.

## Open questions

Should S brake, reverse immediately, or brake before reversing? Should A/D rotate
the ship while stationary? Which controller layout and aiming behavior are preferred?
Should the selected mode persist between sessions?
