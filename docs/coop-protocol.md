# Co-op network protocol

This document describes the one-to-four-player co-op room for NEON NEXUS. It is an
implementation contract, not a public API promise. PHP introduces each guest to the host. The hosting browser owns the lobby, shared pause, and the match.
Gameplay moves only on the WebRTC data channel. There is no gameplay relay.

## Roles

| Role | Simulation | Authority |
| --- | --- | --- |
| Host (`PLAYER 1`) | Full game simulation | World seed, enemies, destructibles, loot drops, sector flow |
| Guests (`PLAYER 2` through `PLAYER 4`) | Own ship and local UI | Own movement, aim, inventory, damage mitigation, shots; acknowledged state retained by host |

All clients generate the sector from the host's run seed, so the static map is
identical without sending map geometry.

## PHP introduction

The page asks `php/coop.php` for status. `?intro=` overrides that URL. Co-op
stays off unless the server config has `enabled` true and at least one STUN or
TURN address. The **CO-OP UPLINK** button stays visible and is disabled when
co-op is off, the list is empty, or status fails.

PHP actions are `status`, `host`, `join`, `checkin`, `leave`, `card`, `poll`,
and host-only `roster`. Introduction protocol 2 is required for host/join;
older requests are refused with `error: version`. The SQLite lobby retains its
legacy columns during migration and adds `protocol` and a nullable locked roster.
`coop_seats` stores up to three guest IDs, their stable seats (1–3), and separate
offer/answer cards for each host–guest link. Allocation is serialized. Existing
protocol-1 rooms cannot be joined by a protocol-2 client.

The host checks in through polling (and the explicit check-in verb remains
available). A host leave deletes the room and its seats. A guest leave removes
only its seat/card row. Stale rooms expire after ten minutes without host check-in;
the daily cleanup removes rooms older than 24 hours. Orphan introduction seats
are removed on database open. PHP stores no world or gameplay state.

A STUN entry is a URL. A TURN REST entry uses a server-side secret. PHP mints
`expiryUnix:clientId` and a base64 HMAC-SHA1 credential for
`credentialTtlSeconds` (default 7200). Paid relays (Twilio, Cloudflare
Realtime TURN, Metered, Xirsys) are server-side token calls. The browser
receives only the returned `iceServers`. The long-term secret and API key are
not sent. An optional `tokenUrl` overrides a vendor URL and is not echoed.

Each guest is the offerer for its own link. Host cards name `targetId`; PHP
only returns that answer to the intended guest. Cards carry `session`, `sdp`,
`candidates`, `clientId`, `profile`, `protocol`, `seat`, and a per-link revision.
Poll receives a map of known revisions and returns `peers`, each containing
`clientId`, `seat`, and a new `card` or null. Guests see only the host's card for
their own link; the host sees every guest introduction.

Lobby profiles contain ship/color and an optional issue-024 saved ship.
Introduction-card profiles are cosmetic; saved equipment travels in the validated
`lobby_profile` control only after the data channel opens. Callsigns are
assigned from the seat: PLAYER 1 hosts, PLAYER 2–4 join. Names cannot be typed.
Room codes use an unambiguous 32-character alphabet (no I, O, 0, 1). Capacity is
always four including the host, with no count selector. The host shares the code
only with intended participants. Connected ready members at launch form the run
roster. The host locks their ID-to-seat mapping in PHP before delivering launch.
New identities cannot fill vacant seats during that run. Starting participants
may reconnect to their original seat. Returning to the lobby unlocks new joins.

## WebRTC setup

The guest creates the `game` data channel before the offer. The host answers
and attaches to that channel. `NEON.Net.iceServers` comes from the PHP status
response. The sample config leaves the list empty, so the game has no runtime
CDN dependency. Gameplay is not relayed. `NEON.Net.label()` is `P2P` or
`OFFLINE`.

## Gameplay messages

Every gameplay message has a `t` type. `_s` is a sender sequence number;
receivers drop duplicates and out-of-order messages. `_run`, `_sector`, and
`_life` scope gameplay to the current mission, sector, and sender life. Host
damage and reward messages also carry `_targetLife`. A stale packet cannot
revive a previous life or change a later mission. Connection setup uses a
monotonic `syncId`; duplicate setup packets acknowledge without restoring twice.

Fight messages use binary version 6 (the preceding checkout used version 5). The type order is `state`, `world`,
`bullet`, `ebullet`, `mine`, `strike`, `fire`, `fx`, `loadout`, `hit`, `heal`,
`kill`, `xp`, `grant`, `grant_ack`, `event_ack`, `participant`, `lives`, and `avatars`.
Send intervals are unchanged; nominal ship updates also have the existing
4 Hz session heartbeat. An ordinary `state` carries ship motion, hull,
magnet, and pickup radius. It does not carry the recovery snapshot. The
snapshot still rides on the 4 Hz `participant` message, on damage and
checkpoint updates, on `event_ack`, on `grant_ack`, and on `state` while a
death is waiting for acknowledgment. Lobby, pause, and one-time setup stay
JSON: `session_sync`, `sync_entities`, `session_ack`, `session_hello`, `death`,
`death_ack`, `revive`, `revive_ack`, `start`, `complete`, `advance`,
`gameover`, `mission_end`, `bye`, `peer-left`, `stats_row`, `stats_end_request`,
`stats_end_ack`, `book_sync`, and every `{t:'ctrl'}` message.
A binary version other than 6 ends the receiving client's co-op session with
an update error; a host rejection closes its room. Old introductions are refused
before joining. A truncated body is ignored. Version 6 adds source and target seat bytes after the type byte (0–3, or 255
when absent). The remaining version-5 header is sector, sender life, target life,
run ID, and sequence. Type 19, `avatars`, packs up to three states: count byte,
then each seat byte, the existing state body, and nullable respawn seconds.
Duplicate/out-of-range seats and malformed bodies are rejected. Values outside
binary ranges keep the existing bounded JSON fallback. See
[issue 016](work-to-be-done/016-coop-binary-payloads.md) for the original codec.

### Host → guest

| Type | Payload | Rate |
| --- | --- | --- |
| `session_sync` | `syncId`, seed/sector, retained player, host player, run, pool, phase, pause epoch | until setup acknowledgment |
| `avatars` | All other connected ships, with seats, motion, hull, health, and respawn timers | nominal 20 Hz + session heartbeat per guest |
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
| `participant` | Full player/reward recovery snapshot | 4 Hz, on damage and checkpoint, on `event_ack` and `grant_ack`, and on `state` only while a death is unacknowledged |
| `death` / `death_ack` | Death snapshot and confirmation | retried until acknowledged |
| `session_ack` / `revive_ack` | Setup or life transition confirmation | on application |
| `event_ack` | Accepted damage/reward event and resulting player snapshot | on application or retry |
| `grant_ack` | `grantId` and `ok` after the guest accepts or rejects a grant | on each `grant` |
| `bye` | Leaving | once |

## Shared pause and ready flow

The hosting browser owns pause so all connected clients stop and resume together.
Control messages travel on the data channel. The guest wraps them as
`{t:"ctrl", body}`. The host applies them locally and sends room results back
on the channel. A guest cannot forge `global_pause` by sending it as an
ordinary channel message.

1. A client opens any menu (inventory, rewards, level-up, overflow, pause) or
   presses the pause key. It sends `pause_request`.
2. The host moves the room to `PAUSED`, records the initiator, and sends
   `global_pause`.
3. Every client pauses its simulation. The initiator keeps its menu open; the
   other client shows the co-op pause screen. Closing the menu and pressing
   READY sends `ready_signal`.
4. The host sends `ready_state` after each signal. When every online member is
   ready, it sends `countdown_start` with a 3-second timer.
5. After the countdown the host sends `global_resume`, and each client resumes
   its simulation. A client does not resume because its own timer elapsed. If
   that resume is missing, the client sends `pause_sync` and applies the host's
   current pause, countdown, or resume message.

If a member drops during the countdown, the host cancels the resume and sends
`global_pause` again. Controls carry the current run ID and pause epoch; ready
signals from earlier pauses are rejected. A departing guest is removed from the
required membership, and the remaining host can continue alone.

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

- A missing join code, full room, or introduction error is reported in the co-op
  screen and never starts a run.
- If the direct link never opens, both players stay on the co-op screen. PHP
  responses carry connection cards only.
- If the data channel drops, the guest offers again through PHP. The host keeps
  the guest for about 10 seconds, then clears that guest if the link does not
  return. The transport label stays `OFFLINE` until the channel is open.
- When a guest leaves, the host keeps the room code and continues playing. The
  lobby row stays until the host leaves or the check-in expires.
- Host departure deletes the lobby. Host migration and persisted co-op saves are
  not implemented.

## Non-goals

- Anti-cheat validation or authoritative hit rewind.
- Host migration and persistent co-op saves.
- Server-side physics, rendering, or procedural generation.
- Persisted co-op sessions or cross-device saves.


## Persistent lobby and participant recovery (issue 014)

The hosting browser owns lobby phase (`lobby` / `run`), membership, profiles,
readiness, the configured shared respawn count, and a monotonically increasing
run ID. It also owns the world, participant registry, shared remaining
respawns, and life transitions. `js/coop-host.js` is that room authority.
`js/coop-session.js` implements the browser lifecycle separately from
avatar/world transport in `js/coop.js`.

| Client control | Effect |
| --- | --- |
| `lobby_profile` | Update ship/color; invalidate readiness and launch countdown |
| `lobby_respawns` | Host-only integer 0–8; default 4; invalidate readiness |
| `lobby_ready` | Ready/unready against the current lobby revision |
| `lobby_sync` | Request current lobby state |
| `return_lobby` | Host-only, matching run ID; end mission without closing room |

The host sends `lobby_state` (members, profiles, readiness, revision,
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
throttled and duplicate chunks do not create extra hazards. All connected
players must ready to resume. Initial launch and normal sector advancement reuse
the host countdown automatically after synchronization; they do not require a
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
  game pauses for manual orientation readiness before the host resume countdown.
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
Transport uses a host-centered star with up to three guest links. Guests never
simulate enemies; the host relays the permitted ship/world state. PHP only introduces
the browsers. There is no server-side physics.

## Four-player routing and match options (issue 028)

Transport sequence numbers, ICE negotiation, retries, and channel lifetime are
per link. `Net.send(message, targetId)` targets one guest; omitting the target
broadcasts. Incoming callbacks carry the authenticated channel's client ID;
guest-supplied IDs cannot select another participant's recovery record. Setup
serials, recovery snapshots, life counters, pending revivals, and retained rewards
are per participant. Damage, healing, pickup grants, kill XP, statistics authority,
and logbook confirmations target their owning participant. Every guest gets kill
pacing ticks, but only the killer gets kill XP. Guests receive other ships through
the host's packed avatar messages, without guest-to-guest connections.

The existing shared respawn pool is unchanged: host-configured integer 0–8,
default 4; Hardcore uses zero. Capacity does not multiply the pool or change
spawn/difficulty rules. The host's saved-ship toggle defaults off. When off,
players start fresh; when on, each player may explicitly choose a saved ship or
keep the fresh default. Issue 024's sector cap and Hardcore restrictions remain.
