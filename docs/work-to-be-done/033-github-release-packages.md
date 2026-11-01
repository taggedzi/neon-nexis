# 033 — Publish both release packages from one process

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 17 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The owner wants one release process that publishes both a minified and an
unminified package for download. Versions use the naming system already in the
docs. The todo's phrase "databased tagging" is read here as git tags plus the
existing version id, not as a new database. If that reading is wrong, the
decision section has to be answered before any workflow edit.

## What exists today

[Issue 013](013-deployment-and-changelog.md) defines the release policy:

- One manual `workflow_dispatch` on `main` publishes the site.
- Merges do not publish.
- The version is `YYYY.MM.DD.####`, America/New_York date plus a four-digit
  release-workflow run number that does not reset each day.
- There is no rollback procedure during development.
- A changelog waits until a deployment has been validated. That validation is
  still open on issue 013.

`.github/workflows/release.yml` checks out main, runs syntax, lint, unit tests,
`node tools/ci/package.cjs`, then the browser suite against `dist/`, then
uploads a Pages artifact and deploys it. The workflow's contents permission is
read. It does not create a GitHub Release, upload zip files, or push a tag.

`package.cjs` writes one `dist/` tree. It does not write a second, minified tree.
That split is [issue 032](032-production-minification.md).

## Determine

- The exact version function in `tools/ci/release-version.cjs`, so the tag uses
  that string and not a second formatter.
- Whether a GitHub Release can be created from the same workflow after Pages
  deploy, and which token permission that needs (`contents: write`).
- What "databased tagging" means to the owner if it does not mean git tags.
- Whether issue 013's "changelog after the first real deployment" is satisfied
  before this issue adds release notes. Do not invent a changelog here.

## Decide

- One dispatch does both Pages and the two download zips, or downloads are a
  separate dispatch. The request says one process.
- Tag name equals the version string, annotated or lightweight.
- Asset names, for example `neon-nexus-<version>-min.zip` and
  `neon-nexus-<version>-full.zip`.
- What the full zip contains: the staged site, or the whole git tree. The
  staged site is the game. The git tree includes docs and tests the player does
  not need.
- What happens if Pages deploy succeeds and Release creation fails. The issue
  013 note is that there is no rollback. The workflow should still fail visibly
  and leave a written recovery step, not a silent half-release.

Proposal, not approved:

- Keep a single manual dispatch on `main`.
- After the existing tests pass, stage both outputs from issue 032, deploy the
  minified site to Pages, then create a git tag and a GitHub Release for that
  version.
- Attach two zips of the staged sites, not of the repository.
- Do not add a database.
- Do not add a changelog file in this issue. The Release body can be the version
  and the commit id until issue 013's changelog work is approved.
- Do not claim a rollback. If the Release step fails after Pages went out, the
  run is red and the owner decides whether to republish. The workflow must not
  delete the Pages deploy automatically.

## Do

After issue 032 can emit both trees, and after the decisions above:

- Extend `release.yml` and the packager together. Permissions rise only as far
  as creating the tag and Release.
- Refuse to run if the ref is not `main`, as the workflow already does.
- Refuse a tag that already exists.
- Verify the two zips each contain `index.html`, the stamped version, and
  `LICENSE`, and that the minified zip is the one Pages received.
- Record the first real run's version and URLs in this issue. Do not invent a
  version before that run.
- Leave local play unchanged.

## Acceptance criteria

- [ ] One manual dispatch on main produces the Pages site and both downloads.
- [ ] The version on the tag, the Release, the stamped JS, and `release.json`
      is the same `YYYY.MM.DD.####` value.
- [ ] The minified and unminified archives are both downloadable from that Release.
- [ ] A second run does not overwrite an existing tag.
- [ ] No changelog was added unless issue 013's remaining changelog work was
      separately approved.
- [ ] The browser suite passed against the artifact that Pages will serve.

## Open questions

- Does "databased tagging" mean anything besides git tags and the version id?
- Should the unminified archive be omitted when the publisher chose an
  unminified Pages deploy?

## Dependencies

Blocked on [issue 032](032-production-minification.md) for the two artifacts.
Blocked on the still-open deployment validation in
[issue 013](013-deployment-and-changelog.md) only for the changelog. The
download assets can be specified before the first public Pages URL exists, but
they should not be turned on until the owner wants a real release.

[Issue 030](030-about-page.md) reads the same version stamp. It does not need
the GitHub Release to exist.

## Implementation and validation

Not started. No files have been changed for this issue. No release has been run.
