# 019 — Lock the pointer and pause when focus leaves

Status: Done

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

Accepted 2026-11-01:

- Capture is a setting, default on: "capture pointer while playing". The owner
  chose the default. An older settings blob with no such field stays valid and
  loads as on. An explicit off stays off.
- A primary click on the playfield requests pointer lock when the browser
  allows it. Touch does not request it.
- The pointer releases as soon as pause opens. The owner chose that. Leaving
  play for any other screen releases it too, so menus stay clickable. Esc is
  still the browser's unlock key. If the browser eats that Esc, the unlock
  itself opens the normal pause menu through `G.pauseGame`. The remapped pause
  action is unchanged.
- The release line is visible when capture first succeeds, on the pause screen
  while capture is on, and the first time a request is denied:
  "PAUSE OR ESC RELEASES THE POINTER." A denial also says that leaving the
  window still pauses.
- Blur, or a hidden document, during play calls `G.pauseGame` even when capture
  is off or was denied.
- In co-op, that same `G.pauseGame` path sends the existing shared-pause
  request. There is no second pause flag.

Pointer lock cannot be forced. A denied request still pauses when focus leaves.

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

- [x] During play, the player can capture the pointer when the browser allows it.
- [x] The release control is visible and returns the pointer without a fight.
- [x] Leaving the browser during single-player play pauses the run.
- [x] Returning does not leave movement or fire stuck on.
- [x] Co-op pause still follows the shared pause rules.
- [x] A browser that denies pointer lock still pauses when focus leaves.
- [x] Keyboard, mouse, and controller paths that already pause still work.

## Open questions

Resolved by the owner on 2026-11-01. See Decide. No open questions remain.

## Dependencies

None for the single-player path. Co-op behavior must follow
[issue 014](014-coop-lobby-and-revival.md). This is independent of
[issue 037](037-mobile-play.md). Pointer lock is a poor fit for touch, so mobile
must not depend on it.

## Implementation and validation

Changed files: `js/input.js`, `js/game.js`, `js/ui.js`, `js/util.js`, `index.html`,
`css/style.css`, `tools/ci/pointer-lock.spec.cjs`, `tools/ci/coop-smoke.spec.cjs`,
`tools/check-firing.js`, `tools/check-driving.js`, `tools/check-controller.js`,
`tools/check-settings-load.cjs`, `tools/check-settings-paths.cjs`,
`docs/decisions.md`, `docs/work-to-be-done/README.md`, this issue.

Implementation notes:

- `capturePointer` defaults on and is stored with the other settings. A blob
  that omits it still loads, and storage is not rewritten just to add the field.
- A trusted primary click on `#game` during play requests pointer lock. Touch
  and untrusted clicks do not. While locked, aim follows pointer movement
  deltas inside the viewport.
- Leaving play calls `Input.releasePointer`. If the browser drops Esc, the
  unlock opens pause through `G.pauseGame`. The next Esc can still leave pause.
- The first successful lock shows "POINTER CAPTURED. PAUSE OR ESC RELEASES IT."
  The pause screen shows "PAUSE OR ESC RELEASES THE POINTER." while capture is
  on. The first denial shows "POINTER CAPTURE DENIED. LEAVING THE WINDOW STILL
  PAUSES."
- Blur and a hidden document call `G.pauseGame`. Focus return, pause, and
  resume clear movement and fire. Resume requires a neutral stick again.
- Co-op focus loss uses `G.pauseGame`, which already requests the shared pause.

Implementation commit: `244c144`.

Checks and results, 2026-11-01, Windows, Node from `npm run check`:

- `npm run check` passed. Browser step: 102 passed, about 4.6 minutes.
  Playwright Chromium 156.0.8078.4 and Firefox 157.0.
- `tools/ci/pointer-lock.spec.cjs` passed on both browsers: default and saved
  off, lock, movement while locked, Esc release, pause hint, held fire cleared
  across blur and resume, one denial notice, hidden document pauses.
- `guest focus loss uses the shared pause` passed on both browsers. Guest blur
  paused the guest and the host, and both reported `pauseState` `PAUSED`.
- Regression counts on both browsers: firing 54, driving 33, controller 48.
  Those cover focus-loss pause, cleared keys, and a neutral stick after the
  pause. The existing smoke test still pauses with Esc and continues.

Automated checks dispatched blur and visibility in the page, and the stick
check used the synthetic pad in `tools/check-controller.js`.

Owner validation, 2026-11-01: the owner played the feature and approved the
implementation. They reported that it worked well.

Remaining work at original delivery: none; see the follow-up below.

### Follow-up: crosshair resets on repeated firing (2026-11-01)

Owner report: after moving the captured pointer, starting fire again jumps the
crosshair to an unwanted position. Investigation found that `onPointerDown`
copies `clientX/clientY` even while pointer lock holds those coordinates at the
original capture point. Relative pointer movement already maintains virtual aim.

Implementation choice: retain the virtual aim on button presses while locked;
keep absolute click coordinates when unlocked, including touch and capture-off.
This follows the owner's request to fix aim jumps without changing controls.

Changed files: `js/input.js`, `tools/ci/pointer-lock.spec.cjs`, this issue,
and the backlog index.

Validation on 2026-11-01, Windows:

- Before the fix, the new repeated-firing test failed in both Chromium and
  Firefox: a fresh press reset virtual aim to the capture point `(400, 420)`.
- After the fix, the focused pointer-lock suite passed all 14 tests. It checks
  three press/release cycles without aim movement, plus existing lock, pause,
  focus-loss, denied-capture, and capture-off behavior. No page/console errors.
- `npm run check` passed syntax, lint, unit checks, and all 108 browser tests
  (browser phase 4.4 minutes). Playwright Chromium 156.0.8078.4 and Firefox
  157.0; Google Chrome and physical controller checks were not run separately.
- `git diff --check` passed.

Owner gameplay validation, 2026-11-01: the owner confirmed the fix
"works perfectly." The reported crosshair reset is resolved.

Remaining validation for this follow-up: none.
Branch: `codex/fix-pointer-lock-aim-reset`. Changes are uncommitted.
