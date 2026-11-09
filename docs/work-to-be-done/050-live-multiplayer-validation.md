# 050 — Validate live multiplayer progression with other players

Status: Blocked

## Problem

Implementation for #57, #64 and #66 is merged, but the remaining real-player
validation requires the live game, other players and applicable devices. The
owner requested closing those implementation trackers and transferring their
unfinished validation into this follow-up on 2026-11-09. No test date is set.

## Evidence

- Implementation revision is `63969301063ebfe6c18d6bda0c6119bd86da0988`, merged
  in [PR #74](https://github.com/taggedzi/neon-nexis/pull/74). Test the current live
  revision when this work resumes and record any differences.
- Source requirements are `docs/progression-contracts.md`, section
  `Validation gates for 049` beginning at line 549, plus
  `docs/work-to-be-done/040-uninterrupted-coop-progression.md`,
  `047-progression-controls-and-hud.md` and
  `049-progression-integration-validation.md` in that same directory.
- The implementation's registered syntax, lint, Node and browser suite passed
  with 220 browser tests and two opt-in measurement cases skipped. Synthetic
  controller/network cases and four-context observations are documented in 049.
- Owner gameplay approval and actual-machine solo performance are recorded in
  049. Short Chromium normal/heavy presentation p95 was 13.386/13.367 ms. A
  twenty-active-minute solo run reached sector 3 with callback interval p95
  13.4 ms in every minute, repeated field/particle expiry and a journal bounded
  at 256 events. This establishes solo evidence under its recorded conditions.
- Live multiplayer/WAN, physical controllers and four-player readability remain
  unverified. Earlier four-context workloads shared one machine and were slow.
  The solo extended run did not include participant disconnect/rejoin or retained
  object comparisons at equivalent quiet checkpoints.
- Validation notes are currently local on
  `docs/066-firefox-performance-validation`, pending documentation delivery.
  Preserve their artifact hashes and limitations. Keep raw profiles, saves and
  personal data out of commits and public issue attachments.

## Impact

The remaining unknowns concern shared progression, controls, readability,
performance and recovery during actual multi-person play. Closing the original
trackers transfers these checks here. Their unchecked criteria remain unverified.

## Recommended approach

Resume when the game is live and the owner can recruit other players. Start by
reading AGENTS.md and the linked local records. Inventory the unchecked criteria
and the deployed revision. Use separate real machines with 2–4 participants,
including a four-player session and real WAN connections. Preserve High/default
visual quality, effects, settings and existing saves. Record each environment,
input device, workload, outcome and limitation. File independently reproducible
bugs separately and link them here. Balance changes require owner decisions.

## Acceptance criteria

- [ ] Record deployed revision, OS, CPU/GPU/RAM, browser versions, rendering mode,
  CSS viewport, DPR, backing size, quality and input devices for tested machines.
- [ ] Exercise 2–4 real players, mixed hulls and saved levels, shared rewards and
  automatic levels, all offensive slots/defense, downing/revival, host-approved
  rejoin, pause/focus, resizing, menus, sector advance and save/continue.
- [ ] Confirm rewards are granted exactly once across disconnect/rejoin and
  lifecycle transitions. Record WAN behavior and recovery. Recheck relevant
  dropped/reordered/stale-message cases with existing automated fixtures.
- [ ] Measure matched normal and reproducible heavy scenes, retaining the
  120-enemy fixture and warmup counts. Include simultaneous four-player missiles,
  arcs, bombs, fields, Aegis and Repulsor. Record displayed interval p50/p95/p99,
  simulation/render cost, entity counts and presentation method against the
  existing p95 ≤16.7 ms target at the contract's viewport/default quality.
- [ ] Run twenty real minutes with rendering, repeated effect bursts, sector
  transitions and a disconnected/rejoining participant. Sample memory, entities
  and journal/buffer counts at least once per minute. Compare three burst/expiry
  cycles and equivalent quiet checkpoints, explaining surviving entities and
  recorder overhead. Investigate unexplained retained growth.
- [ ] Record four-player threat/readiness/slot readability and owner approval of
  friendly progression, accessibility, hull solo viability, primary-only play,
  optional switching, early weapon timing, random builds and full/maxed rewards.
  Complete only those subjective cases actually reviewed by the owner/players.
- [ ] Record physical-controller remapping, direct/cycle/defense use, hold/release,
  neutral/disconnect, focus/pause and accessibility checks with actual devices.
- [ ] Carry forward any still-unverified browser, paired visual comparison and
  retention cases from the originals. Record Firefox, Google Chrome and Chromium
  separately when available. Unavailable checks remain explicitly pending until
  completed or explicitly waived by the owner.
- [ ] Update local evidence and issue status together. Record failures and related
  bugs without describing unperformed checks as passing.

## Validation

Use the existing source server command `python -m http.server 8000` only after
checking interpreter availability and existing servers. The game runs from source
without a build. Follow `docs/dev-mode.md` for reproducible scenarios and
`docs/progression-contracts.md` for workloads. Use `npm run check` for the
registered suite and `git diff --check` for tracked changes. These commands do
not replace real-player measurements. Use browser presentation traces for the
displayed-frame target and record callback cadence as a distinct metric. Review
`tools/performance/benchmark.js` for existing workload setup. Do not treat its
accelerated simulation as twenty real minutes of continuous rendering.

## Dependencies

Implementation was delivered through PR #74. Follow-up to #57, #64 and #66.
Blocked on live availability, other players and required devices/environments.
Existing bugs #72 and #73 may affect roster/rejoin and guest pickup-range cases.
Check their current state and fix or explicitly account for them before drawing
acceptance conclusions about those behaviors. No automatic deployment is scoped.

## Implementation and validation

Created on 2026-11-09 by explicit owner request to transfer remaining checks from
#57, #64 and #66. Planning and evidence consolidation only. No new gameplay test
or code change is claimed. Completed evidence stays in 049. Resume conditions
are live multiplayer availability and access to other players. Owner manages
scheduling. GitHub follow-up is [#75](https://github.com/taggedzi/neon-nexis/issues/75).
