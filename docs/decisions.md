# Project decisions

## 2026-10-29 — Initial CI/CD and save policy

- Decision: Use GitHub Actions and GitHub Pages, with a single manual release
  dispatch, separate from merge. No rollback procedure during development.
- Decision: Use `YYYY.MM.DD.####`, with America/New_York dates and a four-digit
  release-workflow run number that does not reset daily.
- Decision: Developers handle compatibility. Unsupported saves offer export
  followed by removal, or removal without export. Keep compatible saves.
- Decision: Implement JavaScript syntax/lint, existing and future regression
  checks, and browser smoke tests now. Defer later checklist topics.
- Rationale: A small reviewed workflow fits the existing static client-side game.
- Approval: Explicit owner instructions in this chat on 2026-10-29, including
  approval of the timezone and run-number convention.
- Consequences: A minimal public-file staging step is necessary for safe Pages
  publication; it introduces no minifier or bundler. One-time GitHub settings and
  hosted validation remain owner work. No actual publication is authorized here.
- Agent choices: Node 24, ESLint correctness rules without bulk formatting,
  Playwright Chromium/Firefox, fixed local test port, incompatible-save checks
  based on format/map version and readable object structure, unchanged save key.
- Supersedes: The prior absence of a save-compatibility policy. Date-based
  versions remain as previously requested; the exact format is now resolved.

See [issue 013](work-to-be-done/013-deployment-and-changelog.md) and the
[operational guide](development-and-releases.md) for scope and evidence.
