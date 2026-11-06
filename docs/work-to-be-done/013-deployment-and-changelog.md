# 013 — Establish CI/CD and release policy

Status: Implemented — needs validation

## Approved scope and decisions

Owner instructions on 2026-10-29 authorize GitHub Actions + GitHub Pages, manual
single-step release approval, `YYYY.MM.DD.####` versions, developer-managed old
save handling with export/removal choices, syntax/lint, regression CI and browser
smoke tests. America/New_York dates and non-resetting four-digit release-workflow
run numbers were explicitly confirmed. No rollback procedure during development.
Later checklist topics remain deferred. See [decisions](../decisions.md).

## Acceptance criteria

- [x] Record the approved hosting, approval, version and save policies.
- [x] Implement syntax/lint, regression and browser smoke checks and verify locally.
- [x] Implement and verify incompatible-save export/removal in isolated browsers.
- [x] Implement and validate the manually triggered Pages workflow.
- [x] Validate one-time GitHub settings and first hosted deployment.
- [ ] After deployment validation, introduce a changelog in separately approved work.

The deployment criteria were completed on 2026-11-03 by the owner-authorized
[issue 033 publication](033-github-release-packages.md#first-successful-publication),
version `2026.11.03.0004`. Pages uses GitHub Actions and a main-only
`github-pages` environment. Both staged browser suites, the real uploaded
artifact, all public game files, both downloads, and live browser checks passed.
Earlier pending-deployment notes below are historical. Changelog work still
requires separate approval and keeps this issue open; none was introduced here.

## Implementation and validation

- Changed files: `package.json`/lockfile, ESLint and Playwright configs,
  `.github/workflows/`, `tools/ci/`, `tools/check-maps.cjs`,
  `tools/check-controller.js`, `tools/check-release.cjs`, `js/save-policy.js`,
  `js/game.js`, `js/ui.js`, `js/util.js`, `index.html`, `.gitignore`, README,
  AGENTS, CONTRIBUTING, this issue/index, decision log and development/release guide.
- Implementation: New task branch from local main; remote freshness unknown.
  Previous documentation branch remains untouched. The owner authorized committing
  this implementation locally; no push, PR or public deployment performed.
  Minimal staging is required by the approved hosting
  choice; minification and broader security tooling remain deferred.
- Checks: Syntax and lint passed. Fixed the existing Node map harness's
  Windows path handling and missing enemies dependency. Map checks passed for
  384 layouts (128 seeds, sectors 1/2/6), 140 distinct sizes, collision/routing.
- Final combined local run: `SERVE_DIR=dist npm run check` passed syntax, lint,
  all Node checks and all 36 browser tests against the staged game. Node 24.14.1,
  Windows host, headless Chromium 156.0.8078.4 and Playwright Firefox 157.0,
  1280x720 viewport. Regression assertions per browser: camera 33, synthetic
  controller 44, discarded items 39, rewards 65, driving 31, firing 53, map
  combat 39, ships 119, spawning 98. Seven save-policy cases and one lifecycle
  smoke test passed per browser, plus regression registration coverage.
- Follow-up: Replaced the hard-coded BUILD 1.0 menu text with the release version.
  Syntax/lint passed again; all 16 save-policy/smoke tests passed against restaged
  files in both browsers, including the version label. The save prompt screenshot
  was captured with its entrance animation completed for visual inspection.
- Harness fixes: Await asynchronous controller assertions and surface their
  rejection directly. Allow one device pixel of outline-width rounding while
  retaining a solid outline of at least 2 CSS pixels; Firefox on this Windows
  environment reports 2.5px for the authored 3px outline. No CSS change made.
- Version checks: New York midnight, year boundary, four-digit padding and
  invalid/overflow run numbers passed. No real release/version was published.
- Packaging exclusions, metadata, LF/UTF-8/final newlines, local Markdown file
  link targets and `git diff --check` passed. Reports/profiles/dist are ignored.
- Integration: The original implementation commit is `57d059d`. The owner later
  requested resolution of PR #2 conflicts after documentation PR #1 merged.
  Integrated `origin/main` at `109bde2`, preserving its style guide, whitespace,
  branch/review rules and decision history alongside the newer approved CI/CD
  and save policies. Combined ignore rules, synchronized issue 013 status, and
  removed superseded current-policy claims. Runtime files were not changed.
  Resolution checks passed: no conflict markers, local Markdown file targets,
  UTF-8/LF/final newlines, combined ignore rules and `git diff --check`. Gameplay
  tests were not repeated for this documentation-only integration.
- Remaining: GitHub-hosted Actions, Pages configuration/publication, stable browser manual
  checks, physical controllers and real GPU performance remain unvalidated.
- Export limitation: Browser download initiation is observable; final disk save
  or all download blocking/cancellation is not. Export errors preserve local data.

### CI navigation-error follow-up — 2026-10-29

- Owner reported [failed CI run 40983620225](https://github.com/taggedzi/neon-nexis/actions/runs/40983620225)
  on main `d259a90`. Syntax, lint, Node checks and 37/38 browser tests passed;
  Firefox's reload smoke test reported repeated `InvalidStateError: Navigated
  away from page` errors. No trace artifact was uploaded by that workflow.
- Branch: `fix/audio-navigation-rejections`, based on freshly fetched main.
  Agent implementation choice: handle rejected audio state-change promises at
  their source and route unlock through the guarded resume method. Existing
  synchronous exception handling remains. Audio failure stays nonfatal, consistent
  with the engine's existing policy; the smoke test still rejects all page and
  console errors. No gameplay, save format or test-error filtering changes.
- Changed files: `js/audio.js`, `tools/check-audio-lifecycle.cjs`, this issue.
  The new Node regression runs automatically through the existing unit runner.
  It covers unlock/resume/suspend promise rejection, synchronous exceptions,
  successful calls and state guards. It failed on the original code with three
  unhandled navigation-error rejections, then passed with the fix.
- Three unmodified Firefox smoke runs passed before the fix; the hosted timing
  failure was not reproduced locally. The regression demonstrates the uncovered
  audio rejection path, but the hosted error has no captured stack to prove its
  source. Local verification uses Linux, Node 24.22.2, headless Chromium
  156.0.8078.4 and Playwright Firefox 157.0 at 1280x720.
- Syntax, lint and all Node checks passed, including 384 generated map layouts.
  All 38 browser tests passed, including both reload smoke tests. Checks ran
  through the underlying Node entry points because this shared filesystem's
  npm executable shims returned Permission denied. `git diff --check` passed.
  Implementation commit is `3fb460d`. Owner requested a pull request on
  2026-10-29. GitHub CI rerun remains pending on that pull request.
  Issue status remains Implemented — needs validation; deployment criteria above
  remain pending.

### Local pre-push checks — 2026-11-01

- The owner asked to stop spending shared Actions minutes on the routine suite,
  to require that suite locally before a push, and to shorten it.
- Removed `.github/workflows/ci.yml`. Pushes and pull requests no longer start
  a checks job. The manual Publish game workflow still runs syntax, lint, unit
  checks, and both browser suites against `dist`.
- `.githooks/pre-push` runs `npm run check`. `node tools/ci/install-hooks.cjs`
  sets `core.hooksPath`. A delete-only push skips the suite. `git push
  --no-verify` skips the hook.
- Playwright runs tests in parallel, at most 4 at once. The co-op smoke file
  was almost all of the previous ~14 minute browser run.
- Local `npm run check` on 2026-11-01 passed: syntax, lint, unit checks, and
  88 browser tests. The browser step reported 4.3 minutes. The whole command
  took 5.5 minutes. Windows, Node 24.14.1, 4 workers, headless Playwright
  Chromium and Firefox, PHP 8.4.13. A delete-only pre-push input exited 0
  without running the suite.
- Issue status stays Implemented — needs validation. Hosted Pages publication
  is still unvalidated.

### Publishing browser failures — 2026-11-05

- Owner requested investigation and repair of [publish run 42139800444](https://github.com/taggedzi/neon-nexis/actions/runs/42139800444/job/127636997433).
  The minified staged suite stopped preparation: 187 passed, seven failed.
  Deployment and release jobs did not run. No open pull requests were found;
  origin was fetched and local main was current. Task branch:
  `codex/fix-publish-browser-checks`.
- Changed files: `js/ui.js`, `js/audio.js`,
  `tools/check-audio-lifecycle.cjs`, `tools/ci/audio-score.spec.cjs`,
  `tools/ci/player-stats.spec.cjs`, `tools/ci/menu-layout.spec.cjs`, this issue
  and the backlog index.
- Layout root cause: the fallback display font can make SIGNAL LOST wider
  than its centered parent. The old measurement used total descendant width,
  which missed the unequal overflow on either side. Reproduced in both local
  browsers using generic fallback fonts: screen scroll width 1384/1385 at a
  1280-pixel viewport. Agent implementation choice: measure both edges from
  the centered parent; retain the existing fonts, effects and layout. Related
  UI scope and prior validation remain in [038](038-menu-ui-cleanup.md).
- Audio gap: a resume requested before a user gesture can remain pending under
  autoplay policy. The serialization added during [035](035-music.md) then
  suppresses the unlock call inside the gesture. Hosted Firefox traces show
  autoplay warnings and no initial music startup; this exact event ordering
  is an inferred cause, verified separately with a deterministic regression.
  Agent implementation choice: explicit unlock may retry a pending resume;
  opposing suspend/resume operations remain serialized. Older promises cannot
  clear the newer transition. No autoplay policy is disabled in tests.
- Regression coverage: fallback-font death screen, an unresolved pre-gesture
  resume followed by the Boot click, and stale-promise/transition ordering.
  Audio lifecycle and scheduler Node checks passed after the fix.
- Focused minified suite: 44/44 audio, recorded music, player-stat/death-screen
  and menu checks passed in 1.9 minutes. Windows, Node 24.14.1, PHP 8.4.13,
  Playwright Chromium 156.0.8078.4 and Firefox 157.0, two workers. This run
  preceded the additional browser pre-gesture regression; the full suite below
  includes it. The deterministic Node pre-gesture regression failed against
  the original audio implementation and passed against the corrected version.
- Agent visual check: the same fallback-font screen at 1280×720 now measures
  scroll width 1280 in both browsers (previously 1384/1385). The title, buttons
  and both tally tables remain visible. Existing installed-font viewports also
  pass the focused suite. Captures and logs are ignored local artifacts.
- Full `SERVE_DIR=dist npm run check` passed on the minified package: syntax,
  lint, all unit checks, and 198/198 browser tests (9.0 minutes for the browser
  suite, four workers). Same Windows/Node/PHP/browser versions as above.
  This includes the new Boot-click regression in both browsers, existing
  fallback/rejected-audio paths, all death-screen sizes, co-op, and save tests.
  Package-unit checks also verified both modes, ZIP integrity and Pages parity.
- Unminified focused run initially passed 45/46; Firefox's synthetic-controller
  phase failed focus navigation. Two of three isolated repeats failed too.
  A focus-event trace reproduced three failures and showed the test assigning
  Resume, then the previous screen's pending 30 ms restoration assigning
  Settings 3 ms later, before the simulated Down press. Agent implementation
  choice: wait 50 ms on the browser event loop before assigning the controller
  phase's initial focus. Every existing assertion remains; game focus behavior
  is unchanged. This is test setup synchronization, not an added test retry.
- Final checks: the synchronized controller test passed three consecutive
  isolated Firefox runs (34.2 seconds). The complete affected unminified suite
  then passed 46/46 in 2.0 minutes with both browsers and two workers. Lint and
  `git diff --check` passed after the test-only setup change. The full 198-test
  run predates that setup change; production files were unchanged afterward.
- Remaining: actual Linux-hosted publish rerun, owner review,
  separate Google Chrome and physical audio-device checks remain pending.
  The owner authorized committing, pushing and creating a pull request on
  2026-11-05. Delivery proceeds on `codex/fix-publish-browser-checks` with the
  required pre-push check. Merge and publication remain owner-managed; no
  browser data was removed.
- Status remains Implemented — needs validation. This repair does not introduce
  the separately deferred changelog work.

### Remaining Linux publication failure — 2026-11-06

- Owner requested getting Publish game to pass after PR #52 merged. Both
  post-merge runs, [42147612646](https://github.com/taggedzi/neon-nexis/actions/runs/42147612646)
  and [42185519346](https://github.com/taggedzi/neon-nexis/actions/runs/42185519346),
  failed the same three Firefox audio tests; 195/198 passed. Layout failures
  are resolved. Preparation stopped before deployment and release.
- The earlier pending-resume fix did not resolve this hosted failure. Linux
  Firefox needs a running audio server, not just Playwright's installed client
  libraries. The publish workflow did not start one. Tests and browser policy
  remain enabled.
- Clean primary checkout on current main `b099721`; no open PRs found. Branch:
  `codex/fix-linux-publish-audio`. Linux Node/Firefox reproduction files and
  downloaded hosted diagnostics are ignored local artifacts. Owner browser
  data is untouched.
- Controlled Linux reproduction: Ubuntu 22.04.5 on WSL2, Node 24.14.1,
  Playwright Firefox 157.0, one worker. Pointing `PULSE_SERVER` to a nonexistent
  socket reproduced all three exact assertions: suspended context, zero notes,
  and procedural fallback. The same three unchanged tests passed in 32.3 seconds
  with an isolated PulseAudio 15.99.1 null sink. No game or test code changed.
  This establishes the environment dependency and explains the hosted pattern;
  the actual hosted rerun is still required.
- Agent implementation choice, under the owner's request to get publication
  passing: `.github/workflows/release.yml` installs PulseAudio and its utilities,
  starts the server, creates/selects a virtual output, and logs server/output
  information before checks. The real browser playback clock runs without a
  physical sound device. No tests are skipped, retried, mocked, or relaxed.
  Publishing permissions, main-only guard, approval and packaging stay intact.
- Linux staged verification: all seven audio tests passed against the minified
  package (40.5 seconds) and the unminified package (42.4 seconds). This covers
  Boot unlock, scene/mute/suspend lifecycle, recorded-track endings/shuffle,
  fallback and blocked audio. Static Python HTTP served these isolated audio
  checks; this is not a Linux co-op/PHP or full-suite result. The Ubuntu-hosted
  full suites remain pending. Local audio packages/browsers were unpacked into
  ignored files; the existing WSL audio service and owner storage were untouched.
- Workflow validation: actionlint 1.7.12 and `git diff --check` passed. The
  official actionlint archive was checksum-verified. Required pre-push checks
  will run during delivery. Changed tracked files: release workflow, this issue
  and backlog index only. Existing owner authorization covers commit/push/PR;
  merge still requires owner approval under AGENTS.md.
- Status: Implemented — needs validation. Remaining: review/merge, dispatch
  Publish game on the updated main, and follow both staged suites, deployment
  and release to completion. Separately deferred changelog work is unchanged.

### Linux publication delivery and hosted evidence — 2026-11-06

- Implementation commit: `15a8a5c`. The required pre-push check passed syntax,
  lint, all unit checks and 198/198 Windows Chromium/Firefox browser tests
  (10.3 minutes for the browser suite). CodeQL's Actions and JavaScript checks
  also passed on [PR #53](https://github.com/taggedzi/neon-nexis/pull/53).
- Approval source: the owner explicitly answered "Merge and run publication"
  to the request to merge PR #53 and run Publish game on main. The normal merge
  was blocked by the ruleset reserving main updates for administrators. The
  approved rebase merge used the administrator update exception; repository
  protections were not changed. PR #53 merged as `d8c4e99`, and local main was
  fast-forwarded to that revision.
- Hosted attempts: [Publish game run 42191142894](https://github.com/taggedzi/neon-nexis/actions/runs/42191142894)
  on `d8c4e99`, dispatched with minification enabled. Attempts 1 and 2 were
  cancelled during Playwright's operating-system dependency installation after
  very slow package downloads from `azure.archive.ubuntu.com`. Neither reached
  virtual audio startup, project tests, deployment, or release. The first spent
  over 16 minutes on installation; the fresh-runner retry showed the same slow
  transfers and was cancelled after about eight minutes. Apt index retrieval
  was fast; individual package downloads took minutes for a few megabytes.
- Agent implementation choice: replace the Azure mirror URL in the ephemeral
  runner's `/etc/apt/apt-mirrors.txt` with Ubuntu's main HTTPS archive before
  Playwright installs dependencies. Preserve the mirror-list format, other
  entries, package signature verification and all tests. Log the resulting
  list. A missing mirror-list file is left alone. The main archive's signed
  Noble index returned HTTP 200 during verification. This affects only CI.
- Mirror-step checks: actionlint 1.7.12, Bash syntax and a Linux fixture check
  passed. The exact shell block replaces both HTTP and HTTPS Azure entries,
  preserves priorities and an unrelated security-mirror entry, and makes no
  local operating-system changes. Required pre-push checks run on delivery.
- This delivery record supersedes the earlier remaining review/merge/dispatch
  steps. Issue 013 remains Implemented — needs validation because changelog work
  still requires separate approval; hosted publication remains pending the
  mirror fix. No changelog or gameplay changes are included in this follow-up.
