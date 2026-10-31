# Co-op network protocol

This document describes the two-player co-op link for NEON NEXUS. It is an
implementation contract, not a public API promise. The protocol is deliberately
small so the signaling server stays cheap: the server creates rooms, forwards
WebRTC offers/answers/ICE candidates, and can relay gameplay messages when a
peer-to-peer channel is unavailable.

## Roles

| Role | Simulation | Authority |
| --- | --- | --- |
| Host (`PLAYER 1`) | Full game simulation | World seed, enemies, destructibles, loot drops, sector flow |
| Guest (`PLAYER 2`) | Own ship and local UI | Own movement, aim, inventory, damage mitigation, shots; acknowledged state retained by host |

Both clients generate the sector from the host's run seed, so the static map is
identical without sending map geometry.

## Signaling messages (WebSocket JSON)

The signaling URL defaults to `ws://<page-host>:8787`. Override it with the
`signal` query parameter, for example `?signal=ws://192.168.1.20:8787`, or use
`wss://` when the page is served over HTTPS.

| Direction | Message | Purpose |
| --- | --- | --- |
| client → server | `{t:"host", clientId, profile}` | Create a room. The server replies `hosted` with a 5-character code. |
| client → server | `{t:"join", code, clientId, profile}` | Join an existing room. |
| server → host | `{t:"peer", peer}` | A guest joined or reconnected. |
| server → guest | `{t:"joined", code, host, peer}` | Room accepted. The guest starts the WebRTC offer. |
| both | `{t:"peer-left"}` | The other side disconnected. |
| both | `{t:"signal", from, data}` | WebRTC offer, answer, or ICE candidate. |
| both | `{t:"relay", from, data}` | Gameplay message fallback. |
| client → server | `{t:"leave"}` | Leave the room. |
| server → client | `{t:"notfound"}` / `{t:"full"}` / `{t:"error"}` | Join failures. |
| client → server | `{t:"pause_request"}` | Ask the room to pause (any menu or pause input). |
| client → server | `{t:"ready_signal"}` | Mark this client ready to resume. |
| client → server | `{t:"pause_sync"}` | Ask for the server's current pause state. |
| server → both | `{t:"global_pause", by}` | Room is paused. `by` is the initiating `clientId` (or `null`). |
| server → both | `{t:"ready_state", ready:[clientId]}` | Current ready set. |
| server → both | `{t:"countdown_start", seconds}` | All players ready; countdown begins. |
| server → both | `{t:"global_resume"}` | Countdown finished; resume the simulation. |

Profile objects are `{name, shipType, shipColor}`. Names are assigned by the
client as `PLAYER 1` or `PLAYER 2`; players cannot type a name.

Room codes use an unambiguous 32-character alphabet (no `I`, `O`, `0`, `1`).
The server keeps at most two participants per room.

## WebRTC setup

The guest is the offerer. It creates the `game` data channel before sending the
offer. The host answers and attaches to the incoming channel. No public STUN or
TURN server is configured by default so the game has no runtime CDN dependency.
`NEON.Net.iceServers` may be set before hosting/joining for networks where host
candidates are not reachable. Gameplay falls back to the server relay whenever
the data channel is not open, so a failed WebRTC attempt does not end the run.

## Gameplay messages

Every gameplay message has a `t` type. Gameplay messages are JSON. `_s` is a
sender sequence number; receivers drop duplicates and out-of-order messages.
`_run`, `_sector`, and `_life` scope gameplay to the current mission, sector, and
sender life. Host damage/reward messages also carry `_targetLife`. A stale packet
cannot revive a previous life or change a later mission. Connection setup uses a
monotonic `syncId`; duplicate setup packets acknowledge without restoring twice.

### Host → guest

| Type | Payload | Rate |
| --- | --- | --- |
| `session_sync` | `syncId`, seed/sector, retained player, host player, run, pool, phase | until setup acknowledgment |
| `state` | Host ship position, aim, hull, health | 20 Hz |
| `world` | Enemies, anchors, caches, ground items, elapsed, kills | 5 Hz |
| `bullet` / `ebullet` | Projectile spawn parameters for cosmetic guest simulation | batched at 20 Hz |
| `mine` / `strike` | Host-created hazard visuals | on creation |
| `hit` | Damage source amount, position, contact flag | on hit |
| `grant` | `grantId` and loot item offered to the guest | on pickup, retried until acknowledged |
| `xp` | XP earned by a guest kill | on kill |
| `kill` | Shared kill count and reward pacing tick | on kill |
| `level` | Next run seed/sector, or sector-complete state | on change |
| `complete` / `mission_end` | Sector completion / return to persistent lobby | on change |
| `revive` / `lives` | Replacement ship state / shared pool and death timers | on revival with acknowledgment / 4 Hz |

### Guest → host

| Type | Payload | Rate |
| --- | --- | --- |
| `state` | Guest ship position, velocity, aim, hull, health, magnet | 20 Hz |
| `loadout` | Weapons, passives, protocols, derived stats | on change |
| `fire` | Weapon index, aim angle, origin | per shot |
| `participant` | Full player/reward recovery snapshot | 4 Hz, on changes, and included in state/grant acknowledgments |
| `death` / `death_ack` | Death snapshot and confirmation | retried until acknowledged |
| `session_ack` / `revive_ack` | Setup or life transition confirmation | on application |
| `event_ack` | Accepted damage/reward event and resulting player snapshot | on application or retry |
| `grant_ack` | `grantId` and `ok` after the guest accepts or rejects a grant | on each `grant` |
| `bye` | Leaving | once |

## Shared pause and ready flow

The server owns the pause state so both clients stop and resume together. Control
messages travel on the signaling WebSocket rather than the WebRTC/relay gameplay
path, because only the server can decide when every participant is ready.

1. A client opens any menu (inventory, rewards, level-up, overflow, pause) or
   presses the pause key. It sends `pause_request`.
2. The server moves the room to `PAUSED`, records the initiator, and broadcasts
   `global_pause`.
3. Every client pauses its simulation. The initiator keeps its menu open; the
   other client shows the co-op pause screen. Closing the menu and pressing
   READY sends `ready_signal`.
4. The server broadcasts `ready_state` after each signal. When every connected
   room member is ready, it broadcasts `countdown_start` with a 3-second timer.
5. After the countdown the server broadcasts `global_resume`, and each client
   resumes its simulation. A client does not resume because its own timer
   elapsed. If that resume is missing, the client sends `pause_sync` and
   applies the server's current pause, countdown, or resume message.

If a member's socket drops during the countdown, the server cancels the resume
and broadcasts `global_pause` again. A reconnecting member receives the current
pause state when it reattaches. Controls carry the current run ID and pause epoch;
ready signals from earlier pauses are rejected. A departing guest is removed from
the required membership, and the remaining host can continue alone.

## Ownership rules

- The host is the only client that decides which player claims a ground item.
  It chooses the nearest living player within that player's pickup radius.
  Host-owned items use the normal local path. A guest claim keeps the item on
  the host floor, with a stable `grantId`, until the guest sends `grant_ack`.
  `ok: true` removes it. `ok: false` releases it for another attempt. A missed
  acknowledgement does not release it; the host sends the same `grantId` again.
  The guest ignores a repeated `grantId` after accepting it, and answers again
  so the host can finish the transfer.
- Anchors, caches, and enemies belong to the host world. Damage from guest
  bullets is applied by the host using the guest's mirrored loadout. Kill XP and
  reward pacing are sent to the guest; loot is dropped by the host.
- Guest health is owned by the guest. The host sends source damage and keeps a
  mirror for enemy targeting; the guest applies mitigation, shields, dodge, and
  death locally. The host never writes a guest checkpoint.
- Co-op checkpoints and saves are intentionally disabled. A host leaves the
  session with pause → leave co-op instead of overwriting a single-player save.

## Failure handling

- A missing join code, full room, or signaling error is reported in the co-op
  screen and never starts a run.
- If the WebSocket drops, the client retries the signaling server and rejoins the
  same room with the same client ID. The server keeps a disconnected peer for a
  bounded grace period, then removes that peer. A room with both participant
  sockets open stays up through peer-to-peer play and shared pause; it is not
  expired just because gameplay is not being relayed. A room that is not a live
  pair still expires after five minutes without signaling activity.
- If the data channel drops, gameplay continues over the server relay. The
  transport status indicator reports `RELAY` instead of `P2P`.
- When a guest leaves, the host keeps the room/code and continues playing. Brief
  socket drops retain the existing transport grace window; after departure is
  confirmed, an absent record does not count as an active teammate. Open host
  sockets keep rooms alive past both the old idle expiry and guest grace period.
- Host departure closes the lobby for guests. Host migration, server-restart
  recovery, and persisted co-op saves are not implemented.

## Non-goals

- Anti-cheat validation or authoritative hit rewind.
- More than two players.
- Server-side physics, rendering, or procedural generation.
- Persisted co-op sessions or cross-device saves.


## Persistent lobby and participant recovery (issue 014)

The signaling server owns lobby phase (`lobby` / `run`), membership, profiles,
readiness, the configured shared respawn count, and a monotonically increasing
run ID. The browser host owns the world, participant registry, shared remaining
respawns, and life transitions. `js/coop-session.js` implements that lifecycle
separately from avatar/world transport in `js/coop.js`.

| Client control | Effect |
| --- | --- |
| `lobby_profile` | Update ship/color; invalidate readiness and launch countdown |
| `lobby_respawns` | Host-only integer 0–8; default 4; invalidate readiness |
| `lobby_ready` | Ready/unready against the current lobby revision |
| `lobby_sync` | Request current lobby state |
| `return_lobby` | Host-only, matching run ID; end mission without closing room |

The server broadcasts `lobby_state` (members, profiles, readiness, revision,
respawns, phase, run ID, launch time). All connected members, including a lone
host, must ready before a three-second launch countdown. Membership or selection
changes cancel stale launches. `launch` authorizes the host to initialize exactly
one fresh run. New runs discard old retained equipment/progression.

Each browser generates a cryptographically random 128-bit ID before connecting,
stored as `neon-coop-identity-v1`. Explicit leave retains it. Storage failure is
reported; reload recovery then cannot be promised. An occupied active slot cannot
be claimed by another connection with the same ID. Inactive records occupy no
connection slots, and different returning/replacement IDs retain separate ships.

The host retains player position, health, equipment, progression, buffs, pending
protocol choices, stored rewards, life number, and pending respawn timer. Guest
state updates and acknowledgments include snapshots; no browser save is used.
Damage and reward events have stable IDs and retry until acknowledged. The guest
retains accepted IDs with its snapshot to avoid replaying already applied rewards
when a receipt is lost. Ground-item grants stay reserved to their original
participant until accepted or rejected, including while that participant is absent.

A new/returning guest triggers setup pause. The host sends the current sector and
world plus that ID's retained ship, or a fresh ship for an unmatched ID. Setup is
acknowledged after world synchronization, before accepting guest gameplay. Existing
bullets, mines, and strikes are transferred in bounded `sync_entities` chunks;
readiness stays blocked until the world and every chunk arrive. Setup retries are
throttled and duplicate chunks do not create extra hazards. Both
players must ready to resume. Initial launch and normal sector advancement reuse
the server countdown automatically after synchronization; they do not require a
second manual ready click. A guest leaving during setup releases the host.

## Shared life transitions

- Individual deaths leave membership intact. The host processes deaths before
  checking for all-dead defeat and before completing replacement timers.
- Stored equipment is the reward tray, including an open replacement choice.
  Death removes and scatters it exactly once; installed equipment and pending
  protocol choices remain. Drops use normal world placement/pickup rules.
- A living teammate permits an automatic replacement after three gameplay
  seconds. The shared charge is reserved when its timer starts; disconnecting
  cannot refund it or restart a free timer. Highest player level wins contested
  allocation, with a single host-side random choice among equal highest levels.
- A replacement retains installed loadout/upgrades/buffs, gets full health and
  shields and three gameplay seconds of invincibility, and starts with empty
  storage. Its life number advances; old life messages are rejected. The whole
  game pauses for manual orientation readiness before the server resume countdown.
- While awaiting replacement the camera stays at death position. With no pending
  replacement it follows the living teammate. The dead host continues world
  simulation; new routine waves use a living player's position.
- All active ships dead means immediate mission defeat, even with spare charges
  or timers. Connected players return directly to the existing lobby/code, with
  optional last-game statistics and cleared readiness.
- Advancing to the next sector revives connected dead players and refills the
  shared pool exactly once. Installed equipment is retained; old ground drops and
  old-sector packets cannot restore lost storage. Rejoining the same sector never
  refills the pool.

Recovery restores the last host-acknowledged state of the live session. It does
not recover browser-local changes that never reached the host before a crash.
Transport and simulation remain two-player and client-side; the existing service
coordinates rooms and relays data, without server-side physics.
