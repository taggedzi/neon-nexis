# 033 — Publish both release packages from one process

Status: Implemented — needs validation

Owner approved the release flow and both MIT workflow actions on 2026-11-02.
Implementation and local validation are complete. The owner authorized delivery and one first real release on 2026-11-02;
the first attempt failed during job setup before any publication.

Priority 17 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The owner wants one release process that publishes both a minified and an
unminified package for download. Versions use the naming system already in the
docs. The todo's phrase "databased tagging" is read here as git tags plus the
existing version id, not as a new database. If that reading is wrong, the
decision section has to be answered before any workflow edit.

## Baseline before implementation

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

Original proposal (adjusted by the owner-approved flow recorded below):

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
- [x] No changelog was added unless issue 013's remaining changelog work was
      separately approved.
- [x] The browser suite passed against the artifact that Pages will serve.
      (Local fixture bytes verified; live workflow/deployment is still pending.)

## Resolved questions

Owner confirmed Git tags plus the existing date/run version, with no database.
Both ZIPs are always attached, even when Pages uses the unminified variant.
These decisions were approved on 2026-11-02.

## Dependencies

[Issue 032](032-production-minification.md) is merged; its packager supplies both variants.
Blocked on the still-open deployment validation in
[issue 013](013-deployment-and-changelog.md) only for the changelog. The
download assets can be specified before the first public Pages URL exists, but
they should not be turned on until the owner wants a real release.

[Issue 030](030-about-page.md) reads the same version stamp. It does not need
the GitHub Release to exist.

## Implementation and validation

Research (2026-11-02), based on merged main `a52f0fc`:
- Issue 032 is merged. Its existing packager emits `--minify` and `--no-minify`
  variants through the same `dist/` allowlist, with LICENSE, version metadata,
  no source maps, and no source-only development commands.
- `releaseVersion(date, runNumber)` is the sole formatter: New York date plus
  a four-digit workflow run number, rejecting numbers outside 1–9999. Both
  builds must share one frozen release date/version so crossing midnight
  cannot produce different archive versions.
- The existing Pages `minify` checkbox is owner-approved in issue 032; the
  proposed flow preserves it and always attaches both archive variants.
- Node v24.14.1 has built-in `zlib.crc32` and deflate support. ZIP creation can
  use existing Node facilities without a new npm dependency.

Owner-approved flow (2026-11-02): one manual dispatch on main; lightweight
Git tag equal to the version; two staged-site ZIPs named
`neon-nexus-<version>-min.zip` and `neon-nexus-<version>-full.zip`; no database;
Release body limited to version and commit; fail visibly if Release creation
fails after Pages, document manual recovery, and perform no automatic rollback.
Keep both downloads even when Pages uses the unminified choice. This is a
decision approved in chat. Implementation approval does not authorize
running the first real release; request that only after concrete reviewed work
is ready.

Owner-approved workflow dependencies:

| Action | Version | Pinned commit | License |
| --- | --- | --- | --- |
| actions/upload-artifact | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | MIT |
| actions/download-artifact | v8.0.2 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | MIT |

License sources checked at those exact tags:
[upload](https://github.com/actions/upload-artifact/blob/v7.0.2/LICENSE) and
[download](https://github.com/actions/download-artifact/blob/v8.0.2/LICENSE).
GitHub's repository API confirmed the download license after the web cache could
not retrieve that tag. Both actions use Node 24. They transfer the tested ZIPs
between jobs in the existing GitHub workflow; no new account or service is
proposed. The two approved actions are pinned in the workflow. No npm dependency was added.

Implementation:
- Existing packager now accepts an internal frozen release date; the wrapper
  uses the existing formatter and one date/run number for both variants.
- `release-packages.cjs` rejects non-manual/non-main contexts and existing tags
  before staging. It builds both public trees with issue 032's packager, writes
  deterministic ZIPs using Node's CRC32/deflate, and records file/archive hashes.
  Selected Pages bytes must match that archive's input tree exactly.
- `publish-release.cjs` checks the downloaded manifest against this workflow's
  repository, run number, date, and commit, then verifies both archive hashes.
  The API helper creates a lightweight tag (never updates one), creates a draft,
  uploads both ZIPs, verifies GitHub's asset digests and tag target, then publishes.
  Failure leaves Pages/tag/draft untouched and exits unsuccessfully. No rollback
  or automatic asset replacement is implemented.
- Workflow remains manual-only, fails on non-main, tests both staged variants,
  uploads the selected Pages tree and the two ZIPs plus an internal manifest,
  deploys Pages, then runs the Release job with `contents: write`. Other jobs
  do not gain content-write permission. Download artifacts are named per run
  and attempt. No changelog or generated release notes are added.

Local checks so far:
- Archive/unit fixtures passed for contents, CRC, empty/UTF-8 paths, frozen
  midnight version, main-only guards, Pages parity, corruption, and duplicate
  refusal. Mocked API checks passed for existing tags, creation races, upload
  failures, digest mismatch, changed tag, unexpected upload host, and no rollback.
- Independent Windows .NET ZIP reader opened both local fixture archives and
  verified every entry against the staged bytes (37 files each). This is a local
  fixture, not a release; its dates/names must not be recorded as a first run.
- Generated `release-assets/` trees are excluded from source ESLint just as
  `dist/` is; their bytes are validated separately. Initial lint flagged those
  generated browser files before this exclusion was added. Source syntax, lint,
  and all unit checks now pass; the source browser suite passed all 150 tests
  (7.4 minutes). Staged browser checks are running.
- The release wrapper’s minified site fixture passed all 150 browser tests in
  Chromium 156.0.8078.4 and Firefox 157.0 (7.6 minutes), including exact served
  bytes, runtime/manifest version, and public-command exclusion checks.
- The unminified site fixture passed all 150 browser tests in the same browsers
  (7.4 minutes), including served-byte, version, and exclusion checks.
- Final local `verifyPages` check passed: selected `dist/` file fingerprints
  matched the archive input, and both ZIP hashes matched the manifest.
- Environment: Windows, Node v24.14.1, headless Playwright browsers. These are
  local fixture checks, not actual hosted/GitHub publication or device checks.
- `git diff --check` passed. No live publication has been attempted.

Changed files: release workflow, packager, new release/context/archive/API helpers
and regression checks, ignore rules, development/README guidance, project
decisions, and issue/index records. Delivery branch:
`codex/033-github-release-packages`.

Repository setup check (read-only, 2026-11-02): authenticated viewer has ADMIN
permission on the public repository. Pages and the `github-pages` environment
both returned HTTP 404, so first-publication setup is still required. No setup
was changed. Static Pages does not supply the PHP introduction service; co-op
browser checks use the CI-only fixture and do not prove hosted co-op.

Owner authorization (2026-11-02): commit, push, create PR, merge, configure
Pages in this existing repository, and run one first public Publish workflow.
No additional account is authorized or needed.

First publication attempt (2026-11-02 America/New_York):
- Implementation merged as PR #37, main commit `4ed91f64245a2bcf70e8752d3565b2d3e76b68b7`.
- Configured Pages with workflow builds and its automatically created
  `github-pages` environment restricted to main. Configured target URL:
  https://taggedzi.github.io/neon-nexis/ (not yet verified as deployed).
- [Run 41572454707](https://github.com/taggedzi/neon-nexis/actions/runs/41572454707),
  workflow run number 1, failed during prepare job setup. The existing composite
  Pages uploader internally calls `actions/upload-artifact@v4`, rejected by the
  repository's full-commit-SHA policy. Deployment and Release jobs were skipped;
  no version was generated, tag created, or site/download published.
- Follow-up branch `codex/033-pages-artifact-pinning` replaces that composite
  with its tar format and the already approved, SHA-pinned upload action. The
  security policy stays intact; no dependency or service is added.
- Local Windows tar does not support GNU's `--hard-dereference`; the equivalent
  portable archive command passed an independent Python tar reader comparison
  of all 37 regular files against `dist/`. The workflow retains GNU flags for
  Ubuntu. Exact Ubuntu execution remains pending the next authorized run.
- The pinned uploader is a Node 24 action with no nested actions. All workflow
  action references use full commit SHAs. `git diff --check` passed.

First successful version and download/deployment verification remain pending.
The owner authorized one attempt; request another dispatch after merging the fix.
