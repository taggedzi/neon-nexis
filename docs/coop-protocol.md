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
| Guest (`PLAYER 2`) | Own ship and local UI | Own movement, aim, inventory, health, shots |

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

### Host → guest

| Type | Payload | Rate |
| --- | --- | --- |
| `start` | `seed`, `level`, `host` profile | once |
| `state` | Host ship position, aim, hull, health | 20 Hz |
| `world` | Enemies, anchors, caches, ground items, elapsed, kills | 5 Hz |
| `bullet` / `ebullet` | Projectile spawn parameters for cosmetic guest simulation | batched at 20 Hz |
| `mine` / `strike` | Host-created hazard visuals | on creation |
| `hit` | Damage source amount, position, contact flag | on hit |
| `grant` | Loot item claimed by the guest | on pickup |
| `xp` | XP earned by a guest kill | on kill |
| `kill` | Shared kill count and reward pacing tick | on kill |
| `level` | Next run seed/sector, or sector-complete state | on change |
| `complete` / `gameover` / `bye` | Session flow | on change |

### Guest → host

| Type | Payload | Rate |
| --- | --- | --- |
| `state` | Guest ship position, velocity, aim, hull, health, magnet | 20 Hz |
| `loadout` | Weapons, passives, protocols, derived stats | on change |
| `fire` | Weapon index, aim angle, origin | per shot |
| `hit-ack` | Reserved for future rewind checks | unused |
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
   resumes its simulation.

If a member's socket drops during the countdown, the server cancels the resume
and broadcasts `global_pause` again. A reconnecting member receives the current
pause state when it reattaches.

## Ownership rules

- The host is the only client that decides which player claims a ground item.
  It chooses the nearest living player within that player's pickup radius.
  Host-owned items use the normal local path; guest-owned items are removed from
  the host world and sent with `grant`.
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
  same room with the same client ID. The server keeps the room for a grace period.
- If the data channel drops, gameplay continues over the server relay. The
  transport status indicator reports `RELAY` instead of `P2P`.
- When a peer leaves, the remaining player is returned to the co-op screen with
  a clear status message. The host can reopen the room and wait for a new guest.

## Non-goals

- Anti-cheat validation or authoritative hit rewind.
- More than two players.
- Server-side physics, rendering, or procedural generation.
- Persisted co-op sessions or cross-device saves.
