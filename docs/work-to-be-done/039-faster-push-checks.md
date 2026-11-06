# 039 — Faster push checks

Status: Done

## Scope and acceptance

Owner request (2026-11-06): reduce the more-than-15-minute push checks without
removing tests, and skip tests when only documentation changes.

- [x] Measure the existing suite and validate a meaningful speed improvement.
- [x] Preserve all regression tests and both browser projects.
- [x] Skip the suite for documentation-only pushes; retain branch-sync guards.
- [x] Cover classification failures, new branches, multiple refs and code changes.
- [x] Document behavior and actual validation results.

## Implementation and validation

- Branch: `codex/faster-push-checks`, based on current main `340f329`.
  Origin fetched; no open pull requests. Working tree was clean.
- Baseline passed syntax, lint, every Node check and 198/198 browser tests.
  Browser time: 10.0 minutes. Full check approximately 11 minutes 17 seconds
  (npm process start 05:56:35 to final output 06:07:52 America/New_York).
  A sandboxed attempt could not start PHP; the valid run used local-server
  access outside the sandbox. The owner's reported 15+ minutes was not
  reproduced in this run.
- `tools/ci/push-scope.cjs` classifies existing refs against the remote tip and
  new branches against their merge base with fetched main. Only root Markdown,
  Markdown under `docs/`, and `LICENSE` qualify. Unknown paths and Git failures
  run the full suite. Renames include both paths; dirty/untracked code also
  prevents skipping. Tags run the suite. Sync validation happens first.
- `tools/check-push-scope.cjs` uses a disposable real Git repository to exercise
  these cases. Initial focused run passed outside the sandbox; sandbox Git
  initialization was denied. Expanded cases passed in the full check. A final
  focused run also passed after adding explicit `git push ... HEAD` coverage.
- `playwright.config.cjs` makes full tracing opt-in and keeps failure screenshots.
  The initial eight-worker trial was withdrawn after delivery exposed a flaky
  fourth-player join. The original maximum of four workers is retained.
  All 198 browser cases, both projects, assertions, timeouts and retries remain.
- `docs/development-and-releases.md` and `docs/decisions.md` document the skip
  policy and the diagnostic tradeoff.
- `tools/ci/serve-php.cjs` suppresses routine PHP connection/success logs; startup,
  warnings and HTTP errors remain visible. Diagnostic mode restores every line.
  Wait for the child's closed streams before exiting, preserving its final
  error messages. The baseline emitted tens of thousands of routine lines.
- README, CONTRIBUTING and AGENTS describe the documentation-only exception.
- Owner explicitly authorized commit, push, PR creation and merge on 2026-11-06.
  Delivery is tracked by [PR #56](https://github.com/taggedzi/neon-nexis/pull/56).
  Gameplay code is untouched; publication is separate.

### Measurement conditions

- Windows, Node 24.14.1, Intel Core i7-12700KF, 20 available logical CPUs,
  31.9 GiB system RAM. Playwright Chromium 156.0.8078.4 and Firefox 157.0.
- Same checkout, viewport 1280x720 (individual layout cases also use their
  declared smaller sizes), default game graphics, no retries or skipped cases.
  Sequential before/after runs, without competing suite runs. These are
  headless test-runner timings, not real-player game performance measurements.
- Baseline: four workers, retained-on-failure tracing, full PHP access logs.
  Initial experiment: eight workers, tracing off, failure screenshots, filtered
  routine PHP logs. Final configuration keeps the same diagnostic reductions
  with the original four workers. Combined timings cannot isolate each change.
- Logs are ignored local artifacts under `.playwright-mcp/push-checks/`.
  Optimized elapsed time recorded by a stopwatch.

### Initial eight-worker experiment — 2026-11-06 (withdrawn)

| Check | Baseline | Optimized |
| --- | --- | --- |
| Full `npm run check` | Approximately 11m 17s | 330.03s (5m 30s), exit 0 |
| Browser stage | 10.0m, 198 passed | 4.0m, 198 passed |

- Full check about 51% faster; browser stage about 60% faster. One sequential
  before/after pair establishes this local improvement, not a guaranteed push
  duration on every machine. Fetch/network time is outside this check timing.
- Syntax, ESLint, all Node checks (including the new real-Git scope regression)
  and both browser projects passed. All original browser case names are retained.
  No skip/retry policy, gameplay quality setting or assertion was relaxed.
- Scope regression covers new/existing branches, a feature's documentation
  follow-up versus its first code-containing push, explicit HEAD, multiple refs,
  tags, deleted refs, renames into docs, documentation deletions, staged/unstaged
  and untracked files, workflow/code paths and failed Git queries.
- Branch-sync guard remains before documentation classification; its existing
  stale-branch/merge-commit regression passed. Actual push was not performed.
- Diagnostic configuration checked: `NEON_TEST_TRACE=1` restores retained-on-
  failure tracing; normal runs use failure screenshots. CPU-count checks produced
  workers 1/2/4/4/6/8/8 for 1/2/4/8/12/16/20 logical CPUs respectively.
- Final syntax checks for the two scope files, ESLint and `git diff --check`
  passed. Linux/low-core timings and standalone Google Chrome were not measured.
  Full staged publication suites were not rerun; publication continues to run
  them and cannot take the pre-push documentation shortcut.
- Delivery pre-push on implementation commit `75954bb` failed: 197 passed,
  Chromium's four-player lifecycle case timed out at `coop-four.spec.cjs:38`
  waiting for the fourth player's peer (expected 3, received 2). Browser time
  4.2m. The hook correctly blocked the push. The earlier clean eight-worker
  run was insufficient evidence of reliability; the concurrency increase is
  withdrawn, without changing assertions, timeouts, retries or game code.
- Original four-worker cap restored. Tracing/logging reductions and the
  documentation shortcut remain. Final timing and delivery validation pending.

### Four-worker delivery follow-up

- Correction commit `ccebf86` restored the original worker cap. Its pre-push
  run passed 197 cases but failed Firefox's logbook focus check at
  `logbook.spec.cjs:38`; browser time 6.8m. Both four-player lifecycle cases
  passed. The push was blocked again; no failure was bypassed.
- The logbook test manually focused an entry without waiting for `UI.showScreen`
  to finish its delayed initial focus assignment (`js/ui.js`, 30 ms). That
  assignment can overwrite focus during the arrow-key assertions. This is a
  plausible timing race exposed by the faster run, rather than proof of a new
  gameplay defect. Twelve focused repetitions of the original Firefox case
  passed (28.5s), so the full-suite failure was not reproduced in isolation.
- `tools/ci/logbook.spec.cjs` now asserts the screen's initial summary focus
  before assigning entry focus. Existing arrow-key and focus assertions remain;
  no fixed sleep, timeout increase, retry, input simulation change or production
  code change. Twelve repetitions per browser passed (24/24, 45.1s), as did
  ESLint and `git diff --check`. Full-hook validation passed as recorded below.

### Final four-worker delivery validation — 2026-11-06

| Check | Baseline | Final configuration |
| --- | --- | --- |
| Browser stage | 10.0m, 198 passed | 6.7m, 198 passed |
| Full delivery push, including fetch/hook/transfer | Not measured | 492.03s (8m 12s), exit 0 |

- The final browser stage is about 33% faster, retaining the original worker
  limit. The earlier 51% full-check improvement describes the withdrawn
  eight-worker experiment and is not the final claim. Baseline full checks took
  approximately 11m 17s; the final push also includes Git/network overhead, so
  those two totals are not identical measurement boundaries.
- Implementation commits: `75954bb`, `ccebf86`, `d8e38af`. The actual required
  hook passed syntax, ESLint, all 22 Node check scripts, and 198/198 browser
  cases; the branch was then successfully pushed. No hook bypass was used.
- Original test cases and assertions remain, plus the logbook initial-focus
  readiness assertion. Retries remain zero; timeouts and game quality remain
  unchanged. Failure screenshot capture was also observed in the blocked runs.
- Documentation-only detection retains branch-sync guards. A documentation
  follow-up records these results; its delivery tests the actual fast path.
- [PR #56](https://github.com/taggedzi/neon-nexis/pull/56) is the delivery record
  for review, GitHub checks and merge. The GitHub integration could not create
  a PR (403); creation used the owner's authenticated GitHub CLI instead.
- All implementation acceptance criteria are verified. No publication or
  deployment is included. Linux, lower-core machines and standalone Chrome
  timing remain unmeasured; this does not claim an identical duration everywhere.
