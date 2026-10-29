# Development and releases

This is the approved initial CI/CD setup for the client-side game. Hosting is
GitHub Pages; GitHub Actions runs checks and publishes only on manual request.
No public deployment has been validated yet.

## Local checks

Use Node.js 24 or newer. Node and npm are development tools only: players need
only their browser, and the game still runs without a build step.

```sh
npm ci --ignore-scripts
npx playwright install chromium firefox
npm run check
```

`check` runs syntax validation, ESLint correctness rules, Node regression checks,
and browser regression/smoke tests. Linux browser installation may also require
`npx playwright install --with-deps chromium firefox`, as used in CI.

Existing compact source is not reformatted. The initial lint rules catch undefined
names, duplicate definitions, unreachable code, invalid `typeof`, unsafe finally
blocks and invalid superclass construction. They do not certify overall code
quality or security.

Browser tests use new disposable contexts and a loopback-only server on port
4173. They never open the owner's browser profile or clear existing browser data.
An occupied port causes failure rather than reusing an unknown server. Run tests
from the repository root. Reports/traces are local ignored artifacts.

Add Node regression scripts as `tools/check-*.cjs`; the runner discovers them.
Add browser regression scripts as `tools/check-*.js` and register their query and
result object in `tools/ci/regression.spec.cjs`. An unregistered script fails CI.
New Playwright `*.spec.cjs` tests in `tools/ci/` are discovered automatically.
Tests must fail when an assertion fails and use isolated browser storage.

CI runs on pull requests and pushes to main. Make its `checks` job a required
status check in repository rules before relying on it to prevent bad merges.
This repository setting cannot be enforced by workflow YAML alone.

## One-time GitHub setup

After the owner merges the workflow, enable Pages with **GitHub Actions** as its
publishing source. Allow the `github-pages` environment to deploy from main.
Do not add a second required-reviewer approval: dispatching the release is the
single manual approval. Repository/account restrictions may override this.
Use the Pages URL GitHub supplies as the initial stable address. A custom domain
has not been selected. Changing origin later changes access to browser saves.

The owner continues to push, open PRs, review and merge. These implementation
changes do not authorize publishing from this chat.

## Publish a release

In GitHub Actions, open **Publish game**, choose **main**, and select **Run
workflow**. This is the one manual approval. Merging never publishes. A dispatch
on another branch skips publication. Only dispatch reviewed main commits.

The workflow installs locked development dependencies, runs syntax/lint/Node
checks, stages an explicit allowlist of public files, runs both browser suites
against that exact staged game, and uploads/deploys it only if everything passes.
No minification, bundling, runtime dependencies, security scanning service, or
automatic release-note generation is introduced. Minimal staging is required
to avoid publishing repository documents, tools, or local files.

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
cancelled downloads; the prompt explicitly says to allow the download. There is
no save-import UI or automatic migration introduced by this change.

## Remaining validation and deferred scope

Hosted deployment and Actions execution require owner setup and an authorized
first publication. Headless Chromium and Playwright Firefox checks do not prove
stable Chrome/Firefox compatibility, real GPU performance, or physical controller
usability. Those remain release checks on actual devices.

Minification/cache strategy, broader security checks, distribution beyond Pages,
and public release preparation remain deferred. Changelog implementation remains
pending until the deployment process is validated; no release history is invented.
