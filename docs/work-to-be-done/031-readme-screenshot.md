# 031 — Add a README screenshot

Status: Done

Implemented on `codex/031-readme-screenshot`. Owner accepted the screenshot
and WebP format on 2026-11-02. Remote GitHub rendering and image contents are verified.
No gameplay changes.

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

- [x] The README shows one real gameplay screenshot.
- [x] The alt text describes the image.
- [x] The file size is within the approved limit.
- [x] The image is not part of the published game package.
- [x] The owner has accepted that the picture represents the game.

## Open questions

- Is one image enough, or is a second image of the ship-select screen wanted?
- Should the README wait until [issue 036](036-graphics-polish.md)? The proposal
  is no. The screenshot should show the current approved look.

## Dependencies

None. Can be done at any time. It is ranked here because it does not affect
players who already have the game.

## Implementation and validation

Implementation choices (2026-11-02): agent captures a real local run at
1280×720 using default graphics, under 500,000 bytes in `docs/images/`.
One playfield image follows the opening paragraph; no ship-select image or
wait for issue 036. These are agent implementation choices under the owner’s
request to implement this issue. Owner acceptance of the actual image remains
required. No dependencies or image pipeline will be added.

Changed files: `README.md`, `docs/images/readme-playfield.webp`, and issue/index
records. Delivery also includes the bounded test-maintenance fix below; no
game code changed.

Image credit: real local gameplay captured by the agent on Windows using
Playwright Chromium 156.0.8078.4 at 1280×720, device scale 1, default graphics,
2026-11-02. Normal menu launch, movement keys, and firing only; no scene,
entity, camera, or quality modifications. A fresh automation browser context
was used; the owner’s browser data was untouched. No page errors observed.

Format decision: PNG captures were 745,504–827,688 bytes; lossless recompression
of the selected frame still exceeded 500,000 bytes. Browser-native WebP export
at quality 0.95 preserves the frame dimensions and uses 104,282 bytes. This
replaces the original PNG proposal without adding dependencies or an image
pipeline. Agent inspected the exported image for readable HUD and visible ship,
enemies, and projectiles.

README uses a repository-relative image link with descriptive alt text.
Validation (2026-11-02):
- PowerShell’s existing `ConvertFrom-Markdown` rendered the README locally.
  Chromium loaded its relative image link successfully as exactly one
  1280×720 image; alt text matched the Markdown. Agent inspected the WebP.
- `node tools/ci/package.cjs` passed; `dist/docs/images/readme-playfield.webp`
  does not exist. The README image is not linked from `index.html`.
- File size: 104,282 bytes, below the 500,000-byte limit.
- Owner approved the screenshot and WebP format as representative of the game.
- `git diff --check` passed. The mandatory pre-push suite passed syntax, lint,
  and unit checks; browser results were 149 passed and one Firefox failure at
  `coop-smoke.spec.cjs:334` (guest peer absent at the fixed four-second recovery
  assertion). The same recovery test then passed twice in isolation, with no
  game or test changes. The fresh complete pre-push run then passed: syntax,
  lint, all unit checks, and 150 browser tests (7.5 minutes).
- Implementation commit: `6e007e5`.

Owner delivery authorization (2026-11-02): commit, push, create PR, and merge.
GitHub validation: the branch README rendered the expected image and alt text.
The remote image is 104,282 bytes and its Git blob SHA matches the local file
(`afb89d3efe49068805d1241f3e33d71c670d22bb`). Implementation and test-evidence
commits: `6e007e5`, `2aaebae`.

Delivery test maintenance (agent choice, 2026-11-02): the final documentation
push hit the same Firefox assertion again. That failed run was stopped. The
host’s actual offline grace is 10,000 ms (`js/coop-host.js`); the fixture had
assumed negotiation completed at exactly four seconds. In
`tools/ci/coop-smoke.spec.cjs`, the test now observes a real peer loss, then polls
for both peers and active sessions within eight seconds of the drop. Existing
post-recovery assertions remain. This checks recovery inside the existing grace
without changing game behavior or manually forcing reconnection. The final
fixture passed twice per browser with four workers (four tests, 25.2 seconds).
A complete pre-push run passed before delivery; its result is recorded in the PR.

All screenshot acceptance criteria are verified.
[PR #35](https://github.com/taggedzi/neon-nexis/pull/35) merged as
`a6ba14c8f060e7fc83569f666778b10b4c7db368`. The current main image still has
the accepted 104,282 bytes and blob SHA `afb89d3efe49068805d1241f3e33d71c670d22bb`.
Its exclusion from both real public ZIPs is also verified by
[issue 033](033-github-release-packages.md#first-successful-publication).
