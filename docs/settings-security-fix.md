# Settings path security fix

Date: 2026-10-29. Status: Implemented — needs validation.

Owner authorization: “please perform the recommended fix” after review of
[GitHub code-scanning alert 1](https://github.com/taggedzi/neon-nexis/security/code-scanning/1).
This is a focused maintenance fix, with no new backlog issue.

## Decision

Restrict the private settings setter to the paths used by current settings
controls, reject prototype-related segments, and require own properties at every
step, including the final property. Agent implementation choice under the owner's
approved fix scope. This prevents arbitrary property traversal while preserving
current settings and storage formats. New controls must explicitly extend the
allowlist. Invalid updates return false and their handlers stop before applying
or saving settings. No earlier accepted decision is superseded.

## Implementation and validation

- `js/ui.js`: guarded setter and rejection handling in slider/toggle handlers.
- `tools/check-settings-paths.cjs`: actual private helper tested in an isolated VM;
  covers supported paths, prototype paths, unknown paths, inherited properties,
  and missing/invalid intermediate objects. Passed.
- `tools/ci/settings-paths.spec.cjs`: browser coverage for slider/toggle updates,
  persistence after reload, malicious DOM paths, and page errors.
- Isolated worktree: `/tmp/neon-settings-fix`, branch
  `fix/settings-prototype-pollution`, based on fetched main `5eb4f9e`.
  Original worktree's unrelated `js/game.js` edit is preserved.
- Validation on Linux under temporary Node 24.22.2: syntax, ESLint and all Node
  checks passed (including 384 map layouts and the new settings checks).
- Browser suite: all 36 existing tests passed. The two new settings tests first
  timed out because their locator depended on the deliberately modified DOM
  attribute. After correcting that test locator, both passed on a targeted rerun.
  Browsers: headless Chromium 156.0.8078.4 and Playwright Firefox 157.0.
  Console page-error collection in the new tests was empty. These runs do not
  establish stable desktop Chrome/Firefox or physical-controller support.
- Initial validation attempts hit missing dependencies, Node 18 and sandbox
  networking restrictions. Required runtime/dependencies and browser binaries
  were installed for isolated testing. No owner browser profile was used.
- `git diff --check` passed.
- Owner subsequently authorized committing, pushing this branch, and opening a
  pull request. Merge and release remain owner-managed. GitHub CodeQL validation
  is pending; local checks cannot confirm closure of the hosted alert.
