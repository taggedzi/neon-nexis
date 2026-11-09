# GitHub #72 — Recover co-op roster synchronization

Status: Done

A timed-out PHP roster write can suppress the launch and every later roster
update. Recover in the existing room while keeping the confirmed roster lock as
a prerequisite for launch. See [GitHub #72](https://github.com/taggedzi/neon-nexis/issues/72).

## Implementation and validation

- `js/net.js` serializes roster writes and ties each result to its session and
  desired run roster. A newer update can proceed after an older failure.
- Implementation choice, 2026-11-09, under the owner's fix request: retry
  transport failures up to three attempts total, with 500 ms between attempts.
  An explicit rejection or exhausted launch lock resets readiness in the
  existing lobby and shows the host how to retry. This bounds the wait and
  preserves live peer connections. It replaces the rejected promise chain.
- `tools/check-coop-star.cjs` exercises a hung unlock response body, a hung lock
  fetch, rejection and same-room retry, and stale completion after rehosting.
  Passed with Node 26.13.0 on Windows.
- `tools/ci/coop-smoke.spec.cjs` injects a lock timeout in the second run of the
  same room with a guest. It checks both peers wait for the confirmed lock,
  reach gameplay after retry, and keep the same room. Passed in Playwright
  Chromium 156.0.8078.4 and Firefox 157.0 on Windows with PHP 8.4.13.
- Real multi-machine network behavior was outside these local fault-injection checks.
