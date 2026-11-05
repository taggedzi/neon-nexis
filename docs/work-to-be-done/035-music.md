# 035 — Improve the music

Status: Implemented — needs validation

## Current approved scope — 2026-11-05

The owner found the procedural revision better but below the intended musical
quality. They supplied six generated WAV tracks and authorized optional recorded
music, keeping the procedural score as fallback. This supersedes the earlier
procedural-only proposal below; that proposal is historical, not current scope.

Owner decisions:

- Keep soundtrack originals and conversions under ignored `assets/`; do not
  distribute them with the open-source repository or GitHub release ZIPs.
- Build the music-enabled website locally. Existing GitHub Actions cannot read
  ignored local files and remains music-free, including its Pages deployment.
- Discover WAV additions/removals during a scripted local website build, convert
  for browser delivery and generate the playlist automatically.
- Use code-generated music if the library is empty or recorded playback fails.
- Leave all changes uncommitted for owner testing.

Priority 19 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The current music feels like Atari 2600 Asteroids to the owner. It is not the
same piece, but the feel is similar. They want a more energetic arcade score,
or trance, house, techno, or chiptune.

## Procedural baseline before the recorded-music extension

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

## Earlier procedural investigation

- Which scene the owner means: the fight music, the menu, or both.
- Whether the "Asteroids" feel comes from the square waves, the tempo, the
  sparse arrangement, or all three. A short listening note from the owner is
  the spec.
- How many oscillators the current game scene uses at peak, so a denser
  arrangement can be compared. Count them from `playStep` rather than guessing
  a CPU cost.

## Earlier procedural choices

- One direction: arcade, trance, house, techno, or chiptune. Mixing all of them
  in one pass will not produce a score.
- Whether the current score remains available as a settings choice.
- Whether paused and dead scenes stay quiet relative to the fight.

Historical proposal, superseded by the owner decisions above:

- Keep synthesis. Do not add music files or a CDN.
- Write a new fight pattern in one approved style, and a calmer menu pattern in
  the same palette.
- Keep the current score selectable in audio settings until the owner says to
  remove it. Default becomes the new score only after they accept it.
- Leave sound effects alone in this issue.
- Paused and dead stay quieter than the fight, as they do now.

## Earlier procedural implementation plan

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

- [x] Ambient techno / arcade direction identified; recorded tracks supplied by owner.
- [x] Local website builds convert current WAVs and regenerate the playlist.
- [x] Added, changed and removed tracks are handled without publishing originals.
- [x] Default packages and GitHub release ZIPs exclude private music.
- [x] Recorded playback uses existing volume/mute and scene controls.
- [x] Empty libraries, missing/invalid tracks and rejected playback retain procedural fallback.
- [x] Chromium and Firefox validate playback and audio lifecycle.
- [x] Owner accepts the recorded soundtrack locally (2026-11-05: "I like it").
- [ ] Natural tab-hide behavior receives owner validation.
- [x] Pipeline, deployment distinction and soundtrack licensing boundary are documented.

## Scope boundaries

No additional gameplay decision blocks this implementation. A separate
boss-specific soundtrack is not included. Co-op participants use local playback
without audio synchronization, retaining the existing client-side ownership.

## Dependencies

None on the other todo features. Do not combine this with
[issue 036](036-graphics-polish.md). They are separate reviews.
Audio lifecycle lessons from [issue 013](013-deployment-and-changelog.md) still
apply.

## Implementation and validation

### Scope review — 2026-11-04

- Owner direction: keep code-generated music; use an ambient techno / arcade
  sound throughout the game and reduce repetition and listening fatigue.
- Pre-change source review: `js/audio.js` used bright square/sawtooth bass and
  arpeggios, an eight-bar root cycle, and the same rhythmic structure each bar.
- Proposed arrangement: soft evolving chords, rounded bass, restrained
  percussion, sparse phrases, and longer sections with deliberate space. This
  is an implementation proposal, not a listening approval.
- Owner decisions: replace the old score with no selector; combat uses a steady
  techno beat with ambient layers. This supersedes the old-score retention
  proposal above. Listening acceptance of this implementation remains pending.
- Repository checks: clean existing `codex/035-ambient-techno-music` branch;
  HEAD and local main match fetched origin/main; no open pull requests.

### Implementation

- Changed `js/audio.js`: replace the old patterns with locally synthesized
  filtered triangle pads, sine bass, sparse chord-tone phrases and echoes,
  four-on-the-floor combat kick, restrained hats and backbeat. Menu/complete
  use less percussion; paused/dead use quiet pads only. SFX and gain defaults
  are unchanged. Existing intensity feeds the arrangement; no separate boss
  system or co-op audio synchronization was added.
- Chords last two bars; eight-bar phrases vary bass/melody placement and octave,
  with an eight-bar thinner section in each 32-bar arrangement. This is a finite
  procedural arrangement with variation, not a claim that it never repeats.
- New voices have finite stops and disconnect on completion. Scheduler skips
  missed time after long mute/hidden-tab intervals instead of replaying it.
- Added `tools/check-audio.cjs` for scene output, finite lifetimes and recovery
  from hour-long simulated mute/hide intervals and suspension; added
  `tools/ci/audio-score.spec.cjs` for real Web Audio scene/mute/suspend checks
  and gameplay with audio initialization blocked.
- Mock scheduler comparison, 80 seconds per scene, same 40 ms ticking: old/new
  peak simultaneous scheduled oscillators: menu 6/8, game 8/9, paused 6/4,
  dead 6/4, complete 8/8. This counts oscillator lifetimes only, excluding
  noise/filter/gain nodes; it is not CPU, real-time performance or memory evidence.
- Focused audio unit check, changed-file ESLint and `git diff --check` passed.
  Windows headless full Chromium 156.0.8078.4 and Firefox 157.0 passed all four
  focused audio browser tests (2.2 minutes): scene playback, mute recovery,
  suspend/resume, no page errors, and movement/pause/resume with initialization
  blocked. No separate Google Chrome or physical audio-device check is claimed.
- Initial sandboxed full suite stopped at PHP startup. Outside the sandbox,
  syntax/lint/unit checks passed. The full browser run finished with 147/152
  passing in 9.2 minutes; five Chromium failures involved closed contexts and
  missing trace files. Agent error: the concurrent focused run reused the same
  artifact directory, interfering with traces. All five affected tests then
  passed in isolation with one worker (48.8 seconds). This is not a claim of
  one clean full-suite run. The four focused audio checks used the final
  scheduler change; full-suite discovery preceded the blocked-audio test addition.
- Remaining: owner listening acceptance and natural tab-hide review. The full
  suite also passed its synthetic hidden-document pause checks in both browsers;
  this does not establish real-device listening behavior. No owner saves or settings were cleared; browser tests use isolated
  profiles. No commits, push or publication.

### Optional recorded soundtrack — implemented, listening accepted

- Approval: owner request on 2026-11-05, including explicit local website builds
  with music-free GitHub release ZIPs. This supersedes the earlier procedural-only
  acceptance criteria and no-audio-file restriction for local website builds.
- Agent implementation choices: FFmpeg/libmp3lame, 192 kbps stereo MP3 at
  44.1 kHz; stream one HTML media element through the existing Web Audio music
  bus; shuffled playlist without an immediate repeat across bag boundaries.
  Paused/dead scenes attenuate music; mute, zero music/master gain, hidden tabs
  and audio suspension pause the recording while retaining its position.
- Converted the six owner WAVs: 414,572,640 source bytes to 51,820,507 MP3 bytes.
  Source WAVs are untouched. FFprobe verified all six outputs as MP3/192 kbps/
  44.1 kHz/stereo using FFmpeg 8.0 essentials (Gyan build). The owner accepted the listening result on 2026-11-05.
- Changed files: `tools/music.cjs`, `tools/ci/package.cjs`, `package.json`,
  `js/music-library.js`, `js/recorded-music.js`, `js/audio.js`, `index.html`,
  pipeline/browser regression checks and documentation. Owner's `.gitignore`
  exclusion for assets is preserved.
- Checks so far: syntax/lint, audio lifecycle and scheduler checks pass. Music
  pipeline fixtures pass outside the sandbox (the sandbox blocked a temporary
  rename): cache integrity, source changes/removals, encoder failure, selective
  pruning, no WAV/manifest leakage, music-free default builds and CI guard.
- Recorded-music focused validation: 10/10 staged-site tests passed in Windows
  headless full Chromium 156.0.8078.4 and Firefox 157.0 (39.7 seconds). Each browser
  decoded the beginning of all six actual MP3s with no page errors. Synthetic
  end events advance the actual tracks; generated three-second tone fixtures
  verify natural endings, shuffled cycles, mute/suspend/hidden-document recovery,
  empty libraries, missing tracks and rejected media autoplay.
- Test limitation: the first actual-track test attempted seeking to the end of
  six-minute files and timed out in both browsers. The test was changed to
  synthetic end events because the PHP fixture server does not promise byte-range
  seeking. This does not claim full-length listening or end-to-end seeking checks.
- Documentation: `docs/music.md`, README, and the development guide cover the
  two local commands, FFmpeg requirement, playlist refresh, upload boundary,
  fallback behavior and the separate music notice.
- Full `npm run check`: syntax, lint and all unit checks passed; browser suite
  finished 161/162 in 9.6 minutes. The one failure was Chromium co-op shot-credit
  test line 1336: guest stayed paused after advancing sectors (90-second timeout).
  Its isolated one-worker rerun passed (22.2 seconds). No co-op code was changed;
  no single clean full-suite run is claimed. Final cache validation fixtures,
  changed-file lint and whitespace checks also passed after the last small edits.
- Owner listening acceptance, 2026-11-05: "I like it. Please commit all the
  changes." This approves the soundtrack and authorizes local commits. It does
  not establish a specific tab-hide test or a full-length six-track run.
- Remaining: owner natural tab-hide validation; detailed loudness/transitions
  and extended playback are not separately measured. No separate Google Chrome
  or physical audio-device test is claimed.
- State: implemented, listening accepted; natural tab-hide validation remains
  pending. Delivery branch: `codex/035-ambient-techno-music`. Local commit
  authorized; no push, publication or deployment authorized.

### Delivery follow-up — 2026-11-05

- Initial implementation and owner listening acceptance committed as `c91e4b6`.
  The owner subsequently authorized pushing and merging through a PR.
- Pre-push run with four workers: 158/162 browser checks passed; four Chromium
  co-op setup/connection tests timed out. A CPU-limited two-worker attempt also
  failed multiplayer checks and was stopped; repository files were unchanged.
- Full-CPU two-worker run: 161/162 passed. All co-op checks passed, but Firefox
  recorded playback stayed procedural after a rapid suspend/resume sequence.
- Root cause reproduced deterministically in `tools/check-audio-lifecycle.cjs`:
  a resume arriving while suspend is pending sees a still-running context and
  gets dropped; the later completed suspension leaves audio suspended.
- Fix in `js/audio.js`: serialize context transition promises and reconcile the
  latest requested state after an opposing transition completes. Rejected
  transitions remain optional and do not create an automatic retry loop.
- Regression checks cover both pending-suspend/resume and pending-resume/suspend
  orderings. The new check failed against the old implementation and passes
  after the fix. Scheduler tests now await asynchronous context settlement.
- Checks: audio lifecycle and scheduler units pass; Firefox 157.0 recorded
  playlist/lifecycle check passed three consecutive runs (13.7 seconds).
  Final pre-push validation is pending; no hook or assertion is bypassed.
- Local test scheduling uses two workers with full CPU access via an ignored
  Node preload helper. It affects parallelism only, not checks or assertions.
  No tracked test configuration change or music publication is included.
