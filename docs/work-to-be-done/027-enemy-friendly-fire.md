# 027 — Enemy friendly fire declined

Status: Done — decision recorded; implementation declined

## Decision

On 2026-11-02, the owner decided not to implement enemy friendly fire.
This closes issue 027 as a decision, without implementing the proposed toggle
or changing combat behavior.

The previous toggle, attack-scope, reward, kill-credit, and co-op proposals
are superseded. They are not approved requirements or pending implementation
work. Reopening this feature requires a new owner decision.

See the [project decision](../decisions.md#2026-11-02--enemy-friendly-fire-declined).

## Consequences

- No enemy friendly-fire setting or damage handling is added.
- Issues 025 and 026 require no friendly-fire attribution changes for this task.
- Issue 001 performance validation remains separate and unchanged. No
  performance improvement is claimed.
- Other planned issues retain their existing scope and status.

## Acceptance criteria

- [x] The owner's decision not to implement the feature is recorded.
- [x] The backlog and todo list identify the proposal as declined.
- [x] This task changes documentation only.

## Implementation and validation

- Approval source: owner instruction in chat on 2026-11-02 to document the
  decision, commit, and merge the update. No additional rationale was supplied.
- Changed files: this issue, `docs/work-to-be-done/README.md`, `docs/TODO.md`,
  and `docs/decisions.md`.
- No runtime code, settings, dependencies, or save formats changed.
- Documentation links and `git diff --check` verified before commit.
- Mandatory pre-push `npm run check` passed on 2026-11-02: syntax, lint,
  unit checks, and all 144 browser tests (Chromium 156.0.8078.4 and Firefox
  157.0 on Windows). This does not claim new gameplay or performance validation.
- Initial documentation commit: `7b5e41c`. The first push failed after passing
  checks because its SSH connection timed out; delivery was retried with
  keep-alive enabled.
- Branch: `codex/docs/decline-enemy-friendly-fire`.
