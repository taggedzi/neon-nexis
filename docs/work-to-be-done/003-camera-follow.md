# 003 — Center the ship and improve camera tracking

Status: Implemented — needs validation

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

- [x] During normal travel in every direction, the ship remains centered in the gameplay viewport.
- [ ] Tracking remains stable during turns, acceleration, and changes in movement direction.
- [x] Camera placement is correct when a run starts and after viewport resizing.
- [ ] Aiming, projectile direction, collisions, and visible item locations stay aligned with the world.
- [x] Map-edge behavior is explicitly documented and verified on every edge and corner.

## Open questions

Owner decisions (2026-10-29): allow slight smoothing. Keep tracking the ship at
every map edge and corner, showing space outside the map instead of clamping.
"Centered" below therefore permits the brief movement lag from smoothing; a
stationary ship settles at the exact center.

## Implementation and validation

- `js/camera.js`: shared forward/inverse screen/world transforms and exponential
  tracking at rate 16/second (about 63 ms time constant). The camera follows the
  player with no aim offset or map clamp. Stationary tracking converges to the
  viewport center; active travel has brief smoothing lag.
- `js/sim.js`: update camera after movement and refresh aim before weapon fire.
  `js/render.js`: consume the shared transform for reticles and the shake offsets
  sampled during camera update, so input and drawing agree. Shake amplitude and
  decay remain intact; pause holds the last sampled offset until updates resume.
- `js/game.js`: reset/snap camera at start, restore and resize; sector transitions
  also clear old shake offsets. `index.html`: load camera after game, before sim.
- Automated browser: all 33 assertions in `tools/check-camera.js` passed at
  `/?test=camera` in an isolated context. Covers all four edges and four corners,
  five movement vectors and reversals, smoothing at 30/60/144 steps per second,
  world/screen round trips including shake, mouse aim, start, restore and resize.
  Maximum tested travel lag stayed below 30 world units. No captured game errors.
- Agent visually inspected a 1920×1080 corner scene: ship at (960,540), map edge
  visible through the center with outside space exposed, neon presentation intact.
- Syntax checks and `git diff --check` passed.
- Implementation commit: pending.
- Pending player review: smoothing and edge presentation feel right.
