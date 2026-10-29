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

Use the issue Markdown files as the local tracker; GitHub is not required. When
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

When commits are requested or authorized, use focused commits with clear messages
and include the associated issue updates. Record implementation hashes in a later
documentation update when needed; do not attempt a self-referential commit hash.
Do not push, publish, or deploy unless authorized. GitHub distribution, licensing,
and personal-site deployment remain separate planning work until scoped.

Conclude with a short report: what changed, what was verified, the issue status,
and any remaining decision or validation. Never claim a test passed unless it ran.
