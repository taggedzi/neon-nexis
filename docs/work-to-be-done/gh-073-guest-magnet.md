# GitHub #73 — Use authoritative Magnet pickup range for co-op guests

Status: Done

In shared-progression co-op, the host granted Magnet to guests but pickup
eligibility read a legacy flag. See [GitHub #73](https://github.com/taggedzi/neon-nexis/issues/73).

## Implementation and validation

- `js/sim.js` uses the guest's host-owned buff timer and derived pickup range
  in shared mode. Implementation choice, 2026-11-09, under the owner's fix
  request: keep the existing 5.5× multiplier and legacy adapter. This aligns
  shared guest eligibility with the host while preserving legacy callers and
  the existing local-player outer attraction behavior.
- `tools/check-grants.cjs` reproduced the missing 200-unit pickup before the
  fix. The updated check passed on Windows with Node 26.13.0. It covers active
  and expired timers, spoofed guest state, the range boundary, wall occlusion,
  derived stats, nearer-collector arbitration, and legacy guest Magnet.
- `tools/ci/coop-progression.spec.cjs` grants Magnet through the shared reward
  path, rejoins the same guest, and checks that a pickup 200 units away results
  in one shared reward and one physical pickup credited to that guest.
  All four tests in the file passed in Playwright Chromium 156.0.8078.4 and
  Firefox 157.0 on Windows with PHP 8.4.13. The fixture uses local WebRTC peers.
