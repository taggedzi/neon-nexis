# Agent instructions — NEON NEXUS

## Collaboration

Be a technically precise, friendly collaborator. The owner is comfortable with
advanced technical subjects but has limited working memory. Adjust presentation,
not technical depth:

- Use short paragraphs and plain language. Define unfamiliar terms when needed.
- Lead with the result or decision. Avoid repeated explanations and long theory.
- When the owner must perform checks or make decisions, give only the next 1–2
  useful steps. Wait for results before giving dependent instructions.
- Work autonomously within the requested scope. Ask about material gameplay
  decisions that are unresolved; do not ask about routine implementation choices.
- Discussion or review requests do not authorize gameplay changes. Distinguish
  proposed work from implemented and verified work.

## Project and source of truth

This is a browser-based, client-side top-down combat game. Its defining presentation
is a dark neon palette, geometric/wireframe shapes, glow, and procedural effects.
The owner likes the current appearance and feel.

Read the relevant issue in `docs/work-to-be-done/` before implementing it. The
backlog index is `docs/work-to-be-done/README.md`. Current owner instructions take
precedence over older design notes. Proposed defaults and open questions in issue
documents are not approved design decisions.

`PROJECT_CONTEXT.md` is a historical handoff, not proof of the current state. Verify
its architecture details, test results, environment paths, and completion claims
against the current checkout. In particular, do not assume its externally located
Python test suites are available or that its reported performance is acceptable.

## Code discovery

Prefer codebase-memory-mcp graph tools for code discovery:

1. `search_graph` to locate symbols.
2. `trace_path` to inspect callers and dependencies.
3. `get_code_snippet` to read specific implementations.
4. `query_graph` for complex relationships; `get_architecture` for an overview.

Identify the project by its actual indexed root. If it is not indexed, run
`index_repository` first. Use `search_code`, then `rg` or direct file reads for
coverage gaps, string literals, markup, styles, configuration, and documentation.

## Architecture guide

The current repository uses plain JavaScript, HTML, and CSS. Verify this guide as
the project evolves:

| Location | Responsibility |
| --- | --- |
| `index.html` | Page shell, menus, script loading |
| `css/style.css` | UI layout and visual styling |
| `js/util.js` | Shared helpers, storage, settings utilities |
| `js/content.js` | Weapons, enemies, modifiers, balance data |
| `js/assets.js`, `js/audio.js` | Procedural visuals and audio |
| `js/input.js` | Keyboard, mouse, controller, remapping |
| `js/game.js` | State, lifecycle, generation, saves, integration |
| `js/sim.js`, `js/enemies.js` | Simulation, collisions, spawning, enemy behavior |
| `js/render.js` | Camera, world rendering, visual effects |
| `js/ui.js` | Menus, overlays, inventory, settings |
| `js/main.js` | Boot and animation-loop wiring |

Modules currently share the `window.NEON` namespace. Preserve script dependencies
and load order. Keep responsibilities focused; do not add more unrelated behavior
to a large module when a small, clearly bounded extraction is warranted.

## Implementation constraints

Follow [the web development style guide](docs/web-development-style-guide.md)
for new and changed code. It applies to developers and AI agents; use it
incrementally without reformatting unrelated code.

- Follow `.editorconfig`, `.gitattributes`, and the whitespace policy in
  `CONTRIBUTING.md`: UTF-8 without BOM, LF, final newline, two-space indentation,
  and no trailing whitespace except deliberate Markdown hard breaks. Respect
  Makefile tabs, Windows command-script CRLF, and meaningful literal whitespace.
  Avoid unrelated reformatting or bulk line-ending normalization.

- Target current stable desktop Firefox, Google Chrome, and Chromium as described
  in `README.md`. These are desired support targets, not guarantees. Record actual
  browser versions and environments checked; do not infer cross-browser support
  from a single browser run.
- Use `YYYY.MM.DD.####` release versions: America/New_York date and a four-digit
  release-workflow run number that does not reset daily. Publication requires a
  single manual dispatch on main; no rollback procedure exists during development.
  Changelog setup remains pending deployment validation; see issue 013. Do not
  invent releases or require changelog entries before that process exists.
- Developers own save compatibility. Unsupported saves require an explicit offer
  to export before removal, or removal without export; preserve compatible saves
  and settings. See `docs/development-and-releases.md`. This does not authorize
  clearing the owner's browser data as a testing shortcut.

- Preserve the graphics style, visual quality, effects, and overall look and feel.
  Do not remove visible effects or lower default quality to claim optimization.
- Keep the game client-side with procedural/local assets. Do not add a backend,
  runtime CDN dependency, framework migration, or build pipeline without a concrete
  need and discussion with the owner.
- Favor focused changes and incremental refactoring over a wholesale rewrite.
- Preserve existing control options when adding new ones. Respect remapping and
  controller support; avoid duplicate hard-coded input paths.
- Keep screen coordinates, world coordinates, and ship-relative directions distinct.
- Keep simulation timing independent of display frame rate. Handle pause/resume,
  focus changes, and input release without stuck movement or firing.
- Preserve saves and settings where practical. When changing stored data, use
  explicit defaults, validation, and migration/version handling as needed. Never
  silently clear the owner's browser storage as part of testing.
- Do not treat decorative platforms as gameplay cover without implementing and
  validating the required collision and enemy-navigation behavior.
- Keep balance changes separate from performance evidence.

## Local issue tracking

Use task branches and owner-managed pull requests for delivery; documents preserve
scope, decisions, and validation evidence, and do not replace branch review.
Use the issue Markdown files as the local tracker; GitHub issues are optional. When
implementation starts, add a Status column to the backlog index if absent. Keep
each issue's status and the index synchronized using these states:

| Status | Meaning |
| --- | --- |
| Planned | Implementation has not started |
| In progress | Work has started and is incomplete |
| Blocked | A named dependency or unresolved decision prevents progress |
| Implemented — needs validation | Code is complete; required checks or player review remain |
| Done | Every acceptance criterion has supporting verification |

For each issue being worked on, maintain an **Implementation and validation**
section with changed files, implementation notes, checks and results, limitations,
remaining work, and relevant commit hashes when available. Record material design
decisions and the owner's answers to open questions in that issue.

Check an acceptance box only when evidence supports it. Distinguish automated
checks, agent manual checks, and owner playtesting. Never invent measurements or
mark subjective feel/balance criteria complete without the needed player review.
Partial implementation stays In progress; document exactly what remains.

Work on one issue at a time unless the requested scope or a shared prerequisite
requires otherwise. If blocked, record the specific reason and continue independent
authorized work when practical. A status-review request means checking the actual
code and evidence, not merely repeating the current labels.

Small maintenance and documentation tasks do not require a new backlog issue.
Record project-wide decisions in `docs/decisions.md` and task-specific decisions
in the relevant issue. Update these records as decisions are made, alongside the
implementation, rather than relying on chat history or a final summary. Record
the date, decision, rationale, approval source (owner instruction or agent
implementation choice), consequences, and any superseded decision. Clearly label
proposals and unresolved questions; never record them as accepted decisions.
Link between records when a decision affects multiple issues.

## Running and validation

Serve the repository root using an available static HTTP server, for example
`python -m http.server 8000`, then open `http://localhost:8000/`. Check interpreter
availability and avoid interfering with an existing server. Automated checks use
`npm run check`; see [the development guide](docs/development-and-releases.md)
for setup and future regression registration. Playing from source needs no build.

Use checks proportional to the change:

- For gameplay changes, exercise the affected behavior in a browser and inspect
  console errors. Check nearby interactions such as pause, menus, pickups, sector
  transitions, resizing, and save/continue when relevant.
- For controls, test supported input devices where available, including releases,
  neutral stick input, disconnects, and interaction with aiming and firing.
- For visual or rendering changes, compare equivalent before/after scenes at the
  same viewport and quality settings. Owner review may still be needed.
- For performance, record browser, hardware/rendering mode, viewport, quality,
  duration, and entity counts. Measure normal play, heavy waves, and extended runs
  with comparable workloads. Report frame times and memory behavior, not just an
  FPS impression. Headless results alone do not establish real-player performance.
- For procedural generation, use reproducible seeds or equivalent captured data;
  check reachability, spawn validity, boundaries, and collision behavior.

Add meaningful regression tests for risky logic changes where practical. Do not
create tests that merely mirror implementation or add tooling for documentation-only
edits. If tools or devices are unavailable, state which checks were not run and
leave the corresponding validation pending. Run `git diff --check` before delivery.

## Git and delivery

Inspect `git status` before editing. Preserve unrelated changes and untracked
files. Do not stage the entire working tree blindly or commit browser artifacts,
profiles, temporary captures, credentials, or local saves.

Before making any tracked changes, create a new branch for the task, including
features, bug fixes, refactors, tests, and documentation. Use descriptive names
such as `feat/ship-selection`, `fix/controller-release`, or `docs/release-guide`.
Never implement directly on `main` or another default/release branch. Continue
an existing task branch for follow-up work on that same unmerged task; create a
new branch for unrelated work. Start from the local default branch for a new
independent task, and report if its remote freshness is unknown. Do not silently
base unrelated work on an unmerged task branch. If existing changes prevent safe
branch isolation, ask the owner; do not discard, stash, or move their work without
authorization.

When commits are requested or authorized, use focused commits with clear messages
and include the associated issue updates. Record implementation hashes in a later
documentation update when needed; do not attempt a self-referential commit hash.
The owner pushes branches to GitHub, creates pull requests, arranges review by
themselves or another AI, and merges. Do not push, create a pull request, merge,
publish, or deploy unless the owner explicitly delegates that action. Completing
implementation or validation does not authorize merging. Website deployment and
release automation remain separate work until scoped.

Conclude with a short report: what changed, what was verified, the issue status,
the branch name, commit state, and any remaining decision or validation. Provide
a concise suggested PR title and description when handing off completed work.
Never claim a test passed unless it ran.
