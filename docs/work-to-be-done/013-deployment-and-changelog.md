# 013 — Create a deployment process, then introduce a changelog

Status: Planned

## Scope

Define a deployment process for this client-side application. Introduce a
changelog after that process exists. This is future work, not authorization to
deploy, select hosting, or implement release automation now. The game currently
runs only on the owner's local development PC.

## Accepted decisions

Owner instructions on 2026-10-29:

- Use date-based application versions rather than semantic versioning.
- Introduce a changelog after a deployment process has been created.
- No save-compatibility policy exists during current local development.
- Target Firefox and Chrome/Chromium; these are goals, not guarantees. See the
  [README support matrix](../../README.md#browser-support-targets).

See also the [project decision log](../decisions.md).

## Open questions

- Hosting, deployment method, and release approval/rollback procedure.
- Date format, timezone, and how to distinguish releases on the same day.
- Changelog location, format, and integration with the eventual release process.
- What save-compatibility policy is appropriate before public distribution.

## Acceptance criteria

- [ ] Owner approves a deployment plan and release procedure.
- [ ] Implement and validate the approved deployment process.
- [ ] Document the chosen date-based version convention.
- [ ] After the deployment process exists, introduce a changelog and document
  how release entries are maintained.
- [ ] Resolve and document the save-compatibility policy before public release.

## Implementation and validation

- Implementation has not started. This issue records future work only.
- Documentation records the owner's current decisions; no deployment, changelog,
  release version, or save migration has been implemented.
- Remaining work: resolve open questions, obtain scope approval, implement, and
  validate the deployment and changelog workflow.
