# 014 — Persistent co-op lobby, revival, and rejoining

Status: Planned

## Feature summary

Connect once and play multiple runs together. Co-op should be a persistent lobby:
players join with a code, choose their ships and colors, and mark themselves ready.
When everyone currently connected is ready, a countdown launches a new run; a lone
host can also start. Death keeps a player in the session, with shared respawns set
by the host in the lobby (default: 4). When the run ends, everyone returns to the
same lobby to choose again and start another run without exchanging another code.

A disconnected player should be able to enter the existing code and rejoin while
the host is still playing, including after a guest browser crash.

## Problem and current behavior

The owner reports needing a new code after death or game over, leaving friends
waiting rather than playing together.

Static review of local `main` at `6059008` on 2026-10-30 found:

- `js/ui.js`: the connected host can start a run; there is no pre-run all-ready
  gate. The game-over action leaves co-op.
- `js/sim.js` (`G.gameOver`) and `js/coop.js` (`onLocalGameOver`,
  `applyRemoteGameOver`): either player's death sends game over to the other
  player. There is no separate recoverable player-death flow.
- `js/coop.js` (`endSession`, `onPeer`): losing a peer ends the active session
  and leaves the network room. Finishing a run and leaving a lobby need separate
  lifecycles.
- `js/net.js`: brief socket drops retry with the same in-memory client ID and
  room code. The ID is generated again on page load; crash recovery is different
  from reconnecting a socket in a still-open page.
- `server/coop-server.cjs` (`joinRoom`): an occupied guest slot can reconnect only
  with its matching ID and a closed old socket. Grace periods and room expiry
  limit recovery. Transport reconnection alone does not restore a guest's full
  run state; `startGuestRun` initializes a fresh player.

These are source-review findings, not a reproduced browser session. Before
implementation, recheck the baseline and incorporate relevant production-readiness
fixes from their reviewed branch. See [the protocol](../coop-protocol.md) for the
existing two-player transport and server-owned shared-pause contract.

## Owner-requested behavior

### Lobby and repeated runs

- Hosting creates a lobby with a code. Joining connects the player to that lobby.
- Each player can choose a ship and color before each new run and see the other
  player's selection and ready state.
- A run begins after all connected players are ready and the launch countdown
  finishes. A lone host can ready and start without a guest.
- Individual death does not disconnect anyone or require a new code. A gameplay
  mechanic allows a dead player to return to the current run.
- At game over, all connected players return to the same lobby. They can choose
  again and start a fresh run; run progress resets, lobby membership does not.
- A lobby button or link opens statistics for the last game. Before a game has
  been played, that view is empty. Returning to the lobby is not blocked by a
  separate results screen.
- The lobby code stays valid across runs. Connected players do not re-enter it.
- A disconnected player can use that code to rejoin while the host remains active.

### Shared respawns — owner decision

- Use one shared team respawn pool. Each respawn consumes one available respawn,
  regardless of which player died.
- The host sets the respawn count in the lobby before starting the run. The
  default is 4. The configured count and remaining pool must be clear to players.
- Allow whole-number counts including 0 for a no-respawn challenge. The owner's
  intended maximum is 4 respawns per player, combined into the shared pool;
  these are not individually reserved lives. For the current two-player capacity,
  the planned range is 0–8 shared respawns, with the default still 4 shared.
- Teammate rescue objectives and a combined rescue/charge mechanic are not part
  of the selected design.
- Shared respawns apply to both host and guest deaths. The host keeps simulating
  the world while their ship is dead and the guest is alive.
- Disconnecting or rejoining must not grant a free revival or refill the pool.

### Death, respawn, and level advancement — owner decision

- If a shared respawn is available and at least one teammate remains alive,
  automatically respawn the dead player 3 seconds after death, at the position
  where they died. While waiting, their camera stays on that death position.
- As the player respawns, pause the game so players can orient themselves before
  combat continues. The pause applies to the whole game, not only the revived
  player's view.
- If no respawns remain, the dead player can spectate by following the living
  player. They stay in the session while the survivor attempts to finish the level.
- On advancement to the next level/sector, reset the shared pool to the host's
  configured count. Bring the entire connected lobby into the next level alive,
  including players who were dead or spectating. Re-entering the same level or
  reconnecting does not reset the pool.
- If all active mission players are dead, the mission ends immediately, even
  when respawns remain or a respawn timer is pending. Return to the lobby through
  the game-over flow; do not wait for a timer to revive the team. A lone host's
  death therefore also ends the mission. Inactive retained ID records do not count
  as living teammates.
- When simultaneous deaths compete for fewer available respawns, prioritize the
  dead player with the highest player/progression level. This means the player's
  level, not the current mission sector. Apply this rule only while someone is
  still alive; the all-dead defeat rule takes precedence.
- If contenders have the same highest player level, choose randomly among those
  tied contenders. Lower-level players do not enter that tie-breaker.

With two active players, simultaneous deaths mean everyone is dead and the mission
ends. Priority matters when more players are supported later and another teammate
survives. The current implementation scope remains two active players.

### Replacement ship and dropped storage — owner decision

- Death scatters the ship's storage contents over an area around its death
  position. Drop them when the player dies, not when a respawn completes, so the
  same rule applies when no respawns remain. The items can be picked up again.
- A respawn calls in a replacement ship equipped like the lost ship. Restore it
  to full health and shields, retain installed weapons, equipment, buffs, and
  upgrades, and give it 3 seconds of invincibility. Storage starts empty; dropped
  items are not automatically returned to it.
- Preserve the distinction between installed items and stored items. Restoring
  installed gear does not create extra copies of items scattered on the ground.
- Dropped items remain in the current level for collection. Anything not picked
  up before level advancement is lost and does not travel to the next level.
- A player who is still dead when the team advances returns in their equipped
  replacement ship with installed weapons, equipment, buffs, and upgrades retained.
  Their uncollected storage is lost with the previous level. They do not regain
  those items from a retained participant record or a later reconnect.

### Disconnects, late joins, and readiness — owner decision

- When the guest disconnects or explicitly leaves, the host keeps playing in
  hosted mode. An absent guest does not force a pause or close the lobby.
- The host can remain in hosted mode without a guest until they leave the game
  or exit the lobby. The room/code must remain available throughout that session,
  including beyond the existing short connection grace and room-expiry windows.
- A new or returning player can join an ongoing run when a connection slot is
  available. The current target is two simultaneous players, including the host.
- When a player joins an ongoing run, pause the game for setup/synchronization.
  Both connected players must ready before play resumes. Do not resume based only
  on the joiner's readiness. Preserve the existing shared-pause countdown contract.
- If the guest drops during that ready/countdown flow, their absence must not
  leave the host waiting indefinitely; return to hosted play with only the host.

### Stored identity and ship recovery — owner decision

- Give each participant a unique ID and store it in their browser. Explicitly
  leaving exits the session but retains that ID for a later return. To support
  crashes too, issue/store the ID before a player might disconnect.
- The host maintains a simple registry keyed by unique ID with the participant's
  ship configuration and run details. Retain entries after disconnects and
  explicit leaves; retained entries are not occupied connection slots.
- A joining browser with a matching ID gets its recorded ship and details if
  that ship is not already in use. Returning players still need an available
  connection slot; stored identity does not displace an active player.
- A browser without a matching record chooses its ship/color and starts with a
  blank ship: fresh run-entry equipment and progression, not another player's
  retained loadout. Joining an ongoing run still uses the join pause/ready flow.
- Reject duplicate control of a ship already in use. Retain separate records for
  participants who leave and are replaced, even with the two-player active limit.
- New runs still reset run progress and permit ship reselection. Retained records
  must not restore a previous run's equipment into a fresh run.

## Proposed implementation boundaries — not approved gameplay rules

- Start with the existing two-player capacity. This request does not establish
  a larger player count or require a new hosting architecture.
- Separate lobby membership, run phase, individual life state, and connection
  state. A room can outlive a run; a player can be dead but still connected.
- Reset readiness for each new run. Invalidate affected readiness when selections
  or the respawn setting or membership changes. Cancel stale countdowns on drops
  and apply the current connected membership, allowing the lone host to start.
  Keep lobby readiness separate from the existing mid-run pause/ready handshake.
- Retain the host's world simulation and existing signaling/relay service. Extend
  the server-owned coordination where needed; do not add server-side physics.
- Retain enough guest state while disconnected or explicitly absent to restore
  the same participant,
  including equipment, progression, health/death state, and pending rewards.
  On rejoin, synchronize the current run/sector and world before accepting input.
- Implement the stored unique ID as an unpredictable recovery credential that
  survives a guest reload. The room code finds the lobby; the stored ID selects
  that participant's retained ship. Match and reserve the record before accepting
  input so simultaneous joins cannot both claim it. Cross-device ID transfer is
  not specified by the owner's browser-storage requirement.
- Scope late packets and retries to the correct run and life. Old game-over,
  ready, reward, or revival messages must not affect a later run or spend a
  respawn twice.
- Process deaths and check for all-dead defeat before completing any respawn.
  Cancel pending respawns when a mission ends or a level changes. Resolve competing
  same-update deaths together so packet arrival order cannot override level priority.
- Use gameplay time for the 3-second death timer, stopping it during shared pause.
  Reuse the shared all-ready/resume countdown for orientation after respawning.
  These timing/coordination details are implementation proposals; the approved
  behavior is a 3-second respawn followed by a shared orientation pause.
- Level advancement revives the connected team and initializes a fresh pool once;
  it does not spend the next level's respawns just to admit previously dead players.
- Make storage removal and death-drop creation a single host-coordinated operation
  per death. Retries, duplicate death messages, and reconnects must not drop the
  inventory twice or restore items already dropped. Update retained ship records
  as storage is lost, collected, or discarded at a level transition.
- Use gameplay time for the 3-second invincibility period so the orientation
  pause does not consume the player's protection. Resolve a random respawn tie
  once on the host and synchronize that outcome instead of rolling per client.
- Interpret the respawn maximum against supported lobby capacity (currently 2),
  keeping the selected pool fixed as guests leave or join. This is an agent
  planning interpretation of the owner's 4-per-player maximum, rather than an
  approved rule that late joining changes the budget. Future capacity increases
  should retain the 4-per-player ceiling without changing today's active limit.
- Preserve single-player saves and settings. Live-session crash recovery does
  not imply persistent co-op saves, host migration, or recovery after host/server
  shutdown. Keep the existing neon presentation and supported controls.

## Planning assumptions and implementation details

The owner's answers resolve the previously listed gameplay decisions. Countdown
duration for launching a new run remains a routine implementation choice. The
implementation proposals above are still labeled separately from owner decisions.

The planned 0–8 range uses the current two-player lobby capacity, including when
only the host is connected; this capacity-based interpretation should be confirmed
before implementing the count selector if the owner intended the maximum to track
the number of connected players instead. Joining does not itself replenish lives.

## Acceptance criteria

- [ ] Two players join one lobby and see synchronized ship/color selections and
  ready states through supported menu controls.
- [ ] All required players must be ready before a run starts, exactly once, with
  their confirmed selections and a countdown. A lone host can start. Selection,
  respawn-setting, or membership changes cannot launch stale state.
- [ ] The host can set the shared respawn count in the lobby, initially defaulting
  to 4. Both players see the setting and remaining respawns; either player's
  respawn consumes exactly one shared charge. The selector accepts whole numbers
  from 0 through the 4-per-player ceiling (planned maximum 8 at current capacity).
- [ ] Either player can die without being disconnected or immediately ending a
  recoverable team run. The living player can continue, including a living guest
  while the host ship is dead.
- [ ] The agreed revival mechanic works for both players, shows recovery progress
  or resources, and cannot duplicate revivals or consume resources twice on retries.
- [ ] An eligible dead player automatically respawns at their death position after
  3 seconds. Their camera stays there while waiting; respawning pauses the whole
  game for orientation before combat resumes.
- [ ] A replacement ship has full health/shields, the same installed weapons,
  equipment, buffs, and upgrades, empty storage, and 3 seconds of invincibility.
- [ ] Death scatters stored items around the death position exactly once, even
  if no respawn is available. The items can be collected again without duplication
  or automatic restoration through respawn/rejoin.
- [ ] With no respawns available, a dead player can follow a living teammate as a
  spectator without leaving the session.
- [ ] Reaching the next level brings all connected players back alive and resets
  shared respawns to the host-configured count exactly once. Previously dead
  players can continue without spending that fresh pool on level entry.
- [ ] Dead players advancing to a new level retain their installed loadout and
  upgrades. Uncollected storage drops are lost with the previous level and cannot
  be recovered through stale messages or retained ship records.
- [ ] All active players being dead ends the mission immediately, including a
  lone host or simultaneous two-player deaths, regardless of remaining charges
  or pending timers. No delayed timer revives a player after game over.
- [ ] Contested simultaneous respawns prioritize higher player level, subject to
  a surviving teammate, with random selection among equally highest-level players.
  All clients apply the same selected outcome. Future larger-party
  priority rules do not expand this feature's two-player active limit.
- [ ] Game over returns connected players to the same lobby and code, resets
  readiness, permits reselection, and starts another fresh run without reconnecting.
- [ ] The lobby exposes last-game statistics through a button or link, with an
  empty view before the first game. Previous-run loadouts do not leak into new runs.
- [ ] A guest disconnect or explicit leave lets the host keep playing in hosted
  mode without a guest. The lobby/code stays available until the host ends the
  session; the old connection-grace and idle-room expiry do not terminate it.
- [ ] New and returning guests can join an ongoing run when space is available.
  Joining pauses the run until both players ready and the shared resume countdown
  finishes. A guest dropping during setup/readiness cannot strand the host.
- [ ] A stored matching ID restores its retained ship and run details after a
  disconnect or explicit leave, provided the ship is unused and a slot is free.
  Unmatched IDs choose a ship/color and enter with fresh equipment/progression.
  Replaced players' retained records do not occupy active slots or get overwritten
  by their replacements. A duplicate ID cannot control an already-used ship.
- [ ] A guest can close/reopen their page or recover from a browser crash and rejoin
  using the existing code while the host remains active, including beyond the old
  short grace period. Their correct current state is restored without free healing,
  revived lives, lost equipment, or duplicated rewards outside the approved respawn
  and next-level reset rules.
- [ ] Brief signaling drops and gameplay-transport fallback still work. Rejoin
  during pause, sector change, game over, or lobby return resolves to the current
  phase without stuck readiness or applying an old run's messages.
- [ ] Host departure, unavailable rooms, invalid recovery, full slots, and duplicate
  connections give clear outcomes without removing another active participant.
- [ ] Single-player behavior, saves/settings, supported controls, shared pause, and
  the game's appearance remain intact. Owner playtesting confirms acceptable
  revival pacing and time spent waiting.

## Decisions and scope record

- Date: 2026-10-30.
- Approval source: Owner requested a feature draft in chat; gameplay implementation
  was not requested.
- Accepted requirements: persistent lobby, per-run ship/color selection, all-ready
  launch, recoverable player death, return to the same lobby/code, and guest rejoin
  while the host remains active.
- Rationale: Keep friends playing together across deaths, runs, and guest crashes.
- Consequences: Future implementation must separate room/run/player lifecycles
  and support state recovery, beyond today's transport retries.
- Follow-up approval source: Owner's explicit design answers in chat on 2026-10-30.
- Accepted follow-up decisions: host-configured shared respawns, default 4;
  continued hosted play after a guest leaves/disconnects; pause and all-connected
  readiness on new/returning joins; lone-host launch with countdown; direct lobby
  return with optional last-game stats; mid-run replacement within the two-player
  active limit; browser-stored unique IDs and a host registry restoring unused
  matching ships, including after explicit leave; fresh ships for unmatched IDs.
- Rationale: Keep the host playing, support crash recovery and replacement, and
  preserve a returning participant's ship without occupying an empty active slot.
- Consequences: Retain participant records separately from active membership;
  maintain the hosted room with a lone host; synchronize joining players before
  resuming. Generate/store IDs before disconnects so crash recovery works.
- Supersedes: This issue's earlier unresolved mechanic choice, disconnect policy,
  lone-host launch, results flow, and slot-reservation questions. The suggested
  teammate rescue alternatives are not selected.
- Latest approval source: Owner's additional respawn/defeat answers in chat on
  2026-10-30.
- Accepted latest decisions: automatic respawn 3 seconds after death at the death
  position; camera held there while waiting; shared pause on respawn for orientation;
  following the living teammate when no respawns remain; shared pool reset to the
  configured count and revival of the connected lobby on level advancement;
  immediate defeat whenever everyone is dead despite unused/pending respawns;
  highest-player-level priority for simultaneous contested respawns while another
  teammate survives.
- Rationale: Give survivors a chance to bring their team into the next level,
  allow orientation on return, and require a living player to sustain the mission.
- Consequences: Distinguish the death timer, spectator state, and level-entry
  revival. All-dead defeat takes priority over pending timers and allocation;
  highest-level priority becomes relevant to simultaneous deaths in larger groups.
- Supersedes: Earlier open questions about respawn trigger/delay/location, camera
  while dead, pool replenishment at level advancement, and all-dead defeat.
- Final design-answer approval source: Owner's ship-restoration, storage-loss,
  tie-breaker, and count-limit answers in chat on 2026-10-30.
- Accepted decisions: fully restored replacement ship; installed weapons,
  equipment, buffs, and upgrades retained; 3 seconds of invincibility; storage
  scattered around the death position for collection and lost if left behind on
  level advancement; dead players advancing retain their installed loadout but
  lose uncollected storage; random equal-level tie-breaker; 0 allowed; maximum
  4 shared respawns per player. Earlier default of 4 shared respawns remains.
- Rationale: Preserve the equipped ship while making carried storage recoverable
  at a risk. Limit repeated deaths and spectator downtime while allowing groups
  to choose a no-respawn challenge; refresh the shared budget each level.
- Consequences: Death must separate installed and stored items; synchronize drops,
  invincibility, and random allocation; retained identity records must reflect
  inventory losses. Planned current-capacity maximum is 8 shared respawns.
- Supersedes: Remaining open questions about restored state, protection, equal-level
  ties, and permitted counts. Capacity-based calculation of the maximum is an agent
  interpretation recorded above; other implementation boundaries remain proposals.
  No project-wide decision is superseded; existing protocol
  documents continue to describe implemented behavior, not this planned feature.

## Implementation and validation

- Changed files: this proposal and the backlog index.
- Documentation only. Status remains Planned; no gameplay implementation started.
- Follow-up: Updated requirements, acceptance criteria, and decision record with
  the owner's successive 2026-10-30 answers, including replacement ships, storage
  drops/loss, invincibility, random ties, and respawn limits. No acceptance boxes
  checked by design approval.
- Validation: static source review of the paths listed above. Documentation links
  and `git diff --check` are checked at handoff. No runtime tests, browser crash
  experiments, or player validation are claimed.
- Remaining work: resolve the noted count-capacity interpretation before the
  selector implementation, implement the feature, automated lifecycle and
  recovery checks, two-browser testing over both transports, controller/menu checks,
  and owner playtesting. Record browser versions and environments when run.
- Delivery: Owner authorized committing this plan on 2026-10-30. Task branch:
  `codex/docs-coop-lobby`; the plan commit is recorded in branch history. No push,
  pull request, merge, or deployment performed.
