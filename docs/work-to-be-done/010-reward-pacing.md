# 010 — Pace equipment rewards and defer choices

Status: Done

## Problem and approved direction

Frequent equipment and protocol menus interrupt combat, and duplicate pickups can
max out a build in one crowded sector. The owner approved paced equipment rewards
(option 2) plus player-opened pending choices (option 3). Preserve frequent
immediate consumables and special boss rewards.

## Implementation decisions

The owner approved option 2 (paced equipment) plus option 3 (player-opened choices).
Initial tuning uses 18 active-combat seconds for the first ordinary equipment
opportunity, 36 thereafter, plus eight kills since the last ordinary equipment
reward. Luck reduces required kills, with a minimum of four. Existing enemy drop
rolls still apply, so these are minimum intervals rather than guaranteed arrivals.
Time advances only in focused, visible gameplay with a living enemy. Time/kill
credit is capped at one opportunity and persists across sectors and checkpoints.

Enemy, elite, cache and anchor equipment share this budget, including duplicates.
Boss weapon/module/consumable cascades bypass the budget without spending it.
Withheld equipment simply does not spawn: existing consumable, healing, buff and
XP drop rates are unchanged. The initial draft's proposed consumable conversion
was not used, to avoid increasing healing and changing difficulty unintentionally.

Equipment pickups wait in a four-item tray without installing or stacking. Full
trays leave further equipment on the ground. Protocol choices wait separately
without loss and are represented by a count, not one UI card per earned level.
The HUD button, pause menu, or remappable Rewards action opens the paused tray.
Defaults: R / controller X (button index 2). Legacy custom bindings are preserved:
choose an unused fallback or leave Rewards unbound if all fallbacks are occupied.
Mouse/pause-menu access remains available. Installing new gear with full bays
opens the existing replacement screen; duplicates upgrade only on installation.
One protocol selection returns to combat with other choices retained.

Pending equipment, an unresolved replacement, pacing credit and unspent protocols
survive save/continue and sectors. Existing version-1 saves default missing reward
data to an empty tray and fresh meter; pending protocols are recovered from pilot
level minus installed protocols. Malformed equipment entries and invalid numeric
fields are validated. Continue and resume never force pending choice menus.

## Acceptance criteria

- [x] Dense kills cannot bypass the shared equipment time/kill budget. Automated
  browser checks cover first/subsequent intervals and a dense synthetic workload.
- [x] Immediate consumables remain available; duplicates consume equipment budget.
  Automated browser checks verify consumable bypass and deferred duplicate upgrades.
- [x] Pickups and XP do not automatically pause gameplay. Automated browser checks
  cover equipment banking, multiple level-ups, continue and resume.
- [x] Pending rewards can be opened by mouse and remappable keyboard/controller
  input. Agent mouse checks and automated keyboard/synthetic gamepad checks passed;
  physical controller coverage is limited to synthetic input in the recorded tests.
- [x] Full tray retains fresh loot on ground; rewards survive sectors and
  save/continue. Automated browser checks include later collection, legacy saves
  and an unresolved replacement.
- [x] New rewards preserve firing-mode behavior and pause simulation during
  selection. Automated reward and firing regression checks passed.
- [x] Owner playtesting confirms satisfying progression and fewer interruptions.
  On 2026-10-29 the owner reported: “this passes my validation”.

## Implementation and validation

Changed files: `js/game.js` (bounded reward closure and lifecycle/save integration),
`js/sim.js` (clock, mapped action, pickup retention, sector protocol retention),
`js/enemies.js` (kill progress and safe withheld cache drops), `js/util.js` (control
defaults and migration), `js/ui.js`, `js/main.js`, `index.html`, `css/style.css`, and
`tools/check-discarded-items.js` (reward regression route and updated pickup checks).
Related firing edits are included in the authorized repository commit.

Browser checks use isolated in-memory storage; the owner's saves/settings were
not cleared or overwritten. Chromium at localhost:8000 was used. Browser resource
caching was disabled after a reload retained an older enemy script; the final
reward suite ran against the corrected cache implementation.

- Reward route (`?test=rewards`): 53 assertions passed, including burst/time/kill
  gating, a 300-second synthetic workload with 30,000 kill events yielding eight
  equipment opportunities, duplicate banking, tray capacity and later collection,
  protocol deferral, paused selection, save/continue, old/malformed saves, sector
  retention, unresolved replacements, remapped keyboard/synthetic gamepad,
  pause/focus/hidden time, held/toggle firing, ordinary/elite/boss equipment,
  normal/corrupt cache withholding, and conflicting legacy bindings.
- Updated discarded-item route: 39 assertions passed. Existing firing route:
  53 assertions passed. Controller assertions use synthetic input, not hardware.
- Agent manual browser checks: HUD click opens tray, Install upgrades a duplicate,
  Return resumes combat. Desktop tray and full mobile tray (390x844) inspected;
  no horizontal overflow. Equivalent 1280x800 high-quality scene captured with
  HUD hidden/shown; rendering and effects retained. Captures are local artifacts.
- JavaScript syntax checks passed during implementation. `git diff --check`
  passed again after documentation and cleanup on 2026-10-29.
  Browser console had no gameplay exceptions in the final reward pass; only an
  existing `/favicon.ico` 404 was observed.


Shared-folder access was repaired by the owner on 2026-10-29. The three unused
files created during the initial access failures (`js/rewards.js`,
`js/.reward-access-check`, `js/.reward-patch-check`) were removed. The reward logic
remains in its separate closure in `js/game.js`; no runtime behavior changed during
this documentation and cleanup pass. The index and this issue are synchronized.

Owner validation: on 2026-10-29 the owner confirmed “this passes my validation”.
This supplies the player acceptance for progression and interruption frequency;
all acceptance criteria now have supporting evidence. No remaining implementation
work or owner decision is recorded for issue 010.

Coverage limitation: the owner did not specify their input device. Recorded
controller regression checks use synthetic input; physical controller testing is
not claimed. No new runtime tests were needed for this documentation-only update.
`git diff --check` passed after recording acceptance. Implementation commit: `c6dbb82` (009 and 010).
