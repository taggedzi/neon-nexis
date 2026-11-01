# 022 — Decide whether debug logging is required

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 6 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

The todo asks a question, not for a logger: is debugging logging required, where
should it go, and if not, why not?

## What exists today

The game scripts under `js/` do not call `console.log`, `console.debug`, or
`console.warn`. Audio scheduling swallows its own errors so a sound failure
cannot break the frame loop. Browser tests fail the page if unexpected console
errors appear.

Co-op failures use the existing player-visible notices and the protocol's
retry rules. They are not a log stream. TURN secrets and provider API keys stay
on the PHP server. The browser receives only the minted `iceServers`.

There is no logging service and no log file.

## Determine

- Which recent bugs were slow because there was no log. If the answer is none,
  that is evidence against a framework.
- Whether any current `catch` block hides a failure the player cannot see and
  a developer cannot reconstruct. Sample the co-op and save paths rather than
  reading every file.
- Whether a test page can already reach the same state through
  [issue 021](021-dev-mode.md) and the existing `tools/` checks.

## Decide

This issue is the decision.

Proposal, not approved: do not add a logging framework.

Reasons:

- The client is the whole game. A log that is on in production costs frames and
  can leak a room code, a save, or a peer id into a shared console.
- The current pattern is intentional: failures that the player must see become
  a notice. Failures that must not stop play are contained. Tests treat unexpected
  console errors as failures.
- A general logger would need levels, a sink, redaction, and a review of every
  call site. That is a feature of its own, and nothing in the todo names a bug
  that needs it.

If a later bug needs traces, add those traces under the dev-mode switch from
[issue 021](021-dev-mode.md), default off, and never log TURN material, API
keys, or a full save. Remove or keep them only for that bug. Do not send logs
to a server under this issue.

The owner can reject this proposal and name the subsystems that must log. Until
that list exists, no logger should be built.

## Do

If the proposal is accepted:

- Record the decision in [the decision log](../decisions.md) and close this
  issue as Done with no code change.
- Point [issue 021](021-dev-mode.md) and [issue 034](034-crash-reports.md) at
  that decision.

If the proposal is rejected:

- Write the approved destinations and the banned fields into this issue before
  any logging code.
- Keep production default off.
- Add a test that a known secret string does not appear in the log output.

## Acceptance criteria

- [ ] The owner has accepted or replaced the proposal above.
- [ ] No logging code is added unless the replacement names where it goes and
      what it must never record.
- [ ] Production play still does not write a debug log by default.

## Open questions

- Is there a specific bug, already in hand, that this decision should wait on?

## Dependencies

Shares the dev switch with [issue 021](021-dev-mode.md). The decision can be
made before that mode exists. [Issue 034](034-crash-reports.md) should not
invent a second telemetry channel that this decision rejected.

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
The absence of `console.log` in `js/` was checked on 2026-11-01.
