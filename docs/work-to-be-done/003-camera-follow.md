# 003 — Center the ship and improve camera tracking

Status: Planned

## Problem

The player wants the ship centered on screen and the camera to follow it better.

## Work requested

Make the player ship the camera's tracking target and keep it at the center of the
gameplay viewport during normal movement. Define edge behavior for bounded maps
and ensure camera movement does not change aiming or collision coordinates.

## Associated information

The gameplay viewport excludes any dedicated side panels. Screen/world coordinate
conversion must remain correct after camera movement and browser resizing.
Coordinate map-boundary behavior with 007. Any intentional camera shake should
return to the correct tracking position.

## Acceptance criteria

- [ ] During normal travel in every direction, the ship remains centered in the gameplay viewport.
- [ ] Tracking remains stable during turns, acceleration, and changes in movement direction.
- [ ] Camera placement is correct when a run starts and after viewport resizing.
- [ ] Aiming, projectile direction, collisions, and visible item locations stay aligned with the world.
- [ ] Map-edge behavior is explicitly documented and verified on every edge and corner.

## Open questions

Should centering be exact or allow slight smoothing? At map edges, should the camera
remain centered and show space outside the map, or clamp and let the ship move off-center?
