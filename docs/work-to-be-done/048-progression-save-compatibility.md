# 048 — Preserve saved ships and version progression state and network compatibility

Status: Implemented — needs validation

## Problem or player need

Existing saves can contain excess weapons, pending rewards and old upgrades that cannot be silently discarded.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 047 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement 041-approved policy for checkpoints, named ships, exported/imported backups, old slot counts, retired equipment/cores/modifiers and pending tray/protocol rewards.
- Version and validate equipment IDs, levels/stacks, offensive selection, defense/cooldowns, pacing/XP and reward ledger state. Validate malformed and future versions explicitly.
- Preserve settings/remaps, owner data and existing save recovery export/remove offers. Never trim valuable gear or clear storage silently.
- Finalize 046's wire-version/serialization compatibility and explicit incompatible-peer rejection. Preserve authoritative event outcomes and reconnect recovery without duplicate grants.
- Preserve host permission for saved-loadout use, difficulty, run stats and logbook attribution; loading a strong ship must not become an implicit rebalance.
- Document supported migration cases and any deliberately unsupported cases before enabling the feature.

Discovery starting points (verify against actual code): Verified save-policy/transfer, game serialization, loadouts and co-op wire codecs.

## Alternatives and tradeoffs

Silent simplification of legacy builds would destroy earned progress; compatibility is a rollout requirement, not post-launch cleanup.

## Acceptance criteria

- [ ] Fixture matrix covers old/fresh/current saves, named ships, pending rewards/protocols, oversized inventories, capped items and malformed/future data.
- [ ] Backup round trips and repeated save/continue preserve equivalent state and do not duplicate upgrades or healing.
- [ ] Recovery offers export before removal or explicit removal; tests use isolated storage only.
- [ ] Host/guest version mismatch, reconnection and repeated grant snapshots are tested in multiplayer.
- [ ] No new-mode path is publicly enabled until complete compatibility and 049 cutover checks pass.
- [ ] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

### Implementation — 2026-11-08

The owner authorized the combined 045–049 implementation and delegated parallel
agent work on one shared task branch, `feat/uninterrupted-progression-batch`.
That instruction supersedes the original serial-only prerequisite text for this
batch. No separate branch, push, PR, merge or deployment is part of this child.
Commits are owned by the coordinating agent; none was made by this child agent.

- Added `js/progression-persistence.js`: exact checkpoint 2, named-ship list 2,
  schema/catalog 1 boundaries; all fields validate before replacing stored/live
  progression. Known IDs, hull primary, three slots, selection, caps, XP index,
  safe counters, complete resources and remaining simulation timers are checked.
  Checkpoints retain run/source identities, cumulative participant state, pacing,
  destroyed objectives and live unconsumed pickups. Source counters cannot reuse
  a retained pickup's ID. Cumulative snapshots compact the replay journal.
- Updated `js/game.js` save boundaries and `js/loadouts.js`: continuation restores
  exact earned state/resources without a refill; named ships carry earned gear,
  hull/color and level/XP into a fresh run, with ready cooldowns, full resources
  and no run identity, salvage, buffs or barriers. Launch limits and host loadout
  permission retain their existing owners.
- Updated `js/save-policy.js` and `js/save-transfer.js`: backup format 5;
  unsupported old builds remain unconverted and retain their original bytes for
  the existing explicit export/remove choice. Recovery can target the checkpoint
  or incompatible saved-ship list independently. Detection does not write storage.
  Settings/profile and supported build-free old backups retain their existing
  compatibility/rollback behavior; unsupported backup contents reject as a whole.
- Added `js/coop-progression.js`; updated `js/coop-session.js`, `js/coop.js`,
  `js/coop-wire.js`, `js/coop-host.js` and `js/net.js`: wire 7/lobby loadout rules 2,
  ordered shared outcomes, complete resource revisions, gap replay/cumulative
  recovery, periodic snapshots, host control intent and defense publication.
  Guest participant/loadout/resource claims cannot overwrite the host's earned
  state. Rejoin uses the original hull, progression and life metadata. Initial
  multi-seat recovery sends a final full-roster envelope to every participant.
  Lifecycle snapshots cannot rewind newer earned/resource state. Enemy bullet
  IDs survive wire encoding, allowing Repulsor clears to suppress queued/late
  cosmetic spawns. Effect snapshots remain draw-only on guests.
- Shared-mode transport rejects legacy `pause` and `fire` packets before dispatch;
  global pause coordination and new action intents retain their separate paths.
  The shared two-player browser fixture asserts received legacy packets leave
  host/guest pause state and authoritative mirror coordinates unchanged. These
  new assertions await the coordinating agent's current full-suite execution.
- Continuation preserves the existing world policy: relocate restored ships and
  pickups to valid floor positions, create the initial continuation encounter,
  and retain checkpoint audio/glitch feedback. Rebuilding does not refill earned
  resources or cooldowns.

### Checks and current limits

- `tools/check-progression-persistence.cjs` passed: malformed/future versions,
  retired IDs/oversized old build with pending rewards/protocols, state caps,
  exact raw recovery export/scoped removal in isolated storage, reordered/partial
  resource results, progression dependencies, stale lifecycle snapshot rejection
  and pickup-source collision checks.
- Final restore review added bounded world coordinates and synchronous preflight
  for generation, ship/pickup relocation and the established four-enemy restart.
  Focused Node failures injected at generation, geometry and partial enemy spawn
  preserve the previous run/player/level/camera, entity arrays, mode and timers.
  A successful fixture preserves checkpoint resources and relocation behavior.
  Preflight suppresses Logbook observation; only committed initial enemies are
  published once, and the preflight flag never survives success or failure.
  These checks passed; browser confirmation remains with the full suite in 049.
- `tools/check-coop-wire.cjs` passed: retained version-6 binary fixtures plus
  version-7 enemy-bullet identity and explicit mixed-version decode rejection.
  `tools/check-coop-lobby.cjs` and `tools/check-save-transfer.cjs` passed under
  clearly labeled isolated pre-cutover fixtures. These preserve regression
  coverage of historical behavior; they do not assert playable legacy releases.
- Chromium 156.0.8078.4 on this Windows environment passed four focused browser
  scenarios: two-player public shared rewards with a dropped first event,
  retry/gap recovery, partial resource rejection and offline reward/rejoin;
  hull/new-format restoration and legacy refusal; named-ship backup round trip;
  and named-ship menu operations. Isolated browser contexts supplied storage.
- The first public three- and four-player runs passed launch, firing attribution,
  shared hit/pause, downing and revival, then failed rejoin after a different hull
  was submitted. The retained-hull recovery fix is implemented. Its confirming
  rerun is pending the coordinating agent's full-suite run. No failed scenario
  is counted as passed. Focused browser runners required interruption after
  emitted results because sandboxed PHP teardown hung; this is distinct from
  browser assertions.
- Changed JavaScript passed syntax/ESLint checks; `git diff --check` passed.
  The coordinating agent owns the final full suite, issue-index status and 049
  cutover evidence. Firefox/Chrome, real WAN, physical devices, long-duration
  retained-memory/performance checks, and owner gameplay review remain pending
  unless separately recorded in 049. This issue is not marked Done by these
  focused checks.

### Compatibility decision — 2026-11-08

Agent implementation choice under D2/D11 and the owner's combined-batch request:
retain the reserved format numbers (checkpoint 2, ships 2, backup 5, wire 7,
loadout rules 2); introduction protocol remains 2. There was no version collision
in the inspected checkout. A current cumulative snapshot carries no replay
journal; its participant watermark and source/world state replace older entries.
This bounds serialized state without discarding absent participants' outcomes.
Legacy builds, including apparently fresh legacy ships, have no conversion path.
This implements the approved incompatibility policy and supersedes no gameplay
decision. The public mode switch remains owned by 049's integrated delivery.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/65
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/64
Local source: `docs/work-to-be-done/048-progression-save-compatibility.md`.
Planning documents are on `codex/coop-progression-spec`, not yet pushed/merged.
Wait for the planning handoff and prerequisite before starting implementation.

