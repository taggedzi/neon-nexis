# Contributing

Thanks for helping improve NEON NEXUS. This is a solo hobby project, so responses
and reviews may take time. A report or pull request does not guarantee acceptance
or a release date.

## Discuss and report

Check existing GitHub issues and the [local backlog](docs/work-to-be-done/README.md)
before opening an issue. Use the bug or feature template. For substantial gameplay,
balance, architecture, or dependency changes, discuss the proposal with the
maintainer before implementing it. Small fixes and documentation improvements can
go straight to a pull request.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Send sensitive vulnerability
reports through the [Security Policy](SECURITY.md).

## Work locally

Fork the repository, create a branch, and follow the [README](README.md#run-locally)
to serve the game. No package-manager build is required. If using a coding agent,
also follow [AGENTS.md](AGENTS.md).

Keep changes focused. Preserve the neon visual style, procedural/local assets,
existing controls and remapping, and saved data where practical. The project uses
plain JavaScript and the shared `window.NEON` namespace; preserve script load
order in `index.html`. Discuss new frameworks, build systems, backends, or runtime
dependencies first.

For work covered by a local issue, keep its status, acceptance evidence, and
**Implementation and validation** section synchronized with the backlog index.
GitHub issues can link to these documents; they do not replace their records.
Record material decisions and their rationale as work proceeds. Project-wide
decisions belong in [the decision log](docs/decisions.md); task-specific decisions
belong in the relevant issue. Small maintenance tasks need no new local issue.

For agent-assisted owner work, every task uses a branch. The owner pushes it,
creates the PR, arranges review, and merges unless explicitly delegated. See
[AGENTS.md](AGENTS.md#git-and-delivery) for the full handoff rules.

## Validate your change

Use checks appropriate to the change and describe what actually ran:

- For gameplay, exercise the affected behavior in a browser, inspect console
  errors, and check relevant pause, menu, save/continue, and sector interactions.
- For controls, check presses and releases and available keyboard, mouse, and
  controller paths. State when physical hardware was unavailable.
- For visuals, compare equivalent scenes at the same viewport and quality.
- For performance, record browser, hardware/rendering mode, viewport, quality,
  workload, duration, and frame-time/memory measurements. Keep balance changes
  separate and preserve default visual quality.
- Add meaningful regression coverage for risky logic where practical. Existing
  checks live in `tools/`; read a check's setup before running it. There is no
  single established command that runs every check.
- Run `git diff --check` before submitting. Documentation-only changes need link
  and formatting checks, rather than a gameplay test suite.

Do not clear browser storage as a testing shortcut. Keep local saves, browser
profiles, screenshots generated during testing, and credentials out of commits.
Mark unavailable checks and subjective player validation as pending.

## Open a pull request

Explain the problem, resulting behavior, related issue, checks and results, and
remaining limitations. Include before/after images for visible changes when
useful. Submit one coherent change per pull request and follow the provided
template. The maintainer may request changes or decline proposals that do not
fit the project.

By submitting a contribution, you agree that it may be distributed under the
project's [MIT License](LICENSE). Only contribute work you have permission to share
and identify any third-party material and its license.
