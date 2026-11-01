# 032 — Minify the production package

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 16 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The owner wants a production package that minifies JavaScript, CSS, HTML, and
images, drops files the site does not need, and stays as small as practical.
Deployment without minification must remain possible. Minification is
recommended for production, to reduce transfer size. It is not required for
local play.

## What exists today

Local play is source files and a static server. No build is required. The README
says that on purpose.

`tools/ci/package.cjs` stages `dist/` for GitHub Pages. Its first comment says
minification remains a separate decision. The script copies `index.html`, the
JS and CSS that file references, and `LICENSE`. It stamps `N.RELEASE_VERSION`
and writes `release.json` and `.nojekyll`. It does not copy `docs/`, tests, or
`node_modules`. There is no raster image in that set today. Art is procedural.

[Issue 013](013-deployment-and-changelog.md) deferred minification. The Publish
game workflow runs checks against `dist/` and uploads that directory. Adding a
minifier is a build step. Project rules require a concrete need and a
discussion before a new pipeline. This todo is that discussion. It is not
approval to add the tool yet.

The client uses classic scripts, a shared `window.NEON` object, and a fixed
load order. A minifier that renames properties across files will break the game
unless it is configured for that pattern or the files are bundled first.
Bundling is a larger change than shortening whitespace.

## Determine

- Byte size of today's `dist/` JS, CSS, and HTML, so the saving is measured
  rather than assumed.
- Whether any file linked from `index.html` is an image. If none, there is no
  image minification to do. Do not add an image toolchain for files that do not
  exist.
- Which minifier can shorten JS without renaming `NEON` properties across
  separate scripts. Confirm with a small trial on a branch, then throw the trial
  away or keep it only if this issue is approved.
- That the unminified path still means "serve the repository root", not a second
  hidden build.

## Decide

- Whitespace-only minify of separate files, or a bundle plus minify.
- Whether production Pages uses the minified output by default.
- How a publisher chooses the unminified package. A workflow input is the
  obvious switch. Local play stays unminified with no flag.
- Source maps: on, off, or only in the unminified package. Maps make debugging
  easier and can undo the size win if they are published beside the code.
- Legal header: `LICENSE` stays in the package even when JS comments are stripped.

Proposal, not approved:

- Keep local play as source files with no build.
- Add an optional minify step after the current copy in `package.cjs`.
- Default the Publish workflow to minified. A workflow input can stage the
  copied files unchanged.
- Minify by compressing each JS file without cross-file property renaming.
  Do not bundle in this issue.
- Do not add an image minifier until the package contains images.
- Publish no source map in the Pages artifact.
- Keep `LICENSE`, `release.json`, and `.nojekyll`.

This proposal needs owner approval because issue 013 left minification deferred
and because it changes the published bytes.

## Do

After the decisions:

- Implement the chosen step in the existing packager. Do not add a second
  deploy path.
- Run the browser suite against the minified `dist/`, the same way Publish
  already tests `SERVE_DIR=dist`.
- Run it again against an unminified `dist/` if both outputs exist.
- Record byte sizes before and after for HTML, CSS, and JS.
- Confirm script order and the version stamp still work. Confirm a renamed
  property did not break `NEON`.
- Leave README's "no build to play" statement true.

## Acceptance criteria

- [ ] A production staging path can emit minified HTML, CSS, and JS.
- [ ] A staging path can still emit the unminified copy.
- [ ] Local play from the repository root still needs no build.
- [ ] The browser suite passes against the minified output.
- [ ] Sizes before and after are recorded.
- [ ] `LICENSE` and the version stamp are still in the package.
- [ ] No image tool was added unless the package gained images.

## Open questions

- Is a bundler acceptable later if separate-file minify does not shrink enough?
- Should the unminified Pages option remain forever, or only until the minified
  path has survived one real deployment?

## Dependencies

[Issue 013](013-deployment-and-changelog.md) owns the current publisher.
[Issue 033](033-github-release-packages.md) wants both packages as downloads and
should consume this issue's two outputs. Do not build the release-asset work
by inventing a second minifier.

[Issue 021](021-dev-mode.md) must stay out of the minified public file if that
issue chooses a source-only command.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
No byte sizes have been measured yet.
