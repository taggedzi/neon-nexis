# 028 — Raise co-op capacity to 4

Status: Implemented — needs validation

Implementation started on 2026-11-02. Owner-approved decisions below supersede
the original proposals. Implementation and automated checks are complete; owner
multiplayer/WAN and real-player performance validation remain pending.

Priority 12 of 21 in the proposed order in [the todo list](../TODO.md).

## Accepted decisions — 2026-11-02

- Owner instruction: choose single-player or co-op. Co-op capacity is fixed at
  four, including the host; there is no player-count selector. The connected,
  ready roster at launch determines the actual match size. Share invitations
  only with the intended players using the existing room-code flow.
- Owner approval: use a host-centered star, introduce a new wire version, and
  explicitly reject older clients.
- Owner approval: preserve the current host-configured shared respawn pool and
  difficulty rules. Do not apply the proposed four-respawns-per-player formula.
- Owner approval: lock the starting roster for each run; allow those same
  participants to reconnect. New players can join between runs.
- Owner instruction: the host controls saved loadouts, default off. Disabled
  means fresh ships. Enabled means each player may explicitly choose a saved
  ship, or use a fresh ship by default. Preserve issue 024's existing rules.
- Delivery authorization: implement, validate, and merge into main. Publication
  and deployment are outside this authorization.

## Problem

Co-op allows up to four players; connected ready members determine run size.

This is the largest gameplay change on the list. The current co-op design is
two-player on purpose. Raising the cap is a protocol change, not a settings tweak.

## Original planning baseline (before implementation)

[The co-op protocol](../coop-protocol.md) describes one host and one guest.
PHP stores two client ids and two connection cards. The guest creates the
WebRTC offer. There is one data channel. There is no gameplay relay.

`Coop.remotePlayers` is an array, but `js/coop.js` puts at most one mirror in
it, from `N.Net.peer`. Combat code loops that array, which is useful later, but
it does not mean a four-player match works today.

[Issue 016](016-coop-binary-payloads.md) packed the two-player fight as binary
payloads. It explicitly left four-player links, a seat id, and mesh links out
of that version. Wire `VERSION` is 1.

[Issue 014](014-coop-lobby-and-revival.md) sized the shared revive budget for
two players: 4 per player, planned maximum 8 at the current capacity. A larger
room changes that budget. The issue says a later capacity increase must not
silently change the approved revive math.

The host already owns the world. Guests own their own ship, input, and
acknowledged state.

## Determine

- Every place that assumes exactly one remote peer: PHP lobby row, signaling
  messages, `N.Net.peer`, pause, revive, grants, death, and the binary payload.
  A code search at implementation time should produce that list and keep it in
  this issue.
- Whether three guests can all connect to the host (a star) with the current
  PHP introduction, or whether the lobby has to exchange cards for every pair
  (a mesh).
- Bandwidth of one busy guest after issue 016, so three guests have a predicted
  host cost. Use a measured session, not the old JSON estimate alone.
- What the revive formula should be at a host-selected cap of 2, 3, and 4.

## Decide

- The counts the host may pick. The request says maximum 4. It does not say
  whether 1 is a co-op room.
- Star or mesh. 
- Whether a seat id bumps the wire version, and whether an older two-player
  client may join a two-seat room only.
- Revive budget at each cap.
- How a fourth player affects spawn pressure. More players should not also be
  an unreviewed difficulty cut. That interaction belongs with
  [issue 023](023-skill-levels.md) if both exist.
- What the host does when a seat leaves: close it, or allow a rejoin under the
  issue 014 rules.

Proposal, not approved:

- Host picks 2, 3, or 4 before the room opens. One player is single-player, not
  a co-op room of 1.
- Use a star: every guest connects to the host. Guests do not need a channel to
  each other. The host relays the state those guests are allowed to see.
- Add a seat id and a new wire version. A version-1 client can only join a
  two-seat room, or it is refused with the existing version-mismatch behavior.
  Do not overload version 1.
- Revive budget stays 4 per living seat, including the host, capped by the
  host's chosen size. That is a new approval. It supersedes the "maximum 8"
  note only for rooms whose chosen size is above 2, and only after the owner
  accepts it.
- Do not start this until the owner has accepted the star design. A mesh is a
  different project.

## Do

After the decisions:

- Change the lobby schema, introduction, and wire together. Update
  [the co-op protocol](../coop-protocol.md) in the same change.
- Give each remote player a seat. Keep host authority. Do not let a guest
  simulate enemies.
- Rejoin, pause, grants, and death must name a seat instead of "the guest".
- Tests: 2-player regression still passes. A 3-player and 4-player harness
  covers join, ready, pause, one revive, leave, and rejoin. State the harness
  limit if a fourth real browser was not used.
- Record a bandwidth and frame-time note for a 4-player fight. That note does
  not close [issue 001](001-performance.md).

## Acceptance criteria

- [x] Co-op has four seats with no count selector; the connected ready roster
      at launch determines match size.
- [x] That many clients can join, ready, fight, pause, and leave.
- [x] A client on the previous wire version is accepted or refused under the
      approved rule, and does not corrupt the room.
- [x] Revive counts follow the approved formula at each cap.
- [x] Two-player matches still pass the existing co-op checks.
- [x] The protocol document matches the code.
- [ ] The owner has played a 3-player or 4-player session. Until then, this
      issue remains Implemented — needs validation, as allowed by the original
      acceptance criterion.

## Open questions

Resolved by the owner on 2026-11-02; see Accepted decisions above. There is no
count selector. Optional issue-024 saved loadouts are in scope.

## Dependencies

Do this after the two-player issues 014, 015, and 016 stay the baseline.
[Issue 023](023-skill-levels.md) should settle host match options first if both
are in progress, so the lobby does not grow two different settings panels.
This issue does not block pointer lock, saves, or the security alerts.

## Implementation and validation

- Branch: `codex/028-four-player-coop`, based on current `main` at `60a3d64`.
- Initial checks: clean checkout; fetched origin; no open pull requests; local
  main fast-forward check succeeded. No gameplay checks have run for this issue.
- Current work: map two-player assumptions, then update signaling, authority,
  transport, participant lifecycle, and UI together.
- Remaining: implementation; two/three/four-player regressions; bandwidth and
  frame-time evidence; protocol updates; owner multiplayer playtest; delivery.
- No implementation commit, push, pull request, or merge yet.

### Lobby authority increment

- `js/coop-host.js`: map of up to three guest seats, seat-bearing lobby state,
  all-member readiness, per-guest offline cleanup, and per-run roster lock.
- `tools/check-coop-lobby.cjs`: updated replacement expectations for the approved
  locked roster; added four-member launch/pause/countdown/disconnect/rejoin checks.
- Checks run: `node tools/check-coop-lobby.cjs` passed; targeted ESLint passed;
  `node --check js/coop-host.js` and `git diff --check` passed.
- This is a partial implementation. Transport, PHP, simulation/recovery routing,
  UI, protocol, and browser/performance validation remain incomplete. Existing
  browser tests have not been run and full co-op functionality is not claimed.

### PHP introduction increment

- `php/lib/store.php`, `php/lib/http.php`: version-2 introduction with three
  separate guest seats and per-guest offer/answer cards; serialized allocation;
  host-only roster lock/unlock; reconnecting roster members reclaim their seat.
  Existing SQLite lobby columns are retained during schema migration; old rooms
  and old host/join requests are refused under the approved version rule.
- `tools/check-coop-php.cjs`: four-client capacity, targeted answer isolation,
  version rejection, authorization, locked vacant seat, and reconnect coverage.
- `node tools/check-coop-php.cjs` passed 72 assertions with elevated local HTTP
  access. The sandboxed attempt could not reach its local server and did not pass.
  PHP syntax checks passed for both changed PHP files.
- Browser transport has not yet been converted to this introduction contract;
  this intermediate checkout does not provide working end-to-end co-op.

### Transport increment

- `js/net.js`: independent WebRTC connection/channel, connection cards,
  sequence numbers, ICE candidates, and retry state per link. `Net.peers` exposes
  connected peers; `Net.peer` remains a first-peer compatibility view while
  gameplay callers are converted. Message and peer callbacks carry sender IDs.
  `Net.send(message, targetId)` supports targeted delivery or room broadcast.
- Host launch delivery waits for the PHP roster lock. Introduction protocol 2
  is required before room creation or join. A guest only receives host controls.
- Host authority now retains starting seat assignments across offline cleanup.
- Checks: transport syntax and targeted ESLint passed; lobby regression rerun
  passed; `git diff --check` passed. Real browser negotiation has not been tested
  after the transport rewrite. Wire codec and participant/session callers still
  need conversion; the intermediate checkout is not ready for play or merge.

### Participant, wire, and presentation increment

- `js/coop-session.js`, `js/coop.js`: per-participant recovery, setup serials,
  life counters, revive retries, event acknowledgments, target-seat checks,
  sender-ID routing, and host-relayed visibility of all connected ships.
- `js/sim.js`, `js/enemies.js`: closest-player pickup arbitration across all
  guests; owner-targeted grants/heals; XP goes to the killing guest while each
  participant receives normal reward-pacing ticks.
- `js/player-stats.js`, `js/logbook.js`: per-guest authority/confirmations and
  host-relayed match rows; final-stat acknowledgment waits for all participants.
- `js/coop-wire.js`: actual baseline wire version was 5, not the issue's old
  version-1 note. Version 6 adds source/target seat bytes and packed avatar type
  19 (up to three remote ships per recipient). No runtime dependency added.
- `index.html`, `js/ui.js`, `js/render.js`: four-seat lobby wording/capacity,
  all-member pause readiness, and stacked teammate status cards. Existing neon
  treatment is preserved; visual QA and compact-layout review remain pending.
- `tools/ci/coop-four.spec.cjs`: real isolated-browser three/four-client harness
  covering join, launch, every ship visible, all-ready pause, revival, equipment
  retention, leave, roster exclusion, and same-seat reconnect.
- Checks passed: JS syntax, full ESLint; wire round trips/limits (66-byte state,
  38-byte bullet, 206-byte eight-bullet batch, 2791-byte sample world, 1306-byte
  recovery participant); grant-ownership and logbook Node checks; Chromium
  two-player guest-fire regression; three/four-player Chromium lifecycle tests.
  After adding packed avatars/UI, both Chromium lifecycle cases passed again.
- Full unit/check run stopped on its old introduction-field whitelist. The
  whitelist now validates protocol/seat/peer-card metadata; rerun is ongoing.
  Firefox lifecycle verification is ongoing. No broad browser suite, measured
  fight bandwidth/frame times, owner playtest, or merge is claimed yet.

### Cross-browser lifecycle verification

- `npm run test:unit` passed after the protocol-aware introduction assertions
  were updated. This includes real co-op gate checks, lobby checks, PHP checks,
  packed wire checks, grants, logbook, maps, saves, settings, and package checks.
- The updated three/four-player lifecycle tests passed all four cases across
  Playwright Chromium and Firefox (4 passed, 2.7 minutes). These use 3/4 real
  isolated browser contexts with actual WebRTC data channels on the same machine;
  they are not four physical machines or a WAN test.
- A review added a transport guard preventing a second browser with the same
  stored identity from replacing an already live channel. A genuine reconnect
  waits for its previous channel to report loss. The full `npm run check` is now
  running against that guard and the complete current checkout.
- Remaining acceptance work: combat/statistics/loadout coverage across all seats,
  compact visual review, measured four-player bandwidth/frame-time note, protocol
  review, complete broad browser results, owner playtest, and merge delivery.

### Two-player assumption inventory

| Previous assumption | Current conversion |
| --- | --- |
| PHP `lobbies.guest_id`, one offer/answer pair | `coop_seats`, three separately addressed pairs; legacy columns retained only for schema migration |
| `Net.peer`, single connection/channel/sequence/card revision | `Net.peers` plus per-link state; sender ID supplied by the receiving channel; first-peer fields remain compatibility views |
| `CoopHost.room.guest`, two-member ready set | Guest map with seat IDs; all-online-member launch/pause readiness; locked ID-to-seat roster |
| `Coop.remotePlayers[0]` for host fire/loadout/state | Explicit sender-to-mirror lookup; per-ship fire budget; all ships interpolated |
| Single guest setup/life/revive timer in `coop-session` | Per-participant setup/revive maps and mirror life counter; retained snapshots keyed by identity |
| Broadcast damage/heal/grant/kill XP | Explicit participant recipient; all guests still receive kill-pacing ticks |
| First guest only in ground-item selection | Nearest eligible living player across all mirrors; stable owner on pending grant |
| First guest only in stats/logbook authority | Authority/confirmation per participant; host relays other match rows |
| One teammate HUD and two pause labels | Every connected teammate card and member readiness label |
| Wire version 5 without seats | Version 6 source/target seats and packed avatar batch; introduction protocol 2 rejects old clients |

- Full validation is still running (`npm run check`); the latest Chromium
  three/four-player cases also passed fire routing, isolated confirmed kill and
  logbook credit, and targeted damage assertions. Full-suite success is not yet
  established. Source and acceptance review remain ongoing.

### Broad regression findings and follow-up

- The first 148-case broad run exposed tests whose expectations predate the
  owner-approved locked roster. Those cases now check dead-player recovery for
  the original roster and fresh replacements only between runs. The delayed
  pause test wrapper now forwards the transport sender ID.
- Actual runtime fix: incompatible-wire cleanup emitted `idle` after the update
  error. The error is now emitted after session cleanup, so it stays visible.
- Added opt-in `NEON_COOP_MEASURE=1` four-player fight instrumentation (20 and 80
  live enemies, 20 seconds each, four firing clients). It captures per-link
  outbound application payload, frame intervals, heap samples where available,
  viewport, quality, entity counts, CPU, and actual browser version. Measurements
  have not run yet; no performance claim is made.
- Four-player browser coverage now also checks optional saved-ship consent,
  clearing selection when the host disables it, fresh defaults for unselected
  participants, and final boards containing every participant. Validation of
  these latest additions remains pending.

### Focused regression follow-up

- First complete `npm run check`: syntax/lint/unit passed; browsers finished
  140 passed / 8 failed (7.2 minutes). Failures were the locked-roster expectation
  changes, sender-ID test wrapper, and final error-state cleanup described above,
  repeated in Chromium and Firefox. This run did not pass.
- Focused follow-up: all eight corrected two-player cases passed across both
  browsers, and both three-player lifecycle/combat/final-board cases passed.
  Four-player measurement cases failed in the harness: Chromium readied a stale
  lobby revision after selecting a saved ship; Firefox attempted a stress spawn
  above the normal population cap and dereferenced a null enemy. Those are now
  explicit revision synchronization and required-encounter stress spawns.
  The measured workload uses mixed rusher/shooter/sniper/burster/gyro/seeder
  styles, high hull to keep enemies alive, and protected stationary firing ships.
  It deliberately exceeds the normal population cap for the 80-enemy sample;
  no game balance, quality setting, or default spawn cap changes were made.
- Restored baseline lone-host resume when the last guest leaves; rooms with
  multiple remaining members re-pause for readiness. This also keeps authority
  pause state aligned when a lone host advances after a guest leaves completion.
- `tools/check-coop-star.cjs` passed: a never-resolving first SDP operation does
  not block other introductions; sender identity comes from the channel;
  targeted/broadcast sends and duplicate sequences stay per link. Lobby checks
  passed again. Latest runtime/source lint and whitespace checks passed.
- Agent visual check: reviewed Chromium 960×720 four-member lobby capture;
  neon styling and readable wrapped membership remain intact, with no horizontal
  overflow. Lower controls use the existing scrolling panel. Additional captures
  and in-viewport control assertions are in the rerun.

### Four-player fight measurement — 2026-11-02

The measured four-player lifecycle cases passed in both browsers (Chromium
1.5 minutes, Firefox 1.8 minutes), including saved-ship consent/clearing,
per-seat combat/statistics/logbook routing, revival, rejoin, and four-row final
boards. Each fight sample ran about 20 wall-clock seconds with four protected,
stationary ships firing every 150 ms. The host maintained 20 then 80 mixed
rusher/shooter/sniper/burster/gyro/seeder enemies with high hull; the stress
sample deliberately bypassed the normal population cap through the existing
required-encounter spawn option. Normal game defaults and graphics were unchanged.

Environment: Windows, Intel Core i7-12700KF, 20 logical processors, about 32 GiB
RAM; Playwright Chromium **156.0.8078.4**, Firefox **157.0**, headless, four actual
browser contexts on one machine, 1280×720 each, default graphics. Canvas/GPU
acceleration was not established. This is a local transport/rendering stress
sample, not a real-player performance acceptance test or a WAN bandwidth bound.

| Browser | Enemies | Host outbound per guest (kB/s) | Host outbound total (kB/s) | Guest outbound range (kB/s) | Host frame median / p95 (ms) | Guest frame p95 range (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | 20 | 17.49 | 52.47 | 3.55–3.59 | 66.7 / 83.4 | 83.4–116.6 |
| Chromium | 80 | 39.95–39.96 | 119.86 | 3.54–3.58 | 66.7 / 83.4 | 116.5–133.3 |
| Firefox | 20 | 13.52 | 40.56 | 2.93–2.96 | 160.0 / 160.0 | 160.0–173.3 |
| Firefox | 80 | 22.23 | 66.69 | 2.89–2.90 | 160.0 / 160.0 | 160.0–173.3 |

- kB means 1000 application payload bytes; framing, ICE, DTLS, SCTP, TURN, and
  transport acknowledgments are excluded. Host cost was approximately three
  copies of the measured per-guest downstream payload. Firefox's lower payload
  accompanies its slower frame cadence; it is not an optimization result or a
  guaranteed upper bound at a full rendering cadence.
- Host projectile counts at sample end: Chromium 51 player / 87 enemy (20
  enemies), 42 / 355 (80); Firefox 100 / 120 and 65 / 410. Actual live-enemy
  counts were 20 and 80. Peak sampled channel buffering was 13,099 bytes in
  Chromium and 11,327 in Firefox. Every sampled client remained in playing mode.
- Recorded world seeds: Chromium `2767476616`; Firefox `1149663205`. These were
  captured workloads, not identical maps across browsers.
- Chromium reported coarse 10,000,000-byte JS heap samples before/after each
  interval; Firefox did not expose that API. No retained-memory stability,
  leak-free claim, extended soak, or real-player frame-time pass follows.
- These frame times do **not** meet the project's real-player performance target.
  Four local headless contexts are a constrained test environment. Issue 001
  remains separate; physical-machine/WAN and owner playtesting remain pending.
- Raw JSON and captures were preserved outside the repository in the current
  chat's visualization artifacts (`coop-028`); they are not committed browser
  profiles, local saves, or transient test output.

### Final source review and validation in progress

- A preallocated PHP introduction cannot bypass the run roster: join and poll
  now refuse an ID excluded at launch, even if it began introducing beforehand.
  PHP integration checks passed **74 assertions**; independent-star checks passed.
- Agent capture review found a teammate card overlapping the existing DOM
  respawn line. The cards now reserve 48 pixels above the weapon card, list
  seats in ascending order, and retain all bars/glow/effects. Matched same-scene
  main/current-renderer captures are enabled only for explicit visual validation,
  so normal CI does not require an older Git ref.
- The final complete `npm run check` is running with those matched captures.
  Do not interpret earlier partial/failing runs as a final pass.

### Implementation complete — automated validation and delivery

- Final `npm run check` passed: syntax, full ESLint, all unit/check scripts, and
  **148/148** Chromium/Firefox browser cases (browser phase 7.3 minutes).
  Actual runtimes: Node **24.14.1**, PHP **8.4.13**, Chromium **156.0.8078.4**,
  Firefox **157.0**, Windows. Stable installed Google Chrome was not run.
- Included checks: PHP 74 assertions; star transport independence/targeting;
  wire round trips and malformed/old versions; two-player regressions; real
  three/four-context launch/combat/pause/revival/leave/rejoin; optional loadouts
  and fresh defaults; final boards; surrounding solo/save/settings/reward/control
  regressions. Physical controllers and WAN/multiple-machine play were not tested.
- Agent reviewed matched 1280×720 main/current HUD captures at identical paused
  scenes and graphics in both browsers: all ships/world effects remain; every
  teammate card is shown in seat order with the respawn line clear. Reviewed
  compact 960×720 lobby and reachable lower controls. Pause labels cover all four
  members; capture-only screen animations are finished for consistent images.
- UTF-8 without BOM, LF/final-newline checks and local Markdown targets passed
  across all 28 changed/new source and documentation files; `git diff --check`
  passed. Browser contexts were isolated; owner saves/settings were not cleared.
- Remaining owner validation: three/four-player session, physical-controller
  usability/disconnects, real GPU frame times and memory/extended soak, and WAN
  behavior. The recorded headless frame times are poor and do not establish
  real-player performance. Issue 001 is not closed by this work.
- Branch: `codex/028-four-player-coop`; implementation commit **`5ea217a`**
  (`feat(coop): support four-player rooms with locked rosters`). This hash record
  is a subsequent documentation update. Push/PR/rebase merge are authorized by
  the owner's original instruction; the PR records final integration/check state.
  The mandatory pre-push hook reruns the full suite. No deployment or publication
  is authorized or performed by this task.
