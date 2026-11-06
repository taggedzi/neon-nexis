# Development and releases

This is the approved initial CI/CD setup for the client-side game. Hosting is
GitHub Pages. Routine pushes are checked by a local pre-push hook. GitHub
Actions publishes only on manual request, and that publication runs the check
suite against the staged site. The first public deployment and both downloads
were verified on 2026-11-03 as
[2026.11.03.0004](work-to-be-done/033-github-release-packages.md#first-successful-publication).

## Local checks

Use Node.js 24 or newer. Node and npm are development tools only: players need
only their browser, and the game still runs without a build step.

```sh
npm ci --ignore-scripts
node tools/ci/install-hooks.cjs
npx playwright install chromium firefox
npm run check
```

`npm ci --ignore-scripts` skips lifecycle scripts, including the hook installer,
so run the install command once per clone. `npm install` without
`--ignore-scripts` runs it through the `prepare` script.

`check` runs syntax validation, ESLint correctness rules, Node regression checks,
and browser regression/smoke tests. Browser tests run side by side, up to 4 at
once. Co-op cases open several game pages each; increasing this limit exposed
an intermittent fourth-player join timeout during delivery. Linux browser
installation may also require `npx playwright install --with-deps chromium firefox`.

Existing compact source is not reformatted. The initial lint rules catch undefined
names, duplicate definitions, unreachable code, invalid `typeof`, unsafe finally
blocks and invalid superclass construction. They do not certify overall code
quality or security.

Browser tests use new disposable contexts and a loopback-only server on port
4173. They never open the owner's browser profile or clear existing browser data.
An occupied port causes failure rather than reusing an unknown server. Run tests
from the repository root. Reports/traces are local ignored artifacts.

Failure screenshots are captured automatically. Full tracing is opt-in because
recording every page snapshot also slows successful tests. To capture traces for
a diagnostic run in PowerShell, set `$env:NEON_TEST_TRACE = '1'`, run
`npm run test:browser`, then `Remove-Item Env:NEON_TEST_TRACE`. Failed tests retain
their traces under `test-results/`. Test discovery, assertions, timeouts, retries
and the two browser projects are the same in either mode.
Routine PHP connection/success logs are suppressed; startup, warnings and HTTP
errors remain visible. The diagnostic setting also restores the full server log.

Add Node regression scripts as `tools/check-*.cjs`; the runner discovers them.
Add browser regression scripts as `tools/check-*.js` and register their query and
result object in `tools/ci/regression.spec.cjs`. An unregistered script fails the check suite.
New Playwright `*.spec.cjs` tests in `tools/ci/` are discovered automatically.
Tests must fail when an assertion fails and use isolated browser storage.

The `pre-push` hook fetches `origin/main` when a branch is pushed. It rejects
the push when that branch does not contain `origin/main` or when it adds a
merge commit. It then runs `npm run check`. A failing check rejects the push.
Documentation-only branch pushes skip that suite after passing the sync guards.
Only root-level `.md` files, `.md` files under `docs/`, and `LICENSE` qualify.
Existing branches compare the old remote tip with the pushed tip; first pushes
compare against the merge base with freshly fetched `origin/main`. All updated
branches must qualify. Tags, unknown paths, failed comparisons, or uncommitted
code (including untracked code) keep the full suite enabled. Renames check both
the old and new paths. A documentation follow-up to an already pushed feature
branch can skip; a first push containing code changes cannot.
A push that only deletes a remote ref skips the hook. Tag pushes skip the
branch check and still run the suite. `git push --no-verify` skips the hook.

Pushes and pull requests do not run this suite on GitHub. The shared Actions
minutes stay available for other repositories. The manual **Publish game**
workflow still runs the checks against the staged `dist` files before it
deploys, and that is the only automated test run on GitHub.

## One branch, current with main

Work on one issue at a time. Fetch and fast-forward local `main` before
starting a branch, and start that branch from the local `main` commit. Do not
open a second branch while a pull request is open.

Before pushing, rebase the task branch onto `origin/main`. Do not merge `main`
into the task branch. Pull requests land on `main` by rebase, and a merge
commit on the branch cannot be rebased.

The files that conflict most often are the backlog index,
`docs/work-to-be-done/README.md`, and `package-lock.json`. Agents follow
[Stay current with main](../AGENTS.md#stay-current-with-main).

## One-time GitHub setup

After the owner merges the workflow, enable Pages with **GitHub Actions** as its
publishing source. Allow the `github-pages` environment to deploy from main.
Do not add a second required-reviewer approval: dispatching the release is the
single manual approval. Repository/account restrictions may override this.
Use the Pages URL GitHub supplies as the initial stable address. A custom domain
has not been selected. Changing origin later changes access to browser saves.

The owner controls delivery and publication and can explicitly delegate them.
The first publication was explicitly authorized and verified; that authorization
does not approve later releases. Merging never publishes.

## Publish a release

In GitHub Actions, open **Publish game**, choose **main**, and select **Run
workflow**. This is the one manual approval. Merging never publishes. A dispatch
on another branch skips publication. Only dispatch reviewed main commits.

The workflow installs locked development dependencies, runs syntax/lint/Node
checks, then stages both public variants using one frozen New York date and run
number. It rejects an existing tag before staging, runs both browser suites
against each staged variant, and verifies that the selected Pages tree matches
its archive's input bytes. Only then are artifacts uploaded and Pages deployed.
After Pages succeeds, a separate job creates the matching lightweight Git tag,
uploads both ZIPs to a draft GitHub Release, verifies their SHA-256 digests and
the tag target, and publishes the Release. Only that job gains `contents: write`.

Both downloads are staged games, not repository archives: index, local JS/CSS,
LICENSE, `release.json`, and `.nojekyll`. Both are always attached, regardless of
which Pages variant is selected. ZIP creation uses Node's existing facilities;
artifact transfer uses the owner-approved pinned MIT upload/download actions.
No database, changelog, generated notes, or automatic rollback is added. The
Release title/tag are the version; its body contains only version and commit.
The dispatch’s **Minify** checkbox defaults on. Clear it to publish the
unminified copy. Both choices use the same allowlist, version stamp, checks,
and deployment path. Separate scripts retain their load order, identifiers,
and shared properties; no bundling or source maps are published. LICENSE stays
in both outputs. Build-only minifiers are pinned in the development lockfile;
they are not runtime dependencies. No images are currently part of the game
artifact, so no image optimizer is installed.

For local staging and verification:

Optional local website soundtrack builds are documented in the
[music guide](music.md). Use `npm run build:website` to include recordings from
ignored `assets/wav/`; normal staging and the GitHub Publish workflow remain
music-free. The website build never publishes or uploads anything.

```sh
node tools/ci/package.cjs --minify
SERVE_DIR=dist npm run test:browser
node tools/ci/package.cjs --no-minify
SERVE_DIR=dist npm run test:browser
```

The environment assignment above uses POSIX shell syntax. In PowerShell, set
`$env:SERVE_DIR = 'dist'` before the browser command, then remove it with
`Remove-Item Env:SERVE_DIR` afterward. Staging recreates only `dist/`; source
play needs neither this command nor Node. Omitted flags preserve unminified
staging. Browser tests serve the exact public directory; the co-op PHP endpoint
comes from the test fixture, not the public artifact. Repository documents,
tools, development commands, and local files remain excluded.

Versions use `YYYY.MM.DD.####`: the date in `America/New_York` and the release
workflow's run number padded to four digits, without a daily reset. Failed runs
can leave gaps. Re-running the same workflow run keeps its run number; across
midnight its date can change. Publication stops rather than producing a number
longer than four digits after run 9999; revise the convention before that limit.
Workflow renames/replacements must preserve version uniqueness.

`dist/release.json` records the release version and source commit. The staged
game exposes `NEON.RELEASE_VERSION` and shows it in the menu; source checkouts
identify as `development`.
Application release versions are separate from checkpoint schema versions.
There is no rollback procedure during this development phase, by owner decision.
Do not treat platform deployment history as a tested recovery process.

## Partial-release recovery

A failure before Pages deployment blocks publication. A Release failure after
Pages deployment makes the run fail visibly; the successful site remains live.
A tag and/or draft Release may already exist. The workflow never deletes or
moves tags, replaces existing assets, deletes the Pages deploy, or rolls it back.
Rerunning a version with an existing tag is rejected, including after partial
publication. A new dispatch normally gets a new run number; a rerun keeps its
run number and can get a different date across New York midnight, as before.

1. Inspect the failed run, its internal `release-downloads-<run>-<attempt>`
   artifact, and the tag/draft Release. Compare the manifest commit/version and
   archive hashes with the tag and existing assets. Keep those exact artifacts.
2. The owner decides whether to finish the missing uploads/draft publication
   manually using those verified bytes, or leave the partial release and make a
   new reviewed dispatch. Do not force a tag, overwrite a published asset, or
   assume that rerunning the Release job is a repair. If the tag or bytes differ,
   stop and resolve that mismatch before publishing.

The first successful authorized dispatch is recorded in
[issue 033](work-to-be-done/033-github-release-packages.md#first-successful-publication):
[live game](https://taggedzi.github.io/neon-nexis/) and
[Release 2026.11.03.0004](https://github.com/taggedzi/neon-nexis/releases/tag/2026.11.03.0004).
Both public ZIPs, all hosted files, and the actual Pages tar matched the tested
manifest. Local fixtures and mocked API tests alone are not publication evidence.
Static Pages does not provide the PHP introduction service; live checks confirm
co-op is disabled there. CI co-op checks use a PHP fixture and do not establish
a public co-op service.

## Saved games

Developers own save-format compatibility and any migrations. Compatible saves
continue to load. Increment `SAVE_VERSION` when making an incompatible format
change; retain the storage key so older data can be found and offered for export.
The current format is 1 and supports map versions 0 and 1 (or an absent map version).

On opening the menu, unsupported or unreadable checkpoints require a decision:
**Export and remove**, or **Remove without export**. Export preserves the original
bytes, including malformed JSON. Settings and unrelated storage are retained.
Escape/back does not discard data. Automatic checkpoints cannot overwrite an
unresolved incompatible save. Export errors preserve the checkpoint; a changed
checkpoint from another tab is not deleted based on a stale prompt.

Export starts a browser download before removing local data. Browser JavaScript
cannot verify that the player saved the file to disk or detect all blocked or
cancelled downloads; the prompt explicitly says to allow the download.

Issue 013 did not add a general import UI. Issue 020 adds a voluntary backup
from Settings → Data: one JSON file with file version, checkpoint, and settings.
Import asks before it writes, and a file this build cannot load leaves local
data in place. That backup is separate from the incompatible-save download.
There is still no automatic migration.

## Remaining validation and deferred scope

Hosted deployment and Actions execution were verified by the first authorized
publication above. Headless full Chromium and Playwright Firefox checks do not prove
stable Chrome/Firefox compatibility, real GPU performance, or physical controller
usability. Those remain release checks on actual devices.

Cache strategy and broader security checks remain deferred. GitHub release
downloads are now verified. Changelog implementation still needs separately
approved work in issue 013; no earlier release history is invented.
