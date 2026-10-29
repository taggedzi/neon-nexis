# 009 — Preserve auto-fire through item selection and interruptions

Status: Implemented — needs validation

## Problem and owner decision

Picking up an item with full slots opens a paused selection menu. After choosing
what to keep, enabled auto-fire has been cleared. Owner instruction (2026-10-29):
if auto-fire is on, keep it on until the player turns it off. This supersedes the
reset-on-interruption decision in 008. Preserve the session toggle across menus,
pause, focus changes, controller disconnects and run transitions. Switching firing
modes explicitly clears the toggle; reloading the page starts OFF as before.
Weapons remain inactive outside focused gameplay. Held fire still requires release
after interruptions; menu clicks must not toggle auto-fire.

## Acceptance criteria

- [x] Keeping or discarding an overflow item preserves enabled auto-fire and resumes firing.
- [x] Disabled auto-fire stays disabled after selection; explicit gameplay fire toggles it off.
- [x] Pause, inventory, level-up and focus interruptions preserve the toggle without firing in menus.
- [x] Held fire and controller edge/release safeguards still pass regression checks.

## Implementation and validation

- Root cause: `Firing.reset()` clears the toggle for all input interruptions,
  including both entering and leaving overflow selection.
- Changed files: `js/firing.js`, `js/ui.js`, `tools/check-firing.js`, tracker documents.
- Implemented: interruptions block physical holds while preserving the session
  auto-fire toggle. Changing firing mode explicitly clears the toggle.
- Earlier Node VM checks: 40 assertions passed. During issue 010 validation,
  the actual browser firing suite passed 53 assertions with isolated in-memory
  storage. It covered overflow keep/discard, disabled state, explicit OFF,
  pause, inventory, level-up, focus, run transitions, mode changes, remapping,
  synthetic controller edges/disconnect/reconnect and release safeguards.
- Issue 010 reward checks additionally covered held/toggle firing across its new
  deferred-choice tray. No gameplay exceptions were observed in the final browser
  checks; the console only reported the existing missing favicon.
- JavaScript syntax and `git diff --check` passed.
- Physical controller testing and owner review specifically of firing persistence
  remain pending. Checked criteria above have automated browser evidence; they do
  not claim physical hardware testing or owner approval of this separate issue.
- Shared-folder access was repaired by the owner on 2026-10-29, allowing this
  document and the index to be synchronized.

Implementation commit: `c6dbb82` (009 and 010).
