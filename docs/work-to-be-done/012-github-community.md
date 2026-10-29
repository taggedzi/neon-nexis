# 012 — Prepare GitHub community and release documentation

Status: Done

## Scope and owner decisions

On 2026-10-29 the owner requested a README, code of conduct, contribution guide,
MIT license, security policy appropriate for a solo hobby developer, issue
templates, and a pull request template. This authorizes repository documentation;
it does not authorize pushing, publishing, or deployment.

Use the existing origin `https://github.com/taggedzi/neon-nexis.git` for GitHub
links and the in-game title NEON NEXUS for presentation. The license holder is
Matthew Craig, matching the repository's latest commit author, with year 2026.

## Acceptance criteria

- [x] README explains the game, local setup, controls, saves, status, and license.
- [x] Contribution and conduct guidance suit a solo hobby project.
- [x] Standard MIT license is present.
- [x] Security policy provides a private-reporting route and realistic support expectations.
- [x] GitHub bug/feature templates and pull request template are present.
- [x] Local links and formatting are checked; remote settings requirements are recorded.

## Implementation and validation

Changed files: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
`SECURITY.md`, `.github/ISSUE_TEMPLATE/{bug_report.md,feature_request.md,config.yml}`,
`.github/pull_request_template.md`, this issue, and the backlog index.

Documentation uses the current page shell, default binding data, existing local
backlog, Python availability, origin URL, and commit author as evidence. No
gameplay or runtime changes. No additional tooling dependencies.

Checks and results (2026-10-29): automated local link checks passed for all 12
relative links in the new prose documents. New documentation whitespace and bug/feature
template front-matter field checks passed. `git diff --check` passed. Agent manual
review checked the requested file coverage, default controls against `js/util.js`,
local-run instructions against the page shell and available Python 3.11.15, and
security/contact fallback consistency. No gameplay tests were needed or run for
this documentation-only change. Remote settings and rendering remain outside
this local documentation scope.

Owner confirmation (2026-10-29): GitHub private vulnerability reporting is enabled.
This is owner-reported validation; the agent did not change or independently verify
the remote setting. The policy includes a fallback if private reporting becomes
unavailable. Conduct reports use the owner profile and a minimal
contact request if no private contact is listed; no private email was invented.

Limitations: no remote settings were changed and no push or publication was
performed. Live GitHub template rendering and private-report submission were not
tested. The owner authorized committing the documentation to `main` on 2026-10-29.
