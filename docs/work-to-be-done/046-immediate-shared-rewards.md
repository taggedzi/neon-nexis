# 046 — Implement immediate shared rewards, automatic levels and team pacing

Status: Done

## Problem or player need

Equipment and level rewards currently require choices and can slow a whole co-op run.

## Related work and dependencies

Parent: [040 — Uninterrupted cooperative progression](040-uninterrupted-coop-progression.md).
Prerequisite: local issue 045 completed and handed off/merged. Work serially in the parent sequence.
The parent spec controls approved scope; proposed tuning requires issue 041 approval.
Read this issue and 040 before editing. Do not start sibling work or parallel branches.

## Proposed change and ownership

- Implement primary/offensive/defensive/passive reward categories with immediate grants, per-player authoritative random offensive/defensive installation, and shared passive type.
- Fill empty additional slots before upgrades; use the approved full/maxed slot, tie-break and fallback rules. Never auto-replace or auto-select equipment.
- Implement unique event identity, participant outcome storage and idempotent application across simultaneous collection, retry, downing, disconnection and rejoin.
- Preserve locked starting roster and host-approved saved-loadout policies; reward original eligible participants regardless of collection proximity.
- Replace pending level-up choices with 041-approved automatic progression; implement repair/buff sharing and capped outcomes.
- Implement team-wide pacing including early weapon opportunity, boss/cache/luck behavior and difficulty/saved-level interaction. Expose summary notifications for 047.
- Own live grant/transport sequencing; coordinate version constants and serialization adapters with 048. Do not activate the new player experience before 049.

Discovery starting points (verify against actual code): Verified game reward/pacing, XP, co-op grant and wire modules.

## Alternatives and tradeoffs

Shared grants multiply team power; counting enemy drops per player would over-accelerate progression. Network correctness needs concrete outcomes, not shared random seeds alone.

## Acceptance criteria

- [x] Controlled reward sequences prove deterministic upgrades and independent recorded random outcomes without requiring all players to differ.
- [x] Duplicate/reordered/retried messages and simultaneous collection yield one outcome per eligible participant; reconnect does not reroll.
- [x] Downed/disconnected original players recover rewards; new mid-run participants are not introduced.
- [x] XP/drops and full/maxed inventories cannot open a choice screen, silently lose progression or generate unlimited fallback healing.
- [x] Solo and 2–4-player pacing measurements use comparable workloads and record actual reward counts.
- [x] Update this record and the backlog together with changed files, actual checks,
  limitations, owner decisions and relevant hashes. Do not claim sibling acceptance.

## Implementation and validation

Implemented on 2026-11-08 in the owner-authorized 045–049 batch, with parallel
ownership of the agreed module boundaries. The owner's batch instruction
supersedes this issue's earlier serial prerequisite for this delivery.

Changed files: `js/progression-rewards.js`, `js/progression-runtime.js`, reward
and lifecycle branches in `js/game.js`, simulation adapters in `js/sim.js`,
enemy reward routing in `js/enemies.js`, attribution in `js/player-stats.js`,
the canonical source-scenario adapter in `js/dev.js`, `docs/dev-mode.md`,
`tools/ci/dev-mode.spec.cjs`, and `tools/check-progression-rewards.cjs`.
Shared mode uses the 049 activation flag;
the explicit legacy construction argument remains available to regression
fixtures. Script loading, controls, persistence and transport are owned by the
corresponding sibling work and are verified with the integrated batch.

The authoritative run retains the original roster, concrete equipment/passive/XP
outcomes, cumulative resources and separate progression/resource revisions.
Collection prepares all participant results before consuming the source and
publishing. A failed send leaves the committed result available for retry;
duplicates do not heal or reroll. Automatic levels apply in order, without a
pending protocol queue. Additional offense fills slots before stable lowest-level
upgrades; passive types are rolled once for the team. Capped outcomes record
actual repair and salvage. Temporary consumables exclude offline/downed players;
permanent equipment and XP do not.

The ordinary budget is run-wide: 18 combat seconds/four deaths initially,
36 seconds/eight deaths afterward, with the approved category weights. Every
enemy death can emit an earned ordinary item without the old random drop gate.
Equipment-bearing caches/anchors use the same budget. Bosses add one separately
identified bonus; old weapon/mod cascades are suppressed. Existing independent
consumable source chances and boss repair/shield behavior remain.

Engineering decisions (agent implementation choice, 2026-11-08, authorized by the
batch request): retain at most 256 replay events and 32 optional local outcome
records; compact saved/rejoin state to cumulative snapshots with empty replay
journals. Persist a monotonic `nextSourceSequence` alongside the run token so
checkpoint restoration cannot reuse a live pickup or enemy XP-source ID. XP
contexts resolve IDs to the canonical live world object; replacement objects
cannot become a second grant, and removed sources cannot be replayed. World
objects carry their consumed marker; no unbounded historical pickup-ID set is
retained. These choices
implement the existing contract and add no new gameplay rule.

Checks run: `node tools/check-progression-rewards.cjs` passed under Node.js
26.13.0 on Windows. The controlled fixtures cover four independent installations
(including a coincident roll), offline/downed rewards, duplicate/reordered event
application, cumulative snapshot recovery, capped repair/salvage, newer resource
revision precedence without losing older salvage, temporary consumable
ineligibility, a failed publisher, automatic multiple levels and 300 events with
bounded replay. The fixture loads the real 048 persistence validator to check the
event-to-snapshot boundary. ESLint passed for the new modules, checks and changed
live files. `node tools/ci/syntax.cjs` passed.
`git diff --check` passed before handoff.

Comparable synthetic pacing fixture: each of 1, 2, 3 and 4 participants used
180 active combat seconds and one team death every four seconds (45 deaths).
Each run emitted five ordinary equipment items at seconds 20, 56, 92, 128 and
164, plus one explicit boss bonus. The first ordinary category was additional
offense in every run. This establishes player-count-independent budget counts,
not real-player timing or balance acceptance.

Remaining validation: integrated browser paths, adversarial transport and rejoin,
save/continue, physical devices, real WAN play and owner pacing/build review.
These are not claimed by the isolated reward tests. Root batch validation may
append its actual results here. No separate commit by this agent; the batch
owner records the delivery hash after its focused commit.

Integration review corrections: shared defense bindings bypass the old reward
tray action; guests cannot regenerate authoritative HP/shield; a downed host is
not healed by sector completion before existing revival policy runs. New catalog
labels appear in pause/completion summaries. Shared remote shots, physical
pickup collection and accepted damage retain their original participant's
match/lifetime attribution through cumulative authority counters. The dev
scenario helper uses fixed slots and automatic passive levels and blocks saving
throughout construction; the browser regression is updated but remains pending.

### Final integrated verification — 2026-11-08

Implementation is committed on `feat/uninterrupted-progression-batch`:
`f68c649` (045 stats/upgrades), `c68bf80` (owner-approved loopback tooling),
and `18ae201` (046–049 integration, regressions and implementation records).
The final `npm.cmd run check` exited 0: syntax, ESLint, all registered Node
checks, and **220 browser tests passed; two opt-in measurement cases skipped**.
Environment: Windows, Node v26.13.0, Playwright Chromium 156.0.8078.4 and
Firefox 157.0; two workers, zero retries. The run used
`NEON_TEST_ENABLED_PORT=44321`, `NEON_TEST_SAMPLE_PORT=44322` and
`NEON_TEST_WORKERS=2`. The skipped measurements were exercised separately in
Chromium; see 049 for observations and their limits. `git diff --check` passed.

This clean run supersedes earlier intermediate failed/hung attempts recorded
above. Test-only Firefox loopback ICE preferences make disposable local peers
independent of LAN multicast discovery; production networking is unchanged.
Physical controllers, separate-machine/WAN play, separately installed Chrome,
owner feel/balance/readability and real-player performance remain unverified.
No owner's browser storage was cleared. No push, PR, merge or deployment was
performed. See [049](049-progression-integration-validation.md) for the combined
handoff and remaining validation.

The clean browser suite confirms public solo and 2-4-player progression, lost-event recovery, repeated snapshots, original-roster rejoin, downing/revival and no reward-choice interruption. The comparable 1-4-player reward counts above satisfy the controlled pacing criterion; natural pacing and balance remain with the parent owner playtest.

## GitHub coordination

Implementation ticket: https://github.com/taggedzi/neon-nexis/issues/63
Parent: https://github.com/taggedzi/neon-nexis/issues/57
Prerequisite: https://github.com/taggedzi/neon-nexis/issues/62
Local source: `docs/work-to-be-done/046-immediate-shared-rewards.md`.
Delivered locally on `feat/uninterrupted-progression-batch` under the owner's combined-batch authorization. GitHub issue closure and PR delivery remain owner-managed; the local tracker records current validation.
