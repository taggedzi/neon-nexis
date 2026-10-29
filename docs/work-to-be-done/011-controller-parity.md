# 011 — Controller parity and control reference

Status: Implemented — needs validation

## Request and decisions

Owner reports weak menu selection feedback, inability to change weapons, and other
controller gaps. Provide comparable site functionality and settings callouts for
controller buttons/actions where practical. Preserve keyboard/mouse and remapping.
Keep existing gameplay bindings; menu confirm/back use standard bottom/right face
buttons, independent of gameplay remapping.

## Acceptance criteria

- [x] Menus show a clear selected control and scroll it into view.
- [ ] D-pad and left stick can reach menu actions, settings and reward choices.
- [x] Controller can change weapons, including remapped bindings.
- [x] HUD near HP lists equipped weapons, count/capacity and active selection.
- [x] Switching distinct installed weapons changes the weapon that fires.
- [x] Weapon pickups automatically attach while bays are available; full bays defer weapons for review.
- [x] Settings explain menu/gameplay inputs and identify active controller input.
- [x] Releases, pause/resume, disconnect, aim and remapping are regression checked.
- [ ] Owner validates physical controller usability.

## Implementation and validation

- `js/ui.js`: shared menu navigation now accepts D-pad in four directions and
  left stick, with a 55% activation threshold, 350 ms initial repeat delay and
  120 ms repeat interval. Left/right changes sliders; other directions traverse
  visible enabled controls in document order. Focus scrolls into view and survives
  settings rerenders. Gameplay Pause remapping cannot override menu confirm/back
  or direction buttons; fixed Start remains available.
- `css/style.css`: cyan inset outline, brighter background and glow make controller
  focus visible on clipped buttons. Mouse movement returns to ordinary mouse styles.
  No game visual effects or quality settings were removed.
- Settings Controls starts with a controller quick guide reflecting current gameplay
  bindings, standard Xbox/PlayStation label equivalents, and a live controller name,
  pressed-button/index and stick-input monitor. Fixed menu controls are explained
  separately from remappable gameplay controls. The monitor reports normalized,
  deadzone-filtered input, not raw hardware values.
- `js/input.js`: neutral right stick retains last controller aim until mouse motion
  or pointer press. Capturing a controller button cannot activate menu navigation
  on that same frame. B cancels keyboard capture so controller users can exit it.
- Weapon switching was already connected to default RB/LB and remappable actions.
  No switching failure reproduced with synthetic standard input: default, remapped,
  held-button single-step and wraparound checks passed. The guide explains that
  multiple equipped weapons are required. A hardware-specific failure is still
  possible and needs owner validation; no claim that this symptom is fully resolved.
- `tools/check-controller.js`: isolated-browser synthetic-pad regression, **33
  assertions passed** at 640×720; earlier 28-check version passed at 1000×720.
  Includes focus styling, D-pad/stick selection and repeat, slider adjustment,
  focus persistence, button monitor, offscreen scrolling, remapping/cancellation,
  reserved menu buttons, weapons, aim handoff, pause/resume and disconnect.
- Existing isolated-browser regressions passed: driving **31**, firing **53**,
  discarded items **39**, rewards **53**. Controller suite recorded no page or
  console errors. Existing suites completed without thrown assertion failures.
- Agent visual review: compared old/new CSS on the same menu, selected Settings
  button, 1000×720 viewport and unchanged quality. Cyan selection is clearly visible
  after the change. Ambient animations differ between captures. Temporary captures
  remain outside the repository. Settings has no horizontal overflow at 640×720.
- Changed JavaScript syntax checks and `git diff --check` passed. Tests used isolated
  browser contexts and did not touch the owner's browser saves/settings. Existing
  untracked `.playwright-mcp/` was preserved.
- Remaining validation: physical controller/browser mapping, all menu/reward/inventory
  actions and long-session ergonomics need owner playtesting. Generic DOM traversal
  is shared across screens; the new suite does not claim an exhaustive controller
  walkthrough of every screen. Remapping analog axes and custom nonstandard menu
  mappings are not implemented. No new dependency or build pipeline was added.
- No commit requested or created.


## Equipped-weapon HUD follow-up

Owner requested a weapon list near HP and investigation with distinct equipped
weapons (2026-10-29). Implemented within this issue.

- `js/render.js`: vitals panel now includes every equipped weapon by name and icon,
  equipped count/bay capacity, a bright active row and ACTIVE label. A single weapon
  explicitly says ONLY WEAPON EQUIPPED; multiple weapons show previous/next bindings
  from current settings (controller when connected, keyboard otherwise). Pending
  rewards are excluded because they are not installed. Existing bottom weapon card,
  cooldown and effects remain. Boss bar moves below the expanded vitals panel to
  avoid overlap. No gameplay balance or switch logic changed.
- Investigation: prior fixture used two copies of Pulse Lance. Replaced it with
  Pulse Lance plus Scattergun installed through the real reward flow. Tests now
  go through `Game.update`, checking default LB/RB, remapped LT, held-button
  single-step, both wrap directions, and actual projectile weapon IDs after firing
  each selection. One equipped weapon and a banked/uninstalled weapon both leave
  selection unchanged, as intended. These are possible explanations of the owner's
  symptom, not a diagnosis of their controller.
- Expanded `tools/check-controller.js`: **44 assertions passed** at 640×720,
  including the HUD's names/count, active marker near vitals, single-weapon message
  and remapped switch hint. No captured page or console errors.
- Existing regressions reran successfully: driving **31**, firing **53**, discarded
  items **39**, rewards **53**. JavaScript syntax checks and `git diff --check` passed.
- Agent compared equivalent before/after gameplay scenes at 1280×720, 640×720 and
  360×720 with the same viewport, quality, equipment and world state per pair.
  Also reviewed eight weapons plus boss bar at 360×720: names/active marker stay
  inside the panel, and boss bar is below it. No page errors in visual capture run.
  Captures are temporary files outside the repository; owner storage was untouched.
- Physical-controller testing and owner readability/ergonomics review remain pending.
  No hardware button failure reproduced with synthetic standard input; nonstandard
  mapping/device issues remain possible. Issue remains Implemented — needs validation.

## Automatic weapon attachment follow-up

Owner decision (2026-10-29): weapon pickups attach automatically while weapon bays
are available; only full bays defer weapons to pending rewards. Implemented.
This supersedes the earlier follow-up's requirement to install every weapon manually.

- `js/game.js`: weapon pickups bypass reward banking while an empty weapon bay
  exists, then use the existing attachment/integration path. Distinct weapons fill
  a bay; duplicate weapons integrate into the equipped copy without creating a
  duplicate slot. With full weapon bays, both new weapons and duplicate upgrades
  remain deferred in pending rewards. A full tray leaves deferred gear on the
  ground. An empty weapon bay accepts a weapon even if the reward tray is full.
- Auto attachment preserves the current weapon selection, firing toggle, combat
  mode, incoming tier and pickup effects. It does not force a replacement menu.
  Module deferral and equipment spawn pacing are unchanged. Existing pending
  rewards remain available for manual installation; saves need no migration.
- `js/ui.js`, `index.html`: controller guide, reward-tray explanation and How to
  Play explain automatic attachment and full-bay deferral. Issue 010 now links to
  this later owner-directed change while preserving its historical acceptance.
- `tools/check-controller.js`: distinct Scattergun now attaches on pickup, then
  default/remapped controller switching and firing tests run against it. **44
  assertions passed**, including the equipped-weapon HUD checks.
- `tools/check-discarded-items.js`: reward route now passes **65 assertions**,
  including 12 added checks for auto attachment/tier, full-tray bypass, active
  selection and toggle preservation, duplicate integration/deferral, full-tray
  floor retention, full-bay banking/replacement, save/continue, unchanged module
  deferral, and same-frame pickups filling a final bay without exceeding capacity.
  Existing deferred-duplicate tests explicitly use full weapon bays.
- Existing browser regressions passed: driving **31**, firing **53**, discarded
  items **39**. Controller suite captured no page/console errors. Changed JavaScript
  syntax checks and `git diff --check` passed. Browser tests used isolated contexts;
  the owner's storage and existing unrelated untracked files were preserved.
- Owner gameplay review and physical-controller validation remain pending. No
  commit created. Issue/index status: Implemented — needs validation.

## Owner feedback — 2026-10-29

The owner stated, “I like the changes,” after the weapon HUD and automatic
attachment follow-ups. Owner approval of the delivered changes is recorded.
The feedback does not specify input device or an exhaustive menu walkthrough,
so physical-controller usability and remaining menu-action coverage are not
marked verified. Status remains Implemented — needs validation. Earlier pending
owner-review notes above describe the evidence available at those stages.

Documentation-only update; `git diff --check` passed. No gameplay edits or new
runtime tests were needed.
