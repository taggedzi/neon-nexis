# 007 — Generate varied map sizes and shapes

Status: Implemented — needs validation

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

- [x] Repeated runs produce multiple visibly different playable sizes and shapes within agreed bounds.
- [x] Procedural generation remains part of normal run creation.
- [x] Automated generation validation across a documented seed set finds no unreachable required areas or invalid spawn positions.
- [x] Obstacles provide cover according to documented collision and projectile rules.
- [x] The generator can create a reachable boss room with a valid boss spawn and usable encounter space.
- [x] Boss-room entry, completion, and exit behavior match the agreed encounter design.
- [x] Maps can be reproduced from recorded seeds or equivalent debug data.
- [ ] Large generated maps and combat near obstacles meet the performance target defined in 001.

## Open questions

Owner decisions (2026-10-29): compact arenas, wide arenas and connected chambers
within 2400–4400 × 1800–3200 world units. Neon polygonal cover blocks movement and
projectiles; enemies navigate around it; no weapon penetration. Each sector has a
reachable boss space, without combat gates. Keep existing boss timing/rewards and
sector-completion rules.

## Implementation and validation

- Work started: bounded world generation/collision/navigation modules; deterministic
  layout version and seeds; valid placement; designated boss space; cover-aware
  movement/projectiles/area damage/targeting; existing decorative platforms preserved.
- Legacy saves keep their original rectangular generator. New saves record a map
  generator version so their layouts remain reproducible.
- `js/maps.js`: versioned seeded compact/wide/chamber families on a 100-unit
  geometric grid; 2–12 solid cover blocks in the verified set; clear 900×900 boss
  space and ungated connecting routes. Random cover placement has a deterministic
  fallback; each placement preserves player and large-agent connectivity.
- `js/world.js`: circle/hull clearance, swept projectile segments, sliding body
  movement and shared four-neighbor navigation fields for 45/75/120-unit agent
  clearances. Fields update when the player changes grid cell. Player movement uses
  the actual rotated hull outline; rotation against a wall is constrained without
  teleporting the ship. Enemy role/attack behavior remains when a direct route is
  clear; blocked enemies seek a route, including nearby ranged enemies.
- `js/world-render.js`, `js/render.js`: cached floor/boundary paths, neon solid
  cover, boss-space outline and cached minimap geometry. Decorative platforms,
  dust, glow, effects and quality settings remain. Cover is separate from those
  decorative platforms. The chosen driving heading also appears on the minimap.
- `js/game.js`: new-run map version 1, validated save loading, deterministic valid
  anchor/cache placement, valid restored player/loot positions and projected fresh
  loot. Map version 0/missing keeps original rectangular generation; unsupported
  versions are rejected without replacing storage. Boss spaces exist each sector,
  but a sector completed before the existing boss timer can still end without a
  boss encounter, preserving the approved completion rules.
  Optional saved aim preserves a valid rotated hull position beside cover instead
  of conservatively relocating it by its bounding circle; older saves use the
  original default aim. Invalid saved positions still recover to valid floor.
- `js/sim.js`, `js/enemies.js`, `js/ships.js`: valid enemy/boss/mine/strike spawns;
  cover-aware player/enemy movement, contact, projectiles, beams, arc/chain/homing
  targeting, DOT, pulls, orbitals, blast damage and magnet/pickup proximity. Cover
  is indestructible. Ricochet projectiles bounce rather than penetrate; other shots
  stop with their impact effects. Indirect strikes land on valid floor and their
  blast uses the same cover checks. Decorative blast rings/lightning jitter may
  extend across cover visually; damage remains blocked.
- Automated Node checks: `node tools/check-maps.cjs` passed **384 layouts**, root
  seeds 0–127 at sectors 1, 2 and 6: 134 chamber, 128 wide, 122 compact; 140 distinct
  sizes; 2–12 covers. Independently checked all floor/required-area reachability,
  spawn validity, clear boss space, three agent-clearance graphs, exact seed
  reproduction, legacy dimensions, unknown-version rejection, fast body collision
  and routing around a wall. No invalid/unreachable required spawn was found.
- Automated browser: `tools/check-map-combat.js` passed **39 assertions** in an
  isolated `/?test=maps` context. Includes swept friendly/hostile shots, beam,
  arc/chain/homing, DOT, blast, orbitals, magnets/pickups, body/rotation collision,
  native rusher and nearby ranged routing, exact beside-cover pose restoration,
  save reproduction, boss spawn, entry,
  exit during combat, defeat/rewards, legacy loading and all 16 weapons near cover.
  No captured game errors. Earlier issue regressions also passed after integration:
  driving 31, camera 33, ships 119, firing 38, discarded items 35, spawning 23.
  Their heading/hull-only fixtures explicitly remove solid geometry so geometry
  is verified by the map suites instead of confounding those separate checks.
- Agent inspected a 1920×1080 chamber scene (root seed 0, sector seed 2399039635):
  distinct solid cover, irregular floor boundary, boss/minimap region and original
  neon decoration visible. Screenshots remain in `/tmp`, outside Git.
  Also inspected a geometry overview of all three families (direct layout seeds
  0, 1 and 8), confirming visibly different connected-region silhouettes.
- Changed JavaScript syntax, glow-cache regression and `git diff --check` passed.
- Pending: owner map/cover/boss encounter review, reference-renderer performance
  target and full-duration retained-memory validation.
- Implementation commit: pending.
- Performance acceptance remains dependent on issue 001's reference-renderer check.

### Performance smoke check and reproduction

Conditions: same eight-core KVM guest and Headless Chromium 155/SwiftShader as
001, 1920×1080, DPR 1, high quality and all existing effects. Other rendering tabs
were stopped. The seeded harness uses invulnerability, locked audio, automatic
protocol/overflow handling and suppressed save writes. These are final-map smoke
checks, **not equivalent-workload optimization comparisons** with pre-map 001:
geometry, input, discarded items and balance have changed independently.

| Scenario | Measured duration | Update p95 | Render submission p95 | Display callback interval p95 |
| --- | --- | --- | --- | --- |
| Normal | 600 frames / 10 simulation seconds | 0.8 ms | 8.9 ms | 33.4 ms |
| Large wave | 600 frames / 10 simulation seconds | 1.3 ms | 28.8 ms | 50.0 ms |

Both short scenarios use 120 warmup frames. Normal finished with 15 enemies,
14 player bullets and 38 hostile bullets; large wave started at 120 enemies and
finished with 120, 11 player bullets, 128 hostile bullets and 33 mines. Initial
sector seed 1646057677 produced a wide 3800×2700 map. The agreed **16.7 ms display
target is not met in this software-rendered environment**; acceptance stays open.

Accelerated extended check: 72,000 simulation frames / 1,200 simulation seconds,
rendering every 60 steps (1,200 rendered samples), completed in 51.54 wall seconds,
reaching sector 7 without captured game errors. Final counts: 98 enemies, 115
player bullets, 181 hostile bullets, 5 mines, 13 effects, 197 particles, 46 texts,
308 fresh ground items. Sampled combat peaks: 120 enemies, 115 player bullets,
300 hostile bullets, 35 mines, 24 effects, 554 particles and 81 texts. Fresh loot
accumulates within sectors as approved; it clears on sector transitions.
Used-JS-heap samples ranged 5.19–40.38 MB; these include profiling arrays/caches
and are not GC-controlled retained-memory or GPU backing-store measurements.
This check does not replace a full 20-minute continuous-rendering run.

Raw results and complete settings/samples: `tools/performance/results-007.json`.
Use the harness instructions in `tools/performance/README.md`. Record `Game.run.seed`,
sector number, `Game.level.seed` and `Game.run.mapVersion` when reporting a map.
`NEON.Maps.generate(sectorSeed)` regenerates version-1 geometry without changing
the live run or browser storage. The seed sweep uses the full `Game.generateLevel`
path with root seeds 0–127, version 1, and sectors 1, 2 and 6.
