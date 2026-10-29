# 002 — Choose ship type and color before a run

Status: Implemented — needs validation

## Problem

The player wants to choose a ship type and color when starting a new run.

## Work requested

Add ship and color selection to the new-run flow, with a visible preview and clear
selected state. Apply the choices when the run begins.

## Associated information

Decide whether ship types differ only in appearance or also in stats, handling,
weapons, or abilities. If differences affect gameplay, explain them in the selection
screen. Keep preview and in-game appearance consistent.

## Acceptance criteria

- [ ] Before starting a run, the player can choose from the agreed ship types and colors.
- [x] The selected ship and color are visible in a preview before confirmation.
- [x] Starting the run uses exactly the confirmed ship type and color.
- [x] Any gameplay differences between ships are accurately described.
- [x] Starting another run allows the player to make a new selection.
- [ ] Selection works with each supported menu input method and at supported viewport sizes.

## Open questions

Which ship types and color palette should be available?
There should be 4 different ship types, and the color pallet should follow the game style, but be slightly brighter than the game colors so it stands out.

Are ship differences cosmetic or mechanical?
Start of cosmetic, eventually (much later) there may be mechanical/stat differences, but for now the change should just be cosmetic. the only mechanical difference is the hitbox should reflect the shape/size fo the ship.

Should the last selection persist across page reloads?
Selection should persist for the player for the entire durration of the save. They would need to start a new game to chose a new ship.

## Implementation and validation

- Work started using the recorded owner scope: four cosmetic hulls, brighter neon
  palette, shape-matched hitboxes, preview and save-fixed selection. No differences
  in speed, weapons, stats or abilities.
- Visual implementation choices: retain Dart and add Delta, Kite and Talon geometric
  hulls; cyan, magenta, lime, amber, violet and ice colors. Pending owner visual review.
- `js/ships.js`: shared hull definitions/drawing for previews and gameplay, six
  validated colors, polygon-versus-circle hitboxes with a bounding-circle early
  rejection. The outline excludes decorative glow, shields and the small aim tip.
- `js/game.js`: save/validate hull and color; legacy/invalid values default to the
  original Dart/cyan. No save reset or version bump. Selection is stored on the
  player and is available only during new-run setup.
- `js/ui.js`, `index.html`, `css/style.css`: new-run hull/color screen with selected
  states, shared preview, launch/cancel and existing keyboard/controller focus
  navigation. Existing-save confirmation remains; canceling selection preserves
  the save, and launch writes the replacement checkpoint.
- `js/render.js`, `js/sim.js`, `js/enemies.js`: chosen hull/color on ship and trails;
  outline collisions for enemy projectiles/contact, mines and explosions. Map
  margins account for hull extent. Stats, weapons and abilities remain identical.
- Automated browser: all 119 assertions in `tools/check-ships.js` passed on an
  isolated `/?test=ships` page. Covers all 24 combinations, equal stats, selection
  persistence, every hull vertex, rotation, concave empty regions, projectile hits
  on hull tips, legacy/invalid save defaults and cancel/reselect behavior.
- Agent browser checks: mouse selected and launched Talon/Violet; keyboard
  ArrowDown/Enter selected Delta; simulated controller confirm selected Kite.
  UI inspected at 360×740 and 1920×1080 with no horizontal overflow. No captured
  game errors. Physical controller and owner visual approval remain pending.
- JavaScript syntax and `git diff --check` passed.
- Implementation commit: `2d27ec1`.
