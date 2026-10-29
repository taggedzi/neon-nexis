# 007 — Generate varied map sizes and shapes

Status: Planned

## Problem

The player wants more varied environments while keeping procedural generation.
Desired possibilities include boss rooms and obstacles usable as cover.

## Work requested

Extend map generation to vary playable size and shape between runs. Support
connected rooms or regions, meaningful cover, and designated boss encounter spaces.
Agree the initial set of map features before implementing this larger change.

## Associated information

Generate valid player, enemy, loot, and boss positions within reachable playable
space. Define what cover blocks: movement, projectiles, line of sight, or a stated
combination. Boss areas need sufficient room for the intended encounter. Use
recorded generation seeds or equivalent reproducible map data for debugging.
Coordinate with 001 (performance), 003 (camera boundaries), and 005 (spawning).

## Acceptance criteria

- [ ] Repeated runs produce multiple visibly different playable sizes and shapes within agreed bounds.
- [ ] Procedural generation remains part of normal run creation.
- [ ] Automated generation validation across a documented seed set finds no unreachable required areas or invalid spawn positions.
- [ ] Obstacles provide cover according to documented collision and projectile rules.
- [ ] The generator can create a reachable boss room with a valid boss spawn and usable encounter space.
- [ ] Boss-room entry, completion, and exit behavior match the agreed encounter design.
- [ ] Maps can be reproduced from recorded seeds or equivalent debug data.
- [ ] Large generated maps and combat near obstacles meet the performance target defined in 001.

## Open questions

What map sizes, shape families, and obstacle styles should the first version include?
Should boss rooms appear every run or only sometimes? Are rooms gated during combat?
Should enemies navigate around cover, and can any weapons penetrate it?
