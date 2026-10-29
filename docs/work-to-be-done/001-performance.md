# 001 — Improve overall performance, especially during large enemy waves

Status: Planned

## Problem

Performance should improve across the whole game. Large enemy waves are the
highest priority because they cause visible slowdowns even on a powerful PC.
The current graphics style, look, and feel are valued and must be preserved.

## Work requested

Profile the overall game, including normal play, large enemy waves, and extended
runs, and identify the main CPU, rendering, or memory costs. Optimize measured
bottlenecks while preserving gameplay and the current graphics style, look, and
feel. Do not achieve performance gains by reducing visual quality, removing visible
effects, or changing the art direction. Include extended
runs to check whether enemies, projectiles, effects, or items accumulate over time.
Avoid assuming a particular cause or committing to a rewrite before measurement.

## Associated information

Record the browser, hardware, viewport, run duration, enemy/entity counts, and
repeatable scenario used for comparison. Capture frame times and memory behavior
before and after changes. Coordinate with 005 and 006, but compare equivalent
workloads so balance changes do not masquerade as optimization.
Capture comparable screenshots or short recordings before and after optimization
to check that ship and enemy appearance, effects, lighting, colors, and animation
retain their current presentation.

## Acceptance criteria

- [ ] Reproducible normal-play, large-wave, and extended-run scenarios and pre-change baselines are documented.
- [ ] Profiling identifies the dominant bottlenecks and explains the chosen fixes.
- [ ] A numeric frame-time target and reference machine/browser are agreed and recorded.
- [ ] The same scenarios meet the agreed targets after optimization, with before/after results showing overall improvements and particular attention to large-wave slowdowns.
- [ ] Visual comparisons confirm the current graphics style, visual quality, effects, and overall look and feel are preserved.
- [ ] Performance gains do not depend on removing visible effects, lowering visual quality, or changing gameplay balance.
- [ ] An extended-run check shows no unexplained, continuously growing retained entity count or memory use.
- [ ] Movement, combat, collisions, pickups, and wave progression still work correctly.

## Open questions

What reference hardware/browser and frame-rate target should define success?
How long should the extended-run benchmark last?
