# 031 — Add a README screenshot

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 15 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The README describes the game and does not show it. A screenshot would let
someone see the neon playfield before they clone the repository.

## What exists today

`README.md` has no image. The playfield is procedural canvas, so there is no
promotional art file to reuse. `tools/ci/package.cjs` copies files linked from
`index.html`. A picture linked only from the README is not part of the game
package unless something else references it.

The look of the game is approved. A screenshot that does not match a real
frame would mislead. Generated concept art is not a substitute.

## Determine

- A representative moment: in a sector, ship visible, enemies visible, HUD
  readable, no pause menu covering the action. Confirm the owner agrees that
  moment is fair.
- The viewport and browser used for the capture. Record them next to the image
  credit in this issue.
- The file size. The repository should not gain a multi-megabyte PNG for one
  README image. Note the byte size before committing.

## Decide

- Who captures the frame: the owner during a normal run, or an agent on a local
  server. An agent capture still needs owner acceptance that it looks like the
  game.
- Format and max size. 
- Alt text.
- Whether the image lives at `docs/images/` or next to the README.

Proposal, not approved:

- One PNG captured from a real local session at 1280×720 or the owner's usual
  window, committed under `docs/images/readme-playfield.png`.
- README places it after the opening paragraph, with alt text
  "Neon wireframe ship fighting geometric enemies on a dark sector map."
- Keep the file under about 500 KB. If the capture is larger, re-export it.
  Do not add an image pipeline to the game.
- The image is not linked from `index.html`, so the Pages package does not
  include it.

## Do

After the decisions:

- Capture, check the bytes, add the image and the README markup.
- Confirm the relative link resolves on GitHub and in a local Markdown preview.
- Confirm `node tools/ci/package.cjs` does not copy the image into `dist/`.
- No game code changes. `git diff --check` for the Markdown. Binary image
  review is visual, by the owner.

## Acceptance criteria

- [ ] The README shows one real gameplay screenshot.
- [ ] The alt text describes the image.
- [ ] The file size is within the approved limit.
- [ ] The image is not part of the published game package.
- [ ] The owner has accepted that the picture represents the game.

## Open questions

- Is one image enough, or is a second image of the ship-select screen wanted?
- Should the README wait until [issue 036](036-graphics-polish.md)? The proposal
  is no. The screenshot should show the current approved look.

## Dependencies

None. Can be done at any time. It is ranked here because it does not affect
players who already have the game.

## Implementation and validation

Not started. No files have been changed for this issue. No screenshot has been
captured.
