# Optional website soundtrack

The open-source game and GitHub release packages use synthesized music. The
owner's local website build can include separately licensed recorded music.
No backend, CDN, or runtime external service is required.

## Build and listen locally

Install Node development dependencies as described in the development guide.
Recorded music preparation also needs FFmpeg with its `libmp3lame` encoder on
PATH. Set `FFMPEG_PATH` to an executable path if necessary. FFmpeg is a local
tool requirement, not a bundled browser dependency. No FFmpeg is needed when
there are no WAV tracks, or when all conversions are already cached and valid.

Place source recordings directly in `assets/wav/`. Both `.wav` and `.WAV` work;
subdirectories are not scanned. Then run:

```sh
npm run build:website
python -m http.server 8000 --directory dist
```

Open [the local website](http://localhost:8000/) and enter the game normally to
unlock audio. This serves the prepared website, not your WAV originals. Source
play from the repository root continues to use procedural music; the source
registry is deliberately empty and is never modified by conversion.

`build:website` stages the existing public allowlist in `dist/`, minifies it,
converts the current WAV collection, and embeds only the generated MP3 paths.
It also includes PHP and `php/.htaccess` when the selected co-op config has
`enabled` set to boolean `true`; see the [website deployment guide](website-deployment.md).
An enabled co-op build contains private configuration and must not be shared
as a public download archive.
Upload the **contents of `dist/`** to the website host when you are ready. This
command builds files; it never uploads or publishes anything. Prefer a host
that serves MP3 as `audio/mpeg` and supports HTTP byte ranges for efficient
seeking. Relative paths work when the site is hosted under a subdirectory.

## Add, replace or remove tracks

Edit the WAV collection and run `npm run build:website` again. You do not edit
the playlist by hand. To prepare conversions without staging a website, use
`npm run music:convert`.

- Output is 192 kbps stereo MP3 at 44.1 kHz. MP3 is selected for broad browser
  playback support and a smaller download than WAV/FLAC. See the
  [MDN codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs).
  No loudness normalization, trimming, or source edits are performed.
- Source and encoding-profile hashes determine output names. Verified unchanged
  tracks are reused; changed or corrupted output is regenerated. Identical WAV
  content is included once. Source filenames are not embedded in the website.
- `assets/music/playlist.json` records the local conversion cache. The playlist
  is replaced only after all conversions succeed. Encoder errors fail the build
  visibly rather than silently shipping incomplete music.
- After successful conversion, obsolete converter-owned MP3 files are removed.
  WAV originals and other files are untouched. Staging recreates `dist/` so old
  tracks cannot remain in the next local website output. When uploading, remove
  stale files from the host too; a copy-only upload cannot delete old hosted MP3s.
- Removing all WAV files creates a procedural-only website on the next build.
  Cached MP3s alone are not treated as the source collection.

## Playback and fallback

The game shuffles the collection, plays each available track once per cycle,
and avoids an immediate repeat across cycles when more than one track works.
One streaming HTML audio element feeds the existing Web Audio music bus, so
the entire soundtrack is not decoded into game-managed memory at startup.

Existing master/music sliders and mute apply to recordings. Paused/dead scenes
play more quietly; menu music is softer than combat. Muting, setting master or
music volume to zero, hiding the tab, or suspending audio pauses the current
recording and preserves its position. Scene changes do not restart the track.
Each co-op participant plays their own local soundtrack without synchronization.

Procedural music plays while recordings are loading or stalled, and when the
library is empty, tracks fail, or media playback is rejected. Broken tracks are
skipped for that page session; if all fail, playback stays procedural. Browser
autoplay rejection can be retried by the existing audio unlock/resume path.
Sound effects remain procedural. No track selector or skip control was added.

## Distribution boundary

The ignored `assets/` folder is not committed. WAV originals, cache metadata,
and source names are never copied into website output. Only explicitly opted-in
website staging includes converted MP3s and a notice excluding them from the
source code MIT license. The owner is responsible for having the required
rights to host the supplied tracks; this build does not establish those rights.

Normal `node tools/ci/package.cjs` builds exclude all assets and force an empty
music registry, even when private tracks exist locally. Both GitHub release ZIPs
therefore remain music-free. `--with-music` is explicitly local and rejected
inside GitHub Actions. The existing Publish workflow is unchanged: its Pages
site also remains music-free. Use local website staging for the music-enabled
site; dispatching the existing workflow does not upload your local soundtrack.

Ignoring files keeps them out of Git; it does **not** make website media private.
Visitors can retrieve recordings hosted for browser playback. Source archives
and music-free game packages still contain the procedural fallback code.

## Validation

`npm run check` includes conversion-cache/package fixtures and browser tests
using generated in-memory tones. They require no private tracks or FFmpeg.
Pipeline fixtures cover additions/changes/removals, failed conversions, cache
integrity, selective cleanup and exclusion from default/release packages.

For optional checks of the actual local MP3s, first build the website, then run
the following in PowerShell:

```powershell
$env:SERVE_DIR = 'dist'
$env:MUSIC_SITE_TEST = '1'
npx playwright test tools/ci/recorded-music.spec.cjs --workers 1
Remove-Item Env:SERVE_DIR, Env:MUSIC_SITE_TEST
```

These checks decode the beginning of each actual track and advance through the
playlist using synthetic end events; short fixtures test natural track endings.
They do not substitute for listening or a full-length real-device playback run.
Run browser suites sequentially so they do not share an active artifact folder.
