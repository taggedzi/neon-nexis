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
- [ ] 12. Basic co-op playtest notes (manual two-tab test; no automated co-op spec yet)

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

## Remaining validation

The Playwright regression suite passes when run under Node 20. Install Node 20
locally and put its `bin` directory on `PATH` first, then run
`npm run test:browser`. It covers the single-player smoke, regression,
save-policy, and settings suites in both Chromium and Firefox. The server
regression check, syntax check, and lint also pass. A two-window co-op smoke test
is still a manual step because there is no automated co-op spec yet.

## Notes for the next contributor

- The signaling server creates rooms, hands out 5-character codes, relays
  signaling and gameplay fallback messages, rate-limits each socket, and expires
  idle rooms. It never simulates or stores game state.
- Reconnection reuses the same client ID so the server can keep the room during
  its grace period. The host's room survives a brief guest drop; the guest
  re-offers when the peer is re-announced.
- Co-op checkpoints and saves are intentionally disabled. Leaving a co-op run
  returns to the menu without touching single-player progress.
