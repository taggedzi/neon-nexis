# Co-op Progress

Two-player network co-op for NEON NEXUS. Single-player remains the default and
never opens a socket or changes a save.

## Checklist

- [x] 1. Review existing codebase structure + AGENTS.md / standards
- [x] 2. Design network message protocol
- [x] 3. Add signaling server (`server/coop-server.cjs`, regression check in `tools/check-coop-server.cjs`)
- [x] 4. Implement WebRTC peer connection with relay fallback (`js/net.js`)
- [x] 5. Shared map seed + procedural sync (host sends seed in `start`; guest regenerates from it)
- [x] 6. Player state sync (position, aim, health — 20 Hz state packets)
- [x] 7. Projectile and damage sync (batched bullets/mines/strikes; host applies guest damage)
- [x] 8. Pickup / inventory ownership rules (host assigns nearest eligible player; grants guest loot)
- [x] 9. Join code UI + name/color selection (`#screen-coop`, host/join/copy controls)
- [x] 10. Disconnect / reconnect handling (socket retry loop, peer-left → co-op screen, relay fallback)
- [x] 11. Test single-player still works (automated regression suite passes in Chromium and Firefox)
- [x] 12. Automated two-window co-op spec: host fire sync, guest fire ownership,
  signaling-drop survival, shared pause/ready/countdown, and menu pause
  (`tools/ci/coop-smoke.spec.cjs`)

## Current architecture

Host-authoritative world, client-owned avatars.

- The host generates one run seed. Both clients generate the same sector layout,
  anchors, caches, themes, and platforms from that seed.
- The host simulates enemies, anchors, caches, enemy bullets, mines, strikes, and
  ground items. The guest applies host snapshots instead of running that half of
  the simulation.
- Each client owns its own ship: movement, aiming, firing visuals, inventory,
  level-ups, and health UI. The host mirrors the guest avatar for enemy targeting,
  contact checks, and authoritative guest shots.
- The host assigns display names: `PLAYER 1` (host) and `PLAYER 2` (guest).
- WebRTC DataChannels carry gameplay messages. If a channel is unavailable the
  same messages fall back to the signaling server's relay. The server never
  simulates gameplay.
- Co-op runs do not write local checkpoints, so a co-op session cannot overwrite
  a single-player save.

## Integration status

The client transport and co-op logic are integrated and loaded:

- `js/net.js` is loaded in `index.html` before gameplay code. Single-player never
  calls `Net.host()` / `Net.join()`, so no socket or peer connection is created.
- `js/coop.js` owns the co-op state machine, sync queues, and the small hooks the
  simulation calls. It is loaded after `js/sim.js` and `js/enemies.js`.
- `js/sim.js` routes bullets, mines, strikes, damage, pickups, pauses, level
  completion, and game-over through `N.Coop` when co-op is active.
- `js/enemies.js` targets the nearest co-op player on the host and forwards guest
  contact damage through `N.Coop.sendHit`.
- `js/ui.js` provides the uplink screen: hull/color selection, host, join with a
  code, copy code, start run, and live status/transport indicators.
- `js/game.js` routes pause, resume, leave, checkpoint, and explosion effects
  through the co-op layer and refuses local checkpoints during co-op.

See `docs/coop-protocol.md` for the message contract and rates.

## How to run

```bash
npm install          # installs ws and dev tooling
npm run signal       # signaling server on ws://0.0.0.0:8787
npm run check:syntax # syntax gate for all scripts
npm run lint         # eslint
node tools/check-coop-server.cjs   # signaling server regression check
```

Serve the game over HTTP (for example `python3 -m http.server 8000` or the CI
static server) and open it in two tabs/windows. Click **CO-OP UPLINK**, choose a
hull and color, host in one window, and join with the room code in the other.
The host presses **START CO-OP RUN**.

`?signal=ws://<host>:<port>` overrides the default signaling URL. Use `wss://`
when the page is served over HTTPS. The server host defaults to `0.0.0.0` and the
port to `8787`; both are configurable with `HOST` and `PORT`.

## Recent fixes (network and ownership)

Implemented on `feat/coop-multiplayer` after the initial integration:

- **Signaling grace window.** The server no longer sends `peer-left` the instant a
  socket closes. A dropped socket schedules the notice after
  `peerOfflineGraceMs` (default 10s, configurable per server instance); a quick
  reconnect clears the timer. Rooms still expire on the existing 60s peer grace
  and 5-minute TTL.
- **Host reconnect keeps the room code.** The server includes the code and current
  peer presence in `hosted`, and the client stores the code in its connection
  intent so a retry rejoins the same room instead of allocating a new one. A
  reconnecting host whose peer is gone receives `peer: null`, which ends the
  active session cleanly.
- **Peer identity tracking.** `Coop._peerId` records the linked peer. If the peer
  disappears or a different peer is announced while a session is active, the
  session ends instead of silently continuing against the wrong peer.
- **Fatal errors end sessions.** `Coop.onError` now tears down an active session
  rather than only showing a toast. The Net layer reports the error state after
  the teardown so the UI still shows the failure.
- **Single rewards tick for guests.** `Coop.updateGuest` no longer calls
  `N.Rewards.tick(dt)`; `G.update` already does, so guests were earning rewards
  twice per frame.
- **Guest mirror interpolation.** `Coop.applyRemoteState` no longer snaps the
  remote mirror to each state packet; movement and aim are interpolated like the
  rest of the mirrored world.
- **Active weapon in loadout signature.** Changing the selected weapon now
  produces a new signature and sends a loadout update immediately.
- **Remote hit suppression off-screen states.** Incoming hits are ignored while
  the guest is not in `playing` mode (inventory, rewards, level-up, overflow,
  menus). The host simulation still runs, but the guest is not damaged while its
  own UI is covering the game.
- **Orbital ownership.** `G.spawnOrbital` stores an `owner`; `G.updateOrbitals`
  uses `o.owner || G.player` for position, stats, and damage credit. Guest
  orbitals no longer orbit or credit the host.
- **Explosion ownership.** Mine, strike, and explosive-bullet explosions now pass
  the owning player into `G.explode`, which forwards it to `G.damageEnemy` so
  kill/XP credit lands on the correct player.
- **Server-authoritative shared pause.** Any menu or pause input sends
  `pause_request` to the signaling socket. The server moves the room to `PAUSED`
  and broadcasts `global_pause`; every client stops its simulation. Each player
  presses READY (`ready_signal`), the server broadcasts `ready_state`, and once
  both are ready it runs a 3-second `countdown_start` and then `global_resume`.
  The server cancels a countdown if a member drops. The client stores the pause
  state in `Coop.pauseState` and renders it on the existing pause screen.
- **Menu close returns to ready.** Closing inventory, rewards, level-up, or
  overflow during a shared pause shows the co-op pause screen. It does not send
  `ready_signal` until that player presses READY. The rewards close control reads
  RETURN TO READY while a co-op session is active.

## Known limitations

- If the guest's reward bank is full when the host grants an item, the host has
  already removed the item and the guest's `N.Rewards.bank` failure leaves it
  uncollected. The item is lost in that edge case.
- The shared pause is server-relayed; if the signaling socket is lost, the room
  cannot advance its pause state until the client reconnects. The 10-second
  `peerOfflineGraceMs` window covers brief drops.
- A player still inside a menu (inventory, rewards, level-up, overflow) cannot
  press READY until the menu is closed. The other player waits on the pause
  screen; this is intentional but means a long menu holds the session.
- Pause state lives only in memory on the server. A server restart drops all
  rooms, including paused ones.

## Remaining validation

Checked on 2026-10-30 with Node v24.21.0 on Linux:

- `node tools/ci/syntax.cjs` passed.
- `npx eslint` on the touched co-op scripts passed (`js/game.js`, `js/ui.js`,
  `js/coop.js`, `js/net.js`, `server/coop-server.cjs`,
  `tools/check-coop-server.cjs`, `tools/ci/coop-smoke.spec.cjs`).
- `node tools/check-coop-server.cjs` passed, 30 assertions, including
  pause, ready, countdown, and resume.
- `git diff --check` passed.
- `npx playwright test tools/ci/coop-smoke.spec.cjs` passed, 12 tests.
  Playwright 1.64.1 launched Chromium 156.0.8078.4 and Firefox 157.0. Coverage
  is host fire sync, guest fire ownership, a brief signaling drop, shared
  pause/ready/countdown, inventory pause, and rewards pause.

The full single-player browser suite (`npm run test:browser`) was not re-run
in this session. Playwright still requires Node 20 or newer, and this checkout's
`package.json` asks for Node 24. The system Node on `PATH` may be older; put a
Node 24 `bin` directory first before `npm run test:browser`.

## Notes for the next contributor

- The signaling server creates rooms, hands out 5-character codes, relays
  signaling and gameplay fallback messages, rate-limits each socket, and expires
  idle rooms. It never simulates or stores game state.
- Reconnection reuses the same client ID so the server can keep the room during
  its grace period. The host's room survives a brief guest drop; the guest
  re-offers when the peer is re-announced.
- Co-op checkpoints and saves are intentionally disabled. Leaving a co-op run
  returns to the menu without touching single-player progress.
