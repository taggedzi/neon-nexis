# 032 — Minify the production package

Status: Done

Owner approved the proposed dependencies and packaging scope on 2026-11-02.
Implementation and local validation are complete. Commit/PR/merge delivery
remains owner-controlled; no publication has been performed.

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

- [x] A production staging path can emit minified HTML, CSS, and JS.
- [x] A staging path can still emit the unminified copy.
- [x] Local play from the repository root still needs no build.
- [x] The browser suite passes against the minified output.
- [x] Sizes before and after are recorded.
- [x] `LICENSE` and the version stamp are still in the package.
- [x] No image tool was added unless the package gained images.

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

Research (2026-11-02), based on merged main `a6ba14c` after issue 031:

| Staged type | Files | Bytes before minification |
| --- | ---: | ---: |
| JavaScript | 32 | 537,921 |
| CSS | 1 | 37,850 |
| HTML | 1 | 28,054 |

`node tools/ci/package.cjs` passed. The staged set contains no images. The README
WebP is excluded. The existing publisher is `.github/workflows/release.yml`;
local play still uses source files with no build.

Owner-approved scope (2026-11-02): add pinned build-only `terser@5.51.2`,
`clean-css@5.3.3`, and `html-minifier-terser@7.2.0`. Use the existing packager,
keep separate scripts and load order, disable property renaming, default Publish
to minified with an unminified workflow switch, publish no source maps, and keep
`LICENSE`, `release.json`, and `.nojekyll`. Do not add an image toolchain.
The owner explicitly approved the dependency versions, licenses, and scope in chat.

Direct license files checked:
- [Terser: BSD-2-Clause](https://github.com/terser/terser/blob/master/LICENSE)
- [Clean-CSS: MIT](https://github.com/clean-css/clean-css/blob/master/LICENSE)
- [HTML-Minifier-Terser: MIT](https://github.com/terser/html-minifier-terser/blob/master/LICENSE)

The following versions/licenses were read from npm metadata by following the
proposed dependency ranges without installing packages. This is a pre-install
review, not a claim about a future lockfile. Verify the resolved lockfile after
approval; retain tool license notices in the development installation. No tools
or their dependency trees are intended to be copied into the public artifact.

| Package | Resolved metadata version | License |
| --- | --- | --- |
| @jridgewell/gen-mapping | 0.3.13 | MIT |
| @jridgewell/resolve-uri | 3.1.2 | MIT |
| @jridgewell/source-map | 0.3.11 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| acorn | 8.19.0 | MIT |
| buffer-from | 1.1.2 | MIT |
| camel-case | 4.1.2 | MIT |
| clean-css | 5.3.3 | MIT |
| commander | 10.0.1 | MIT |
| commander | 2.20.3 | MIT |
| dot-case | 3.0.4 | MIT |
| entities | 4.5.0 | BSD-2-Clause |
| html-minifier-terser | 7.2.0 | MIT |
| lower-case | 2.0.2 | MIT |
| no-case | 3.0.4 | MIT |
| param-case | 3.0.4 | MIT |
| pascal-case | 3.1.2 | MIT |
| relateurl | 0.2.7 | MIT |
| source-map | 0.6.1 | BSD-3-Clause |
| source-map-support | 0.5.21 | MIT |
| terser | 5.51.2 | BSD-2-Clause |
| tslib | 2.9.1 | 0BSD |

Implementation notes:
- Installed only the three approved direct tools, pinned exactly. Resolved
  lockfile licenses match the review; npm reported 0 vulnerabilities.
- `package.cjs --minify` strips comments/whitespace while keeping separate
  scripts, identifiers, and properties (`compress: false`, `mangle: false`).
  CSS uses Clean-CSS level 0; HTML preserves conservative whitespace. Default
  staging and `--no-minify` preserve the unminified path.
- Publish has a boolean `minify` input defaulting to true. Local play is unchanged.
- Validation gap found: `serve-php.cjs` ignored `SERVE_DIR`. It now selects
  the requested public document root with a CI-only PHP router for the existing
  co-op fixture endpoint. Public files cannot fall back to source. The source
  dev scenario becomes a public-command-exclusion check for staged suites.
  Smoke tests compare served HTML, CSS, and JS with the exact staged bytes.
- `tools/check-package.cjs` exercises both modes, allowlist, load order, license,
  source isolation, syntax, invalid flags, size reductions, and release stamps.
  These checks, ESLint, PHP router syntax, and `git diff --check` passed.

First local trial (development stamp, same source files):

| Type | Before bytes | Minified bytes |
| --- | ---: | ---: |
| JS | 537,921 | 455,614 |
| CSS | 37,850 | 37,298 |
| HTML | 28,054 | 23,791 |
| Total | 603,825 | 516,703 |

Reduction: 87,122 bytes (14.43%). LICENSE and release metadata are additional
unchanged files; source maps and images are absent. This is a transfer-byte
comparison, not a performance measurement.

Changed files: package manifests, packager, release workflow, CI server/router,
package and browser checks, development/README guidance, project decisions, and
issue/index records.
Validation so far (Windows, Chromium 156.0.8078.4, Firefox 157.0):
- Full source `npm run check` passed syntax, lint, all unit checks, and 150
  browser tests (7.6 minutes for the browser suite).
- Full browser suite against the actual minified snapshot passed: 150 tests,
  7.5 minutes. Served HTML/CSS/JS matched the staged files; runtime version
  matched `release.json`; the public build excluded development commands.
- Full browser suite against the actual unminified snapshot passed: 150 tests,
  7.7 minutes. The same served-byte, version, and public exclusion checks passed.
- Targeted local release-fixture checks passed in both browsers for both package
  modes: runtime version and About display matched the generated release version;
  development commands stayed absent. This used a local fixture run number, not
  a dispatched workflow or published release. `dist/` was then restored to a
  minified development build.
- Environment: Windows, Node v24.14.1; headless Chromium and Firefox versions
  above. PHP 8.4.13 router syntax passed. No code changes followed the source and
  staged suite runs. Final `git diff --check` passed.

All acceptance criteria and both staged-suite checks are supported by the
results above. These were local checks at implementation time; subsequent real
GitHub publication, public bytes, and both ZIPs are verified in
[issue 033](033-github-release-packages.md#first-successful-publication).
Separate stable Google Chrome/device checks are not claimed.
Owner explicitly authorized commit, push, PR creation, and merge on 2026-11-02.
Delivery branch: `codex/032-production-minification`.
[PR #36](https://github.com/taggedzi/neon-nexis/pull/36) merged as
`a52f0fc58425dee739446627ab3f78d0ae96654e`. No issue 032 work remains.
