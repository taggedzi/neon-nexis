# 019 — Lock the pointer and pause when focus leaves

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 3 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

On a multi-monitor desktop, a click outside the browser can hit another
window, a bookmark, or a menu while the run keeps going. The player then has
to recover the pointer while the game is still live.

The request is:

- Capture the pointer in the game when that is possible.
- Make the release obvious and quick.
- If focus leaves the browser or the game, pause automatically.

## What exists today

`js/input.js` treats window blur as "unfocused". Blur clears movement, pad
state, and fire. It does not pause the run. Focus sets unfocused back to false.
Hiding the tab also clears movement and fire.

`js/game.js` on `visibilitychange`: when the document is hidden during play, it
writes a silent checkpoint and suspends audio. It does not pause. Becoming
visible resumes audio. A click on another monitor usually blurs the window. It
does not hide the document, so the sim keeps running.

`G.pauseGame` is the normal pause path. In co-op it calls `N.Coop.onPause`,
because pause is shared and server-owned. See
[issue 014](014-coop-lobby-and-revival.md).

`#game` uses `cursor: none` and `touch-action: none`. There is no
`requestPointerLock` call. Escape already opens pause through the existing
input map.

## Determine

- Which browsers in the support matrix allow Pointer Lock on the canvas, and
  what gesture they require before the lock starts.
- Whether Escape both exits pointer lock and opens the existing pause menu, or
  whether the browser eats the first Escape.
- What a second monitor click does in Firefox and Chromium: blur only, or blur
  plus something else.
- How co-op shared pause behaves if the guest's window blurs while the host is
  still playing. The guest must not locally freeze a match the host still owns,
  and the host must not leave guests simulating a paused world.

## Decide

- Is pointer lock on by default during play, or a setting that starts off?
- What text tells the player how to release the pointer? It has to be visible
  before they feel stuck.
- Does loss of focus always pause, even when pointer lock is off or was denied?
- In co-op, does focus loss request the shared pause, or only stop local input
  until the existing shared-pause rules answer?

Proposal, not approved:

- Add a setting, default on, "capture pointer while playing".
- A click on the playfield requests pointer lock. Escape releases it and opens
  the normal pause menu. A one-line hint is on the pause screen and the first
  time lock is denied.
- Blur or a hidden document during single-player play calls `G.pauseGame`.
- In co-op, focus loss uses the existing shared-pause request. It does not
  invent a second pause flag.

Pointer lock cannot be forced. A denied request still needs the pause-on-blur
behavior.

## Do

After the decisions:

- Request and exit pointer lock from the existing input module. Do not add a
  second hard-coded key path. Escape stays the remapped pause action.
- Route auto-pause through `G.pauseGame` and the co-op pause contract.
- On pause, resume, and focus return, clear stuck movement and fire the same
  way blur already does. Require a neutral stick before movement resumes, as
  the control reference already tells the player.
- Persist the setting with the other settings. Keep an old settings blob valid.
- Browser-check single player and co-op: lock, Escape release, click outside,
  Alt-Tab, denied lock, pause, resume, and firing that must not stick.

## Acceptance criteria

- [ ] During play, the player can capture the pointer when the browser allows it.
- [ ] The release control is visible and returns the pointer without a fight.
- [ ] Leaving the browser during single-player play pauses the run.
- [ ] Returning does not leave movement or fire stuck on.
- [ ] Co-op pause still follows the shared pause rules.
- [ ] A browser that denies pointer lock still pauses when focus leaves.
- [ ] Keyboard, mouse, and controller paths that already pause still work.

## Open questions

- Should the pointer stay captured on the pause menu, or release as soon as
  pause opens?
- Is a setting default of on acceptable, or should capture start off until the
  player opts in?

## Dependencies

None for the single-player path. Co-op behavior must follow
[issue 014](014-coop-lobby-and-revival.md). This is independent of
[issue 037](037-mobile-play.md). Pointer lock is a poor fit for touch, so mobile
must not depend on it.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
