# 022 — Decide whether debug logging is required

Status: Done — decision recorded; logging implementation declined

## Decision

On 2026-11-02, the owner decided not to implement debug logging now:
"debugging can be added when needed" and "I want to keep performance optimal."

Do not add a logging framework, persistent debug log, or always-on diagnostic
stream. Add focused debugging only when a concrete problem needs it. Scope and
validate that work with the problem being investigated.

This closes the decision task without adding logging code. It does not claim
a measured performance improvement. Existing error reporting and player-visible
failure notices remain unchanged.

See the [project decision](../decisions.md#2026-11-02--add-debugging-only-when-needed).

## Consequences

- [Issue 021](021-dev-mode.md) provides repeatable source scenarios without
  requiring a logging subsystem.
- [Issue 034](034-crash-reports.md) remains Planned. This decision does not
  authorize crash reporting, telemetry, a report server, or background logging.
- Future diagnostics must not expose credentials, TURN material, or full saves.
  Any instrumentation should be limited to the investigation that needs it.

## Acceptance criteria

- [x] The owner has decided whether debug logging is required now: it is not.
- [x] No logging implementation is added by this decision task.
- [x] This task adds no default production debug logging.

## Implementation and validation

- Approval source: owner instruction in chat on 2026-11-02.
- Changed documentation: this issue, the backlog index, `docs/TODO.md`,
  `docs/decisions.md`, and decision links in issues 021 and 034.
- No runtime code, dependencies, or settings changed.
- Literal search of `js/` found no `console.log`, `console.debug`,
  `console.warn`, `logger`, or `debugLog` calls/names on 2026-11-02. This is
  a bounded source check, not a runtime or performance measurement.
- Documentation links and `git diff --check` verified. Gameplay tests were
  not run for this documentation-only change.
- Branch: `codex/docs/defer-debug-logging`. Changes are uncommitted.
