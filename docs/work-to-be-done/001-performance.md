# 001 — Improve overall performance, especially during large enemy waves

Status: Implemented — needs validation

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
- [x] Profiling identifies the dominant bottlenecks and explains the chosen fixes.
- [x] A numeric frame-time target and reference machine/browser are agreed and recorded.
- [ ] The same scenarios meet the agreed targets after optimization, with before/after results showing overall improvements and particular attention to large-wave slowdowns.
- [ ] Visual comparisons confirm the current graphics style, visual quality, effects, and overall look and feel are preserved.
- [x] Performance gains do not depend on removing visible effects, lowering visual quality, or changing gameplay balance.
- [ ] An extended-run check shows no unexplained, continuously growing retained entity count or memory use.
- [ ] Movement, combat, collisions, pickups, and wave progression still work correctly.

## Open questions

Owner decisions (2026-10-29): use the current machine/GPU, modern Chromium or
Firefox, and a 1920×1080 test viewport (larger viewports remain supported).
Target: 60 FPS with 95th-percentile frame time ≤16.7 ms; extended run: 20 minutes.
The owner reports an eight-core VM with 256 MB VRAM and can test on a stronger
machine outside the VM if needed. Do not silently substitute that machine as the
reference.

## Implementation and validation

Work started 2026-10-29. No gameplay balance or visual-quality changes authorized
as performance fixes.

- `tools/performance/benchmark.js`: isolated-page, seeded autopilot harness with
  normal and 120-enemy starting scenarios, separate simulation/render random
  streams, method timings, frame intervals, canvas-allocation counts, entity
  samples and heap samples. Save writes are suppressed in the harness only.
- Environment inspected: Linux KVM guest, eight exposed i7-12700KF CPU cores;
  automated browser is Headless Chromium 155, DPR 1, 1920×1080. WebGL diagnostic
  reports ANGLE/SwiftShader software rendering. This is a rendering-mode clue,
  not proof of accelerated Canvas 2D or host-GPU performance.
- Checks so far: benchmark JavaScript syntax passed (`node --check`). Browser
  loads the game; only console error observed so far is missing `favicon.ico`.
- `js/assets.js`: renderer-facing `Assets.glow` now shares the existing exact
  gradient generator/cache. The cache evicts least-recently-used textures after
  128 entries (approximately 8 MiB of RGBA pixels at runtime's 128×128 size;
  backing-store overhead is additional). No drawing, effect, balance or spawn
  parameters changed.
- `tools/performance/check-glow-cache.cjs`: allocation-free hits, shared helper
  reuse, parameter isolation, defaults, gradient stops and eviction checks passed.
- Browser pixel comparison: four glow colors (including HSL and short hex) match
  the pre-change generator exactly; the seeded 240-step large-wave canvas matches
  across all 8,294,400 RGBA bytes. Agent inspected before/after screenshots kept in
  `/tmp`, outside Git. DOM flash/grain animation phase differs with wall time;
  the exact comparison covers the game canvas, not every DOM overlay phase.
- Agent browser smoke checks passed: keyboard movement, mouse firing, pause/resume,
  damage, fresh repair pickup, 1280×720/1920×1080 resizing, checkpoint save/restore;
  no captured game exceptions/console errors. An initial smoke script used an
  incorrect API name and invalid loot kind; corrected checks above were rerun.
  Seeded combat also exercised enemy deaths, loot, protocols and sector progression.
- Pending: real-player validation and a
  full 20-minute continuous-rendering/retained-memory check. Accelerated simulation
  checks are supplemental. Headless timings cannot establish reference-machine
  acceptance.
- Implementation commit: pending.

### Benchmark observations

Baseline runtime revision: `aaa6c6b`. The first normal and large-wave runs each
measured 600 frames after 120 warmup frames, at a fixed 1/60 simulation step.
The large wave starts at 120 enemies; its measured portion starts at 118 and ends
at 115. Normal play starts measurement at 10 and ends at 16. Before/after glow
calls match exactly: 20,952 normal and 69,237 large-wave calls.

Initial normal canvas creation count fell from 20,957 to 8; large-wave creation
fell from 69,244 to 5. Synchronous render submission dominated simulation cost:
baseline means were 7.68/25.45 ms for normal/large-wave rendering versus
0.19/0.52 ms for update. Glow synthesis alone consumed 2.38/7.44 seconds over
those 600-frame samples. Caching targets that measured allocation/synthesis cost.

Initial runs had another menu tab rendering. The after-runs also followed a
canvas readback for the pixel comparison. Therefore a second, same-canvas
uncached/cached comparison with the other rendering tab stopped is used for the
short-scenario timing conclusions below. Do not interpret the initial numbers
as a controlled estimate of total player-visible performance.

Accelerated retention: 72,000 measured simulation frames (1,200 seconds), plus
120 warmup frames, rendering once per 60 steps. Before/after entity counts match
at every 10-second sample and at completion, reaching sector 9. Sampled peak
counts: 112 enemies, 115 player bullets, 195 enemy bullets, 18 mines, 33 effects,
401 particles, 81 texts and 365 ground items. Final counts: 84 enemies, 42 player
bullets, 123 enemy bullets, 13 mines, 7 effects, 91 particles, 14 texts and 211
ground items. Ground items are expected to accumulate within sectors under the
existing fresh-loot/discard rules; sectors clear them. Issue 006 is kept separate.
Canvas creations fell from 109,266 to 522 across these accelerated runs.

Used-JS-heap samples ranged 4.02–10.71 MB before and 5.29–16.41 MB after (decimal
MB). These are **not retained-heap comparisons**: no explicit GC was performed,
cache textures are newly retained, and the harness retains timing arrays and
test evidence. Canvas/GPU backing stores are not measured. This does not establish
the memory acceptance criterion or replace the full-duration rendering check.

Controlled short-scenario repeat (same canvas/rendering mode, second tab stopped,
original uncached `glow` versus cached `glow`, 600 measured frames each):

| Scenario | Mean render submission, before → after | p95 render submission, before → after | p95 frame interval, before → after |
| --- | --- | --- | --- |
| Normal | 7.93 → 1.42 ms | 15.2 → 1.8 ms | 50.0 → 33.4 ms |
| Large wave | 29.45 → 5.88 ms | 61.8 → 31.9 ms | 83.3 → 50.0 ms |

The 16.7 ms frame-interval target is **not met in this automated environment**.
Render submission and frame intervals are different measurements. Results are
single runs with profiling overhead, not confidence intervals. Final counts match
for each controlled pair. Raw measurements, settings and samples are committed in
`tools/performance/results-001.json`; reproduction notes are in
`tools/performance/README.md`.

Next owner checks: play normal combat and a large wave at 1080p/high quality in
the reference browser, noting visual/feel changes; capture a full 20-minute run
with frame-time and memory recording. If the VM browser uses software rendering,
record that fact; a stronger host can supply additional evidence but must be named
as a separate reference. Further optimization should follow that profile if the
target still fails with the actual reference renderer.
