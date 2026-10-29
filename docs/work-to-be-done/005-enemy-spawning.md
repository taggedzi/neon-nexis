# 005 — Reduce enemy spawn frequency

Status: Implemented — needs validation

## Problem

Enemies spawn too frequently. The player wants a modest reduction in spawn frequency.

## Work requested

Inspect the existing spawn cadence and progression rules, then tune the interval
or spawn rate to provide more breathing room. Keep tuning values easy to locate
and explain. Treat this as a balance change separate from performance optimization.

## Associated information

Record the previous and proposed values. Compare equivalent early, middle, and
late-run periods so difficulty scaling does not silently erase the intended change.
Do not assume that reduced batch sizes or an enemy cap satisfy a request for less
frequent spawning. Check effects on progression and rewards.

## Acceptance criteria

- [x] The intended reduction is agreed and documented with old/new tuning values.
- [x] Measured spawn events per minute are lower in comparable run conditions.
- [ ] Early, middle, and late-run playtests confirm the intended pacing.
- [x] Required waves, objectives, and boss encounters still trigger correctly.
- [ ] Reward and upgrade progression remain viable at the new spawn frequency.

## Open questions

Owner decisions (2026-10-29): 20% fewer routine spawn events throughout the run
(routine intervals ×1.25). Surges, wardens, bosses, anchor guards and enemy summons
keep their existing schedules. Batch sizes, caps, rewards and objectives do not change.

## Implementation and validation

- Work started: expose routine cadence multiplier in `js/content.js`; apply it
  after existing progression/clamping and to initial routine delay.
- Old interval formula: clamp(1.25 − elapsed/420 ×0.55 − sector ×0.012, 0.48, 1.25)
  seconds. New formula: that result ×1.25 (0.60–1.5625 seconds). Initial delay:
  1.4 → 1.75 seconds. The unused `spawnInterval:1.05` field is not actual cadence.
- `js/enemies.js`: shared `routineSpawnInterval` applies the multiplier after
  progression/clamping. `js/game.js`: scaled initial delay and removed the unused
  `spawnInterval` field. Other encounter schedules, group sizes and caps unchanged.
- Automated browser: all 23 assertions in `tools/check-spawning.js` passed in an
  isolated `/?test=spawning` page. Each steady-state window simulates 60 seconds
  with 1/600-second steps, fixed sector/elapsed values, no active enemies/cap
  pressure, and counts actual `spawnWaveGroup` calls without creating enemies.
  Baseline captured from pre-change runtime `1d08f7a`; first event is immediate
  in both fixtures, so integer counts differ slightly from exactly 20%.

| Sector | Elapsed within sector | Before events/min | After events/min | Unchanged group size |
| --- | --- | --- | --- | --- |
| 1 | 0 s | 49 | 39 | 2 |
| 1 | 210 s | 63 | 50 | 3 |
| 1 | 380 s | 81 | 65 | 4 |
| 5 | 0 s | 51 | 41 | 3 |
| 5 | 210 s | 66 | 53 | 4 |
| 5 | 380 s | 87 | 70 | 5 |
| 10 | 0 s | 54 | 43 | 5 |
| 10 | 210 s | 71 | 57 | 6 |
| 10 | 380 s | 95 | 76 | 7 |

- Native gameplay update checks passed for surge at 60 s, warden at 120 s, boss
  at 210 s and sector completion at 420 s. No captured game errors. Syntax and
  `git diff --check` passed.
- Pending player checks: early/mid/late pacing and rewards/upgrade viability.
  Lower spawn frequency is a balance change, not issue 001 performance evidence.
- Implementation commit: pending.
