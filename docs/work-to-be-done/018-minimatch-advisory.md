# 018 — Update or dismiss the minimatch advisory

Status: Implemented — needs validation

The override does not change how the game plays. Dependabot alert 3 stays
open on main until this lockfile is merged.

Priority 2 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

GitHub Dependabot alert 3 is open. `minimatch` 10.2.6 has a medium
denial-of-service advisory, GHSA-g3hv-75wg-m249 / CVE-2026-118764. Versions
below 11.0.1 are in range. The patched version is 11.0.1.

Alert: <https://github.com/taggedzi/neon-nexis/security/dependabot/3>

An attacker who can supply a glob pattern can make `minimatch` spend excessive
CPU and memory while it expands that pattern.

## What exists today

`package.json` overrides `minimatch` to 11.0.3, and `package-lock.json`
resolves that single version. It is a development dependency only.
`@eslint/config-array` 0.23.5 still depends on `minimatch` `^10.2.4`.
`eslint` 10.13.0 still depends on `minimatch` `^10.2.5`. Both sit under
devDependencies through ESLint, so the override is what selects 11.0.3.
Before this change the lockfile resolved 10.2.6.

The published game is staged by `tools/ci/package.cjs`. That step copies
`index.html`, the JS and CSS it references, `LICENSE`, a version stamp, and
`release.json`. It does not copy `node_modules`. Players do not download
`minimatch`.

The risky pattern is an attacker-controlled glob. ESLint's globs are the ones
in this repository's lint config, chosen by developers. They are not supplied
by players.

## Determine

- Whether current ESLint still declares `minimatch` `^10.2.x`, or a newer
  ESLint release already depends on 11.0.1 or newer.
- Whether an npm override to `minimatch` 11.0.1 works with ESLint 10.13.0.
  Confirm the override does not pull `minimatch` into `dist/`.
- Whether any other lockfile path still resolves a vulnerable `minimatch`.

## Decide

The owner chooses one outcome:

- Bump or override to `minimatch` 11.0.1 or newer if `npm run check` passes.
- Or leave the dev-only dependency and dismiss alert 3 with the reason that
  the package is not shipped and its globs are not attacker-controlled.

Proposal, not approved: try the patched version first. Dismiss only if ESLint
cannot run on 11.0.1 and the dev-only exposure is accepted.

## Decision — 2026-11-01

- Decision: Override every `minimatch` to 11.0.3. Do not dismiss alert 3.
- Rationale: ESLint 10.14.0 still declares `minimatch` `^10.2.6`, and
  `@eslint/config-array` 0.23.5 still declares `^10.2.4`. Neither range
  accepts 11.0.1. ESLint 10.13.0 and `@eslint/config-array` call
  `Minimatch#match` only, and 11.0.3 still provides that method. `npm run
  check` passed with the override.
- Approval: Owner instruction on 2026-11-01. Bump if ESLint still runs.
  Dismiss only if it cannot.
- Consequences: `minimatch` stays a development dependency. Remove the
  override when ESLint's own range accepts 11.0.1 or newer.
- Supersedes: The open proposal in Decide. The bump is the accepted outcome.

## Do

After the decision:

- If bumping: change the lockfile through the package manager, not by hand.
  Run `npm run check`. Confirm `dist/` from `node tools/ci/package.cjs` still
  has no `node_modules`. Confirm Dependabot alert 3 closes, or record why a
  new scan has not run yet.
- If dismissing: the owner dismisses alert 3 in GitHub with the written reason.
  Revisit the dismissal when ESLint next changes its `minimatch` range.
- Do not add `minimatch` as a runtime dependency of the game.

## Acceptance criteria

- [ ] Alert 3 is fixed by a patched `minimatch`, or dismissed with an owner
      approved reason. The lockfile resolves 11.0.3. Alert 3 was still open
      on main on 2026-11-01, because main does not contain this lockfile yet.
- [x] The game client shipped in `dist/` still does not include `minimatch`.
- [x] If the dependency changed, `npm run check` passed on the new lockfile.

## Open questions

Answered 2026-11-01. A dev-only advisory is in scope when a patched version
still lets ESLint run. The owner chose the bump.

## Dependencies

None. Independent of [issue 017](017-weak-cryptography-alert.md).

## Implementation and validation

Changed files:

- `package.json` adds `"overrides": { "minimatch": "11.0.3" }`. `minimatch` is
  not a direct or runtime dependency.
- `package-lock.json` resolves one copy, `minimatch` 11.0.3, plus its new
  dependency `@isaacs/nonrecursive-glob-match` 1.0.3. Both are `dev: true`.
  `eslint` 10.13.0 and `@eslint/config-array` 0.23.5 dedupe to that copy.
- `npm` 11.20.0 does not copy the `overrides` field into the lockfile root.
  `npm ci --ignore-scripts` still installed 11.0.3 and `npm ls minimatch`
  reported it as overridden.

`minimatch` 11 removes `makeRe()`. This repository's ESLint 10.13.0 does not
call it. File selection uses `new Minimatch(pattern, { dot: true })` and
`matcher.match`.

Checks on 2026-11-01, Node 24.14.1, npm 11.20.0, Windows:

- `npm ls minimatch --all` shows only 11.0.3. `npm ls minimatch --omit=dev`
  is empty. `npm audit` reports 0 vulnerabilities.
- `npm run check` passed. Syntax, lint, and unit checks passed. Playwright
  1.64.1 ran 88 browser tests, all passed, in 3.6 minutes. The unit gate
  used headless Chromium 156.0.8078.4. The browser run included Firefox
  157.0. PHP 8.4.13 served the suite on 127.0.0.1:4173 and 127.0.0.1:4174.
- `node tools/ci/package.cjs` staged `dist/` with `index.html`, `LICENSE`,
  `release.json`, `.nojekyll`, `css/style.css`, and the JS files `index.html`
  references. The tree has no `node_modules`. A search of those files found
  no `minimatch` text.
- `git diff --check` passed.

Limitations: lint success shows ESLint finished on this config. It does not
compare the file list with `minimatch` 10.2.6. The config globs are
`node_modules/**`, `dist/**`, `js/**/*.js`, `tools/**/*.js`, and `**/*.cjs`.

Remaining: merge this lockfile to main, then confirm Dependabot alert 3
closes. No main scan has run against 11.0.3. Browsers exercised in this run
were headless Chromium 156.0.8078.4 and Firefox 157.0.
