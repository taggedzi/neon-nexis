# 036 — Optional extra visual detail declined

Status: Done — decision recorded; implementation declined

## Decision

On 2026-11-05, the owner decided not to implement optional extra visual detail.
This closes issue 036 as a decision. The previous plan, proposals, open
questions, and implementation acceptance criteria are superseded and are no
longer pending work. Reopening this issue requires a new owner decision.

See the [project decision](../decisions.md#2026-11-05--graphics-polish-and-mobile-play-declined).

## Consequences

The existing graphics remain the product presentation. No extra detail setting, shaded-face pass, or related graphics validation is planned.

No gameplay, rendering, controls, settings, saves, or dependencies change.
Other issues retain their existing scope and validation requirements.

## Acceptance criteria

- [x] The owner's decision not to implement the issue is recorded.
- [x] The backlog and todo list identify the proposal as declined.
- [x] This task changes documentation only.

## Implementation and validation

- Approval source: explicit owner instruction in chat on 2026-11-05 to document
  the decision, commit, push, create a PR, and merge into main. No additional
  rationale was supplied.
- Changed files: this issue, `docs/work-to-be-done/README.md`, `docs/TODO.md`,
  and `docs/decisions.md`.
- Validation on 2026-11-05: all 98 local documentation link targets checked,
  new decision anchors verified, and `git diff --check` passed.
- Mandatory pre-push `npm run check` passed: syntax, lint, unit checks, and all
  162 browser tests on Windows with Chromium 156.0.8078.4 and Firefox 157.0.
  This does not establish new gameplay, performance, or mobile support claims.
- The first push failed because GitHub closed the idle SSH connection during
  checks. Delivery is retried with SSH keep-alives and the required hook enabled.
- No graphics comparison, performance measurement, phone trial, or new gameplay
  validation is required for this decision. None is claimed by this closure.
- Remaining work: none for this decision; future implementation needs renewed
  owner approval.
- Branch: `codex/docs/decline-graphics-and-mobile`.
