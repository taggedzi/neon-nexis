# Web development style guide

Use this guide for new and changed code in NEON NEXUS. It applies to human
contributors and AI agents. It describes how to evolve this application; it does
not claim that every existing file already follows these conventions.

Owner instructions take precedence. Follow [AGENTS.md](../AGENTS.md) for scope,
workflow, and validation, and [CONTRIBUTING.md](../CONTRIBUTING.md) for submission
requirements. Do not turn a focused fix into a formatting or architecture rewrite.

## Start with the change

- Read the relevant issue and accepted decisions. Separate unresolved design
  questions from implementation choices you can make independently.
- Find the existing owner of the behavior before adding a helper or input path.
  Verify the current code rather than relying on historical handoffs.
- Keep each PR focused. Explain the user-visible result and any compatibility
  impact. Record material decisions as work proceeds.
- Use the current plain JavaScript, HTML, CSS, and local/procedural assets.
  Discuss dependencies, frameworks, build tooling, and hosting before adding them.

## Formatting and naming

Follow [.editorconfig](../.editorconfig) and [.gitattributes](../.gitattributes):
UTF-8 without BOM, LF, final newline, two spaces, and no accidental trailing
whitespace. See the contributor policy for Markdown, Makefile, and Windows-script
exceptions. Match nearby quoting and punctuation in existing code.

- Prefer readable statements over compressed chains of assignments or branches.
  Use braces for new control-flow blocks and semicolons in JavaScript.
- Use `camelCase` for functions and variables, `PascalCase` for constructors or
  exported subsystem objects, and `UPPER_SNAKE_CASE` for fixed shared constants.
  Follow existing names at public boundaries rather than renaming for style alone.
- Name booleans for their meaning, such as `isPaused` or `hasPendingRewards`.
  Prefer domain names to generic `data`, `manager`, or `helper` when possible.
- Include units and coordinate space where confusion is possible:
  `elapsedSeconds`, `screenX`, `worldX`, `aimAngleRadians`. Do not mix milliseconds
  and seconds or screen, world, and ship-relative values in an implicit conversion.
- Keep comments about intent, constraints, and non-obvious tradeoffs. Avoid
  narrating obvious statements. A TODO should state what remains and link to an
  issue when one exists; it is not evidence of implemented behavior.

## JavaScript and module boundaries

- Use `const` by default and `let` when reassignment is needed. Avoid new `var`
  declarations and implicit globals. Prefer strict equality and explicit checks
  when zero, an empty string, or `false` is a valid value.
- Preserve the shared `window.NEON` namespace and script dependency order. Keep
  private helpers in the module's existing closure; export only what callers need.
  Do not introduce ES-module loading as a side effect of another task.
- Give each function one clear responsibility. Extract a bounded subsystem when
  it reduces coupling; avoid general-purpose frameworks for a single use case.
- Keep content/balance definitions separate from simulation, rendering, input,
  and menu behavior. Use the architecture guide to find the appropriate module,
  then verify that location against the checkout.
- Make ownership and mutation clear. Prefer explicit parameters and return values
  for calculations. When mutating shared state, use the existing subsystem entry
  points and document important preconditions or side effects.
- Validate external or persisted values at their boundary, including finite
  numbers, ranges, enums, and missing fields. Avoid repeated defensive checks
  throughout internal code once a boundary has established the invariant.
- Use optional chaining or defaults only when absence is expected. Do not hide a
  broken required dependency behind a silent no-op.

For example, make a coordinate conversion explicit rather than passing an
unlabeled pair of numbers between input and world logic:

```js
function screenToWorld(screenX, screenY, camera) {
  return {
    worldX: screenX + camera.offsetX,
    worldY: screenY + camera.offsetY
  };
}
```

This is a naming example, not the game's camera API or an approved conversion
formula. Use the actual camera transform, including zoom and viewport offsets.

## Simulation, input, and rendering

- Keep timing independent of display refresh rate. Follow the existing time-step
  policy; do not add frame-count-based movement, cooldowns, or spawn rates.
- Route actions through existing remapping and controller abstractions. Handle
  releases, focus loss, pause/resume, neutral sticks, and disconnection. Do not
  add a second hard-coded binding for an existing action.
- Keep gameplay state changes in simulation/lifecycle paths. Rendering may update
  visual-only caches or effects, but must not decide rewards, damage, or spawning.
- Avoid blocking work, storage writes, DOM measurements, and repeated asset
  creation in per-frame loops. Cache or pool only where measurements justify the
  added lifetime and invalidation complexity.
- Preserve default effects and neon presentation. Compare equivalent workloads
  when measuring performance; changes to enemy counts or visual quality are not
  evidence of an implementation speedup.
- Clean up listeners, timers, audio nodes, and retained references when their
  owner ends. Prevent repeated initialization from accumulating handlers.

## HTML and accessible UI

- Use semantic elements: buttons for actions, labels for form controls, and links
  for navigation. Set `type="button"` where a button should not submit a form.
- Prefer native behavior before adding ARIA or custom keyboard interaction.
  Give icon-only controls accessible names; do not rely on color alone for state.
- Preserve visible keyboard focus and keyboard/controller menu navigation.
  When opening an overlay, place focus appropriately; restore it on close and
  ensure hidden controls cannot receive focus. Validate changes in the real UI.
- Keep game actions separate from typing in text fields and interacting with
  menus. Avoid global key suppression when it would block normal browser or
  accessible UI behavior.
- Do not announce rapidly changing game state continuously through live regions.
  Treat broader canvas accessibility and motion options as scoped work, not as
  capabilities this guide claims already exist.
- Check layouts at narrow viewports, with longer labels, and with browser zoom.
  Content should remain reachable without requiring a particular display size.

## CSS and visual consistency

- Reuse existing color, typography, spacing, and effect conventions. Prefer shared
  CSS custom properties for recurring design values over near-duplicate literals.
- Keep selectors focused on the component or state being styled. Prefer explicit
  state classes or attributes over deep selector chains and order-dependent hacks.
- Avoid new inline styles and `!important` unless a concrete dynamic value or
  documented override requires them. Follow existing dynamic-style interfaces.
- Separate layout from decoration where practical. Do not use fixed dimensions
  that clip settings, inventory, or translated/longer text unnecessarily.
- Preserve focus indicators, contrast, and usability while retaining the visual
  style. Visual changes need comparable before/after scenes and owner review
  where appearance or feel is subjective.

## Browser APIs, data, and errors

- Target the browsers in the [support matrix](../README.md#browser-support-targets).
  Record actual versions tested. A passing Chromium run is not a Firefox check.
  Check capabilities when an API may be unavailable and provide an appropriate
  fallback or useful message; do not infer capabilities from browser names.
- Use `textContent` for plain text. Do not interpolate player-provided, imported,
  or stored strings into HTML. Keep any necessary markup construction separate
  from untrusted values and validate attributes/URLs at their boundaries.
- Handle storage parsing, validation, and write failures without silently erasing
  local progress. There is no save-compatibility guarantee yet, but local data
  preservation still applies. Never place credentials or private data in the repo.
- Handle expected failures at a boundary that can recover or explain the problem.
  Avoid empty catches and repeated per-frame error logging. Preserve enough error
  context to diagnose a fault without dumping saves or sensitive values.
- Keep audio initialization and other permission-sensitive browser operations in
  the existing user-interaction lifecycle. Do not add network calls or runtime
  CDN dependencies incidentally.

## Review and validation

Use the checks in [CONTRIBUTING.md](../CONTRIBUTING.md#checks) and the issue's
acceptance criteria. Test meaningful outcomes rather than copying implementation
details into assertions. Include relevant failure cases and nearby interactions.

Before handoff, verify the diff contains only intended changes, run
`git diff --check`, and record what ran, what passed, and what remains untested.
Keep player review, physical-controller checks, and measured performance distinct
from synthetic/headless results. Documentation-only edits need document/link and
whitespace checks, not gameplay tests.

The guide is a review standard, not a claim that formatter, lint, accessibility,
or cross-browser automation exists. Propose such tooling separately when there
is a concrete benefit. Do not introduce a build step just to enforce this guide.
