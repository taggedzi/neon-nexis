# 036 — Optional extra visual detail

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 20 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The owner likes the graphics and does not want players to lose performance.
They still want more polish, possibly by drawing polygons so some ships look
more dimensional or more detailed. The extra detail should be optional.

## What exists today

Ships, enemies, and effects are procedural canvas drawing: wireframes, glow,
and geometric shapes. Hull outlines in `js/ships.js` are also the collision
shapes. Decorative glow is already excluded from the hit outline.

Graphics quality is a setting. `G.resize` caps device pixel ratio from that
setting. [Issue 001](001-performance.md) is implemented and still needs
validation. Its record says the software-rendered automated browser did not meet
the display-time target. Headless numbers are not player performance.

Project rules say to preserve the look, and not to remove effects or lower the
default quality in order to claim a speedup. An optional detail layer fits
those rules only if the default stays the current picture.

## Determine

- Which objects the owner means by "some of the ships": the player hulls, enemy
  styles, or both.
- A before and after capture at the same viewport, seed, and quality, so the
  review is a picture comparison and not a memory of one.
- Whether the extra polygons are a second draw pass on the existing outlines or
  a new mesh. A second pass is easier to turn off.

## Decide

- Default off or default on. 
- Which quality levels may enable it. Low quality should not silently gain the
  heavier pass.
- Whether hitboxes change. They should not, unless a visual change is also a
  gameplay change under [issue 029](029-ship-stats-and-colors.md).

Proposal, not approved:

- Add a setting, default off, named so the player knows it costs frames.
- When off, drawing is the current code path.
- When on, player hulls and enemy styles draw an extra shaded face pass behind
  the existing wireframe. The wireframe stays, so the neon look remains.
- Collision uses the current outline in both modes.
- The pass is skipped at low quality even if the setting is on, and the settings
  screen says so.
- No new asset files.

The shaded-face idea is a proposal. The owner may prefer a different polish,
such as stronger existing glow. Do not implement until they pick.

## Do

After the decision:

- Implement the pass behind one setting check, in the existing draw functions.
- Do not change default quality and do not delete an effect.
- Capture matched screenshots, setting off and on, same camera and seed.
- Record a short play session with browser, hardware, viewport, quality, and
  entity counts, setting off and on. Report frame times. This session does not
  close issue 001.
- Owner reviews the pictures. The issue is not done on agent taste.

## Acceptance criteria

- [ ] The approved extra detail exists and can be turned off.
- [ ] The default image matches the current game.
- [ ] Hit detection matches the outline in both modes.
- [ ] Low quality does not run the heavier pass, if that limit was approved.
- [ ] Before and after captures and a frame-time note are attached to this issue.
- [ ] The owner accepts the on state, or the setting ships defaulting off while
      the art is revised.

## Open questions

- Is the extra detail for the player ship only, so enemies stay visually cheaper?
- Should the README screenshot ([issue 031](031-readme-screenshot.md)) stay on
  the default look? The proposal is yes.

## Dependencies

Independent of music and of mobile. Do not start while
[issue 001](001-performance.md) is being measured on the same machine, or the
two sessions will be confused. The feature may still be planned now.

[Issue 029](029-ship-stats-and-colors.md) owns mechanical hull changes. This
issue must not smuggle stats into a drawing pass.

## Implementation and validation

Not started. No files have been changed for this issue. No captures or frame
times have been taken.
