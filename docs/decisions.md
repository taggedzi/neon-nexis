# Project decisions

Record accepted project-wide decisions here. Task-specific design decisions belong
in their issue documents under `work-to-be-done/`. Proposals remain explicitly
unresolved until approved. Add a new entry when superseding a decision so the
reason for the change remains visible.

## 2026-10-29 — Task branches and owner-managed review

- Decision: All changes use a task branch. Follow-up work on the same unmerged
  task may reuse its branch. The owner pushes to GitHub, creates the PR, arranges
  review by themselves or another AI, and merges unless explicitly delegated.
- Rationale: Make changes independently reviewable as the project grows toward
  distribution.
- Approval: Explicit owner instruction on 2026-10-29.
- Consequences: `AGENTS.md` governs this workflow. Local issue documents retain
  scope, status, and validation evidence; they do not substitute for PR review.
  Small maintenance tasks need no separate backlog issue.
- Supersedes: The previous workflow did not require task branches.

## 2026-10-29 — Durable decision records

- Decision: Record material decisions during development, including rationale,
  approval source, consequences, and superseded decisions. Keep project-wide
  decisions here and task-specific decisions in their issue documents.
- Rationale: Preserve context beyond chat history for future contributors and
  reviewers.
- Approval: Owner requested ongoing decision documentation on 2026-10-29;
  record location and format are agent implementation choices.
- Consequences: Unresolved proposals remain labeled as such. Decision records
  ship with the related change and link to affected issues where relevant.
- Supersedes: No previous project-wide decision log; issue decision records remain
  in place.

## 2026-10-29 — Browser targets and release policy

- Decision: Target current stable desktop Firefox, Google Chrome, and Chromium
  as development goals, not guarantees. Use date-based application versions rather
  than semantic versioning. Introduce a changelog after a deployment process exists.
  No save-compatibility policy exists during local development; no public deployment
  exists yet.
- Rationale: Establish distribution goals without claiming unverified support or
  imposing library versioning and compatibility promises on the development game.
- Approval: Explicit owner instruction on 2026-10-29. Current stable desktop scope
  is an agent documentation choice; it does not establish OS or device guarantees.
- Consequences: The README contains the target matrix. Deployment and changelog
  work is Planned in issue 013. Exact version format and release procedures remain
  unresolved. Local storage must still be preserved where practical.
- Supersedes: No prior accepted release-version or save-compatibility policy.

## Implementation and validation

### 2026-10-29 — Practical web development conventions

- Approval: Owner requested a practical style guide for developers and AI agents.
  The detailed conventions are agent implementation choices within that scope.
- Decision: Add `docs/web-development-style-guide.md` and link it from the README,
  contributor guidance, and agent instructions. Cover incremental code style,
  module boundaries, game loops, accessible UI, CSS, data handling, and validation.
- Rationale: Provide consistent review guidance for the existing browser game
  without adding a framework, formatter, build dependency, or broad rewrite.
- Consequences: Apply conventions to new and changed code. Existing code is not
  certified compliant; browser support and accessibility remain validation goals.
  No gameplay or runtime behavior changed and no new tooling is implied.
- Validation: Local Markdown link targets and fragments were checked and
  `git diff --check` passed. Runtime tests were not needed for documentation edits.

### 2026-10-29 — Cross-platform whitespace policy

- Owner requested a repository whitespace policy on this branch. Agent choices:
  `.gitattributes` uses automatic text detection with LF checkout on all platforms;
  `.editorconfig` defaults to UTF-8 without BOM, final newline, two spaces, and
  trimmed trailing whitespace. Markdown hard breaks, Makefile tabs, and Windows
  command-script CRLF have explicit exceptions.
- Rationale: Keep diffs consistent across platforms without transforming binary
  assets or adding a formatter/build dependency.
- Consequences: Contributor and agent instructions reference the policy. No
  existing source files are reformatted or bulk-renormalized. EditorConfig needs
  editor support; it is not an automated enforcement check.
- Validation: All existing tracked files were reported as LF by `git ls-files
  --eol` before the change. Attribute checks and `git diff --check` passed after
  the change. No runtime behavior changed.

- Changed files: `AGENTS.md`, `CONTRIBUTING.md`,
  `README.md`, `docs/work-to-be-done/README.md`, issue 013, and this log.
- Documentation-only workflow update; no gameplay or runtime behavior changed.
- Validation: `git diff --check` passed. Referenced local document paths and
  heading anchors were checked against the checkout. No runtime tests are needed
  for this documentation-only change. Owner PR review remains pending. The owner
  authorized committing these documentation changes; pushing and merging remain
  owner-managed.

### Follow-up — Repository ignore rules

- Owner requested a project `.gitignore` on the same branch on 2026-10-29.
- Added focused rules for browser artifacts, designated local profile/save
  directories, credentials, optional development dependencies, caches, and
  editor/OS temporary files. This is an agent implementation choice; source
  images, JSON validation evidence, and shared agent configuration remain trackable.
- Checks: `git diff --check` and representative `git check-ignore` checks passed.
  Existing `.playwright-mcp/` artifacts remain on disk and are now ignored.
