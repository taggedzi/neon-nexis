# 016 — Binary co-op payloads

Status: Implemented — needs validation

Issue 015 is on `main`. Automated checks, including the co-op browser smoke,
have passed. On 2026-11-01 the owner played a local two-window room and
reported that everything they tried worked. A live relay byte capture is still
open, so this is not Done.

## Feature summary

Pack the fight messages on the WebRTC data channel into a versioned binary
layout. A busy two-player link should drop from roughly 200 KB/s of JSON to
roughly 30 KB/s. A later room with one host and three guests should stay in a
similar relay budget, because each guest is another copy of the same per-link
stream. Gameplay objects, tick rates, and authority stay as they are. Lobby,
pause, and one-time setup messages stay JSON.

The owner approved this plan on 2026-10-31 so free STUN and TURN relays can
carry more matches. STUN still only discovers addresses. The bytes saved are
the data-channel bytes a TURN relay carries, and each player's upload.

## Decision

- Decision: Fight messages use binary version 1. Lobby, pause, and setup stay
  JSON. An ordinary `state` message no longer carries the full participant
  snapshot. A version mismatch closes the link.
- Rationale: Free relays have a low byte budget. Short JSON keys save less
  than a packed record, and deflate of the current JSON is already near the
  packed size. Repeating the recovery snapshot on every 20 Hz `state` is the
  multiplier that would exhaust a relay once three guests are connected.
- Approval: Owner approved the plan on 2026-10-31.
- Consequences: Both browsers must load the same build. There is no mixed
  JSON/binary fight session. Four-player links, a seat id, deflate, delta
  worlds, slower send rates, and coarser positions are out of scope.
- Supersedes: Nothing. The 4 Hz `participant` message, damage and checkpoint
  snapshots, and `event_ack` remain.

The same decision is in `docs/decisions.md`. That entry was updated when the
codec landed. Do not add a second copy.

## Assumptions

- "Same performance" means the same send rates, the same rounded positions,
  and the same host authority.
- Four players are not part of this work. The host would upload the world and
  bullet stream once per guest, so three guests cost about three times one
  guest link.
- Start implementation from `main` after issue 015 has landed. Continue on
  `feat/coop-binary-payloads` if that branch is the 015 tip plus this document.
  Do not stack the codec on an unmerged branch other than that.

## Wire layout

Add `js/coop-wire.js`, loaded after `js/content.js` and `js/ships.js` and
before `js/coop.js`. `js/net.js` calls `NEON.Wire` from its send function, so
the script tag can sit lower in `index.html` than `js/net.js`.

Header on every binary message, little-endian:

| Offset | Field |
| --- | --- |
| 0 | version `1` |
| 1 | type |
| 2 | sector |
| 3 | life |
| 4 | target life, or `255` when the message has none |
| 5 | `_run` as uint16 |
| 7 | `_s` as uint32 |

`Net.send` still stamps `_run`, `_sector`, `_life`, `_targetLife`, and `_s`
before encoding. `encode` returns an `ArrayBuffer` for a fight type and `null`
for everything else. `null` keeps today's `JSON.stringify` path. On receive, a
string is parsed as JSON and an `ArrayBuffer` is decoded. `attachChannel` sets
`binaryType` to `arraybuffer`. A wrong version drops the link through the
existing lost-link path once. A truncated body is ignored.

Fight types, in type-byte order: `state`, `world`, `bullet`, `ebullet`,
`mine`, `strike`, `fire`, `fx`, `loadout`, `hit`, `heal`, `kill`, `xp`,
`grant`, `grant_ack`, `event_ack`, `participant`, `lives`.

These stay JSON: `session_sync`, `sync_entities`, `session_ack`,
`session_hello`, `death`, `death_ack`, `revive`, `revive_ack`, `start`,
`complete`, `advance`, `gameover`, `mission_end`, `bye`, `peer-left`, and
every `{t:'ctrl'}` lobby and pause message.

Numbers use the rounding the senders already apply. Positions fit a uint16 of
`(value + 1024) * 10` because a sector is at most about 4400 units wide.
Angles are an int16 of thousandths, which matches `round(angle, 3)` across
±π. Hull uses uint32 tenths because sector scaling has no hard cap. Bullet
speed, area, pull, and curve use the narrowest width that holds the maximum
`content.js` can produce. The round-trip test builds that maximum, and a value
that does not fit fails the test instead of wrapping. Stats and other
unbounded floats inside a participant snapshot use float32. Already-rounded
fields must match exactly.

Strings that come from a fixed table become an index: weapon, module,
protocol, enemy style, ship type, bullet `kind` (including `hostile`). Enemy
ids `enemy_N` and grant ids `gN` become the integer. Enemy name and role are
not sent; the guest already looks them up from the style. Colors that are
`#rrggbb` or `hsl(h,s%,l%)` with integer parts pack to three or four bytes and
decode back to the same string. Item labels stay length-prefixed UTF-8.

World and ship records are fixed layouts, resent in full at the current rates,
so a late packet is still a complete snapshot. Bullets, enemy bullets, mines,
and strikes use a presence mask so the many zero fields take no space. One
`packPlayer` writes the snapshot `restore` already requires. `participant`,
`event_ack`, and a death-pending `state` all use it.

`stampMessage` stops attaching that snapshot to an ordinary `state`. It still
attaches `deathPending` while a death is unacknowledged, and it still attaches
the snapshot to `grant_ack`. The 4 Hz `participant` message, the damage and
checkpoint sends, and `event_ack` remain. Ship motion, hull, magnet, and
pickup radius stay on the 20 Hz `state`.

Decode rebuilds the objects `applyRemoteState`, `applyWorld`,
`applyBulletBatch`, and `restore` already read. Callers in `js/coop.js` keep
building those objects.

## Size targets

The new check must enforce these ceilings. They are looser than the packing
estimates and still several times under the JSON sizes.

| Payload | Ceiling |
| --- | ---: |
| Ship `state` | 64 B |
| One bullet | 48 B |
| Eight-bullet batch | 320 B |
| World of 80 enemies, plus a few anchors, caches, and items | 3,200 B |
| Participant with 500 accepted event ids | 1,400 B |

Estimated steady result per link in a busy fight: guest upload about 12 KB/s,
host upload about 20 KB/s. Three guest links would be about three times the
host figure. Today's busy two-player JSON is about 200 KB/s combined. Those
rates are estimates from the message builders, not a live capture.

## Implementation steps

1. Keep this issue and its index row. When code starts, set the status to
   In progress, record the wire decision in `docs/decisions.md`, and update
   `docs/coop-protocol.md` so the fight-message table names the binary types
   and the rates above.

2. Add `js/coop-wire.js` and the script tag in `index.html`. Implement encode
   and decode for the fight types, the catalogs, and `packPlayer`. No change
   to simulation code.

3. In `js/net.js`, set `binaryType`, send a buffer when `encode` returns one,
   and decode buffers on message. A version mismatch uses the existing
   lost-link path.

4. In `js/coop-session.js`, limit the `state` snapshot attach to
   `deathPending`.

5. Add `tools/check-coop-wire.cjs`. It loads `js/util.js`, `js/content.js`,
   `js/ships.js`, and `js/coop-wire.js` in a `vm` sandbox, the same way
   `tools/check-coop-lobby.cjs` loads a script. For each fight type, build a
   realistic object, including a maxed bullet from content data and a world of
   80 enemies, then assert decode equals the rounded input and the byte length
   is within the ceiling. Assert a lobby control object returns `null` from
   `encode`. `tools/ci/unit.cjs` already runs every `tools/check-*.cjs`.

## Verification

- `node tools/check-coop-wire.cjs`
- `npm run check:syntax` and `npm run lint`
- `git diff --check`
- The existing object-level coop checks stay valid because they call handlers
  with objects, not wire bytes.
- Browser: serve the repo and run the existing co-op smoke if Playwright is
  installed. The smoke is the check that a real data channel still opens and a
  run still syncs. If Playwright is not installed, say so and leave that pass
  pending.

## Out of scope

- A fourth player, mesh links, or a seat id. Version `1` has room to add a
  seat byte later.
- Deflate. Packed records are already near the compressed-JSON size.
- Delta world updates. A full snapshot at 5 Hz stays self-contained.
- Lower send rates, coarser positions, or changes to hit and pickup rules.

## Implementation and validation

Changed files:

- `js/coop-wire.js` encodes and decodes fight messages. `encode` returns `null`
  for a non-fight message or a value that does not fit, and that message stays
  JSON.
- `index.html` loads it after `js/ships.js` and before `js/coop.js`.
- `js/net.js` sets `binaryType` to `arraybuffer`, sends a buffer when `encode`
  returns one, and decodes buffers on the fight channel. Lobby delivery,
  `{t:'ctrl'}`, and `peer-left` stay JSON. A wrong version calls the existing
  lost-link path once.
- `js/coop-session.js` attaches the recovery snapshot to `state` only while a
  death is unacknowledged. `grant_ack` still carries it.
- `tools/check-coop-wire.cjs` round-trips every fight type.
- `docs/coop-protocol.md` names the binary types and the unchanged rates.
- `docs/decisions.md` records that the codec now exists.

Field widths, where they narrow the plan's uint32 hull note:

- Ship hull is uint16 tenths. A player cannot reach 6553.5 hull points, and
  uint32 hull would push a 20-character `state` past 64 bytes.
- Enemy hull is uint24 tenths. uint32 hull on 80 rows would pass 3,200 bytes.
  A larger value keeps that one message on JSON.
- Phase is int16 hundredths. A 420-second sector at 0.7 rad/s fits. The check
  uses 300.28. Past ±327.67 the world message stays JSON.
- Bullet `pull` is uint16. Content reaches 820, which does not fit in a uint8.
- Snapshot event ids and grant serials are uint16. An id above 65535 keeps
  that message on JSON. Hit, heal, kill, and xp event ids stay uint32.
- Target life 255 means "absent". A real target life of 255 stays JSON.
- Stats, buffs, snapshot motion, beam width and life, and the lives timers are
  float32. A boolean stat keeps that loadout on JSON.
- Bullets use a 24-bit presence mask stored in a uint32. Mines and strikes use
  a uint8 mask. Zero fields take no payload.

The 48-byte bullet ceiling is an ordinary pulse with the zero fields omitted.
A bullet with every content maximum set still encodes and round-trips. It is
larger than 48 bytes because every field is present.

Checks run on 2026-11-01:

- `node tools/check-coop-wire.cjs` passed. Measured sizes: ship `state` 64 B,
  one pulse 36 B, eight pulses 204 B, world of 80 enemies plus three anchors,
  two caches, and three items 2,789 B, participant with 500 event ids 1,304 B.
  A rail bullet at the content speed, area, pull, and curve maximum
  round-trips. Speed 8000 returns `null`. A lobby control returns `null`.
  Version byte 2 returns `versionMismatch`. A truncated body returns `null`.
- `npm run check:syntax` passed.
- `npm run lint` passed.
- `npm run test:unit` passed, including the wire check and the existing
  object-level co-op checks.
- `git diff --check` passed.
- `npx playwright test tools/ci/coop-smoke.spec.cjs` passed 40 tests in 11.7
  minutes on 2026-11-01. Playwright 1.64.1 drove headless Chromium 156.0.8078.4
  and Firefox 157.0 against the PHP 8.4.13 development server. The run covers
  firing, grants, death, pause, reload, and link recovery. It does not measure
  bytes on a live relay.

Limitations: the size figures are from the check's fixtures, not a live
capture. Float32 stats are not bit-identical to the float64 values the game
keeps. Projectile fields the sender already rounds stay exact. Fields the
sender left unrounded, including size, area, curve, and crit chance, are
stored on the codec's fixed-point grid. Guest bullets are cosmetic.

Remaining: a live relay byte capture. Owner playtest on 2026-11-01: one PC,
two browser windows, a local PHP room, and a match that played successfully.
Implementation commit: `5769e55`.
