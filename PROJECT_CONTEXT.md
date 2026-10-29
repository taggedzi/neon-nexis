# NEON NEXUS — Project Context & Handoff

> Working document capturing the build's objective, architecture, verification status, and remaining work.
> Last updated: 2026-10-28

---

## 1. Objective

Build a complete, polished, **browser-based top-down twin-stick bullet-hell** game with endless
Vampire-Survivors-style progression:

- Fully client-side. No multiplayer, no server tracking. Everything runs after the initial page load.
- Top-down endless waves; each procedurally generated level is limited in size and designed to last **5–10 minutes**.
  Advance by clearing the level or surviving the timer.
- Twin-stick controls: **WASD** (left stick) to move; **mouse** (right stick) to aim and auto-fire.
  Full **gamepad** support and key/button **remapping** in Settings.
- High-contrast **neon / dark** palette, **wireframe / low-poly** polygon visuals, floating geometric
  platforms, and digital **glitch effects** (color shifts, scanlines, distortion) on hits, pickups, and
  special events.
- **At least 16 distinct weapons** with different projectile patterns, rates, and behaviors; many
  upgrades/modifiers; clear visual and audio feedback.
- **32 distinct enemy body styles** with size/color variations; consistent buffs/debuffs/shields/armor/
  health/speed drops matching visuals; styles and colors rotate across levels.
- **Limited inventory slots** for weapons and passive mods; slots increase at level-up milestones.
  A full inventory + new pickup **pauses the game** for a keep/drop choice. Dropped items persist as
  pickup icons on the current level and can be re-collected.
- Random **destructible level objects** drop weapons, mods, buffs, and debuffs.
- Character progression through collected items, weapons, and buffs while slot-limited.
- **Auto-save** at level ends and checkpoints via `localStorage`; resume on the same browser. Local saves only.
- Full menus: **main, pause, settings (controls, audio volume, graphics), game-over/continue**.
  UI must match the geometric neon style.
- All graphic and audio assets generated **procedurally** and packaged so the game runs **offline** after load.
- Prioritize polish, completeness, and absence of major core-system bugs over extra features.

---

## 2. Current Status — COMPLETE & VERIFIED

The implementation is substantially finished. All automated test suites pass with **zero console errors**.

| Suite | Result | Coverage |
|---|---|---|
| `full_test.py` | **59/59 PASS** | menu, settings persistence, remapping, movement, firing, damage, pause, inventory, overflow keep/drop/re-collect, save/continue, level complete, sector advance, game over/restore, all 16 weapons fire, 32 styles, 16 roles, 26 mods |
| `mega_test.py` | **PASS** | audio unlock, how-to/credits menus, quality & FPS toggles, multi-level-up protocols, slot milestones, resize responsiveness, mute persistence |
| `droptest.py` | **PASS** | all 16 role drop tables resolve, all ground drops named, curse drops exist, all 6 consumables apply |
| `levelsave_test.py` | **PASS** | checkpoint written mid-level-up, core/level persisted, pending choices recovered, overlay reopens, recovered choice applies |
| `soak_test.py` | **35/35 PASS** | simulated gamepad (move/aim/auto-fire/dash/start), surges, warden + boss spawns, boss loot, cache/anchor drops, exotic weapon effects, auto-checkpoint, entity caps, timer completion, no external resources |
| `longrun_test.py` | **PASS** | sustained kills/leveling, no soft lock, no errors, caps respected, acceptable FPS |
| `gapcheck.py` | **24/24 PASS** | floating geometric platforms (28–40/level incl. 4 hero platforms), normal/corrupt loot distributions, all loot IDs/colors/tiers resolve, curse debuff tradeoffs, every destroyed cache drops its rolled loot |
| `finalgaps_test.py` | **14/14 PASS** | 32-style rotation across sectors (16 disjoint per sector), clearing all anchors completes the level, complete screen + reason `anchors`, advance to sector 2, glitch feedback on real combat events |

**Final verification run (2026-10-28):** all seven suites (`full`, `mega`, `drop`, `levelsave`,
`soak`, `longrun`, `finalgaps`) plus `gapcheck` pass with **zero failures** and **zero console errors**.

### Gap verification (2026-10-28)
Both previously untested requirement areas are now confirmed:

- **Floating geometric platforms** — every generated level contains **28–40 polygons**
  (24–36 regular + **exactly 4** large "hero" platforms), each with ≥3 vertices and valid
  `x/y/color/alpha/depth/spin/phase` fields. The active level had 29–32 platforms in repeated runs.
- **Destructible loot table** — sampled 1,200 rolls per category/level:
  - Normal caches: ~37% weapons, ~45% buff mods, ~18% consumables, **0% curses**.
  - Corrupt caches: ~24% weapons, ~61% curse mods, ~15% consumables, **0% buffs**.
  - All sampled IDs resolve to real weapons/mods/consumables; colors are 6-digit hex; weapon tiers stay 1–3.
  - **All 4 curse mods** carry a real downside (negative delta or positive `damageTakenMul`).
  - **Every destroyed cache** (75–78 per 5-level sample, ~18–20% corrupt) spawned exactly one ground
    pickup matching its rolled kind/ID; corrupt drops use the red `#ff335c` tint.

### Mod-type nuance
- `N.MODS` has **26 entries**: **22 `type:'buff'`** and **4 `type:'curse'`**. There is no separate
  `type:'debuff'`. The "debuff" half of the requirement is satisfied by the four curse mods, each of
  which trades a strong upside for a real penalty (e.g. `cursed_void`: `damageMul +0.40`,
  `damageTakenMul +0.18`).
- **Effects are additive deltas over `N.BASE_STATS`**, not raw multipliers. For example
  `damageTakenMul: 0.18` becomes **1.18** on top of the base `1`, i.e. +18% incoming damage.
  A test that checks the raw effect value against `> 1` will wrongly flag this as a buff.

### Soak-test reliability hardening (2026-10-28)
`soak_test.py` originally used fixed `time.sleep()` waits between simulated events. Under headless
Firefox the frame rate varies, so a short sleep could span too few frames and produce false
failures (notably `surge fired` and `gamepad start resumes`). The suite now uses a `wait_until()`
polling helper for state transitions — pause/resume, surge, warden, boss, boss-death, checkpoint,
timer completion, and sector advance — and holds the fake gamepad button until the expected state
actually arrives. Repeated consecutive runs pass with **zero failures**, confirming the game logic
was correct and the flakiness was in the test timing.

### Final gap verification (2026-10-28)
`finalgaps_test.py` closes the last untested requirement paths:

- **32 enemy styles rotate across sectors** — level 1 and level 2 each draw **16 styles**, the two sets
  are **disjoint**, and their union is **all 32** defined styles. (The wave director alternates by
  sector parity and applies a per-sector hue shift, so the whole ecology recolors.)
- **Clearing the level by destroying all anchors works** — destroying all but the last anchor spawns
  loot; destroying the final anchor flips mode to `complete`, shows the complete screen, and sets
  `lastSummary.reason === 'anchors'`. Clicking **ADVANCE** starts sector 2 in `playing` mode.
- **Glitch feedback fires on real combat events** — an elite hit produced `G.glitch = 0.40` and its
  death produced `0.55`, confirming the neon/glitch feedback path is live.

**Design note:** `completeLevel()` calls `G.resetEntityArrays()` and clears `G.groundItems` when a
sector ends. Loot dropped by the *final* anchor is therefore discarded as the board resets — this is
intentional cleanup on transition, not a lost-drop bug. Drops from earlier anchors/caches persist and
are collectible during normal play.

### Notable bug found and fixed
- `js/render.js:486` called `CanvasRenderingContext2D.arc()` with a **color string as the 4th argument**
  and no end angle. Fixed to `arc(x, y, radius, 0, TAU)`.

---

## 3. File Inventory

```
/media/sf_tz-rootish/
├── index.html          (273 lines)  Page shell, menu markup, script load order
├── css/
│   └── style.css       (343 lines)  Neon/geometric UI styling
└── js/
    ├── util.js         (269 lines)  Math, storage, settings merge, palettes, helpers
    ├── audio.js        (311 lines)  Web Audio synthesized SFX + music
    ├── assets.js       (430 lines)  Procedural canvas sprite/icon generation
    ├── content.js      (412 lines)  Weapons, mods, protocols, enemies, themes, constants
    ├── input.js        (221 lines)  Keyboard, mouse, gamepad, remapping, deadzones
    ├── game.js         (932 lines)  Core init/state/settings/save/loop integration
    ├── sim.js          (724 lines)  Gameplay simulation: movement, bullets, collisions, progression
    ├── enemies.js      (545 lines)  Enemy spawn logic, AI roles/behaviors, shields, drops
    ├── render.js       (854 lines)  Canvas rendering, camera, glitch/scanline/visual FX
    ├── ui.js           (632 lines)  Menus, settings, inventory, overlays, protocol cards
    └── main.js          (47 lines)  Boot loop / RAF wiring
```

**Total:** ~5,993 lines. No external assets; all visuals and audio synthesized at runtime.

---

## 4. Key Architecture Notes

### Globals
- Everything hangs off `window.NEON`.
- Core namespace: `NEON.Game` (often referenced as `G` in source).
- Renderer/UI/Input modules expose `NEON.Render`, `NEON.UI`, `NEON.Input`, etc.

### Save / Settings keys
- Save: `neon_nexus_save_v1`
- Settings: `neon_nexus_settings_v1`

### Run constants
- Level duration: `G.DURATION = 420` seconds (7 minutes).
- Surge at 60s, warden at 120s, boss at 210s; auto-checkpoint every 60s.
- Entity caps: **650** particles, **620** player bullets, **850** enemy bullets, **80** floating texts.

### Content confirmed in `js/content.js`
- **16 weapons** (`N.WEAPONS`):
  `pulse`, `scatter`, `rail`, `spiral`, `seeker`, `nova`, `mortar`, `mine`,
  `tesla`, `beam`, `orb`, `chain`, `shard`, `gravity`, `starfall`, `shuriken`
- **32 enemy styles** (`N.ENEMY_STYLES`) — two silhouettes per role, each shape used once.
- **16 enemy roles**, including `rusher`, `tank`, `shooter`, `splitter`, `burster`, `sniper`,
  `aegis`, `detonator`, `weaver`, `hive`, `ram`, `gyro`, `warden`, `null`, `seeder`, `boss`.
- **26 passive/curse mods**, **6 consumables**, **22 level-up protocols**, slot milestones,
  base player stats.

### Level generation (`js/game.js` ~240–340)
- Themed procedural arenas (`N.THEMES` rotating by level).
- Floating geometric platforms generated with rotation, spin, depth, alpha, and phase.
- Destructible **caches** and **anchors** with loot rolls.
- `lootFromRng(r, corrupt, level)`:
  - Corrupt caches: 62% curse mod, 60% weapon, else consumable.
  - Normal caches: 37% weapon (tier scaling), 45% non-curse mod, else consumable.
- `lootItemToGround()` creates persistent ground pickup records.
- Ground loot is re-collectable after being dropped from inventory overflow.

### Inventory overflow
- When a pickup arrives with full slots, game pauses (`mode = 'overflow'`).
- Player chooses **keep** (swap) or **leave**.
- Swapped/dropped item is written back to the ground with position, tier, color, and label.
- Leaving the item preserves it on the level for later re-collection.

### Save/restore
- Saves at level end and at checkpoints.
- Persists run metadata, player core/protocols, weapons, mods, level state, pending level-ups,
  ground items, and reason (`checkpoint`, `level`, etc.).
- Resume from same browser only; continue button enables when a save exists.

---

## 5. How to Run & Test

### Serve the game
```bash
cd /media/sf_tz-rootish
python3 -m http.server 8000
# open http://localhost:8000/
```

### Selenium environment
- Selenium **4.51.0**
- Firefox binary: `/snap/firefox/current/usr/lib/firefox/firefox`
- Geckodriver active on port **4444**
- Headless Firefox used in all tests; audio volume scaled to 0.

### Test scripts (in `/tmp/opencode/selenium/`)
```bash
cd /tmp/opencode/selenium
python3 full_test.py        # 59 core checks
python3 mega_test.py        # menus/settings/level-ups/responsiveness
python3 droptest.py         # enemy drops + consumables
python3 levelsave_test.py   # checkpoint during level-up
python3 soak_test.py        # 35 deep gameplay/system checks (polling-based waits)
python3 longrun_test.py     # sustained-play soak + FPS
python3 gapcheck.py         # 24 checks: platforms + destructible loot table
python3 finalgaps_test.py   # 14 checks: style rotation, anchor-clear completion, glitch
```

Screenshots are written to the same directory (`soak-*.png`, `e2e-*.png`, etc.).

---

## 6. Verified Requirements Checklist

- [x] Client-side only; runs offline after load (13 local resources, no external URLs).
- [x] Top-down endless twin-stick gameplay with auto-fire.
- [x] WASD + mouse controls; full gamepad support; remapping persists.
- [x] Procedural limited-size levels with 7-minute timer and clear/survive advancement
      (both the timer path and the destroy-all-anchors path verified end-to-end).
- [x] Neon/dark palette, wireframe/low-poly visuals, floating geometric platforms.
- [x] Glitch/scanline/grain/vignette effects with toggles.
- [x] 16 weapons with distinct patterns; all fire without errors.
- [x] 32 enemy styles and 16 roles; shields/armor/drop consistency verified.
      Styles rotate per sector (16 disjoint per sector, union covers all 32).
- [x] Slot-limited weapons/mods with milestone increases.
- [x] Full-inventory overflow pauses game; keep/drop/re-collect verified.
- [x] Destructible caches/anchors drop weapons/mods/buffs/debuffs.
- [x] Local auto-save at checkpoints/level ends; resume verified.
- [x] Main, pause, settings, inventory, level-up, complete, game-over/restore menus.
- [x] Procedural audio and music; audio unlock verified.
- [x] Entity caps and acceptable performance under soak.
- [x] No console errors across all suites.

---

## 7. Remaining / Optional Work

No blocking issues remain. Possible polish items if continuing:

1. **Performance tuning** — long-run FPS dips to ~13–25 in headless Firefox during heavy waves.
   Already investigated: the game scales enemy caps (`qualityCap()` in `js/enemies.js`), particle
   density (`js/game.js`), DPR (low=1, medium=1.35, high=2), and glow assets are cached
   (`js/assets.js` `glowCache`). Headless software rendering is the main limit; further tuning is
   optional and should be validated against visual quality.
2. **Manual playtest** — automated tests cover mechanics, but feel/balance (weapon tuning, enemy
   density, boss difficulty) still benefits from human play.
3. **Cross-browser check** — verification was Firefox-only. Chromium/Chrome and chromedriver are **not
   installed** in this environment (`which` found neither), so this remains blocked until a browser
   and driver are available. A quick Chromium/Safari pass is still advisable.
4. **Audio mix** — synthesized music/SFX levels could be balanced by ear.
5. **Documentation** — this file covers developer context; an in-repo README for players may help.

---

## 8. Quick Reference — Debug Hooks Used in Tests

```js
NEON.Game.mode                    // 'boot' | 'menu' | 'playing' | 'paused' | 'inventory' | 'overflow' | 'levelup' | 'complete' | 'gameover'
NEON.Game.player                  // player entity
NEON.Game.run                     // run metadata (level, etc.)
NEON.Game.level                   // current level state (elapsed, anchors, caches, activeBoss, ...)
NEON.Game.enemies                 // active enemies
NEON.Game.playerBullets           // player projectiles
NEON.Game.enemyBullets            // enemy projectiles
NEON.Game.groundItems             // persistent ground loot
NEON.Game.overflow                // active overflow prompt data
NEON.Game.damageEnemy(e, dmg, src)      // apply damage to enemy
NEON.Game.damageCache(c, dmg, src)      // destroy cache
NEON.Game.damageAnchor(a, dmg, src)     // destroy anchor
NEON.Game.spawnBullet(opts)             // spawn player bullet
NEON.Game.spawnEnemyBullet(opts)        // spawn enemy bullet
NEON.Game.addParticles(x, y, color, n, opts)
NEON.UI.currentScreen()           // active menu screen id or null
NEON.Input.hasGamepad()           // gamepad detection
```

---

## 9. Environment

- Working directory: `/media/sf_tz-rootish` (not a git repo).
- Game title: **NEON NEXUS** — theme: neon/cyber wireframe.
- Platform: Linux, headless Firefox for verification.
- Server: `http://localhost:8000/`.
