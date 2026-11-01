# 037 — Investigate mobile play

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 21 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The owner asked whether the game can be played on a phone, or whether a phone
can at least use a controller. It is a question, not a request to build a
mobile version yet.

## What exists today

The README support matrix is desktop Firefox, Chrome, and Chromium. It says the
matrix does not promise mobile devices. `index.html` has a viewport tag.
`#game` sets `touch-action: none` and hides the cursor. Those lines stop the
page from scrolling and do not add a control scheme.

Input is keyboard, mouse, and the Gamepad API, with remapping.
`js/input.js` listens for pointer press for aim and fire. There is no on-screen
stick, no touch-aim path, and no mobile layout review. Pointer lock from
[issue 019](019-pointer-lock-and-focus-pause.md) is a desktop request. Phones
do not use it the same way, and this issue must not depend on it.

Desktop performance is still open under
[issue 001](001-performance.md). A phone is a weaker GPU and a smaller screen.
The HUD, pause menu, and ship select were built for a desktop window.

Co-op needs WebRTC in the mobile browser and a way back to the tab when the
soft keyboard or OS chrome appears. That is untested.

## Determine

- On one phone the owner actually has, or a clearly labeled substitute: does a
  current mobile browser load the page, show the menu, and see a paired
  Bluetooth controller as a gamepad?
- Which actions the controller can reach: move, aim, fire, pause, menu focus.
- What fails without a controller: there is no touch move control, so failure
  is the expected result, not a bug to patch inside this investigation.
- Whether the menu fits the phone width without a horizontal page scroll.
  [Issue 002](002-ship-selection.md) already asked for a narrow viewport check
  and left part of that validation open. Use a real phone if one is available.
  A desktop window resized to 360 pixels is not a phone.

## Decide

This issue should end in a decision, not in a mobile port.

Possible outcomes:

- Controller-on-phone is good enough, and the README says so for the browser
  and device that were tried. Touch play stays unsupported.
- It is not good enough, and mobile stays explicitly unsupported.
- The owner wants a touch control scheme. That is a new feature with its own
  issue: on-screen move and aim, pause, and a HUD that fits. Do not start that
  design inside this investigation.

Proposal, not approved: do the device trial first. Do not build touch controls
unless the owner opens that follow-up after reading the trial notes. Do not add
mobile to the support matrix on the basis of a resized desktop window.

## Do

After the owner confirms a device is available, or confirms that none is:

- If a device is available: load the local or published site, try the menu and
  a paired controller, and write the browser, OS, and what worked into this
  issue. Then apply the decision above to the README in a follow-up only if
  the owner wants the wording changed.
- If no device is available: record that the trial did not happen, leave the
  README as it is, and leave this issue blocked on a device.
- Do not add a touch overlay, a manifest, or a store package in this issue.

## Acceptance criteria

- [ ] A real device trial is recorded, or the issue says no device was available.
- [ ] The trial states whether a controller could play, and which actions failed.
- [ ] The owner has chosen: document controller play, leave mobile unsupported,
      or open a separate touch-control issue.
- [ ] No touch-control code was added under this issue unless that separate
      issue was approved and is tracking it.

## Open questions

- Which phone and browser should be the trial device?
- Is a published Pages URL required, or is a local network URL enough?

## Dependencies

Last on the list because it is a question and the desktop game is the product.
[Issue 019](019-pointer-lock-and-focus-pause.md) must not be treated as the
mobile solution. [Issue 011](011-controller-parity.md) matters if the trial uses
a controller. Performance claims stay in
[issue 001](001-performance.md).

## Implementation and validation

Not started. No files have been changed for this issue. No phone trial has been
run.
