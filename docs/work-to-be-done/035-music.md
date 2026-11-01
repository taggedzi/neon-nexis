# 035 — Improve the music

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 19 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The current music feels like Atari 2600 Asteroids to the owner. It is not the
same piece, but the feel is similar. They want a more energetic arcade score,
or trance, house, techno, or chiptune.

## What exists today

`js/audio.js` synthesizes all audio with Web Audio. There are no music files and
no network audio. A scheduler walks 16-step bars and plays kicks, hats, a bass,
and pads through oscillators and noise, on a music bus. Scenes include menu,
game, paused, dead, and complete. Intensity and mute already exist. Settings
scale the music gain. Audio failures are contained so they cannot break play.
[Issue 013](013-deployment-and-changelog.md) records a past navigation bug around
audio resume. New music has to keep resume, suspend, and mute working.

The project rule is procedural, local assets. A streamed track or a copied
commercial song is out of bounds unless the owner brings a license and explicitly
changes that rule. This plan does not change it.

Feel cannot be marked done by an automated check. The owner has to hear it.

## Determine

- Which scene the owner means: the fight music, the menu, or both.
- Whether the "Asteroids" feel comes from the square waves, the tempo, the
  sparse arrangement, or all three. A short listening note from the owner is
  the spec.
- How many oscillators the current game scene uses at peak, so a denser
  arrangement can be compared. Count them from `playStep` rather than guessing
  a CPU cost.

## Decide

- One direction: arcade, trance, house, techno, or chiptune. Mixing all of them
  in one pass will not produce a score.
- Whether the current score remains available as a settings choice.
- Whether paused and dead scenes stay quiet relative to the fight.

Proposal, not approved:

- Keep synthesis. Do not add music files or a CDN.
- Write a new fight pattern in one approved style, and a calmer menu pattern in
  the same palette.
- Keep the current score selectable in audio settings until the owner says to
  remove it. Default becomes the new score only after they accept it.
- Leave sound effects alone in this issue.
- Paused and dead stay quieter than the fight, as they do now.

## Do

After the owner names the style:

- Replace or add patterns in `js/audio.js` only. Keep the scheduler, buses,
  mute, and scene hooks.
- Do not raise the default music gain to sell the new track.
- Browser-check: start a run, pause, resume, hide the tab, mute, and return to
  the menu. Confirm no console errors and that gameplay input still works when
  audio is blocked.
- Record the style, the default, and the owner's listening result in this issue.
  Automated tests can cover "the scheduler still runs". They do not cover taste.

## Acceptance criteria

- [ ] The owner has named the style.
- [ ] Fight and menu music follow that decision and still use local synthesis.
- [ ] Mute, pause, tab hide, and resume still behave.
- [ ] The previous score remains available if that option was approved.
- [ ] The owner has listened and accepted the default, or the default stays on
      the old score.
- [ ] No audio file or remote audio URL was added.

## Open questions

- Is a second intensity layer for boss fights wanted in the same issue?
- Should co-op guests hear their local score only, which is already how a
  client-side synth works?

## Dependencies

None on the other todo features. Do not combine this with
[issue 036](036-graphics-polish.md). They are separate reviews.
Audio lifecycle lessons from [issue 013](013-deployment-and-changelog.md) still
apply.

## Implementation and validation

Not started. No files have been changed for this issue. No listening session
has been run.
