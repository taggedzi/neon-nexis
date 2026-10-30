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
- [ ] Implement and validate the manually triggered Pages workflow.
- [ ] Validate one-time GitHub settings and first hosted deployment.
- [ ] After deployment validation, introduce a changelog in separately approved work.

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
  GitHub CI rerun remains pending owner delivery; no commit, push or merge made.
  Issue status remains Implemented — needs validation; deployment criteria above
  remain pending.
