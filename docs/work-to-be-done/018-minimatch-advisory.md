# 018 — Update or dismiss the minimatch advisory

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 2 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

GitHub Dependabot alert 3 is open. `minimatch` 10.2.6 has a medium
denial-of-service advisory, GHSA-g3hv-75wg-m249 / CVE-2026-118764. Versions
below 11.0.1 are in range. The patched version is 11.0.1.

Alert: <https://github.com/taggedzi/neon-nexis/security/dependabot/3>

An attacker who can supply a glob pattern can make `minimatch` spend excessive
CPU and memory while it expands that pattern.

## What exists today

`package-lock.json` resolves `minimatch` 10.2.6. It is a development dependency
only. `@eslint/config-array` depends on `minimatch` `^10.2.4`. `eslint` 10.13.0
depends on `minimatch` `^10.2.5`. Both are under devDependencies through ESLint.

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
      approved reason.
- [ ] The game client shipped in `dist/` still does not include `minimatch`.
- [ ] If the dependency changed, `npm run check` passed on the new lockfile.

## Open questions

- Is a dev-only advisory in scope for this project, given players never receive
  the package?

## Dependencies

None. Independent of [issue 017](017-weak-cryptography-alert.md).

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
The lockfile facts above were read from the tree at `9deb91b` on 2026-11-01.
