# 005 — Reduce enemy spawn frequency

Status: Implemented — needs validation

## Problem

Enemies spawn too frequently. The initial modest reduction was insufficient in
owner playtesting; the owner now wants gentle progression toward dense later sectors.

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

### Gentle progression follow-up (2026-10-29)

- Owner playtest: starting population feels good, but ongoing spawning overwhelms
  too quickly. Owner selected gentle progression: sector 1 cap 15, routine groups
  about every 5 seconds, building toward previous intensity around sector 10.
  This supersedes the earlier instruction to leave batch sizes/caps unchanged.
- Implemented: sector-based population cap across routine waves, surges, guards,
  splits and summons. Scheduled wardens and bosses bypass the cap to preserve
  required encounters (up to two extra enemies). No existing enemies are removed.
- Starting population, rewards and encounter schedules remain; routine group
  growth slows as well as cadence. Owner pacing/reward review remains pending.
- Files: `js/content.js` exposes gentle tuning; `js/enemies.js` interpolates
  cadence, batch sizes and cap by sector, with central admission in `spawnEnemy`
  so multi-enemy sources cannot overshoot. `js/game.js` uses the sector's routine
  interval for the first group rather than the previous fixed 1.75-second delay.
  `tools/check-spawning.js` covers the new progression and population bounds.
- Progress fraction: clamp((sector − 1)/9, 0, 1). Interpolate interval from 5 s
  to the previous interval at the current sector/elapsed; interpolate group size
  from 2 to the previous group size, rounded down. Population cap interpolates
  from 15 to 120, rounded down, then respects quality ceilings (120/82/55).
  Cap does not grow with elapsed time within a sector. Sector 1 stays at 2 per
  group every 5 s; sector 10 onward resumes previous routine progression.

| Sector | High-quality cap | Routine interval, entry → 380 s | Group size, entry → 380 s | Events/min at 0 / 210 / 380 s, before → after |
| --- | --- | --- | --- | --- |
| 1 | 15 | 5 → 5 s | 2 → 2 | 39/50/65 → 12/12/12 |
| 5 | 61 | 3.44 → 3.16 s | 2 → 3 | 41/53/70 → 18/19/19 |
| 10 | 120 | 1.41 → 0.79 s | 5 → 7 | 43/57/76 → 43/57/76 |

- Automated isolated Chromium: all 98 spawn assertions passed, including all
  quality settings, monotonic pressure from sectors 1–10, batch/surge/summon cap
  enforcement, required encounters at cap, no routine backlog at cap, initial
  delay, native sector transitions, save/continue, and scheduled encounters.
  Event measurements use the actual director with intercepted wave calls, fixed
  sector/elapsed and 1/600 s steps over 60 s, no population pressure; first event
  immediate in both measurement fixtures. These measure cadence, not kill rate.
- Additional native simulation: 240 s at 1/60 s, invulnerable stationary pilot,
  no rendering. Maximum population 17; counts at 60/120/180/240 s were
  15/15/16/17. Warden and boss flags true; no page/console errors. This verifies
  integrated bounds, not subjective pacing or performance.
- Normal animation-loop browser smoke: starts with 5; at 5.3 s had 12 enemies
  including non-routine sources. Pause held elapsed time; save/load succeeded;
  sector 2 entered with 6 and a 4.615 s initial interval. Resize and resumed play
  produced no page/console errors. All browser checks used isolated contexts.
- Changed JavaScript syntax checks and `git diff --check` passed. Owner review
  remains necessary for early/middle/late pacing and viable XP/upgrade rewards;
  fewer enemies means fewer opportunities for rewards, whose per-enemy values
  are unchanged. No performance benefit or player balance acceptance is claimed.

### Starting population follow-up (2026-10-29)

- Owner requested half as many initial enemies and increasing counts as levels
  increase. Sector-entry population was fixed at 9 (high/medium) or 6 (low).
- Implemented: halve the first-sector population (round up to whole enemies),
  then add one enemy per subsequent sector, within the existing quality cap.
  High/medium sectors 1–5 now start with 5, 6, 7, 8, 9 enemies (previously 9
  throughout); low starts with 3, 4, 5, 6, 7 (previously 6 throughout).
  Halving 9 rounds 4.5 up to 5, a 44.4% integer reduction; low's 6 → 3 is exactly
  50%. Growth is capped at 120/82/55 for high/medium/low. These are sector
  numbers, independent of pilot XP level.
- `N.SPAWN_TUNING` exposes the .5 starting multiplier and +1 per-sector growth.
  Routine wave progression and the previous cadence tuning remain. The explicit
  four-enemy save/continue population also remains.
- Files: `js/content.js`, `js/enemies.js`, `tools/check-spawning.js`.
- Automated isolated Chromium browser: all 42 assertions in
  `tools/check-spawning.js` passed. Added checks cover all quality settings,
  new-run counts, pause/resume, native sector 2 transition, sector 5 growth,
  late-sector caps, explicit counts, and save/continue. Previous cadence and
  scheduled encounter assertions also passed.
- Agent browser smoke check with the normal animation loop: sector 1 ran for
  2.2 seconds (7 enemies after the first routine group), pause/resume and native
  completion/advance entered sector 2 with 6 enemies, then viewport resize ran
  without console errors or page exceptions. Owner storage was not accessed;
  both checks used fresh isolated browser contexts.
- Syntax checks for changed JavaScript and `git diff --check` passed.
- Remaining: owner pacing/reward review, including later sectors. No performance
  improvement or subjective balance acceptance is claimed.

### Previous routine cadence change

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
- Implementation commit: `b027e65`.
