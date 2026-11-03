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

## 2026-10-29 — Initial CI/CD and save policy

- Decision: Use GitHub Actions and GitHub Pages, with a single manual release
  dispatch, separate from merge. No rollback procedure during development.
- Decision: Use `YYYY.MM.DD.####`, with America/New_York dates and a four-digit
  release-workflow run number that does not reset daily.
- Decision: Developers handle compatibility. Unsupported saves offer export
  followed by removal, or removal without export. Keep compatible saves.
- Decision: Implement JavaScript syntax/lint, existing and future regression
  checks, and browser smoke tests now. Defer later checklist topics.
- Rationale: A small reviewed workflow fits the existing static client-side game.
- Approval: Explicit owner instructions in this chat on 2026-10-29, including
  approval of the timezone and run-number convention.
- Consequences: A minimal public-file staging step is necessary for safe Pages
  publication; it introduces no minifier or bundler. One-time GitHub settings and
  hosted validation remain owner work. No actual publication is authorized here.
- Agent choices: Node 24, ESLint correctness rules without bulk formatting,
  Playwright Chromium/Firefox, fixed local test port, incompatible-save checks
  based on format/map version and readable object structure, unchanged save key.
- Supersedes: The unresolved save compatibility, version format and release
  procedure portions of the earlier browser/release policy above. Browser support
  targets remain in effect; exact date versions and the release procedure are now
  resolved. Issue 013 is implemented and awaiting hosted validation.

See [issue 013](work-to-be-done/013-deployment-and-changelog.md) and the
[operational guide](development-and-releases.md) for scope and evidence.
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

### 2026-10-30 — Co-op shared pause is server-owned

- Owner requested that menus pause all co-op members, that the game only continue
  after every member marks ready, and that a 3-second countdown run on all clients
  before resuming.
- Decision: The signaling server owns the room pause state. Clients send
  `pause_request` and `ready_signal` over the signaling WebSocket (not the WebRTC
  gameplay channel); the server broadcasts `global_pause`, `ready_state`,
  `countdown_start`, and `global_resume`. A countdown is cancelled and the room
  returns to `PAUSED` if a member's socket drops.
- Rationale: Only the server sees every member, so it is the only place that can
  decide when all are ready. Keeping the handshake on the signaling socket avoids
  depending on which gameplay transport happens to be active.
- Approval: Explicit owner instruction on 2026-10-30. Message names, 3-second
  duration, and `PAUSED`/`COUNTDOWN`/`PLAY` states are agent implementation choices.
- Consequences: The old boolean `pause` gameplay message is retired; clients keep
  a local `Coop.pauseState` mirror for UI. Pause state is in-memory and is lost if
  the server restarts. The protocol is documented in
  [docs/coop-protocol.md](coop-protocol.md) and validated by
  `tools/ci/coop-smoke.spec.cjs` (requires Node 20+ for Playwright).
- Supersedes: The earlier co-op note that guest menus could not pause the host and
  that pause ownership was unresolved.
- Superseded on 2026-10-31 by “One PHP co-op path.” The hosting browser owns
  shared pause. The signaling server described here is no longer a play path.

## 2026-10-31 — One PHP co-op path

- Decision: The only co-op play path is PHP, one SQLite file, an opt-in STUN or
  TURN list in a server config file, and a WebRTC data channel. PHP introduces
  the browsers. The hosting player's browser owns lobby membership, ready-up,
  launch, shared pause, respawns, revival, and rejoin. There is no gameplay
  relay and no Node signaling process.
- Rationale: Ordinary and free PHP hosting cannot run a Node signaling process,
  and two introduction servers should not be maintained.
- Approval: Explicit owner instruction on 2026-10-31, including the instruction
  to implement issue 015. That instruction approves writing the PHP scripts and
  changing the client. The config file, SQLite, a 10-minute crash cleanup, a
  daily sweep of rows older than 24 hours, and the 30-second host check-in are
  the owner's choices. The 2-hour default TURN credential lifetime is an agent
  default recorded in the issue, and the config file can change it.
- Consequences: The sample config leaves co-op off. CO-OP UPLINK stays visible
  and is disabled until the admin enables at least one address. A direct link
  that never opens stays on the co-op screen. Details and checks are in
  [issue 015](work-to-be-done/015-php-coop-introduction.md).
- Supersedes: The 2026-10-30 decision that the signaling server owns shared
  pause. It also supersedes the issue 015 note that writing the PHP scripts was
  not approved by the original request.

## 2026-10-31 — Fight messages will use a binary payload

- Decision: Co-op fight messages will use a versioned binary layout. Lobby,
  pause, and one-time setup stay JSON. An ordinary ship `state` will no longer
  carry the full participant snapshot. A version mismatch closes the link.
  Tick rates, positions, and host authority stay as they are.
- Rationale: Free STUN and TURN relays have a low byte budget. The owner wants
  room for up to four players later without paying for relay bandwidth. STUN
  still only discovers addresses. The saved bytes are data-channel bytes.
- Approval: Owner approved the plan on 2026-10-31. The field widths, type
  bytes, and size ceilings are agent implementation choices recorded in
  [issue 016](work-to-be-done/016-coop-binary-payloads.md).
- Consequences: The codec is on `feat/coop-binary-payloads`. Both browsers
  must load the same build. A version mismatch closes the link once.
  Four-player links, deflate, and delta worlds are out of scope. Measured
  sizes and the field-width choices are in issue 016.
- Supersedes: Nothing.

## 2026-11-01 — Local checks before push

- Decision: Routine pushes do not run the check suite on GitHub Actions. A
  pre-push hook runs `npm run check` on the developer machine and rejects the
  push when it fails. The manual Publish game workflow still runs that suite
  against the staged site before deploying.
- Rationale: Actions minutes are shared across the owner's repositories. The
  browser suite was about 14 minutes on every push to main and on pull requests.
- Approval: Explicit owner instruction on 2026-11-01.
- Consequences: `node tools/ci/install-hooks.cjs` points this clone at
  `.githooks`. `npm ci --ignore-scripts` does not install the hook; the
  development guide lists that command. `git push --no-verify` skips the hook.
  A delete-only push skips the suite. Browser tests run fully parallel with at
  most 4 workers, an agent choice so the single PHP test server is not flooded.
  Issue 013 stays Implemented — needs validation because hosted publication is
  still unvalidated.
- Supersedes: The part of the 2026-10-29 CI/CD decision that ran the check suite
  on pull requests and pushes to main. Pages publication, the manual release
  dispatch, versions, and the save policy stay in effect.

## 2026-11-01 — One current branch, rebased on main

- Decision: Keep one task branch and one open pull request in flight. Fetch and
  fast-forward local `main` before starting a new branch. Rebase the task
  branch onto `origin/main` before pushing and before merging. Do not merge
  `origin/main` into a task branch. The pre-push hook rejects a branch push
  that is behind `origin/main` or that adds a merge commit.
- Rationale: The owner works alone, with one AI at a time, on one issue at a
  time. Branches still conflicted because a second branch was cut from a stale
  `main`, and because merging `main` into a task branch made GitHub unable to
  rebase the pull request. The shared conflict file has been the backlog index.
- Approval: Owner instruction on 2026-11-01.
- Consequences: [AGENTS.md](../AGENTS.md#stay-current-with-main) is the
  procedure. A blocked issue is recorded and left; it does not authorize a
  second branch. `--force-with-lease` is allowed only on the task branch after
  a rebase. `main` is never force-pushed.
- Supersedes: The allowance, in the 2026-10-29 task-branch workflow, to start
  from a local `main` whose remote freshness is unknown, and the allowance to
  continue a different issue while blocked.

## 2026-11-01 — Pointer capture and pause on focus loss

- Decision: During play, a primary click on the playfield requests pointer
  lock when the "capture pointer while playing" setting is on. The setting
  defaults on. Pause, or any leave from play, releases the pointer. Window
  blur or a hidden document calls `G.pauseGame`, including when capture is off
  or the browser denied it. Co-op uses that same pause, which already requests
  the shared pause. Esc remains the remapped pause action. If the browser
  consumes Esc to leave pointer lock, that unlock opens pause.
- Rationale: A click on another monitor was leaving the run live. Pointer lock
  cannot be forced, so focus loss has to pause whether or not capture succeeded.
  A second pause flag would desync co-op.
- Approval: Owner instruction on 2026-11-01, recorded in
  [issue 019](work-to-be-done/019-pointer-lock-and-focus-pause.md). The owner
  chose default on, and release as soon as pause opens. The remaining behavior
  is the issue's Do list, which the owner asked to implement.
- Consequences: Old settings blobs stay valid. Touch does not request lock.
  Returning focus does not resume the run and does not restore held movement
  or fire. A neutral stick is still required after the pause.
- Supersedes: Nothing.

## 2026-11-01 — Voluntary save backup file

- Decision: One JSON file, file version 1, holds the stored checkpoint and
  settings, including control bindings. It does not hold the co-op browser
  identity. Import always asks, and it runs only from the main menu. A file
  this build cannot load does not change local storage. Later profile lists
  extend this file with a new file version rather than a second export path.
- Rationale: The player needs to move a run to another browser without a
  server, and without a live checkpoint overwriting the file they just imported.
- Approval: Owner instruction on 2026-11-01, recorded in
  [issue 020](work-to-be-done/020-save-export-import.md).
- Consequences: Issues 024, 025, and 026 should add their stored data to this
  file. The incompatible-save export/remove dialog is unchanged.
- Supersedes: Nothing. The 2026-10-29 rule that unsupported saves offer export
  or removal stays in effect.

## 2026-11-01 — Source-only scenario commands

- Decision: Issue 021 uses console commands, without a password or panel, in
  source single-player sessions only. Production staging omits the command file
  and script tag. Commands cover hull/color, weapons, player level, sector,
  named enemy spawning, invulnerability, and kill-all. File import stays in 020.
- Rationale: Repeatable setups without playing to the desired state.
- Approval: Owner agreed to both scope recommendations in chat on 2026-11-01.
- Consequences: Dev runs save only through the normal manual checkpoint action.
  Normal new runs and loaded stored checkpoints retain ordinary save behavior.
  See [issue 021](work-to-be-done/021-dev-mode.md) for implementation choices.
- Supersedes: Nothing.

## 2026-11-02 — Add debugging only when needed

- Decision: Do not implement a debug logging subsystem now. Add focused
  debugging when a concrete problem requires it.
- Rationale: The owner wants to keep performance optimal and avoid diagnostic
  work without a current need. No performance improvement is claimed or measured.
- Approval: Owner instruction in chat on 2026-11-02: debugging can be added
  when needed. See [issue 022](work-to-be-done/022-debug-logging.md).
- Consequences: Issue 022 is Done as a decision with no logging code added.
  [Issue 021](work-to-be-done/021-dev-mode.md) needs no logging subsystem.
  [Issue 034](work-to-be-done/034-crash-reports.md) remains a separate,
  unapproved proposal. Existing error reporting stays unchanged.
- Supersedes: The unresolved logging proposal in issue 022; this records the
  owner's decision rather than approving a logging implementation.


## 2026-11-02 — Ordered progression features and Hardcore persistence

- Decision: Implement issues 023, 024, 025 and 026 in order, merging each into
  main before starting the next. The owner explicitly delegated these merges.
- Rationale: Keep one active issue and avoid stale branches for shared storage
  and menus.
- Approval: Owner instruction in chat on 2026-11-02.
- Consequences: Use a separate task branch and validation record for each issue;
  no next issue begins before the previous merge. Owner playtesting remains
  distinct from agent checks.
- Supersedes: Owner-managed push/PR/merge delivery for these four issues only.

- Decision: Medium keeps current combat and the last skill choice persists.
  Hardcore uses Hard combat in single-player and co-op, allows fresh pilots
  only, removes its single-player checkpoint on death and offers no restore.
  Co-op has zero revives, including at sector boundaries; dead players stay
  spectators until the whole team dies. Preserve settings, named loadouts,
  lifetime stats and logbook. Co-op preserves separate single-player saves.
- Rationale: One life ends the pilot's run without deleting the player's profile.
- Approval: Owner answers in chat on 2026-11-02. Approved initial numeric values
  and detailed implementation choices are recorded in
  [issue 023](work-to-be-done/023-skill-levels.md#implementation-and-validation).
- Consequences: Issue 024 must disallow loadout starts in Hardcore; issues 025
  and 026 must preserve their profile data after Hardcore death. Combat feel
  still requires owner playtesting.
- Supersedes: Single-player-only Hardcore and unresolved wipe proposals in 023.


## 2026-11-02 — Named earned ships and sector unlocks

- Decision: Keep up to three uniquely named earned ships (32-character names),
  storing hull/color, level/XP, equipment, cores and slot counts without power
  scaling. A new map may begin up to that ship's highest reached sector. Hardcore
  requires fresh pilots. The owner accepted the completed strong-ship rule.
- Rationale: Preserve earned pilots and shorten the route to later sectors.
- Approval: Owner answers in chat on 2026-11-02; see
  [issue 024](work-to-be-done/024-named-ship-loadouts.md).
- Consequences: Co-op requires host opt-in, defaults off, displays chosen ships
  before readiness, and limits the starting sector to every pilot's unlock.
  Unknown equipment prevents a launch visibly without removing the stored ship.
  Hull/color remain fixed within a run; checkpoint deletion preserves ships.
  Backup version 2 includes the list; version 1 imports preserve an existing list.
- Supersedes: Conflicting unapproved sector-1-only and co-op proposals in 024;
  extends the version-1-only backup rule without changing its confirmation flow.


## 2026-11-02 — Local player tallies and lifetime profile

- Decision: Record per-match and lifetime counters in a profile shared by all
  named ships, included in backups and retained after Hardcore death. Default
  recording on; off hides match boards and stops new counts, preserving history.
  Existing end-of-run data remains alongside the new tally.
- Rationale: The owner wants personal progress records without a public score
  service, with precise per-shot and inventory-event meanings.
- Approval: Owner answers in chat on 2026-11-02; exact counters and definitions
  are recorded in [issue 025](work-to-be-done/025-player-stats.md).
- Consequences: Host confirms co-op shot hits, kills and objectives; clients own
  their other counters and supply their board rows. Show a board on team wipe
  and departure; use the latest remote row on departure. Profile persistence is
  shared with issue 026. Backup version 3 adds the profile, while versions 1/2
  preserve any existing profile. Hardcore removes its checkpoint, not totals.
- Supersedes: Unapproved attribution/toggle/profile proposals in 025; extends
  the version-2 named-ship backup decision with the same confirmation flow.

## 2026-11-02 — Lifetime enemy logbook

- Decision: Catalog every enemy style, grouped by role, with undiscovered names
  hidden as Unknown. Use concise factual copy from current behavior. Discover
  enemies present in the sector, including alive enemies on co-op join and later
  spawns. All present participants discover; only the killing pilot receives a
  destruction count, with the host confirming guest credit.
- Rationale: Keep encounters and personal kills distinct in a persistent catalog.
- Approval: Owner answers in this chat on 2026-11-02; see
  [issue 026](work-to-be-done/026-enemy-logbook.md).
- Consequences: Logbook recording remains on when player stats are off and
  survives Hardcore death. It shares the lifetime profile. Backup version 4
  includes the book; older backups preserve the destination's existing book.
  Agent implementation choice: profile schema 2 migrates schema 1; cumulative
  per-participant confirmations avoid duplicate kill credit on retries/rejoin.
- Supersedes: Unapproved structure, discovery, boss ordering and Hardcore wipe
  questions in issue 026. Extends the version-3 backup decision using the existing
  confirmation and four-key rollback flow.

## 2026-11-02 — Enemy friendly fire declined

- Decision: Do not implement enemy friendly fire; close issue 027 as a decision.
- Rationale: The owner chose not to pursue the feature. No further reason was
  supplied; no performance or balance benefit is claimed.
- Approval: Explicit owner instruction in chat on 2026-11-02 to document,
  commit, and merge this update.
- Consequences: No toggle, damage, reward, or kill-credit changes are added.
  Issues 025 and 026 need no friendly-fire integration for this task. Other
  issues retain their scope and status. See
  [issue 027](work-to-be-done/027-enemy-friendly-fire.md).
- Supersedes: The unapproved feature proposals and open questions in issue 027.
  Any future implementation requires a new owner decision.

## 2026-11-02 — Four-player co-op scope

- Decision: Fixed capacity of four, actual roster determined by connected ready
  players at launch; no count selector. Lock that roster during each run and
  allow its participants to reconnect. Use a host-centered star and a new wire
  version that refuses older clients. Keep respawn and difficulty rules unchanged.
- Rationale: The owner wants invitations to determine group size and explicit
  control over bringing earned ships into a match.
- Approval: Owner instruction and answers in chat on 2026-11-02; see
  [issue 028](work-to-be-done/028-coop-four-players.md).
- Consequences: Host-controlled saved loadouts default off. When enabled, each
  player explicitly opts into a saved ship; otherwise they start fresh. Protocol,
  PHP introduction, and client updates must ship together. Merge is authorized;
  deployment remains separate. Owner multiplayer validation is still required.
- Supersedes: Issue 028's proposed count selector and per-player respawn formula.

## 2026-11-02 — Hull roles for new runs (issue 029)

- Decision: implement the exact owner-approved table in [issue 029](work-to-be-done/029-ship-stats-and-colors.md).
- Approval source: owner's voice-chat approval explicitly relayed in the implementation request on 2026-11-02.
- Rationale: distinguish fast scout, heavy, balanced and glass cannon roles while preserving the current visuals.
- Consequences: colors stay cosmetic; weapons/upgrades remain shared; shapes and outline hitboxes stay unchanged. New solo/co-op runs use hull bases before upgrades. Existing checkpoints retain legacy bases through later rebuilds. This supersedes issue 002's equal-stat hull decision only.
- Agent implementation choice: named saved ships begin new runs using current hull bases and saved equipment/upgrades, rather than freezing old hull balance. Checkpoints remain distinct from named ships.
- Owner playtest approval, 2026-11-02: the owner played the game and likes the changes; the follow-up instruction explicitly accepts hull handling/balance. This completes the pending subjective acceptance for issue 029. No detailed per-hull/device/WAN test is claimed.

## 2026-11-02 — Optional production minification

- Decision: Minify separate HTML, CSS, and classic JS files through the existing
  public packager. Publish defaults to minified output with an explicit
  unminified switch. Keep local source play build-free, retain LICENSE/version
  metadata, publish no source maps, and add no image tooling while the artifact
  contains no images.
- Approval: Owner explicitly approved the proposed scope and pinned build-only
  dependencies in chat: Terser 5.51.2 (BSD-2-Clause), Clean-CSS 5.3.3 (MIT), and
  HTML-Minifier-Terser 7.2.0 (MIT), after direct/transitive licensing review. See
  [issue 032](work-to-be-done/032-production-minification.md).
- Rationale: Reduce the production transfer size while keeping the unminified
  fallback, source workflow, namespace properties, and load order intact.
- Consequences: No bundling or property renaming. Agent implementation choice:
  strip comments/whitespace with JS compression and mangling disabled, CSS level
  0, and conservative HTML whitespace. Stage validation must serve actual public
  bytes; the co-op PHP endpoint remains a CI fixture rather than an artifact file.
  [Issue 033](work-to-be-done/033-github-release-packages.md) must reuse this
  packager for both download variants. No publication is authorized here.
- Supersedes: Issue 013’s minification deferral only. Deployment validation,
  changelog setup, source maps, bundling, and broader release work retain their
  existing limits.
