# 001 — Improve performance during large enemy waves

Status: Planned

## Problem

The game visibly slows down during large enemy waves, even on a powerful PC.

## Work requested

Profile representative gameplay and identify the main CPU, rendering, or memory
costs. Optimize measured bottlenecks while preserving gameplay. Include extended
runs to check whether enemies, projectiles, effects, or items accumulate over time.
Avoid assuming a particular cause or committing to a rewrite before measurement.

## Associated information

Record the browser, hardware, viewport, run duration, enemy/entity counts, and
repeatable scenario used for comparison. Capture frame times and memory behavior
before and after changes. Coordinate with 005 and 006, but compare equivalent
workloads so balance changes do not masquerade as optimization.

## Acceptance criteria

- [ ] A reproducible large-wave scenario and pre-change baseline are documented.
- [ ] Profiling identifies the dominant bottlenecks and explains the chosen fixes.
- [ ] A numeric frame-time target and reference machine/browser are agreed and recorded.
- [ ] The same scenario meets that target after optimization, with before/after results.
- [ ] An extended-run check shows no unexplained, continuously growing retained entity count or memory use.
- [ ] Movement, combat, collisions, pickups, and wave progression still work correctly.

## Open questions

What reference hardware/browser and frame-rate target should define success?
How long should the extended-run benchmark last?
